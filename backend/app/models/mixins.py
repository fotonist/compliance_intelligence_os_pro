from sqlalchemy import Column, Integer, ForeignKey
from sqlalchemy.orm import declared_attr

class TenantMixin:
    @declared_attr
    def tenant_id(cls):
        return Column(
            Integer,
            ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        )
