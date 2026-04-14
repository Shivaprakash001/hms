#!/bin/bash

# Define colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

echo "🔍 Validating Environment Variables..."

MISSING_VARS=0

# Define required arrays
BACKEND_VARS=("SUPABASE_URL" "SUPABASE_KEY" "SUPABASE_SERVICE_ROLE_KEY" "SMTP_HOST" "SMTP_PORT" "SMTP_USER" "SMTP_PASS" "RAZORPAY_WEBHOOK_SECRET" "RAZORPAY_KEY_ID" "RAZORPAY_KEY_SECRET")
FRONTEND_VARS=("VITE_GOOGLE_CLIENT_ID" "VITE_API_URL")

# Function to check vars
check_vars() {
  local file=$1
  shift
  local vars=("$@")

  if [ ! -f "$file" ]; then
    echo -e "${RED}❌ Missing $file file!${NC}"
    MISSING_VARS=1
    return
  fi

  for var in "${vars[@]}"; do
    if ! grep -q "^${var}=" "$file" || [ -z "$(grep "^${var}=" "$file" | cut -d '=' -f2- | tr -d ' ')" ]; then
      echo -e "${RED}❌ Missing or empty $var in $file${NC}"
      MISSING_VARS=1
    else
      echo -e "${GREEN}✅ Found $var in $file${NC}"
    fi
  done
}

echo -e "\n🛠 Checking Backend Environment..."
BACKEND_ENV="backend-next/.env"
check_vars "$BACKEND_ENV" "${BACKEND_VARS[@]}"

echo -e "\n💻 Checking Frontend Environment..."
FRONTEND_ENV="frontend/.env"
check_vars "$FRONTEND_ENV" "${FRONTEND_VARS[@]}"

echo -e "\n✨ Validation Summary:"
if [ $MISSING_VARS -eq 0 ]; then
  echo -e "${GREEN}All required environment variables are present! 🎉${NC}"
  exit 0
else
  echo -e "${RED}Some required environment variables are missing. Please review the output above and refer to ENV_SETUP.md.${NC}"
  exit 1
fi
