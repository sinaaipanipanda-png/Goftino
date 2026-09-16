# -*- coding: utf-8 -*-

"""
=========================================================
GOFTINO — SERVER.PY
Version 1.0 Beta

Frontend:
    GitHub Pages

Backend:
    FastAPI

Database:
    PostgreSQL

Features:
    - Register
    - Login
    - Logout
    - Current user
    - User search
    - Private chats
    - Send messages
    - Load messages
    - Delete account
    - Health check

Environment variables:

DATABASE_URL
SECRET_KEY

Example:

DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DBNAME
SECRET_KEY=change-this-to-a-long-random-secret
=========================================================
"""

import os
import re
import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from sqlalchemy import (
    create_engine,
    Column,
    Integer,
    String,
    Boolean,
    DateTime,
    ForeignKey,
    Text,
    UniqueConstraint,
    or_,
    and_,
)
from sqlalchemy.orm import declarative_base, sessionmaker, Session


# =========================================================
# CONFIG
# =========================================================

DATABASE_URL = os.getenv("DATABASE_URL")

SECRET_KEY = os.getenv(
    "SECRET_KEY",
    "CHANGE-ME-IN-PRODUCTION"
)

if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL environment variable is not set."
    )


# =========================================================
# DATABASE URL FIX
# =========================================================

# بعضی سرویس‌ها DATABASE_URL را با postgres://
# می‌دهند. SQLAlchemy نسخه‌های جدید معمولاً
# postgresql:// را ترجیح می‌دهند.

if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace(
        "postgres://",
        "postgresql://",
        1
    )


# =========================================================
# DATABASE
# =========================================================

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_recycle=300,
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

Base = declarative_base()


# =========================================================
# APP
# =========================================================

app = FastAPI(
    title="Goftino API",
    version="1.0.0"
)


# =========================================================
# CORS
# =========================================================

# در حالت فعلی برای GitHub Pages باز گذاشته شده.
# بعد از قرار دادن دامنه نهایی می‌توان آن را محدود کرد.

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================================================
# DATABASE MODELS
# =========================================================

class User(Base):

    __tablename__ = "users"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    name = Column(
        String(100),
        nullable=False
    )

    email = Column(
        String(255),
        unique=True,
        nullable=False,
        index=True
    )

    password_hash = Column(
        String(255),
        nullable=False
    )

    avatar = Column(
        Text,
        nullable=True
    )

    status = Column(
        String(30),
        default="active",
        nullable=False
    )

    account_badge = Column(
        String(50),
        nullable=True
    )

    is_admin = Column(
        Boolean,
        default=False,
        nullable=False
    )

    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc)
    )

    deleted_at = Column(
        DateTime(timezone=True),
        nullable=True
    )


class SessionToken(Base):

    __tablename__ = "session_tokens"

    id = Column(
        Integer,
        primary_key=True
    )

    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
        index=True
    )

    token_hash = Column(
        String(255),
        unique=True,
        nullable=False,
        index=True
    )

    expires_at = Column(
        DateTime(timezone=True),
        nullable=False
    )

    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc)
    )


class Chat(Base):

    __tablename__ = "chats"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    chat_type = Column(
        String(20),
        default="private",
        nullable=False
    )

    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc)
    )

    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc)
    )


class ChatMember(Base):

    __tablename__ = "chat_members"

    id = Column(
        Integer,
        primary_key=True
    )

    chat_id = Column(
        Integer,
        ForeignKey("chats.id"),
        nullable=False,
        index=True
    )

    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
        index=True
    )

    joined_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc)
    )

    __table_args__ = (
        UniqueConstraint(
            "chat_id",
            "user_id",
            name="unique_chat_member"
        ),
    )


class Message(Base):

    __tablename__ = "messages"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    chat_id = Column(
        Integer,
        ForeignKey("chats.id"),
        nullable=False,
        index=True
    )

    sender_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
        index=True
    )

    text = Column(
        Text,
        nullable=False
    )

    is_read = Column(
        Boolean,
        default=False,
        nullable=False
    )

    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        index=True
    )


# =========================================================
# CREATE TABLES
# =========================================================

Base.metadata.create_all(bind=engine)


# =========================================================
# DATABASE DEPENDENCY
# =========================================================

def get_db():

    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()


# =========================================================
# PASSWORD HASHING
# =========================================================

