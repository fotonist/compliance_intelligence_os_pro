from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

# ❗ DÜZELTİLDİ: check_role → require_roles
from app.core.security import require_roles
# from app.core.database import get_db
from app.models.role import Role as RoleModel
from app.models.user import User as UserModel
from app.models.user_role import UserRole
from app.schemas.role import RoleCreate, RoleUpdate, Role as RoleRead

router = APIRouter(
    prefix="/roles",
    tags=["roles"],
)


# ---------------------------
# ROLE CRUD
# ---------------------------

@router.get(
    "/",
    response_model=List[RoleRead],
    dependencies=[Depends(require_roles("admin"))]  # ❗ DÜZELTİLDİ
)
def list_roles(db: Session = Depends(get_db)):
    roles = db.query(RoleModel).all()
    return roles


@router.post(
    "/",
    response_model=RoleRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles("admin"))]  # ❗ DÜZELTİLDİ
)
def create_role(payload: RoleCreate, db: Session = Depends(get_db)):
    existing = db.query(RoleModel).filter(RoleModel.name == payload.name).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Role with this name already exists",
        )

    role = RoleModel(name=payload.name)
    db.add(role)
    db.commit()
    db.refresh(role)
    return role


@router.put(
    "/{role_id}",
    response_model=RoleRead,
    dependencies=[Depends(require_roles("admin"))]  # ❗ DÜZELTİLDİ
)
def update_role(role_id: int, payload: RoleUpdate, db: Session = Depends(get_db)):
    role = db.query(RoleModel).filter(RoleModel.id == role_id).first()
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found",
        )

    if payload.name is not None:
        existing = (
            db.query(RoleModel)
            .filter(RoleModel.name == payload.name, RoleModel.id != role_id)
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Another role with this name already exists",
            )
        role.name = payload.name

    db.commit()
    db.refresh(role)
    return role


@router.delete(
    "/{role_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_roles("admin"))]  # ❗ DÜZELTİLDİ
)
def delete_role(role_id: int, db: Session = Depends(get_db)):
    role = db.query(RoleModel).filter(RoleModel.id == role_id).first()
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found",
        )

    db.delete(role)
    db.commit()
    return None


# ---------------------------
# USER ↔ ROLE ATAMA
# ---------------------------

@router.post(
    "/assign/{user_id}/{role_id}",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles("admin"))]  # ❗ DÜZELTİLDİ
)
def assign_role_to_user(user_id: int, role_id: int, db: Session = Depends(get_db)):
    user = db.query(UserModel).filter(UserModel.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    role = db.query(RoleModel).filter(RoleModel.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    existing = db.query(UserRole).filter(
        UserRole.user_id == user_id,
        UserRole.role_id == role_id,
    ).first()

    if existing:
        return {"detail": "Role already assigned to user"}

    user_role = UserRole(user_id=user_id, role_id=role_id)
    db.add(user_role)
    db.commit()
    return {"detail": "Role assigned to user"}


@router.delete(
    "/assign/{user_id}/{role_id}",
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_roles("admin"))]  # ❗ DÜZELTİLDİ
)
def remove_role_from_user(user_id: int, role_id: int, db: Session = Depends(get_db)):
    existing = db.query(UserRole).filter(
        UserRole.user_id == user_id,
        UserRole.role_id == role_id,
    ).first()

    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User does not have this role",
        )

    db.delete(existing)
    db.commit()
    return {"detail": "Role removed from user"}
