#!/bin/bash
# Build script for Vercel
# This runs from apps/web directory

# Go to root
cd ../..

# Generate Prisma client
npm run db:generate --workspace=packages/db

# Build db package
npm run build --workspace=packages/db

# Build web app
cd apps/web
npm run build

