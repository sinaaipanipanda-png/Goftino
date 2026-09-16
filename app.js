/* =========================================================
   GOFTINO — app.js
   Version 1.0 Beta

   Frontend: GitHub Pages
   Backend: External API
   Database: PostgreSQL

   IMPORTANT:
   API_URL را با آدرس واقعی سرور خودتان عوض کنید.
========================================================= */

// =========================================================
// API CONFIG
// =========================================================

const API_URL = "https://YOUR-GOFTINO-SERVER.example.com/api";

let currentUser = null;
let currentChat = null;
let chats = [];
let messageTimer = null;


// =========================================================
// API REQUEST
// =========================================================

async function api(endpoint, options = {}) {

    const url = `${API_URL}${endpoint}`;

    const config = {
        method: options.method || "GET",
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {})
        }
    };

    if (options.body !== undefined) {
        config.body = JSON.stringify(options.body);
    }

    try {

        const response = await fetch(url, config);

        let data = null;

        try {
            data = await response.json();
        } catch (_) {
            data = {};
        }

        if (!response.ok) {

            throw new Error(
                data.message ||
                data.error ||
                `خطای سرور (${response.status})`
            );
        }

        return data;

    } catch (error) {

        console.error("API Error:", error);

        if (
            error instanceof TypeError ||
            error.message.includes("Failed to fetch")
        ) {
            throw new Error(
                "ارتباط با سرور برقرار نشد."
            );
        }

        throw error;
    }
}


// =========================================================
// TOKEN
// =========================================================

function getToken() {
    return sessionStorage.getItem("goftino_token");
}

function setToken(token) {
    sessionStorage.setItem("goftino_token", token);
}

function removeToken() {
    sessionStorage.removeItem("goftino_token");
}


// =========================================================
// AUTH HEADER
// =========================================================

function authHeaders() {

    const token = getToken();

    if (!token) {
        return {};
    }

    return {
        Authorization: `Bearer ${token}`
    };
}


// =========================================================
// DOM HELPERS
// =========================================================

function $(id) {
    return document.getElementById(id);
}

function show(id) {
    const element = $(id);

    if (element) {
        element.classList.remove("hidden");
    }
}

function hide(id) {
    const element = $(id);

    if (element) {
        element.classList.add("hidden");
    }
}

function closeModal(id) {
    hide(id);
}


// =========================================================
// TOAST
// =========================================================

function showToast(message, type = "normal") {

    const toast = $("toast");

    if (!toast) return;

    toast.textContent = message;

    toast.className = "toast";

    if (type === "success") {
        toast.style.background = "#16885a";
    }

    if (type === "error") {
        toast.style.background = "#d83d45";
    }

    show("toast");

    clearTimeout(showToast.timer);

    showToast.timer = setTimeout(() => {
        hide("toast");
    }, 3000);
}


// =========================================================
// INITIALIZATION
// =========================================================

document.addEventListener("DOMContentLoaded", async () => {

    try {

        await checkServer();

        const token = getToken();

        if (token) {

            try {

                const response = await api("/auth/me", {
                    headers: authHeaders()
                });

                currentUser = response.user;

                showApp();

                await loadChats();

            } catch (error) {

                removeToken();

                showAuth();
            }

        } else {

            showAuth();
        }

    } catch (error) {

        console.error(error);

        showAuth();

        showToast(
            "اتصال به سرور برقرار نشد.",
            "error"
        );
    }
});


// =========================================================
// SERVER CHECK
// =========================================================

async function checkServer() {

    try {

        await api("/health");

        hide("loading-screen");

    } catch (error) {

        hide("loading-screen");

        throw error;
    }
}


// =========================================================
// AUTH PAGE
// =========================================================

function showAuth() {

    hide("app-page");
    show("auth-page");
}

function showApp() {

    hide("auth-page");
    show("app-page");

    updateUserUI();
}


// =========================================================
// LOGIN
// =========================================================

async function login() {

    const email = $("login-email").value.trim();
    const password = $("login-password").value;

    if (!email || !password) {

        showToast(
            "ایمیل و رمز عبور را وارد کنید.",
            "error"
        );

        return;
    }

    try {

        setLoadingButton(
            event?.target,
            true
        );

        const response = await api("/auth/login", {

            method: "POST",

            body: {
                email,
                password
            }

        });

        if (!response.token) {
            throw new Error("توکن ورود دریافت نشد.");
        }

        setToken(response.token);

        currentUser = response.user;

        showApp();

        await loadChats();

        showToast(
            "با موفقیت وارد شدید.",
            "success"
        );

    } catch (error) {

        showToast(
            error.message,
            "error"
        );
    }
}


// =========================================================
// REGISTER
// =========================================================

