#!/bin/bash
# Deploy amiinthailand.com
# Usage:
#   ./deploy.sh          → production
#   ./deploy.sh staging  → staging
#   ./deploy.sh prod     → production

set -e

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"

# Load token from .env.local
ENV_FILE="$REPO_ROOT/.env.local"
if [ ! -f "$ENV_FILE" ]; then
  echo "Error: $ENV_FILE not found. Create it with: WORKERS_TOKEN=<your-token>"
  exit 1
fi
source "$ENV_FILE"

TARGET="${1:-prod}"

case "$TARGET" in
  staging)
    echo "→ Deploying to staging (staging.amiinthailand.com)..."
    CLOUDFLARE_API_TOKEN=$WORKERS_TOKEN wrangler deploy --env staging
    echo "✓ Staging deploy complete"
    ;;
  prod|production|"")
    echo "→ Deploying to production (amiinthailand.com)..."
    CLOUDFLARE_API_TOKEN=$WORKERS_TOKEN wrangler deploy --env=""
    echo "✓ Production deploy complete"
    ;;
  *)
    echo "Usage: ./deploy.sh [staging|prod]"
    exit 1
    ;;
esac
