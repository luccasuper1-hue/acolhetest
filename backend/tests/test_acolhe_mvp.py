"""Acolhe MVP backend regression tests.

Covers: auth, RBAC 403, availability, request/session/feedback flow,
409 double-booking, referral, institution metrics/invite, admin toggle.
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("ACOLHE_TEST_BACKEND_URL", "").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = (os.environ.get("ACOLHE_TEST_ADMIN_EMAIL"), os.environ.get("ACOLHE_TEST_ADMIN_PASSWORD"))
INST = (os.environ.get("ACOLHE_TEST_INST_EMAIL"), os.environ.get("ACOLHE_TEST_INST_PASSWORD"))
PRO = (os.environ.get("ACOLHE_TEST_PRO_EMAIL"), os.environ.get("ACOLHE_TEST_PRO_PASSWORD"))
STU = (os.environ.get("ACOLHE_TEST_STU_EMAIL"), os.environ.get("ACOLHE_TEST_STU_PASSWORD"))
PILOT_CODE = os.environ.get("ACOLHE_TEST_PILOT_CODE")

pytestmark = pytest.mark.skipif(
    not BASE_URL or not PILOT_CODE or not all(ADMIN + INST + PRO + STU),
    reason="Integration backend URL and test credentials are required",
)


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, f"login {email} -> {r.status_code} {r.text}"
    return r.json()["access_token"]


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="module")
def tokens():
    return {
        "admin": _login(*ADMIN),
        "inst": _login(*INST),
        "pro": _login(*PRO),
        "stu": _login(*STU),
    }


# ---- Auth ----
class TestAuth:
    def test_login_invalid(self):
        r = requests.post(f"{API}/auth/login", json={"email": "x@y.com", "password": "wrong123"})
        assert r.status_code == 401

    def test_me_requires_auth(self):
        assert requests.get(f"{API}/auth/me").status_code == 401

    def test_me_ok(self, tokens):
        r = requests.get(f"{API}/auth/me", headers=_h(tokens["stu"]))
        assert r.status_code == 200
        assert r.json()["user"]["role"] == "student"

    def test_register_invalid_code(self):
        r = requests.post(f"{API}/auth/register", json={
            "name": "TEST User", "email": f"test_{uuid.uuid4().hex[:8]}@t.com",
            "password": "senha1234", "institution_code": "NOPE", "consent": True
        })
        assert r.status_code == 404

    def test_register_ok(self):
        email = f"test_{uuid.uuid4().hex[:8]}@piloto.edu.br"
        r = requests.post(f"{API}/auth/register", json={
            "name": "TEST Stu", "email": email, "password": "senha1234",
            "institution_code": PILOT_CODE, "consent": True
        })
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["user"]["role"] == "student"
        assert j["access_token"]


# ---- RBAC ----
class TestRBAC:
    def test_student_forbidden_admin(self, tokens):
        assert requests.get(f"{API}/admin/users", headers=_h(tokens["stu"])).status_code == 403

    def test_student_forbidden_institution(self, tokens):
        assert requests.get(f"{API}/institutions/me", headers=_h(tokens["stu"])).status_code == 403

    def test_institution_forbidden_admin(self, tokens):
        assert requests.get(f"{API}/admin/users", headers=_h(tokens["inst"])).status_code == 403

    def test_pro_forbidden_admin(self, tokens):
        assert requests.get(f"{API}/admin/users", headers=_h(tokens["pro"])).status_code == 403

    def test_admin_ok(self, tokens):
        r = requests.get(f"{API}/admin/users", headers=_h(tokens["admin"]))
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ---- Availability + Request + Session flow ----
class TestFlow:
    def test_full_flow(self, tokens):
        # Pro creates 2 slots on a unique far-future date (testes idempotentes)
        date = f"2099-{uuid.uuid4().int % 12 + 1:02d}-{uuid.uuid4().int % 28 + 1:02d}"
        times = ["09:00", "09:30"]
        r = requests.post(f"{API}/professionals/me/availability",
                          json={"date": date, "times": times}, headers=_h(tokens["pro"]))
        assert r.status_code == 201
        # list availability
        slots = requests.get(f"{API}/professionals/me/availability", headers=_h(tokens["pro"])).json()
        my = [s for s in slots if s["date"] == date and s["time"] in times]
        assert len(my) >= 2

        # student sees professionals with slots
        pros = requests.get(f"{API}/students/me/professionals", headers=_h(tokens["stu"])).json()
        assert pros, "no professionals visible to student"
        slot_ids = {s["id"] for p in pros for s in p["slots"]}
        first_slot = next(s for p in pros for s in p["slots"] if s["date"] == date and s["time"] == "09:00")

        # student creates request
        r = requests.post(f"{API}/students/me/requests",
                          json={"availability_id": first_slot["id"], "reason_code": "conversar",
                                "reason_note": "TEST"},
                          headers=_h(tokens["stu"]))
        assert r.status_code == 201, r.text
        req_id = r.json()["id"]

        # double booking -> 409
        r2 = requests.post(f"{API}/students/me/requests",
                           json={"availability_id": first_slot["id"], "reason_code": "conversar"},
                           headers=_h(tokens["stu"]))
        assert r2.status_code == 409

        # slot no longer in available list
        pros2 = requests.get(f"{API}/students/me/professionals", headers=_h(tokens["stu"])).json()
        remaining = {s["id"] for p in pros2 for s in p["slots"]}
        assert first_slot["id"] not in remaining

        # pro accepts
        r = requests.post(f"{API}/professionals/me/requests/{req_id}/accept", headers=_h(tokens["pro"]))
        assert r.status_code == 200, r.text
        session_id = r.json()["id"]

        # room link invalid
        r = requests.post(f"{API}/professionals/me/requests/{req_id}/room-link",
                          json={"room_link": "notalink"}, headers=_h(tokens["pro"]))
        assert r.status_code == 422

        # room link valid
        r = requests.post(f"{API}/professionals/me/requests/{req_id}/room-link",
                          json={"room_link": "https://meet.example.com/abc"}, headers=_h(tokens["pro"]))
        assert r.status_code == 200

        # complete
        r = requests.post(f"{API}/professionals/me/sessions/{session_id}/complete", headers=_h(tokens["pro"]))
        assert r.status_code == 200

        # referral
        r = requests.post(f"{API}/professionals/me/sessions/{session_id}/referral",
                          json={"status": "orientacao", "note": "TEST ok"}, headers=_h(tokens["pro"]))
        assert r.status_code == 201

        # student feedback
        r = requests.post(f"{API}/students/me/sessions/{session_id}/feedback",
                          json={"score": 5, "comment": "TEST bom"}, headers=_h(tokens["stu"]))
        assert r.status_code == 201

        # institution metrics reflect data
        m = requests.get(f"{API}/institutions/me/metrics", headers=_h(tokens["inst"])).json()
        assert m["has_data"] is True
        assert m["sessions_completed"] >= 1
        assert m["feedback_count"] >= 1

        # institution list should NOT expose reason_note/comment (privacy)
        # metrics response doesn't include per-student reason: verify no 'reason_note' anywhere
        assert "reason_note" not in str(m)

        # cancel flow: create 2nd request and cancel
        second = next(s for p in pros for s in p["slots"] if s["date"] == date and s["time"] == "09:30")
        r = requests.post(f"{API}/students/me/requests",
                          json={"availability_id": second["id"], "reason_code": "orientacao"},
                          headers=_h(tokens["stu"]))
        assert r.status_code == 201
        req2 = r.json()["id"]
        r = requests.post(f"{API}/students/me/requests/{req2}/cancel", headers=_h(tokens["stu"]))
        assert r.status_code == 200
        # slot should be back to open
        pros3 = requests.get(f"{API}/students/me/professionals", headers=_h(tokens["stu"])).json()
        open_ids = {s["id"] for p in pros3 for s in p["slots"]}
        assert second["id"] in open_ids

        # Cleanup: remove second slot
        requests.delete(f"{API}/professionals/me/availability/{second['id']}", headers=_h(tokens["pro"]))


# ---- Admin toggle ----
class TestAdmin:
    def test_toggle_and_login_blocked(self, tokens):
        # create a temp student via register
        email = f"test_toggle_{uuid.uuid4().hex[:6]}@piloto.edu.br"
        pwd = "senha1234"
        r = requests.post(f"{API}/auth/register", json={
            "name": "TEST Toggle", "email": email, "password": pwd,
            "institution_code": PILOT_CODE, "consent": True})
        assert r.status_code == 200
        user_id = r.json()["user"]["id"]

        # deactivate
        r = requests.post(f"{API}/admin/users/{user_id}/toggle-active", headers=_h(tokens["admin"]))
        assert r.status_code == 200
        assert r.json()["active"] is False

        # login should fail 403
        r = requests.post(f"{API}/auth/login", json={"email": email, "password": pwd})
        assert r.status_code == 403

        # reactivate
        r = requests.post(f"{API}/admin/users/{user_id}/toggle-active", headers=_h(tokens["admin"]))
        assert r.json()["active"] is True

    def test_admin_cannot_be_toggled(self, tokens):
        users = requests.get(f"{API}/admin/users", headers=_h(tokens["admin"])).json()
        admin_id = next(u["id"] for u in users if u["role"] == "admin")
        r = requests.post(f"{API}/admin/users/{admin_id}/toggle-active", headers=_h(tokens["admin"]))
        assert r.status_code == 403


# ---- Institution invite professional ----
class TestInstitutionInvite:
    def test_invite_professional(self, tokens):
        email = f"test_pro_{uuid.uuid4().hex[:6]}@piloto.edu.br"
        r = requests.post(f"{API}/institutions/me/professionals", json={
            "name": "TEST Pro", "email": email,
            "link_type": "partner", "specialty": "Escuta"
        }, headers=_h(tokens["inst"]))
        assert r.status_code == 201, r.text
        invite_path = r.json().get("invite_path")
        assert invite_path and invite_path.startswith("/convite/")
        token = invite_path.split("/convite/")[-1]
        # login must be blocked (convite pendente) before accept
        pre = requests.post(f"{API}/auth/login", json={"email": email, "password": "senha1234"})
        assert pre.status_code == 403, pre.text
        # accept invite with self-chosen password
        acc = requests.post(f"{API}/auth/invite/{token}/accept", json={"password": "senha1234"})
        assert acc.status_code == 200, acc.text
        # now login works
        tok = _login(email, "senha1234")
        me = requests.get(f"{API}/professionals/me", headers=_h(tok)).json()
        assert me["professional"]["link_type"] == "partner"
