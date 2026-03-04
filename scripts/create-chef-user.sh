#!/bin/bash
# Creates a chef@hibachi.app account in Supabase with role=chef
# Usage: CHEF_PASSWORD=yourpassword bash scripts/create-chef-user.sh

set -e

SUPABASE_URL="https://bivdmicbfkpiqhnyzkxm.supabase.co"
SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpdmRtaWNiZmtwaXFobnl6a3htIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTA5NTUyMCwiZXhwIjoyMDg2NjcxNTIwfQ.uw9JkQdVipNLXrG3Qe3cWNtx-vmYvTULu3Qbd6J9n9k"
CHEF_EMAIL="chef@hibachi.app"

if [ -z "$CHEF_PASSWORD" ]; then
  echo "Error: set CHEF_PASSWORD before running."
  echo "  CHEF_PASSWORD='yourpassword' bash scripts/create-chef-user.sh"
  exit 1
fi

echo "Creating chef account: $CHEF_EMAIL ..."

RESPONSE=$(curl -s -X POST \
  "${SUPABASE_URL}/auth/v1/admin/users" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"${CHEF_EMAIL}\",
    \"password\": \"${CHEF_PASSWORD}\",
    \"email_confirm\": true,
    \"app_metadata\": { \"role\": \"chef\" }
  }")

USER_ID=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id',''))" 2>/dev/null)

if [ -z "$USER_ID" ]; then
  echo "Failed. Supabase response:"
  echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
  exit 1
fi

echo ""
echo "Chef account created!"
echo "  User ID : $USER_ID"
echo "  Email   : $CHEF_EMAIL"
echo "  Role    : chef"
echo ""
echo "Login with:"
echo "  Username: chef"
echo "  Password: (the one you set)"
