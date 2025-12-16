# IAM role for Lambda
resource "aws_iam_role" "lambda" {
  name = "${var.lambda_function_name}-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

# Basic Lambda execution policy
resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Lambda function
resource "aws_lambda_function" "ai_handler" {
  function_name = var.lambda_function_name
  role          = aws_iam_role.lambda.arn
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  timeout       = 90
  memory_size   = 256

  # Placeholder - will be updated by CI/CD
  filename = data.archive_file.lambda_placeholder.output_path

  environment {
    variables = {
      OPENAI_API_KEY    = var.openai_api_key
      GEMINI_API_KEY    = var.gemini_api_key
      ANTHROPIC_API_KEY = var.anthropic_api_key
      OPENAI_MODEL      = var.openai_model
      GEMINI_MODEL      = var.gemini_model
      ANTHROPIC_MODEL   = var.anthropic_model
    }
  }

  lifecycle {
    ignore_changes = [filename, source_code_hash]
  }
}

# Lambda Function URL (replaces API Gateway)
resource "aws_lambda_function_url" "ai_handler" {
  function_name      = aws_lambda_function.ai_handler.function_name
  authorization_type = "NONE"
}

# Permission for Function URL public access (both permissions required since Oct 2025)
resource "aws_lambda_permission" "function_url_invoke_url" {
  statement_id           = "FunctionURLAllowPublicAccess"
  action                 = "lambda:InvokeFunctionUrl"
  function_name          = aws_lambda_function.ai_handler.function_name
  principal              = "*"
  function_url_auth_type = "NONE"
}

resource "aws_lambda_permission" "function_url_invoke_function" {
  statement_id  = "FunctionURLInvokeFunction"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.ai_handler.function_name
  principal     = "*"
}

# Placeholder zip for initial deployment
data "archive_file" "lambda_placeholder" {
  type        = "zip"
  output_path = "${path.module}/lambda_placeholder.zip"

  source {
    content  = "exports.handler = async () => ({ statusCode: 200, body: 'Placeholder' });"
    filename = "index.js"
  }
}

# CloudWatch log group
resource "aws_cloudwatch_log_group" "lambda" {
  name              = "/aws/lambda/${aws_lambda_function.ai_handler.function_name}"
  retention_in_days = 14
}

