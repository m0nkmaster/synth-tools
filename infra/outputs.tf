output "website_url" {
  description = "Website URL"
  value       = "https://${var.domain_name}/${var.app_path}/"
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID (for cache invalidation)"
  value       = aws_cloudfront_distribution.website.id
}

output "cloudfront_domain_name" {
  description = "CloudFront distribution domain name"
  value       = aws_cloudfront_distribution.website.domain_name
}

output "s3_bucket_name" {
  description = "S3 bucket name for static files"
  value       = aws_s3_bucket.website.id
}

output "lambda_function_name" {
  description = "Lambda function name"
  value       = aws_lambda_function.ai_handler.function_name
}

output "lambda_function_url" {
  description = "Lambda function URL"
  value       = aws_lambda_function_url.ai_handler.function_url
}

