"use strict";

/* =========================================================
   GOFTINO
   ARIKA Messenger
   GitHub Pages + PrefsDB
   ========================================================= */


/* =========================================================
   CONFIG
   ========================================================= */

const PREFS_KEY_ID = "goftino-main-v1";

const PREFS_SEED = [
    "goftino",
    "arika",
    "goftino",
    "database-v1"
];

const PREFS_DOMAIN = "goftino";

const SESSION_KEY = "goftino_session";

const THEME_KEY = "goftino_theme";

const FONT_KEY = "goftino_font_size";

const POLL_INTERVAL = 3000;


/* =========================================================
   STATE
   ========================================================= */

let currentUser = null;

let currentChat = null;

let usersCache = [];

let chatsCache = [];

let currentTab = "private";

let pollTimer = null;

let isPolling = false;

let prefsTokenReady = false;


/* =========================================================
   DOM
   ========================================================= */

const $ = selector =>
    document.querySelector(selector);

const $$ = selector =>
    Array.from(
        document.querySelectorAll(selector)
    );


/* =========================================================
   GENERAL HELPERS
   ========================================================= */

function escapeHTML(value) {

    return String(value ?? "")
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
        crypto.randomUUID
    ) {

        return (
            prefix +
            "_" +
            crypto.randomUUID()
        );

    }

    return (
        prefix +
        "_" +
        Date.now() +
        "_" +
        Math.random()
            .toString(36)
            .slice(2)
    );

}


function getInitial(name) {

    const value =
        normalizeName(name);

    return value
        ? value.charAt(0)
        : "گ";

}


function formatTime(timestamp) {

    if (!timestamp) {
        return "";
    }

    const date =
        new Date(timestamp);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
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


function formatDate(timestamp) {

    if (!timestamp) {
        return "";
    }

    const date =
        new Date(timestamp);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return "";
    }

    return date.toLocaleDateString(
        "fa-IR"
    );

}


/* =========================================================
   TOAST
   ========================================================= */

let toastTimer = null;

function showToast(
    message,
    type = "info"
) {

    const toast =
        $("#toast");

    if (!toast) {
        alert(message);
        return;
    }

    const messageEl =
        $("#toastMessage");

    const iconEl =
        $("#toastIcon");

    if (messageEl) {
        messageEl.textContent =
            message;
    }

    if (iconEl) {

        iconEl.textContent =
            type === "success"
                ? "✓"
                : type === "error"
                    ? "!"
                    : "i";

    }

    toast.classList.remove(
        "show"
    );

    clearTimeout(
        toastTimer
    );

    requestAnimationFrame(() => {

        toast.classList.add(
            "show"
        );

    });

    toastTimer =
        setTimeout(() => {

            toast.classList.remove(
                "show"
            );

        }, 3500);

}


/* =========================================================
   LOADING
   ========================================================= */

function setLoadingText(text) {

    const element =
        $("#loadingText");

    if (element) {
        element.textContent =
            text;
    }

}


function hideLoading() {

    const screen =
        $("#loadingScreen");

    if (!screen) {
        return;
    }

    screen.classList.add(
        "hidden"
    );

}


