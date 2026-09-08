from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


IntegrationProvider = Literal["jira", "clickup"]


class IntegrationBase(BaseModel):
    provider: IntegrationProvider


class JiraIntegrationCreate(BaseModel):
    provider: Literal["jira"] = "jira"
    base_url: str = Field(..., min_length=1, max_length=500)
    jira_email: str = Field(..., min_length=1, max_length=255)
    api_token: str = Field(..., min_length=1, max_length=500)
    project_key: str = Field(..., min_length=1, max_length=50)
    issue_type: str = Field(default="Task", min_length=1, max_length=50)


class ClickUpIntegrationCreate(BaseModel):
    provider: Literal["clickup"] = "clickup"
    api_token: str = Field(..., min_length=1, max_length=500)
    team_id: Optional[str] = Field(default=None, max_length=50)
    space_id: Optional[str] = Field(default=None, max_length=50)
    folder_id: Optional[str] = Field(default=None, max_length=50)
    list_id: Optional[str] = Field(default=None, max_length=50)


class IntegrationCreate(BaseModel):
    provider: IntegrationProvider
    base_url: Optional[str] = Field(default=None, max_length=500)
    jira_email: Optional[str] = Field(default=None, max_length=255)
    api_token: Optional[str] = Field(default=None, min_length=1, max_length=500)
    project_key: Optional[str] = Field(default=None, max_length=50)
    issue_type: Optional[str] = Field(default="Task", max_length=50)
    team_id: Optional[str] = Field(default=None, max_length=50)
    space_id: Optional[str] = Field(default=None, max_length=50)
    folder_id: Optional[str] = Field(default=None, max_length=50)
    list_id: Optional[str] = Field(default=None, max_length=50)


class IntegrationUpdate(BaseModel):
    base_url: Optional[str] = Field(default=None, max_length=500)
    jira_email: Optional[str] = Field(default=None, max_length=255)
    api_token: Optional[str] = Field(default=None, max_length=500)
    project_key: Optional[str] = Field(default=None, max_length=50)
    issue_type: Optional[str] = Field(default=None, max_length=50)
    team_id: Optional[str] = Field(default=None, max_length=50)
    space_id: Optional[str] = Field(default=None, max_length=50)
    folder_id: Optional[str] = Field(default=None, max_length=50)
    list_id: Optional[str] = Field(default=None, max_length=50)
    is_active: Optional[bool] = None


class IntegrationRead(BaseModel):
    id: int
    provider: IntegrationProvider
    base_url: Optional[str] = None
    jira_email: Optional[str] = None
    project_key: Optional[str] = None
    issue_type: Optional[str] = None
    team_id: Optional[str] = None
    space_id: Optional[str] = None
    folder_id: Optional[str] = None
    list_id: Optional[str] = None
    is_active: bool
    has_api_token: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class IntegrationTestResponse(BaseModel):
    provider: IntegrationProvider
    success: bool
    message: str
