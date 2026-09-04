from dotenv import load_dotenv

load_dotenv()

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):

    # =========================
    # ENV / APP
    # =========================

    ENV: str = "development"

    # =========================
    # DATABASE
    # =========================

    DATABASE_URL: str

    # =========================
    # JWT / SECURITY
    # =========================

    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # =========================
    # DOCUMENT STORAGE
    # =========================

    DOCUMENT_STORAGE_ROOT: str = "uploads"
    GOVERNANCE_STORAGE_ROOT: str = "governance"

    # =========================
    # EVIDENCE REVIEW
    # =========================

    EVIDENCE_REVIEW_SLA_DAYS: int = 3

    # =========================
    # IDENTITY / NOTIFICATION
    # =========================

    EMAIL_PROVIDER: str = "resend"
    RESEND_API_KEY: str = ""
    EMAIL_FROM: str = ""
    EMAIL_FROM_NAME: str = "Compliance Intelligence OS"

    SMS_PROVIDER: str = "twilio"
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_FROM_NUMBER: str = ""

    MFA_ISSUER: str = "Compliance Intelligence OS"
    VERIFICATION_TOKEN_EXPIRE_MINUTES: int = 30

    # =========================
    # AI
    # =========================

    OPENAI_API_KEY: str | None = None
    AI_MODEL: str = "gpt-4.1-mini"

    class Config:

        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()