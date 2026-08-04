from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.db.base import Base


class ExternalIntegration(Base):
    __tablename__ = "external_integrations"

    id = Column(Integer, primary_key=True)

    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)

    provider = Column(String(30), nullable=False)  # jira | clickup
    base_url = Column(String(500), nullable=True)

    jira_email = Column(String(255), nullable=True)
    api_token = Column(String(500), nullable=True)
    project_key = Column(String(50), nullable=True)
    issue_type = Column(String(50), nullable=True)

    team_id = Column(String(50), nullable=True)
    space_id = Column(String(50), nullable=True)
    folder_id = Column(String(50), nullable=True)
    list_id = Column(String(50), nullable=True)

    is_active = Column(Boolean, nullable=False, default=True)

    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now())