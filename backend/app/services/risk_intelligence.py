# backend/app/services/risk_intelligence.py

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any, Dict, Iterable, List, Optional, Tuple

from sqlalchemy.orm import Session

# NOTE:
# Bu servis "pure logic" + "opsiyonel DB yardımcıları" içerir.
# Model importlarını minimumda tutuyoruz (circular/import hatası riskini azaltmak için).
# Kullanacağın yerlerde risk_versions modeli zaten yüklenmiş olmalı.


@dataclass(frozen=True)
class RiskPoint:
    ts: datetime
    score: Optional[float]
    likelihood: Optional[float] = None
    impact: Optional[float] = None
    status: Optional[str] = None
    treatment: Optional[str] = None
    action: Optional[str] = None


@dataclass(frozen=True)
class RiskVelocityResult:
    days: int
    first_score: Optional[float]
    last_score: Optional[float]
    velocity_per_day: Optional[float]  # + kötüleşme, - iyileşme
    direction: str  # "improving" | "worsening" | "flat" | "unknown"


@dataclass(frozen=True)
class StabilityResult:
    total_points: int
    status_changes: int
    high_reentries: int
    stability_score: float  # 0..100 (100 en stabil)


@dataclass(frozen=True)
class PortfolioDriftResult:
    window_days: int
    current_avg: Optional[float]
    past_avg: Optional[float]
    drift: Optional[float]  # + kötüleşme, - iyileşme
    direction: str  # "improving" | "worsening" | "flat" | "unknown"


@dataclass(frozen=True)
class MitigationEffectivenessResult:
    baseline_score: Optional[float]
    current_score: Optional[float]
    improvement: Optional[float]  # + iyileşme (baseline - current)
    direction: str  # "improved" | "worsened" | "flat" | "unknown"


# ============================================================
# PURE METRICS (DB bağımsız)
# ============================================================

def _safe_float(v: Any) -> Optional[float]:
    try:
        if v is None:
            return None
        return float(v)
    except Exception:
        return None


def _days_between(a: datetime, b: datetime) -> int:
    d = (b.date() - a.date()).days
    return max(d, 0)


def compute_risk_velocity(points: List[RiskPoint]) -> RiskVelocityResult:
    """
    velocity = (last_score - first_score) / days
    + => kötüleşme, - => iyileşme
    """
    if not points:
        return RiskVelocityResult(
            days=0,
            first_score=None,
            last_score=None,
            velocity_per_day=None,
            direction="unknown",
        )

    pts = sorted(points, key=lambda p: p.ts)
    first = pts[0]
    last = pts[-1]

    first_score = _safe_float(first.score)
    last_score = _safe_float(last.score)

    days = _days_between(first.ts, last.ts)
    if first_score is None or last_score is None:
        return RiskVelocityResult(days=days, first_score=first_score, last_score=last_score, velocity_per_day=None, direction="unknown")

    if days == 0:
        delta = last_score - first_score
        if abs(delta) < 1e-9:
            direction = "flat"
        elif delta > 0:
            direction = "worsening"
        else:
            direction = "improving"
        return RiskVelocityResult(days=0, first_score=first_score, last_score=last_score, velocity_per_day=None, direction=direction)

    vpd = (last_score - first_score) / float(days)
    if abs(vpd) < 1e-9:
        direction = "flat"
    elif vpd > 0:
        direction = "worsening"
    else:
        direction = "improving"

    return RiskVelocityResult(
        days=days,
        first_score=first_score,
        last_score=last_score,
        velocity_per_day=vpd,
        direction=direction,
    )


