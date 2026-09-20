"use strict";

/* =========================================================
   GOFTINO
   Complete app.js
   GitHub Pages + PrefsDB
   ========================================================= */


/* =========================================================
   CONFIG
   ========================================================= */

const PREFS_KEY_ID = "goftino-main-v1";

const PREFS_SEED = [
    "goftino",
    "arika",
    "sina",
    "goftino-database-v1"
];

const PREFS_PROJECT = "goftino";

const SESSION_KEY = "goftino_session";
const THEME_KEY = "goftino_theme";
const FONT_KEY = "goftino_font_size";

const POLL_INTERVAL = 3000;

let currentUser = null;
let currentChat = null;

let usersCache = [];
let chatsCache = [];

let currentTab = "private";

let pollTimer = null;
let polling = false;

let dbQueue = Promise.resolve();


/* =========================================================
   BASIC HELPERS
   ========================================================= */

function $(selector) {
    return document.querySelector(selector);
}

function $all(selector) {
    return Array.from(document.querySelectorAll(selector));
}

function escapeHTML(value) {
    if (value === null || value === undefined) {
        return "";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function normalizeEmail(email) {
    return String(email || "")
        .trim()
        .toLowerCase();
}

function normalizeName(name) {
    return String(name || "")
        .trim()
        .replace(/\s+/g, " ");
}

function generateId(prefix = "id") {
    if (
        typeof crypto !== "undefined" &&
        typeof crypto.randomUUID === "function"
    ) {
        return `${prefix}_${crypto.randomUUID()}`;
    }

    return (
        prefix +
        "_" +
        Date.now().toString(36) +
        "_" +
        Math.random()
            .toString(36)
            .slice(2, 12)
    );
}

function timestamp() {
    return Date.now();
}

function formatTime(value) {
    if (!value) return "";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "";
    }

    return date.toLocaleTimeString("fa-IR", {
        hour: "2-digit",
        minute: "2-digit"
    });
}

function formatDate(value) {
    if (!value) return "";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "";
    }

    return date.toLocaleDateString("fa-IR");
}

function getInitial(name) {
    const value = normalizeName(name);

    if (!value) {
        return "گ";
    }

    return value.charAt(0);
}

function isDeletedUser(user) {
    return !!(
        user &&
        user.deleted === true
    );
}


/* =========================================================
   TOAST
   ========================================================= */

let toastTimeout = null;

function showToast(message, type = "info") {
    const toast = $("#toast");

    if (!toast) {
        alert(message);
        return;
    }

    const messageElement =
        $("#toastMessage");

    const iconElement =
        $("#toastIcon");

    if (messageElement) {
        messageElement.textContent = message;
    }

    if (iconElement) {
        if (type === "success") {
            iconElement.textContent = "✓";
        } else if (type === "error") {
            iconElement.textContent = "!";
        } else if (type === "warning") {
            iconElement.textContent = "!";
        } else {
            iconElement.textContent = "i";
        }
    }

    toast.classList.remove(
        "show",
        "success",
        "error",
        "warning",
        "info"
    );

    toast.classList.add(type);

    requestAnimationFrame(() => {
        toast.classList.add("show");
    });

    clearTimeout(toastTimeout);

    toastTimeout = setTimeout(() => {
        toast.classList.remove("show");
    }, 3500);
}


/* =========================================================
   LOADING
   ========================================================= */

function setLoadingText(text) {
    const element = $("#loadingText");

    if (element) {
        element.textContent = text;
    }
}

function showLoading(text = "در حال اتصال به سرور...") {
    setLoadingText(text);

    const screen =
        $("#loadingScreen");

    if (!screen) return;

    screen.style.display = "flex";

    screen.classList.remove("hidden");
}

function hideLoading() {
    const screen =
        $("#loadingScreen");

    if (!screen) return;

    screen.classList.add("hidden");

    setTimeout(() => {
        screen.style.display = "none";
    }, 350);
}


/* =========================================================
   PREFSDB
   ========================================================= */

function prefsAvailable() {
    return (
        typeof window !== "undefined" &&
        typeof window.prefs_us !== "undefined"
    );
}

async function refreshPrefsKey() {
    if (!prefsAvailable()) {
        throw new Error(
            "کتابخانه PrefsDB بارگذاری نشده است."
        );
    }

    return new Promise((resolve, reject) => {
        let done = false;

        const timeout = setTimeout(() => {
            if (done) return;

            done = true;

            reject(
                new Error(
                    "اتصال به PrefsDB زمان‌بر شد."
                )
            );
        }, 15000);

        try {
            prefs_us.getkey(
                PREFS_KEY_ID,
                PREFS_SEED,
                response => {
                    if (done) return;

                    done = true;

                    clearTimeout(timeout);

                    if (!response) {
                        reject(
                            new Error(
                                "پاسخ نامعتبر از PrefsDB."
                            )
                        );

                        return;
                    }

                    if (
                        response.success === false ||
                        response.status === "error"
                    ) {
                        reject(
                            new Error(
                                response.message ||
                                response.error ||
                                "خطای PrefsDB."
                            )
                        );

                        return;
                    }

                    resolve(response);
                }
            );
        } catch (error) {
            if (done) return;

            done = true;

            clearTimeout(timeout);

            reject(error);
        }
    });
}


/* =========================================================
   PREFSDB READ
   ========================================================= */

async function dbRead(key) {
    await refreshPrefsKey();

    return new Promise((resolve, reject) => {
        let done = false;

        const timeout = setTimeout(() => {
            if (done) return;

            done = true;

            reject(
                new Error(
                    "خواندن اطلاعات از PrefsDB زمان‌بر شد."
                )
            );
        }, 20000);

        try {
            prefs_us
                .project(PREFS_PROJECT)
                .key(key)
                .read(response => {
                    if (done) return;

                    done = true;

                    clearTimeout(timeout);

                    if (!response) {
                        resolve(null);
                        return;
                    }

                    if (
                        response.success === false ||
                        response.status === "error"
                    ) {
                        reject(
                            new Error(
                                response.message ||
                                response.error ||
                                "خطا در خواندن اطلاعات."
                            )
                        );

                        return;
                    }

                    let value;

                    if (
                        Object.prototype.hasOwnProperty.call(
                            response,
                            "value"
                        )
                    ) {
                        value = response.value;
                    } else {
                        value = response;
                    }

                    if (
                        typeof value === "string"
                    ) {
                        try {
                            value = JSON.parse(value);
                        } catch (_) {
                            // plain string
                        }
                    }

                    resolve(value);
                });
        } catch (error) {
            if (done) return;

            done = true;

            clearTimeout(timeout);

            reject(error);
        }
    });
}


