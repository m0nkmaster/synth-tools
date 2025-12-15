#!/bin/bash
# Wrapper that loads .env and runs terraform from infra/

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

# Load .env from repo root
ENV_FILE="$REPO_ROOT/.env"
if [ -f "$ENV_FILE" ]; then
  # Export vars with TF_VAR_ prefix for Terraform
  export TF_VAR_openai_api_key=$(grep -E '^OPENAI_API_KEY=' "$ENV_FILE" | cut -d'=' -f2- | tr -d '"'"'")
  export TF_VAR_gemini_api_key=$(grep -E '^GEMINI_API_KEY=' "$ENV_FILE" | cut -d'=' -f2- | tr -d '"'"'")
  export TF_VAR_anthropic_api_key=$(grep -E '^ANTHROPIC_API_KEY=' "$ENV_FILE" | cut -d'=' -f2- | tr -d '"'"'")
  export TF_VAR_openai_model=$(grep -E '^OPENAI_MODEL=' "$ENV_FILE" | cut -d'=' -f2- | tr -d '"'"'")
  export TF_VAR_gemini_model=$(grep -E '^GEMINI_MODEL=' "$ENV_FILE" | cut -d'=' -f2- | tr -d '"'"'")
  export TF_VAR_anthropic_model=$(grep -E '^ANTHROPIC_MODEL=' "$ENV_FILE" | cut -d'=' -f2- | tr -d '"'"'")
else
  echo "Warning: $ENV_FILE not found"
fi

# Run terraform from infra directory
cd "$SCRIPT_DIR"
terraform "$@"

