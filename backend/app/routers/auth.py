import logging
import asyncio
import os
import secrets
from datetime import timedelta
from fastapi import APIRouter, HTTPException, Request, Response, Depends
from ..core import (
    db, hash_password, verify_password, create_access_token, new_id, now, now_iso,
    get_current_user, log_event, set_auth_cookie, check_login_lock, register_failed_login,
    clear_login_attempts, login_identifier,
)
from ..schemas import RegisterStudent, LoginInput, InviteAccept, ForgotPassword, ResetPassword
from ..mailer import reset_mail_configured, send_reset_email

router = APIRouter(prefix="/auth", tags=["auth"])
logger = logging.getLogger(__name__)


def public_user(user: dict) -> dict:
    return {k: user.get(k) for k in ("id", "name", "email", "role", "institution_id", "active")}


@router.post("/register")
async def register_student(payload: RegisterStudent, response: Response):
    if not payload.consent:
        raise HTTPException(status_code=422, detail="É necessário aceitar os termos de uso do piloto")
    email = payload.email.lower().strip()
    institution = await db.institutions.find_one({"code": payload.institution_code.upper().strip()}, {"_id": 0})
    if not institution:
        raise HTTPException(status_code=404, detail="Código de instituição não encontrado")
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=409, detail="Este e-mail já possui conta")
    user = {
        "id": new_id(), "name": payload.name.strip(), "email": email,
        "password_hash": hash_password(payload.password), "role": "student",
        "institution_id": institution["id"], "active": True,
        "consent_accepted_at": now_iso(), "created_at": now_iso(),
    }
    await db.users.insert_one(dict(user))
    await db.students.insert_one({
        "id": new_id(), "user_id": user["id"], "institution_id": institution["id"],
        "created_at": now_iso(), "last_access": None,
    })
    await log_event("student_registered", user, institution["id"])
    token = create_access_token(user["id"], email, "student")
    set_auth_cookie(response, token)
    return {"user": public_user(user), "access_token": token, "institution": institution["name"]}


@router.post("/login")
async def login(payload: LoginInput, request: Request, response: Response):
    email = payload.email.lower().strip()
    identifier = login_identifier(request, email)
    await check_login_lock(identifier)
    user = await db.users.find_one({"email": email})
    if user and not user.get("password_hash"):
        raise HTTPException(status_code=403, detail="Convite pendente. Defina sua senha pelo link recebido da instituição.")
    if not user or not verify_password(payload.password, user["password_hash"]):
        await register_failed_login(identifier)
        raise HTTPException(status_code=401, detail="E-mail ou senha inválidos")
    if not user.get("active", True):
        raise HTTPException(status_code=403, detail="Acesso desativado. Fale com a instituição.")
    await clear_login_attempts(identifier)
    if user["role"] == "student":
        await db.students.update_one({"user_id": user["id"]}, {"$set": {"last_access": now_iso()}})
    if user["role"] == "professional":
        await db.professionals.update_one({"user_id": user["id"]}, {"$set": {"last_access": now_iso()}})
    await log_event("access", user, user.get("institution_id"))
    token = create_access_token(user["id"], email, user["role"])
    set_auth_cookie(response, token)
    return {"user": public_user(user), "access_token": token}


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}


@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    institution = None
    if user.get("institution_id"):
        institution = await db.institutions.find_one({"id": user["institution_id"]}, {"_id": 0})
    return {"user": public_user(user), "institution": institution}


# ---------------------------------------------------------------- convites
@router.get("/invite/{token}")
async def read_invite(token: str):
    user = await db.users.find_one({"invite_token": token}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Convite inválido ou já utilizado")
    if user.get("invite_expires_at") and user["invite_expires_at"] < now_iso():
        raise HTTPException(status_code=410, detail="Convite expirado. Peça um novo à instituição.")
    institution = await db.institutions.find_one({"id": user.get("institution_id")}, {"_id": 0})
    return {"name": user["name"], "email": user["email"], "role": user["role"],
            "institution": (institution or {}).get("name")}


@router.post("/invite/{token}/accept")
async def accept_invite(token: str, payload: InviteAccept, response: Response):
    user = await db.users.find_one({"invite_token": token})
    if not user:
        raise HTTPException(status_code=404, detail="Convite inválido ou já utilizado")
    if user.get("invite_expires_at") and user["invite_expires_at"] < now_iso():
        raise HTTPException(status_code=410, detail="Convite expirado. Peça um novo à instituição.")
    # Claim the invite in the same write that consumes it. Without the token
    # in this filter, two simultaneous requests could both set a password.
    result = await db.users.update_one({"id": user["id"], "invite_token": token}, {
        "$set": {"password_hash": hash_password(payload.password), "active": True, "consent_accepted_at": now_iso()},
        "$unset": {"invite_token": "", "invite_expires_at": ""},
    })
    if result.modified_count != 1:
        raise HTTPException(status_code=404, detail="Convite inválido ou já utilizado")
    await log_event("invite_accepted", user, user.get("institution_id"))
    access = create_access_token(user["id"], user["email"], user["role"])
    set_auth_cookie(response, access)
    return {"user": public_user({**user, "active": True}), "access_token": access}


# ---------------------------------------------------------------- senha
@router.post("/forgot-password")
async def forgot_password(payload: ForgotPassword):
    pilot_reset = (os.environ.get("PILOT_RETURN_RESET_TOKEN", "false").lower() == "true"
                   and os.environ.get("APP_ENV", "development").lower() != "production")
    if not pilot_reset and not reset_mail_configured():
        raise HTTPException(status_code=503, detail="Recuperação de senha indisponível. Fale com a operação do Acolhe.")
    email = payload.email.lower().strip()
    user = await db.users.find_one({"email": email}, {"_id": 0})
    generic = {"ok": True, "message": "Se o e-mail existir, as instruções de redefinição serão enviadas."}
    if not user:
        return generic
    token = secrets.token_urlsafe(32)
    await db.password_reset_tokens.insert_one({
        "id": new_id(), "user_id": user["id"], "token": token,
        "expires_at": (now() + timedelta(hours=1)).isoformat(), "used": False, "created_at": now_iso(),
    })
    if pilot_reset:
        return {**generic, "reset_token": token, "pilot_note": "PROVISÓRIO PARA PILOTO: envio por e-mail é P1."}
    try:
        await asyncio.to_thread(send_reset_email, email, token)
    except Exception:
        logger.exception("Falha ao enviar e-mail de redefinição")
        return generic
    return generic


@router.post("/reset-password")
async def reset_password(payload: ResetPassword):
    # Consume the reset token atomically. A separate read followed by an
    # update lets concurrent requests reuse the same supposedly one-use link.
    doc = await db.password_reset_tokens.find_one_and_update(
        {"token": payload.token, "used": False, "expires_at": {"$gt": now_iso()}},
        {"$set": {"used": True}},
        projection={"_id": 0},
    )
    if not doc:
        raise HTTPException(status_code=400, detail="Link inválido ou expirado")
    await db.users.update_one({"id": doc["user_id"]}, {"$set": {"password_hash": hash_password(payload.password)}})
    return {"ok": True}
