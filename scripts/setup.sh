#!/bin/bash

# 🚀 DarkEventManager - Setup Script
# Automated setup for development environment

set -e  # Exit on error

echo "=================================================="
echo "🧟 DarkEventManager - Automated Setup"
echo "=================================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed. Please install Node.js 18+ first.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Node.js $(node -v) detected${NC}"

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo -e "${YELLOW}⚠️  PostgreSQL not found in PATH. Make sure it's installed.${NC}"
fi

echo ""
echo "=================================================="
echo "📦 Step 1: Installing dependencies"
echo "=================================================="
npm install

echo ""
echo "=================================================="
echo "🔐 Step 2: Generating security secrets"
echo "=================================================="

if [ -f .env ]; then
    echo -e "${YELLOW}⚠️  .env already exists. Skipping secret generation.${NC}"
    echo "   If you want to regenerate, delete .env and run this script again."
else
    echo "Copying .env.example to .env..."
    cp .env.example .env

    echo "Generating SESSION_SECRET..."
    SESSION_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
    echo "SESSION_SECRET=$SESSION_SECRET" >> .env

    echo "Generating QR_ENCRYPTION_KEY..."
    QR_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
    echo "QR_ENCRYPTION_KEY=$QR_KEY" >> .env

    echo "Generating QR_ENCRYPTION_IV..."
    QR_IV=$(node -e "console.log(require('crypto').randomBytes(16).toString('hex'))")
    echo "QR_ENCRYPTION_IV=$QR_IV" >> .env

    echo -e "${GREEN}✅ Security secrets generated and saved to .env${NC}"
fi

echo ""
echo "=================================================="
echo "🗄️  Step 3: Database configuration"
echo "=================================================="

read -p "Do you want to configure the database now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    read -p "Database name (default: darkevent): " DB_NAME
    DB_NAME=${DB_NAME:-darkevent}

    read -p "Database user (default: darkevent): " DB_USER
    DB_USER=${DB_USER:-darkevent}

    read -sp "Database password (default: darkevent): " DB_PASS
    DB_PASS=${DB_PASS:-darkevent}
    echo

    read -p "Database host (default: localhost): " DB_HOST
    DB_HOST=${DB_HOST:-localhost}

    read -p "Database port (default: 5432): " DB_PORT
    DB_PORT=${DB_PORT:-5432}

    DB_URL="postgres://$DB_USER:$DB_PASS@$DB_HOST:$DB_PORT/$DB_NAME"

    # Update DATABASE_URL in .env
    if grep -q "^DATABASE_URL=" .env; then
        sed -i.bak "s|^DATABASE_URL=.*|DATABASE_URL=$DB_URL|" .env
        rm .env.bak 2>/dev/null || true
    else
        echo "DATABASE_URL=$DB_URL" >> .env
    fi

    echo -e "${GREEN}✅ Database URL configured${NC}"

    # Test connection
    echo ""
    echo "Testing database connection..."
    if psql "$DB_URL" -c "SELECT 1;" &>/dev/null; then
        echo -e "${GREEN}✅ Database connection successful${NC}"

        read -p "Do you want to push the schema to the database? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            npm run db:push
            echo -e "${GREEN}✅ Database schema pushed${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️  Could not connect to database. Please verify your credentials.${NC}"
        echo "   You can push the schema later with: npm run db:push"
    fi
else
    echo "Skipping database configuration. You can configure it manually in .env"
fi

echo ""
echo "=================================================="
echo "📧 Step 4: Email configuration (optional)"
echo "=================================================="

read -p "Do you want to configure SMTP for emails? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    read -p "SMTP Host (e.g., smtp-mail.outlook.com): " SMTP_HOST
    read -p "SMTP Port (default: 587): " SMTP_PORT
    SMTP_PORT=${SMTP_PORT:-587}
    read -p "SMTP User (email): " SMTP_USER
    read -sp "SMTP Password: " SMTP_PASS
    echo

    # Update .env
    sed -i.bak "s|^SMTP_HOST=.*|SMTP_HOST=$SMTP_HOST|" .env
    sed -i.bak "s|^SMTP_PORT=.*|SMTP_PORT=$SMTP_PORT|" .env
    sed -i.bak "s|^SMTP_USER=.*|SMTP_USER=$SMTP_USER|" .env
    sed -i.bak "s|^SMTP_PASS=.*|SMTP_PASS=$SMTP_PASS|" .env
    sed -i.bak "s|^EMAIL_FROM=.*|EMAIL_FROM=$SMTP_USER|" .env
    rm .env.bak 2>/dev/null || true

    echo -e "${GREEN}✅ Email configuration saved${NC}"
else
    echo "Skipping email configuration."
fi

echo ""
echo "=================================================="
echo "✅ Setup Complete!"
echo "=================================================="
echo ""
echo "Next steps:"
echo ""
echo "1. Review your .env file:"
echo "   nano .env"
echo ""
echo "2. Start the development server:"
echo "   npm run dev"
echo ""
echo "3. Create an admin account (in another terminal):"
echo "   curl -X POST http://localhost:5000/api/auth/init"
echo ""
echo "4. Open the app in your browser:"
echo "   http://localhost:5000"
echo ""
echo "5. Login with:"
echo "   Username: admin"
echo "   Password: admin123"
echo "   ⚠️  CHANGE THE PASSWORD IMMEDIATELY!"
echo ""
echo "=================================================="
echo "📚 Documentation:"
echo "   - QUICKSTART.md - Detailed setup guide"
echo "   - SECURITY.md   - Security checklist"
echo "   - AUDIT.md      - Complete audit report"
echo "=================================================="
echo ""
echo -e "${GREEN}Happy coding! 🎉${NC}"