/* =========================================================
   PREFSDB WRITE
   ========================================================= */

async function dbWrite(key, value) {
    await refreshPrefsKey();

    return new Promise((resolve, reject) => {
        let done = false;

        const timeout = setTimeout(() => {
            if (done) return;

            done = true;

            reject(
                new Error(
                    "ذخیره اطلاعات در PrefsDB زمان‌بر شد."
                )
            );
        }, 20000);

        try {
            prefs_us
                .project(PREFS_PROJECT)
                .key(key)
                .post(
                    value,
                    response => {
                        if (done) return;

                        done = true;

                        clearTimeout(timeout);

                        if (
                            response &&
                            (
                                response.success === false ||
                                response.status === "error"
                            )
                        ) {
                            reject(
                                new Error(
                                    response.message ||
                                    response.error ||
                                    "خطا در ذخیره اطلاعات."
                                )
                            );

                            return;
                        }

                        resolve(response || true);
                    }
                );
        } catch (error) {
            if (done) return;

            done = true;

            clearTimeout(timeout);

            reject(error);
        }
    });
}


/* =========================================================
   DATABASE QUEUE
   ========================================================= */

function queueDB(operation) {
    const result =
        dbQueue.then(operation);

    dbQueue =
        result.catch(() => {});

    return result;
}


/* =========================================================
   USERS
   ========================================================= */

async function getUsers() {
    const users = await dbRead("users");

    if (!Array.isArray(users)) {
        return [];
    }

    return users;
}

async function saveUsers(users) {
    return queueDB(() =>
        dbWrite("users", users)
    );
}


/* =========================================================
   CHATS
   ========================================================= */

async function getChats() {
    const chats = await dbRead("chats");

    if (!Array.isArray(chats)) {
        return [];
    }

    return chats;
}

async function saveChats(chats) {
    return queueDB(() =>
        dbWrite("chats", chats)
    );
}


/* =========================================================
   MESSAGES
   ========================================================= */

function messageKey(chatId) {
    return "messages_" + chatId;
}

async function getMessages(chatId) {
    if (!chatId) {
        return [];
    }

    const messages =
        await dbRead(
            messageKey(chatId)
        );

    if (!Array.isArray(messages)) {
        return [];
    }

    return messages;
}

async function saveMessages(
    chatId,
    messages
) {
    return queueDB(() =>
        dbWrite(
            messageKey(chatId),
            messages
        )
    );
}


/* =========================================================
   PASSWORD HASH
   ========================================================= */

async function hashPassword(password) {
    const value =
        String(password || "");

    if (
        typeof crypto !== "undefined" &&
        crypto.subtle &&
        typeof TextEncoder !== "undefined"
    ) {
        const data =
            new TextEncoder().encode(value);

        const buffer =
            await crypto.subtle.digest(
                "SHA-256",
                data
            );

        return Array.from(
            new Uint8Array(buffer)
        )
            .map(
                byte =>
                    byte
                        .toString(16)
                        .padStart(2, "0")
            )
            .join("");
    }

    let hash = 0;

    for (
        let i = 0;
        i < value.length;
        i++
    ) {
        hash =
            (
                (hash << 5) -
                hash +
                value.charCodeAt(i)
            ) |
            0;
    }

    return String(hash);
}


/* =========================================================
   SESSION
   ========================================================= */

function saveSession(userId) {
    sessionStorage.setItem(
        SESSION_KEY,
        userId
    );
}

function getSession() {
    return sessionStorage.getItem(
        SESSION_KEY
    );
}

function clearSession() {
    sessionStorage.removeItem(
        SESSION_KEY
    );
}


/* =========================================================
   FIND USERS
   ========================================================= */

function findUserById(id) {
    return (
        usersCache.find(
            user => user.id === id
        ) || null
    );
}

function findUserByEmail(email) {
    const normalized =
        normalizeEmail(email);

    return (
        usersCache.find(
            user =>
                normalizeEmail(
                    user.email
                ) === normalized
        ) || null
    );
}


/* =========================================================
   PAGE SWITCHING
   ========================================================= */

function showAuthPage() {
    const auth =
        $("#authPage");

    const app =
        $("#appPage");

    if (auth) {
        auth.classList.remove("hidden");
    }

    if (app) {
        app.classList.add("hidden");
    }
}

function showAppPage() {
    const auth =
        $("#authPage");

    const app =
        $("#appPage");

    if (auth) {
        auth.classList.add("hidden");
    }

    if (app) {
        app.classList.remove("hidden");
    }

    updateProfileUI();
}


/* =========================================================
   PROFILE UI
   ========================================================= */

function updateProfileUI() {
    if (!currentUser) return;

    const name =
        currentUser.name || "کاربر";

    const avatar =
        getInitial(name);

    const sidebarName =
        $("#sidebarUserName");

    const sidebarAvatar =
        $("#sidebarAvatar");

    const profileName =
        $("#profileName");

    const profileEmail =
        $("#profileEmail");

    const profileAvatar =
        $("#profileAvatar");

    const profileId =
        $("#profileId");

    const profileStatus =
        $("#profileStatus");

    if (sidebarName) {
        sidebarName.textContent = name;
    }

    if (sidebarAvatar) {
        sidebarAvatar.textContent = avatar;
    }

    if (profileName) {
        profileName.textContent = name;
    }

    if (profileEmail) {
        profileEmail.textContent =
            currentUser.email;
    }

    if (profileAvatar) {
        profileAvatar.textContent =
            avatar;
    }

    if (profileId) {
        profileId.textContent =
            currentUser.id;
    }

    if (profileStatus) {
        profileStatus.textContent =
            "فعال";
    }
}


/* =========================================================
   REGISTER
   ========================================================= */

