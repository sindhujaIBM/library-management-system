#!/bin/bash
# Smart deploy — inspects what changed in the last push and deploys only
# the affected services/frontend to both dev and prod.
#
# Called by push.sh after a successful git push.
# Can also be run standalone: ./scripts/smart-deploy.sh [base-ref]
#
# Change detection:
#   packages/shared/**        → all three services (shared code)
#   services/auth/**          → auth service
#   services/books/**         → books service
#   services/admin/**         → admin service
#   frontend/**               → frontend (prod only — no dev CloudFront stack)
#   scripts/seed*.mjs         → no deploy (seed scripts are run manually)

set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Default: compare last commit against its parent.
# When called from push.sh the caller passes the pre-push ref as $1.
BASE="${1:-HEAD^}"

echo ""
echo "╔══════════════════════════════════════╗"
echo "║         Smart Deploy                 ║"
echo "╚══════════════════════════════════════╝"
echo ""

CHANGED=$(git diff --name-only "$BASE" HEAD 2>/dev/null || git diff --name-only HEAD 2>/dev/null || true)

if [ -z "$CHANGED" ]; then
  echo "No file changes detected — nothing to deploy."
  exit 0
fi

echo "Changed files:"
echo "$CHANGED" | sed 's/^/  /'
echo ""

# ── Detect which parts changed ────────────────────────────────────────────────
DEPLOY_AUTH=0
DEPLOY_BOOKS=0
DEPLOY_ADMIN=0
DEPLOY_FE=0

while IFS= read -r f; do
  case "$f" in
    packages/shared/*)        DEPLOY_AUTH=1; DEPLOY_BOOKS=1; DEPLOY_ADMIN=1 ;;
    services/auth/*)          DEPLOY_AUTH=1 ;;
    services/books/*)         DEPLOY_BOOKS=1 ;;
    services/admin/*)         DEPLOY_ADMIN=1 ;;
    frontend/*)               DEPLOY_FE=1 ;;
  esac
done <<EOF
$CHANGED
EOF

# ── Summary ───────────────────────────────────────────────────────────────────
echo "Deployment plan:"
[ "$DEPLOY_AUTH"  -eq 1 ] && echo "  ✓ auth service  (dev + prod)" || echo "  · auth service  (no changes)"
[ "$DEPLOY_BOOKS" -eq 1 ] && echo "  ✓ books service (dev + prod)" || echo "  · books service (no changes)"
[ "$DEPLOY_ADMIN" -eq 1 ] && echo "  ✓ admin service (dev + prod)" || echo "  · admin service (no changes)"
[ "$DEPLOY_FE"    -eq 1 ] && echo "  ✓ frontend      (prod only)"  || echo "  · frontend      (no changes)"
echo ""

if [ "$DEPLOY_AUTH" -eq 0 ] && [ "$DEPLOY_BOOKS" -eq 0 ] && [ "$DEPLOY_ADMIN" -eq 0 ] && [ "$DEPLOY_FE" -eq 0 ]; then
  echo "Nothing to deploy (changes are in scripts, docs, or config only)."
  exit 0
fi

# ── Deploy services ───────────────────────────────────────────────────────────
deploy_service() {
  local SERVICE=$1  # auth | books | admin
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "Deploying $SERVICE → dev"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  "$ROOT/deploy-services.sh" "$SERVICE" dev

  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "Deploying $SERVICE → prod"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  "$ROOT/deploy-services.sh" "$SERVICE" prod
}

[ "$DEPLOY_AUTH"  -eq 1 ] && deploy_service auth
[ "$DEPLOY_BOOKS" -eq 1 ] && deploy_service books
[ "$DEPLOY_ADMIN" -eq 1 ] && deploy_service admin

# ── Deploy frontend (prod only) ───────────────────────────────────────────────
if [ "$DEPLOY_FE" -eq 1 ]; then
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "Deploying frontend → prod"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  "$ROOT/deploy-FE.sh" prod
fi

echo ""
echo "✅ Smart deploy complete."
