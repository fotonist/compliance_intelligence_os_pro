# C:\Projects\compliance_app\backend\app\models\permission.py
from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship

from app.db.base import Base


class Permission(Base):
    __tablename__ = "permissions"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(128), unique=True, nullable=False, index=True)
    description = Column(String(255), nullable=True)

    roles = relationship(
        "Role",
        secondary="role_permissions",
        back_populates="permissions",
    )