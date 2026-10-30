import os
import uuid
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException, Request, Depends
from motor.motor_asyncio import AsyncIOMotorClient

JWT_ALGORITHM = "HS256"
ROLES = ("student", "professional", "institution", "admin")
LOGIN_MAX_ATTEMPTS = 5
LOGIN_LOCK_MINUTES = 15
ACTIVE_WINDOW_DAYS = 30

client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]


def new_id() -> str:
    return str(uuid.uuid4())


def now() -> datetime:
    return datetime.now(timezone.utc)


def now_iso() -> str:
    return now().isoformat()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "type": "access",
        "exp": now() + timedelta(days=7),
    }
    return jwt.encode(payload, os.environ["JWT_SECRET"], algorithm=JWT_ALGORITHM)


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        header = request.headers.get("Authorization", "")
        if header.startswith("Bearer "):
            token = header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Não autenticado")
    try:
        payload = jwt.decode(token, os.environ["JWT_SECRET"], algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Sessão expirada")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")
    user = await db.users.find_one({"id": payload.get("sub")}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Usuário não encontrado")
    if not user.get("active", True):
        raise HTTPException(status_code=403, detail="Acesso desativado")
    user.pop("password_hash", None)
    return user


def require_roles(*roles):
    async def dep(user: dict = Depends(get_current_user)) -> dict:
        if user["role"] not in roles:
            raise HTTPException(status_code=403, detail="Perfil sem permissão para esta operação")
        return user

    return dep


async def log_event(event_type: str, user: dict | None = None, institution_id: str | None = None, meta: dict | None = None):
    await db.events.insert_one({
        "id": new_id(),
        "type": event_type,
        "user_id": (user or {}).get("id"),
        "role": (user or {}).get("role"),
        "institution_id": institution_id or (user or {}).get("institution_id"),
        "meta": meta or {},
        "created_at": now_iso(),
    })


async def profile_of(user: dict) -> dict:
    """Student/professional profile document linked to the user."""
    collection = "students" if user["role"] == "student" else "professionals"
    doc = await db[collection].find_one({"user_id": user["id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Perfil não encontrado")
    return doc


def set_auth_cookie(response, token: str):
    response.set_cookie(
        key="access_token", value=token, httponly=True, secure=True,
        samesite="none", max_age=604800, path="/",
    )


def login_identifier(request, email: str) -> str:
    """Atrás do ingress o IP do cliente varia entre réplicas: o e-mail normalizado é o identificador estável."""
    return email.lower().strip()


async def check_login_lock(identifier: str):
    doc = await db.login_attempts.find_one({"identifier": identifier}, {"_id": 0})
    if not doc:
        return
    locked_until = doc.get("locked_until")
    if locked_until and datetime.fromisoformat(locked_until) > now():
        raise HTTPException(status_code=429, detail="Muitas tentativas. Tente novamente em alguns minutos.")


async def register_failed_login(identifier: str):
    doc = await db.login_attempts.find_one({"identifier": identifier}, {"_id": 0}) or {"count": 0}
    count = doc.get("count", 0) + 1
    patch = {"identifier": identifier, "count": count, "updated_at": now_iso()}
    if count >= LOGIN_MAX_ATTEMPTS:
        patch["locked_until"] = (now() + timedelta(minutes=LOGIN_LOCK_MINUTES)).isoformat()
        patch["count"] = 0
    await db.login_attempts.update_one({"identifier": identifier}, {"$set": patch}, upsert=True)


async def clear_login_attempts(identifier: str):
    await db.login_attempts.delete_one({"identifier": identifier})
