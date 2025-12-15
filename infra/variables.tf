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

  validation {
    condition     = length(var.openai_api_key) > 0
    error_message = "OPENAI_API_KEY required. Run: export TF_VAR_openai_api_key=\"$OPENAI_API_KEY\""
  }
}

variable "gemini_api_key" {
  description = "Google Gemini API key for Lambda"
  type        = string
  sensitive   = true
  default     = ""

  validation {
    condition     = length(var.gemini_api_key) > 0
    error_message = "GEMINI_API_KEY required. Run: export TF_VAR_gemini_api_key=\"$GEMINI_API_KEY\""
  }
}

variable "openai_model" {
  description = "OpenAI model version"
  type        = string
  default     = "gpt-4.1-mini"
}

variable "gemini_model" {
  description = "Google Gemini model version"
  type        = string
  default     = "gemini-2.0-flash"
}

variable "anthropic_api_key" {
  description = "Anthropic API key for Lambda"
  type        = string
  sensitive   = true
  default     = ""

  validation {
    condition     = length(var.anthropic_api_key) > 0
    error_message = "ANTHROPIC_API_KEY required. Run: export TF_VAR_anthropic_api_key=\"$ANTHROPIC_API_KEY\""
  }
}

variable "anthropic_model" {
  description = "Anthropic Claude model version"
  type        = string
  default     = "claude-sonnet-4"
}

