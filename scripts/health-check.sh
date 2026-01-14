#!/bin/bash

# 🏥 DarkEventManager - Health Check Script
# Verify that all security measures are in place

set -e

echo "=================================================="
echo "🏥 DarkEventManager - Health Check"
echo "=================================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ERRORS=0
WARNINGS=0

# Check .env file exists
echo "🔍 Checking environment configuration..."
if [ ! -f .env ]; then
    echo -e "${RED}❌ .env file not found${NC}"
    echo "   Run: npm run setup"
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✅ .env file exists${NC}"

    # Check SESSION_SECRET
    if grep -q "^SESSION_SECRET=CHANGE_THIS" .env; then
        echo -e "${RED}❌ SESSION_SECRET not configured${NC}"
        ERRORS=$((ERRORS + 1))
    elif grep -q "^SESSION_SECRET=.\\{64,\\}" .env; then
        echo -e "${GREEN}✅ SESSION_SECRET configured${NC}"
    else
        echo -e "${YELLOW}⚠️  SESSION_SECRET might be too short${NC}"
        WARNINGS=$((WARNINGS + 1))
    fi

    # Check QR_ENCRYPTION_KEY
    if grep -q "^QR_ENCRYPTION_KEY=CHANGE_THIS" .env; then
        echo -e "${RED}❌ QR_ENCRYPTION_KEY not configured${NC}"
        ERRORS=$((ERRORS + 1))
    elif grep -q "^QR_ENCRYPTION_KEY=.\\{64,\\}" .env; then
        echo -e "${GREEN}✅ QR_ENCRYPTION_KEY configured${NC}"
    else
        echo -e "${YELLOW}⚠️  QR_ENCRYPTION_KEY might be too short${NC}"
        WARNINGS=$((WARNINGS + 1))
    fi

    # Check QR_ENCRYPTION_IV
    if grep -q "^QR_ENCRYPTION_IV=CHANGE_THIS" .env; then
        echo -e "${RED}❌ QR_ENCRYPTION_IV not configured${NC}"
        ERRORS=$((ERRORS + 1))
    elif grep -q "^QR_ENCRYPTION_IV=.\\{32,\\}" .env; then
        echo -e "${GREEN}✅ QR_ENCRYPTION_IV configured${NC}"
    else
        echo -e "${YELLOW}⚠️  QR_ENCRYPTION_IV might be too short${NC}"
        WARNINGS=$((WARNINGS + 1))
    fi

    # Check DATABASE_URL
    if grep -q "^DATABASE_URL=postgres://" .env; then
        echo -e "${GREEN}✅ DATABASE_URL configured${NC}"
    else
        echo -e "${RED}❌ DATABASE_URL not configured${NC}"
        ERRORS=$((ERRORS + 1))
    fi
fi

# Check node_modules
echo ""
echo "🔍 Checking dependencies..."
if [ -d node_modules ]; then
    echo -e "${GREEN}✅ Dependencies installed${NC}"

    # Check critical packages
    if [ -d node_modules/bcrypt ]; then
        echo -e "${GREEN}✅ bcrypt installed${NC}"
    else
        echo -e "${RED}❌ bcrypt not installed${NC}"
        ERRORS=$((ERRORS + 1))
    fi

    if [ -d node_modules/express-rate-limit ]; then
        echo -e "${GREEN}✅ express-rate-limit installed${NC}"
    else
        echo -e "${RED}❌ express-rate-limit not installed${NC}"
        ERRORS=$((ERRORS + 1))
    fi

    if [ -d node_modules/helmet ]; then
        echo -e "${GREEN}✅ helmet installed${NC}"
    else
        echo -e "${RED}❌ helmet not installed${NC}"
        ERRORS=$((ERRORS + 1))
    fi

    if [ -d node_modules/connect-pg-simple ]; then
        echo -e "${GREEN}✅ connect-pg-simple installed${NC}"
    else
        echo -e "${RED}❌ connect-pg-simple not installed${NC}"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo -e "${RED}❌ Dependencies not installed${NC}"
    echo "   Run: npm install"
    ERRORS=$((ERRORS + 1))
fi

