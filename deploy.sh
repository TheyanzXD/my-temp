#!/usr/bin/env bash
# deploy.sh - Self-contained deployment script for MyTemp on Cloudflare Pages
# Usage: ./deploy.sh [preview|production]

set -euo pipefail

PROJECT_NAME="my-temp"
BUILD_DIR=".svelte-kit/cloudflare"
BRANCH="${1:-production}"

echo "🚀 Deploying MyTemp to Cloudflare Pages ($BRANCH)..."

# Build
echo "📦 Building..."
npm run build

# Deploy
if [[ "$BRANCH" == "preview" ]]; then
    echo "📋 Deploying to preview branch..."
    npx wrangler pages deploy "$BUILD_DIR" --project-name "$PROJECT_NAME" --branch preview --commit-dirty=true
else
    echo "🌐 Deploying to production..."
    npx wrangler pages deploy "$BUILD_DIR" --project-name "$PROJECT_NAME" --commit-dirty=true
fi

echo "✅ Deployment complete!"
echo "🔗 Check: https://dash.cloudflare.com/pages/view/$PROJECT_NAME"