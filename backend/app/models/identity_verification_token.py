from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
)
from sqlalchemy.sql import func

from app.db.base import Base


class IdentityVerificationToken(Base):
    __tablename__ = "identity_verification_tokens"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    user_id = Column(
        Integer,
        ForeignKey(
            "users.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    channel = Column(
        String(20),
        nullable=False,
    )

    token_hash = Column(
        String(128),
        nullable=False,
        unique=True,
        index=True,
    )

    expires_at = Column(
        DateTime,
        nullable=False,
        index=True,
    )

    consumed_at = Column(
        DateTime,
        nullable=True,
    )

    created_at = Column(
        DateTime,
        nullable=False,
        server_default=func.now(),
    )
