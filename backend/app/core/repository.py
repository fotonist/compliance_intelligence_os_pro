from sqlalchemy.orm import Session
from app.core.tenant import tenant_query

class TenantRepository:
    def __init__(self, model, db: Session, user):
        self.model = model
        self.db = db
        self.user = user

    def query(self):
        return tenant_query(
            self.db.query(self.model),
            self.model,
            self.user,
        )

    def get(self, id: int):
        return (
            self.query()
            .filter(self.model.id == id)
            .first()
        )
