"""add location_id to availability

Revision ID: 004_avail_location_id
Revises: 003_doc_locations_patient
Create Date: 2026-09-08 11:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "004_avail_location_id"
down_revision: Union[str, None] = "003_doc_locations_patient"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("availability", sa.Column("location_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key("fk_availability_location_id", "availability", "doctor_locations", ["location_id"], ["id"], ondelete="SET NULL")
    op.create_index("idx_availability_location", "availability", ["location_id"])


def downgrade() -> None:
    op.drop_index("idx_availability_location", table_name="availability")
    op.drop_constraint("fk_availability_location_id", "availability", type_="foreignkey")
    op.drop_column("availability", "location_id")
