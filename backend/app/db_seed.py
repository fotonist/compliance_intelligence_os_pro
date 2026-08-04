from app.core.database import SessionLocal
from app.models.users import User
from app.models.regulations import Regulation
from app.models.requirements import Requirement
from app.models.controls import Control
from app.models.evidences import Evidence

def seed_data():
    db = SessionLocal()
    try:
        # Kullanıcı tablosu
        admin = User(email="admin@compliance.local", name="Admin User", password="admin123")
        db.add(admin)
        db.commit()
        db.refresh(admin)

        # Regulation (örnek)
        reg = Regulation(name="ISO 27001:2022", description="Information Security Management System")
        db.add(reg)
        db.commit()
        db.refresh(reg)

        # Requirement (örnek)
        req = Requirement(
            title="A.5.1 Information Security Policies",
            description="Information security policies shall be defined, approved and communicated.",
            regulation_id=reg.id
        )
        db.add(req)
        db.commit()
        db.refresh(req)

        # Control (örnek)
        ctrl = Control(
            title="Policy Review Control",
            description="Ensure all policies are reviewed annually.",
            requirement_id=req.id
        )
        db.add(ctrl)
        db.commit()
        db.refresh(ctrl)

        # Evidence (örnek)
        ev = Evidence(
            title="Policy Review Log 2025",
            description="List of policies reviewed by the ISMS Committee",
            regulation=reg.name,
            requirement_id=req.id,
            control_id=ctrl.id,
            owner_id=admin.id
        )
        db.add(ev)
        db.commit()

        print("✅ Default data (admin + ISO 27001 example) created successfully!")

    except Exception as e:
        print(f"❌ Error seeding data: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_data()
