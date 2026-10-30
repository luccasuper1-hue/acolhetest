import os
from .core import db, hash_password, new_id, now_iso

PILOT_CODE = "PILOTO2026"


async def ensure_user(email: str, name: str, password: str, role: str, institution_id: str | None):
    existing = await db.users.find_one({"email": email})
    if existing:
        return existing["id"]
    user_id = new_id()
    await db.users.insert_one({
        "id": user_id, "name": name, "email": email, "password_hash": hash_password(password),
        "role": role, "institution_id": institution_id, "active": True, "created_at": now_iso(),
    })
    return user_id


async def seed():
    await db.users.create_index("email", unique=True)
    await db.availability.create_index([("professional_id", 1), ("date", 1), ("time", 1)], unique=True)
    await db.sessions.create_index("request_id", unique=True)
    await db.login_attempts.create_index("identifier", unique=True)
    await db.password_reset_tokens.create_index("token", unique=True)

    admin_email = os.environ.get("ADMIN_EMAIL")
    admin_password = os.environ.get("ADMIN_PASSWORD")
    if bool(admin_email) != bool(admin_password):
        raise RuntimeError("ADMIN_EMAIL and ADMIN_PASSWORD must be set together")
    if admin_email:
        await ensure_user(admin_email.lower(), "Administração Acolhe", admin_password, "admin", None)

    if os.environ.get("SEED_DEMO_DATA", "false").lower() != "true":
        return
    if os.environ.get("APP_ENV", "development").lower() == "production":
        raise RuntimeError("SEED_DEMO_DATA is not allowed in production")
    demo_password = os.environ.get("DEMO_PASSWORD", "")
    if len(demo_password) < 12:
        raise RuntimeError("DEMO_PASSWORD must contain at least 12 characters when demo seeding is enabled")

    institution = await db.institutions.find_one({"code": PILOT_CODE}, {"_id": 0})
    if not institution:
        institution = {
            "id": new_id(), "name": "Colégio Piloto Acolhe", "code": PILOT_CODE,
            "contact_email": "coordenacao@piloto.edu.br", "plan": "piloto",
            "support_note": "Piloto Acolhe · acesso complementar ao apoio estudantil.",
            "created_at": now_iso(),
        }
        await db.institutions.insert_one(dict(institution))

    await ensure_user("instituicao@piloto.edu.br", "Coordenação Piloto", demo_password, "institution", institution["id"])

    pro_user_id = await ensure_user("profissional@piloto.edu.br", "Marina Alves", demo_password, "professional", institution["id"])
    if not await db.professionals.find_one({"user_id": pro_user_id}):
        await db.professionals.insert_one({
            "id": new_id(), "user_id": pro_user_id, "institution_id": institution["id"],
            "link_type": "institution", "specialty": "Escuta inicial e orientação",
            "created_at": now_iso(), "last_access": None,
        })

    student_user_id = await ensure_user("estudante@piloto.edu.br", "Ana Estudante", demo_password, "student", institution["id"])
    if not await db.students.find_one({"user_id": student_user_id}):
        await db.students.insert_one({
            "id": new_id(), "user_id": student_user_id, "institution_id": institution["id"],
            "created_at": now_iso(), "last_access": None,
        })