def compute_stability(points: List[RiskPoint], high_labels: Tuple[str, ...] = ("HIGH", "High", "high")) -> StabilityResult:
    """
    Stabilite:
    - status_changes: ardışık status değişim sayısı
    - high_reentries: HIGH durumuna tekrar giriş sayısı (HIGH -> (non-high) -> HIGH)
    - stability_score: 100 - min(100, (status_changes*10 + high_reentries*20))
      (basit, okunur, kolay ayarlanır)
    """
    if not points:
        return StabilityResult(total_points=0, status_changes=0, high_reentries=0, stability_score=0.0)

    pts = sorted(points, key=lambda p: p.ts)
    statuses = [p.status for p in pts if p.status is not None]

    status_changes = 0
    high_reentries = 0

    prev = None
    prev_is_high = False
    left_high_once = False

    for s in statuses:
        if prev is not None and s != prev:
            status_changes += 1

        is_high = s in high_labels
        if prev_is_high and not is_high:
            left_high_once = True
        if left_high_once and is_high and not prev_is_high:
            high_reentries += 1
            left_high_once = False  # bir re-entry sayıldıktan sonra tekrar çıkış bekleriz

        prev = s
        prev_is_high = is_high

    penalty = min(100.0, status_changes * 10.0 + high_reentries * 20.0)
    stability_score = max(0.0, 100.0 - penalty)

    return StabilityResult(
        total_points=len(points),
        status_changes=status_changes,
        high_reentries=high_reentries,
        stability_score=stability_score,
    )


def compute_portfolio_drift(
    current_scores: Iterable[Any],
    past_scores: Iterable[Any],
    window_days: int = 30,
) -> PortfolioDriftResult:
    """
    drift = current_avg - past_avg
    + => kötüleşme, - => iyileşme
    """
    cur = [_safe_float(x) for x in current_scores]
    pst = [_safe_float(x) for x in past_scores]

    cur_vals = [x for x in cur if x is not None]
    pst_vals = [x for x in pst if x is not None]

    current_avg = (sum(cur_vals) / len(cur_vals)) if cur_vals else None
    past_avg = (sum(pst_vals) / len(pst_vals)) if pst_vals else None

    if current_avg is None or past_avg is None:
        return PortfolioDriftResult(
            window_days=window_days,
            current_avg=current_avg,
            past_avg=past_avg,
            drift=None,
            direction="unknown",
        )

    drift = current_avg - past_avg
    if abs(drift) < 1e-9:
        direction = "flat"
    elif drift > 0:
        direction = "worsening"
    else:
        direction = "improving"

    return PortfolioDriftResult(
        window_days=window_days,
        current_avg=current_avg,
        past_avg=past_avg,
        drift=drift,
        direction=direction,
    )


def compute_mitigation_effectiveness(points: List[RiskPoint]) -> MitigationEffectivenessResult:
    """
    Baseline: ilk point'teki score
    Current: son point'teki score
    improvement = baseline - current   (+ iyileşme)
    """
    if not points:
        return MitigationEffectivenessResult(None, None, None, "unknown")

    pts = sorted(points, key=lambda p: p.ts)
    baseline = _safe_float(pts[0].score)
    current = _safe_float(pts[-1].score)

    if baseline is None or current is None:
        return MitigationEffectivenessResult(baseline, current, None, "unknown")

    improvement = baseline - current
    if abs(improvement) < 1e-9:
        direction = "flat"
    elif improvement > 0:
        direction = "improved"
    else:
        direction = "worsened"

    return MitigationEffectivenessResult(baseline, current, improvement, direction)


# ============================================================
# DB HELPERS (Hybrid için: live versions + snapshot points)
# ============================================================

def build_points_from_risk_versions(risk_versions: List[Any]) -> List[RiskPoint]:
    """
    RiskVersion ORM objelerinden RiskPoint üretir.
    Alanlar yoksa getattr ile None döner (generic).
    """
    pts: List[RiskPoint] = []
    for rv in risk_versions:
        ts = getattr(rv, "created_at", None) or getattr(rv, "timestamp", None) or getattr(rv, "ts", None)
        if ts is None:
            continue

        pts.append(
            RiskPoint(
                ts=ts,
                score=_safe_float(getattr(rv, "score", None)),
                likelihood=_safe_float(getattr(rv, "likelihood", None)),
                impact=_safe_float(getattr(rv, "impact", None)),
                status=getattr(rv, "status", None),
                treatment=getattr(rv, "treatment", None),
                action=getattr(rv, "action", None),
            )
        )
    return pts


