#!/bin/bash
# Build script for Vercel
# This runs from apps/web directory

# Go to root
cd ../..

# Generate Prisma client
npm run db:generate --workspace=packages/db

# Build packages in dependency order
npm run build --workspace=packages/db
npm run build --workspace=packages/ai
npm run build --workspace=packages/core
npm run build --workspace=packages/crawler

# Build web app
cd apps/web
npm run build

