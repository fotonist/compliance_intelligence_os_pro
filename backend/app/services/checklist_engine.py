from sqlalchemy.orm import Session

from app.models.task_checklist_item import TaskChecklistItem
from app.models.controls import Control


class ChecklistEngine:

    DEFAULT_EVIDENCE_TYPES = [
        "Policy Document",
        "Procedure Record",
        "Access Log",
        "Training Record",
    ]

    @staticmethod
    def generate_for_task(db: Session, task):
        """
        Generates checklist items based on control.
        """

        control = db.get(Control, task.control_id)

        evidence_types = ChecklistEngine.DEFAULT_EVIDENCE_TYPES

        created = []

        for ev in evidence_types:
            item = TaskChecklistItem(
                task_id=task.id,
                label=ev,
                required=True,
            )
            db.add(item)
            created.append(item)

        db.commit()

        return created