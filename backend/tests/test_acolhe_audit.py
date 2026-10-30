"""Acolhe audit iteration tests: metrics separation, atomic accept, new invite flow,
rate limit, forgot/reset password, consent, and RBAC isolation."""
import os
import uuid
import time
import threading
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
    return {"admin": _login(*ADMIN), "inst": _login(*INST), "pro": _login(*PRO), "stu": _login(*STU)}


# ============ (a) MÉTRICAS =============
class TestMetricsSeparation:
    def test_metric_field_names_present(self, tokens):
        r = requests.get(f"{API}/institutions/me/metrics", headers=_h(tokens["inst"]))
        assert r.status_code == 200
        m = r.json()
        for key in ("students_registered", "students_accessed", "students_active_30d",
                    "students_requested", "requests_by_month", "requests_cancelled", "requests_declined"):
            assert key in m, f"missing metric {key}: got {list(m.keys())}"

    def test_new_student_does_not_count_as_accessed(self, tokens):
        m0 = requests.get(f"{API}/institutions/me/metrics", headers=_h(tokens["inst"])).json()
        before_reg = m0["students_registered"]
        before_acc = m0["students_accessed"]

        email = f"test_metric_{uuid.uuid4().hex[:8]}@piloto.edu.br"
        r = requests.post(f"{API}/auth/register", json={
            "name": "TEST Metric", "email": email, "password": "senha1234",
            "institution_code": PILOT_CODE, "consent": True})
        assert r.status_code == 200, r.text

        # registered increments, accessed should NOT (register auto-logs but does not set last_access)
        m1 = requests.get(f"{API}/institutions/me/metrics", headers=_h(tokens["inst"])).json()
        assert m1["students_registered"] == before_reg + 1
        assert m1["students_accessed"] == before_acc, \
            f"register should not count as access. before={before_acc} after={m1['students_accessed']}"

        # after explicit login, accessed increments
        _login(email, "senha1234")
        m2 = requests.get(f"{API}/institutions/me/metrics", headers=_h(tokens["inst"])).json()
        assert m2["students_accessed"] == before_acc + 1, \
            f"after login accessed should increment. before={before_acc} after={m2['students_accessed']}"


# ============ (b) ACEITE ATÔMICO =============
class TestAtomicAccept:
    def test_double_accept_creates_one_session(self, tokens):
        # Setup: create a slot + student request
        date = "2099-07-20"
        time_slot = f"1{uuid.uuid4().hex[:1]}:00"  # random-ish hour
        r = requests.post(f"{API}/professionals/me/availability",
                          json={"date": date, "times": [time_slot]}, headers=_h(tokens["pro"]))
        assert r.status_code == 201, r.text
        slot_id = r.json()[0]["id"]

        r = requests.post(f"{API}/students/me/requests",
                          json={"availability_id": slot_id, "reason_code": "conversar", "reason_note": "TEST atomic"},
                          headers=_h(tokens["stu"]))
        assert r.status_code == 201, r.text
        req_id = r.json()["id"]

        results = []

        def _accept():
            resp = requests.post(f"{API}/professionals/me/requests/{req_id}/accept", headers=_h(tokens["pro"]))
            results.append(resp.status_code)

        threads = [threading.Thread(target=_accept) for _ in range(3)]
        for t in threads: t.start()
        for t in threads: t.join()

        # Exactly one 200, others 409
        assert results.count(200) == 1, f"exactly one accept must succeed, got {results}"
        assert all(s in (200, 409) for s in results), f"unexpected statuses: {results}"

        # Verify only 1 session
        sessions = requests.get(f"{API}/professionals/me/sessions", headers=_h(tokens["pro"])).json()
        matching = [s for s in sessions if s["request_id"] == req_id]
        assert len(matching) == 1, f"exactly 1 session expected, got {len(matching)}"

        # cleanup
        session_id = matching[0]["id"]
        requests.post(f"{API}/professionals/me/sessions/{session_id}/complete", headers=_h(tokens["pro"]))


