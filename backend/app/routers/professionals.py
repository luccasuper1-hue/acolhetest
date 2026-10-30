from fastapi import APIRouter, Depends, HTTPException
from pymongo.errors import DuplicateKeyError
from ..core import db, require_roles, profile_of, new_id, now_iso, log_event
from ..schemas import AvailabilityInput, RoomLinkInput, ReferralInput

router = APIRouter(prefix="/professionals", tags=["professionals"])


async def current_professional(user: dict = Depends(require_roles("professional"))) -> dict:
    return await profile_of(user)


@router.get("/me")
async def get_me(pro: dict = Depends(current_professional), user: dict = Depends(require_roles("professional"))):
    institution = await db.institutions.find_one({"id": pro["institution_id"]}, {"_id": 0})
    return {"professional": pro, "name": user["name"], "institution": institution}


@router.get("/me/availability")
async def list_availability(pro: dict = Depends(current_professional)):
    return await db.availability.find({"professional_id": pro["id"]}, {"_id": 0}).sort([("date", 1), ("time", 1)]).to_list(500)


@router.post("/me/availability", status_code=201)
async def add_availability(payload: AvailabilityInput, pro: dict = Depends(current_professional),
                           user: dict = Depends(require_roles("professional"))):
    created = []
    for time in payload.times:
        slot = {
            "id": new_id(), "professional_id": pro["id"], "institution_id": pro["institution_id"],
            "date": payload.date, "time": time, "status": "open", "created_at": now_iso(),
        }
        try:
            await db.availability.insert_one(dict(slot))
        except DuplicateKeyError:
            continue  # horário já publicado
        created.append(slot)
    await log_event("availability_created", user, pro["institution_id"], {"count": len(created)})
    return created


@router.delete("/me/availability/{slot_id}")
async def remove_availability(slot_id: str, pro: dict = Depends(current_professional)):
    slot = await db.availability.find_one({"id": slot_id, "professional_id": pro["id"]}, {"_id": 0})
    if not slot:
        raise HTTPException(status_code=404, detail="Horário não encontrado")
    if slot["status"] == "reserved":
        raise HTTPException(status_code=409, detail="Horário reservado por um estudante")
    await db.availability.delete_one({"id": slot_id})
    return {"ok": True}


async def _hydrate_request(r: dict) -> dict:
    session = await db.sessions.find_one({"request_id": r["id"]}, {"_id": 0})
    return {
        "id": r["id"], "date": r["date"], "time": r["time"], "status": r["status"],
        "reason_code": r["reason_code"], "reason_note": r.get("reason_note"),
        "room_link": r.get("room_link"), "created_at": r["created_at"],
        "session": session,
    }


@router.get("/me/requests")
async def list_requests(pro: dict = Depends(current_professional)):
    requests = await db.requests.find({"professional_id": pro["id"]}, {"_id": 0}).sort([("date", 1), ("time", 1)]).to_list(500)
    return [await _hydrate_request(r) for r in requests]


@router.post("/me/requests/{request_id}/accept")
async def accept_request(request_id: str, pro: dict = Depends(current_professional),
                         user: dict = Depends(require_roles("professional"))):
    r = await db.requests.find_one({"id": request_id, "professional_id": pro["id"]}, {"_id": 0})
    if not r:
        raise HTTPException(status_code=404, detail="Solicitação não encontrada")
    # aceite atômico: só transiciona pending -> accepted uma única vez
    claimed = await db.requests.update_one(
        {"id": request_id, "professional_id": pro["id"], "status": "pending"},
        {"$set": {"status": "accepted"}},
    )
    if claimed.modified_count == 0:
        raise HTTPException(status_code=409, detail="Solicitação já tratada")
    session = {
        "id": new_id(), "request_id": request_id, "student_id": r["student_id"],
        "professional_id": pro["id"], "institution_id": pro["institution_id"],
        "date": r["date"], "time": r["time"], "status": "scheduled", "created_at": now_iso(),
    }
    await db.sessions.insert_one(dict(session))
    await log_event("request_accepted", user, pro["institution_id"], {"request_id": request_id})
    return session