async function register() {

    const name = $("register-name").value.trim();
    const email = $("register-email").value.trim();
    const password = $("register-password").value;

    if (!name || !email || !password) {

        showToast(
            "تمام فیلدها را تکمیل کنید.",
            "error"
        );

        return;
    }

    if (password.length < 8) {

        showToast(
            "رمز عبور باید حداقل ۸ کاراکتر باشد.",
            "error"
        );

        return;
    }

    try {

        const response = await api(
            "/auth/register",
            {
                method: "POST",

                body: {
                    name,
                    email,
                    password
                }
            }
        );

        if (response.token) {

            setToken(response.token);

            currentUser = response.user;

            showApp();

            await loadChats();

        } else {

            showLogin();

            $("login-email").value = email;

            showToast(
                "حساب با موفقیت ساخته شد. وارد شوید.",
                "success"
            );
        }

    } catch (error) {

        showToast(
            error.message,
            "error"
        );
    }
}


// =========================================================
// LOGIN / REGISTER SWITCH
// =========================================================

function showRegister() {

    hide("login-box");
    show("register-box");
}

function showLogin() {

    hide("register-box");
    show("login-box");
}


// =========================================================
// LOGOUT
// =========================================================

async function logout() {

    try {

        if (getToken()) {

            await api("/auth/logout", {
                method: "POST",
                headers: authHeaders()
            });

        }

    } catch (_) {
        // حتی اگر API logout خطا بدهد،
        // توکن محلی حذف می‌شود.
    }

    removeToken();

    currentUser = null;
    currentChat = null;
    chats = [];

    if (messageTimer) {
        clearInterval(messageTimer);
        messageTimer = null;
    }

    showAuth();
}


// =========================================================
// USER UI
// =========================================================

function updateUserUI() {

    if (!currentUser) return;

    const name =
        currentUser.name ||
        currentUser.username ||
        "کاربر";

    const avatarLetter =
        name.trim().charAt(0) || "گ";

    if ($("sidebar-name")) {
        $("sidebar-name").textContent = name;
    }

    if ($("sidebar-avatar")) {
        $("sidebar-avatar").textContent = avatarLetter;
    }

    if ($("profile-name")) {
        $("profile-name").textContent = name;
    }

    if ($("profile-email")) {
        $("profile-email").textContent =
            currentUser.email || "";
    }

    if ($("profile-avatar")) {
        $("profile-avatar").textContent =
            avatarLetter;
    }

    renderBadges();
}


// =========================================================
// BADGES
// =========================================================

function renderBadges() {

    const container = $("profile-badges");

    if (!container || !currentUser) return;

    container.innerHTML = "";

    const badges = currentUser.badges || [];

    badges.forEach(badge => {

        const element =
            document.createElement("span");

        element.className = "badge";

        element.textContent =
            badge.label ||
            badge.name ||
            badge;

        container.appendChild(element);
    });
}


// =========================================================
// PROFILE
// =========================================================

function openProfile() {

    if (!currentUser) return;

    updateUserUI();

    show("profile-modal");
}


// =========================================================
// SETTINGS
// =========================================================

function openSettings() {
    show("settings-modal");
}

function toggleTheme() {

    document.body.classList.toggle("dark");

    // تنظیم ظاهری است و می‌تواند محلی باشد.
    sessionStorage.setItem(
        "goftino_theme",
        document.body.classList.contains("dark")
            ? "dark"
            : "light"
    );
}

function changeFontSize() {

    const sizes = [
        "14px",
        "15px",
        "16px",
        "17px"
    ];

    const current =
        parseInt(
            getComputedStyle(document.body)
                .fontSize
        ) || 16;

    let next = sizes.findIndex(
        size => parseInt(size) > current
    );

    if (next === -1) {
        next = 0;
    }

    document.documentElement.style
        .setProperty(
            "--goftino-font-size",
            sizes[next]
        );
}


// =========================================================
// THEME LOAD
// =========================================================

function loadLocalSettings() {

    const theme =
        sessionStorage.getItem(
            "goftino_theme"
        );

    if (theme === "dark") {
        document.body.classList.add("dark");
    }
}

loadLocalSettings();


// =========================================================
// LOAD CHATS
// =========================================================

async function loadChats() {

    try {

        const response = await api(
            "/chats",
            {
                headers: authHeaders()
            }
        );

        chats = response.chats || [];

        renderChats();

    } catch (error) {

        showToast(
            error.message,
            "error"
        );
    }
}


// =========================================================
// RENDER CHATS
// =========================================================