def fetch_risk_versions(
    db: Session,
    tenant_id: int,
    risk_id: int,
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
) -> List[Any]:
    """
    Live: risk_versions üzerinden timeline çeker.
    RiskVersion importunu burada yapıyoruz ki startup'ta circular risk azalıyor.
    """
    from app.models.risk_versions import RiskVersion  # local import

    q = db.query(RiskVersion).filter(RiskVersion.tenant_id == tenant_id, RiskVersion.risk_id == risk_id)
    if start is not None:
        q = q.filter(RiskVersion.created_at >= start)
    if end is not None:
        q = q.filter(RiskVersion.created_at <= end)

    return q.order_by(RiskVersion.created_at.asc(), RiskVersion.id.asc()).all()


def fetch_snapshot_points_for_risk(
    db: Session,
    tenant_id: int,
    risk_id: int,
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
) -> List[RiskPoint]:
    """
    Snapshot: audit snapshot JSON içinden risk noktalarını çıkarır.
    Eğer senin projede snapshot tablosu farklı isimle/alanla ise,
    burada sadece tek noktayı değiştirmen yeter.
    """
    try:
        from app.models.audit_snapshots import AuditSnapshot  # varsa
    except Exception:
        return []

    q = db.query(AuditSnapshot).filter(AuditSnapshot.tenant_id == tenant_id)
    if start is not None:
        q = q.filter(AuditSnapshot.created_at >= start)
    if end is not None:
        q = q.filter(AuditSnapshot.created_at <= end)

    rows = q.order_by(AuditSnapshot.created_at.asc(), AuditSnapshot.id.asc()).all()

    out: List[RiskPoint] = []
    for s in rows:
        ts = getattr(s, "created_at", None)
        payload = getattr(s, "payload", None) or getattr(s, "snapshot", None)
        if not ts or not isinstance(payload, dict):
            continue

        risks = payload.get("risks") or []
        if not isinstance(risks, list):
            continue

        for r in risks:
            if not isinstance(r, dict):
                continue
            if r.get("risk_id") != risk_id:
                continue

            out.append(
                RiskPoint(
                    ts=ts,
                    score=_safe_float(r.get("score")),
                    likelihood=_safe_float(r.get("likelihood")),
                    impact=_safe_float(r.get("impact")),
                    status=r.get("status"),
                    treatment=r.get("treatment"),
                    action=r.get("action"),
                )
            )
            break

    return out


def build_hybrid_timeline(
    db: Session,
    tenant_id: int,
    risk_id: int,
    window_days: int = 180,
    now: Optional[datetime] = None,
) -> Dict[str, Any]:
    """
    Hybrid timeline üretir:
    - live_points: risk_versions
    - snapshot_points: audit snapshots (varsa)
    - merged_points: aynı gün/saat çatışmasını çözmeden basit birleştirme (UI tarafı seçer)
    - metrics: velocity, stability, mitigation
    """
    now = now or datetime.utcnow()
    start = now - timedelta(days=window_days)

    live_versions = fetch_risk_versions(db, tenant_id=tenant_id, risk_id=risk_id, start=start, end=now)
    live_points = build_points_from_risk_versions(live_versions)

    snapshot_points = fetch_snapshot_points_for_risk(db, tenant_id=tenant_id, risk_id=risk_id, start=start, end=now)

    velocity = compute_risk_velocity(live_points)
    stability = compute_stability(live_points)
    mitigation = compute_mitigation_effectiveness(live_points)

    merged = sorted((live_points + snapshot_points), key=lambda p: p.ts)

    return {
        "risk_id": risk_id,
        "tenant_id": tenant_id,
        "window_days": window_days,
        "live_points": [p.__dict__ for p in live_points],
        "snapshot_points": [p.__dict__ for p in snapshot_points],
        "merged_points": [p.__dict__ for p in merged],
        "metrics": {
            "velocity": velocity.__dict__,
            "stability": stability.__dict__,
            "mitigation": mitigation.__dict__,
        },
    }
