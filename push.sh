#!/bin/bash
# Push and smart-deploy.
#
# Usage:
#   ./push.sh              — push current branch, deploy what changed
#   ./push.sh --no-deploy  — push only, skip deploy

set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
NO_DEPLOY=0
[ "$1" = "--no-deploy" ] && NO_DEPLOY=1

# Capture the commit SHA before push so smart-deploy can diff against it
PRE_PUSH_SHA=$(git rev-parse HEAD)

git push

if [ "$NO_DEPLOY" -eq 1 ]; then
  echo "Skipping deploy (--no-deploy)."
  exit 0
fi

"$ROOT/scripts/smart-deploy.sh" "$PRE_PUSH_SHA^"
