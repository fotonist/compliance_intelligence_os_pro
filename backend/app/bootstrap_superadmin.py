"""Create or update the platform Super Admin account.

Usage:
    SUPERADMIN_PASSWORD='change-me' python -m app.bootstrap_superadmin

Optional:
    SUPERADMIN_EMAIL
    SUPERADMIN_NAME
    SUPERADMIN_TENANT_CODE

The password is never stored in source control; it is hashed with the
application's existing bcrypt password utility.
"""

from __future__ import annotations

import os
import sys

from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.core.security import get_password_hash
from app.models.role import Role
from app.models.tenant_premium_module import TenantPremiumModule
from app.models.tenants import Tenant
from app.models.user import User
from app.models.user_role import UserRole


DEFAULT_EMAIL = "superadmin@compliance.local"
DEFAULT_NAME = "Compliance Intelligence Super Admin"

# These are the premium/enterprise module identifiers currently used by the
# application plus the UI route identifiers. The Super Admin bypass is also
# enforced at RBAC level, so new premium modules do not need a new credential.
PREMIUM_MODULE_CODES = {
    "AI_RISK_FORECASTING",
    "EVIDENCE_INTELLIGENCE",
    "OPERATIONAL_INTELLIGENCE",
    "EXECUTIVE_ANALYTICS_CENTER",
    "EXECUTIVE_INTELLIGENCE",
    "REMEDIATION_CENTER",
    "EVIDENCE_LIBRARY",
    "EVIDENCE_REVIEW",
    "INTERNAL_AUDIT",
}


def main() -> int:
    password = os.getenv("SUPERADMIN_PASSWORD")
    if not password:
        print("SUPERADMIN_PASSWORD is required.", file=sys.stderr)
        return 2

    email = os.getenv("SUPERADMIN_EMAIL", DEFAULT_EMAIL).strip().lower()
    full_name = os.getenv("SUPERADMIN_NAME", DEFAULT_NAME).strip()
    tenant_code = os.getenv("SUPERADMIN_TENANT_CODE", "").strip()

    db: Session = SessionLocal()
    try:
        tenant = None
        if tenant_code:
            tenant = db.query(Tenant).filter(Tenant.code == tenant_code).first()
        else:
            tenant = (
                db.query(Tenant)
                .filter(Tenant.status == "active")
                .order_by(Tenant.id.asc())
                .first()
            )

        if not tenant:
            raise RuntimeError(
                "No active tenant found. Set SUPERADMIN_TENANT_CODE to an existing tenant code."
            )

        role = db.query(Role).filter(Role.name == "SuperAdmin").first()
        if not role:
            role = Role(
                name="SuperAdmin",
                description="Unrestricted platform administrator with access to all licensed modules.",
                is_active=True,
            )
            db.add(role)
            db.flush()

        user = db.query(User).filter(User.email == email).first()
        if not user:
            user = User(
                tenant_id=tenant.id,
                email=email,
                hashed_password=get_password_hash(password),
                full_name=full_name,
                is_active=True,
                is_locked=False,
                failed_login_attempts=0,
                must_change_password=False,
                mfa_enabled=False,
                language="en",
                timezone="UTC",
            )
            db.add(user)
            db.flush()
        else:
            user.tenant_id = tenant.id
            user.full_name = full_name
            user.hashed_password = get_password_hash(password)
            user.is_active = True
            user.is_locked = False
            user.failed_login_attempts = 0
            user.must_change_password = False

        link = (
            db.query(UserRole)
            .filter(
                UserRole.user_id == user.id,
                UserRole.role_id == role.id,
            )
            .first()
        )
        if not link:
            db.add(UserRole(user_id=user.id, role_id=role.id))

        for module_code in sorted(PREMIUM_MODULE_CODES):
            module = (
                db.query(TenantPremiumModule)
                .filter(
                    TenantPremiumModule.tenant_id == tenant.id,
                    TenantPremiumModule.module_code == module_code,
                )
                .first()
            )
            if not module:
                db.add(
                    TenantPremiumModule(
                        tenant_id=tenant.id,
                        module_code=module_code,
                        status="ACTIVE",
                        activated_by=user.id,
                    )
                )
            else:
                module.status = "ACTIVE"
                module.activated_by = user.id

        db.commit()

        print("Super Admin ready")
        print(f"Email: {email}")
        print(f"Tenant: {tenant.code}")
        print("Role: SuperAdmin")
        print(f"Premium modules activated: {len(PREMIUM_MODULE_CODES)}")
        return 0
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
