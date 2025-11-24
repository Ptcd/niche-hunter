#!/bin/bash
# Build script for Vercel
# This runs from apps/web directory

# Go to root
cd ../..

# Generate Prisma client
npm run db:generate --workspace=packages/db

# Build workspace packages (db, core, and crawler)
npm run build --workspace=packages/db
npm run build --workspace=packages/core
npm run build --workspace=packages/crawler

# Build web app
cd apps/web
npm run build

