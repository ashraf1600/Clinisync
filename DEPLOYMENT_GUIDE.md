# Complete AWS Deployment & CI/CD Guide

This guide provides step-by-step instructions to deploy the entire CliniSync / ShebaSync platform on **Amazon Web Services (AWS)** with fully automated **CI/CD pipelines via GitHub Actions** for:
1. **Backend**: FastAPI (Python 3.11, PostgreSQL, Redis)
2. **Frontend**: React (Vite, TypeScript, TailwindCSS)
3. **Mobile**: Flutter (Android APK compilation & artifact delivery)

---

## 1. Architecture Overview

```
                      +------------------------------------------+
                      |         Web & Mobile Clients             |
                      +--------------------+---------------------+
                                           |
                    +----------------------+----------------------+
                    |                                             |
            (Static Assets)                                  (API Calls)
                    v                                             v
       +-------------------------+                   +-------------------------+
       |   Amazon CloudFront     |                   |  AWS App Runner / ECS   |
       |         (CDN)           |                   |    (FastAPI Backend)    |
       +------------+------------+                   +------------+------------+
                    |                                             |
       +------------v------------+                   +------------+------------+
       |     Amazon S3           |                   |                         |
       |  (React SPA Hosting)    |                   v                         v
       +-------------------------+           +---------------+         +---------------+
                                             |  Amazon RDS   |         |  ElastiCache  |
                                             |  PostgreSQL   |         |    Redis      |
                                             +---------------+         +---------------+
```

---

## 2. Infrastructure Setup (Choose Your Method)

You can provision all AWS resources using **Terraform** (recommended) or **AWS CloudFormation** with a single click.

