import pytest

from app.deployment import parse_cors_origins
from app.mailer import send_reset_email


def test_cors_origins_are_explicit_and_normalized():
    assert parse_cors_origins(" https://acolhe.example/ , https://acolhe.example, http://localhost:3000 ") == [
        "https://acolhe.example", "http://localhost:3000"
    ]
    assert parse_cors_origins("") == []


@pytest.mark.parametrize("value", ["*", "https://acolhe.example/path", "https://acolhe.example?x=1"])
def test_cors_rejects_non_origins(value):
    with pytest.raises(ValueError):
        parse_cors_origins(value)


def test_reset_email_uses_https_link_without_logging_token(monkeypatch):
    sent = []

    class FakeSMTP:
        def __init__(self, host, port, timeout):
            assert (host, port, timeout) == ("smtp.example", 587, 15)

        def __enter__(self):
            return self

        def __exit__(self, *_):
            pass

        def starttls(self):
            pass

        def send_message(self, message):
            sent.append(message)

    monkeypatch.setenv("FRONTEND_URL", "https://acolhe.example/")
    monkeypatch.setenv("SMTP_HOST", "smtp.example")
    monkeypatch.setenv("SMTP_FROM", "contato@acolhe.example")
    monkeypatch.delenv("SMTP_USER", raising=False)
    monkeypatch.delenv("SMTP_PASSWORD", raising=False)
    monkeypatch.setattr("app.mailer.smtplib.SMTP", FakeSMTP)

    send_reset_email("user@example.com", "token-secret")
    assert len(sent) == 1
    assert "https://acolhe.example/redefinir-senha?token=token-secret" in sent[0].get_content()
    assert sent[0]["To"] == "user@example.com"
