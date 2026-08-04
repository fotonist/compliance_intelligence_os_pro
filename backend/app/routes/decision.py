from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.core.security import get_current_user
from app.db.session import get_db
from app.models.user import User

from app.models.compliance_task import ComplianceTask
from app.models.audit_plan_item import AuditPlanItem
from app.models.gap_item import GapItem

from app.schemas.decision import (
    ApplyRequest,
    ApplyResponse,
    ApplyCreatedItem,
    ApplySkippedItem,
    DecisionPackageOut,
)

from app.services.risk_decision_engine import RiskDecisionEngine, DecisionRuleSet

router = APIRouter(prefix="/company/decision", tags=["Company", "Decision"])


# ---------------------------------------------------------
# READ ACTIONS
# ---------------------------------------------------------

@router.get("/actions", response_model=DecisionPackageOut)
def decision_actions(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    tenant_id = user.tenant_id
    if not tenant_id:
        raise HTTPException(status_code=400, detail="tenant_id missing")

    engine = RiskDecisionEngine(rules=DecisionRuleSet())
    return engine.generate_actions(db, tenant_id)


# ---------------------------------------------------------
# APPLY EXECUTION
# ---------------------------------------------------------

@router.post("/apply", response_model=ApplyResponse)
def decision_apply(
    body: ApplyRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    tenant_id = user.tenant_id
    if not tenant_id:
        raise HTTPException(status_code=400, detail="tenant_id missing")

    engine = RiskDecisionEngine(rules=DecisionRuleSet())
    pkg = engine.generate_actions(db, tenant_id)

    created = []
    skipped = []
    created_count = 0

    actions = []
    if body.include_exec_alerts:
        actions.extend(pkg.get("exec_alerts", []))
    if body.include_tasks:
        actions.extend(pkg.get("tasks", []))
    if body.include_gaps:
        actions.extend(pkg.get("gaps", []))

    for a in actions:

        if created_count >= body.max_create:
            break

        risk_id = a.get("risk_id")
        forecast_id = a.get("forecast_id")
        control_id = a.get("control_id")
        process_id = a.get("process_id")
        prob = float(a.get("escalation_probability_30d") or 0)
        delta = float(a.get("expected_score_delta") or 0)
        priority = a.get("priority") or "MEDIUM"
        title = a.get("title") or "AI Generated Item"
        description = a.get("description") or ""

        # -------------------------------------------------
        # 1️⃣ AUDIT PLAN ITEM
        # -------------------------------------------------
        audit_item = None

        try:
            audit_item = AuditPlanItem(
                tenant_id=tenant_id,
                risk_id=risk_id,
                control_id=control_id,
                process_id=process_id,
                forecast_id=forecast_id,
                escalation_probability_30d=prob,
                expected_score_delta=delta,
                priority=priority,
                source="forecast",
                status="planned",
                snapshot_at=datetime.utcnow(),
            )
            db.add(audit_item)
            db.flush()

        except IntegrityError:
            db.rollback()
            skipped.append(
                ApplySkippedItem(
                    action_type="audit_plan",
                    risk_id=risk_id,
                    forecast_id=forecast_id,
                    reason="audit_plan_already_exists",
                )
            )
            continue

        # -------------------------------------------------
        # 2️⃣ GAP ITEM (if needed)
        # -------------------------------------------------
        gap_item = None

        if delta >= 5:
            try:
                gap_item = GapItem(
                    tenant_id=tenant_id,
                    risk_id=risk_id,
                    control_id=control_id,
                    forecast_id=forecast_id,
                    gap_type="predictive",
                    severity_score=delta,
                    status="open",
                )
                db.add(gap_item)
                db.flush()
            except IntegrityError:
                db.rollback()
                skipped.append(
                    ApplySkippedItem(
                        action_type="gap_item",
                        risk_id=risk_id,
                        forecast_id=forecast_id,
                        reason="gap_already_exists",
                    )
                )
                continue

        # -------------------------------------------------
        # 3️⃣ COMPLIANCE TASK
        # -------------------------------------------------

        if not process_id:
            skipped.append(
                ApplySkippedItem(
                    action_type="compliance_task",
                    risk_id=risk_id,
                    forecast_id=forecast_id,
                    reason="process_id_missing",
                )
            )
            continue

        try:

            priority_score = int(min(100, max(0, round(prob * 70 + min(delta, 10) * 3))))

            source_type = "audit_plan"
            source_id = audit_item.id if audit_item else None

            task = ComplianceTask(
                tenant_id=tenant_id,
                process_id=process_id,
                control_id=control_id,
                priority_score=priority_score,
                owner_role="process_owner",
                due_date=datetime.utcnow() + timedelta(days=14),
                status="open",
                source_type=source_type,
                source_id=source_id,
                title=title,
                description=description,
            )

            db.add(task)
            db.flush()

        except IntegrityError:
            db.rollback()
            skipped.append(
                ApplySkippedItem(
                    action_type="compliance_task",
                    risk_id=risk_id,
                    forecast_id=forecast_id,
                    reason="task_already_exists",
                )
            )
            continue

        created.append(
            ApplyCreatedItem(
                action_type="full_pipeline",
                task_id=task.id,
                risk_id=risk_id,
                process_id=process_id,
                control_id=control_id,
                forecast_id=forecast_id,
                title=title,
            )
        )

        created_count += 1

    db.commit()

    return ApplyResponse(
        tenant_id=tenant_id,
        dry_run=body.dry_run,
        created=created,
        skipped=skipped,
        counts={
            "created": len(created),
            "skipped": len(skipped),
        },
    )