async function registerUser() {
    const nameInput =
        $("#registerName");

    const emailInput =
        $("#registerEmail");

    const passwordInput =
        $("#registerPassword");

    const password2Input =
        $("#registerPassword2");

    if (
        !nameInput ||
        !emailInput ||
        !passwordInput ||
        !password2Input
    ) {
        showToast(
            "فرم ثبت‌نام پیدا نشد.",
            "error"
        );

        return;
    }

    const name =
        normalizeName(
            nameInput.value
        );

    const email =
        normalizeEmail(
            emailInput.value
        );

    const password =
        String(
            passwordInput.value || ""
        );

    const password2 =
        String(
            password2Input.value || ""
        );

    if (name.length < 2) {
        showToast(
            "نام باید حداقل ۲ کاراکتر باشد.",
            "warning"
        );

        return;
    }

    if (
        !email ||
        !email.includes("@") ||
        !email.includes(".")
    ) {
        showToast(
            "ایمیل معتبر وارد کنید.",
            "warning"
        );

        return;
    }

    if (password.length < 8) {
        showToast(
            "رمز عبور باید حداقل ۸ کاراکتر باشد.",
            "warning"
        );

        return;
    }

    if (password !== password2) {
        showToast(
            "تکرار رمز عبور صحیح نیست.",
            "warning"
        );

        return;
    }

    try {
        showLoading(
            "در حال ساخت حساب..."
        );

        usersCache =
            await getUsers();

        const existing =
            findUserByEmail(email);

        if (existing) {
            if (!existing.deleted) {
                hideLoading();

                showToast(
                    "این ایمیل قبلاً ثبت شده است.",
                    "error"
                );

                return;
            }

            const deletedAt =
                Number(
                    existing.deletedAt || 0
                );

            const threeDays =
                3 *
                24 *
                60 *
                60 *
                1000;

            if (
                deletedAt &&
                timestamp() - deletedAt <
                threeDays
            ) {
                hideLoading();

                showToast(
                    "تا ۳ روز پس از حذف حساب نمی‌توانید با این ایمیل ثبت‌نام کنید.",
                    "error"
                );

                return;
            }

            usersCache =
                usersCache.filter(
                    user =>
                        user.id !==
                        existing.id
                );
        }

        const passwordHash =
            await hashPassword(
                password
            );

        const user = {
            id: generateId("user"),
            name,
            email,
            passwordHash,
            createdAt: timestamp(),
            deleted: false,
            deletedAt: null,
            avatar: null
        };

        usersCache.push(user);

        await saveUsers(
            usersCache
        );

        currentUser = user;

        saveSession(
            currentUser.id
        );

        hideLoading();

        showAppPage();

        clearRegisterForm();

        await loadChats();

        showToast(
            "حساب با موفقیت ساخته شد.",
            "success"
        );

    } catch (error) {
        console.error(error);

        hideLoading();

        showToast(
            "ثبت‌نام انجام نشد: " +
            (error.message || ""),
            "error"
        );
    }
}


/* =========================================================
   LOGIN
   ========================================================= */

async function loginUser() {
    const emailInput =
        $("#loginEmail");

    const passwordInput =
        $("#loginPassword");

    if (
        !emailInput ||
        !passwordInput
    ) {
        showToast(
            "فرم ورود پیدا نشد.",
            "error"
        );

        return;
    }

    const email =
        normalizeEmail(
            emailInput.value
        );

    const password =
        String(
            passwordInput.value || ""
        );

    if (!email || !password) {
        showToast(
            "ایمیل و رمز عبور را وارد کنید.",
            "warning"
        );

        return;
    }

    try {
        showLoading(
            "در حال ورود..."
        );

        usersCache =
            await getUsers();

        const user =
            findUserByEmail(email);

        if (!user) {
            hideLoading();

            showToast(
                "ایمیل یا رمز عبور اشتباه است.",
                "error"
            );

            return;
        }

        if (user.deleted) {
            hideLoading();

            showToast(
                "این حساب حذف شده است.",
                "error"
            );

            return;
        }

        const hash =
            await hashPassword(
                password
            );

        if (
            hash !==
            user.passwordHash
        ) {
            hideLoading();

            showToast(
                "ایمیل یا رمز عبور اشتباه است.",
                "error"
            );

            return;
        }

        currentUser = user;

        saveSession(
            currentUser.id
        );

        hideLoading();

        showAppPage();

        clearLoginForm();

        await loadChats();

        showToast(
            "خوش آمدید " +
            currentUser.name,
            "success"
        );

    } catch (error) {
        console.error(error);

        hideLoading();

        showToast(
            "ورود انجام نشد: " +
            (error.message || ""),
            "error"
        );
    }
}


/* =========================================================
   LOGOUT
   ========================================================= */

function logoutUser() {
    stopPolling();

    currentUser = null;
    currentChat = null;

    clearSession();

    showAuthPage();

    showToast(
        "از حساب خارج شدید.",
        "success"
    );
}


/* =========================================================
   CLEAR FORMS
   ========================================================= */

function clearLoginForm() {
    const email =
        $("#loginEmail");

    const password =
        $("#loginPassword");

    if (email) {
        email.value = "";
    }

    if (password) {
        password.value = "";
    }
}

function clearRegisterForm() {
    const name =
        $("#registerName");

    const email =
        $("#registerEmail");

    const password =
        $("#registerPassword");

    const password2 =
        $("#registerPassword2");

    if (name) name.value = "";
    if (email) email.value = "";
    if (password) password.value = "";
    if (password2) password2.value = "";
}


/* =========================================================
   PRIVATE CHAT ID
   ========================================================= */

function createPrivateChatId(
    userA,
    userB
) {
    const ids = [
        String(userA),
        String(userB)
    ].sort();

    return (
        "private_" +
        ids[0] +
        "_" +
        ids[1]
    );
}


/* =========================================================
   GET OTHER CHAT MEMBER
   ========================================================= */

function getOtherMember(chat) {
    if (
        !chat ||
        !currentUser ||
        !Array.isArray(chat.members)
    ) {
        return null;
    }

    const otherId =
        chat.members.find(
            id =>
                id !==
                currentUser.id
        );

    return findUserById(
        otherId
    );
}


/* =========================================================
   CREATE PRIVATE CHAT
   ========================================================= */