# ============ (c) CONVITE PROFISSIONAL =============
class TestProfessionalInvite:
    def test_invite_new_flow(self, tokens):
        email = f"test_inv_{uuid.uuid4().hex[:6]}@piloto.edu.br"
        # payload without password
        r = requests.post(f"{API}/institutions/me/professionals", json={
            "name": "TEST Invite Pro", "email": email, "link_type": "partner", "specialty": "Escuta"
        }, headers=_h(tokens["inst"]))
        assert r.status_code == 201, r.text
        body = r.json()
        assert "invite_path" in body and body["invite_path"].startswith("/convite/")
        token = body["invite_path"].split("/convite/")[1]

        # cannot login before accepting invite
        r_login = requests.post(f"{API}/auth/login", json={"email": email, "password": "anything123"})
        assert r_login.status_code in (401, 403), f"unexpected {r_login.status_code}"

        # invite pending visible on institution list
        pros = requests.get(f"{API}/institutions/me/professionals", headers=_h(tokens["inst"])).json()
        me = next((p for p in pros if p["email"] == email), None)
        assert me and me["invite_pending"] is True

        # read invite
        r = requests.get(f"{API}/auth/invite/{token}")
        assert r.status_code == 200, r.text
        assert r.json()["email"] == email

        # accept invite with password
        r = requests.post(f"{API}/auth/invite/{token}/accept", json={"password": "novasenha123"})
        assert r.status_code == 200, r.text
        assert r.json()["access_token"]

        # now login works
        _login(email, "novasenha123")

        # invite no longer valid (reuse)
        r = requests.get(f"{API}/auth/invite/{token}")
        assert r.status_code == 404

    def test_invalid_invite_token(self):
        r = requests.get(f"{API}/auth/invite/nope_nope_nope")
        assert r.status_code == 404


# ============ (d) RATE LIMIT =============
class TestRateLimit:
    def test_five_failures_lock(self):
        # Use a unique email that likely doesn't exist so we don't lock the pilot accounts
        email = f"ratelimit_{uuid.uuid4().hex[:8]}@piloto.edu.br"
        # First need to have a real user so we can verify unlock; use register
        r = requests.post(f"{API}/auth/register", json={
            "name": "TEST RL", "email": email, "password": "correta12345",
            "institution_code": PILOT_CODE, "consent": True})
        assert r.status_code == 200

        # 5 failing attempts
        seen_429 = False
        for i in range(6):
            r = requests.post(f"{API}/auth/login", json={"email": email, "password": "wrongpass"})
            if r.status_code == 429:
                seen_429 = True
                break
        assert seen_429, "expected 429 after 5 failures"


# ============ (e) FORGOT / RESET =============
class TestForgotReset:
    def test_forgot_and_reset(self):
        if os.environ.get("ACOLHE_TEST_PILOT_RESET") != "true":
            pytest.skip("Requires explicit pilot reset token mode")
        email = f"test_reset_{uuid.uuid4().hex[:8]}@piloto.edu.br"
        old_pwd = "oldsenha123"
        requests.post(f"{API}/auth/register", json={
            "name": "TEST Reset", "email": email, "password": old_pwd,
            "institution_code": PILOT_CODE, "consent": True})

        # forgot for existing email
        r = requests.post(f"{API}/auth/forgot-password", json={"email": email})
        assert r.status_code == 200
        j = r.json()
        assert "reset_token" in j
        token = j["reset_token"]

        # forgot for non-existent: generic response, no token
        r2 = requests.post(f"{API}/auth/forgot-password", json={"email": "noone_xyz@piloto.edu.br"})
        assert r2.status_code == 200
        assert "reset_token" not in r2.json()

        # reset
        new_pwd = "novasenha456"
        r = requests.post(f"{API}/auth/reset-password", json={"token": token, "password": new_pwd})
        assert r.status_code == 200

        # login with new password
        _login(email, new_pwd)

        # token reuse should fail
        r = requests.post(f"{API}/auth/reset-password", json={"token": token, "password": "outrasenha1"})
        assert r.status_code == 400


# ============ (f) CONSENTIMENTO =============
class TestConsent:
    def test_register_requires_consent(self):
        email = f"test_no_consent_{uuid.uuid4().hex[:6]}@piloto.edu.br"
        r = requests.post(f"{API}/auth/register", json={
            "name": "TEST NoConsent", "email": email, "password": "senha1234",
            "institution_code": PILOT_CODE, "consent": False})
        assert r.status_code == 422, f"expected 422 got {r.status_code} {r.text}"

    def test_register_consent_missing_field(self):
        # missing field should also fail (pydantic 422)
        email = f"test_no_field_{uuid.uuid4().hex[:6]}@piloto.edu.br"
        r = requests.post(f"{API}/auth/register", json={
            "name": "TEST NoField", "email": email, "password": "senha1234",
            "institution_code": PILOT_CODE})
        assert r.status_code == 422


