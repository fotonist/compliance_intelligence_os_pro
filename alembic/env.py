import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from app.models import risks, process, process_risk_link
from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context
from app.models.users import User
from app.models.regulations import Regulation
from app.models.requirements import Requirement
from app.models.controls import Control
from app.models.evidences import Evidence
# Proje kökünü sys.path'e ekle
# Alembic Config
config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# >>> Burada Base importu ve metadata tanımı <<<
from app.core.database import Base
from app.models import users, standards, requirements, evidences, clauses, actions

target_metadata = Base.metadata

# >>> DATABASE_URL ayarı <<<
from app.core.config import settings
DATABASE_URL = (
    f"postgresql+psycopg2://{settings.db_user}:{settings.db_pass}@"
    f"{settings.db_host}:{settings.db_port}/{settings.db_name}"
)
config.set_main_option("sqlalchemy.url", DATABASE_URL)

# >>> Migration fonksiyonları <<<
def run_migrations_offline():
    context.configure(
        url=DATABASE_URL,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online():
    connectable = engine_from_config(
        config.get_section(config.config_ini_section),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
