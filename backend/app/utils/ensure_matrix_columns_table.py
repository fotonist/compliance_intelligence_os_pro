from sqlalchemy import text
from sqlalchemy.engine import Engine


DDL = """
CREATE TABLE IF NOT EXISTS matrix_column_configs (
    id SERIAL PRIMARY KEY,

    standard_id INTEGER NOT NULL
        REFERENCES standards(id)
        ON DELETE CASCADE,

    mode VARCHAR(32) NOT NULL,

    key VARCHAR(128) NOT NULL,
    label VARCHAR(255) NOT NULL,

    source_type VARCHAR(32) NOT NULL DEFAULT 'entity_field',
    entity VARCHAR(64),
    field VARCHAR(128),
    fixed_value VARCHAR(255),

    visible BOOLEAN NOT NULL DEFAULT TRUE,
    position INTEGER NOT NULL DEFAULT 0,

    extra JSONB,

    CONSTRAINT uq_matrix_column_config_standard_mode_key
        UNIQUE (standard_id, mode, key)
);
"""


def ensure_matrix_column_configs_table(engine: Engine):
    with engine.begin() as conn:
        conn.execute(text(DDL))
