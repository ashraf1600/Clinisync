output "ecr_repository_url" {
  description = "ECR Repository URL for Backend"
  value       = aws_ecr_repository.backend.repository_url
}

output "ecr_repository_name" {
  description = "ECR Repository Name"
  value       = aws_ecr_repository.backend.name
}

output "frontend_s3_bucket" {
  description = "S3 Bucket Name for Frontend hosting"
  value       = aws_s3_bucket.frontend.id
}

output "cloudfront_distribution_id" {
  description = "CloudFront Distribution ID (put in GitHub Secrets: CLOUDFRONT_DISTRIBUTION_ID)"
  value       = aws_cloudfront_distribution.frontend.id
}

output "frontend_website_url" {
  description = "Public HTTPS URL for Frontend application"
  value       = "https://${aws_cloudfront_distribution.frontend.domain_name}"
}

output "rds_endpoint" {
  description = "PostgreSQL RDS connection endpoint"
  value       = aws_db_instance.postgres.endpoint
}

output "rds_database_url_example" {
  description = "Example DATABASE_URL for backend"
  value       = "postgresql+asyncpg://${var.db_username}:${var.db_password}@${aws_db_instance.postgres.endpoint}/${var.db_name}"
  sensitive   = true
}

output "github_actions_role_arn" {
  description = "IAM Role ARN to configure in GitHub Secrets as AWS_ROLE_TO_ASSUME"
  value       = aws_iam_role.github_actions_role.arn
}