### Option A: Using Terraform (Recommended)
Make sure you have [Terraform](https://www.terraform.io/) and the [AWS CLI](https://aws.amazon.com/cli/) configured (`aws configure`).

```bash
cd infra/terraform

# Initialize Terraform providers
terraform init

# Inspect planned resources
terraform plan

# Apply and provision infrastructure
terraform apply
```

After `terraform apply` finishes, note the output values:
- `github_actions_role_arn`
- `frontend_s3_bucket`
- `cloudfront_distribution_id`
- `frontend_website_url`
- `ecr_repository_url`
- `rds_endpoint`

---

### Option B: Using CloudFormation (AWS Console)
1. Open the [AWS CloudFormation Console](https://console.aws.amazon.com/cloudformation).
2. Click **Create stack** -> **With new resources (standard)**.
3. Select **Upload a template file** and choose `infra/cloudformation/clinisync-stack.yaml`.
4. Enter:
   - **Stack name**: `clinisync-stack`
   - **ProjectName**: `clinisync`
   - **GitHubRepo**: Your GitHub username/repository name (e.g. `your-username/your-repo`).
5. Check the box **I acknowledge that AWS CloudFormation might create IAM resources with custom names**.
6. Click **Submit**.
7. Once status reaches `CREATE_COMPLETE`, go to the **Outputs** tab to copy your resource IDs.

---

### Option C: Single-Instance EC2 (Budget / Staging / Student Option)
If you want to run everything on a single low-cost EC2 instance (such as a Free-Tier `t3.micro` or `t3.small`):
1. Launch an Ubuntu 22.04 / 24.04 EC2 instance.
2. Open ports `80` (HTTP), `443` (HTTPS), and `22` (SSH) in its Security Group.
3. SSH into the instance and install Docker & Docker Compose:
   ```bash
   sudo apt-get update
   sudo apt-get install -y docker.io docker-compose-v2
   sudo usermod -aG docker ubuntu
   ```
4. Copy `docker-compose.prod.yml` to `/home/ubuntu/app/docker-compose.prod.yml`.
5. Create a `.env` file on the instance with your production secrets.
6. Start all services:
   ```bash
   docker compose -f docker-compose.prod.yml up -d
   ```

---

## 3. GitHub Actions Secrets Configuration

Go to your repository on GitHub:
**Settings** -> **Secrets and variables** -> **Actions** -> Click **New repository secret**.

Add the following secrets:

| Secret Name | Required / Optional | Description | Example Value |
| :--- | :--- | :--- | :--- |
| `AWS_REGION` | **Required** | Your AWS Region | `us-east-1` |
| `AWS_ROLE_TO_ASSUME` | **Recommended (OIDC)** | IAM Role ARN from Terraform/CloudFormation | `arn:aws:iam::123456789012:role/clinisync-github-actions-role` |
| `AWS_ACCESS_KEY_ID` | Optional (if not using OIDC) | IAM User Access Key | `AKIAIOSFODNN7EXAMPLE` |
| `AWS_SECRET_ACCESS_KEY` | Optional (if not using OIDC) | IAM User Secret Key | `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY` |
| `FRONTEND_S3_BUCKET` | **Required (for Frontend)** | Target S3 bucket for React build | `clinisync-frontend-1a2b3c4d` |
| `CLOUDFRONT_DISTRIBUTION_ID` | **Required (for Frontend)** | CloudFront distribution ID | `E1A2B3C4D5E6F7` |
| `VITE_API_BASE_URL` | **Required (for Frontend)** | Public URL of your deployed FastAPI backend | `https://api.yourdomain.com/api/v1` |
| `ECR_REPOSITORY` | **Required (for Backend)** | Amazon ECR Repository Name | `clinisync-backend` |
| `APP_RUNNER_SERVICE_ARN` | Optional (if using App Runner) | ARN of your App Runner service | `arn:aws:apprunner:...` |
| `ECS_CLUSTER_NAME` | Optional (if using ECS) | Name of your ECS Cluster | `clinisync-cluster` |
| `ECS_SERVICE_NAME` | Optional (if using ECS) | Name of your ECS Service | `clinisync-backend-service` |
| `EC2_INSTANCE_ID` | Optional (if using EC2) | EC2 Instance ID for AWS SSM deploy | `i-0123456789abcdef0` |

---

## 4. How the CI/CD Pipelines Work

### 1. Backend Pipeline (`backend-ci-cd.yml`)
- **Trigger**: Any push or PR modifying `backend/**`.
- **Automated Testing**:
  - Automatically spins up PostgreSQL 15 & Redis 7 test containers in the GitHub runner.
  - Runs flake8 lint check and the complete `pytest` test suite (`pytest backend/tests`).
- **Build & Push**:
  - Automatically builds the multi-stage production Docker image (`backend/Dockerfile.prod`).
  - Tags and pushes the image to your private Amazon ECR repository.
- **Continuous Deployment**:
  - Updates the target service (AWS App Runner, Amazon ECS, or EC2) without downtime.
  - Automatically runs `alembic upgrade head` database migrations via the container entrypoint.

### 2. Frontend Pipeline (`frontend-ci-cd.yml`)
- **Trigger**: Any push or PR modifying `frontend/**`.
- **Validation**:
  - Runs TypeScript type checking (`tsc`) and Vite production bundle compilation.
- **Zero-Downtime Deployment**:
  - Syncs the production bundle to your AWS S3 bucket with optimal browser caching headers (`Cache-Control: immutable` for hashed assets, `no-cache` for `index.html`).
  - Issues an automatic CloudFront CDN cache invalidation (`/*`) so users immediately see updates.

### 3. Mobile Pipeline (`mobile-ci.yml`)
- **Trigger**: Any push or PR modifying `mobile/**`.
- **Validation**:
  - Installs Flutter SDK and Java JDK 17.
  - Runs `flutter analyze` and `flutter test`.
- **Artifact Build**:
  - Compiles a release Android APK (`app-release.apk`).
  - Uploads the binary as a downloadable artifact in the GitHub Actions run summary.

---

## 5. Local Production Testing

Before deploying to the cloud, you can test the entire production stack locally:

```bash
# Build and run production containers locally
docker compose -f docker-compose.prod.yml up --build -d

# Check running services
docker compose -f docker-compose.prod.yml ps

# View backend logs & migration status
docker compose -f docker-compose.prod.yml logs -f backend

# Open your browser:
# Frontend: http://localhost
# Backend API docs: http://localhost/api/v1/docs
```

---

## 6. Troubleshooting & FAQ

### Q: How do I link a custom domain (e.g., `app.myclinic.com`)?
1. Request a free SSL certificate in **AWS Certificate Manager (ACM)** in the `us-east-1` region.
2. In the CloudFront distribution settings, add your custom domain as an **Alternate Domain Name (CNAME)** and select the ACM certificate.
3. In Route 53 (or your DNS provider like Cloudflare / GoDaddy), create an `A` (Alias) or `CNAME` record pointing to your CloudFront distribution domain name.

### Q: How does Database Migration work in production?
The backend container uses `entrypoint.sh`, which automatically executes `alembic upgrade head` every time a new container instance boots up before starting the Uvicorn web server. This ensures that new tables or columns are migrated seamlessly.

### Q: How is file storage handled?
For local development, files are saved in `uploads/`. For AWS production, use the S3 bucket created by Terraform/CloudFormation (`clinisync-uploads-...`) for avatar and medical report uploads.
