"""add availability_exceptions table

Revision ID: 005_availability_exceptions
Revises: 004_avail_location_id
Create Date: 2026-09-09 13:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "005_availability_exceptions"
down_revision: Union[str, None] = "004_avail_location_id"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "availability_exceptions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("doctor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("doctors.id", ondelete="CASCADE"), nullable=False),
        sa.Column("exception_date", sa.Date(), nullable=False),
        sa.Column("is_available", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("reason", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.UniqueConstraint("doctor_id", "exception_date", name="uq_doctor_exception_date"),
    )
    op.create_index("idx_availability_exceptions_doctor_date", "availability_exceptions", ["doctor_id", "exception_date"])


def downgrade() -> None:
    op.drop_index("idx_availability_exceptions_doctor_date", table_name="availability_exceptions")
    op.drop_table("availability_exceptions")
