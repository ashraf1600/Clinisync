"""audit log and appointment idempotency

Revision ID: 002_audit_log_and_idempotency
Revises: 001_initial_schema
Create Date: 2026-09-07 23:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '002_audit_log_and_idempotency'
down_revision: Union[str, None] = '001_initial_schema'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    # 1. Audit Log Table
    op.create_table(
        'audit_log',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('actor_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('action', sa.String(length=100), nullable=False),
        sa.Column('target_type', sa.String(length=50), nullable=False),
        sa.Column('target_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='{}'),
        sa.Column('ip_address', sa.String(length=45), nullable=True),
        sa.Column('timestamp', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP')),
    )

    # 2. Add idempotency_key, version, reschedule_count to appointments
    op.add_column('appointments', sa.Column('idempotency_key', sa.String(length=255), nullable=True))
    op.create_unique_constraint('uq_appointments_idempotency_key', 'appointments', ['idempotency_key'])
    op.add_column('appointments', sa.Column('version', sa.Integer(), nullable=False, server_default='1'))
    op.add_column('appointments', sa.Column('reschedule_count', sa.Integer(), nullable=False, server_default='0'))

def downgrade() -> None:
    op.drop_constraint('uq_appointments_idempotency_key', 'appointments', type_='unique')
    op.drop_column('appointments', 'reschedule_count')
    op.drop_column('appointments', 'version')
    op.drop_column('appointments', 'idempotency_key')
    op.drop_table('audit_log')