async function createPrivateChat(
    otherUser
) {
    if (!currentUser) {
        return null;
    }

    if (!otherUser) {
        showToast(
            "کاربر پیدا نشد.",
            "error"
        );

        return null;
    }

    if (otherUser.deleted) {
        showToast(
            "این حساب حذف شده است.",
            "error"
        );

        return null;
    }

    if (
        otherUser.id ===
        currentUser.id
    ) {
        showToast(
            "نمی‌توانید با خودتان گفتگو کنید.",
            "warning"
        );

        return null;
    }

    chatsCache =
        await getChats();

    const chatId =
        createPrivateChatId(
            currentUser.id,
            otherUser.id
        );

    let chat =
        chatsCache.find(
            item =>
                item.id ===
                chatId
        );

    if (!chat) {
        chat = {
            id: chatId,
            type: "private",
            members: [
                currentUser.id,
                otherUser.id
            ],
            createdAt: timestamp(),
            updatedAt: timestamp(),
            lastMessage: "",
            lastMessageAt: null,
            locked: false
        };

        chatsCache.push(chat);

        await saveChats(
            chatsCache
        );
    }

    currentChat = chat;

    await loadChats();

    await openChat(
        chat.id
    );

    return chat;
}


/* =========================================================
   LOAD CHATS
   ========================================================= */

async function loadChats() {
    if (!currentUser) {
        return;
    }

    try {
        chatsCache =
            await getChats();

        const myChats =
            chatsCache
                .filter(chat => {
                    if (!chat) {
                        return false;
                    }

                    if (
                        chat.type !==
                        "private"
                    ) {
                        return false;
                    }

                    return (
                        Array.isArray(
                            chat.members
                        ) &&
                        chat.members.includes(
                            currentUser.id
                        )
                    );
                })
                .sort(
                    (a, b) =>
                        Number(
                            b.updatedAt || 0
                        ) -
                        Number(
                            a.updatedAt || 0
                        )
                );

        renderChatList(
            myChats
        );

    } catch (error) {
        console.error(error);

        showToast(
            "خطا در دریافت گفتگوها.",
            "error"
        );
    }
}


/* =========================================================
   RENDER CHAT LIST
   ========================================================= */

function renderChatList(chats) {
    const list =
        $("#chatList");

    if (!list) {
        return;
    }

    if (
        currentTab !==
        "private"
    ) {
        list.innerHTML = `
            <div class="empty-chat-list">
                <div class="empty-icon">+</div>
                <p>این بخش به‌زودی فعال می‌شود</p>
                <small>
                    گروه‌ها و کانال‌ها در نسخه بعدی گفتینو اضافه خواهند شد.
                </small>
            </div>
        `;

        return;
    }

    if (!chats.length) {
        list.innerHTML = `
            <div class="empty-chat-list">
                <div class="empty-icon">💬</div>
                <p>هنوز گفتگویی ندارید</p>
                <small>
                    برای شروع یک کاربر را جستجو کنید.
                </small>
            </div>
        `;

        return;
    }

    list.innerHTML =
        chats
            .map(chat => {
                const user =
                    getOtherMember(
                        chat
                    );

                if (!user) {
                    return "";
                }

                const deleted =
                    isDeletedUser(
                        user
                    );

                const active =
                    currentChat &&
                    currentChat.id ===
                    chat.id;

                const title =
                    deleted
                        ? "حساب حذف‌شده"
                        : user.name;

                let preview =
                    chat.lastMessage ||
                    "شروع گفتگو";

                if (
                    deleted ||
                    chat.locked
                ) {
                    preview =
                        "گفتگو قفل شده";
                }

                return `
                    <div
                        class="chat-item ${
                            active
                                ? "active"
                                : ""
                        }"
                        data-chat-id="${escapeHTML(
                            chat.id
                        )}"
                    >

                        <div class="avatar">
                            ${
                                deleted
                                    ? "👻"
                                    : escapeHTML(
                                          getInitial(
                                              user.name
                                          )
                                      )
                            }
                        </div>

                        <div class="chat-item-info">

                            <div class="chat-item-top">

                                <span class="chat-name">
                                    ${escapeHTML(
                                        title
                                    )}
                                </span>

                                <span class="chat-time">
                                    ${
                                        chat.lastMessageAt
                                            ? formatTime(
                                                  chat.lastMessageAt
                                              )
                                            : ""
                                    }
                                </span>

                            </div>

                            <div class="chat-preview">
                                ${escapeHTML(
                                    preview
                                )}
                            </div>

                        </div>

                    </div>
                `;
            })
            .join("");

    $all(
        "#chatList .chat-item"
    ).forEach(item => {
        item.addEventListener(
            "click",
            async () => {
                await openChat(
                    item.dataset.chatId
                );
            }
        );
    });
}


/* =========================================================
   OPEN CHAT
   ========================================================= */

async function openChat(
    chatOrId
) {
    let chat = null;

    if (
        typeof chatOrId ===
        "string"
    ) {
        chat =
            chatsCache.find(
                item =>
                    item.id ===
                    chatOrId
            ) || null;
    } else {
        chat = chatOrId;
    }

    if (!chat) {
        chatsCache =
            await getChats();

        chat =
            chatsCache.find(
                item =>
                    item.id ===
                    chatOrId
            ) || null;
    }

    if (!chat) {
        showToast(
            "گفتگو پیدا نشد.",
            "error"
        );

        return;
    }

    currentChat = chat;

    renderChatHeader(
        chat
    );

    showChatInterface();

    await loadMessages(
        chat.id
    );

    startPolling();

    await loadChats();
}


/* =========================================================
   CHAT HEADER
   ========================================================= */

function renderChatHeader(
    chat
) {
    const user =
        getOtherMember(
            chat
        );

    const empty =
        $("#chatHeaderEmpty");

    const headerUser =
        $("#chatHeaderUser");

    const actions =
        $("#chatHeaderActions");

    const avatar =
        $("#chatHeaderAvatar");

    const name =
        $("#chatHeaderName");

    const status =
        $("#chatHeaderStatus");

    if (!user) {
        return;
    }

    if (empty) {
        empty.classList.add(
            "hidden"
        );
    }

    if (headerUser) {
        headerUser.classList.remove(
            "hidden"
        );
    }

    if (actions) {
        actions.classList.remove(
            "hidden"
        );
    }

    const deleted =
        isDeletedUser(
            user
        );

    if (avatar) {
        avatar.textContent =
            deleted
                ? "👻"
                : getInitial(
                      user.name
                  );
    }

    if (name) {
        name.textContent =
            deleted
                ? "حساب حذف‌شده"
                : user.name;
    }

    if (status) {
        if (deleted) {
            status.textContent =
                "این حساب حذف شده است";
        } else if (
            chat.locked
        ) {
            status.textContent =
                "گفتگو قفل شده";
        } else {
            status.textContent =
                "در دسترس";
        }
    }
}


/* =========================================================
   SHOW CHAT INTERFACE
   ========================================================= */

