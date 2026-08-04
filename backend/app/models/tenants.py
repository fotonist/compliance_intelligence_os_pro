# C:\Projects\compliance_app\backend\app\models\tenants.py
from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func
from app.db.base import Base


class Tenant(Base):
    __tablename__ = "tenants"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(64), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    status = Column(String(32), nullable=False, default="active", index=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
