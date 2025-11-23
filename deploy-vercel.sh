#!/bin/bash
# Quick deployment script for Vercel

echo "🚀 Deploying Niche Hunter to Vercel..."
echo ""

cd apps/web

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "Installing Vercel CLI..."
    npm install -g vercel
fi

echo "Starting deployment..."
echo ""

# Deploy
vercel --prod

echo ""
echo "✅ Deployment started!"
echo ""
echo "Next steps:"
echo "1. Add environment variables in Vercel dashboard"
echo "2. Redeploy if needed: vercel --prod"
echo ""