function showChatInterface() {
    const welcome =
        $("#welcomeChat");

    const messages =
        $("#messagesContainer");

    const messageArea =
        $("#messageArea");

    if (welcome) {
        welcome.classList.add(
            "hidden"
        );
    }

    if (messages) {
        messages.classList.remove(
            "hidden"
        );
    }

    if (messageArea) {
        messageArea.classList.remove(
            "hidden"
        );
    }
}


/* =========================================================
   HIDE CHAT INTERFACE
   ========================================================= */

function hideChatInterface() {
    const welcome =
        $("#welcomeChat");

    const messages =
        $("#messagesContainer");

    const messageArea =
        $("#messageArea");

    const headerUser =
        $("#chatHeaderUser");

    const actions =
        $("#chatHeaderActions");

    const headerEmpty =
        $("#chatHeaderEmpty");

    if (welcome) {
        welcome.classList.remove(
            "hidden"
        );
    }

    if (messages) {
        messages.classList.add(
            "hidden"
        );
    }

    if (messageArea) {
        messageArea.classList.add(
            "hidden"
        );
    }

    if (headerUser) {
        headerUser.classList.add(
            "hidden"
        );
    }

    if (actions) {
        actions.classList.add(
            "hidden"
        );
    }

    if (headerEmpty) {
        headerEmpty.classList.remove(
            "hidden"
        );
    }
}


/* =========================================================
   LOAD MESSAGES
   ========================================================= */

async function loadMessages(
    chatId
) {
    const container =
        $("#messagesContainer");

    if (!container) {
        return;
    }

    try {
        const messages =
            await getMessages(
                chatId
            );

        renderMessages(
            messages
        );

    } catch (error) {
        console.error(error);

        container.innerHTML = `
            <div class="empty-chat-list">
                خطا در دریافت پیام‌ها.
            </div>
        `;
    }
}


/* =========================================================
   RENDER MESSAGES
   ========================================================= */

function renderMessages(
    messages
) {
    const container =
        $("#messagesContainer");

    if (!container) {
        return;
    }

    if (!messages.length) {
        container.innerHTML = `
            <div class="empty-chat-list">
                <div class="empty-icon">💬</div>
                <p>هنوز پیامی وجود ندارد</p>
                <small>
                    اولین پیام را ارسال کنید.
                </small>
            </div>
        `;

        return;
    }

    container.innerHTML =
        messages
            .map(message => {
                const mine =
                    currentUser &&
                    message.senderId ===
                    currentUser.id;

                return `
                    <div
                        class="message-row ${
                            mine
                                ? "message-me"
                                : "message-other"
                        }"
                    >

                        <div class="message-bubble">

                            <div class="message-text">
                                ${escapeHTML(
                                    message.text
                                ).replace(
                                    /\n/g,
                                    "<br>"
                                )}
                            </div>

                            <div class="message-time">
                                ${formatTime(
                                    message.createdAt
                                )}
                            </div>

                        </div>

                    </div>
                `;
            })
            .join("");

    requestAnimationFrame(() => {
        container.scrollTop =
            container.scrollHeight;
    });
}


/* =========================================================
   SEND MESSAGE
   ========================================================= */

async function sendMessage() {
    if (!currentUser) {
        return;
    }

    if (!currentChat) {
        showToast(
            "ابتدا یک گفتگو انتخاب کنید.",
            "warning"
        );

        return;
    }

    const input =
        $("#messageInput");

    if (!input) {
        return;
    }

    const text =
        String(
            input.value || ""
        ).trim();

    if (!text) {
        return;
    }

    const otherUser =
        getOtherMember(
            currentChat
        );

    if (!otherUser) {
        showToast(
            "کاربر گفتگو پیدا نشد.",
            "error"
        );

        return;
    }

    if (
        otherUser.deleted ||
        currentChat.locked
    ) {
        showToast(
            "این گفتگو قفل شده و امکان ارسال پیام وجود ندارد.",
            "warning"
        );

        return;
    }

    try {
        const messages =
            await getMessages(
                currentChat.id
            );

        const message = {
            id: generateId("msg"),
            chatId:
                currentChat.id,
            senderId:
                currentUser.id,
            receiverId:
                otherUser.id,
            text,
            createdAt:
                timestamp()
        };

        messages.push(
            message
        );

        await saveMessages(
            currentChat.id,
            messages
        );

        chatsCache =
            await getChats();

        const chatIndex =
            chatsCache.findIndex(
                chat =>
                    chat.id ===
                    currentChat.id
            );

        if (
            chatIndex !== -1
        ) {
            chatsCache[
                chatIndex
            ].lastMessage =
                text;

            chatsCache[
                chatIndex
            ].lastMessageAt =
                message.createdAt;

            chatsCache[
                chatIndex
            ].updatedAt =
                message.createdAt;

            await saveChats(
                chatsCache
            );

            currentChat =
                chatsCache[
                    chatIndex
                ];
        }

        input.value = "";

        autoResizeTextarea();

        renderMessages(
            messages
        );

        await loadChats();

    } catch (error) {
        console.error(error);

        showToast(
            "پیام ارسال نشد: " +
            (error.message || ""),
            "error"
        );
    }
}


/* =========================================================
   SEARCH USERS
   ========================================================= */

let searchTimeout = null;