def hash_password(password: str) -> str:

    salt = secrets.token_bytes(16)

    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        120_000
    )

    return (
        salt.hex()
        + "$"
        + digest.hex()
    )


def verify_password(
    password: str,
    stored_hash: str
) -> bool:

    try:

        salt_hex, digest_hex = \
            stored_hash.split("$", 1)

        salt = bytes.fromhex(salt_hex)

        calculated = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt,
            120_000
        )

        return secrets.compare_digest(
            calculated.hex(),
            digest_hex
        )

    except Exception:
        return False


# =========================================================
# TOKEN
# =========================================================

def hash_token(token: str) -> str:

    return hashlib.sha256(
        (
            token + SECRET_KEY
        ).encode("utf-8")
    ).hexdigest()


def create_session(
    db: Session,
    user_id: int
):

    raw_token = secrets.token_urlsafe(48)

    token_hash = hash_token(
        raw_token
    )

    session = SessionToken(
        user_id=user_id,
        token_hash=token_hash,
        expires_at=datetime.now(
            timezone.utc
        ) + timedelta(days=30)
    )

    db.add(session)

    db.commit()

    return raw_token


# =========================================================
# AUTH
# =========================================================

def get_current_user(
    db: Session,
    authorization: Optional[str]
):

    if not authorization:
        raise HTTPException(
            status_code=401,
            detail="وارد حساب کاربری نشده‌اید."
        )

    if not authorization.startswith(
        "Bearer "
    ):
        raise HTTPException(
            status_code=401,
            detail="توکن نامعتبر است."
        )

    raw_token = authorization[
        7:
    ].strip()

    if not raw_token:
        raise HTTPException(
            status_code=401,
            detail="توکن نامعتبر است."
        )

    token_hash = hash_token(
        raw_token
    )

    session = (
        db.query(SessionToken)
        .filter(
            SessionToken.token_hash ==
            token_hash
        )
        .first()
    )

    if not session:
        raise HTTPException(
            status_code=401,
            detail="جلسه ورود معتبر نیست."
        )

    now = datetime.now(
        timezone.utc
    )

    if session.expires_at < now:

        db.delete(session)
        db.commit()

        raise HTTPException(
            status_code=401,
            detail="جلسه ورود منقضی شده است."
        )

    user = (
        db.query(User)
        .filter(
            User.id == session.user_id
        )
        .first()
    )

    if not user:

        raise HTTPException(
            status_code=401,
            detail="کاربر پیدا نشد."
        )

    if user.deleted_at is not None:

        raise HTTPException(
            status_code=403,
            detail="این حساب حذف شده است."
        )

    if user.status in (
        "suspended",
        "banned"
    ):

        raise HTTPException(
            status_code=403,
            detail="حساب کاربری شما محدود شده است."
        )

    return user


# =========================================================
# USER RESPONSE
# =========================================================

def user_response(user: User):

    badges = []

    if user.account_badge:
        badges.append({
            "name": user.account_badge,
            "label": user.account_badge
        })

    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "avatar": user.avatar,
        "status": user.status,
        "badges": badges,
        "is_admin": user.is_admin,
        "created_at": user.created_at.isoformat()
        if user.created_at else None
    }


# =========================================================
# SCHEMAS
# =========================================================

class RegisterRequest(BaseModel):

    name: str
    email: EmailStr
    password: str


class LoginRequest(BaseModel):

    email: EmailStr
    password: str


class MessageRequest(BaseModel):

    text: str


class PrivateChatRequest(BaseModel):

    user_id: int


# =========================================================
# HEALTH
# =========================================================

@app.get("/api/health")
def health():

    return {
        "ok": True,
        "service": "goftino-api",
        "version": "1.0.0",
        "database": "postgresql",
        "time": datetime.now(
            timezone.utc
        ).isoformat()
    }


# =========================================================
# REGISTER
# =========================================================