function renderChats() {

    const list = $("chat-list");

    if (!list) return;

    list.innerHTML = "";

    if (!chats.length) {

        list.innerHTML = `
            <div class="empty-state">
                <div>گفتگویی وجود ندارد</div>
                <small>
                    برای شروع یک گفتگو جستجو کنید.
                </small>
            </div>
        `;

        return;
    }

    chats.forEach(chat => {

        const item =
            document.createElement("button");

        item.className = "chat-item";

        if (
            currentChat &&
            String(currentChat.id) ===
            String(chat.id)
        ) {
            item.classList.add("active");
        }

        const name =
            chat.name ||
            chat.title ||
            "کاربر";

        const letter =
            name.charAt(0);

        item.innerHTML = `
            <div class="chat-item-avatar">
                ${escapeHTML(letter)}
            </div>

            <div class="chat-item-content">

                <div class="chat-item-top">

                    <span class="chat-item-name">
                        ${escapeHTML(name)}
                    </span>

                    <span class="chat-item-time">
                        ${formatTime(chat.updated_at)}
                    </span>

                </div>

                <div class="chat-item-last">
                    ${escapeHTML(
                        chat.last_message || ""
                    )}
                </div>

            </div>
        `;

        item.addEventListener(
            "click",
            () => openChat(chat)
        );

        list.appendChild(item);
    });
}


// =========================================================
// OPEN CHAT
// =========================================================

async function openChat(chat) {

    currentChat = chat;

    renderChats();

    $("chat-user-name").textContent =
        chat.name ||
        chat.title ||
        "گفتگو";

    $("chat-user-status").textContent =
        chat.status ||
        "آنلاین";

    show("message-input-area");

    await loadMessages(chat.id);

    startMessagePolling();
}


// =========================================================
// LOAD MESSAGES
// =========================================================

async function loadMessages(chatId) {

    try {

        const response = await api(
            `/chats/${encodeURIComponent(chatId)}/messages`,
            {
                headers: authHeaders()
            }
        );

        renderMessages(
            response.messages || []
        );

    } catch (error) {

        showToast(
            error.message,
            "error"
        );
    }
}


// =========================================================
// RENDER MESSAGES
// =========================================================

function renderMessages(messages) {

    const container = $("messages");

    if (!container) return;

    container.innerHTML = "";

    if (!messages.length) {

        container.innerHTML = `
            <div class="welcome-message">
                <div class="welcome-logo">گ</div>

                <h2>شروع گفتگو</h2>

                <p>
                    اولین پیام را ارسال کنید.
                </p>
            </div>
        `;

        return;
    }

    messages.forEach(message => {

        const element =
            document.createElement("div");

        const mine =
            String(message.sender_id) ===
            String(currentUser.id);

        element.className =
            `message ${mine ? "mine" : "theirs"}`;

        element.innerHTML = `
            <div>
                ${escapeHTML(
                    message.text || ""
                )}
            </div>

            <div class="message-meta">
                <span>
                    ${formatTime(message.created_at)}
                </span>

                ${
                    mine
                        ? `<span>${
                            message.is_read
                                ? "✓✓"
                                : "✓"
                        }</span>`
                        : ""
                }
            </div>
        `;

        container.appendChild(element);
    });

    container.scrollTop =
        container.scrollHeight;
}


// =========================================================
// SEND MESSAGE
// =========================================================

async function sendMessage() {

    if (!currentChat) {

        showToast(
            "ابتدا یک گفتگو انتخاب کنید.",
            "error"
        );

        return;
    }

    const input = $("message-input");

    const text =
        input.value.trim();

    if (!text) return;

    input.disabled = true;

    try {

        await api(
            `/chats/${encodeURIComponent(
                currentChat.id
            )}/messages`,
            {
                method: "POST",

                headers: authHeaders(),

                body: {
                    text
                }
            }
        );

        input.value = "";

        await loadMessages(
            currentChat.id
        );

        await loadChats();

    } catch (error) {

        showToast(
            error.message,
            "error"
        );

    } finally {

        input.disabled = false;

        input.focus();
    }
}


// =========================================================
// MESSAGE KEY
// =========================================================

function handleMessageKey(event) {

    if (
        event.key === "Enter" &&
        !event.shiftKey
    ) {

        event.preventDefault();

        sendMessage();
    }
}


// =========================================================
// MESSAGE POLLING
// =========================================================

function startMessagePolling() {

    if (messageTimer) {
        clearInterval(messageTimer);
    }

    messageTimer = setInterval(
        async () => {

            if (!currentChat) return;

            try {

                await loadMessages(
                    currentChat.id
                );

            } catch (_) {}

        },
        3000
    );
}


// =========================================================
// SEARCH USERS
// =========================================================

let searchTimer = null;

function searchUsers(query) {

    clearTimeout(searchTimer);

    searchTimer = setTimeout(
        async () => {

            const value =
                query.trim();

            if (!value) {

                await loadChats();

                return;
            }

            try {

                const response =
                    await api(
                        `/users/search?q=${encodeURIComponent(
                            value
                        )}`,
                        {
                            headers:
                                authHeaders()
                        }
                    );

                renderSearchResults(
                    response.users || []
                );

            } catch (error) {

                showToast(
                    error.message,
                    "error"
                );
            }

        },
        350
    );
}


