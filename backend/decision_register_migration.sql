BEGIN;

CREATE TABLE alembic_version (
    version_num VARCHAR(32) NOT NULL, 
    CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
);

-- Running upgrade  -> 740b093cdd63

ALTER TABLE evidences ADD COLUMN is_deleted BOOLEAN DEFAULT 'false' NOT NULL;

INSERT INTO alembic_version (version_num) VALUES ('740b093cdd63') RETURNING alembic_version.version_num;

-- Running upgrade 740b093cdd63 -> c8a12fdf8f15

CREATE TABLE risk_evidence_link (
    id SERIAL NOT NULL, 
    risk_id INTEGER, 
    evidence_id INTEGER, 
    PRIMARY KEY (id), 
    FOREIGN KEY(risk_id) REFERENCES risks (id) ON DELETE CASCADE, 
    FOREIGN KEY(evidence_id) REFERENCES evidences (id) ON DELETE CASCADE
);

UPDATE alembic_version SET version_num='c8a12fdf8f15' WHERE alembic_version.version_num = '740b093cdd63';

-- Running upgrade c8a12fdf8f15 -> f520701a5c42

ALTER TABLE risks ALTER COLUMN control_id DROP NOT NULL;

UPDATE alembic_version SET version_num='f520701a5c42' WHERE alembic_version.version_num = 'c8a12fdf8f15';

-- Running upgrade f520701a5c42 -> 0377691a2f11

UPDATE alembic_version SET version_num='0377691a2f11' WHERE alembic_version.version_num = 'f520701a5c42';

-- Running upgrade f520701a5c42 -> be026526cf5d

INSERT INTO alembic_version (version_num) VALUES ('be026526cf5d') RETURNING alembic_version.version_num;

-- Running upgrade be026526cf5d -> 43275d6db0d6

UPDATE alembic_version SET version_num='43275d6db0d6' WHERE alembic_version.version_num = 'be026526cf5d';

-- Running upgrade  -> fc1ac0a6950b

INSERT INTO alembic_version (version_num) VALUES ('fc1ac0a6950b') RETURNING alembic_version.version_num;

-- Running upgrade 43275d6db0d6 -> a9f1c2d3e4f5

ALTER TABLE evidence_files ADD COLUMN version INTEGER DEFAULT '1' NOT NULL;

ALTER TABLE evidence_files ADD COLUMN uploaded_by INTEGER;

ALTER TABLE evidence_files ADD CONSTRAINT fk_evidence_files_uploaded_by_users FOREIGN KEY(uploaded_by) REFERENCES users (id);

ALTER TABLE evidence_files ALTER COLUMN version DROP DEFAULT;

UPDATE alembic_version SET version_num='a9f1c2d3e4f5' WHERE alembic_version.version_num = '43275d6db0d6';

-- Running upgrade 740b093cdd63 -> 465255e695a5

ALTER TABLE risks DROP COLUMN IF EXISTS level;

INSERT INTO alembic_version (version_num) VALUES ('465255e695a5') RETURNING alembic_version.version_num;

-- Running upgrade 465255e695a5, 0377691a2f11, 43275d6db0d6 -> 99dbe9d13027

DELETE FROM alembic_version WHERE alembic_version.version_num = '465255e695a5';

UPDATE alembic_version SET version_num='99dbe9d13027' WHERE alembic_version.version_num = '0377691a2f11';

-- Running upgrade 43275d6db0d6 -> 7c91e4b2a6d8

INSERT INTO roles (name, description, is_active)
                SELECT NULL, NULL, TRUE
                WHERE NOT EXISTS (
                    SELECT 1 FROM roles WHERE name = NULL
                );

INSERT INTO roles (name, description, is_active)
                SELECT NULL, NULL, TRUE
                WHERE NOT EXISTS (
                    SELECT 1 FROM roles WHERE name = NULL
                );

INSERT INTO roles (name, description, is_active)
                SELECT NULL, NULL, TRUE
                WHERE NOT EXISTS (
                    SELECT 1 FROM roles WHERE name = NULL
                );

INSERT INTO roles (name, description, is_active)
                SELECT NULL, NULL, TRUE
                WHERE NOT EXISTS (
                    SELECT 1 FROM roles WHERE name = NULL
                );

INSERT INTO roles (name, description, is_active)
                SELECT NULL, NULL, TRUE
                WHERE NOT EXISTS (
                    SELECT 1 FROM roles WHERE name = NULL
                );

INSERT INTO roles (name, description, is_active)
                SELECT NULL, NULL, TRUE
                WHERE NOT EXISTS (
                    SELECT 1 FROM roles WHERE name = NULL
                );

INSERT INTO permissions (code, description)
                SELECT NULL, NULL
                WHERE NOT EXISTS (
                    SELECT 1 FROM permissions WHERE code = NULL
                );

INSERT INTO permissions (code, description)
                SELECT NULL, NULL
                WHERE NOT EXISTS (
                    SELECT 1 FROM permissions WHERE code = NULL
                );

INSERT INTO permissions (code, description)
                SELECT NULL, NULL
                WHERE NOT EXISTS (
                    SELECT 1 FROM permissions WHERE code = NULL
                );

INSERT INTO permissions (code, description)
                SELECT NULL, NULL
                WHERE NOT EXISTS (
                    SELECT 1 FROM permissions WHERE code = NULL
                );

INSERT INTO permissions (code, description)
                SELECT NULL, NULL
                WHERE NOT EXISTS (
                    SELECT 1 FROM permissions WHERE code = NULL
                );

INSERT INTO permissions (code, description)
                SELECT NULL, NULL
                WHERE NOT EXISTS (
                    SELECT 1 FROM permissions WHERE code = NULL
                );

INSERT INTO permissions (code, description)
                SELECT NULL, NULL
                WHERE NOT EXISTS (
                    SELECT 1 FROM permissions WHERE code = NULL
                );

INSERT INTO permissions (code, description)
                SELECT NULL, NULL
                WHERE NOT EXISTS (
                    SELECT 1 FROM permissions WHERE code = NULL
                );

INSERT INTO permissions (code, description)
                SELECT NULL, NULL
                WHERE NOT EXISTS (
                    SELECT 1 FROM permissions WHERE code = NULL
                );

INSERT INTO permissions (code, description)
                SELECT NULL, NULL
                WHERE NOT EXISTS (
                    SELECT 1 FROM permissions WHERE code = NULL
                );

INSERT INTO permissions (code, description)
                SELECT NULL, NULL
                WHERE NOT EXISTS (
                    SELECT 1 FROM permissions WHERE code = NULL
                );

INSERT INTO permissions (code, description)
                SELECT NULL, NULL
                WHERE NOT EXISTS (
                    SELECT 1 FROM permissions WHERE code = NULL
                );

INSERT INTO permissions (code, description)
                SELECT NULL, NULL
                WHERE NOT EXISTS (
                    SELECT 1 FROM permissions WHERE code = NULL
                );

INSERT INTO permissions (code, description)
                SELECT NULL, NULL
                WHERE NOT EXISTS (
                    SELECT 1 FROM permissions WHERE code = NULL
                );

INSERT INTO permissions (code, description)
                SELECT NULL, NULL
                WHERE NOT EXISTS (
                    SELECT 1 FROM permissions WHERE code = NULL
                );

INSERT INTO permissions (code, description)
                SELECT NULL, NULL
                WHERE NOT EXISTS (
                    SELECT 1 FROM permissions WHERE code = NULL
                );

INSERT INTO permissions (code, description)
                SELECT NULL, NULL
                WHERE NOT EXISTS (
                    SELECT 1 FROM permissions WHERE code = NULL
                );

INSERT INTO permissions (code, description)
                SELECT NULL, NULL
                WHERE NOT EXISTS (
                    SELECT 1 FROM permissions WHERE code = NULL
                );

INSERT INTO permissions (code, description)
                SELECT NULL, NULL
                WHERE NOT EXISTS (
                    SELECT 1 FROM permissions WHERE code = NULL
                );

INSERT INTO permissions (code, description)
                SELECT NULL, NULL
                WHERE NOT EXISTS (
                    SELECT 1 FROM permissions WHERE code = NULL
                );

INSERT INTO permissions (code, description)
                SELECT NULL, NULL
                WHERE NOT EXISTS (
                    SELECT 1 FROM permissions WHERE code = NULL
                );

INSERT INTO permissions (code, description)
                SELECT NULL, NULL
                WHERE NOT EXISTS (
                    SELECT 1 FROM permissions WHERE code = NULL
                );

INSERT INTO permissions (code, description)
                SELECT NULL, NULL
                WHERE NOT EXISTS (
                    SELECT 1 FROM permissions WHERE code = NULL
                );

INSERT INTO permissions (code, description)
                SELECT NULL, NULL
                WHERE NOT EXISTS (
                    SELECT 1 FROM permissions WHERE code = NULL
                );

INSERT INTO permissions (code, description)
                SELECT NULL, NULL
                WHERE NOT EXISTS (
                    SELECT 1 FROM permissions WHERE code = NULL
                );

INSERT INTO permissions (code, description)
                SELECT NULL, NULL
                WHERE NOT EXISTS (
                    SELECT 1 FROM permissions WHERE code = NULL
                );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO alembic_version (version_num) VALUES ('7c91e4b2a6d8') RETURNING alembic_version.version_num;

-- Running upgrade 7c91e4b2a6d8 -> 8d4f1c7a9b2e

INSERT INTO roles (name, description, is_active)
                SELECT NULL, NULL, TRUE
                WHERE NOT EXISTS (
                    SELECT 1 FROM roles WHERE name = NULL
                );

INSERT INTO roles (name, description, is_active)
                SELECT NULL, NULL, TRUE
                WHERE NOT EXISTS (
                    SELECT 1 FROM roles WHERE name = NULL
                );

INSERT INTO roles (name, description, is_active)
                SELECT NULL, NULL, TRUE
                WHERE NOT EXISTS (
                    SELECT 1 FROM roles WHERE name = NULL
                );

INSERT INTO roles (name, description, is_active)
                SELECT NULL, NULL, TRUE
                WHERE NOT EXISTS (
                    SELECT 1 FROM roles WHERE name = NULL
                );

INSERT INTO roles (name, description, is_active)
                SELECT NULL, NULL, TRUE
                WHERE NOT EXISTS (
                    SELECT 1 FROM roles WHERE name = NULL
                );

INSERT INTO roles (name, description, is_active)
                SELECT NULL, NULL, TRUE
                WHERE NOT EXISTS (
                    SELECT 1 FROM roles WHERE name = NULL
                );

INSERT INTO roles (name, description, is_active)
                SELECT NULL, NULL, TRUE
                WHERE NOT EXISTS (
                    SELECT 1 FROM roles WHERE name = NULL
                );

INSERT INTO roles (name, description, is_active)
                SELECT NULL, NULL, TRUE
                WHERE NOT EXISTS (
                    SELECT 1 FROM roles WHERE name = NULL
                );

INSERT INTO roles (name, description, is_active)
                SELECT NULL, NULL, TRUE
                WHERE NOT EXISTS (
                    SELECT 1 FROM roles WHERE name = NULL
                );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

UPDATE alembic_version SET version_num='8d4f1c7a9b2e' WHERE alembic_version.version_num = '7c91e4b2a6d8';

-- Running upgrade 8d4f1c7a9b2e -> 9e2b7c4d1f60

INSERT INTO permissions (code, description)
                SELECT NULL, NULL
                WHERE NOT EXISTS (
                    SELECT 1 FROM permissions WHERE code = NULL
                );

INSERT INTO permissions (code, description)
                SELECT NULL, NULL
                WHERE NOT EXISTS (
                    SELECT 1 FROM permissions WHERE code = NULL
                );

INSERT INTO permissions (code, description)
                SELECT NULL, NULL
                WHERE NOT EXISTS (
                    SELECT 1 FROM permissions WHERE code = NULL
                );

INSERT INTO permissions (code, description)
                SELECT NULL, NULL
                WHERE NOT EXISTS (
                    SELECT 1 FROM permissions WHERE code = NULL
                );

INSERT INTO permissions (code, description)
                SELECT NULL, NULL
                WHERE NOT EXISTS (
                    SELECT 1 FROM permissions WHERE code = NULL
                );

INSERT INTO permissions (code, description)
                SELECT NULL, NULL
                WHERE NOT EXISTS (
                    SELECT 1 FROM permissions WHERE code = NULL
                );

INSERT INTO permissions (code, description)
                SELECT NULL, NULL
                WHERE NOT EXISTS (
                    SELECT 1 FROM permissions WHERE code = NULL
                );

INSERT INTO permissions (code, description)
                SELECT NULL, NULL
                WHERE NOT EXISTS (
                    SELECT 1 FROM permissions WHERE code = NULL
                );

INSERT INTO permissions (code, description)
                SELECT NULL, NULL
                WHERE NOT EXISTS (
                    SELECT 1 FROM permissions WHERE code = NULL
                );

INSERT INTO permissions (code, description)
                SELECT NULL, NULL
                WHERE NOT EXISTS (
                    SELECT 1 FROM permissions WHERE code = NULL
                );

INSERT INTO permissions (code, description)
                SELECT NULL, NULL
                WHERE NOT EXISTS (
                    SELECT 1 FROM permissions WHERE code = NULL
                );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

INSERT INTO role_permissions (role_id, permission_id)
                    SELECT r.id, p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = NULL
                      AND p.code = NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                      );

