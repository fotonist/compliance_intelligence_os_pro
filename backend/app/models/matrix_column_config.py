from sqlalchemy import (
    Column,
    Integer,
    String,
    Boolean,
    ForeignKey,
    JSON,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.db.base import Base


class MatrixColumnConfig(Base):
    __tablename__ = "matrix_column_configs"

    id = Column(Integer, primary_key=True, index=True)

    # hangi standard için
    standard_id = Column(
        Integer,
        ForeignKey("standards.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # control | maturity
    mode = Column(String(32), nullable=False)

    # column identity
    key = Column(String(128), nullable=False)
    label = Column(String(255), nullable=False)

    # mapping
    source_type = Column(String(32), nullable=False, default="entity_field")
    entity = Column(String(64), nullable=True)
    field = Column(String(128), nullable=True)
    fixed_value = Column(String(255), nullable=True)

    # ui / order
    visible = Column(Boolean, default=True)
    position = Column(Integer, nullable=False, default=0)

    extra = Column(JSON, nullable=True)

    standard = relationship("Standard")

    __table_args__ = (
        UniqueConstraint(
            "standard_id",
            "mode",
            "key",
            name="uq_matrix_column_config_standard_mode_key",
        ),
    )