async function searchUsers(
    query
) {
    const overlay =
        $("#searchOverlay");

    const results =
        $("#searchResults");

    if (!overlay || !results) {
        return;
    }

    const value =
        String(query || "")
            .trim()
            .toLowerCase();

    if (!value) {
        results.innerHTML = `
            <div class="search-empty">
                نام یا ایمیل کاربر را جستجو کنید.
            </div>
        `;

        return;
    }

    try {
        usersCache =
            await getUsers();

        const matches =
            usersCache.filter(
                user => {
                    if (
                        !user ||
                        user.deleted
                    ) {
                        return false;
                    }

                    if (
                        currentUser &&
                        user.id ===
                        currentUser.id
                    ) {
                        return false;
                    }

                    const name =
                        String(
                            user.name || ""
                        ).toLowerCase();

                    const email =
                        String(
                            user.email || ""
                        ).toLowerCase();

                    return (
                        name.includes(value) ||
                        email.includes(value)
                    );
                }
            )
            .slice(0, 30);

        if (!matches.length) {
            results.innerHTML = `
                <div class="search-empty">
                    کاربری پیدا نشد.
                </div>
            `;

            return;
        }

        results.innerHTML =
            matches
                .map(user => `
                    <div
                        class="search-user"
                        data-user-id="${escapeHTML(
                            user.id
                        )}"
                    >

                        <div class="avatar">
                            ${escapeHTML(
                                getInitial(
                                    user.name
                                )
                            )}
                        </div>

                        <div class="search-user-info">

                            <strong>
                                ${escapeHTML(
                                    user.name
                                )}
                            </strong>

                            <span>
                                ${escapeHTML(
                                    user.email
                                )}
                            </span>

                        </div>

                        <button
                            type="button"
                            class="search-user-btn"
                        >
                            گفتگو
                        </button>

                    </div>
                `)
                .join("");

        $all(
            ".search-user"
        ).forEach(item => {
            item.addEventListener(
                "click",
                async () => {
                    const id =
                        item.dataset.userId;

                    const user =
                        findUserById(
                            id
                        );

                    if (!user) {
                        return;
                    }

                    closeSearch();

                    await createPrivateChat(
                        user
                    );
                }
            );
        });

    } catch (error) {
        console.error(error);

        results.innerHTML = `
            <div class="search-empty">
                خطا در جستجو.
            </div>
        `;
    }
}


/* =========================================================
   SEARCH OPEN/CLOSE
   ========================================================= */

function openSearch() {
    const overlay =
        $("#searchOverlay");

    if (!overlay) {
        return;
    }

    overlay.classList.remove(
        "hidden"
    );

    const input =
        $("#userSearch");

    if (input) {
        input.focus();
    }
}

function closeSearch() {
    const overlay =
        $("#searchOverlay");

    if (overlay) {
        overlay.classList.add(
            "hidden"
        );
    }
}


/* =========================================================
   DELETE ACCOUNT
   ========================================================= */

async function deleteAccount() {
    if (!currentUser) {
        return;
    }

    try {
        showLoading(
            "در حال حذف حساب..."
        );

        usersCache =
            await getUsers();

        const index =
            usersCache.findIndex(
                user =>
                    user.id ===
                    currentUser.id
            );

        if (index === -1) {
            hideLoading();

            showToast(
                "حساب پیدا نشد.",
                "error"
            );

            return;
        }

        usersCache[
            index
        ].deleted = true;

        usersCache[
            index
        ].deletedAt =
            timestamp();

        usersCache[
            index
        ].name =
            "حساب حذف‌شده";

        usersCache[
            index
        ].avatar =
            "ghost";

        await saveUsers(
            usersCache
        );


        /* Lock all private chats */
        chatsCache =
            await getChats();

        let changed = false;

        chatsCache =
            chatsCache.map(
                chat => {
                    if (
                        chat.type ===
                            "private" &&
                        Array.isArray(
                            chat.members
                        ) &&
                        chat.members.includes(
                            currentUser.id
                        )
                    ) {
                        changed = true;

                        return {
                            ...chat,
                            locked: true,
                            updatedAt:
                                timestamp()
                        };
                    }

                    return chat;
                }
            );

        if (changed) {
            await saveChats(
                chatsCache
            );
        }

        stopPolling();

        currentUser = null;
        currentChat = null;

        clearSession();

        closeModal(
            "deleteAccountModal"
        );

        closeModal(
            "settingsModal"
        );

        hideLoading();

        showAuthPage();

        showToast(
            "حساب شما حذف شد.",
            "success"
        );

    } catch (error) {
        console.error(error);

        hideLoading();

        showToast(
            "حذف حساب انجام نشد: " +
            (error.message || ""),
            "error"
        );
    }
}


/* =========================================================
   MODALS
   ========================================================= */

function openModal(id) {
    const modal =
        document.getElementById(id);

    if (!modal) {
        return;
    }

    modal.classList.remove(
        "hidden"
    );
}

function closeModal(id) {
    const modal =
        document.getElementById(id);

    if (!modal) {
        return;
    }

    modal.classList.add(
        "hidden"
    );
}

function closeAllModals() {
    $all(".modal").forEach(
        modal => {
            modal.classList.add(
                "hidden"
            );
        }
    );
}


/* =========================================================
   PROFILE MODAL
   ========================================================= */

function openProfileModal() {
    if (!currentUser) {
        return;
    }

    updateProfileUI();

    openModal(
        "profileModal"
    );
}


/* =========================================================
   SETTINGS
   ========================================================= */

function openSettings() {
    applyStoredSettings();

    openModal(
        "settingsModal"
    );
}


/* =========================================================
   CHAT INFO
   ========================================================= */

function openChatInfo() {
    if (!currentChat) {
        return;
    }

    const user =
        getOtherMember(
            currentChat
        );

    if (!user) {
        return;
    }

    const avatar =
        $("#chatInfoAvatar");

    const name =
        $("#chatInfoName");

    const status =
        $("#chatInfoStatus");

    const id =
        $("#chatInfoId");

    if (avatar) {
        avatar.textContent =
            user.deleted
                ? "👻"
                : getInitial(
                      user.name
                  );
    }

    if (name) {
        name.textContent =
            user.deleted
                ? "حساب حذف‌شده"
                : user.name;
    }

    if (status) {
        status.textContent =
            user.deleted
                ? "حساب حذف شده"
                : currentChat.locked
                    ? "گفتگو قفل شده"
                    : "در دسترس";
    }

    if (id) {
        id.textContent =
            currentChat.id;
    }

    openModal(
        "chatInfoModal"
    );
}


/* =========================================================
   THEME
   ========================================================= */

function applyTheme(
    theme
) {
    const body =
        document.body;

    if (!body) return;

    if (theme === "dark") {
        body.classList.add(
            "dark-mode"
        );

        body.classList.remove(
            "light-mode"
        );

        return;
    }

    if (theme === "light") {
        body.classList.add(
            "light-mode"
        );

        body.classList.remove(
            "dark-mode"
        );

        return;
    }

    if (theme === "system") {
        const dark =
            window.matchMedia &&
            window.matchMedia(
                "(prefers-color-scheme: dark)"
            ).matches;

        body.classList.toggle(
            "dark-mode",
            dark
        );

        body.classList.toggle(
            "light-mode",
            !dark
        );
    }
}

function applyFontSize(
    size
) {
    const body =
        document.body;

    if (!body) return;

    body.classList.remove(
        "font-small",
        "font-medium",
        "font-large"
    );

    body.classList.add(
        `font-${size || "medium"}`
    );
}