CREATE OR REPLACE VIEW analytics.v_finding_intelligence AS
        SELECT
            afr.tenant_id,
            COUNT(*) AS total_findings,
            COUNT(*) FILTER (
                WHERE UPPER(COALESCE(afr.status, '')) NOT IN
                    ('CLOSED', 'VERIFIED', 'RESOLVED')
            ) AS open_findings,
            COUNT(*) FILTER (
                WHERE UPPER(COALESCE(afr.severity, '')) = 'CRITICAL'
                  AND UPPER(COALESCE(afr.status, '')) NOT IN
                    ('CLOSED', 'VERIFIED', 'RESOLVED')
            ) AS open_critical_findings,
            COUNT(*) FILTER (
                WHERE UPPER(COALESCE(afr.severity, '')) = 'HIGH'
                  AND UPPER(COALESCE(afr.status, '')) NOT IN
                    ('CLOSED', 'VERIFIED', 'RESOLVED')
            ) AS open_high_findings,
            COUNT(*) FILTER (
                WHERE UPPER(COALESCE(afr.severity, '')) = 'MEDIUM'
                  AND UPPER(COALESCE(afr.status, '')) NOT IN
                    ('CLOSED', 'VERIFIED', 'RESOLVED')
            ) AS open_medium_findings,
            COUNT(*) FILTER (
                WHERE UPPER(COALESCE(afr.severity, '')) = 'LOW'
                  AND UPPER(COALESCE(afr.status, '')) NOT IN
                    ('CLOSED', 'VERIFIED', 'RESOLVED')
            ) AS open_low_findings,
            COUNT(*) FILTER (
                WHERE UPPER(COALESCE(afr.manager_review_status, '')) IN
                    ('PENDING', 'SUBMITTED', 'IN_REVIEW')
            ) AS pending_manager_reviews,
            COUNT(*) FILTER (
                WHERE UPPER(COALESCE(afr.verification_status, '')) IN
                    ('READY', 'PENDING', 'NOT_READY')
                  AND UPPER(COALESCE(afr.status, '')) NOT IN
                    ('CLOSED', 'VERIFIED', 'RESOLVED')
            ) AS pending_verifications,
            COALESCE(SUM(
                CASE
                    WHEN UPPER(COALESCE(afr.status, '')) IN
                        ('CLOSED', 'VERIFIED', 'RESOLVED') THEN 0
                    WHEN UPPER(COALESCE(afr.severity, '')) = 'CRITICAL' THEN 4
                    WHEN UPPER(COALESCE(afr.severity, '')) = 'HIGH' THEN 3
                    WHEN UPPER(COALESCE(afr.severity, '')) = 'MEDIUM' THEN 2
                    WHEN UPPER(COALESCE(afr.severity, '')) = 'LOW' THEN 1
                    ELSE 1
                END
            ), 0) AS open_finding_pressure
        FROM audit_finding_records afr
        GROUP BY afr.tenant_id;;

CREATE OR REPLACE VIEW analytics.v_control_finding_intelligence AS
        SELECT
            afr.tenant_id,
            afr.control_id,
            COUNT(*) AS finding_count,
            COUNT(*) FILTER (
                WHERE UPPER(COALESCE(afr.status, '')) NOT IN
                    ('CLOSED', 'VERIFIED', 'RESOLVED')
            ) AS open_finding_count,
            COUNT(*) FILTER (
                WHERE UPPER(COALESCE(afr.severity, '')) IN ('CRITICAL', 'HIGH')
                  AND UPPER(COALESCE(afr.status, '')) NOT IN
                    ('CLOSED', 'VERIFIED', 'RESOLVED')
            ) AS open_high_critical_count
        FROM audit_finding_records afr
        WHERE afr.control_id IS NOT NULL
        GROUP BY afr.tenant_id, afr.control_id;;

UPDATE alembic_version SET version_num='9e2b7c4d1f60' WHERE alembic_version.version_num = '8d4f1c7a9b2e';

-- Running upgrade 9e2b7c4d1f60 -> 9f6a3c1d8e20

CREATE OR REPLACE VIEW analytics.v_risk_exposure AS
        WITH finding_pressure AS (
            SELECT
                afr.tenant_id,
                afr.control_id,
                COUNT(*) FILTER (
                    WHERE UPPER(COALESCE(afr.status, '')) NOT IN
                        ('CLOSED', 'VERIFIED', 'RESOLVED')
                ) AS open_findings,
                COUNT(*) FILTER (
                    WHERE UPPER(COALESCE(afr.severity, '')) IN ('CRITICAL', 'HIGH')
                      AND UPPER(COALESCE(afr.status, '')) NOT IN
                        ('CLOSED', 'VERIFIED', 'RESOLVED')
                ) AS open_high_critical_findings,
                COUNT(*) FILTER (
                    WHERE UPPER(COALESCE(afr.severity, '')) = 'MEDIUM'
                      AND UPPER(COALESCE(afr.status, '')) NOT IN
                        ('CLOSED', 'VERIFIED', 'RESOLVED')
                ) AS open_medium_findings,
                COUNT(*) FILTER (
                    WHERE UPPER(COALESCE(afr.severity, '')) = 'LOW'
                      AND UPPER(COALESCE(afr.status, '')) NOT IN
                        ('CLOSED', 'VERIFIED', 'RESOLVED')
                ) AS open_low_findings
            FROM audit_finding_records afr
            GROUP BY afr.tenant_id, afr.control_id
        ),
        evidence_state AS (
            SELECT
                rv.tenant_id,
                rv.id AS risk_version_id,
                rv.risk_id,
                rv.score AS risk_score,
                COUNT(DISTINCT rel.evidence_file_id) AS linked_evidence_count,
                COUNT(
                    DISTINCT CASE
                        WHEN ef.status = 'Approved' THEN ef.id
                    END
                ) AS approved_evidence_count
            FROM risk_versions rv
            LEFT JOIN risk_evidence_link rel
                ON rel.risk_version_id = rv.id
                AND rel.tenant_id = rv.tenant_id
            LEFT JOIN evidence_files ef
                ON ef.id = rel.evidence_file_id
                AND ef.tenant_id = rv.tenant_id
            GROUP BY
                rv.tenant_id,
                rv.id,
                rv.risk_id,
                rv.score
        )
        SELECT
            es.tenant_id,
            es.risk_version_id,
            es.risk_score,
            es.linked_evidence_count,
            es.approved_evidence_count,
            (
                es.approved_evidence_count > 0
                AND COALESCE(fp.open_findings, 0) = 0
            ) AS is_covered,
            LEAST(
                100,
                (
                    es.risk_score *
                    CASE
                        WHEN es.approved_evidence_count > 0
                             AND COALESCE(fp.open_findings, 0) = 0
                            THEN 0.2
                        WHEN es.approved_evidence_count > 0
                            THEN 0.5
                        ELSE 1.0
                    END
                ) *
                (
                    1.0 + LEAST(
                        1.0,
                        COALESCE(fp.open_high_critical_findings, 0) * 0.25
                        + COALESCE(fp.open_medium_findings, 0) * 0.10
                        + COALESCE(fp.open_low_findings, 0) * 0.05
                    )
                )
            ) AS exposure_score,
            COALESCE(fp.open_findings, 0) AS open_findings,
            COALESCE(fp.open_high_critical_findings, 0) AS open_high_critical_findings,
            COALESCE(fp.open_medium_findings, 0) AS open_medium_findings,
            COALESCE(fp.open_low_findings, 0) AS open_low_findings
        FROM evidence_state es
        INNER JOIN risks r
            ON r.id = es.risk_id
            AND r.tenant_id = es.tenant_id
        LEFT JOIN finding_pressure fp
            ON fp.tenant_id = es.tenant_id
            AND fp.control_id = r.control_id;;

UPDATE alembic_version SET version_num='9f6a3c1d8e20' WHERE alembic_version.version_num = '9e2b7c4d1f60';

-- Running upgrade 9f6a3c1d8e20 -> a1b7c9d2e4f0

CREATE OR REPLACE VIEW analytics.v_dashboard_summary AS
        WITH evidence_summary AS (
            SELECT
                tenant_id,
                COUNT(*) FILTER (WHERE is_orphan = TRUE) AS orphan_evidences,
                AVG(quality_score) AS avg_quality_score,
                COUNT(*) AS total_evidences
            FROM analytics.v_evidence_intelligence
            GROUP BY tenant_id
        ),
        finding_summary AS (
            SELECT
                tenant_id,
                total_findings,
                open_findings,
                open_critical_findings,
                open_high_findings,
                open_medium_findings,
                open_low_findings,
                pending_manager_reviews,
                pending_verifications,
                open_finding_pressure
            FROM analytics.v_finding_intelligence
        ),
        risk_summary AS (
            SELECT
                tenant_id,
                COUNT(*) AS risk_rows,
                AVG(exposure_score) AS avg_risk_exposure,
                SUM(CASE WHEN is_covered THEN 1 ELSE 0 END) AS covered_risk_rows
            FROM analytics.v_risk_exposure
            GROUP BY tenant_id
        )
        SELECT
            COALESCE(es.tenant_id, fs.tenant_id, rs.tenant_id) AS tenant_id,

            COALESCE(es.orphan_evidences, 0) AS orphan_evidences,
            COALESCE(es.avg_quality_score, 0) AS avg_quality_score,
            COALESCE(es.total_evidences, 0) AS total_evidences,

            COALESCE(fs.total_findings, 0) AS total_findings,
            COALESCE(fs.open_findings, 0) AS open_findings,
            COALESCE(fs.open_critical_findings, 0) AS open_critical_findings,
            COALESCE(fs.open_high_findings, 0) AS open_high_findings,
            COALESCE(fs.open_medium_findings, 0) AS open_medium_findings,
            COALESCE(fs.open_low_findings, 0) AS open_low_findings,
            COALESCE(fs.pending_manager_reviews, 0) AS pending_manager_reviews,
            COALESCE(fs.pending_verifications, 0) AS pending_verifications,
            COALESCE(fs.open_finding_pressure, 0) AS open_finding_pressure,

            COALESCE(rs.risk_rows, 0) AS risk_rows,
            COALESCE(rs.avg_risk_exposure, 0) AS avg_risk_exposure,
            COALESCE(rs.covered_risk_rows, 0) AS covered_risk_rows,
            CASE
                WHEN COALESCE(rs.risk_rows, 0) = 0 THEN 0
                ELSE ROUND(
                    (COALESCE(rs.covered_risk_rows, 0)::numeric
                     / rs.risk_rows::numeric) * 100,
                    2
                )
            END AS risk_coverage_rate

        FROM evidence_summary es
        FULL OUTER JOIN finding_summary fs
            ON fs.tenant_id = es.tenant_id
        FULL OUTER JOIN risk_summary rs
            ON rs.tenant_id = COALESCE(es.tenant_id, fs.tenant_id);;

UPDATE alembic_version SET version_num='a1b7c9d2e4f0' WHERE alembic_version.version_num = '9f6a3c1d8e20';

-- Running upgrade 99dbe9d13027 -> 54bf874c097b

UPDATE alembic_version SET version_num='54bf874c097b' WHERE alembic_version.version_num = '99dbe9d13027';

-- Running upgrade 54bf874c097b -> 381370d81ce4

ALTER TABLE evidences ADD COLUMN risk_id INTEGER;

ALTER TABLE evidences ADD CONSTRAINT fk_evidences_risk_id FOREIGN KEY(risk_id) REFERENCES risks (id);

UPDATE alembic_version SET version_num='381370d81ce4' WHERE alembic_version.version_num = '54bf874c097b';

-- Running upgrade 381370d81ce4, a9f1c2d3e4f5 -> 9e267c3ead4f

DELETE FROM alembic_version WHERE alembic_version.version_num = '381370d81ce4';

UPDATE alembic_version SET version_num='9e267c3ead4f' WHERE alembic_version.version_num = 'a9f1c2d3e4f5';

-- Running upgrade 9e267c3ead4f -> 98c8b92fe827

CREATE TABLE standard_versions (
    id SERIAL NOT NULL, 
    standard_id INTEGER NOT NULL, 
    version_code VARCHAR(50) NOT NULL, 
    status VARCHAR(20) DEFAULT 'published' NOT NULL, 
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(standard_id) REFERENCES standards (id) ON DELETE CASCADE
);

CREATE INDEX ix_standard_versions_standard_id ON standard_versions (standard_id);

ALTER TABLE clauses ADD COLUMN standard_version_id INTEGER;

ALTER TABLE standard_process_areas ADD COLUMN standard_version_id INTEGER;

ALTER TABLE clauses ADD CONSTRAINT fk_clauses_standard_version FOREIGN KEY(standard_version_id) REFERENCES standard_versions (id) ON DELETE CASCADE;

ALTER TABLE standard_process_areas ADD CONSTRAINT fk_spa_standard_version FOREIGN KEY(standard_version_id) REFERENCES standard_versions (id) ON DELETE CASCADE;

INSERT INTO standard_versions (standard_id, version_code, status)
            SELECT id, 'v1', 'published'
            FROM standards;

UPDATE clauses c
            SET standard_version_id = sv.id
            FROM standard_versions sv
            WHERE c.standard_id = sv.standard_id
              AND sv.version_code = 'v1';

UPDATE standard_process_areas spa
            SET standard_version_id = sv.id
            FROM standard_versions sv
            WHERE spa.standard_id = sv.standard_id
              AND sv.version_code = 'v1';

ALTER TABLE clauses ALTER COLUMN standard_version_id SET NOT NULL;

ALTER TABLE standard_process_areas ALTER COLUMN standard_version_id SET NOT NULL;

