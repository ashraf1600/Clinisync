"""add doctor_notes to appointments

Revision ID: 007_doctor_notes
Revises: 006_notifications_and_devices
Create Date: 2026-09-10
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "007_doctor_notes"
down_revision: Union[str, None] = "006_notifications_and_devices"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.add_column("appointments", sa.Column("doctor_notes", sa.Text(), nullable=True))

def downgrade() -> None:
    op.drop_column("appointments", "doctor_notes")
