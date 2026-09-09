"""add notifications and user_devices tables

Revision ID: 006_notifications_and_devices
Revises: 005_availability_exceptions
Create Date: 2026-09-09 13:48:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "006_notifications_and_devices"
down_revision: Union[str, None] = "005_availability_exceptions"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # user_devices
    op.create_table(
        "user_devices",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("fcm_token", sa.Text(), nullable=False),
        sa.Column("device_type", sa.String(length=20), nullable=False, server_default="android"),
        sa.Column("device_model", sa.String(length=100), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("idx_user_devices_user_id", "user_devices", ["user_id"])

    # notifications
    op.create_table(
        "notifications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("appointment_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("appointments.id", ondelete="SET NULL"), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("notification_type", sa.String(length=50), nullable=False, server_default="system"),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("idx_notifications_user_id", "notifications", ["user_id"])
    op.create_index("idx_notifications_appointment_id", "notifications", ["appointment_id"])


def downgrade() -> None:
    op.drop_index("idx_notifications_appointment_id", table_name="notifications")
    op.drop_index("idx_notifications_user_id", table_name="notifications")
    op.drop_table("notifications")
    op.drop_index("idx_user_devices_user_id", table_name="user_devices")
    op.drop_table("user_devices")