function applyStoredSettings() {
    const theme =
        localStorage.getItem(
            THEME_KEY
        ) || "system";

    const font =
        localStorage.getItem(
            FONT_KEY
        ) || "medium";

    applyTheme(
        theme
    );

    applyFontSize(
        font
    );

    const themeSelect =
        $("#themeSelect");

    const fontSelect =
        $("#fontSizeSelect");

    if (themeSelect) {
        themeSelect.value =
            theme;
    }

    if (fontSelect) {
        fontSelect.value =
            font;
    }
}


/* =========================================================
   TABS
   ========================================================= */

function switchTab(type) {
    currentTab =
        type || "private";

    $all(
        ".chat-tab"
    ).forEach(button => {
        button.classList.toggle(
            "active",
            button.dataset.type ===
                currentTab
        );
    });

    if (
        currentTab !==
        "private"
    ) {
        renderChatList([]);

        showToast(
            "گروه‌ها و کانال‌ها در نسخه بعدی فعال می‌شوند.",
            "info"
        );

        return;
    }

    loadChats();
}


/* =========================================================
   MOBILE SIDEBAR
   ========================================================= */

function openSidebar() {
    const sidebar =
        $("#sidebar");

    if (!sidebar) return;

    sidebar.classList.add(
        "mobile-open"
    );
}

function closeSidebar() {
    const sidebar =
        $("#sidebar");

    if (!sidebar) return;

    sidebar.classList.remove(
        "mobile-open"
    );
}


/* =========================================================
   TEXTAREA
   ========================================================= */

function autoResizeTextarea() {
    const input =
        $("#messageInput");

    if (!input) return;

    input.style.height = "auto";

    input.style.height =
        Math.min(
            input.scrollHeight,
            150
        ) + "px";
}


/* =========================================================
   FILE
   ========================================================= */

function chooseFile() {
    const input =
        $("#fileInput");

    if (!input) return;

    input.click();
}

function handleFileSelect(event) {
    const files =
        event.target.files;

    if (
        !files ||
        !files.length
    ) {
        return;
    }

    showToast(
        "ارسال فایل در این نسخه فعال نشده است.",
        "info"
    );

    event.target.value = "";
}


/* =========================================================
   POLLING
   ========================================================= */

function startPolling() {
    stopPolling();

    if (!currentChat) {
        return;
    }

    pollTimer =
        setInterval(
            async () => {
                await pollCurrentChat();
            },
            POLL_INTERVAL
        );
}

function stopPolling() {
    if (pollTimer) {
        clearInterval(
            pollTimer
        );

        pollTimer = null;
    }
}

async function pollCurrentChat() {
    if (
        polling ||
        !currentUser ||
        !currentChat
    ) {
        return;
    }

    polling = true;

    try {
        const latestChats =
            await getChats();

        chatsCache =
            latestChats;

        const updatedChat =
            chatsCache.find(
                chat =>
                    chat.id ===
                    currentChat.id
            );

        if (updatedChat) {
            currentChat =
                updatedChat;

            renderChatHeader(
                updatedChat
            );
        }

        const messages =
            await getMessages(
                currentChat.id
            );

        renderMessages(
            messages
        );

        await loadChats();

    } catch (error) {
        console.warn(
            "Polling error:",
            error
        );
    } finally {
        polling = false;
    }
}


/* =========================================================
   RESTORE SESSION
   ========================================================= */

async function restoreSession() {
    const userId =
        getSession();

    if (!userId) {
        return false;
    }

    usersCache =
        await getUsers();

    const user =
        findUserById(
            userId
        );

    if (!user) {
        clearSession();
        return false;
    }

    if (user.deleted) {
        clearSession();
        return false;
    }

    currentUser =
        user;

    showAppPage();

    await loadChats();

    return true;
}


/* =========================================================
   DATABASE INITIALIZATION
   ========================================================= */

async function initializeApp() {
    try {
        showLoading(
            "در حال اتصال به PrefsDB..."
        );

        if (!prefsAvailable()) {
            throw new Error(
                "PrefsDB بارگذاری نشده است. فایل index.html را بررسی کنید."
            );
        }

        await refreshPrefsKey();

        usersCache =
            await getUsers();

        chatsCache =
            await getChats();

        const restored =
            await restoreSession();

        if (!restored) {
            showAuthPage();
        }

        applyStoredSettings();

        hideLoading();

    } catch (error) {
        console.error(
            "Initialization error:",
            error
        );

        setLoadingText(
            "اتصال به دیتابیس انجام نشد."
        );

        setTimeout(() => {
            hideLoading();

            showAuthPage();

            showToast(
                "خطا در اتصال به PrefsDB: " +
                (error.message || ""),
                "error"
            );
        }, 800);
    }
}


/* =========================================================
   EVENT LISTENERS
   ========================================================= */

