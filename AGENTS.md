# AGENTS.md

## Tech stack:
- Backend: FastAPI (Python)
- Frontend: React
- Mobile: Flutter
- All three use matching feature-based folder structures so a "feature" (e.g. users, orders) has the same name across backend/frontend/mobile.

## Backend convention:
- Feature-based folders under app/<feature>/: router.py, schemas.py, models.py, service.py, dependencies.py
- main.py only wires up the app (middleware, routers, lifespan) — no business logic there
- Shared code (exceptions, auth, base models) lives in app/core/
- All DB schema changes go through Alembic migrations, reviewed by hand before applying — never hand-edit the DB
- Every route gets Pydantic Create/Update/Read schemas (never return raw DB models)
- Unit tests mirror the app structure under tests/

## Frontend convention:
- Feature-based folders under src/features/<feature>/: components/, hooks/, services/, types/
- Shared components (buttons, modals, layout) live in src/components/
- Shared state/hooks live in src/hooks/ and src/context/
- API calls live in feature services, typed with TypeScript interfaces that mirror the backend Pydantic schemas

## Mobile convention:
- Feature-based folders under lib/features/<feature>/: screens/, widgets/, controllers/ (or blocs/providers depending on state approach), models/
- Shared widgets live in lib/core/widgets/
- Network, theme, and constants live in lib/core/
- Models mirror the backend Pydantic schemas

## Global rules:
- Always read the relevant AGENTS.md section before touching that part of the stack
- Always check the openapi.json or backend schemas before writing frontend or mobile API code
- Never put business logic in UI components or route handlers — service layer only
- Consistent naming: feature names MUST match across backend, frontend, and mobile (e.g. if backend has app/orders, frontend has src/features/orders, mobile has lib/features/orders)
