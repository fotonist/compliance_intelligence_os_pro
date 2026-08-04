import requests
from datetime import datetime
from sqlalchemy.orm import Session
from app.models.external_integrations import ExternalIntegration
from app.models.task_external_links import TaskExternalLink


class ClickUpClient:

    @staticmethod
    def sync_task(task, db: Session):
        integration = db.query(ExternalIntegration).filter_by(
            tenant_id=task.tenant_id,
            provider="clickup",
            is_active=True,
        ).first()

        if not integration:
            raise Exception("ClickUp integration not configured")

        # Idempotency check
        existing = db.query(TaskExternalLink).filter_by(
            tenant_id=task.tenant_id,
            task_id=task.id,
            provider="clickup",
        ).first()

        if existing:
            return {
                "status": "already_synced",
                "clickup_task_id": existing.external_key,
            }

        if not integration.list_id:
            raise Exception("ClickUp list_id not configured")

        url = f"https://api.clickup.com/api/v2/list/{integration.list_id}/task"

        payload = {
            "name": task.title,
            "description": task.description or "",
            "status": "open",
        }

        headers = {
            "Authorization": integration.api_token,
            "Content-Type": "application/json",
        }

        response = requests.post(
            url,
            json=payload,
            headers=headers,
            timeout=20,
        )

        if response.status_code >= 300:
            raise Exception(f"ClickUp error: {response.text}")

        task_id = response.json()["id"]

        link = TaskExternalLink(
            tenant_id=task.tenant_id,
            task_id=task.id,
            provider="clickup",
            external_key=task_id,
            sync_status="synced",
            last_synced_at=datetime.utcnow(),
        )

        db.add(link)
        db.commit()

        return {
            "status": "synced",
            "clickup_task_id": task_id,
        }