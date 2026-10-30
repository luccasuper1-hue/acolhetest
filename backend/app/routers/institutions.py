import secrets
from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException
from ..core import db, require_roles, new_id, now, now_iso, log_event
from ..schemas import InstitutionUpdate, ProfessionalInvite
from .metrics import institution_metrics

router = APIRouter(prefix="/institutions", tags=["institutions"])


async def current_institution(user: dict = Depends(require_roles("institution"))) -> dict:
    institution = await db.institutions.find_one({"id": user.get("institution_id")}, {"_id": 0})
    if not institution:
        raise HTTPException(status_code=404, detail="Instituição não vinculada")
    return institution


@router.get("/me")
async def get_me(institution: dict = Depends(current_institution)):
    return institution


@router.put("/me")
async def update_me(payload: InstitutionUpdate, institution: dict = Depends(current_institution)):
    patch = {k: v for k, v in payload.model_dump().items() if v is not None}
    if patch:
        await db.institutions.update_one({"id": institution["id"]}, {"$set": patch})
    return await db.institutions.find_one({"id": institution["id"]}, {"_id": 0})


@router.get("/me/students")
async def list_students(institution: dict = Depends(current_institution)):
    students = await db.students.find({"institution_id": institution["id"]}, {"_id": 0}).to_list(500)
    out = []
    for s in students:
        u = await db.users.find_one({"id": s["user_id"]}, {"_id": 0, "password_hash": 0})
        requests_count = await db.requests.count_documents({"student_id": s["id"]})
        out.append({
            "id": s["id"], "name": u["name"] if u else "—", "active": (u or {}).get("active", True),
            "last_access": s.get("last_access"), "requests": requests_count,
        })
    return out


@router.get("/me/professionals")
async def list_professionals(institution: dict = Depends(current_institution)):
    pros = await db.professionals.find({"institution_id": institution["id"]}, {"_id": 0}).to_list(200)
    out = []
    for p in pros:
        u = await db.users.find_one({"id": p["user_id"]}, {"_id": 0, "password_hash": 0})
        slots = await db.availability.count_documents({"professional_id": p["id"], "status": "open"})
        sessions = await db.sessions.count_documents({"professional_id": p["id"], "status": "completed"})
        out.append({
            "id": p["id"], "name": (u or {}).get("name", "—"), "email": (u or {}).get("email"),
            "active": (u or {}).get("active", True), "link_type": p.get("link_type"),
            "specialty": p.get("specialty"), "open_slots": slots, "completed_sessions": sessions,
            "invite_pending": bool((u or {}).get("invite_token")),
            "invite_path": f"/convite/{u['invite_token']}" if (u or {}).get("invite_token") else None,
            "last_access": p.get("last_access"),
        })
    return out


@router.post("/me/professionals", status_code=201)
async def invite_professional(payload: ProfessionalInvite, institution: dict = Depends(current_institution),
                              user: dict = Depends(require_roles("institution"))):
    email = payload.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=409, detail="Este e-mail já possui conta")
    invite_token = secrets.token_urlsafe(24)
    pro_user = {
        "id": new_id(), "name": payload.name.strip(), "email": email,
        "password_hash": "", "role": "professional",
        "institution_id": institution["id"], "active": False,
        "invite_token": invite_token,
        "invite_expires_at": (now() + timedelta(days=14)).isoformat(),
        "created_at": now_iso(),
    }
    await db.users.insert_one(dict(pro_user))
    professional = {
        "id": new_id(), "user_id": pro_user["id"], "institution_id": institution["id"],
        "link_type": payload.link_type, "specialty": payload.specialty,
        "created_at": now_iso(), "last_access": None,
    }
    await db.professionals.insert_one(dict(professional))
    await log_event("professional_invited", user, institution["id"], {"professional_id": professional["id"]})
    return {
        "id": professional["id"], "name": pro_user["name"], "email": email,
        "link_type": payload.link_type, "invite_path": f"/convite/{invite_token}",
        "note": "O profissional define a própria senha ao abrir o convite.",
    }


@router.get("/me/metrics")
async def metrics(institution: dict = Depends(current_institution)):
    return await institution_metrics(institution["id"])