function setupEvents() {

    /* -------------------------
       Login
    ------------------------- */

    const loginForm =
        $("#loginForm");

    if (loginForm) {
        loginForm.addEventListener(
            "submit",
            async event => {
                event.preventDefault();

                await loginUser();
            }
        );
    }


    /* -------------------------
       Register
    ------------------------- */

    const registerForm =
        $("#registerForm");

    if (registerForm) {
        registerForm.addEventListener(
            "submit",
            async event => {
                event.preventDefault();

                await registerUser();
            }
        );
    }


    /* -------------------------
       Login/Register switch
    ------------------------- */

    const showRegister =
        $("#showRegister");

    if (showRegister) {
        showRegister.addEventListener(
            "click",
            () => {
                $("#loginBox")
                    ?.classList.add(
                        "hidden"
                    );

                $("#registerBox")
                    ?.classList.remove(
                        "hidden"
                    );
            }
        );
    }


    const showLogin =
        $("#showLogin");

    if (showLogin) {
        showLogin.addEventListener(
            "click",
            () => {
                $("#registerBox")
                    ?.classList.add(
                        "hidden"
                    );

                $("#loginBox")
                    ?.classList.remove(
                        "hidden"
                    );
            }
        );
    }


    /* -------------------------
       Profile
    ------------------------- */

    const profileButton =
        $("#profileButton");

    if (profileButton) {
        profileButton.addEventListener(
            "click",
            openProfileModal
        );
    }


    /* -------------------------
       Settings
    ------------------------- */

    const settingsButton =
        $("#settingsButton");

    if (settingsButton) {
        settingsButton.addEventListener(
            "click",
            openSettings
        );
    }


    /* -------------------------
       Logout
    ------------------------- */

    const logoutButton =
        $("#logoutButton");

    if (logoutButton) {
        logoutButton.addEventListener(
            "click",
            logoutUser
        );
    }


    /* -------------------------
       Delete account
    ------------------------- */

    const deleteAccountButton =
        $("#deleteAccountButton");

    if (deleteAccountButton) {
        deleteAccountButton.addEventListener(
            "click",
            () => {
                openModal(
                    "deleteAccountModal"
                );
            }
        );
    }


    const confirmDelete =
        $("#confirmDeleteAccount");

    if (confirmDelete) {
        confirmDelete.addEventListener(
            "click",
            async () => {
                await deleteAccount();
            }
        );
    }


    /* -------------------------
       Chat info
    ------------------------- */

    const chatInfoButton =
        $("#chatInfoButton");

    if (chatInfoButton) {
        chatInfoButton.addEventListener(
            "click",
            openChatInfo
        );
    }


    /* -------------------------
       Send message
    ------------------------- */

    const sendButton =
        $("#sendMessageButton");

    if (sendButton) {
        sendButton.addEventListener(
            "click",
            async () => {
                await sendMessage();
            }
        );
    }


    /* -------------------------
       Message enter
    ------------------------- */

    const messageInput =
        $("#messageInput");

    if (messageInput) {

        messageInput.addEventListener(
            "input",
            autoResizeTextarea
        );

        messageInput.addEventListener(
            "keydown",
            async event => {

                if (
                    event.key ===
                    "Enter" &&
                    !event.shiftKey
                ) {
                    event.preventDefault();

                    await sendMessage();
                }

            }
        );
    }


    /* -------------------------
       Search
    ------------------------- */

    const userSearch =
        $("#userSearch");

    if (userSearch) {

        userSearch.addEventListener(
            "focus",
            openSearch
        );

        userSearch.addEventListener(
            "input",
            event => {

                clearTimeout(
                    searchTimeout
                );

                const value =
                    event.target.value;

                searchTimeout =
                    setTimeout(
                        () => {
                            searchUsers(
                                value
                            );
                        },
                        250
                    );
            }
        );
    }


    /* -------------------------
       Close search
    ------------------------- */

    const closeSearchButton =
        $("#closeSearch");

    if (closeSearchButton) {
        closeSearchButton.addEventListener(
            "click",
            closeSearch
        );
    }


    /* -------------------------
       Search overlay
    ------------------------- */

    const searchOverlay =
        $("#searchOverlay");

    if (searchOverlay) {
        searchOverlay.addEventListener(
            "click",
            event => {
                if (
                    event.target ===
                    searchOverlay
                ) {
                    closeSearch();
                }
            }
        );
    }


    /* -------------------------
       Tabs
    ------------------------- */

    $all(
        ".chat-tab"
    ).forEach(button => {
        button.addEventListener(
            "click",
            () => {
                switchTab(
                    button.dataset.type
                );
            }
        );
    });


    /* -------------------------
       Mobile sidebar
    ------------------------- */

    const openSidebarButton =
        $("#openSidebar");

    if (openSidebarButton) {
        openSidebarButton.addEventListener(
            "click",
            openSidebar
        );
    }


    const closeSidebarButton =
        $("#closeSidebar");

    if (closeSidebarButton) {
        closeSidebarButton.addEventListener(
            "click",
            closeSidebar
        );
    }


    /* -------------------------
       File
    ------------------------- */

    const fileButton =
        $("#fileButton");

    if (fileButton) {
        fileButton.addEventListener(
            "click",
            chooseFile
        );
    }


    const fileInput =
        $("#fileInput");

    if (fileInput) {
        fileInput.addEventListener(
            "change",
            handleFileSelect
        );
    }


    /* -------------------------
       Theme
    ------------------------- */

    const themeSelect =
        $("#themeSelect");

    if (themeSelect) {
        themeSelect.addEventListener(
            "change",
            event => {

                const value =
                    event.target.value;

                localStorage.setItem(
                    THEME_KEY,
                    value
                );

                applyTheme(
                    value
                );
            }
        );
    }


    /* -------------------------
       Font
    ------------------------- */

    const fontSelect =
        $("#fontSizeSelect");

    if (fontSelect) {
        fontSelect.addEventListener(
            "change",
            event => {

                const value =
                    event.target.value;

                localStorage.setItem(
                    FONT_KEY,
                    value
                );

                applyFontSize(
                    value
                );
            }
        );
    }


    /* -------------------------
       Close modal buttons
    ------------------------- */

    $all(
        "[data-close]"
    ).forEach(button => {

        button.addEventListener(
            "click",
            () => {
                closeModal(
                    button.dataset.close
                );
            }
        );

    });


    /* -------------------------
       Modal overlays
    ------------------------- */

    $all(
        ".modal"
    ).forEach(modal => {

        const overlay =
            modal.querySelector(
                ".modal-overlay"
            );

        if (overlay) {

            overlay.addEventListener(
                "click",
                () => {
                    modal.classList.add(
                        "hidden"
                    );
                }
            );

        }

    });


    /* -------------------------
       Escape
    ------------------------- */

    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key ===
                "Escape"
            ) {
                closeSearch();
                closeAllModals();
            }

        }
    );


    /* -------------------------
       Online/offline
    ------------------------- */

    window.addEventListener(
        "online",
        () => {
            showToast(
                "اتصال اینترنت برقرار شد.",
                "success"
            );
        }
    );

    window.addEventListener(
        "offline",
        () => {
            showToast(
                "اتصال اینترنت قطع شد.",
                "warning"
            );
        }
    );
}


/* =========================================================
   SYSTEM THEME
   ========================================================= */

if (
    window.matchMedia
) {
    const media =
        window.matchMedia(
            "(prefers-color-scheme: dark)"
        );

    if (
        typeof media.addEventListener ===
        "function"
    ) {
        media.addEventListener(
            "change",
            () => {

                const theme =
                    localStorage.getItem(
                        THEME_KEY
                    ) || "system";

                if (
                    theme ===
                    "system"
                ) {
                    applyTheme(
                        "system"
                    );
                }
            }
        );
    }
}


/* =========================================================
   START
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        setupEvents();

        applyStoredSettings();

        await initializeApp();

    }
);
