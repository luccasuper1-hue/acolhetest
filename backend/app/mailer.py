import os
import smtplib
from email.message import EmailMessage
from urllib.parse import quote, urlsplit


def reset_mail_configured() -> bool:
    return all(os.environ.get(key) for key in ("SMTP_HOST", "SMTP_FROM", "FRONTEND_URL"))


def send_reset_email(recipient: str, token: str) -> None:
    frontend_url = os.environ["FRONTEND_URL"].rstrip("/")
    parsed = urlsplit(frontend_url)
    if parsed.scheme != "https" or not parsed.netloc or parsed.path or parsed.query or parsed.fragment:
        raise ValueError("FRONTEND_URL must be an HTTPS origin")

    link = f"{frontend_url}/redefinir-senha?token={quote(token)}"
    message = EmailMessage()
    message["Subject"] = "Redefinir senha do Acolhe"
    message["From"] = os.environ["SMTP_FROM"]
    message["To"] = recipient
    message.set_content(f"Para redefinir sua senha, abra este link em até 1 hora:\n\n{link}\n")

    port = int(os.environ.get("SMTP_PORT", "587"))
    smtp_class = smtplib.SMTP_SSL if port == 465 else smtplib.SMTP
    with smtp_class(os.environ["SMTP_HOST"], port, timeout=15) as smtp:
        if port != 465:
            smtp.starttls()
        username = os.environ.get("SMTP_USER")
        password = os.environ.get("SMTP_PASSWORD")
        if bool(username) != bool(password):
            raise ValueError("SMTP_USER and SMTP_PASSWORD must be set together")
        if username and password:
            smtp.login(username, password)
        smtp.send_message(message)
