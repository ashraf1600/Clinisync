import asyncio
import logging
import smtplib
from email.message import EmailMessage

from app.core.config import settings

logger = logging.getLogger("uvicorn.error")


def _send_sync(message: EmailMessage) -> None:
    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as smtp:
        if settings.SMTP_USE_TLS:
            smtp.starttls()
        if settings.SMTP_USERNAME:
            smtp.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
        smtp.send_message(message)


async def send_email(to: str, subject: str, body: str) -> bool:
    """Send a plain-text email. Without SMTP configured, the email is logged instead.

    Never raises: callers (e.g. forgot-password) must not reveal delivery failures.
    """
    if not settings.SMTP_HOST:
        logger.info(f"[email not sent: SMTP_HOST unset] to={to} subject={subject!r}\n{body}")
        return False
    message = EmailMessage()
    message["From"] = settings.SMTP_FROM
    message["To"] = to
    message["Subject"] = subject
    message.set_content(body)
    try:
        await asyncio.to_thread(_send_sync, message)
        return True
    except Exception as exc:
        logger.error(f"Failed to send email to {to}: {exc}")
        return False