UPDATE alembic_version SET version_num='98c8b92fe827' WHERE alembic_version.version_num = '9e267c3ead4f';

-- Running upgrade 98c8b92fe827, fc1ac0a6950b -> a9fdd4e7b6e0

DELETE FROM alembic_version WHERE alembic_version.version_num = 'fc1ac0a6950b';

UPDATE alembic_version SET version_num='a9fdd4e7b6e0' WHERE alembic_version.version_num = '98c8b92fe827';

-- Running upgrade a9fdd4e7b6e0 -> 024f475f731c

ALTER TABLE evidences ADD COLUMN standard_version_id INTEGER;

ALTER TABLE evidences ADD FOREIGN KEY(standard_version_id) REFERENCES standard_versions (id) ON DELETE CASCADE;

CREATE INDEX ix_evidences_standard_version_id ON evidences (standard_version_id);

UPDATE alembic_version SET version_num='024f475f731c' WHERE alembic_version.version_num = 'a9fdd4e7b6e0';

-- Running upgrade 024f475f731c -> dc199d132449

ALTER TABLE controls ADD COLUMN standard_version_id INTEGER;

ALTER TABLE controls ADD FOREIGN KEY(standard_version_id) REFERENCES standard_versions (id) ON DELETE CASCADE;

CREATE INDEX ix_controls_standard_version_id ON controls (standard_version_id);

UPDATE alembic_version SET version_num='dc199d132449' WHERE alembic_version.version_num = '024f475f731c';

-- Running upgrade dc199d132449 -> 336472c6225c

ALTER TABLE controls ALTER COLUMN standard_version_id SET NOT NULL;

UPDATE alembic_version SET version_num='336472c6225c' WHERE alembic_version.version_num = 'dc199d132449';

-- Running upgrade 336472c6225c -> 9f4b1c2e7a01

