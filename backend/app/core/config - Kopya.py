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

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
