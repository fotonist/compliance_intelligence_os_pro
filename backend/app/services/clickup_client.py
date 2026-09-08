import requests
from datetime import datetime
from sqlalchemy.orm import Session
from app.models.external_integrations import ExternalIntegration
from app.models.task_external_links import TaskExternalLink


class ClickUpClient:

    @staticmethod
    def test_connection(integration):
        if not integration.api_token:
            return {
                "provider": "clickup",
                "success": False,
                "message": "ClickUp token is not configured",
            }

        url = "https://api.clickup.com/api/v2/team"

        headers = {
            "Authorization": integration.api_token,
            "Accept": "application/json",
        }

        try:
            response = requests.get(
                url,
                headers=headers,
                timeout=20,
            )
        except requests.RequestException:
            return {
                "provider": "clickup",
                "success": False,
                "message": "Unable to reach ClickUp",
            }

        if response.status_code != 200:
            if response.status_code in (401, 403):
                return {
                    "provider": "clickup",
                    "success": False,
                    "message": "ClickUp authentication failed",
                }

            return {
                "provider": "clickup",
                "success": False,
                "message": "ClickUp connection test failed",
            }

        if integration.team_id:
            try:
                teams = response.json().get("teams", [])
                team_ids = {
                    str(team.get("id"))
                    for team in teams
                    if team.get("id") is not None
                }

                if str(integration.team_id) not in team_ids:
                    return {
                        "provider": "clickup",
                        "success": False,
                        "message": "Configured ClickUp team was not found",
                    }
            except (TypeError, ValueError):
                return {
                    "provider": "clickup",
                    "success": False,
                    "message": "Invalid ClickUp response",
                }

        return {
            "provider": "clickup",
            "success": True,
            "message": "ClickUp connection successful",
        }

    @staticmethod
    def sync_task(task, db: Session):
        integration = db.query(ExternalIntegration).filter_by(
            tenant_id=task.tenant_id,
            provider="clickup",
            is_active=True,
        ).first()

        if not integration:
            raise Exception("ClickUp integration not configured")

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
