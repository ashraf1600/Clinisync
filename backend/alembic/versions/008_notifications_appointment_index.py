"""ensure notifications.appointment_id index exists

Databases bootstrapped from schema.sql (then stamped at 006) lack this index,
which the reminder de-duplication query filters on.

Revision ID: 008_notif_appt_index
Revises: 007_doctor_notes
Create Date: 2026-10-22
"""

from typing import Sequence, Union
from alembic import op

revision: str = "008_notif_appt_index"
down_revision: Union[str, None] = "007_doctor_notes"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.create_index(
        "idx_notifications_appointment_id", "notifications", ["appointment_id"], if_not_exists=True
    )

def downgrade() -> None:
    # Created by 006 on migration-built databases; only drop what this revision may have added
    pass
