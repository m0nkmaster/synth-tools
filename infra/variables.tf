variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "eu-west-2"
}

variable "lambda_function_name" {
  description = "Name for the Lambda function"
  type        = string
  default     = "synth-config-generator"
}

variable "domain_name" {
  description = "Root domain name"
  type        = string
  default     = "robmacdonald.com"
}

variable "app_path" {
  description = "Path prefix for the application"
  type        = string
  default     = "synthtools"
}

variable "route53_zone_id" {
  description = "Route53 hosted zone ID for the domain"
  type        = string
}

variable "openai_api_key" {
  description = "OpenAI API key for Lambda"
  type        = string
  sensitive   = true
  default     = ""
}

variable "gemini_api_key" {
  description = "Google Gemini API key for Lambda"
  type        = string
  sensitive   = true
  default     = ""
}