@router.post("/me/requests/{request_id}/decline")
async def decline_request(request_id: str, pro: dict = Depends(current_professional),
                          user: dict = Depends(require_roles("professional"))):
    r = await db.requests.find_one({"id": request_id, "professional_id": pro["id"]}, {"_id": 0})
    if not r:
        raise HTTPException(status_code=404, detail="Solicitação não encontrada")
    claimed = await db.requests.update_one(
        {"id": request_id, "professional_id": pro["id"], "status": "pending"},
        {"$set": {"status": "declined"}},
    )
    if claimed.modified_count == 0:
        raise HTTPException(status_code=409, detail="Solicitação já tratada")
    await db.availability.update_one({"id": r["availability_id"]}, {"$set": {"status": "open"}})
    await log_event("request_declined", user, pro["institution_id"], {"request_id": request_id})
    return {"ok": True}


@router.post("/me/requests/{request_id}/room-link")
async def set_room_link(request_id: str, payload: RoomLinkInput, pro: dict = Depends(current_professional)):
    r = await db.requests.find_one({"id": request_id, "professional_id": pro["id"]}, {"_id": 0})
    if not r:
        raise HTTPException(status_code=404, detail="Solicitação não encontrada")
    if r["status"] != "accepted":
        raise HTTPException(status_code=409, detail="Só é possível definir a sala de uma conversa confirmada")
    session = await db.sessions.find_one({"request_id": request_id}, {"_id": 0})
    if session and session["status"] == "completed":
        raise HTTPException(status_code=409, detail="Conversa já concluída")
    if not payload.room_link.startswith(("http://", "https://")):
        raise HTTPException(status_code=422, detail="Informe um link válido (https://...)")
    await db.requests.update_one({"id": request_id}, {"$set": {"room_link": payload.room_link}})
    return {"ok": True, "room_link": payload.room_link}


@router.get("/me/sessions")
async def list_sessions(pro: dict = Depends(current_professional)):
    sessions = await db.sessions.find({"professional_id": pro["id"]}, {"_id": 0}).sort([("date", 1), ("time", 1)]).to_list(500)
    out = []
    for s in sessions:
        r = await db.requests.find_one({"id": s["request_id"]}, {"_id": 0})
        referral = await db.referrals.find_one({"session_id": s["id"]}, {"_id": 0})
        out.append({**s, "reason_code": (r or {}).get("reason_code"), "reason_note": (r or {}).get("reason_note"),
                    "room_link": (r or {}).get("room_link"), "referral": referral})
    return out


@router.post("/me/sessions/{session_id}/complete")
async def complete_session(session_id: str, pro: dict = Depends(current_professional),
                           user: dict = Depends(require_roles("professional"))):
    s = await db.sessions.find_one({"id": session_id, "professional_id": pro["id"]}, {"_id": 0})
    if not s:
        raise HTTPException(status_code=404, detail="Conversa não encontrada")
    if s["status"] == "completed":
        raise HTTPException(status_code=409, detail="Conversa já concluída")
    await db.sessions.update_one({"id": session_id}, {"$set": {"status": "completed", "completed_at": now_iso()}})
    await db.requests.update_one({"id": s["request_id"]}, {"$set": {"status": "completed"}})
    await log_event("session_completed", user, pro["institution_id"], {"session_id": session_id})
    return {"ok": True}


@router.post("/me/sessions/{session_id}/referral", status_code=201)
async def create_referral(session_id: str, payload: ReferralInput, pro: dict = Depends(current_professional),
                          user: dict = Depends(require_roles("professional"))):
    s = await db.sessions.find_one({"id": session_id, "professional_id": pro["id"]}, {"_id": 0})
    if not s:
        raise HTTPException(status_code=404, detail="Conversa não encontrada")
    referral = {
        "id": new_id(), "session_id": session_id, "institution_id": pro["institution_id"],
        "status": payload.status, "note": payload.note, "created_at": now_iso(),
    }
    await db.referrals.update_one({"session_id": session_id}, {"$set": referral}, upsert=True)
    await log_event("referral_registered", user, pro["institution_id"], {"status": payload.status})
    return referral
