variable "aws_region" {
  description = "AWS region to deploy resources"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Project name prefix"
  type        = string
  default     = "clinisync"
}

variable "environment" {
  description = "Deployment environment (production, staging, dev)"
  type        = string
  default     = "production"
}

variable "github_repo" {
  description = "GitHub repository in the format owner/repo (e.g., username/repo)"
  type        = string
  default     = "*"
}

variable "db_name" {
  description = "PostgreSQL database name"
  type        = string
  default     = "appointment_db"
}

variable "db_username" {
  description = "PostgreSQL master username"
  type        = string
  default     = "postgres"
}

variable "db_password" {
  description = "PostgreSQL master password"
  type        = string
  sensitive   = true
  default     = "ChangeMeInProductionPassword123!"
}

variable "db_instance_class" {
  description = "RDS DB instance class"
  type        = string
  default     = "db.t4g.micro" # Free Tier eligible
}