# ============ (h/g) FLUXO NÚCLEO — Room link + isolamento =============
class TestRoomLinkGuard:
    def test_room_link_only_on_accepted(self, tokens):
        date = "2099-08-10"
        # use unique time each run to avoid idempotency (returns [] when slot exists)
        hh = 10 + (int(time.time()) % 12)
        t = f"{hh:02d}:{(int(time.time()) % 60):02d}"
        r = requests.post(f"{API}/professionals/me/availability",
                          json={"date": date, "times": [t]}, headers=_h(tokens["pro"]))
        assert r.status_code == 201
        created = r.json()
        if not created:
            # slot already existed — fetch via availability list
            avail = requests.get(f"{API}/professionals/me/availability", headers=_h(tokens["pro"])).json()
            slot_id = next(s["id"] for s in avail if s["date"] == date and s["time"] == t)
        else:
            slot_id = created[0]["id"]
        r = requests.post(f"{API}/students/me/requests",
                          json={"availability_id": slot_id, "reason_code": "conversar"},
                          headers=_h(tokens["stu"]))
        assert r.status_code == 201
        req_id = r.json()["id"]

        # try room-link before accept
        r = requests.post(f"{API}/professionals/me/requests/{req_id}/room-link",
                          json={"room_link": "https://meet.example.com/x"}, headers=_h(tokens["pro"]))
        assert r.status_code == 409, f"expected 409 for room-link on pending, got {r.status_code}"

        # accept then set
        r = requests.post(f"{API}/professionals/me/requests/{req_id}/accept", headers=_h(tokens["pro"]))
        assert r.status_code == 200
        session_id = r.json()["id"]
        r = requests.post(f"{API}/professionals/me/requests/{req_id}/room-link",
                          json={"room_link": "https://meet.example.com/x"}, headers=_h(tokens["pro"]))
        assert r.status_code == 200
        # complete then re-set → 409
        rc = requests.post(f"{API}/professionals/me/sessions/{session_id}/complete", headers=_h(tokens["pro"]))
        assert rc.status_code == 200
        r = requests.post(f"{API}/professionals/me/requests/{req_id}/room-link",
                          json={"room_link": "https://meet.example.com/y"}, headers=_h(tokens["pro"]))
        assert r.status_code == 409, f"expected 409 for room-link on completed, got {r.status_code} {r.text}"


# ============ (i) RBAC ISOLATION =============
class TestRBACIsolation:
    def test_institution_cannot_read_reason_note(self, tokens):
        # /institutions/me/metrics must not leak reason_note
        m = requests.get(f"{API}/institutions/me/metrics", headers=_h(tokens["inst"])).json()
        assert "reason_note" not in str(m)
        # /institutions/me/students should not include reason_note
        s = requests.get(f"{API}/institutions/me/students", headers=_h(tokens["inst"])).json()
        assert "reason_note" not in str(s)

    def test_student_cannot_access_institution_metrics(self, tokens):
        r = requests.get(f"{API}/institutions/me/metrics", headers=_h(tokens["stu"]))
        assert r.status_code == 403

    def test_institution_cannot_access_admin(self, tokens):
        r = requests.get(f"{API}/admin/users", headers=_h(tokens["inst"]))
        assert r.status_code == 403


# ============ (j) ISOLAMENTO ENTRE INSTITUIÇÕES =============
class TestInstitutionIsolation:
    def test_institution_b_cannot_see_institution_a_data(self, tokens):
        suffix = uuid.uuid4().hex[:6]
        code_b = f"TESTB{suffix}".upper()
        manager_b = f"test_gestor_{suffix}@escolab.edu.br"
        r = requests.post(f"{API}/admin/institutions", json={
            "name": f"TEST Escola B {suffix}", "code": code_b,
            "admin_name": "TEST Gestor B", "admin_email": manager_b,
            "admin_password": "senha1234",
        }, headers=_h(tokens["admin"]))
        assert r.status_code == 201, r.text

        # estudante da instituição B
        student_b = f"test_stu_b_{suffix}@escolab.edu.br"
        r = requests.post(f"{API}/auth/register", json={
            "name": "TEST Stu B", "email": student_b, "password": "senha1234",
            "institution_code": code_b, "consent": True})
        assert r.status_code == 200, r.text

        tok_b = _login(manager_b, "senha1234")
        students_b = requests.get(f"{API}/institutions/me/students", headers=_h(tok_b)).json()
        names_b = {s["name"] for s in students_b}
        assert "TEST Stu B" in names_b
        # nenhum estudante da instituição piloto (A) aparece para B
        students_a = requests.get(f"{API}/institutions/me/students", headers=_h(tokens["inst"])).json()
        ids_a = {s["id"] for s in students_a}
        ids_b = {s["id"] for s in students_b}
        assert not (ids_a & ids_b)
        # e o estudante de B não aparece para A
        assert "TEST Stu B" not in {s["name"] for s in students_a}

        # profissionais e métricas também isolados
        pros_b = requests.get(f"{API}/institutions/me/professionals", headers=_h(tok_b)).json()
        assert pros_b == []
        m_b = requests.get(f"{API}/institutions/me/metrics", headers=_h(tok_b)).json()
        assert m_b["students_registered"] == 1
        assert m_b["requests_total"] == 0

    def test_student_cannot_book_slot_from_other_institution(self, tokens):
        # os horários visíveis ao estudante são apenas da sua instituição
        pros = requests.get(f"{API}/students/me/professionals", headers=_h(tokens["stu"])).json()
        me = requests.get(f"{API}/students/me", headers=_h(tokens["stu"])).json()
        inst_id = me["student"]["institution_id"]
        for p in pros:
            for s in p["slots"]:
                assert s["institution_id"] == inst_id
        # id inexistente/de outra instituição -> 404
        r = requests.post(f"{API}/students/me/requests", json={
            "availability_id": str(uuid.uuid4()), "reason_code": "conversar"},
            headers=_h(tokens["stu"]))
        assert r.status_code == 404


