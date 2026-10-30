from fastapi import APIRouter, Depends, HTTPException
from ..core import db, require_roles, profile_of, new_id, now_iso, log_event
from ..schemas import RequestInput, FeedbackInput

router = APIRouter(prefix="/students", tags=["students"])


async def current_student(user: dict = Depends(require_roles("student"))) -> dict:
    return await profile_of(user)


@router.get("/me")
async def get_me(student: dict = Depends(current_student), user: dict = Depends(require_roles("student"))):
    institution = await db.institutions.find_one({"id": student["institution_id"]}, {"_id": 0})
    return {"student": student, "name": user["name"], "institution": institution}


@router.get("/me/professionals")
async def available_professionals(student: dict = Depends(current_student)):
    pros = await db.professionals.find({"institution_id": student["institution_id"]}, {"_id": 0}).to_list(100)
    out = []
    for p in pros:
        u = await db.users.find_one({"id": p["user_id"]}, {"_id": 0})
        if not u or not u.get("active", True):
            continue
        slots = await db.availability.find(
            {"professional_id": p["id"], "status": "open"}, {"_id": 0}
        ).sort([("date", 1), ("time", 1)]).to_list(100)
        out.append({
            "id": p["id"], "name": u["name"], "specialty": p.get("specialty"),
            "link_type": p.get("link_type"), "slots": slots,
        })
    return out


@router.post("/me/requests", status_code=201)
async def create_request(payload: RequestInput, student: dict = Depends(current_student),
                         user: dict = Depends(require_roles("student"))):
    slot = await db.availability.find_one({"id": payload.availability_id}, {"_id": 0})
    if not slot or slot["institution_id"] != student["institution_id"]:
        raise HTTPException(status_code=404, detail="Horário não encontrado")
    reserved = await db.availability.update_one(
        {"id": slot["id"], "status": "open"}, {"$set": {"status": "reserved"}}
    )
    if reserved.modified_count == 0:
        raise HTTPException(status_code=409, detail="Este horário acabou de ser reservado. Escolha outro.")
    request_doc = {
        "id": new_id(), "student_id": student["id"], "professional_id": slot["professional_id"],
        "institution_id": student["institution_id"], "availability_id": slot["id"],
        "date": slot["date"], "time": slot["time"], "reason_code": payload.reason_code,
        "reason_note": payload.reason_note, "status": "pending", "created_at": now_iso(),
    }
    await db.requests.insert_one(dict(request_doc))
    await log_event("request_created", user, student["institution_id"], {"reason_code": payload.reason_code})
    return request_doc


@router.get("/me/requests")
async def my_requests(student: dict = Depends(current_student)):
    requests = await db.requests.find({"student_id": student["id"]}, {"_id": 0}).sort([("date", 1), ("time", 1)]).to_list(200)
    out = []
    for r in requests:
        pro = await db.professionals.find_one({"id": r["professional_id"]}, {"_id": 0})
        pro_user = await db.users.find_one({"id": (pro or {}).get("user_id")}, {"_id": 0}) if pro else None
        session = await db.sessions.find_one({"request_id": r["id"]}, {"_id": 0})
        referral = await db.referrals.find_one({"session_id": (session or {}).get("id")}, {"_id": 0}) if session else None
        feedback = await db.feedback.find_one({"session_id": (session or {}).get("id")}, {"_id": 0}) if session else None
        out.append({**r, "professional_name": (pro_user or {}).get("name", "Profissional"),
                    "session": session, "referral": referral, "feedback": feedback})
    return out


@router.post("/me/requests/{request_id}/cancel")
async def cancel_request(request_id: str, student: dict = Depends(current_student),
                         user: dict = Depends(require_roles("student"))):
    r = await db.requests.find_one({"id": request_id, "student_id": student["id"]}, {"_id": 0})
    if not r:
        raise HTTPException(status_code=404, detail="Solicitação não encontrada")
    if r["status"] not in ("pending", "accepted"):
        raise HTTPException(status_code=409, detail="Esta solicitação não pode mais ser cancelada")
    cancelled = await db.requests.update_one(
        {"id": request_id, "student_id": student["id"], "status": {"$in": ["pending", "accepted"]}},
        {"$set": {"status": "cancelled"}},
    )
    if cancelled.modified_count == 0:
        raise HTTPException(status_code=409, detail="Esta solicitação não pode mais ser cancelada")
    # Libera o horário apenas se ele ainda estiver reservado por esta solicitação.
    await db.availability.update_one(
        {"id": r["availability_id"], "status": "reserved"}, {"$set": {"status": "open"}}
    )
    await db.sessions.delete_many({"request_id": request_id, "status": "scheduled"})
    await log_event("request_cancelled", user, student["institution_id"], {"request_id": request_id})
    return {"ok": True}


@router.post("/me/sessions/{session_id}/feedback", status_code=201)
async def send_feedback(session_id: str, payload: FeedbackInput, student: dict = Depends(current_student),
                        user: dict = Depends(require_roles("student"))):
    s = await db.sessions.find_one({"id": session_id, "student_id": student["id"]}, {"_id": 0})
    if not s:
        raise HTTPException(status_code=404, detail="Conversa não encontrada")
    if s["status"] != "completed":
        raise HTTPException(status_code=409, detail="Feedback disponível após a conversa")
    doc = {
        "id": new_id(), "session_id": session_id, "student_id": student["id"],
        "institution_id": student["institution_id"], "score": payload.score,
        "comment": payload.comment, "created_at": now_iso(),
    }
    await db.feedback.update_one({"session_id": session_id}, {"$set": doc}, upsert=True)
    await log_event("feedback_submitted", user, student["institution_id"], {"score": payload.score})
    return doc
