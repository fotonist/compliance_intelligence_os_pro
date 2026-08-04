from app.models.actions import Action
from sqlalchemy import Column, Integer, String, Boolean
from sqlalchemy.orm import relationship
from app.db.base import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)

    # Kullanıcı rollerini Role modeli olarak döndür
    roles = relationship(
        "Role",
        secondary="user_roles",
        back_populates="users",
    )

    # Action ilişkisi
    actions = relationship("Action", back_populates="user", cascade="all, delete")

    # 🔵 YENİ: Audit log ilişkisi
    audit_logs = relationship(
        "AuditLog",
        back_populates="user",
        cascade="all, delete",
    )