# ============ (k) CANCELAMENTO E CONCORRÊNCIA DE SLOT =============
class TestCancelConcurrency:
    def _new_slot(self, tokens, time="14:00"):
        date = f"2098-{uuid.uuid4().int % 12 + 1:02d}-{uuid.uuid4().int % 28 + 1:02d}"
        r = requests.post(f"{API}/professionals/me/availability",
                          json={"date": date, "times": [time]}, headers=_h(tokens["pro"]))
        assert r.status_code == 201, r.text
        pros = requests.get(f"{API}/students/me/professionals", headers=_h(tokens["stu"])).json()
        return next(s for p in pros for s in p["slots"] if s["date"] == date and s["time"] == time)

    def test_double_cancel_is_idempotent_and_slot_reopens_once(self, tokens):
        slot = self._new_slot(tokens)
        r = requests.post(f"{API}/students/me/requests",
                          json={"availability_id": slot["id"], "reason_code": "conversar"},
                          headers=_h(tokens["stu"]))
        assert r.status_code == 201, r.text
        req_id = r.json()["id"]

        results = []

        def cancel():
            results.append(requests.post(f"{API}/students/me/requests/{req_id}/cancel",
                                         headers=_h(tokens["stu"])).status_code)

        threads = [threading.Thread(target=cancel) for _ in range(2)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        assert 200 in results, results
        assert results.count(200) == 1, f"cancelamento não é atômico: {results}"

        # slot voltou a ficar aberto e pode ser reservado novamente
        pros = requests.get(f"{API}/students/me/professionals", headers=_h(tokens["stu"])).json()
        assert slot["id"] in {s["id"] for p in pros for s in p["slots"]}
        r = requests.post(f"{API}/students/me/requests",
                          json={"availability_id": slot["id"], "reason_code": "conversar"},
                          headers=_h(tokens["stu"]))
        assert r.status_code == 201, r.text
        requests.post(f"{API}/students/me/requests/{r.json()['id']}/cancel", headers=_h(tokens["stu"]))
        requests.delete(f"{API}/professionals/me/availability/{slot['id']}", headers=_h(tokens["pro"]))

    def test_two_students_cannot_book_same_slot(self, tokens):
        slot = self._new_slot(tokens, time="15:30")
        # segundo estudante da mesma instituição
        email = f"test_race_{uuid.uuid4().hex[:6]}@piloto.edu.br"
        reg = requests.post(f"{API}/auth/register", json={
            "name": "TEST Race Stu", "email": email, "password": "senha1234",
            "institution_code": PILOT_CODE, "consent": True})
        assert reg.status_code == 200, reg.text
        tok_b = reg.json()["access_token"]

        codes = []

        def book(tok):
            codes.append(requests.post(f"{API}/students/me/requests",
                                       json={"availability_id": slot["id"], "reason_code": "conversar"},
                                       headers=_h(tok)).status_code)

        threads = [threading.Thread(target=book, args=(t,)) for t in (tokens["stu"], tok_b)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        assert codes.count(201) == 1, f"dois estudantes reservaram o mesmo horário: {codes}"
        assert 409 in codes, codes

        # apenas uma solicitação pendente existe para este slot
        mine = requests.get(f"{API}/students/me/requests", headers=_h(tokens["stu"])).json()
        theirs = requests.get(f"{API}/students/me/requests", headers=_h(tok_b)).json()
        for_slot = [r for r in mine + theirs if r["availability_id"] == slot["id"] and r["status"] == "pending"]
        assert len(for_slot) == 1, for_slot
        requests.post(f"{API}/students/me/requests/{for_slot[0]['id']}/cancel",
                      headers=_h(tokens["stu"] if for_slot[0] in mine else tok_b))
        requests.delete(f"{API}/professionals/me/availability/{slot['id']}", headers=_h(tokens["pro"]))
