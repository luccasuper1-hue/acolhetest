import asyncio
import os
from datetime import datetime
from types import SimpleNamespace

import pytest
from fastapi import HTTPException, Response

# app.core reads these values while importing the router. No MongoDB
# connection is made in these unit tests; the database collections are faked.
os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "acolhe_unit_test")
os.environ.setdefault("JWT_SECRET", "unit-test-secret")

from app.routers import auth
from app.schemas import InviteAccept, ResetPassword


class _ResetTokens:
    def __init__(self):
        self.claimed = False
        self.query = None

    async def find_one_and_update(self, query, update, projection):
        self.query = query
        if self.claimed:
            return None
        self.claimed = True
        return {"user_id": "user-1"}


class _Users:
    def __init__(self):
        self.update = None

    async def update_one(self, query, update):
        self.update = (query, update)


class _Database:
    def __init__(self):
        self.password_reset_tokens = _ResetTokens()
        self.users = _Users()


def test_reset_token_is_claimed_once(monkeypatch):
    database = _Database()
    monkeypatch.setattr(auth, "db", database)
    monkeypatch.setattr(auth, "hash_password", lambda password: f"hash:{password}")
    payload = ResetPassword(token="valid-reset-token", password="nova-senha")

    assert asyncio.run(auth.reset_password(payload)) == {"ok": True}
    assert database.password_reset_tokens.query["used"] is False
    assert datetime.fromisoformat(database.password_reset_tokens.query["expires_at"]["$gt"])
    assert database.users.update == ({"id": "user-1"}, {"$set": {"password_hash": "hash:nova-senha"}})

    with pytest.raises(HTTPException) as exc:
        asyncio.run(auth.reset_password(payload))
    assert exc.value.status_code == 400


class _InviteUsers:
    def __init__(self, modified_count):
        self.modified_count = modified_count
        self.update_query = None

    async def find_one(self, query):
        assert query == {"invite_token": "invite-token"}
        return {
            "id": "user-1", "name": "Profissional", "email": "pro@example.com",
            "role": "professional", "institution_id": "institution-1", "active": False,
        }

    async def update_one(self, query, update):
        self.update_query = query
        return SimpleNamespace(modified_count=self.modified_count)


class _InviteDatabase:
    def __init__(self, modified_count):
        self.users = _InviteUsers(modified_count)


def test_invite_is_claimed_when_password_is_set(monkeypatch):
    database = _InviteDatabase(modified_count=1)

    async def no_event(*_args, **_kwargs):
        return None

    monkeypatch.setattr(auth, "db", database)
    monkeypatch.setattr(auth, "hash_password", lambda password: f"hash:{password}")
    monkeypatch.setattr(auth, "create_access_token", lambda *_args: "access-token")
    monkeypatch.setattr(auth, "log_event", no_event)
    payload = InviteAccept(password="nova-senha")

    result = asyncio.run(auth.accept_invite("invite-token", payload, Response()))

    assert result["access_token"] == "access-token"
    assert database.users.update_query == {"id": "user-1", "invite_token": "invite-token"}


def test_used_invite_cannot_be_accepted_again(monkeypatch):
    database = _InviteDatabase(modified_count=0)
    monkeypatch.setattr(auth, "db", database)
    monkeypatch.setattr(auth, "hash_password", lambda password: f"hash:{password}")
    payload = InviteAccept(password="nova-senha")

    with pytest.raises(HTTPException) as exc:
        asyncio.run(auth.accept_invite("invite-token", payload, Response()))
    assert exc.value.status_code == 404
