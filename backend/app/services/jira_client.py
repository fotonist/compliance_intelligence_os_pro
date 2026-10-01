import requests
from datetime import datetime
from sqlalchemy.orm import Session
from app.models.external_integrations import ExternalIntegration
from app.models.task_external_links import TaskExternalLink


class JiraClient:

    @staticmethod
    def sync_task(task, db: Session):
        integration = db.query(ExternalIntegration).filter_by(
            tenant_id=task.tenant_id,
            provider="jira",
            is_active=True,
        ).first()

        if not integration:
            raise Exception("Jira integration not configured")

        # Duplicate protection
        existing = db.query(TaskExternalLink).filter_by(
            tenant_id=task.tenant_id,
            task_id=task.id,
            provider="jira",
        ).first()

        if existing:
            return {
                "status": "already_synced",
                "jira_issue": existing.external_key,
            }

        url = f"{integration.base_url}/rest/api/3/issue"

        payload = {
            "fields": {
                "project": {"key": integration.project_key},
                "summary": task.title,
                "description": task.description or "",
                "issuetype": {"name": integration.issue_type or "Task"},
            }
        }

        response = requests.post(
            url,
            json=payload,
            auth=(integration.jira_email, integration.api_token),
            headers={"Content-Type": "application/json"},
            timeout=20,
        )

        if response.status_code >= 300:
            raise Exception(f"Jira error: {response.text}")

        issue_key = response.json()["key"]

        link = TaskExternalLink(
            tenant_id=task.tenant_id,
            task_id=task.id,
            provider="jira",
            external_key=issue_key,
            sync_status="synced",
            last_synced_at=datetime.utcnow(),
        )

        db.add(link)
        db.commit()

        return {
            "status": "synced",
            "jira_issue": issue_key,
        }