@app.post("/api/auth/register")
def register(
    payload: RegisterRequest
):

    db = SessionLocal()

    try:

        name = payload.name.strip()
        email = str(
            payload.email
        ).strip().lower()

        password = payload.password

        if len(name) < 2:

            raise HTTPException(
                status_code=400,
                detail="نام معتبر نیست."
            )

        if len(name) > 50:

            raise HTTPException(
                status_code=400,
                detail="نام بیش از حد طولانی است."
            )

        if len(password) < 8:

            raise HTTPException(
                status_code=400,
                detail="رمز عبور باید حداقل ۸ کاراکتر باشد."
            )

        existing = (
            db.query(User)
            .filter(
                User.email == email
            )
            .first()
        )

        if existing:

            if existing.deleted_at:

                days = (
                    datetime.now(
                        timezone.utc
                    ) -
                    existing.deleted_at
                ).days

                if days < 3:

                    raise HTTPException(
                        status_code=400,
                        detail=(
                            "تا ۳ روز امکان ساخت حساب "
                            "با این ایمیل وجود ندارد."
                        )
                    )

            raise HTTPException(
                status_code=400,
                detail="این ایمیل قبلاً ثبت شده است."
            )

        user = User(
            name=name,
            email=email,
            password_hash=hash_password(
                password
            ),
            status="active"
        )

        db.add(user)

        db.commit()

        db.refresh(user)

        token = create_session(
            db,
            user.id
        )

        return {
            "ok": True,
            "token": token,
            "user": user_response(user)
        }

    finally:

        db.close()


# =========================================================
# LOGIN
# =========================================================

@app.post("/api/auth/login")
def login(
    payload: LoginRequest
):

    db = SessionLocal()

    try:

        email = str(
            payload.email
        ).strip().lower()

        user = (
            db.query(User)
            .filter(
                User.email == email
            )
            .first()
        )

        if not user:

            raise HTTPException(
                status_code=401,
                detail="ایمیل یا رمز عبور اشتباه است."
            )

        if user.deleted_at:

            raise HTTPException(
                status_code=403,
                detail="این حساب حذف شده است."
            )

        if not verify_password(
            payload.password,
            user.password_hash
        ):

            raise HTTPException(
                status_code=401,
                detail="ایمیل یا رمز عبور اشتباه است."
            )

        if user.status in (
            "suspended",
            "banned"
        ):

            raise HTTPException(
                status_code=403,
                detail="حساب کاربری شما محدود شده است."
            )

        token = create_session(
            db,
            user.id
        )

        return {
            "ok": True,
            "token": token,
            "user": user_response(user)
        }

    finally:

        db.close()


# =========================================================
# CURRENT USER
# =========================================================

@app.get("/api/auth/me")
def me(
    authorization: Optional[str] =
    Header(default=None)
):

    db = SessionLocal()

    try:

        user = get_current_user(
            db,
            authorization
        )

        return {
            "ok": True,
            "user": user_response(user)
        }

    finally:

        db.close()


# =========================================================
# LOGOUT
# =========================================================

@app.post("/api/auth/logout")
def logout(
    authorization: Optional[str] =
    Header(default=None)
):

    db = SessionLocal()

    try:

        if not authorization:
            return {
                "ok": True
            }

        if not authorization.startswith(
            "Bearer "
        ):
            return {
                "ok": True
            }

        token = authorization[
            7:
        ].strip()

        token_hash = hash_token(
            token
        )

        session = (
            db.query(SessionToken)
            .filter(
                SessionToken.token_hash ==
                token_hash
            )
            .first()
        )

        if session:

            db.delete(session)
            db.commit()

        return {
            "ok": True
        }

    finally:

        db.close()


# =========================================================
# DELETE ACCOUNT
# =========================================================

@app.delete("/api/auth/delete")
def delete_account(
    authorization: Optional[str] =
    Header(default=None)
):

    db = SessionLocal()

    try:

        user = get_current_user(
            db,
            authorization
        )

        now = datetime.now(
            timezone.utc
        )

        user.deleted_at = now

        user.status = "deleted"

        # اطلاعات ورود حذف می‌شود،
        # اما رکورد کاربر برای جلوگیری از
        # ساخت مجدد فوری با همان ایمیل باقی می‌ماند.

        user.name = "کاربر حذف‌شده"

        user.avatar = None

        db.query(SessionToken).filter(
            SessionToken.user_id ==
            user.id
        ).delete()

        db.commit()

        return {
            "ok": True,
            "message": "حساب کاربری حذف شد."
        }

    finally:

        db.close()


# =========================================================
# SEARCH USERS
# =========================================================

