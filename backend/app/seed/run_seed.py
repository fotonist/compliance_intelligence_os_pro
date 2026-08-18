"""Seed runner.

Usage (from backend root):
    python -m app.seed.run_seed iso27001_2022
"""

from __future__ import annotations

import sys
from typing import Callable

from sqlalchemy.orm import Session


def _import_session_local() -> Callable[[], Session]:
    candidates = (
        "app.db.session:SessionLocal",
        "app.db.database:SessionLocal",
        "app.db.session:get_db",
        "app.db.database:get_db",
    )

    last_err: Exception | None = None
    for spec in candidates:
        module_path, attr = spec.split(":", 1)
        try:
            mod = __import__(module_path, fromlist=[attr])
            obj = getattr(mod, attr)

            if attr == "SessionLocal" and callable(obj):
                return obj

            if attr == "get_db" and callable(obj):
                def _from_get_db() -> Session:
                    gen = obj()
                    return next(gen)
                return _from_get_db

        except Exception as e:
            last_err = e

    raise RuntimeError(
        "Could not import a DB session factory. Tried: " + ", ".join(candidates)
        + (f". Last error: {last_err!r}" if last_err else "")
    )


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: python -m app.seed.run_seed iso27001_2022")
        return 2

    seed_name = sys.argv[1].strip().lower()
    session_factory = _import_session_local()

    if seed_name in ("iso27001_2022", "iso27001", "27001"):
        from app.seed.iso27001_2022_clean import seed_iso27001_2022

        db = session_factory()
        try:
            result = seed_iso27001_2022(db)
            print("Seed OK:", result)
            return 0
        finally:
            try:
                db.close()
            except Exception:
                pass

    print(f"Unknown seed: {seed_name}")
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
