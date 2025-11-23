#!/bin/bash
# Quick database setup script

echo "🚀 Setting up Niche Hunter Database..."

# Check if Docker is available
if command -v docker &> /dev/null; then
    echo "✅ Docker found - starting database..."
    docker-compose up -d
    
    echo "⏳ Waiting for database to be ready..."
    sleep 5
    
    echo "📦 Running migrations..."
    cd packages/db
    npm run db:migrate
    cd ../..
    
    echo "✅ Database setup complete!"
else
    echo "❌ Docker not found"
    echo ""
    echo "Please choose one:"
    echo "1. Install Docker Desktop from https://www.docker.com/products/docker-desktop"
    echo "2. Use existing PostgreSQL (update .env with DATABASE_URL)"
    echo "3. Use Supabase cloud database (see DATABASE_SETUP.md)"
    echo ""
    echo "Then run: cd packages/db && npm run db:migrate"
fi