@app.get("/api/users/search")
def search_users(
    q: str = "",
    authorization: Optional[str] =
    Header(default=None)
):

    db = SessionLocal()

    try:

        current_user = get_current_user(
            db,
            authorization
        )

        query = q.strip()

        if not query:

            return {
                "ok": True,
                "users": []
            }

        pattern = f"%{query}%"

        users = (
            db.query(User)
            .filter(
                User.deleted_at.is_(None),
                User.id != current_user.id,
                or_(
                    User.name.ilike(pattern),
                    User.email.ilike(pattern)
                )
            )
            .limit(30)
            .all()
        )

        return {
            "ok": True,
            "users": [
                user_response(user)
                for user in users
            ]
        }

    finally:

        db.close()


# =========================================================
# PRIVATE CHAT FINDER
# =========================================================

def find_private_chat(
    db: Session,
    user_a: int,
    user_b: int
):

    chats = (
        db.query(Chat)
        .filter(
            Chat.chat_type == "private"
        )
        .all()
    )

    for chat in chats:

        members = (
            db.query(ChatMember)
            .filter(
                ChatMember.chat_id ==
                chat.id
            )
            .all()
        )

        ids = {
            member.user_id
            for member in members
        }

        if ids == {
            user_a,
            user_b
        }:

            return chat

    return None


# =========================================================
# CREATE PRIVATE CHAT
# =========================================================

@app.post("/api/chats/private")
def create_private_chat(
    payload: PrivateChatRequest,
    authorization: Optional[str] =
    Header(default=None)
):

    db = SessionLocal()

    try:

        current_user = get_current_user(
            db,
            authorization
        )

        if (
            payload.user_id ==
            current_user.id
        ):

            raise HTTPException(
                status_code=400,
                detail="نمی‌توانید با خودتان گفتگو بسازید."
            )

        target = (
            db.query(User)
            .filter(
                User.id ==
                payload.user_id,
                User.deleted_at.is_(None)
            )
            .first()
        )

        if not target:

            raise HTTPException(
                status_code=404,
                detail="کاربر پیدا نشد."
            )

        if target.status in (
            "suspended",
            "banned"
        ):

            raise HTTPException(
                status_code=403,
                detail="امکان شروع گفتگو با این کاربر وجود ندارد."
            )

        existing = find_private_chat(
            db,
            current_user.id,
            target.id
        )

        if existing:

            return {
                "ok": True,
                "chat": serialize_chat(
                    db,
                    existing,
                    current_user.id
                )
            }

        chat = Chat(
            chat_type="private"
        )

        db.add(chat)

        db.flush()

        db.add(
            ChatMember(
                chat_id=chat.id,
                user_id=current_user.id
            )
        )

        db.add(
            ChatMember(
                chat_id=chat.id,
                user_id=target.id
            )
        )

        db.commit()

        return {
            "ok": True,
            "chat": serialize_chat(
                db,
                chat,
                current_user.id
            )
        }

    finally:

        db.close()


# =========================================================
# CHAT SERIALIZER
# =========================================================

def serialize_chat(
    db: Session,
    chat: Chat,
    current_user_id: int
):

    members = (
        db.query(ChatMember)
        .filter(
            ChatMember.chat_id ==
            chat.id
        )
        .all()
    )

    other_user = None

    for member in members:

        if member.user_id != current_user_id:

            other_user = (
                db.query(User)
                .filter(
                    User.id ==
                    member.user_id
                )
                .first()
            )

            break

    last_message = (
        db.query(Message)
        .filter(
            Message.chat_id ==
            chat.id
        )
        .order_by(
            Message.created_at.desc()
        )
        .first()
    )

    return {
        "id": chat.id,
        "type": chat.chat_type,
        "name": (
            other_user.name
            if other_user
            else "گفتگو"
        ),
        "status": (
            other_user.status
            if other_user
            else "active"
        ),
        "last_message": (
            last_message.text
            if last_message
            else ""
        ),
        "updated_at": (
            last_message.created_at.isoformat()
            if last_message
            else chat.updated_at.isoformat()
        )
    }


# =========================================================
# GET CHATS
# =========================================================

