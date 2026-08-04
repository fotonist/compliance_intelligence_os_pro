from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.security import get_current_user
from app.services.heatmap_engine import HeatmapEngine


router = APIRouter(prefix="/company/heatmap", tags=["Executive"])


@router.get("/processes/{process_id}")
def get_heatmap(
    process_id: int,
    db: Session = Depends(get_db),
    user = Depends(get_current_user),
):
    return HeatmapEngine.compute_for_process(
        process_id=process_id,
        db=db,
        user=user,
    )