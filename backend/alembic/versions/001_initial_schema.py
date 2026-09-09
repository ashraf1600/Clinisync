"""initial schema

Revision ID: 001_initial_schema
Revises: 
Create Date: 2026-09-07 18:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '001_initial_schema'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    # Extensions
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";')
    op.execute('CREATE EXTENSION IF NOT EXISTS "btree_gist";')

    # Users Table
    op.create_table(
        'users',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False, unique=True),
        sa.Column('password_hash', sa.String(length=255), nullable=False),
        sa.Column('role', sa.String(length=20), nullable=False),
        sa.Column('phone', sa.String(length=20), nullable=True),
        sa.Column('timezone', sa.String(length=50), nullable=False, server_default='Asia/Dhaka'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP')),
    )

    # Doctors Table
    op.create_table(
        'doctors',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), unique=True, nullable=False),
        sa.Column('specialization', sa.String(length=100), nullable=False),
        sa.Column('degrees', sa.String(length=255), nullable=False, server_default='MBBS'),
        sa.Column('bmdc_number', sa.String(length=50), nullable=False, server_default='BMDC-PENDING'),
        sa.Column('designation', sa.String(length=150), nullable=True),
        sa.Column('facility_name', sa.String(length=255), nullable=False, server_default='Popular Diagnostic Centre'),
        sa.Column('chamber_room', sa.String(length=255), nullable=False, server_default='Room #402, Level 4'),
        sa.Column('profile_photo_url', sa.Text(), nullable=True),
        sa.Column('bio', sa.Text(), nullable=True),
        sa.Column('consultation_fee', sa.Numeric(10, 2), nullable=False, server_default='1200.00'),
        sa.Column('followup_fee', sa.Numeric(10, 2), nullable=False, server_default='800.00'),
        sa.Column('rating', sa.Float(), nullable=False, server_default='4.9'),
        sa.Column('experience_years', sa.Integer(), nullable=False, server_default='15'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP')),
    )

    # Availability Table
    op.create_table(
        'availability',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('doctor_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('doctors.id', ondelete='CASCADE'), nullable=False),
        sa.Column('day_of_week', sa.Integer(), nullable=False),
        sa.Column('start_time', sa.Time(), nullable=False),
        sa.Column('end_time', sa.Time(), nullable=False),
        sa.Column('slot_duration_minutes', sa.Integer(), nullable=False, server_default='30'),
        sa.Column('buffer_minutes', sa.Integer(), nullable=False, server_default='10'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
    )

    # Appointments Table
    op.create_table(
        'appointments',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('patient_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('doctor_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('doctors.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('token_number', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('chief_complaint', sa.Text(), nullable=True),
        sa.Column('visit_type', sa.String(length=50), nullable=False, server_default='new_consultation'),
        sa.Column('start_time', sa.DateTime(timezone=True), nullable=False),
        sa.Column('end_time', sa.DateTime(timezone=True), nullable=False),
        sa.Column('appointment_range', postgresql.TSTZRANGE, nullable=True),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='confirmed'),
        sa.Column('payment_status', sa.String(length=30), nullable=False, server_default='pay_at_chamber'),
        sa.Column('cancellation_reason', sa.String(length=255), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP')),
    )

    # GiST Exclusion Constraint
    op.execute("""
        ALTER TABLE appointments 
        ADD CONSTRAINT no_overlapping_appointments
        EXCLUDE USING GIST (
            doctor_id WITH =,
            appointment_range WITH &&
        ) WHERE (status <> 'cancelled');
    """)

def downgrade() -> None:
    op.drop_table('appointments')
    op.drop_table('availability')
    op.drop_table('doctors')
    op.drop_table('users')