// =========================================================
// SEARCH RESULTS
// =========================================================

function renderSearchResults(users) {

    const list = $("chat-list");

    if (!list) return;

    list.innerHTML = "";

    if (!users.length) {

        list.innerHTML = `
            <div class="empty-state">
                <div>کاربری پیدا نشد</div>
            </div>
        `;

        return;
    }

    users.forEach(user => {

        if (
            currentUser &&
            String(user.id) ===
            String(currentUser.id)
        ) {
            return;
        }

        const item =
            document.createElement("button");

        item.className = "chat-item";

        const name =
            user.name ||
            "کاربر";

        item.innerHTML = `
            <div class="chat-item-avatar">
                ${escapeHTML(
                    name.charAt(0)
                )}
            </div>

            <div class="chat-item-content">

                <div class="chat-item-top">

                    <span class="chat-item-name">
                        ${escapeHTML(name)}
                    </span>

                </div>

                <div class="chat-item-last">
                    شروع گفتگو
                </div>

            </div>
        `;

        item.addEventListener(
            "click",
            () => createPrivateChat(user.id)
        );

        list.appendChild(item);
    });
}


// =========================================================
// CREATE PRIVATE CHAT
// =========================================================

async function createPrivateChat(userId) {

    try {

        const response =
            await api(
                "/chats/private",
                {
                    method: "POST",

                    headers:
                        authHeaders(),

                    body: {
                        user_id: userId
                    }
                }
            );

        const chat =
            response.chat;

        await loadChats();

        if (chat) {
            await openChat(chat);
        }

    } catch (error) {

        showToast(
            error.message,
            "error"
        );
    }
}


// =========================================================
// FILE
// =========================================================

function selectFile() {

    $("file-input").click();
}

async function uploadFile(file) {

    if (!file || !currentChat) return;

    showToast(
        "ارسال فایل در حال آماده‌سازی است..."
    );

    /*
       در نسخه بعدی فایل مستقیماً به
       endpoint مخصوص آپلود ارسال می‌شود.

       فعلاً برای جلوگیری از ارسال اشتباه
       فایل به endpoint پیام، کاری انجام نمی‌دهیم.
    */
}


// =========================================================
// ACCOUNT DELETE
// =========================================================

function requestDeleteAccount() {

    closeModal("settings-modal");

    show("delete-modal");
}


async function deleteAccount() {

    try {

        await api(
            "/auth/delete",
            {
                method: "DELETE",
                headers: authHeaders()
            }
        );

        removeToken();

        currentUser = null;
        currentChat = null;

        closeModal("delete-modal");

        showAuth();

        showToast(
            "حساب کاربری حذف شد.",
            "success"
        );

    } catch (error) {

        showToast(
            error.message,
            "error"
        );
    }
}


// =========================================================
// CHAT TABS
// =========================================================

async function switchChatTab(type) {

    document
        .querySelectorAll(".chat-tab")
        .forEach(button => {
            button.classList.remove("active");
        });

    const button =
        $(`tab-${type}`);

    if (button) {
        button.classList.add("active");
    }

    try {

        const response =
            await api(
                `/chats?type=${encodeURIComponent(
                    type
                )}`,
                {
                    headers:
                        authHeaders()
                }
            );

        chats =
            response.chats || [];

        renderChats();

    } catch (error) {

        showToast(
            error.message,
            "error"
        );
    }
}


// =========================================================
// MOBILE SIDEBAR
// =========================================================

function toggleSidebar() {

    const sidebar =
        document.querySelector(".sidebar");

    if (!sidebar) return;

    sidebar.classList.toggle("open");
}


// =========================================================
// FORMAT TIME
// =========================================================

function formatTime(value) {

    if (!value) return "";

    const date =
        new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "";
    }

    return date.toLocaleTimeString(
        "fa-IR",
        {
            hour: "2-digit",
            minute: "2-digit"
        }
    );
}


// =========================================================
// HTML ESCAPE
// =========================================================

function escapeHTML(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


// =========================================================
// BUTTON LOADING
// =========================================================

function setLoadingButton(
    button,
    loading
) {

    if (!button) return;

    if (loading) {

        button.dataset.oldText =
            button.textContent;

        button.textContent =
            "در حال پردازش...";

        button.disabled = true;

    } else {

        button.textContent =
            button.dataset.oldText ||
            button.textContent;

        button.disabled = false;
    }
}


// =========================================================
// GLOBAL ERROR
// =========================================================

window.addEventListener(
    "unhandledrejection",
    event => {

        console.error(
            "Unhandled promise:",
            event.reason
        );
    }
);
