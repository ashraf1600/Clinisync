"""doctor locations and patient clinical details

Revision ID: 003_doc_locations_patient
Revises: 002_audit_log_and_idempotency
Create Date: 2026-09-08 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "003_doc_locations_patient"
down_revision: Union[str, None] = "002_audit_log_and_idempotency"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("birth_date", sa.Date(), nullable=True))
    op.add_column("users", sa.Column("gender", sa.String(length=30), nullable=True))
    op.add_column("users", sa.Column("blood_group", sa.String(length=5), nullable=True))
    op.add_column("users", sa.Column("address", sa.String(length=500), nullable=True))

    op.create_table(
        "doctor_locations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("doctor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("doctors.id", ondelete="CASCADE"), nullable=False),
        sa.Column("facility_name", sa.String(length=255), nullable=False),
        sa.Column("branch_area", sa.String(length=255), nullable=True),
        sa.Column("chamber_room", sa.String(length=255), nullable=False),
        sa.Column("address", sa.String(length=500), nullable=True),
        sa.Column("contact_phone", sa.String(length=30), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
    )
    op.create_index("idx_doctor_locations_doctor", "doctor_locations", ["doctor_id"])
    op.add_column("appointments", sa.Column("location_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key("fk_appointments_location_id", "appointments", "doctor_locations", ["location_id"], ["id"], ondelete="SET NULL")
    op.create_index("idx_appointments_location", "appointments", ["location_id"])
    op.execute(
        """
        INSERT INTO doctor_locations (doctor_id, facility_name, chamber_room)
        SELECT id, facility_name, chamber_room FROM doctors
        """
    )


def downgrade() -> None:
    op.drop_index("idx_appointments_location", table_name="appointments")
    op.drop_constraint("fk_appointments_location_id", "appointments", type_="foreignkey")
    op.drop_column("appointments", "location_id")
    op.drop_index("idx_doctor_locations_doctor", table_name="doctor_locations")
    op.drop_table("doctor_locations")
    op.drop_column("users", "address")
    op.drop_column("users", "blood_group")
    op.drop_column("users", "gender")
    op.drop_column("users", "birth_date")
