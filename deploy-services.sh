#!/bin/bash
# Usage:
#   ./deploy-services.sh           — deploy all services + build frontend
#   ./deploy-services.sh auth      — deploy only the auth service
#   ./deploy-services.sh books     — deploy only the books service
#   ./deploy-services.sh admin     — deploy only the admin service
#
# Prerequisites (run once before first deploy):
#   1. Deploy infrastructure:
#        cd infrastructure && npx serverless deploy --stage prod
#
#   2. Store the CloudFront URL as the CORS origin:
#        aws ssm put-parameter --name /library/prod/cors-origin \
#          --value "https://<id>.cloudfront.net" --type SecureString \
#          --region ca-west-1
#
#   3. Store secrets in SSM:
#        aws ssm put-parameter --name /library/prod/jwt-secret \
#          --value "<your-jwt-secret>" --type SecureString --region ca-west-1
#        aws ssm put-parameter --name /library/prod/google-client-id \
#          --value "<your-client-id>" --type SecureString --region ca-west-1
#        aws ssm put-parameter --name /library/prod/google-client-secret \
#          --value "<your-client-secret>" --type SecureString --region ca-west-1

set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
STAGE="${2:-prod}"
TARGET="${1:-all}"

echo "Library Management System — deploying to stage: $STAGE"
echo ""

# ── Secrets from SSM ─────────────────────────────────────────────────────────
echo "Reading secrets from SSM..."

export JWT_SECRET=$(aws ssm get-parameter \
  --name /library/$STAGE/jwt-secret --with-decryption \
  --region ca-west-1 --query Parameter.Value --output text)

export GOOGLE_CLIENT_ID=$(aws ssm get-parameter \
  --name /library/$STAGE/google-client-id --with-decryption \
  --region ca-west-1 --query Parameter.Value --output text)

export GOOGLE_CLIENT_SECRET=$(aws ssm get-parameter \
  --name /library/$STAGE/google-client-secret --with-decryption \
  --region ca-west-1 --query Parameter.Value --output text)

export CORS_ORIGIN=$(aws ssm get-parameter \
  --name /library/$STAGE/cors-origin \
  --region ca-west-1 --query Parameter.Value --output text)

export DYNAMO_TABLE="library-$STAGE"

# Reuse MaidLink's verified SES identity — no new SES setup required
export SES_FROM_EMAIL="noreply@maidlink.ca"
export SES_CONFIG_SET="MaidlinkConfigSet-prod"

echo "  CORS_ORIGIN : $CORS_ORIGIN"
echo "  DYNAMO_TABLE: $DYNAMO_TABLE"
echo ""

# ── Lambda services ───────────────────────────────────────────────────────────
deploy_service() {
  echo "Deploying $1..."
  cd "$ROOT/services/$1" && npx serverless deploy --stage $STAGE
  echo ""
}

if [[ "$TARGET" == "all" ]]; then
  deploy_service auth
  deploy_service books
  deploy_service admin
else
  deploy_service "$TARGET"
  echo "Done!"
  exit 0
fi

# ── Clean up old Lambda versions ─────────────────────────────────────────────
echo "Cleaning up old Lambda versions..."
for fn in $(aws lambda list-functions --region ca-west-1 \
  --query "Functions[?starts_with(FunctionName, \`library-\`)].FunctionName" \
  --output text); do
  old_versions=$(aws lambda list-versions-by-function \
    --function-name "$fn" --region ca-west-1 \
    --query 'Versions[?Version!=`$LATEST`] | sort_by(@, &to_number(Version))[:-1].Version' \
    --output text)
  for v in $old_versions; do
    echo "  Deleting $fn:$v"
    aws lambda delete-function --function-name "$fn" --qualifier "$v" --region ca-west-1
  done
done
echo ""

# ── Capture API Gateway endpoints ────────────────────────────────────────────
echo "Getting API Gateway endpoints..."

get_endpoint() {
  cd "$ROOT/services/$1"
  npx serverless info --stage $STAGE 2>/dev/null \
    | grep -E "https://[a-z0-9]+\.execute-api" \
    | head -1 \
    | grep -oE "https://[a-z0-9]+\.execute-api\.[a-z0-9-]+\.amazonaws\.com/$STAGE"
}

AUTH_URL=$(get_endpoint auth)
BOOKS_URL=$(get_endpoint books)
ADMIN_URL=$(get_endpoint admin)

echo "  Auth:  $AUTH_URL"
echo "  Books: $BOOKS_URL"
echo "  Admin: $ADMIN_URL"
echo ""

# ── Write frontend prod env ───────────────────────────────────────────────────
cat > "$ROOT/frontend/.env.production" <<EOF
VITE_GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID
VITE_AUTH_API_URL=$AUTH_URL
VITE_BOOKS_API_URL=$BOOKS_URL
VITE_ADMIN_API_URL=$ADMIN_URL
EOF

echo "Wrote frontend/.env.production"

# ── Build + deploy frontend ───────────────────────────────────────────────────
echo ""
"$ROOT/deploy-FE.sh" $STAGE
