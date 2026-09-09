# CliniSync / ShebaSync — Hospital & Chamber Appointment Booking Platform

An enterprise-grade, multi-platform hospital and doctor chamber appointment management system with live queue tracking, multi-chamber doctor schedules, digital prescription/pass generation, and zero double-booking concurrency protection.

---

## 🌟 Tech Stack

- **Backend**: FastAPI (Python 3.11, PostgreSQL, Redis, SQLAlchemy Async, Alembic)
- **Frontend**: React 18 (Vite, TypeScript, TailwindCSS, Bilingual EN/BN, Lucide Icons)
- **Mobile**: Flutter 3 (Dart, Clean Architecture, BLoC/Provider)
- **Cloud & DevOps**: AWS (S3, CloudFront, ECR, RDS, IAM OIDC), Terraform, CloudFormation, GitHub Actions CI/CD, Docker

---

## 🚀 Key Features

1. **Doctor Chamber & Serial Booking**: Real-time time slot generation with GiST exclusion constraint preventing double-booking.
2. **Live Queue Tracker**: Dynamic token number display with real-time room call updates.
3. **Multi-Chamber Management**: Doctors can configure shifts across multiple hospitals and clinics.
4. **Digital Chamber Pass**: Instant QR-ready digital pass with printable receipt format.
5. **Role-Based Access**: Granular roles for Patients, Doctors/Staff, and System Administrators.
6. **Bilingual UI**: Seamless English and Bengali translation toggle.

---

## 📁 Repository Structure

```
├── backend/               # FastAPI backend with feature-based architecture
├── frontend/              # React (Vite + TypeScript) web app
├── mobile/                # Flutter cross-platform mobile application
├── infra/                 # Infrastructure as Code (Terraform & CloudFormation)
├── .github/workflows/     # Automated CI/CD pipelines (Backend, Frontend, Mobile)
├── docker-compose.yml     # Local development compose configuration
├── docker-compose.prod.yml# Production container orchestration
└── DEPLOYMENT_GUIDE.md    # Complete AWS deployment & operations manual
```

---

## ☁️ Deployment

Refer to [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) for full instructions on provisioning AWS resources (CloudFormation/Terraform) and setting up automated GitHub Actions deployment.