@app.get("/api/chats")
def get_chats(
    type: str = "private",
    authorization: Optional[str] =
    Header(default=None)
):

    db = SessionLocal()

    try:

        current_user = get_current_user(
            db,
            authorization
        )

        memberships = (
            db.query(ChatMember)
            .filter(
                ChatMember.user_id ==
                current_user.id
            )
            .all()
        )

        result = []

        for membership in memberships:

            chat = (
                db.query(Chat)
                .filter(
                    Chat.id ==
                    membership.chat_id
                )
                .first()
            )

            if not chat:
                continue

            if chat.chat_type != type:
                continue

            result.append(
                serialize_chat(
                    db,
                    chat,
                    current_user.id
                )
            )

        result.sort(
            key=lambda item:
                item.get("updated_at", ""),
            reverse=True
        )

        return {
            "ok": True,
            "chats": result
        }

    finally:

        db.close()


# =========================================================
# CHECK CHAT ACCESS
# =========================================================

def user_is_chat_member(
    db: Session,
    chat_id: int,
    user_id: int
):

    return (
        db.query(ChatMember)
        .filter(
            ChatMember.chat_id ==
            chat_id,
            ChatMember.user_id ==
            user_id
        )
        .first()
        is not None
    )


# =========================================================
# GET MESSAGES
# =========================================================

@app.get("/api/chats/{chat_id}/messages")
def get_messages(
    chat_id: int,
    authorization: Optional[str] =
    Header(default=None)
):

    db = SessionLocal()

    try:

        current_user = get_current_user(
            db,
            authorization
        )

        if not user_is_chat_member(
            db,
            chat_id,
            current_user.id
        ):

            raise HTTPException(
                status_code=403,
                detail="شما عضو این گفتگو نیستید."
            )

        messages = (
            db.query(Message)
            .filter(
                Message.chat_id ==
                chat_id
            )
            .order_by(
                Message.created_at.asc()
            )
            .limit(500)
            .all()
        )

        # پیام‌هایی که طرف مقابل فرستاده
        # برای کاربر فعلی خوانده می‌شوند.

        (
            db.query(Message)
            .filter(
                Message.chat_id ==
                chat_id,
                Message.sender_id !=
                current_user.id,
                Message.is_read == False
            )
            .update(
                {
                    Message.is_read: True
                },
                synchronize_session=False
            )
        )

        db.commit()

        return {
            "ok": True,
            "messages": [
                {
                    "id": message.id,
                    "chat_id": message.chat_id,
                    "sender_id": message.sender_id,
                    "text": message.text,
                    "is_read": message.is_read,
                    "created_at":
                        message.created_at.isoformat()
                }
                for message in messages
            ]
        }

    finally:

        db.close()


# =========================================================
# SEND MESSAGE
# =========================================================

@app.post("/api/chats/{chat_id}/messages")
def send_message(
    chat_id: int,
    payload: MessageRequest,
    authorization: Optional[str] =
    Header(default=None)
):

    db = SessionLocal()

    try:

        current_user = get_current_user(
            db,
            authorization
        )

        if not user_is_chat_member(
            db,
            chat_id,
            current_user.id
        ):

            raise HTTPException(
                status_code=403,
                detail="شما عضو این گفتگو نیستید."
            )

        text = payload.text.strip()

        if not text:

            raise HTTPException(
                status_code=400,
                detail="پیام نمی‌تواند خالی باشد."
            )

        if len(text) > 5000:

            raise HTTPException(
                status_code=400,
                detail="پیام بیش از حد طولانی است."
            )

        message = Message(
            chat_id=chat_id,
            sender_id=current_user.id,
            text=text,
            is_read=False
        )

        db.add(message)

        chat = (
            db.query(Chat)
            .filter(
                Chat.id ==
                chat_id
            )
            .first()
        )

        if chat:

            chat.updated_at = datetime.now(
                timezone.utc
            )

        db.commit()

        db.refresh(message)

        return {
            "ok": True,
            "message": {
                "id": message.id,
                "chat_id": message.chat_id,
                "sender_id": message.sender_id,
                "text": message.text,
                "is_read": message.is_read,
                "created_at":
                    message.created_at.isoformat()
            }
        }

    finally:

        db.close()


# =========================================================
# ROOT
# =========================================================

@app.get("/")
def root():

    return {
        "service": "Goftino API",
        "version": "1.0.0",
        "status": "online"
    }


# =========================================================
# STARTUP
# =========================================================

@app.on_event("startup")
def startup():

    print("=" * 50)
    print("GOFTINO API STARTED")
    print("Database: PostgreSQL")
    print("Version: 1.0.0")
    print("=" * 50)
