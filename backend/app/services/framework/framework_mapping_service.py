from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.models.matrix_instance import MatrixInstance
from app.models.matrix_row import MatrixRow


class FrameworkMappingService:
    """
    Tenant-specific framework mapping/projection erişim servisi.

    MatrixRow canonical framework mapping kaynağı değildir.
    Bu servis mevcut tenant matrix projection'ını okur.
    """

    def __init__(self, db: Session):
        self.db = db

    def list_rows(
        self,
        tenant_id: int,
        standard_id: Optional[int] = None,
        instance_id: Optional[int] = None,
    ) -> List[MatrixRow]:
        query = (
            self.db.query(MatrixRow)
            .join(
                MatrixInstance,
                MatrixInstance.id == MatrixRow.instance_id,
            )
            .filter(
                MatrixRow.tenant_id == tenant_id,
                MatrixInstance.tenant_id == tenant_id,
            )
        )

        if standard_id is not None:
            query = query.filter(MatrixRow.standard_id == standard_id)

        if instance_id is not None:
            query = query.filter(MatrixRow.instance_id == instance_id)

        return query.order_by(MatrixRow.id.asc()).all()

    def get_row(
        self,
        tenant_id: int,
        row_id: int,
    ) -> Optional[MatrixRow]:
        return (
            self.db.query(MatrixRow)
            .join(
                MatrixInstance,
                MatrixInstance.id == MatrixRow.instance_id,
            )
            .filter(
                MatrixRow.id == row_id,
                MatrixRow.tenant_id == tenant_id,
                MatrixInstance.tenant_id == tenant_id,
            )
            .first()
        )

    def summarize(
        self,
        tenant_id: int,
        standard_id: Optional[int] = None,
        instance_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        rows = self.list_rows(
            tenant_id=tenant_id,
            standard_id=standard_id,
            instance_id=instance_id,
        )

        return {
            "tenant_id": tenant_id,
            "standard_id": standard_id,
            "instance_id": instance_id,
            "row_count": len(rows),
            "control_count": sum(
                1 for row in rows if row.control_id is not None
            ),
            "requirement_count": sum(
                1 for row in rows if row.requirement_id is not None
            ),
            "clause_count": sum(
                1 for row in rows if row.clause_id is not None
            ),
        }
