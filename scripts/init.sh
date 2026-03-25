#!/bin/bash
set -e

echo "🚀 Initializing Spending Dashboard..."

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed"
    exit 1
fi

if ! command -v pnpm &> /dev/null; then
    echo "❌ pnpm is not installed. Install with: npm install -g pnpm"
    exit 1
fi

if ! command -v supabase &> /dev/null; then
    echo "⚠️  Supabase CLI not found. Install with: npm install -g supabase"
    echo "Continuing without Supabase setup..."
    SKIP_SUPABASE=1
fi

echo "✅ Prerequisites OK"

# Install dependencies
echo "📦 Installing dependencies..."
pnpm install

# Setup Supabase (if CLI is available)
if [ -z "$SKIP_SUPABASE" ]; then
    echo "🗄️  Setting up Supabase..."
    
    if [ ! -d ".supabase" ]; then
        supabase init
    fi
    
    echo "Starting Supabase..."
    supabase start
    
    echo "Applying migrations..."
    supabase db push
    
    echo "✅ Supabase setup complete"
    echo ""
    echo "📊 Supabase Studio: http://localhost:54323"
    echo "🔗 API URL: http://localhost:54321"
    echo ""
else
    echo "⏭️  Skipping Supabase setup"
fi

# Create .env.local if it doesn't exist
if [ ! -f ".env.local" ]; then
    echo "📝 Creating .env.local from example..."
    cp .env.example .env.local
    echo "⚠️  Please edit .env.local with your credentials"
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "📚 Next steps:"
echo "1. Edit .env.local with your API credentials"
echo "2. Run 'pnpm dev' to start development"
echo "3. Open http://localhost:3000"
echo ""
echo "📖 Read SETUP.md for detailed instructions"