CREATE TABLE matrix_instances (
    id SERIAL NOT NULL, 
    standard_version_id INTEGER NOT NULL, 
    status VARCHAR(32) DEFAULT 'generated' NOT NULL, 
    created_by INTEGER, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(standard_version_id) REFERENCES standard_versions (id) ON DELETE CASCADE, 
    FOREIGN KEY(created_by) REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX ix_matrix_instances_standard_version_id ON matrix_instances (standard_version_id);

UPDATE alembic_version SET version_num='9f4b1c2e7a01' WHERE alembic_version.version_num = '336472c6225c';

-- Running upgrade 99dbe9d13027, 9f4b1c2e7a01 -> 7b8d2f1a4c6e

ALTER TABLE audit_finding_records ALTER COLUMN status TYPE VARCHAR(40);

ALTER TABLE audit_finding_records ADD COLUMN assigned_owner_id INTEGER;

ALTER TABLE audit_finding_records ADD COLUMN process_manager_id INTEGER;

ALTER TABLE audit_finding_records ADD COLUMN correction TEXT;

ALTER TABLE audit_finding_records ADD COLUMN corrective_action_plan TEXT;

ALTER TABLE audit_finding_records ADD COLUMN owner_submitted_at TIMESTAMP WITHOUT TIME ZONE;

ALTER TABLE audit_finding_records ADD COLUMN owner_submitted_by INTEGER;

ALTER TABLE audit_finding_records ADD COLUMN manager_review_status VARCHAR(32) DEFAULT 'NOT_SUBMITTED' NOT NULL;

ALTER TABLE audit_finding_records ADD COLUMN manager_review_comment TEXT;

ALTER TABLE audit_finding_records ADD COLUMN manager_reviewed_by INTEGER;

ALTER TABLE audit_finding_records ADD COLUMN manager_reviewed_at TIMESTAMP WITHOUT TIME ZONE;

ALTER TABLE audit_finding_records ADD COLUMN implementation_status VARCHAR(32) DEFAULT 'NOT_STARTED' NOT NULL;

ALTER TABLE audit_finding_records ADD COLUMN implementation_completed_at TIMESTAMP WITHOUT TIME ZONE;

ALTER TABLE audit_finding_records ADD COLUMN implementation_evidence TEXT;

ALTER TABLE audit_finding_records ADD COLUMN verification_status VARCHAR(32) DEFAULT 'NOT_READY' NOT NULL;

ALTER TABLE audit_finding_records ADD COLUMN verification_comment TEXT;

ALTER TABLE audit_finding_records ADD COLUMN verified_by INTEGER;

ALTER TABLE audit_finding_records ADD COLUMN verified_at TIMESTAMP WITHOUT TIME ZONE;

ALTER TABLE audit_finding_records ADD COLUMN closed_by INTEGER;

ALTER TABLE audit_finding_records ADD COLUMN closed_at TIMESTAMP WITHOUT TIME ZONE;

ALTER TABLE audit_finding_records ADD COLUMN closure_comment TEXT;

CREATE INDEX ix_audit_finding_records_assigned_owner_id ON audit_finding_records (assigned_owner_id);

CREATE INDEX ix_audit_finding_records_process_manager_id ON audit_finding_records (process_manager_id);

CREATE INDEX ix_audit_finding_records_owner_submitted_by ON audit_finding_records (owner_submitted_by);

CREATE INDEX ix_audit_finding_records_manager_reviewed_by ON audit_finding_records (manager_reviewed_by);

CREATE INDEX ix_audit_finding_records_verified_by ON audit_finding_records (verified_by);

CREATE INDEX ix_audit_finding_records_closed_by ON audit_finding_records (closed_by);

ALTER TABLE audit_finding_records ADD CONSTRAINT fk_audit_finding_records_assigned_owner FOREIGN KEY(assigned_owner_id) REFERENCES users (id) ON DELETE SET NULL;

ALTER TABLE audit_finding_records ADD CONSTRAINT fk_audit_finding_records_process_manager FOREIGN KEY(process_manager_id) REFERENCES users (id) ON DELETE SET NULL;

ALTER TABLE audit_finding_records ADD CONSTRAINT fk_audit_finding_records_owner_submitted_by FOREIGN KEY(owner_submitted_by) REFERENCES users (id) ON DELETE SET NULL;

ALTER TABLE audit_finding_records ADD CONSTRAINT fk_audit_finding_records_manager_reviewed_by FOREIGN KEY(manager_reviewed_by) REFERENCES users (id) ON DELETE SET NULL;

ALTER TABLE audit_finding_records ADD CONSTRAINT fk_audit_finding_records_verified_by FOREIGN KEY(verified_by) REFERENCES users (id) ON DELETE SET NULL;

ALTER TABLE audit_finding_records ADD CONSTRAINT fk_audit_finding_records_closed_by FOREIGN KEY(closed_by) REFERENCES users (id) ON DELETE SET NULL;

CREATE TABLE audit_finding_workflow_events (
    id SERIAL NOT NULL, 
    tenant_id INTEGER NOT NULL, 
    finding_id INTEGER NOT NULL, 
    actor_id INTEGER, 
    actor_role VARCHAR(100), 
    action VARCHAR(64) NOT NULL, 
    from_status VARCHAR(40), 
    to_status VARCHAR(40), 
    comment TEXT, 
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT, 
    FOREIGN KEY(finding_id) REFERENCES audit_finding_records (id) ON DELETE CASCADE, 
    FOREIGN KEY(actor_id) REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX ix_audit_finding_workflow_events_tenant_id ON audit_finding_workflow_events (tenant_id);

CREATE INDEX ix_audit_finding_workflow_events_finding_id ON audit_finding_workflow_events (finding_id);

CREATE INDEX ix_audit_finding_workflow_events_actor_id ON audit_finding_workflow_events (actor_id);

CREATE INDEX ix_audit_finding_workflow_events_created_at ON audit_finding_workflow_events (created_at);

ALTER TABLE audit_finding_records ALTER COLUMN manager_review_status DROP DEFAULT;

ALTER TABLE audit_finding_records ALTER COLUMN implementation_status DROP DEFAULT;

ALTER TABLE audit_finding_records ALTER COLUMN verification_status DROP DEFAULT;

UPDATE alembic_version SET version_num='7b8d2f1a4c6e' WHERE alembic_version.version_num = '9f4b1c2e7a01';

-- Running upgrade 7b8d2f1a4c6e -> c3f1a9b7e2d4

ALTER TABLE actions ADD COLUMN requirement_id INTEGER;

ALTER TABLE actions ADD COLUMN risk_id INTEGER;

ALTER TABLE actions ADD COLUMN title VARCHAR(255);

ALTER TABLE actions ADD COLUMN status VARCHAR(50) DEFAULT 'OPEN';

ALTER TABLE actions ADD COLUMN priority VARCHAR(50) DEFAULT 'MEDIUM';

ALTER TABLE actions ADD COLUMN due_date DATE;

ALTER TABLE actions ADD COLUMN created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now();

ALTER TABLE actions ADD COLUMN updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now();

CREATE INDEX ix_actions_requirement_id ON actions (requirement_id);

CREATE INDEX ix_actions_risk_id ON actions (risk_id);

ALTER TABLE actions ADD CONSTRAINT fk_actions_requirement_id FOREIGN KEY(requirement_id) REFERENCES requirements (id) ON DELETE CASCADE;

ALTER TABLE actions ADD CONSTRAINT fk_actions_risk_id FOREIGN KEY(risk_id) REFERENCES risks (id) ON DELETE SET NULL;

ALTER TABLE actions ALTER COLUMN title SET NOT NULL;

ALTER TABLE actions ALTER COLUMN status SET NOT NULL;

ALTER TABLE actions ALTER COLUMN status DROP DEFAULT;

ALTER TABLE actions ALTER COLUMN priority SET NOT NULL;

ALTER TABLE actions ALTER COLUMN priority DROP DEFAULT;

ALTER TABLE actions ALTER COLUMN created_at SET NOT NULL;

ALTER TABLE actions ALTER COLUMN updated_at SET NOT NULL;

UPDATE alembic_version SET version_num='c3f1a9b7e2d4' WHERE alembic_version.version_num = '7b8d2f1a4c6e';

-- Running upgrade 9f4b1c2e7a01 -> 20260817_fix_control_coverage

DROP VIEW IF EXISTS analytics.v_control_coverage CASCADE;

DROP VIEW IF EXISTS analytics.v_control_coverage_uee CASCADE;

CREATE VIEW analytics.v_control_coverage AS
        SELECT
            c.tenant_id,
            c.id AS control_id,
            c.code,
            c.title,
            COUNT(DISTINCT e.id) AS evidence_count,
            COUNT(DISTINCT ef.id) FILTER (
                WHERE LOWER(COALESCE(ef.status, '')) = 'approved'
            ) AS approved_files,
            CASE
                WHEN COUNT(DISTINCT e.id) = 0 THEN 'uncovered'
                WHEN COUNT(DISTINCT ef.id) FILTER (
                    WHERE LOWER(COALESCE(ef.status, '')) = 'approved'
                ) = 0 THEN 'partial'
                WHEN COUNT(DISTINCT ef.id) FILTER (
                    WHERE LOWER(COALESCE(ef.status, '')) = 'approved'
                ) < COUNT(DISTINCT ef.id) THEN 'partial'
                ELSE 'covered'
            END AS coverage_status
        FROM controls c
        LEFT JOIN evidences e
          ON e.control_id = c.id
         AND e.tenant_id = c.tenant_id
         AND e.is_deleted = false
        LEFT JOIN evidence_files ef
          ON ef.evidence_id = e.id
        GROUP BY c.tenant_id, c.id, c.code, c.title;

CREATE VIEW analytics.v_control_coverage_uee AS
        SELECT
            c.tenant_id,
            c.id AS control_id,
            c.code,
            c.title,
            COUNT(DISTINCT e.id) AS evidence_count,
            COUNT(DISTINCT ef.id) FILTER (
                WHERE LOWER(COALESCE(ef.status, '')) = 'approved'
            ) AS approved_files,
            CASE
                WHEN COUNT(DISTINCT e.id) = 0 THEN 'uncovered'
                WHEN COUNT(DISTINCT ef.id) FILTER (
                    WHERE LOWER(COALESCE(ef.status, '')) = 'approved'
                ) = 0 THEN 'partial'
                WHEN COUNT(DISTINCT ef.id) FILTER (
                    WHERE LOWER(COALESCE(ef.status, '')) = 'approved'
                ) < COUNT(DISTINCT ef.id) THEN 'partial'
                ELSE 'covered'
            END AS coverage_status
        FROM controls c
        LEFT JOIN evidences e
          ON e.control_id = c.id
         AND e.tenant_id = c.tenant_id
         AND e.is_deleted = false
        LEFT JOIN evidence_files ef
          ON ef.evidence_id = e.id
        GROUP BY c.tenant_id, c.id, c.code, c.title;

INSERT INTO alembic_version (version_num) VALUES ('20260817_fix_control_coverage') RETURNING alembic_version.version_num;

-- Running upgrade 20260817_fix_control_coverage -> 20260819_fix_uee_control_coverage_contract

DROP VIEW IF EXISTS analytics.v_control_coverage_uee CASCADE;

DROP VIEW IF EXISTS analytics.v_control_coverage CASCADE;

CREATE VIEW analytics.v_control_coverage AS 
    SELECT
        c.tenant_id,
        c.id AS control_id,
        c.code,
        c.title,
        COUNT(DISTINCT e.id) AS evidence_count,
        COUNT(DISTINCT ef.id) FILTER (
            WHERE LOWER(COALESCE(ef.status, '')) = 'approved'
        ) AS approved_files,
        COUNT(DISTINCT ef.id) AS total_files,
        CASE
            WHEN COUNT(DISTINCT e.id) = 0 THEN 'uncovered'
            WHEN COUNT(DISTINCT ef.id) = 0 THEN 'uncovered'
            WHEN COUNT(DISTINCT ef.id) FILTER (
                WHERE LOWER(COALESCE(ef.status, '')) = 'approved'
            ) = 0 THEN 'uncovered'
            WHEN COUNT(DISTINCT ef.id) FILTER (
                WHERE LOWER(COALESCE(ef.status, '')) = 'approved'
            ) < COUNT(DISTINCT ef.id) THEN 'partial'
            ELSE 'covered'
        END AS coverage_status
    FROM controls c
    LEFT JOIN evidences e
      ON e.control_id = c.id
     AND e.tenant_id = c.tenant_id
     AND e.is_deleted = false
    LEFT JOIN evidence_files ef
      ON ef.evidence_id = e.id
    GROUP BY c.tenant_id, c.id, c.code, c.title;

CREATE VIEW analytics.v_control_coverage_uee AS 
    SELECT
        c.tenant_id,
        c.id AS control_id,
        c.code,
        c.title,
        COUNT(DISTINCT e.id) AS evidence_count,
        COUNT(DISTINCT ef.id) FILTER (
            WHERE LOWER(COALESCE(ef.status, '')) = 'approved'
        ) AS approved_files,
        COUNT(DISTINCT ef.id) AS total_files,
        CASE
            WHEN COUNT(DISTINCT e.id) = 0 THEN 'uncovered'
            WHEN COUNT(DISTINCT ef.id) = 0 THEN 'uncovered'
            WHEN COUNT(DISTINCT ef.id) FILTER (
                WHERE LOWER(COALESCE(ef.status, '')) = 'approved'
            ) = 0 THEN 'uncovered'
            WHEN COUNT(DISTINCT ef.id) FILTER (
                WHERE LOWER(COALESCE(ef.status, '')) = 'approved'
            ) < COUNT(DISTINCT ef.id) THEN 'partial'
            ELSE 'covered'
        END AS coverage_status
    FROM controls c
    LEFT JOIN evidences e
      ON e.control_id = c.id
     AND e.tenant_id = c.tenant_id
     AND e.is_deleted = false
    LEFT JOIN evidence_files ef
      ON ef.evidence_id = e.id
    GROUP BY c.tenant_id, c.id, c.code, c.title;

UPDATE alembic_version SET version_num='20260819_fix_uee_control_coverage_contract' WHERE alembic_version.version_num = '20260817_fix_control_coverage';

-- Running upgrade 20260817_fix_control_coverage -> 20260818_control_requirement_nullable

ALTER TABLE controls ALTER COLUMN requirement_id DROP NOT NULL;

INSERT INTO alembic_version (version_num) VALUES ('20260818_control_requirement_nullable') RETURNING alembic_version.version_num;

-- Running upgrade 9f4b1c2e7a01 -> 3a4c01e44100

CREATE TABLE tenants (
    id SERIAL NOT NULL, 
    code VARCHAR(64) NOT NULL, 
    name VARCHAR(255) NOT NULL, 
    status VARCHAR(32) DEFAULT 'active' NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    UNIQUE (code)
);

INSERT INTO tenants (id, code, name, status, created_at)
        VALUES (1, 'default', 'Default Tenant', 'active', now());

ALTER TABLE users ADD COLUMN tenant_id INTEGER;

ALTER TABLE users ADD CONSTRAINT fk_users_tenant_id FOREIGN KEY(tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT;

UPDATE users SET tenant_id = 1 WHERE tenant_id IS NULL;

ALTER TABLE users ALTER COLUMN tenant_id SET NOT NULL;

CREATE INDEX ix_users_tenant_id ON users (tenant_id);

ALTER TABLE evidences ADD COLUMN tenant_id INTEGER;

ALTER TABLE evidences ADD CONSTRAINT fk_evidences_tenant_id FOREIGN KEY(tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT;

UPDATE evidences SET tenant_id = 1 WHERE tenant_id IS NULL;

ALTER TABLE evidences ALTER COLUMN tenant_id SET NOT NULL;

CREATE INDEX ix_evidences_tenant_id ON evidences (tenant_id);

ALTER TABLE evidence_files ADD COLUMN tenant_id INTEGER;

ALTER TABLE evidence_files ADD CONSTRAINT fk_evidence_files_tenant_id FOREIGN KEY(tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT;

UPDATE evidence_files SET tenant_id = 1 WHERE tenant_id IS NULL;

ALTER TABLE evidence_files ALTER COLUMN tenant_id SET NOT NULL;

CREATE INDEX ix_evidence_files_tenant_id ON evidence_files (tenant_id);

ALTER TABLE risks ADD COLUMN tenant_id INTEGER;

ALTER TABLE risks ADD CONSTRAINT fk_risks_tenant_id FOREIGN KEY(tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT;

UPDATE risks SET tenant_id = 1 WHERE tenant_id IS NULL;

ALTER TABLE risks ALTER COLUMN tenant_id SET NOT NULL;

CREATE INDEX ix_risks_tenant_id ON risks (tenant_id);

ALTER TABLE matrix_instances ADD COLUMN tenant_id INTEGER;

ALTER TABLE matrix_instances ADD CONSTRAINT fk_matrix_instances_tenant_id FOREIGN KEY(tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT;

UPDATE matrix_instances SET tenant_id = 1 WHERE tenant_id IS NULL;

ALTER TABLE matrix_instances ALTER COLUMN tenant_id SET NOT NULL;

CREATE INDEX ix_matrix_instances_tenant_id ON matrix_instances (tenant_id);

ALTER TABLE matrix_rows ADD COLUMN tenant_id INTEGER;

ALTER TABLE matrix_rows ADD CONSTRAINT fk_matrix_rows_tenant_id FOREIGN KEY(tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT;

UPDATE matrix_rows SET tenant_id = 1 WHERE tenant_id IS NULL;

ALTER TABLE matrix_rows ALTER COLUMN tenant_id SET NOT NULL;

CREATE INDEX ix_matrix_rows_tenant_id ON matrix_rows (tenant_id);

CREATE TABLE risk_versions (
    id SERIAL NOT NULL, 
    tenant_id INTEGER NOT NULL, 
    risk_id INTEGER NOT NULL, 
    version_number INTEGER NOT NULL, 
    impact INTEGER NOT NULL, 
    likelihood INTEGER NOT NULL, 
    score INTEGER NOT NULL, 
    risk_level VARCHAR NOT NULL, 
    status VARCHAR NOT NULL, 
    treatment VARCHAR, 
    action VARCHAR, 
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    PRIMARY KEY (id)
);

ALTER TABLE risk_versions ADD CONSTRAINT fk_risk_versions_tenant_id FOREIGN KEY(tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT;

ALTER TABLE risk_versions ADD CONSTRAINT fk_risk_versions_risk_id FOREIGN KEY(risk_id) REFERENCES risks (id) ON DELETE CASCADE;

CREATE INDEX ix_risk_versions_risk_id ON risk_versions (risk_id);

INSERT INTO risk_versions (
            tenant_id,
            risk_id,
            version_number,
            impact,
            likelihood,
            score,
            risk_level,
            status,
            treatment,
            action,
            created_at
        )
        SELECT
            tenant_id,
            id,
            1,
            impact,
            likelihood,
            score,
            risk_level,
            status,
            treatment,
            action,
            now()
        FROM risks;

INSERT INTO alembic_version (version_num) VALUES ('3a4c01e44100') RETURNING alembic_version.version_num;

-- Running upgrade 3a4c01e44100 -> d988e27ff409

ALTER TABLE risk_evidence_link ADD COLUMN IF NOT EXISTS tenant_id INTEGER;;

ALTER TABLE risk_evidence_link ADD COLUMN IF NOT EXISTS risk_version_id INTEGER;;

ALTER TABLE risk_evidence_link ADD COLUMN IF NOT EXISTS evidence_file_id INTEGER;;

UPDATE risk_evidence_link rel
        SET
            tenant_id = COALESCE(
                rel.tenant_id,
                (SELECT tenant_id FROM risks WHERE id = rel.risk_id),
                1
            ),
            risk_version_id = COALESCE(
                rel.risk_version_id,
                (
                    SELECT id
                    FROM risk_versions
                    WHERE risk_id = rel.risk_id
                      AND version_number = 1
                    LIMIT 1
                )
            ),
            evidence_file_id = COALESCE(
                rel.evidence_file_id,
                (
                    SELECT id
                    FROM evidence_files
                    WHERE evidence_id = rel.evidence_id
                    ORDER BY version DESC, id DESC
                    LIMIT 1
                )
            )
        WHERE
            rel.risk_version_id IS NULL
            OR rel.evidence_file_id IS NULL
            OR rel.tenant_id IS NULL;

DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM risk_evidence_link WHERE risk_version_id IS NULL) THEN
                RAISE EXCEPTION 'risk_version_id still NULL';
            END IF;

            IF EXISTS (SELECT 1 FROM risk_evidence_link WHERE evidence_file_id IS NULL) THEN
                RAISE EXCEPTION 'evidence_file_id still NULL';
            END IF;
        END $$;;

DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 'risk_evidence_link_risk_id_fkey'
            ) THEN
                ALTER TABLE risk_evidence_link DROP CONSTRAINT risk_evidence_link_risk_id_fkey;
            END IF;

            IF EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 'risk_evidence_link_evidence_id_fkey'
            ) THEN
                ALTER TABLE risk_evidence_link DROP CONSTRAINT risk_evidence_link_evidence_id_fkey;
            END IF;
        END $$;;

ALTER TABLE risk_evidence_link DROP COLUMN IF EXISTS risk_id;;

ALTER TABLE risk_evidence_link DROP COLUMN IF EXISTS evidence_id;;

ALTER TABLE risk_evidence_link ALTER COLUMN tenant_id SET NOT NULL;;

ALTER TABLE risk_evidence_link ALTER COLUMN risk_version_id SET NOT NULL;;

ALTER TABLE risk_evidence_link ALTER COLUMN evidence_file_id SET NOT NULL;;

DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 'fk_risk_evidence_link_tenant'
            ) THEN
                ALTER TABLE risk_evidence_link
                ADD CONSTRAINT fk_risk_evidence_link_tenant
                FOREIGN KEY (tenant_id) REFERENCES tenants(id)
                ON DELETE RESTRICT;
            END IF;

            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 'fk_risk_evidence_link_risk_version'
            ) THEN
                ALTER TABLE risk_evidence_link
                ADD CONSTRAINT fk_risk_evidence_link_risk_version
                FOREIGN KEY (risk_version_id) REFERENCES risk_versions(id)
                ON DELETE CASCADE;
            END IF;

            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 'fk_risk_evidence_link_evidence_file'
            ) THEN
                ALTER TABLE risk_evidence_link
                ADD CONSTRAINT fk_risk_evidence_link_evidence_file
                FOREIGN KEY (evidence_file_id) REFERENCES evidence_files(id)
                ON DELETE CASCADE;
            END IF;
        END $$;;

CREATE INDEX IF NOT EXISTS ix_risk_evidence_link_tenant_id ON risk_evidence_link (tenant_id);;

CREATE INDEX IF NOT EXISTS ix_risk_evidence_link_risk_version_id ON risk_evidence_link (risk_version_id);;

CREATE INDEX IF NOT EXISTS ix_risk_evidence_link_evidence_file_id ON risk_evidence_link (evidence_file_id);;

UPDATE alembic_version SET version_num='d988e27ff409' WHERE alembic_version.version_num = '3a4c01e44100';

-- Running upgrade d988e27ff409 -> dbecd0b3187e

CREATE TABLE audit_sessions (
    id SERIAL NOT NULL, 
    tenant_id INTEGER NOT NULL, 
    standard_id INTEGER NOT NULL, 
    standard_version_id INTEGER NOT NULL, 
    status VARCHAR(16) DEFAULT 'ACTIVE' NOT NULL, 
    type VARCHAR(32), 
    target_maturity_level INTEGER, 
    created_by INTEGER, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    closed_at TIMESTAMP WITH TIME ZONE, 
    PRIMARY KEY (id)
);

CREATE INDEX ix_audit_sessions_tenant_id ON audit_sessions (tenant_id);

CREATE INDEX ix_audit_sessions_status ON audit_sessions (status);

CREATE INDEX ix_audit_sessions_standard_id ON audit_sessions (standard_id);

CREATE INDEX ix_audit_sessions_standard_version_id ON audit_sessions (standard_version_id);

ALTER TABLE audit_sessions ADD CONSTRAINT fk_audit_sessions_tenant FOREIGN KEY(tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT;

ALTER TABLE audit_sessions ADD CONSTRAINT fk_audit_sessions_standard FOREIGN KEY(standard_id) REFERENCES standards (id) ON DELETE RESTRICT;

ALTER TABLE audit_sessions ADD CONSTRAINT fk_audit_sessions_standard_version FOREIGN KEY(standard_version_id) REFERENCES standard_versions (id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX IF NOT EXISTS ux_one_active_audit_per_tenant_standard_version
        ON audit_sessions (tenant_id, standard_version_id)
        WHERE status = 'ACTIVE';;

CREATE TABLE audit_scope_entities (
    id SERIAL NOT NULL, 
    audit_session_id INTEGER NOT NULL, 
    entity_type VARCHAR(32) NOT NULL, 
    original_entity_id INTEGER, 
    entity_code VARCHAR(64), 
    entity_title VARCHAR(512), 
    entity_description TEXT, 
    clause_code VARCHAR(64), 
    requirement_code VARCHAR(64), 
    control_code VARCHAR(64), 
    applicability_dimensions JSONB, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id)
);

CREATE INDEX ix_audit_scope_entities_entity_type ON audit_scope_entities (entity_type);

CREATE INDEX ix_audit_scope_entities_audit_session_id ON audit_scope_entities (audit_session_id);

CREATE INDEX ix_audit_scope_entities_original_entity_id ON audit_scope_entities (original_entity_id);

ALTER TABLE audit_scope_entities ADD CONSTRAINT fk_audit_scope_entities_session FOREIGN KEY(audit_session_id) REFERENCES audit_sessions (id) ON DELETE CASCADE;

CREATE INDEX ix_audit_scope_entities_session ON audit_scope_entities (audit_session_id);

CREATE TABLE audit_evidence_snapshots (
    id SERIAL NOT NULL, 
    audit_session_id INTEGER NOT NULL, 
    audit_scope_entity_id INTEGER NOT NULL, 
    evidence_file_id INTEGER NOT NULL, 
    file_name VARCHAR(512), 
    file_path VARCHAR(1024), 
    file_size INTEGER, 
    mime_type VARCHAR(255), 
    status VARCHAR(32), 
    uploaded_by INTEGER, 
    uploaded_at TIMESTAMP WITH TIME ZONE, 
    approved_by INTEGER, 
    approved_at TIMESTAMP WITH TIME ZONE, 
    snapshot_taken_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id)
);

CREATE INDEX ix_audit_evidence_snapshots_audit_session_id ON audit_evidence_snapshots (audit_session_id);

CREATE INDEX ix_audit_evidence_snapshots_audit_scope_entity_id ON audit_evidence_snapshots (audit_scope_entity_id);

CREATE INDEX ix_audit_evidence_snapshots_evidence_file_id ON audit_evidence_snapshots (evidence_file_id);

ALTER TABLE audit_evidence_snapshots ADD CONSTRAINT fk_audit_evidence_snapshots_session FOREIGN KEY(audit_session_id) REFERENCES audit_sessions (id) ON DELETE CASCADE;

ALTER TABLE audit_evidence_snapshots ADD CONSTRAINT fk_audit_evidence_snapshots_entity FOREIGN KEY(audit_scope_entity_id) REFERENCES audit_scope_entities (id) ON DELETE CASCADE;

ALTER TABLE audit_evidence_snapshots ADD CONSTRAINT fk_audit_evidence_snapshots_evidence_file FOREIGN KEY(evidence_file_id) REFERENCES evidence_files (id) ON DELETE RESTRICT;

CREATE TABLE audit_risk_snapshots (
    id SERIAL NOT NULL, 
    audit_session_id INTEGER NOT NULL, 
    audit_scope_entity_id INTEGER NOT NULL, 
    risk_version_id INTEGER NOT NULL, 
    impact INTEGER, 
    likelihood INTEGER, 
    score INTEGER, 
    risk_level VARCHAR(64), 
    status VARCHAR(64), 
    snapshot_taken_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id)
);

CREATE INDEX ix_audit_risk_snapshots_audit_session_id ON audit_risk_snapshots (audit_session_id);

CREATE INDEX ix_audit_risk_snapshots_risk_version_id ON audit_risk_snapshots (risk_version_id);

CREATE INDEX ix_audit_risk_snapshots_audit_scope_entity_id ON audit_risk_snapshots (audit_scope_entity_id);

ALTER TABLE audit_risk_snapshots ADD CONSTRAINT fk_audit_risk_snapshots_session FOREIGN KEY(audit_session_id) REFERENCES audit_sessions (id) ON DELETE CASCADE;

ALTER TABLE audit_risk_snapshots ADD CONSTRAINT fk_audit_risk_snapshots_entity FOREIGN KEY(audit_scope_entity_id) REFERENCES audit_scope_entities (id) ON DELETE CASCADE;

ALTER TABLE audit_risk_snapshots ADD CONSTRAINT fk_audit_risk_snapshots_risk_version FOREIGN KEY(risk_version_id) REFERENCES risk_versions (id) ON DELETE RESTRICT;

CREATE TABLE audit_findings (
    id SERIAL NOT NULL, 
    audit_session_id INTEGER NOT NULL, 
    audit_scope_entity_id INTEGER NOT NULL, 
    gap_level INTEGER DEFAULT '0' NOT NULL, 
    coverage_score INTEGER, 
    risk_weight INTEGER, 
    priority_score INTEGER, 
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id)
);

CREATE INDEX ix_audit_findings_audit_scope_entity_id ON audit_findings (audit_scope_entity_id);

CREATE INDEX ix_audit_findings_audit_session_id ON audit_findings (audit_session_id);

ALTER TABLE audit_findings ADD CONSTRAINT fk_audit_findings_session FOREIGN KEY(audit_session_id) REFERENCES audit_sessions (id) ON DELETE CASCADE;

ALTER TABLE audit_findings ADD CONSTRAINT fk_audit_findings_entity FOREIGN KEY(audit_scope_entity_id) REFERENCES audit_scope_entities (id) ON DELETE CASCADE;

UPDATE alembic_version SET version_num='dbecd0b3187e' WHERE alembic_version.version_num = 'd988e27ff409';

-- Running upgrade dbecd0b3187e -> 70ffbf010b7b

UPDATE risks SET tenant_id = 1 WHERE tenant_id IS NULL;;

UPDATE evidences SET tenant_id = 1 WHERE tenant_id IS NULL;;

ALTER TABLE risks ALTER COLUMN tenant_id SET NOT NULL;

ALTER TABLE evidences ALTER COLUMN tenant_id SET NOT NULL;

ALTER TABLE risks ADD CONSTRAINT fk_risks_tenant FOREIGN KEY(tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT;

ALTER TABLE evidences ADD CONSTRAINT fk_evidences_tenant FOREIGN KEY(tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT;

CREATE INDEX ix_risks_tenant_id ON risks (tenant_id);

CREATE INDEX ix_evidences_tenant_id ON evidences (tenant_id);

UPDATE alembic_version SET version_num='70ffbf010b7b' WHERE alembic_version.version_num = 'dbecd0b3187e';

-- Running upgrade 70ffbf010b7b -> 4cec8172ff38

CREATE TABLE company_profiles (
    id SERIAL NOT NULL, 
    tenant_id INTEGER NOT NULL, 
    legal_name VARCHAR(255) NOT NULL, 
    trade_name VARCHAR(255), 
    tax_id VARCHAR(100), 
    registration_no VARCHAR(100), 
    industry VARCHAR(255), 
    employee_count INTEGER, 
    headquarters_address TEXT, 
    website VARCHAR(255), 
    internal_issues TEXT, 
    external_issues TEXT, 
    strategic_objectives TEXT, 
    scope_description TEXT, 
    excluded_activities TEXT, 
    status VARCHAR(50) DEFAULT 'draft' NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
    PRIMARY KEY (id), 
    FOREIGN KEY(tenant_id) REFERENCES tenants (id) ON DELETE CASCADE
);

CREATE INDEX ix_company_profiles_tenant_id ON company_profiles (tenant_id);

UPDATE alembic_version SET version_num='4cec8172ff38' WHERE alembic_version.version_num = '70ffbf010b7b';

-- Running upgrade 4cec8172ff38 -> 698420244df1

CREATE TABLE processes (
    id SERIAL NOT NULL, 
    tenant_id INTEGER NOT NULL, 
    code VARCHAR(50) NOT NULL, 
    name VARCHAR(255) NOT NULL, 
    type VARCHAR(50) NOT NULL, 
    owner VARCHAR(255), 
    status VARCHAR(50) DEFAULT 'draft' NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
    PRIMARY KEY (id), 
    FOREIGN KEY(tenant_id) REFERENCES tenants (id) ON DELETE CASCADE
);

CREATE INDEX ix_processes_tenant_id ON processes (tenant_id);

UPDATE alembic_version SET version_num='698420244df1' WHERE alembic_version.version_num = '4cec8172ff38';

-- Running upgrade 698420244df1 -> d5124af26a47

CREATE TABLE process_risk_links (
    id SERIAL NOT NULL, 
    tenant_id INTEGER NOT NULL, 
    process_id INTEGER NOT NULL, 
    risk_id INTEGER NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
    PRIMARY KEY (id), 
    FOREIGN KEY(tenant_id) REFERENCES tenants (id) ON DELETE CASCADE, 
    FOREIGN KEY(process_id) REFERENCES processes (id) ON DELETE CASCADE, 
    FOREIGN KEY(risk_id) REFERENCES risks (id) ON DELETE CASCADE
);

CREATE INDEX ix_prl_tenant_id ON process_risk_links (tenant_id);

CREATE INDEX ix_prl_process_id ON process_risk_links (process_id);

CREATE INDEX ix_prl_risk_id ON process_risk_links (risk_id);

ALTER TABLE process_risk_links ADD CONSTRAINT uq_process_risk_unique UNIQUE (process_id, risk_id);

UPDATE alembic_version SET version_num='d5124af26a47' WHERE alembic_version.version_num = '698420244df1';

-- Running upgrade d5124af26a47 -> 0bfbca637f57

CREATE TABLE process_risk_links (
    id SERIAL NOT NULL, 
    tenant_id INTEGER NOT NULL, 
    process_id INTEGER NOT NULL, 
    risk_id INTEGER NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
    PRIMARY KEY (id), 
    CONSTRAINT uq_process_risk_unique UNIQUE (process_id, risk_id), 
    FOREIGN KEY(tenant_id) REFERENCES tenants (id) ON DELETE CASCADE, 
    FOREIGN KEY(process_id) REFERENCES processes (id) ON DELETE CASCADE, 
    FOREIGN KEY(risk_id) REFERENCES risks (id) ON DELETE CASCADE
);

CREATE INDEX ix_process_risk_links_tenant_id ON process_risk_links (tenant_id);

CREATE INDEX ix_process_risk_links_process_id ON process_risk_links (process_id);

CREATE INDEX ix_process_risk_links_risk_id ON process_risk_links (risk_id);

UPDATE alembic_version SET version_num='0bfbca637f57' WHERE alembic_version.version_num = 'd5124af26a47';

-- Running upgrade 0bfbca637f57 -> 4b044f718f99

CREATE TABLE compliance_tasks (
    id SERIAL NOT NULL, 
    tenant_id INTEGER NOT NULL, 
    title VARCHAR(255) NOT NULL, 
    description TEXT, 
    status VARCHAR(50) DEFAULT 'open' NOT NULL, 
    due_date TIMESTAMP WITHOUT TIME ZONE, 
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(), 
    updated_at TIMESTAMP WITHOUT TIME ZONE, 
    PRIMARY KEY (id), 
    FOREIGN KEY(tenant_id) REFERENCES tenants (id) ON DELETE CASCADE
);

CREATE INDEX ix_compliance_tasks_tenant_id ON compliance_tasks (tenant_id);

UPDATE alembic_version SET version_num='4b044f718f99' WHERE alembic_version.version_num = '0bfbca637f57';

-- Running upgrade 4b044f718f99 -> 69540cc29585

CREATE TABLE clause_weight_overrides (
    id SERIAL NOT NULL, 
    tenant_id INTEGER NOT NULL, 
    standard_id INTEGER NOT NULL, 
    clause_id INTEGER NOT NULL, 
    weight_pct FLOAT NOT NULL, 
    rationale VARCHAR, 
    is_active BOOLEAN DEFAULT true NOT NULL, 
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(tenant_id) REFERENCES tenants (id) ON DELETE CASCADE, 
    FOREIGN KEY(standard_id) REFERENCES standards (id) ON DELETE CASCADE, 
    FOREIGN KEY(clause_id) REFERENCES clauses (id) ON DELETE CASCADE
);

CREATE INDEX ix_cwo_tenant_id ON clause_weight_overrides (tenant_id);

CREATE INDEX ix_cwo_standard_id ON clause_weight_overrides (standard_id);

CREATE INDEX ix_cwo_clause_id ON clause_weight_overrides (clause_id);

ALTER TABLE clause_weight_overrides ADD CONSTRAINT ux_cwo_tenant_standard_clause UNIQUE (tenant_id, standard_id, clause_id);

UPDATE alembic_version SET version_num='69540cc29585' WHERE alembic_version.version_num = '4b044f718f99';

-- Running upgrade 69540cc29585 -> e9e3f1dd9bc9

CREATE TABLE external_integrations (
    id SERIAL NOT NULL, 
    tenant_id INTEGER NOT NULL, 
    provider VARCHAR(30) NOT NULL, 
    base_url VARCHAR(500), 
    jira_email VARCHAR(255), 
    api_token VARCHAR(500), 
    project_key VARCHAR(50), 
    issue_type VARCHAR(50), 
    team_id VARCHAR(50), 
    space_id VARCHAR(50), 
    folder_id VARCHAR(50), 
    list_id VARCHAR(50), 
    is_active BOOLEAN DEFAULT true NOT NULL, 
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(tenant_id) REFERENCES tenants (id) ON DELETE CASCADE, 
    CONSTRAINT ux_external_integrations_tenant_provider UNIQUE (tenant_id, provider)
);

CREATE INDEX ix_external_integrations_tenant_id ON external_integrations (tenant_id);

CREATE INDEX ix_external_integrations_provider ON external_integrations (provider);

CREATE TABLE task_external_links (
    id SERIAL NOT NULL, 
    tenant_id INTEGER NOT NULL, 
    task_id INTEGER NOT NULL, 
    provider VARCHAR(30) NOT NULL, 
    external_key VARCHAR(200) NOT NULL, 
    sync_status VARCHAR(30) DEFAULT 'synced' NOT NULL, 
    last_synced_at TIMESTAMP WITHOUT TIME ZONE, 
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(tenant_id) REFERENCES tenants (id) ON DELETE CASCADE, 
    FOREIGN KEY(task_id) REFERENCES compliance_tasks (id) ON DELETE CASCADE, 
    CONSTRAINT ux_task_external_links_tenant_provider_task UNIQUE (tenant_id, provider, task_id), 
    CONSTRAINT ux_task_external_links_tenant_provider_external UNIQUE (tenant_id, provider, external_key)
);

CREATE INDEX ix_task_external_links_tenant_id ON task_external_links (tenant_id);

CREATE INDEX ix_task_external_links_provider ON task_external_links (provider);

CREATE INDEX ix_task_external_links_task_id ON task_external_links (task_id);

UPDATE alembic_version SET version_num='e9e3f1dd9bc9' WHERE alembic_version.version_num = '69540cc29585';

-- Running upgrade e9e3f1dd9bc9 -> 5157167d1edb

CREATE TABLE audit_plan_items (
    id SERIAL NOT NULL, 
    tenant_id INTEGER NOT NULL, 
    risk_id INTEGER NOT NULL, 
    control_id INTEGER, 
    process_id INTEGER, 
    forecast_id INTEGER, 
    escalation_probability_30d FLOAT, 
    expected_score_delta FLOAT, 
    priority VARCHAR NOT NULL, 
    source VARCHAR DEFAULT 'forecast' NOT NULL, 
    status VARCHAR DEFAULT 'planned' NOT NULL, 
    snapshot_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL, 
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(), 
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(), 
    PRIMARY KEY (id), 
    FOREIGN KEY(tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT, 
    FOREIGN KEY(risk_id) REFERENCES risks (id) ON DELETE CASCADE, 
    FOREIGN KEY(control_id) REFERENCES controls (id) ON DELETE SET NULL, 
    FOREIGN KEY(process_id) REFERENCES processes (id) ON DELETE SET NULL, 
    FOREIGN KEY(forecast_id) REFERENCES risk_forecasts (id) ON DELETE SET NULL
);

ALTER TABLE audit_plan_items ADD CONSTRAINT uq_audit_plan_forecast_once UNIQUE (tenant_id, risk_id, forecast_id);

CREATE INDEX ix_audit_plan_items_tenant_id ON audit_plan_items (tenant_id);

CREATE INDEX ix_audit_plan_items_risk_id ON audit_plan_items (risk_id);

CREATE INDEX ix_audit_plan_items_forecast_id ON audit_plan_items (forecast_id);

CREATE TABLE gap_items (
    id SERIAL NOT NULL, 
    tenant_id INTEGER NOT NULL, 
    risk_id INTEGER NOT NULL, 
    control_id INTEGER, 
    forecast_id INTEGER, 
    gap_type VARCHAR NOT NULL, 
    severity_score FLOAT, 
    status VARCHAR DEFAULT 'open' NOT NULL, 
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(), 
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(), 
    PRIMARY KEY (id), 
    FOREIGN KEY(tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT, 
    FOREIGN KEY(risk_id) REFERENCES risks (id) ON DELETE CASCADE, 
    FOREIGN KEY(control_id) REFERENCES controls (id) ON DELETE SET NULL, 
    FOREIGN KEY(forecast_id) REFERENCES risk_forecasts (id) ON DELETE SET NULL
);

ALTER TABLE gap_items ADD CONSTRAINT uq_gap_forecast_once UNIQUE (tenant_id, risk_id, forecast_id);

CREATE INDEX ix_gap_items_tenant_id ON gap_items (tenant_id);

CREATE INDEX ix_gap_items_risk_id ON gap_items (risk_id);

CREATE INDEX ix_gap_items_forecast_id ON gap_items (forecast_id);

UPDATE alembic_version SET version_num='5157167d1edb' WHERE alembic_version.version_num = 'e9e3f1dd9bc9';

-- Running upgrade 5157167d1edb -> 97d434b7d7ef

ALTER TABLE compliance_tasks DROP COLUMN created_from_gap;

ALTER TABLE compliance_tasks ADD COLUMN source_type VARCHAR(50);

ALTER TABLE compliance_tasks ADD COLUMN source_id INTEGER;

UPDATE compliance_tasks
        SET source_type = 'manual'
        WHERE source_type IS NULL;

ALTER TABLE compliance_tasks ALTER COLUMN source_type SET NOT NULL;

UPDATE alembic_version SET version_num='97d434b7d7ef' WHERE alembic_version.version_num = '5157167d1edb';

-- Running upgrade 97d434b7d7ef -> 0cead64a939d

CREATE SCHEMA IF NOT EXISTS analytics;;

CREATE OR REPLACE VIEW analytics.v_evidence_intelligence AS
        SELECT
            e.tenant_id,
            e.id AS evidence_id,
            e.title,
            e.assessment_type,

            COUNT(DISTINCT ef.id) AS files_count,

            COUNT(
                DISTINCT CASE
                    WHEN ef.status = 'Approved' THEN ef.id
                END
            ) AS approved_files_count,

            MAX(ef.uploaded_at) AS last_uploaded_at,
            MAX(ef.approved_at) AS last_approved_at,

            COUNT(DISTINCT rel.id) AS linked_risks_count,

            CASE
                WHEN COUNT(DISTINCT rel.id) = 0 THEN TRUE
                ELSE FALSE
            END AS is_orphan,

            EXTRACT(DAY FROM (NOW() - MAX(ef.uploaded_at))) AS age_days,

            (
                50
                + CASE WHEN COUNT(DISTINCT rel.id) > 0 THEN 10 ELSE -20 END
                + CASE WHEN COUNT(DISTINCT ef.id) > 0 THEN 10 ELSE 0 END
                + CASE
                    WHEN COUNT(
                        DISTINCT CASE WHEN ef.status='Approved' THEN ef.id END
                    ) > 0 THEN 20
                    ELSE 0
                  END
            ) AS quality_score

        FROM evidences e
        LEFT JOIN evidence_files ef
            ON ef.evidence_id = e.id
            AND ef.tenant_id = e.tenant_id
        LEFT JOIN risk_evidence_link rel
            ON rel.evidence_file_id = ef.id
            AND rel.tenant_id = e.tenant_id

        WHERE e.is_deleted = FALSE

        GROUP BY
            e.tenant_id,
            e.id,
            e.title,
            e.assessment_type;;

CREATE OR REPLACE VIEW analytics.v_risk_exposure AS
        SELECT
            rv.tenant_id,
            rv.id AS risk_version_id,
            rv.score AS risk_score,

            COUNT(DISTINCT rel.evidence_file_id) AS linked_evidence_count,

            COUNT(
                DISTINCT CASE
                    WHEN ef.status='Approved' THEN ef.id
                END
            ) AS approved_evidence_count,

            CASE
                WHEN COUNT(
                    DISTINCT CASE WHEN ef.status='Approved' THEN ef.id END
                ) > 0 THEN TRUE
                ELSE FALSE
            END AS is_covered,

            (
                rv.score *
                CASE
                    WHEN COUNT(
                        DISTINCT CASE WHEN ef.status='Approved' THEN ef.id END
                    ) > 0 THEN 0.2
                    ELSE 1
                END
            ) AS exposure_score

        FROM risk_versions rv
        LEFT JOIN risk_evidence_link rel
            ON rel.risk_version_id = rv.id
            AND rel.tenant_id = rv.tenant_id
        LEFT JOIN evidence_files ef
            ON ef.id = rel.evidence_file_id
            AND ef.tenant_id = rv.tenant_id

        GROUP BY
            rv.tenant_id,
            rv.id,
            rv.score;;

CREATE OR REPLACE VIEW analytics.v_dashboard_summary AS
        SELECT
            tenant_id,

            COUNT(*) FILTER (
                WHERE is_orphan = TRUE
            ) AS orphan_evidences,

            AVG(quality_score) AS avg_quality_score,

            COUNT(*) AS total_evidences

        FROM analytics.v_evidence_intelligence
        GROUP BY tenant_id;;

UPDATE alembic_version SET version_num='0cead64a939d' WHERE alembic_version.version_num = '97d434b7d7ef';

-- Running upgrade 0cead64a939d, 20260818_control_requirement_nullable, 20260819_fix_uee_control_coverage_contract, a1b7c9d2e4f0, c3f1a9b7e2d4 -> ad0d1c70482e

DELETE FROM alembic_version WHERE alembic_version.version_num = '0cead64a939d';

DELETE FROM alembic_version WHERE alembic_version.version_num = '20260818_control_requirement_nullable';

DELETE FROM alembic_version WHERE alembic_version.version_num = '20260819_fix_uee_control_coverage_contract';

DELETE FROM alembic_version WHERE alembic_version.version_num = 'a1b7c9d2e4f0';

UPDATE alembic_version SET version_num='ad0d1c70482e' WHERE alembic_version.version_num = 'c3f1a9b7e2d4';

-- Running upgrade ad0d1c70482e -> a80b6948d776

ALTER TABLE company_profiles ADD COLUMN policy_summary TEXT;

ALTER TABLE company_profiles ADD COLUMN leadership_representative VARCHAR(255);

ALTER TABLE company_profiles ADD COLUMN compliance_officer VARCHAR(255);

ALTER TABLE company_profiles ADD COLUMN included_locations JSONB DEFAULT '[]'::jsonb NOT NULL;

ALTER TABLE company_profiles ALTER COLUMN included_locations DROP DEFAULT;

UPDATE alembic_version SET version_num='a80b6948d776' WHERE alembic_version.version_num = 'ad0d1c70482e';

-- Running upgrade a80b6948d776 -> 1e2a3f5cdad5

CREATE TABLE company_objectives (
    id SERIAL NOT NULL, 
    code VARCHAR(50) NOT NULL, 
    title VARCHAR(255) NOT NULL, 
    description TEXT, 
    tenant_id INTEGER NOT NULL, 
    objective_type VARCHAR(50) DEFAULT 'strategic' NOT NULL, 
    priority VARCHAR(20) DEFAULT 'medium' NOT NULL, 
    status VARCHAR(30) DEFAULT 'draft' NOT NULL, 
    owner_user_id INTEGER, 
    target_date TIMESTAMP WITH TIME ZONE, 
    measurement_method TEXT, 
    target_value NUMERIC(18, 4), 
    current_value NUMERIC(18, 4), 
    unit VARCHAR(50), 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(tenant_id) REFERENCES tenants (id) ON DELETE CASCADE, 
    FOREIGN KEY(owner_user_id) REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX ix_company_objectives_id ON company_objectives (id);

CREATE INDEX ix_company_objectives_code ON company_objectives (code);

CREATE INDEX ix_company_objectives_tenant_id ON company_objectives (tenant_id);

CREATE INDEX ix_company_objectives_owner_user_id ON company_objectives (owner_user_id);

UPDATE alembic_version SET version_num='1e2a3f5cdad5' WHERE alembic_version.version_num = 'a80b6948d776';

-- Running upgrade 1e2a3f5cdad5 -> 50e8b05393c4

CREATE TABLE assets (
    id SERIAL NOT NULL, 
    code VARCHAR(50) NOT NULL, 
    name VARCHAR(255) NOT NULL, 
    description TEXT, 
    tenant_id INTEGER NOT NULL, 
    asset_type VARCHAR(50) DEFAULT 'other' NOT NULL, 
    criticality VARCHAR(20) DEFAULT 'medium' NOT NULL, 
    status VARCHAR(30) DEFAULT 'active' NOT NULL, 
    lifecycle_status VARCHAR(30) DEFAULT 'in_service' NOT NULL, 
    information_classification VARCHAR(50), 
    owner_user_id INTEGER, 
    custodian_user_id INTEGER, 
    department VARCHAR(255), 
    location VARCHAR(255), 
    manufacturer VARCHAR(255), 
    model_number VARCHAR(255), 
    serial_number VARCHAR(255), 
    acquisition_date TIMESTAMP WITH TIME ZONE, 
    warranty_expiry TIMESTAMP WITH TIME ZONE, 
    contract_expiry TIMESTAMP WITH TIME ZONE, 
    notes TEXT, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(tenant_id) REFERENCES tenants (id) ON DELETE CASCADE, 
    FOREIGN KEY(owner_user_id) REFERENCES users (id) ON DELETE SET NULL, 
    FOREIGN KEY(custodian_user_id) REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX ix_assets_id ON assets (id);

CREATE INDEX ix_assets_code ON assets (code);

CREATE INDEX ix_assets_tenant_id ON assets (tenant_id);

CREATE INDEX ix_assets_asset_type ON assets (asset_type);

CREATE INDEX ix_assets_criticality ON assets (criticality);

CREATE INDEX ix_assets_status ON assets (status);

CREATE INDEX ix_assets_lifecycle_status ON assets (lifecycle_status);

CREATE INDEX ix_assets_owner_user_id ON assets (owner_user_id);

CREATE INDEX ix_assets_custodian_user_id ON assets (custodian_user_id);

CREATE INDEX ix_assets_department ON assets (department);

CREATE INDEX ix_assets_location ON assets (location);

CREATE INDEX ix_assets_serial_number ON assets (serial_number);

UPDATE alembic_version SET version_num='50e8b05393c4' WHERE alembic_version.version_num = '1e2a3f5cdad5';

-- Running upgrade 50e8b05393c4 -> b7c4d9e2f801

ALTER TABLE risk_history ADD COLUMN change_reason TEXT;

UPDATE alembic_version SET version_num='b7c4d9e2f801' WHERE alembic_version.version_num = '50e8b05393c4';

-- Running upgrade b7c4d9e2f801 -> 94a9b3d3fc40

CREATE TABLE organizations (
    id SERIAL NOT NULL, 
    tenant_id INTEGER NOT NULL, 
    name VARCHAR(255) NOT NULL, 
    legal_name VARCHAR(255), 
    industry VARCHAR(150), 
    company_size VARCHAR(50), 
    employee_count INTEGER, 
    description TEXT, 
    mission TEXT, 
    vision TEXT, 
    scope_statement TEXT, 
    status VARCHAR(30) DEFAULT 'ACTIVE' NOT NULL, 
    created_by INTEGER, 
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT
);

CREATE INDEX ix_organizations_tenant_id ON organizations (tenant_id);

UPDATE alembic_version SET version_num='94a9b3d3fc40' WHERE alembic_version.version_num = 'b7c4d9e2f801';

-- Running upgrade 94a9b3d3fc40 -> 60be4ef8bf11

CREATE TABLE locations (
    id SERIAL NOT NULL, 
    tenant_id INTEGER NOT NULL, 
    organization_id INTEGER NOT NULL, 
    name VARCHAR(255) NOT NULL, 
    code VARCHAR(50), 
    location_type VARCHAR(50), 
    address TEXT, 
    city VARCHAR(100), 
    country VARCHAR(100), 
    contact_person VARCHAR(255), 
    contact_email VARCHAR(255), 
    contact_phone VARCHAR(50), 
    status VARCHAR(30) DEFAULT 'ACTIVE' NOT NULL, 
    created_by INTEGER, 
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT, 
    FOREIGN KEY(organization_id) REFERENCES organizations (id) ON DELETE CASCADE
);

CREATE INDEX ix_locations_tenant_id ON locations (tenant_id);

CREATE INDEX ix_locations_organization_id ON locations (organization_id);

UPDATE alembic_version SET version_num='60be4ef8bf11' WHERE alembic_version.version_num = '94a9b3d3fc40';

-- Running upgrade 60be4ef8bf11 -> 9a91605895af

CREATE TABLE stakeholders (
    id SERIAL NOT NULL, 
    tenant_id INTEGER NOT NULL, 
    organization_id INTEGER NOT NULL, 
    name VARCHAR(255) NOT NULL, 
    stakeholder_type VARCHAR(100), 
    relationship VARCHAR(150), 
    description TEXT, 
    contact_person VARCHAR(255), 
    email VARCHAR(255), 
    phone VARCHAR(50), 
    importance VARCHAR(50), 
    status VARCHAR(30) DEFAULT 'ACTIVE' NOT NULL, 
    created_by INTEGER, 
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT, 
    FOREIGN KEY(organization_id) REFERENCES organizations (id) ON DELETE CASCADE
);

CREATE INDEX ix_stakeholders_tenant_id ON stakeholders (tenant_id);

CREATE INDEX ix_stakeholders_organization_id ON stakeholders (organization_id);

UPDATE alembic_version SET version_num='9a91605895af' WHERE alembic_version.version_num = '60be4ef8bf11';

-- Running upgrade 9a91605895af -> c3a874f5c130

CREATE TABLE departments (
    id SERIAL NOT NULL, 
    tenant_id INTEGER NOT NULL, 
    organization_id INTEGER NOT NULL, 
    name VARCHAR(255) NOT NULL, 
    code VARCHAR(50), 
    description TEXT, 
    manager_id INTEGER, 
    status VARCHAR(30) DEFAULT 'active' NOT NULL, 
    created_by INTEGER, 
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT, 
    FOREIGN KEY(organization_id) REFERENCES organizations (id) ON DELETE CASCADE, 
    FOREIGN KEY(manager_id) REFERENCES users (id) ON DELETE SET NULL
);

UPDATE alembic_version SET version_num='c3a874f5c130' WHERE alembic_version.version_num = '9a91605895af';

-- Running upgrade c3a874f5c130 -> c30aa844a5db

CREATE TABLE governance_policies (
    id SERIAL NOT NULL, 
    tenant_id INTEGER NOT NULL, 
    policy_code VARCHAR(100) NOT NULL, 
    title VARCHAR(255) NOT NULL, 
    description TEXT, 
    category VARCHAR(50) NOT NULL, 
    status VARCHAR(50) NOT NULL, 
    version VARCHAR(50) NOT NULL, 
    owner_id INTEGER, 
    approver_id INTEGER, 
    effective_date TIMESTAMP WITH TIME ZONE, 
    review_date TIMESTAMP WITH TIME ZONE, 
    is_deleted BOOLEAN DEFAULT 'false' NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(tenant_id) REFERENCES tenants (id) ON DELETE CASCADE, 
    FOREIGN KEY(owner_id) REFERENCES users (id) ON DELETE SET NULL, 
    FOREIGN KEY(approver_id) REFERENCES users (id) ON DELETE SET NULL
);

UPDATE alembic_version SET version_num='c30aa844a5db' WHERE alembic_version.version_num = 'c3a874f5c130';

-- Running upgrade c30aa844a5db -> 3d82c27021a7

CREATE TABLE governance_procedures (
    id SERIAL NOT NULL, 
    tenant_id INTEGER NOT NULL, 
    policy_id INTEGER NOT NULL, 
    procedure_code VARCHAR(100) NOT NULL, 
    title VARCHAR(255) NOT NULL, 
    description TEXT, 
    owner_id INTEGER, 
    status VARCHAR(50) DEFAULT 'draft' NOT NULL, 
    version VARCHAR(50) DEFAULT '1.0' NOT NULL, 
    effective_date TIMESTAMP WITH TIME ZONE, 
    review_date TIMESTAMP WITH TIME ZONE, 
    is_deleted BOOLEAN DEFAULT 'false' NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(tenant_id) REFERENCES tenants (id) ON DELETE CASCADE, 
    FOREIGN KEY(policy_id) REFERENCES governance_policies (id) ON DELETE CASCADE, 
    FOREIGN KEY(owner_id) REFERENCES users (id) ON DELETE SET NULL
);

UPDATE alembic_version SET version_num='3d82c27021a7' WHERE alembic_version.version_num = 'c30aa844a5db';

-- Running upgrade 3d82c27021a7 -> b1a235c17b8f

CREATE TABLE governance_procedure_controls (
    id SERIAL NOT NULL, 
    tenant_id INTEGER NOT NULL, 
    procedure_id INTEGER NOT NULL, 
    control_id INTEGER NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(tenant_id) REFERENCES tenants (id) ON DELETE CASCADE, 
    FOREIGN KEY(procedure_id) REFERENCES governance_procedures (id) ON DELETE CASCADE, 
    FOREIGN KEY(control_id) REFERENCES controls (id) ON DELETE CASCADE
);

UPDATE alembic_version SET version_num='b1a235c17b8f' WHERE alembic_version.version_num = '3d82c27021a7';

-- Running upgrade b1a235c17b8f -> c7f4a9d21e63

CREATE TABLE governance_procedure_documents (
    id SERIAL NOT NULL, 
    tenant_id INTEGER NOT NULL, 
    procedure_id INTEGER NOT NULL, 
    version VARCHAR(50) NOT NULL, 
    file_name VARCHAR(255) NOT NULL, 
    storage_key VARCHAR(1000) NOT NULL, 
    mime_type VARCHAR(255), 
    file_size INTEGER, 
    checksum VARCHAR(128), 
    status VARCHAR(50) DEFAULT 'uploaded' NOT NULL, 
    is_current BOOLEAN DEFAULT false NOT NULL, 
    is_archived BOOLEAN DEFAULT false NOT NULL, 
    uploaded_by INTEGER, 
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    archived_at TIMESTAMP WITH TIME ZONE, 
    PRIMARY KEY (id), 
    FOREIGN KEY(tenant_id) REFERENCES tenants (id) ON DELETE CASCADE, 
    FOREIGN KEY(procedure_id) REFERENCES governance_procedures (id) ON DELETE CASCADE, 
    FOREIGN KEY(uploaded_by) REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX ix_governance_procedure_documents_tenant_id ON governance_procedure_documents (tenant_id);

CREATE INDEX ix_governance_procedure_documents_procedure_id ON governance_procedure_documents (procedure_id);

CREATE INDEX ix_governance_procedure_documents_status ON governance_procedure_documents (status);

CREATE INDEX ix_governance_procedure_documents_is_archived ON governance_procedure_documents (is_archived);

CREATE INDEX ix_governance_procedure_documents_is_current ON governance_procedure_documents (is_current);

UPDATE alembic_version SET version_num='c7f4a9d21e63' WHERE alembic_version.version_num = 'b1a235c17b8f';

-- Running upgrade c7f4a9d21e63 -> 5686b206c979

ALTER TABLE governance_procedure_documents ADD COLUMN reviewer_id INTEGER;

ALTER TABLE governance_procedure_documents ADD COLUMN reviewed_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE governance_procedure_documents ADD COLUMN approved_by INTEGER;

ALTER TABLE governance_procedure_documents ADD COLUMN approved_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE governance_procedure_documents ADD COLUMN rejected_by INTEGER;

ALTER TABLE governance_procedure_documents ADD COLUMN rejected_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE governance_procedure_documents ADD COLUMN review_comment TEXT;

ALTER TABLE governance_procedure_documents ADD CONSTRAINT fk_gpd_reviewer FOREIGN KEY(reviewer_id) REFERENCES users (id) ON DELETE SET NULL;

ALTER TABLE governance_procedure_documents ADD CONSTRAINT fk_gpd_approved_by FOREIGN KEY(approved_by) REFERENCES users (id) ON DELETE SET NULL;

ALTER TABLE governance_procedure_documents ADD CONSTRAINT fk_gpd_rejected_by FOREIGN KEY(rejected_by) REFERENCES users (id) ON DELETE SET NULL;

UPDATE alembic_version SET version_num='5686b206c979' WHERE alembic_version.version_num = 'c7f4a9d21e63';

-- Running upgrade 5686b206c979 -> 72e67c309203

CREATE TABLE governance_document_history (
    id SERIAL NOT NULL, 
    document_id INTEGER NOT NULL, 
    action VARCHAR(50) NOT NULL, 
    old_status VARCHAR(50), 
    new_status VARCHAR(50), 
    comment VARCHAR(2000), 
    performed_by INTEGER, 
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(document_id) REFERENCES governance_procedure_documents (id) ON DELETE CASCADE, 
    FOREIGN KEY(performed_by) REFERENCES users (id) ON DELETE SET NULL
);

UPDATE alembic_version SET version_num='72e67c309203' WHERE alembic_version.version_num = '5686b206c979';

-- Running upgrade 72e67c309203 -> 372d0b7ac33c

CREATE TABLE evidence_file_history (
    id SERIAL NOT NULL, 
    evidence_file_id INTEGER NOT NULL, 
    action VARCHAR(50) NOT NULL, 
    old_status VARCHAR(50), 
    new_status VARCHAR(50), 
    comment TEXT, 
    performed_by INTEGER, 
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(evidence_file_id) REFERENCES evidence_files (id) ON DELETE CASCADE, 
    FOREIGN KEY(performed_by) REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX ix_evidence_file_history_id ON evidence_file_history (id);

CREATE INDEX ix_evidence_file_history_evidence_file_id ON evidence_file_history (evidence_file_id);

CREATE INDEX ix_evidence_file_history_performed_by ON evidence_file_history (performed_by);

UPDATE alembic_version SET version_num='372d0b7ac33c' WHERE alembic_version.version_num = '72e67c309203';

-- Running upgrade 372d0b7ac33c -> d348d0458aee

ALTER TABLE evidence_files ADD COLUMN rejected_by INTEGER;

ALTER TABLE evidence_files ADD COLUMN archive_path VARCHAR;

ALTER TABLE evidence_files ADD COLUMN archived_at TIMESTAMP WITHOUT TIME ZONE;

ALTER TABLE evidence_files ADD CONSTRAINT fk_evidence_files_rejected_by_users FOREIGN KEY(rejected_by) REFERENCES users (id) ON DELETE SET NULL;

UPDATE alembic_version SET version_num='d348d0458aee' WHERE alembic_version.version_num = '372d0b7ac33c';

-- Running upgrade d348d0458aee -> 1255131dc9da

CREATE TABLE task_evidence_links (
    id SERIAL NOT NULL, 
    tenant_id INTEGER NOT NULL, 
    task_id INTEGER NOT NULL, 
    evidence_id INTEGER NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
    PRIMARY KEY (id), 
    CONSTRAINT fk_task_evidence_links_tenant FOREIGN KEY(tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT, 
    CONSTRAINT fk_task_evidence_links_task FOREIGN KEY(task_id) REFERENCES compliance_tasks (id) ON DELETE CASCADE, 
    CONSTRAINT fk_task_evidence_links_evidence FOREIGN KEY(evidence_id) REFERENCES evidences (id) ON DELETE CASCADE
);

CREATE INDEX ix_task_evidence_links_task_id ON task_evidence_links (task_id);

CREATE INDEX ix_task_evidence_links_evidence_id ON task_evidence_links (evidence_id);

CREATE INDEX ix_task_evidence_links_tenant_id ON task_evidence_links (tenant_id);

UPDATE alembic_version SET version_num='1255131dc9da' WHERE alembic_version.version_num = 'd348d0458aee';

-- Running upgrade 1255131dc9da -> 762ef27be2ba

INSERT INTO roles (
                name,
                description,
                is_active
            )
            SELECT
                NULL,
                NULL,
                TRUE
            WHERE NOT EXISTS (
                SELECT 1
                FROM roles
                WHERE name = NULL
            );

INSERT INTO permissions (
                    code,
                    description
                )
                SELECT
                    NULL,
                    NULL
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM permissions
                    WHERE code = NULL
                );

INSERT INTO permissions (
                    code,
                    description
                )
                SELECT
                    NULL,
                    NULL
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM permissions
                    WHERE code = NULL
                );

INSERT INTO permissions (
                    code,
                    description
                )
                SELECT
                    NULL,
                    NULL
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM permissions
                    WHERE code = NULL
                );

INSERT INTO permissions (
                    code,
                    description
                )
                SELECT
                    NULL,
                    NULL
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM permissions
                    WHERE code = NULL
                );

INSERT INTO permissions (
                    code,
                    description
                )
                SELECT
                    NULL,
                    NULL
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM permissions
                    WHERE code = NULL
                );

INSERT INTO permissions (
                    code,
                    description
                )
                SELECT
                    NULL,
                    NULL
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM permissions
                    WHERE code = NULL
                );

INSERT INTO permissions (
                    code,
                    description
                )
                SELECT
                    NULL,
                    NULL
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM permissions
                    WHERE code = NULL
                );

INSERT INTO role_permissions (
                    role_id,
                    permission_id
                )
                SELECT
                    r.id,
                    p.id
                FROM roles r
                CROSS JOIN permissions p
                WHERE r.name = NULL
                  AND p.code = NULL
                  AND NOT EXISTS (
                      SELECT 1
                      FROM role_permissions rp
                      WHERE rp.role_id = r.id
                        AND rp.permission_id = p.id
                  );

INSERT INTO role_permissions (
                    role_id,
                    permission_id
                )
                SELECT
                    r.id,
                    p.id
                FROM roles r
                CROSS JOIN permissions p
                WHERE r.name = NULL
                  AND p.code = NULL
                  AND NOT EXISTS (
                      SELECT 1
                      FROM role_permissions rp
                      WHERE rp.role_id = r.id
                        AND rp.permission_id = p.id
                  );

INSERT INTO role_permissions (
                    role_id,
                    permission_id
                )
                SELECT
                    r.id,
                    p.id
                FROM roles r
                CROSS JOIN permissions p
                WHERE r.name = NULL
                  AND p.code = NULL
                  AND NOT EXISTS (
                      SELECT 1
                      FROM role_permissions rp
                      WHERE rp.role_id = r.id
                        AND rp.permission_id = p.id
                  );

INSERT INTO role_permissions (
                    role_id,
                    permission_id
                )
                SELECT
                    r.id,
                    p.id
                FROM roles r
                CROSS JOIN permissions p
                WHERE r.name = NULL
                  AND p.code = NULL
                  AND NOT EXISTS (
                      SELECT 1
                      FROM role_permissions rp
                      WHERE rp.role_id = r.id
                        AND rp.permission_id = p.id
                  );

INSERT INTO role_permissions (
                    role_id,
                    permission_id
                )
                SELECT
                    r.id,
                    p.id
                FROM roles r
                CROSS JOIN permissions p
                WHERE r.name = NULL
                  AND p.code = NULL
                  AND NOT EXISTS (
                      SELECT 1
                      FROM role_permissions rp
                      WHERE rp.role_id = r.id
                        AND rp.permission_id = p.id
                  );

INSERT INTO role_permissions (
                    role_id,
                    permission_id
                )
                SELECT
                    r.id,
                    p.id
                FROM roles r
                CROSS JOIN permissions p
                WHERE r.name = NULL
                  AND p.code = NULL
                  AND NOT EXISTS (
                      SELECT 1
                      FROM role_permissions rp
                      WHERE rp.role_id = r.id
                        AND rp.permission_id = p.id
                  );

INSERT INTO role_permissions (
                    role_id,
                    permission_id
                )
                SELECT
                    r.id,
                    p.id
                FROM roles r
                CROSS JOIN permissions p
                WHERE r.name = NULL
                  AND p.code = NULL
                  AND NOT EXISTS (
                      SELECT 1
                      FROM role_permissions rp
                      WHERE rp.role_id = r.id
                        AND rp.permission_id = p.id
                  );

UPDATE alembic_version SET version_num='762ef27be2ba' WHERE alembic_version.version_num = '1255131dc9da';

-- Running upgrade 762ef27be2ba -> 36caa9ef1ffa

CREATE TABLE compliance_obligations (
    id SERIAL NOT NULL, 
    tenant_id INTEGER NOT NULL, 
    code VARCHAR(100) NOT NULL, 
    title VARCHAR(500) NOT NULL, 
    description TEXT, 
    source_authority VARCHAR(255), 
    regulation_name VARCHAR(500), 
    jurisdiction VARCHAR(255), 
    reference_url VARCHAR(1000), 
    effective_date DATE, 
    expiry_date DATE, 
    review_date DATE, 
    status VARCHAR(32) DEFAULT 'active' NOT NULL, 
    criticality VARCHAR(32) DEFAULT 'medium' NOT NULL, 
    owner_user_id INTEGER, 
    applicability_status VARCHAR(32) DEFAULT 'under_review' NOT NULL, 
    applicability_reason TEXT, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(tenant_id) REFERENCES tenants (id) ON DELETE CASCADE, 
    FOREIGN KEY(owner_user_id) REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX ix_compliance_obligations_tenant_id ON compliance_obligations (tenant_id);

CREATE INDEX ix_compliance_obligations_code ON compliance_obligations (code);

CREATE INDEX ix_compliance_obligations_review_date ON compliance_obligations (review_date);

CREATE INDEX ix_compliance_obligations_status ON compliance_obligations (status);

CREATE INDEX ix_compliance_obligations_criticality ON compliance_obligations (criticality);

CREATE INDEX ix_compliance_obligations_owner_user_id ON compliance_obligations (owner_user_id);

CREATE INDEX ix_compliance_obligations_applicability_status ON compliance_obligations (applicability_status);

UPDATE alembic_version SET version_num='36caa9ef1ffa' WHERE alembic_version.version_num = '762ef27be2ba';

-- Running upgrade 36caa9ef1ffa -> 97314cc580f0

CREATE TABLE decision_registers (
    id SERIAL NOT NULL, 
    tenant_id INTEGER NOT NULL, 
    decision_code VARCHAR(100) NOT NULL, 
    title VARCHAR(500) NOT NULL, 
    decision_type VARCHAR(100) DEFAULT 'governance' NOT NULL, 
    status VARCHAR(50) DEFAULT 'draft' NOT NULL, 
    priority VARCHAR(30) DEFAULT 'medium' NOT NULL, 
    decision_date TIMESTAMP WITHOUT TIME ZONE, 
    decision_maker_id INTEGER, 
    owner_id INTEGER, 
    approver_id INTEGER, 
    approval_date TIMESTAMP WITHOUT TIME ZONE, 
    review_date TIMESTAMP WITHOUT TIME ZONE, 
    context TEXT, 
    rationale TEXT, 
    decision_statement TEXT NOT NULL, 
    expected_outcome TEXT, 
    impact_assessment TEXT, 
    policy_id INTEGER, 
    procedure_id INTEGER, 
    is_deleted BOOLEAN DEFAULT false NOT NULL, 
    created_by INTEGER, 
    updated_by INTEGER, 
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(tenant_id) REFERENCES tenants (id) ON DELETE CASCADE, 
    FOREIGN KEY(decision_maker_id) REFERENCES users (id) ON DELETE SET NULL, 
    FOREIGN KEY(owner_id) REFERENCES users (id) ON DELETE SET NULL, 
    FOREIGN KEY(approver_id) REFERENCES users (id) ON DELETE SET NULL, 
    FOREIGN KEY(created_by) REFERENCES users (id) ON DELETE SET NULL, 
    FOREIGN KEY(updated_by) REFERENCES users (id) ON DELETE SET NULL, 
    FOREIGN KEY(policy_id) REFERENCES governance_policies (id) ON DELETE SET NULL, 
    FOREIGN KEY(procedure_id) REFERENCES governance_procedures (id) ON DELETE SET NULL
);

CREATE INDEX ix_decision_registers_id ON decision_registers (id);

CREATE INDEX ix_decision_registers_tenant_id ON decision_registers (tenant_id);

CREATE INDEX ix_decision_registers_decision_code ON decision_registers (decision_code);

CREATE INDEX ix_decision_registers_decision_type ON decision_registers (decision_type);

CREATE INDEX ix_decision_registers_status ON decision_registers (status);

CREATE INDEX ix_decision_registers_priority ON decision_registers (priority);

CREATE INDEX ix_decision_registers_decision_date ON decision_registers (decision_date);

CREATE INDEX ix_decision_registers_decision_maker_id ON decision_registers (decision_maker_id);

CREATE INDEX ix_decision_registers_owner_id ON decision_registers (owner_id);

CREATE INDEX ix_decision_registers_approver_id ON decision_registers (approver_id);

CREATE INDEX ix_decision_registers_review_date ON decision_registers (review_date);

CREATE INDEX ix_decision_registers_policy_id ON decision_registers (policy_id);

CREATE INDEX ix_decision_registers_procedure_id ON decision_registers (procedure_id);

CREATE INDEX ix_decision_registers_is_deleted ON decision_registers (is_deleted);

CREATE INDEX ix_decision_registers_created_by ON decision_registers (created_by);

CREATE INDEX ix_decision_registers_updated_by ON decision_registers (updated_by);

CREATE TABLE decision_register_history (
    id SERIAL NOT NULL, 
    decision_register_id INTEGER NOT NULL, 
    action VARCHAR(50) NOT NULL, 
    field_name VARCHAR(100), 
    old_value TEXT, 
    new_value TEXT, 
    comment TEXT, 
    performed_by INTEGER, 
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(decision_register_id) REFERENCES decision_registers (id) ON DELETE CASCADE, 
    FOREIGN KEY(performed_by) REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX ix_decision_register_history_id ON decision_register_history (id);

CREATE INDEX ix_decision_register_history_decision_register_id ON decision_register_history (decision_register_id);

CREATE INDEX ix_decision_register_history_action ON decision_register_history (action);

CREATE INDEX ix_decision_register_history_performed_by ON decision_register_history (performed_by);

CREATE INDEX ix_decision_register_history_created_at ON decision_register_history (created_at);

CREATE TABLE decision_register_risks (
    id SERIAL NOT NULL, 
    decision_register_id INTEGER NOT NULL, 
    risk_id INTEGER NOT NULL, 
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(decision_register_id) REFERENCES decision_registers (id) ON DELETE CASCADE, 
    FOREIGN KEY(risk_id) REFERENCES risks (id) ON DELETE CASCADE, 
    CONSTRAINT uq_decision_register_risk UNIQUE (decision_register_id, risk_id)
);

CREATE INDEX ix_decision_register_risks_id ON decision_register_risks (id);

CREATE INDEX ix_decision_register_risks_decision_register_id ON decision_register_risks (decision_register_id);

CREATE INDEX ix_decision_register_risks_risk_id ON decision_register_risks (risk_id);

CREATE TABLE decision_register_controls (
    id SERIAL NOT NULL, 
    decision_register_id INTEGER NOT NULL, 
    control_id INTEGER NOT NULL, 
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(decision_register_id) REFERENCES decision_registers (id) ON DELETE CASCADE, 
    FOREIGN KEY(control_id) REFERENCES controls (id) ON DELETE CASCADE, 
    CONSTRAINT uq_decision_register_control UNIQUE (decision_register_id, control_id)
);

CREATE INDEX ix_decision_register_controls_id ON decision_register_controls (id);

CREATE INDEX ix_decision_register_controls_decision_register_id ON decision_register_controls (decision_register_id);

CREATE INDEX ix_decision_register_controls_control_id ON decision_register_controls (control_id);

CREATE TABLE decision_register_processes (
    id SERIAL NOT NULL, 
    decision_register_id INTEGER NOT NULL, 
    process_id INTEGER NOT NULL, 
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(decision_register_id) REFERENCES decision_registers (id) ON DELETE CASCADE, 
    FOREIGN KEY(process_id) REFERENCES processes (id) ON DELETE CASCADE, 
    CONSTRAINT uq_decision_register_process UNIQUE (decision_register_id, process_id)
);

CREATE INDEX ix_decision_register_processes_id ON decision_register_processes (id);

CREATE INDEX ix_decision_register_processes_decision_register_id ON decision_register_processes (decision_register_id);

CREATE INDEX ix_decision_register_processes_process_id ON decision_register_processes (process_id);

CREATE TABLE decision_register_tasks (
    id SERIAL NOT NULL, 
    decision_register_id INTEGER NOT NULL, 
    task_id INTEGER NOT NULL, 
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(decision_register_id) REFERENCES decision_registers (id) ON DELETE CASCADE, 
    FOREIGN KEY(task_id) REFERENCES compliance_tasks (id) ON DELETE CASCADE, 
    CONSTRAINT uq_decision_register_task UNIQUE (decision_register_id, task_id)
);

CREATE INDEX ix_decision_register_tasks_id ON decision_register_tasks (id);

CREATE INDEX ix_decision_register_tasks_decision_register_id ON decision_register_tasks (decision_register_id);

CREATE INDEX ix_decision_register_tasks_task_id ON decision_register_tasks (task_id);

UPDATE alembic_version SET version_num='97314cc580f0' WHERE alembic_version.version_num = '36caa9ef1ffa';

COMMIT;
