#!/bin/bash
# =====================================================
# AnimeGraph Nexus - Quick Start Script
# =====================================================
# Usage: ./setup-supabase.sh
# =====================================================

set -e

echo "=============================================="
echo "  AnimeGraph Nexus - Supabase Setup"
echo "=============================================="
echo ""

# Check if .env exists
if [ -f .env ]; then
    echo "⚠️  .env file already exists. Skipping .env creation."
else
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "✅ Created .env file"
    echo ""
    echo "⚠️  IMPORTANT: Please edit .env and add your Supabase DATABASE_URL"
    echo "   1. Go to https://supabase.com/dashboard"
    echo "   2. Select your project"
    echo "   3. Settings → Database → Connection string"
    echo "   4. Copy the URI and update DATABASE_URL in .env"
    echo ""
    read -p "Press Enter when you've updated .env with your Supabase credentials..."
fi

echo ""
echo "📦 Installing dependencies..."
npm install

echo ""
echo "🔧 Generating Prisma client..."
npm run db:generate

echo ""
echo "=============================================="
echo "  Setup Complete!"
echo "=============================================="
echo ""
echo "Next steps:"
echo "1. Make sure you've created tables in Supabase"
echo "   (Run server/supabase-setup.sql in Supabase SQL Editor)"
echo ""
echo "2. Start the development server:"
echo "   npm run dev"
echo ""
echo "3. Open the app:"
echo "   - App: http://localhost:3000"
echo "   - Admin: http://localhost:3000/admin"
echo ""
echo "4. Sync anime data:"
echo "   npm run sync:jikan -- --single 21"
echo ""
echo "=============================================="
