from __future__ import annotations

from typing import Iterable, Set

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies.auth import get_current_user, resolve_user_permissions
from app.models.compliance_tasks import ComplianceTask
from app.models.process import Process
from app.models.user import User
from app.models.user_role_scopes import UserRoleScope


TASK_PERMISSIONS = {
    "view": "task.view",
    "create": "task.create",
    "edit": "task.edit",
    "assign": "task.assign",
    "transition": "task.transition",
    "close": "task.close",
    "cancel": "task.cancel",
    "delete": "task.delete",
}


def _normalize_role(value: object) -> str:
    return (
        str(value or "")
        .strip()
        .lower()
        .replace("-", "_")
        .replace(" ", "_")
    )


def _user_role_ids(user: User) -> Set[int]:
    return {
        int(role.id)
        for role in (getattr(user, "roles", None) or [])
        if getattr(role, "id", None) is not None
    }


def _is_super_admin(user: User) -> bool:
    roles = {
        _normalize_role(getattr(role, "name", role))
        for role in (getattr(user, "roles", None) or [])
    }
    return "superadmin" in roles or "super_admin" in roles


def _has_admin_full(db: Session, user: User) -> bool:
    return "admin.full" in resolve_user_permissions(db, user.id)


def _has_task_permission(
    db: Session,
    user: User,
    permission_code: str,
) -> bool:
    if _is_super_admin(user):
        return True

    permissions = resolve_user_permissions(db, user.id)

    if "admin.full" in permissions:
        return True

    # Task authorization is deliberately fail-closed.
    if not permissions:
        return False

    return permission_code in permissions


def _deny(message: str) -> None:
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail=message,
    )


def require_task_permission(permission_code: str):
    """
    Strict Task permission dependency.

    Unlike the legacy require_permission() helper, this dependency
    fails closed when the user has no resolved permissions.
    """

    def checker(
        user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> User:
        if not _has_task_permission(db, user, permission_code):
            _deny(f"Missing permission: {permission_code}")

        return user

    return checker


def _scope_matches(
    scope: UserRoleScope,
    user: User,
    tenant_id: int,
    process_id: int | None,
) -> bool:
    if int(scope.user_id) != int(user.id):
        return False

    if int(scope.tenant_id) != int(tenant_id):
        return False

    if process_id is not None:
        return scope.process_id is None or int(scope.process_id) == int(process_id)

    return True


def user_has_process_scope(
    db: Session,
    user: User,
    process_id: int,
    tenant_id: int | None = None,
) -> bool:
    """
    Returns whether the user has a valid scope for a process.

    A scope with process_id=NULL is treated as tenant-wide.
    A process-specific scope must match the requested process.
    """

    effective_tenant_id = (
        int(tenant_id)
        if tenant_id is not None
        else int(user.tenant_id)
    )

    if effective_tenant_id != int(user.tenant_id):
        return False

    # Keep Task scope behavior aligned with the platform scope model.
    # Super Admin is tenant-wide by definition.
    if _is_super_admin(user):
        return True

    # admin.full also represents unrestricted tenant access.
    if _has_admin_full(db, user):
        return True

    role_ids = _user_role_ids(user)

    if not role_ids:
        return False

    scopes = (
        db.query(UserRoleScope)
        .filter(
            UserRoleScope.user_id == user.id,
            UserRoleScope.tenant_id == effective_tenant_id,
            UserRoleScope.role_id.in_(role_ids),
        )
        .all()
    )

    return any(
        _scope_matches(
            scope,
            user,
            effective_tenant_id,
            process_id,
        )
        for scope in scopes
    )


def require_process_scope(
    process_id: int,
    user: User,
    db: Session,
) -> None:
    process = (
        db.query(Process)
        .filter(Process.id == process_id)
        .first()
    )

    if not process:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Process not found",
        )

    process_tenant_id = getattr(process, "tenant_id", None)

    if process_tenant_id is not None:
        if int(process_tenant_id) != int(user.tenant_id):
            _deny("Process is outside the current tenant")

    if not user_has_process_scope(
        db,
        user,
        process_id,
        int(user.tenant_id),
    ):
        _deny("User has no scope for this process")


def require_task_access(
    db: Session,
    user: User,
    task: ComplianceTask,
) -> None:
    """
    Validates tenant isolation and process scope for an existing task.
    Permission must be checked separately.
    """

    if int(task.tenant_id) != int(user.tenant_id):
        _deny("Task is outside the current tenant")

    if not user_has_process_scope(
        db,
        user,
        int(task.process_id),
        int(task.tenant_id),
    ):
        _deny("User has no scope for this task's process")


def require_task_permission_and_access(
    permission_code: str,
    db: Session,
    user: User,
    task: ComplianceTask,
) -> None:
    """
    Combined helper for service-layer operations on an existing task.
    """

    if not _has_task_permission(db, user, permission_code):
        _deny(f"Missing permission: {permission_code}")

    require_task_access(db, user, task)


def require_assignee_access(
    db: Session,
    actor: User,
    assignee: User,
    process_id: int,
) -> None:
    """
    Validates that an assignee belongs to the same tenant and has
    an applicable scope for the task's process.
    """

    if int(assignee.tenant_id) != int(actor.tenant_id):
        _deny("Assignee is outside the current tenant")

    if not user_has_process_scope(
        db,
        assignee,
        process_id,
        int(actor.tenant_id),
    ):
        _deny("Assignee has no scope for this process")


def require_task_permission_for_create(
    permission_code: str,
    db: Session,
    user: User,
    process_id: int,
) -> None:
    """
    Permission + process scope check for Task creation.
    """

    if not _has_task_permission(db, user, permission_code):
        _deny(f"Missing permission: {permission_code}")

    require_process_scope(process_id, user, db)
