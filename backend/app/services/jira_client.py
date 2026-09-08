import requests
from datetime import datetime
from sqlalchemy.orm import Session
from app.models.external_integrations import ExternalIntegration
from app.models.task_external_links import TaskExternalLink


class JiraClient:

    @staticmethod
    def test_connection(integration):
        base_url = (integration.base_url or "").strip().rstrip("/")

        if not base_url:
            return {
                "provider": "jira",
                "success": False,
                "message": "Jira base URL is not configured",
            }

        if not integration.jira_email or not integration.api_token:
            return {
                "provider": "jira",
                "success": False,
                "message": "Jira credentials are not configured",
            }

        url = f"{base_url}/rest/api/3/myself"

        try:
            response = requests.get(
                url,
                auth=(integration.jira_email, integration.api_token),
                headers={"Accept": "application/json"},
                timeout=20,
            )
        except requests.RequestException as exc:
            return {
                "provider": "jira",
                "success": False,
                "message": f"Unable to reach Jira: {exc}",
            }

        if response.status_code == 200:
            return {
                "provider": "jira",
                "success": True,
                "message": "Jira connection successful",
            }

        if response.status_code in (401, 403):
            return {
                "provider": "jira",
                "success": False,
                "message": f"Jira authentication failed ({response.status_code})",
            }

        body = (response.text or "").strip()

        if len(body) > 500:
            body = body[:500]

        return {
            "provider": "jira",
            "success": False,
            "message": f"Jira connection test failed ({response.status_code}): {body}",
        }

    @staticmethod
    def sync_task(task, db: Session):
        integration = db.query(ExternalIntegration).filter_by(
            tenant_id=task.tenant_id,
            provider="jira",
            is_active=True,
        ).first()

        if not integration:
            raise Exception("Jira integration not configured")

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

        base_url = (integration.base_url or "").strip().rstrip("/")

        if not base_url:
            raise Exception("Jira base URL is not configured")

        if not integration.jira_email or not integration.api_token:
            raise Exception("Jira credentials are not configured")

        if not integration.project_key:
            raise Exception("Jira project key is not configured")

        url = f"{base_url}/rest/api/3/issue"

        payload = {
            "fields": {
                "project": {
                    "key": integration.project_key,
                },
                "summary": task.title or "Compliance Task",
                "description": {
                    "type": "doc",
                    "version": 1,
                    "content": [
                        {
                            "type": "paragraph",
                            "content": [
                                {
                                    "type": "text",
                                    "text": task.description or "Compliance task",
                                }
                            ],
                        }
                    ],
                },
                "issuetype": {
                    "name": integration.issue_type or "Task",
                },
            }
        }

        try:
            response = requests.post(
                url,
                json=payload,
                auth=(integration.jira_email, integration.api_token),
                headers={
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                },
                timeout=20,
            )
        except requests.RequestException as exc:
            raise Exception(f"Unable to reach Jira: {exc}") from exc

        if response.status_code >= 300:
            body = (response.text or "").strip()

            if len(body) > 1000:
                body = body[:1000]

            raise Exception(
                f"Jira issue creation failed ({response.status_code}): {body}"
            )

        try:
            data = response.json()
        except ValueError as exc:
            body = (response.text or "").strip()

            if len(body) > 1000:
                body = body[:1000]

            raise Exception(
                f"Jira returned a non-JSON response ({response.status_code}): {body}"
            ) from exc

        issue_key = data.get("key")

        if not issue_key:
            raise Exception(
                f"Jira response did not contain an issue key: {data}"
            )

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


