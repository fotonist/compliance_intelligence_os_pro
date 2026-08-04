from sqlalchemy.orm import Query
from app.models.user import User

def tenant_query(query: Query, model, user: User):
    if not hasattr(model, "tenant_id"):
        return query

    return query.filter(model.tenant_id == user.tenant_id)