# Check if server is running
echo ""
echo "🔍 Checking server status..."
if curl -s http://localhost:5000/health &>/dev/null; then
    echo -e "${GREEN}✅ Server is running${NC}"

    # Test rate limiting
    echo ""
    echo "🔍 Testing rate limiting..."
    FAILED_ATTEMPTS=0
    for i in {1..6}; do
        RESPONSE=$(curl -s -w "%{http_code}" -o /dev/null -X POST http://localhost:5000/api/auth/login \
            -H "Content-Type: application/json" \
            -d '{"username":"test","password":"wrong"}')

        if [ $i -le 5 ]; then
            if [ "$RESPONSE" = "401" ]; then
                echo -e "${GREEN}✅ Request $i: 401 (expected)${NC}"
            else
                echo -e "${RED}❌ Request $i: $RESPONSE (expected 401)${NC}"
                FAILED_ATTEMPTS=$((FAILED_ATTEMPTS + 1))
            fi
        else
            if [ "$RESPONSE" = "429" ]; then
                echo -e "${GREEN}✅ Request $i: 429 (rate limited - expected)${NC}"
            else
                echo -e "${YELLOW}⚠️  Request $i: $RESPONSE (expected 429)${NC}"
                WARNINGS=$((WARNINGS + 1))
            fi
        fi
        sleep 0.5
    done

    if [ $FAILED_ATTEMPTS -eq 0 ]; then
        echo -e "${GREEN}✅ Rate limiting is working${NC}"
    else
        echo -e "${RED}❌ Rate limiting might not be working correctly${NC}"
        ERRORS=$((ERRORS + 1))
    fi

    # Test security headers
    echo ""
    echo "🔍 Testing security headers..."
    HEADERS=$(curl -s -I http://localhost:5000/api/dashboard/stats)

    if echo "$HEADERS" | grep -q "X-Content-Type-Options"; then
        echo -e "${GREEN}✅ X-Content-Type-Options header present${NC}"
    else
        echo -e "${YELLOW}⚠️  X-Content-Type-Options header missing${NC}"
        WARNINGS=$((WARNINGS + 1))
    fi

    if echo "$HEADERS" | grep -q "X-Frame-Options"; then
        echo -e "${GREEN}✅ X-Frame-Options header present${NC}"
    else
        echo -e "${YELLOW}⚠️  X-Frame-Options header missing${NC}"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    echo -e "${YELLOW}⚠️  Server is not running${NC}"
    echo "   Start with: npm run dev"
    WARNINGS=$((WARNINGS + 1))
fi

# Check database connection
echo ""
echo "🔍 Checking database connection..."
if [ -f .env ]; then
    DB_URL=$(grep "^DATABASE_URL=" .env | cut -d'=' -f2-)
    if [ -n "$DB_URL" ]; then
        if psql "$DB_URL" -c "SELECT 1;" &>/dev/null; then
            echo -e "${GREEN}✅ Database connection successful${NC}"

            # Check if tables exist
            TABLE_COUNT=$(psql "$DB_URL" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | xargs)
            if [ "$TABLE_COUNT" -gt 0 ]; then
                echo -e "${GREEN}✅ Database has $TABLE_COUNT tables${NC}"
            else
                echo -e "${YELLOW}⚠️  Database is empty${NC}"
                echo "   Run: npm run db:push"
                WARNINGS=$((WARNINGS + 1))
            fi
        else
            echo -e "${YELLOW}⚠️  Cannot connect to database${NC}"
            WARNINGS=$((WARNINGS + 1))
        fi
    fi
fi

# Summary
echo ""
echo "=================================================="
echo "📊 Health Check Summary"
echo "=================================================="
if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✅ All checks passed!${NC}"
    echo ""
    echo "Your application is configured correctly and ready to use."
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠️  $WARNINGS warning(s) found${NC}"
    echo ""
    echo "Your application should work, but some features might not be optimal."
    exit 0
else
    echo -e "${RED}❌ $ERRORS error(s) found${NC}"
    if [ $WARNINGS -gt 0 ]; then
        echo -e "${YELLOW}⚠️  $WARNINGS warning(s) found${NC}"
    fi
    echo ""
    echo "Please fix the errors above before running the application."
    echo ""
    echo "Quick fixes:"
    echo "  - Missing .env: npm run setup"
    echo "  - Missing dependencies: npm install"
    echo "  - Database issues: npm run db:push"
    exit 1
fi
