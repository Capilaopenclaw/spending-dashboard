#!/bin/bash

echo "🔍 Verifying Spending Dashboard setup..."
echo ""

ERRORS=0

# Check project structure
echo "📁 Checking project structure..."

if [ ! -d "apps/web" ]; then
    echo "❌ apps/web directory missing"
    ERRORS=$((ERRORS + 1))
else
    echo "✅ apps/web exists"
fi

if [ ! -d "packages/shared" ]; then
    echo "❌ packages/shared directory missing"
    ERRORS=$((ERRORS + 1))
else
    echo "✅ packages/shared exists"
fi

if [ ! -d "supabase/migrations" ]; then
    echo "❌ supabase/migrations directory missing"
    ERRORS=$((ERRORS + 1))
else
    echo "✅ supabase/migrations exists"
fi

# Check key files
echo ""
echo "📄 Checking key files..."

FILES=(
    "supabase/migrations/001_initial_schema.sql"
    "supabase/migrations/002_seed_categories.sql"
    "packages/shared/src/lib/transfer-detector.ts"
    "packages/shared/src/types/database.ts"
    "packages/shared/src/constants/categories.ts"
    "packages/shared/src/constants/i18n.ts"
    "packages/shared/src/utils/format.ts"
    "apps/web/src/app/page.tsx"
    "CLAUDE.md"
    "README.md"
    "SETUP.md"
    "tasks.md"
)

for file in "${FILES[@]}"; do
    if [ ! -f "$file" ]; then
        echo "❌ $file missing"
        ERRORS=$((ERRORS + 1))
    else
        echo "✅ $file exists"
    fi
done

# Check node_modules
echo ""
echo "📦 Checking dependencies..."

if [ ! -d "node_modules" ]; then
    echo "⚠️  Root node_modules not found. Run: pnpm install"
else
    echo "✅ Root dependencies installed"
fi

# Check environment
echo ""
echo "🔐 Checking environment..."

if [ ! -f ".env.local" ]; then
    echo "⚠️  .env.local not found. Copy from .env.example and configure"
else
    echo "✅ .env.local exists"
    
    # Check for required variables
    if grep -q "your-anon-key" .env.local; then
        echo "⚠️  .env.local contains placeholder values. Update with real credentials"
    else
        echo "✅ .env.local appears configured"
    fi
fi

# Check Supabase
echo ""
echo "🗄️  Checking Supabase..."

if command -v supabase &> /dev/null; then
    echo "✅ Supabase CLI installed"
    
    if supabase status &> /dev/null; then
        echo "✅ Supabase is running"
        
        # Check if migrations are applied
        TABLES=$(supabase db exec "SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public';" 2>&1 | tail -1)
        if [[ "$TABLES" =~ ^[0-9]+$ ]] && [ "$TABLES" -ge 10 ]; then
            echo "✅ Migrations applied (found $TABLES tables)"
        else
            echo "⚠️  Migrations may not be applied. Run: supabase db push"
        fi
    else
        echo "⚠️  Supabase not running. Run: supabase start"
    fi
else
    echo "⚠️  Supabase CLI not installed. Install with: npm install -g supabase"
fi

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ $ERRORS -eq 0 ]; then
    echo "✅ Verification PASSED"
    echo ""
    echo "Next steps:"
    echo "1. Configure .env.local with your API credentials"
    echo "2. Run 'supabase start' if not running"
    echo "3. Run 'supabase db push' to apply migrations"
    echo "4. Run 'pnpm dev' to start development"
    echo "5. Open http://localhost:3000"
else
    echo "❌ Verification FAILED with $ERRORS errors"
    echo ""
    echo "Fix the errors above, then run this script again."
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