function showLoading(text) {

    const screen =
        $("#loadingScreen");

    if (!screen) {
        return;
    }

    setLoadingText(text);

    screen.classList.remove(
        "hidden"
    );

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


/*
    PrefsDB:
    getkey(keyId, seed, callback)

    طبق مستندات رسمی، توکن کوتاه‌مدت است.
    بنابراین قبل از هر عملیات دوباره getkey
    فراخوانی می‌شود.
*/


function getPrefsToken() {

    return new Promise(
        (resolve, reject) => {

            if (!prefsAvailable()) {

                reject(
                    new Error(
                        "PrefsDB بارگذاری نشده است."
                    )
                );

                return;
            }

            try {

                prefs_us.getkey(
                    PREFS_KEY_ID,
                    PREFS_SEED,
                    response => {

                        if (
                            !response
                        ) {

                            reject(
                                new Error(
                                    "پاسخ خالی از PrefsDB."
                                )
                            );

                            return;
                        }

                        if (
                            response.success === false
                        ) {

                            reject(
                                new Error(
                                    response.message ||
                                    "خطا در دریافت کلید PrefsDB."
                                )
                            );

                            return;
                        }

                        if (
                            !response.token
                        ) {

                            reject(
                                new Error(
                                    "کلید PrefsDB دریافت نشد."
                                )
                            );

                            return;
                        }

                        prefsTokenReady =
                            true;

                        resolve(
                            response.token
                        );

                    }
                );

            } catch (error) {

                reject(error);

            }

        }
    );

}


/* =========================================================
   PREFSDB READ
   ========================================================= */

async function dbRead(key) {

    await getPrefsToken();

    return new Promise(
        (resolve, reject) => {

            try {

                const operation =
                    prefs_us
                        .domain(
                            PREFS_DOMAIN
                        )
                        .key(key)
                        .read(
                            response => {

                                try {

                                    if (
                                        !response
                                    ) {

                                        resolve(
                                            null
                                        );

                                        return;
                                    }

                                    if (
                                        response.success === false
                                    ) {

                                        reject(
                                            new Error(
                                                response.message ||
                                                "خطا در خواندن اطلاعات."
                                            )
                                        );

                                        return;
                                    }

                                    let value =
                                        response.value;

                                    if (
                                        typeof value ===
                                        "string"
                                    ) {

                                        try {

                                            value =
                                                JSON.parse(
                                                    value
                                                );

                                        } catch (_) {}

                                    }

                                    resolve(
                                        value
                                    );

                                } catch (
                                    error
                                ) {

                                    reject(
                                        error
                                    );

                                }

                            }
                        );


                if (
                    operation &&
                    typeof operation.then ===
                    "function"
                ) {

                    operation
                        .then(async response => {

                            try {

                                if (
                                    response &&
                                    typeof response.json ===
                                    "function"
                                ) {

                                    const data =
                                        await response.json();

                                    let value =
                                        data.value;

                                    if (
                                        typeof value ===
                                        "string"
                                    ) {

                                        try {

                                            value =
                                                JSON.parse(
                                                    value
                                                );

                                        } catch (_) {}

                                    }

                                    resolve(
                                        value
                                    );

                                }

                            } catch (
                                error
                            ) {

                                reject(
                                    error
                                );

                            }

                        })
                        .catch(
                            reject
                        );

                }

            } catch (error) {

                reject(error);

            }

        }
    );

}


/* =========================================================
   PREFSDB WRITE
   ========================================================= */

async function dbWrite(
    key,
    value
) {

    await getPrefsToken();

    const serialized =
        JSON.stringify(
            value
        );

    return new Promise(
        (resolve, reject) => {

            try {

                const operation =
                    prefs_us
                        .domain(
                            PREFS_DOMAIN
                        )
                        .key(key)
                        .write(
                            serialized
                        );


                if (
                    operation &&
                    typeof operation.then ===
                    "function"
                ) {

                    operation
                        .then(
                            resolve
                        )
                        .catch(
                            reject
                        );

                } else {

                    resolve(
                        operation
                    );

                }

            } catch (error) {

                reject(error);

            }

        }
    );

}


/* =========================================================
   DATABASE
   ========================================================= */

async function getUsers() {

    const result =
        await dbRead(
            "users"
        );

    return Array.isArray(result)
        ? result
        : [];

}


async function saveUsers(
    users
) {

    return dbWrite(
        "users",
        users
    );

}


async function getChats() {

    const result =
        await dbRead(
            "chats"
        );

    return Array.isArray(result)
        ? result
        : [];

}


async function saveChats(
    chats
) {

    return dbWrite(
        "chats",
        chats
    );

}


function messagesKey(
    chatId
) {

    return (
        "messages_" +
        chatId
    );

}


async function getMessages(
    chatId
) {

    const result =
        await dbRead(
            messagesKey(
                chatId
            )
        );

    return Array.isArray(result)
        ? result
        : [];

}


async function saveMessages(
    chatId,
    messages
) {

    return dbWrite(
        messagesKey(chatId),
        messages
    );

}


/* =========================================================
   PASSWORD HASH
   ========================================================= */

async function hashPassword(
    password
) {

    const value =
        String(password || "");

    if (
        window.crypto &&
        crypto.subtle
    ) {

        const data =
            new TextEncoder()
                .encode(value);

        const hash =
            await crypto.subtle.digest(
                "SHA-256",
                data
            );

        return Array.from(
            new Uint8Array(hash)
        )
            .map(
                byte =>
                    byte
                        .toString(16)
                        .padStart(
                            2,
                            "0"
                        )
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
                (
                    hash << 5
                ) -
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

function saveSession(
    userId
) {

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
   USER HELPERS
   ========================================================= */

function findUserById(
    id
) {

    return (
        usersCache.find(
            user =>
                user.id === id
        ) || null
    );

}


function findUserByEmail(
    email
) {

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
   AUTH UI
   ========================================================= */

function showLogin() {

    $("#loginBox")
        ?.classList.remove(
            "hidden"
        );

    $("#registerBox")
        ?.classList.add(
            "hidden"
        );

}


function showRegister() {

    $("#loginBox")
        ?.classList.add(
            "hidden"
        );

    $("#registerBox")
        ?.classList.remove(
            "hidden"
        );

}


function showAuthPage() {

    $("#authPage")
        ?.classList.remove(
            "hidden"
        );

    $("#appPage")
        ?.classList.add(
            "hidden"
        );

}


function showAppPage() {

    $("#authPage")
        ?.classList.add(
            "hidden"
        );

    $("#appPage")
        ?.classList.remove(
            "hidden"
        );

    updateProfileUI();

}


/* =========================================================
   REGISTER
   ========================================================= */

async function registerUser() {

    const name =
        normalizeName(
            $("#registerName")?.value
        );

    const email =
        normalizeEmail(
            $("#registerEmail")?.value
        );

    const password =
        $("#registerPassword")?.value || "";

    const password2 =
        $("#registerPassword2")?.value || "";


    if (
        name.length < 2
    ) {

        showToast(
            "نام را درست وارد کنید.",
            "error"
        );

        return;
    }


    if (!email.includes("@")) {

        showToast(
            "ایمیل معتبر وارد کنید.",
            "error"
        );

        return;
    }


    if (
        password.length < 4
    ) {

        showToast(
            "رمز عبور باید حداقل ۴ کاراکتر باشد.",
            "error"
        );

        return;
    }


    if (
        password !== password2
    ) {

        showToast(
            "تکرار رمز عبور یکسان نیست.",
            "error"
        );

        return;
    }


    try {

        showLoading(
            "در حال ساخت حساب..."
        );


        usersCache =
            await getUsers();


        const oldUser =
            findUserByEmail(
                email
            );


        if (
            oldUser &&
            oldUser.deleted !== true
        ) {

            hideLoading();

            showToast(
                "این ایمیل قبلاً ثبت شده است.",
                "error"
            );

            return;
        }


        if (
            oldUser &&
            oldUser.deleted === true
        ) {

            const deletedAt =
                Number(
                    oldUser.deletedAt ||
                    0
                );

            const threeDays =
                3 *
                24 *
                60 *
                60 *
                1000;


            if (
                Date.now() -
                deletedAt <
                threeDays
            ) {

                hideLoading();

                showToast(
                    "این ایمیل تا چند روز قابل استفاده مجدد نیست.",
                    "error"
                );

                return;
            }

        }


        const passwordHash =
            await hashPassword(
                password
            );


        const user = {

            id:
                generateId(
                    "user"
                ),

            name,

            email,

            password:
                passwordHash,

            createdAt:
                Date.now(),

            deleted:
                false,

            deletedAt:
                null

        };


        usersCache =
            usersCache.filter(
                item =>
                    item.email !==
                    email
            );


        usersCache.push(
            user
        );


        await saveUsers(
            usersCache
        );


        saveSession(
            user.id
        );


        currentUser =
            user;


        hideLoading();

        showAppPage();

        await loadChats();

        showToast(
            "حساب شما با موفقیت ساخته شد.",
            "success"
        );


        $("#registerForm")
            ?.reset();


    } catch (error) {

        console.error(
            error
        );

        hideLoading();

        showToast(
            "خطا در ثبت‌نام: " +
            error.message,
            "error"
        );

    }

}


/* =========================================================
   LOGIN
   ========================================================= */

async function loginUser() {

    const email =
        normalizeEmail(
            $("#loginEmail")?.value
        );

    const password =
        $("#loginPassword")?.value || "";


    if (
        !email ||
        !password
    ) {

        showToast(
            "ایمیل و رمز عبور را وارد کنید.",
            "error"
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
            findUserByEmail(
                email
            );


        if (
            !user
        ) {

            hideLoading();

            showToast(
                "حسابی با این ایمیل پیدا نشد.",
                "error"
            );

            return;
        }


        if (
            user.deleted
        ) {

            hideLoading();

            showToast(
                "این حساب حذف شده است.",
                "error"
            );

            return;
        }


        const passwordHash =
            await hashPassword(
                password
            );


        if (
            passwordHash !==
            user.password
        ) {

            hideLoading();

            showToast(
                "ایمیل یا رمز عبور اشتباه است.",
                "error"
            );

            return;
        }


        currentUser =
            user;


        saveSession(
            user.id
        );


        hideLoading();

        showAppPage();

        await loadChats();

        showToast(
            "خوش آمدید " +
            user.name,
            "success"
        );


        $("#loginForm")
            ?.reset();


    } catch (error) {

        console.error(
            error
        );

        hideLoading();

        showToast(
            "خطا در ورود: " +
            error.message,
            "error"
        );

    }

}


/* =========================================================
   LOGOUT
   ========================================================= */

function logout() {

    stopPolling();

    currentUser =
        null;

    currentChat =
        null;

    clearSession();

    showAuthPage();

    showLogin();

}


/* =========================================================
   PROFILE
   ========================================================= */

function updateProfileUI() {

    if (
        !currentUser
    ) {
        return;
    }


    const name =
        currentUser.name ||
        "کاربر";


    const initial =
        getInitial(name);


    const sidebarAvatar =
        $("#sidebarAvatar");

    const sidebarUserName =
        $("#sidebarUserName");


    if (
        sidebarAvatar
    ) {

        sidebarAvatar.textContent =
            initial;

    }


    if (
        sidebarUserName
    ) {

        sidebarUserName.textContent =
            name;

    }


    const profileAvatar =
        $("#profileAvatar");

    const profileName =
        $("#profileName");

    const profileEmail =
        $("#profileEmail");

    const profileId =
        $("#profileId");


    if (
        profileAvatar
    ) {

        profileAvatar.textContent =
            initial;

    }


    if (
        profileName
    ) {

        profileName.textContent =
            name;

    }


    if (
        profileEmail
    ) {

        profileEmail.textContent =
            currentUser.email;

    }


    if (
        profileId
    ) {

        profileId.textContent =
            currentUser.id;

    }

}


/* =========================================================
   CHAT ID
   ========================================================= */

function privateChatId(
    userA,
    userB
) {

    return (
        "private_" +
        [
            userA,
            userB
        ]
            .sort()
            .join("_")
    );

}


/* =========================================================
   LOAD CHATS
   ========================================================= */

async function loadChats() {

    if (
        !currentUser
    ) {
        return;
    }


    try {

        chatsCache =
            await getChats();


        renderChatList();

    } catch (error) {

        console.error(
            error
        );

        showToast(
            "خطا در دریافت گفتگوها.",
            "error"
        );

    }

}


/* =========================================================
   CHAT LIST
   ========================================================= */

function getMyChats() {

    if (
        !currentUser
    ) {
        return [];
    }


    return chatsCache
        .filter(
            chat =>
                Array.isArray(
                    chat.members
                ) &&
                chat.members.includes(
                    currentUser.id
                )
        )
        .sort(
            (a, b) =>
                Number(
                    b.updatedAt || 0
                ) -
                Number(
                    a.updatedAt || 0
                )
        );

}


function renderChatList() {

    const list =
        $("#chatList");

    if (!list) {
        return;
    }


    if (
        currentTab !== "private"
    ) {

        list.innerHTML = `
            <div class="emptyList">
                این بخش به‌زودی فعال می‌شود.
            </div>
        `;

        return;
    }


    const chats =
        getMyChats();


    if (
        chats.length === 0
    ) {

        list.innerHTML = `
            <div class="emptyList">
                هنوز گفتگویی ندارید.<br>
                از قسمت جستجو یک کاربر پیدا کنید.
            </div>
        `;

        return;
    }


    list.innerHTML =
        chats
            .map(
                chat => {

                    const otherId =
                        chat.members.find(
                            id =>
                                id !==
                                currentUser.id
                        );


                    const other =
                        findUserById(
                            otherId
                        );


                    if (!other) {
                        return "";
                    }


                    const active =
                        currentChat &&
                        currentChat.id ===
                        chat.id
                            ? "active"
                            : "";


                    const locked =
                        chat.locked
                            ? " 🔒"
                            : "";


                    return `
                        <div
                            class="chatItem ${active}"
                            data-chat-id="${escapeHTML(chat.id)}"
                        >

                            <div class="avatar">
                                ${escapeHTML(
                                    getInitial(
                                        other.name
                                    )
                                )}
                            </div>

                            <div class="chatItemInfo">

                                <div class="chatItemTop">

                                    <span class="chatItemName">
                                        ${escapeHTML(
                                            other.name
                                        )}${locked}
                                    </span>

                                    <span class="chatItemTime">
                                        ${formatTime(
                                            chat.updatedAt
                                        )}
                                    </span>

                                </div>

                                <div class="chatPreview">
                                    ${escapeHTML(
                                        chat.lastMessage ||
                                        "گفتگوی جدید"
                                    )}
                                </div>

                            </div>

                        </div>
                    `;

                }
            )
            .join("");


    $all(
        ".chatItem"
    ).forEach(
        item => {

            item.addEventListener(
                "click",
                () => {

                    const chat =
                        chatsCache.find(
                            c =>
                                c.id ===
                                item.dataset.chatId
                        );


                    if (chat) {
                        openChat(
                            chat
                        );
                    }

                }
            );

        }
    );

}


/* =========================================================
   CREATE PRIVATE CHAT
   ========================================================= */

async function startPrivateChat(
    otherUser
) {

    if (
        !currentUser ||
        !otherUser
    ) {
        return;
    }


    const chatId =
        privateChatId(
            currentUser.id,
            otherUser.id
        );


    try {

        chatsCache =
            await getChats();


        let chat =
            chatsCache.find(
                item =>
                    item.id ===
                    chatId
            );


        if (!chat) {

            chat = {

                id:
                    chatId,

                type:
                    "private",

                members: [
                    currentUser.id,
                    otherUser.id
                ],

                createdAt:
                    Date.now(),

                updatedAt:
                    Date.now(),

                lastMessage:
                    "",

                locked:
                    false

            };


            chatsCache.push(
                chat
            );


            await saveChats(
                chatsCache
            );

        }


        closeSearch();

        await openChat(
            chat
        );


        renderChatList();


    } catch (error) {

        console.error(
            error
        );

        showToast(
            "خطا در ساخت گفتگو: " +
            error.message,
            "error"
        );

    }

}


/* =========================================================
   OPEN CHAT
   ========================================================= */

async function openChat(
    chat
) {

    if (
        !chat ||
        !currentUser
    ) {
        return;
    }


    currentChat =
        chat;


    const otherId =
        chat.members.find(
            id =>
                id !==
                currentUser.id
        );


    const other =
        findUserById(
            otherId
        );


    if (!other) {

        showToast(
            "کاربر پیدا نشد.",
            "error"
        );

        return;
    }


    $("#chatHeaderEmpty")
        ?.classList.add(
            "hidden"
        );


    $("#chatHeaderUser")
        ?.classList.remove(
            "hidden"
        );


    $("#welcomeChat")
        ?.classList.add(
            "hidden"
        );


    $("#messagesContainer")
        ?.classList.remove(
            "hidden"
        );


    $("#messageArea")
        ?.classList.remove(
            "hidden"
        );


    const headerAvatar =
        $("#chatHeaderAvatar");

    const headerName =
        $("#chatHeaderName");

    const headerStatus =
        $("#chatHeaderStatus");


    if (
        headerAvatar
    ) {

        headerAvatar.textContent =
            getInitial(
                other.name
            );

    }


    if (
        headerName
    ) {

        headerName.textContent =
            other.name;

    }


    if (
        headerStatus
    ) {

        headerStatus.textContent =
            chat.locked
                ? "گفتگو قفل شده"
                : "کاربر گفتینو";

    }


    await renderMessages();


    scrollMessages();


    if (
        window.innerWidth <=
        750
    ) {

        $("#sidebar")
            ?.classList.add(
                "mobileHidden"
            );

        $("#mainArea")
            ?.classList.remove(
                "mobileHidden"
            );

    }

}


/* =========================================================
   RENDER MESSAGES
   ========================================================= */

async function renderMessages() {

    if (
        !currentChat
    ) {
        return;
    }


    const container =
        $("#messagesContainer");

    if (!container) {
        return;
    }


    try {

        const messages =
            await getMessages(
                currentChat.id
            );


        if (
            messages.length === 0
        ) {

            container.innerHTML = `
                <div
                    style="
                        text-align:center;
                        color:#8c96a0;
                        margin:auto;
                        padding:30px;
                    "
                >
                    هنوز پیامی وجود ندارد.<br>
                    اولین پیام را شما ارسال کنید.
                </div>
            `;

            return;
        }


        container.innerHTML =
            messages
                .sort(
                    (a, b) =>
                        Number(
                            a.createdAt
                        ) -
                        Number(
                            b.createdAt
                        )
                )
                .map(
                    message => {

                        const mine =
                            message.senderId ===
                            currentUser.id;


                        return `
                            <div
                                class="messageRow ${
                                    mine
                                        ? "mine"
                                        : "theirs"
                                }"
                            >

                                <div class="messageBubble">

                                    ${escapeHTML(
                                        message.text
                                    )}

                                    <span class="messageTime">
                                        ${formatTime(
                                            message.createdAt
                                        )}
                                    </span>

                                </div>

                            </div>
                        `;

                    }
                )
                .join("");


    } catch (error) {

        console.error(
            error
        );

    }

}


/* =========================================================
   SEND MESSAGE
   ========================================================= */

async function sendMessage() {

    if (
        !currentUser ||
        !currentChat
    ) {
        return;
    }


    if (
        currentChat.locked
    ) {

        showToast(
            "این گفتگو قفل شده است.",
            "error"
        );

        return;
    }


    const input =
        $("#messageInput");

    if (!input) {
        return;
    }


    const text =
        input.value.trim();


    if (!text) {
        return;
    }


    try {

        const messages =
            await getMessages(
                currentChat.id
            );


        const message = {

            id:
                generateId(
                    "msg"
                ),

            senderId:
                currentUser.id,

            text,

            createdAt:
                Date.now()

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
            ].updatedAt =
                Date.now();

            currentChat =
                chatsCache[
                    chatIndex
                ];

        }


        await saveChats(
            chatsCache
        );


        input.value = "";


        await renderMessages();

        renderChatList();

        scrollMessages();


    } catch (error) {

        console.error(
            error
        );

        showToast(
            "ارسال پیام ناموفق بود.",
            "error"
        );

    }

}


/* =========================================================
   SCROLL
   ========================================================= */

function scrollMessages() {

    const container =
        $("#messagesContainer");

    if (!container) {
        return;
    }


    requestAnimationFrame(
        () => {

            container.scrollTop =
                container.scrollHeight;

        }
    );

}


/* =========================================================
   SEARCH
   ========================================================= */

async function searchUsers(
    query
) {

    query =
        normalizeName(
            query
        ).toLowerCase();


    const overlay =
        $("#searchOverlay");

    const results =
        $("#searchResults");


    if (
        !overlay ||
        !results
    ) {
        return;
    }


    if (
        query.length < 1
    ) {

        closeSearch();

        return;
    }


    try {

        usersCache =
            await getUsers();


        const found =
            usersCache.filter(
                user => {

                    if (
                        user.id ===
                        currentUser?.id
                    ) {
                        return false;
                    }


                    if (
                        user.deleted
                    ) {
                        return false;
                    }


                    const name =
                        String(
                            user.name ||
                            ""
                        ).toLowerCase();


                    const email =
                        String(
                            user.email ||
                            ""
                        ).toLowerCase();


                    return (
                        name.includes(
                            query
                        ) ||
                        email.includes(
                            query
                        )
                    );

                }
            )
            .slice(
                0,
                20
            );


        if (
            found.length === 0
        ) {

            results.innerHTML = `
                <div class="emptyList">
                    کاربری پیدا نشد.
                </div>
            `;

        } else {

            results.innerHTML =
                found
                    .map(
                        user => `
                            <div
                                class="searchResult"
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

                                <div>
                                    <strong>
                                        ${escapeHTML(
                                            user.name
                                        )}
                                    </strong>

                                    <div
                                        style="
                                            color:#8a949f;
                                            font-size:12px;
                                        "
                                    >
                                        ${escapeHTML(
                                            user.email
                                        )}
                                    </div>
                                </div>

                            </div>
                        `
                    )
                    .join("");

        }


        overlay.classList.remove(
            "hidden"
        );


        $all(
            ".searchResult"
        ).forEach(
            item => {

                item.addEventListener(
                    "click",
                    async () => {

                        const user =
                            findUserById(
                                item.dataset.userId
                            );


                        if (
                            user
                        ) {

                            await startPrivateChat(
                                user
                            );

                        }

                    }
                );

            }
        );


    } catch (error) {

        console.error(
            error
        );

        showToast(
            "خطا در جستجوی کاربران.",
            "error"
        );

    }

}


function closeSearch() {

    $("#searchOverlay")
        ?.classList.add(
            "hidden"
        );

}


/* =========================================================
   CHAT INFO
   ========================================================= */

function showChatInfo() {

    if (
        !currentChat
    ) {
        return;
    }


    const content =
        $("#chatInfoContent");


    if (!content) {
        return;
    }


    const otherId =
        currentChat.members.find(
            id =>
                id !==
                currentUser.id
        );


    const other =
        findUserById(
            otherId
        );


    if (!other) {
        return;
    }


    content.innerHTML = `

        <div class="profileBig">

            <div class="avatar">
                ${escapeHTML(
                    getInitial(
                        other.name
                    )
                )}
            </div>

            <h3>
                ${escapeHTML(
                    other.name
                )}
            </h3>

        </div>

        <div class="profileInfo">

            <small>
                ایمیل
            </small>

            ${escapeHTML(
                other.email
            )}

        </div>

        <div class="profileInfo">

            <small>
                شناسه
            </small>

            ${escapeHTML(
                other.id
            )}

        </div>

        <div class="profileInfo">

            <small>
                تاریخ ساخت حساب
            </small>

            ${formatDate(
                other.createdAt
            )}

        </div>

    `;


    openModal(
        "chatInfoModal"
    );

}


/* =========================================================
   MODALS
   ========================================================= */

function openModal(
    id
) {

    $(`#${id}`)
        ?.classList.remove(
            "hidden"
        );

}


function closeModal(
    id
) {

    $(`#${id}`)
        ?.classList.add(
            "hidden"
        );

}


/* =========================================================
   DELETE ACCOUNT
   ========================================================= */

async function deleteAccount() {

    if (
        !currentUser
    ) {
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


        if (
            index === -1
        ) {

            hideLoading();

            return;
        }


        usersCache[
            index
        ].deleted =
            true;


        usersCache[
            index
        ].deletedAt =
            Date.now();


        usersCache[
            index
        ].name =
            "حساب حذف‌شده";


        await saveUsers(
            usersCache
        );


        chatsCache =
            await getChats();


        let changed = false;


        chatsCache =
            chatsCache.map(
                chat => {

                    if (
                        chat.members &&
                        chat.members.includes(
                            currentUser.id
                        )
                    ) {

                        changed = true;

                        return {
                            ...chat,
                            locked:
                                true
                        };

                    }


                    return chat;

                }
            );


        if (
            changed
        ) {

            await saveChats(
                chatsCache
            );

        }


        clearSession();

        currentUser =
            null;

        currentChat =
            null;


        closeModal(
            "deleteAccountModal"
        );

        closeModal(
            "settingsModal"
        );


        hideLoading();

        showAuthPage();

        showLogin();


        showToast(
            "حساب شما حذف شد.",
            "success"
        );


    } catch (error) {

        console.error(
            error
        );

        hideLoading();

        showToast(
            "حذف حساب ناموفق بود.",
            "error"
        );

    }

}


/* =========================================================
   SETTINGS
   ========================================================= */

function loadSettings() {

    const theme =
        localStorage.getItem(
            THEME_KEY
        ) ||
        "light";


    const font =
        localStorage.getItem(
            FONT_KEY
        ) ||
        "normal";


    const themeSelect =
        $("#themeSelect");

    const fontSelect =
        $("#fontSizeSelect");


    if (
        themeSelect
    ) {

        themeSelect.value =
            theme;

    }


    if (
        fontSelect
    ) {

        fontSelect.value =
            font;

    }


    applyTheme(
        theme
    );

    applyFontSize(
        font
    );

}


function applyTheme(
    theme
) {

    document.documentElement
        .setAttribute(
            "data-theme",
            theme
        );


    localStorage.setItem(
        THEME_KEY,
        theme
    );


    if (
        theme === "dark"
    ) {

        document.body.style.background =
            "#10151c";

        document.body.style.color =
            "#f1f5f9";

    } else {

        document.body.style.background =
            "";

        document.body.style.color =
            "";

    }

}


function applyFontSize(
    size
) {

    let value =
        "16px";


    if (
        size === "small"
    ) {

        value =
            "14px";

    } else if (
        size === "large"
    ) {

        value =
            "18px";

    }


    document.documentElement.style
        .setProperty(
            "--goftino-font-size",
            value
        );


    localStorage.setItem(
        FONT_KEY,
        size
    );

}


/* =========================================================
   MOBILE
   ========================================================= */

function backToSidebar() {

    $("#sidebar")
        ?.classList.remove(
            "mobileHidden"
        );

    $("#mainArea")
        ?.classList.add(
            "mobileHidden"
        );

}


if (
    window.innerWidth <= 750
) {

    $("#mainArea")
        ?.classList.add(
            "mobileHidden"
        );

}


/* =========================================================
   FILE
   ========================================================= */

function handleFile() {

    showToast(
        "ارسال فایل در این نسخه فعال نشده است."
    );

}


/* =========================================================
   POLLING
   ========================================================= */

function startPolling() {

    stopPolling();


    pollTimer =
        setInterval(
            async () => {

                if (
                    isPolling ||
                    !currentUser
                ) {
                    return;
                }


                isPolling =
                    true;


                try {

                    usersCache =
                        await getUsers();


                    chatsCache =
                        await getChats();


                    renderChatList();


                    if (
                        currentChat
                    ) {

                        const latest =
                            chatsCache.find(
                                chat =>
                                    chat.id ===
                                    currentChat.id
                            );


                        if (
                            latest
                        ) {

                            currentChat =
                                latest;

                            await renderMessages();

                        }

                    }

                } catch (
                    error
                ) {

                    console.warn(
                        "Polling:",
                        error
                    );

                }


                isPolling =
                    false;


            },
            POLL_INTERVAL
        );

}


function stopPolling() {

    if (
        pollTimer
    ) {

        clearInterval(
            pollTimer
        );

        pollTimer =
            null;

    }

}


/* =========================================================
   INITIALIZATION
   ========================================================= */

async function initializeApp() {

    showLoading(
        "در حال بارگذاری گفتینو..."
    );


    /*
        اگر PrefsDB لود نشده باشد،
        خطای واضح نمایش داده می‌شود.
    */

    if (
        !prefsAvailable()
    ) {

        hideLoading();

        showAuthPage();

        showToast(
            "خطا در اتصال به PrefsDB. فایل prefs.us.js بارگذاری نشده است.",
            "error"
        );

        console.error(
            "PrefsDB is not available. Check https://prefs.us/prefs.us.js"
        );

        return;
    }


    try {

        setLoadingText(
            "در حال اتصال به پایگاه داده..."
        );


        await getPrefsToken();


        usersCache =
            await getUsers();


        const session =
            getSession();


        if (
            session
        ) {

            const user =
                usersCache.find(
                    item =>
                        item.id ===
                        session
                );


            if (
                user &&
                !user.deleted
            ) {

                currentUser =
                    user;


                chatsCache =
                    await getChats();


                hideLoading();

                showAppPage();

                renderChatList();

                startPolling();

                return;

            }


            clearSession();

        }


        hideLoading();

        showAuthPage();

        showLogin();


    } catch (error) {

        console.error(
            "Initialization error:",
            error
        );


        hideLoading();

        showAuthPage();


        showToast(
            "خطا در اتصال به PrefsDB: " +
            error.message,
            "error"
        );

    }

}


/* =========================================================
   EVENTS
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {


        /* Auth */

        $("#showRegisterButton")
            ?.addEventListener(
                "click",
                showRegister
            );


        $("#showLoginButton")
            ?.addEventListener(
                "click",
                showLogin
            );


        $("#loginForm")
            ?.addEventListener(
                "submit",
                event => {

                    event.preventDefault();

                    loginUser();

                }
            );


        $("#registerForm")
            ?.addEventListener(
                "submit",
                event => {

                    event.preventDefault();

                    registerUser();

                }
            );


        /* Profile */

        $("#profileButton")
            ?.addEventListener(
                "click",
                () => {

                    updateProfileUI();

                    openModal(
                        "profileModal"
                    );

                }
            );


        $("#logoutButton")
            ?.addEventListener(
                "click",
                logout
            );


        /* Settings */

        $("#settingsButton")
            ?.addEventListener(
                "click",
                () => {

                    loadSettings();

                    openModal(
                        "settingsModal"
                    );

                }
            );


        $("#themeSelect")
            ?.addEventListener(
                "change",
                event => {

                    applyTheme(
                        event.target.value
                    );

                }
            );


        $("#fontSizeSelect")
            ?.addEventListener(
                "change",
                event => {

                    applyFontSize(
                        event.target.value
                    );

                }
            );


        $("#deleteAccountButton")
            ?.addEventListener(
                "click",
                () => {

                    openModal(
                        "deleteAccountModal"
                    );

                }
            );


        $("#confirmDeleteAccount")
            ?.addEventListener(
                "click",
                deleteAccount
            );


        /* Search */

        $("#userSearch")
            ?.addEventListener(
                "input",
                event => {

                    searchUsers(
                        event.target.value
                    );

                }
            );


        /* Tabs */

        $all(
            ".tabButton"
        ).forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        $all(
                            ".tabButton"
                        ).forEach(
                            item =>
                                item.classList.remove(
                                    "active"
                                )
                        );


                        button.classList.add(
                            "active"
                        );


                        currentTab =
                            button.dataset.tab;


                        renderChatList();

                    }
                );

            }
        );


        /* Messages */

        $("#sendMessageButton")
            ?.addEventListener(
                "click",
                sendMessage
            );


        $("#messageInput")
            ?.addEventListener(
                "keydown",
                event => {

                    if (
                        event.key ===
                            "Enter" &&
                        !event.shiftKey
                    ) {

                        event.preventDefault();

                        sendMessage();

                    }

                }
            );


        /* File */

        $("#fileButton")
            ?.addEventListener(
                "click",
                () => {

                    $("#fileInput")
                        ?.click();

                }
            );


        $("#fileInput")
            ?.addEventListener(
                "change",
                handleFile
            );


        /* Chat info */

        $("#chatInfoButton")
            ?.addEventListener(
                "click",
                showChatInfo
            );


        /* Mobile */

        $("#backToSidebarButton")
            ?.addEventListener(
                "click",
                backToSidebar
            );


        /* Close modals */

        $all(
            "[data-close-modal]"
        ).forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        closeModal(
                            button.dataset.closeModal
                        );

                    }
                );

            }
        );


        $all(
            ".modalOverlay"
        ).forEach(
            overlay => {

                overlay.addEventListener(
                    "click",
                    event => {

                        if (
                            event.target ===
                            overlay
                        ) {

                            overlay.classList.add(
                                "hidden"
                            );

                        }

                    }
                );

            }
        );


        /* Close search */

        document.addEventListener(
            "click",
            event => {

                const searchBox =
                    $(".searchBox");

                const overlay =
                    $("#searchOverlay");


                if (
                    overlay &&
                    !overlay.classList.contains(
                        "hidden"
                    ) &&
                    searchBox &&
                    !searchBox.contains(
                        event.target
                    ) &&
                    !overlay.contains(
                        event.target
                    )
                ) {

                    closeSearch();

                }

            }
        );


        loadSettings();

        initializeApp();

    }
);


/* =========================================================
   ONLINE / OFFLINE
   ========================================================= */

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
            "error"
        );

    }
);


/* =========================================================
   BEFORE UNLOAD
   ========================================================= */

window.addEventListener(
    "beforeunload",
    () => {

        stopPolling();

    }
);
