from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import require_roles
from app.core.audit import create_log

from app.models.user import User
from app.models.role import Role
from app.models.user_role import UserRole

from app.schemas.user import User as UserRead
from app.schemas.role import Role as RoleRead


router = APIRouter(
    prefix="/users",
    tags=["Users"],
)

# ------------------------------------------------
# PUBLIC — dropdown için authentication gerektirmez
# GET /users/lookup/roles
# ------------------------------------------------

@router.get(
    "/lookup/roles",
    response_model=list[RoleRead],
)
def list_roles(db: Session = Depends(get_db)):

    roles = (
        db.query(Role)
        .order_by(Role.name)
        .all()
    )

    return roles


# ------------------------------------------------
# GET /users → tüm kullanıcıları listele
# ------------------------------------------------

@router.get(
    "/",
    response_model=list[UserRead],
    dependencies=[Depends(require_roles("admin"))]
)
def list_users(db: Session = Depends(get_db)):

    users = db.query(User).all()
    return users


# ------------------------------------------------
# GET /users/{user_id}/roles
# ------------------------------------------------

@router.get(
    "/{user_id}/roles",
    response_model=list[RoleRead],
    dependencies=[Depends(require_roles("admin"))]
)
def get_user_roles(user_id: int, db: Session = Depends(get_db)):

    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    roles = (
        db.query(Role)
        .join(UserRole, UserRole.role_id == Role.id)
        .filter(UserRole.user_id == user_id)
        .all()
    )

    return roles


# ------------------------------------------------
# GET /users/{user_id}
# ------------------------------------------------

@router.get(
    "/{user_id}",
    response_model=UserRead,
    dependencies=[Depends(require_roles("admin"))]
)
def get_user(user_id: int, db: Session = Depends(get_db)):

    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    return user


# ------------------------------------------------
# POST /users/{user_id}/roles/{role_id}
# ------------------------------------------------

@router.post(
    "/{user_id}/roles/{role_id}",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles("admin"))]
)
def assign_role_to_user(
    user_id: int,
    role_id: int,
    db: Session = Depends(get_db)
):

    user = db.query(User).filter(User.id == user_id).first()
    role = db.query(Role).filter(Role.id == role_id).first()

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    if not role:
        raise HTTPException(
            status_code=404,
            detail="Role not found"
        )

    existing = (
        db.query(UserRole)
        .filter(
            UserRole.user_id == user_id,
            UserRole.role_id == role_id
        )
        .first()
    )

    if existing:
        return {"detail": "Role already assigned"}

    link = UserRole(
        user_id=user_id,
        role_id=role_id
    )

    db.add(link)
    db.commit()

    create_log(
        db,
        user_id=user.id,
        action="assign_role",
        entity="User",
        entity_id=user.id,
        detail=f"Assigned role '{role.name}'",
    )

    return {"detail": "Role assigned"}


# ------------------------------------------------
# DELETE /users/{user_id}/roles/{role_id}
# ------------------------------------------------

@router.delete(
    "/{user_id}/roles/{role_id}",
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_roles("admin"))]
)
def remove_role_from_user(
    user_id: int,
    role_id: int,
    db: Session = Depends(get_db)
):

    link = (
        db.query(UserRole)
        .filter(
            UserRole.user_id == user_id,
            UserRole.role_id == role_id,
        )
        .first()
    )

    if not link:
        raise HTTPException(
            status_code=404,
            detail="Role not assigned"
        )

    db.delete(link)
    db.commit()

    create_log(
        db,
        user_id=user_id,
        action="remove_role",
        entity="User",
        entity_id=user_id,
        detail=f"Removed role_id={role_id}",
    )

    return {"detail": "Role removed"}