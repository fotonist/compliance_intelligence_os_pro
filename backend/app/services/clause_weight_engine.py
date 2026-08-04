import math
from collections import defaultdict
from sqlalchemy.orm import Session
from sqlalchemy import select, and_

from app.models.user import User
from app.models.standards import Standard
from app.models.clauses import Clause
from app.models.clause_weight_override import ClauseWeightOverride
from app.services.audit_plan_engine import AuditPlanEngine


class ClauseWeightEngine:
    """
    Produces clause weights (%), per standard, per process.

    Inputs:
    - gaps/actions via generate_audit_plan()
    - overrides via clause_weight_overrides

    Output:
    - weights normalized to 100 per standard
    """

    RISK_LEVEL_FACTOR = {
        "LOW": 0.2,
        "MEDIUM": 0.6,
        "HIGH": 1.0,
        "CRITICAL": 1.3,
        None: 0.0,
    }

    @staticmethod
    def compute_for_process(
        process_id: int,
        db: Session,
        user: User,
        standard_code: str | None = None,
    ):
        audit_plan = AuditPlanEngine.generate(process_id, db, user)

        # Aggregate per (standard_code, clause_code)
        agg = defaultdict(lambda: {
            "count": 0,
            "max_risk_score": 0,
            "highest_risk_level": None,
            "priority_sum": 0,
        })

        for a in audit_plan.actions:
            if standard_code and a.standard_code != standard_code:
                continue

            key = (a.standard_code, a.clause_code)
            row = agg[key]
            row["count"] += 1
            row["priority_sum"] += int(a.priority_score or 0)

            max_rs = int(a.max_risk_score or 0)
            if max_rs > row["max_risk_score"]:
                row["max_risk_score"] = max_rs
                row["highest_risk_level"] = a.highest_risk_level

        # Convert to raw weights
        raw = defaultdict(dict)  # standard_code -> clause_code -> raw_weight
        meta = defaultdict(dict)

        for (std_code, cl_code), v in agg.items():
            count = v["count"]
            max_risk_score = v["max_risk_score"]
            highest_level = v["highest_risk_level"]
            avg_priority = (v["priority_sum"] / count) if count else 0

            # Weight formula (stable v1):
            # - gap_factor: log growth (prevents huge spikes)
            # - risk_factor: max_risk_score scales linearly + level factor
            # - priority_factor: small linear influence
            gap_factor = 1.0 + 0.7 * math.log1p(count)
            level_factor = ClauseWeightEngine.RISK_LEVEL_FACTOR.get(highest_level, 0.0)
            risk_factor = 1.0 + (max_risk_score / 100.0) * (0.8 + level_factor)
            priority_factor = 1.0 + (avg_priority / 100.0) * 0.3

            w = gap_factor * risk_factor * priority_factor

            raw[std_code][cl_code] = w
            meta[std_code][cl_code] = {
                "gap_count": count,
                "max_risk_score": max_risk_score,
                "highest_risk_level": highest_level,
                "avg_priority_score": round(avg_priority, 2),
                "raw_weight": round(w, 6),
            }

        # Apply overrides (tenant + standard + clause)
        overrides = ClauseWeightEngine._fetch_overrides(db, user, standard_code=standard_code)

        final = {}
        for std_code, clauses_map in raw.items():
            final[std_code] = ClauseWeightEngine._normalize_with_overrides(
                std_code=std_code,
                clause_raw=clauses_map,
                overrides=overrides.get(std_code, {}),
            )

        return {
            "process_id": process_id,
            "standard_filter": standard_code,
            "weights": final,
            "meta": meta,
            "overrides": overrides,
        }

    @staticmethod
    def _fetch_overrides(db: Session, user: User, standard_code: str | None):
        """
        Returns:
        { standard_code: { clause_code: { weight_pct, rationale } } }
        """
        # Load standards
        std_stmt = select(Standard).where(Standard.id.isnot(None))
        standards = db.execute(std_stmt).scalars().all()
        std_by_id = {s.id: s for s in standards}
        std_by_code = {s.code: s for s in standards}

        if standard_code and standard_code not in std_by_code:
            return {}

        stmt = select(ClauseWeightOverride).where(
            and_(
                ClauseWeightOverride.tenant_id == user.tenant_id,
                ClauseWeightOverride.is_active == True,
            )
        )
        rows = db.execute(stmt).scalars().all()

        # map clause_id -> clause_code (+ standard_code)
        clause_ids = {r.clause_id for r in rows}
        if not clause_ids:
            return {}

        clauses = db.execute(
            select(Clause).where(Clause.id.in_(list(clause_ids)))
        ).scalars().all()
        clause_by_id = {c.id: c for c in clauses}

        out = defaultdict(dict)
        for r in rows:
            std = std_by_id.get(r.standard_id)
            cl = clause_by_id.get(r.clause_id)
            if not std or not cl:
                continue
            if standard_code and std.code != standard_code:
                continue

            out[std.code][cl.code] = {
                "weight_pct": float(r.weight_pct),
                "rationale": r.rationale,
            }

        return out

    @staticmethod
    def _normalize_with_overrides(std_code: str, clause_raw: dict, overrides: dict):
        """
        clause_raw: { clause_code: raw_weight }
        overrides: { clause_code: {weight_pct, rationale} }

        Strategy:
        - If overrides exist: fixed weights for those clauses.
        - Remaining clauses share remaining % by raw proportions.
        - If overrides exceed 100 -> clamp remaining to 0 and normalize overrides down to 100.
        """
        # Base clause list
        all_clauses = list(clause_raw.keys())
        if not all_clauses:
            # If no gaps, no clauses to weight
            return {
                "normalized_pct": {},
                "override_pct": overrides,
            }

        override_sum = 0.0
        for c, v in overrides.items():
            if c in clause_raw:
                override_sum += float(v["weight_pct"])

        # If override_sum > 100: scale down overrides
        if override_sum > 100.0 and override_sum > 0:
            scale = 100.0 / override_sum
            scaled = {}
            for c, v in overrides.items():
                if c not in clause_raw:
                    continue
                scaled[c] = {
                    "weight_pct": round(float(v["weight_pct"]) * scale, 4),
                    "rationale": v.get("rationale"),
                }
            overrides = scaled
            override_sum = 100.0

        remaining_pct = max(0.0, 100.0 - override_sum)

        # Normalize non-overridden
        non_overridden = {c: w for c, w in clause_raw.items() if c not in overrides}
        denom = sum(non_overridden.values()) if non_overridden else 0.0

        normalized = {}

        # set overridden weights
        for c, v in overrides.items():
            if c in clause_raw:
                normalized[c] = round(float(v["weight_pct"]), 4)

        # distribute remaining
        if remaining_pct > 0 and denom > 0:
            for c, w in non_overridden.items():
                normalized[c] = round((w / denom) * remaining_pct, 4)
        elif remaining_pct > 0 and denom == 0:
            # fallback equal split
            n = len(non_overridden)
            if n:
                each = remaining_pct / n
                for c in non_overridden.keys():
                    normalized[c] = round(each, 4)

        # Final tiny correction to sum=100 (floating drift)
        s = sum(normalized.values())
        if s != 100.0 and normalized:
            # adjust the largest element
            k = max(normalized.keys(), key=lambda x: normalized[x])
            normalized[k] = round(normalized[k] + (100.0 - s), 4)

        return {
            "normalized_pct": normalized,
            "override_pct": overrides,
        }