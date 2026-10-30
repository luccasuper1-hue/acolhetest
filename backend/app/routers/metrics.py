from collections import Counter
from datetime import timedelta
from fastapi import APIRouter, Depends
from ..core import db, require_roles, now, ACTIVE_WINDOW_DAYS

router = APIRouter(prefix="/metrics", tags=["metrics"])


def _is_active(last_access: str | None) -> bool:
    if not last_access:
        return False
    return last_access >= (now() - timedelta(days=ACTIVE_WINDOW_DAYS)).isoformat()


async def institution_metrics(institution_id: str) -> dict:
    students = await db.students.find({"institution_id": institution_id}, {"_id": 0}).to_list(1000)
    professionals = await db.professionals.find({"institution_id": institution_id}, {"_id": 0}).to_list(200)
    requests = await db.requests.find({"institution_id": institution_id}, {"_id": 0}).to_list(2000)
    sessions = await db.sessions.find({"institution_id": institution_id}, {"_id": 0}).to_list(2000)
    referrals = await db.referrals.find({"session_id": {"$in": [s["id"] for s in sessions]}}, {"_id": 0}).to_list(2000)
    feedback = await db.feedback.find({"institution_id": institution_id}, {"_id": 0, "score": 1}).to_list(2000)
    requesting_students = {r["student_id"] for r in requests}
    by_month = Counter(r["created_at"][:7] for r in requests if r.get("created_at"))
    scores = [f["score"] for f in feedback if f.get("score")]
    pro_ids_with_slots = await db.availability.distinct("professional_id", {"institution_id": institution_id})
    return {
        # cadastro ≠ acesso ≠ atividade
        "students_registered": len(students),
        "students_accessed": len([s for s in students if s.get("last_access")]),
        "students_active_30d": len([s for s in students if _is_active(s.get("last_access"))]),
        "students_requested": len(requesting_students),
        "requests_total": len(requests),
        "requests_pending": len([r for r in requests if r["status"] == "pending"]),
        "requests_scheduled": len([r for r in requests if r["status"] == "accepted"]),
        "requests_cancelled": len([r for r in requests if r["status"] == "cancelled"]),
        "requests_declined": len([r for r in requests if r["status"] == "declined"]),
        "sessions_completed": len([s for s in sessions if s["status"] == "completed"]),
        "referrals_total": len(referrals),
        "referrals_by_status": dict(Counter(r["status"] for r in referrals)),
        "professionals_linked": len(professionals),
        "professionals_accessed": len([p for p in professionals if p.get("last_access")]),
        "professionals_with_availability": len(pro_ids_with_slots),
        "open_slots": await db.availability.count_documents({"institution_id": institution_id, "status": "open"}),
        "requests_by_month": [{"month": m, "requests": c} for m, c in sorted(by_month.items())],
        "feedback_count": len(scores),
        "feedback_average": round(sum(scores) / len(scores), 2) if scores else None,
        "has_data": bool(requests or sessions),
        "data_source": "pilot",
    }


@router.get("/global")
async def global_metrics(user: dict = Depends(require_roles("admin"))):
    institutions = await db.institutions.find({}, {"_id": 0}).to_list(200)
    per_institution = []
    for inst in institutions:
        m = await institution_metrics(inst["id"])
        per_institution.append({"institution": inst["name"], "code": inst["code"], **m})
    students = await db.students.find({}, {"_id": 0, "last_access": 1}).to_list(2000)
    return {
        "institutions": len(institutions),
        "users": await db.users.count_documents({}),
        "students_registered": len(students),
        "students_accessed": len([s for s in students if s.get("last_access")]),
        "professionals": await db.professionals.count_documents({}),
        "requests": await db.requests.count_documents({}),
        "sessions_completed": await db.sessions.count_documents({"status": "completed"}),
        "referrals": await db.referrals.count_documents({}),
        "events": await db.events.count_documents({}),
        "pending_invites": await db.users.count_documents({"invite_token": {"$exists": True}}),
        "per_institution": per_institution,
    }
