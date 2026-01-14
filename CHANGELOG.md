# Changelog

All notable changes to DarkEventManager will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [1.1.0] - 2026-01-14 - SECURITY UPDATE 🔒

### 🔴 CRITICAL SECURITY FIXES

This release addresses **5 critical security vulnerabilities** identified during a comprehensive security audit.

#### Added

- **bcrypt Password Hashing**
  - Replaced SHA-256 with bcrypt (salt rounds: 12)
  - Secure password verification with timing-attack protection
  - All password operations now async

- **Environment Variable Validation**
  - Mandatory `SESSION_SECRET` (min 32 characters)
  - Mandatory `QR_ENCRYPTION_KEY` (32 bytes)
  - Mandatory `QR_ENCRYPTION_IV` (16 bytes)
  - Startup validation with helpful error messages

- **Rate Limiting**
  - Auth endpoints: 5 attempts per 15 minutes
  - API endpoints: 100 requests per minute
  - Protection against brute force attacks
  - RateLimit headers in responses

- **PostgreSQL Session Store**
  - Persistent sessions across server restarts
  - Support for horizontal scaling (multi-instance)
  - Auto-pruning of expired sessions (every 15 minutes)
  - Session TTL: 24 hours

- **Helmet Security Headers**
  - X-Content-Type-Options: nosniff
  - X-Frame-Options: DENY
  - X-XSS-Protection
  - Automatic security headers on all responses

#### Changed

- **Session Cookies**
  - `secure: true` in production (HTTPS only)
  - `httpOnly: true` (always)
  - `sameSite: 'lax'`

- **Environment Configuration**
  - `.env.example` completely rewritten with security focus
  - Clear instructions for secret generation
  - Removed hardcoded default values
  - Added quick setup commands

#### Removed

- **Hardcoded Secrets**
  - No more default encryption keys in code
  - No more default session secret
  - No more fallback values for security-critical variables

#### Security

- **Password Security**: SHA-256 → bcrypt (CRITICAL FIX)
- **Encryption Keys**: Hardcoded → Environment variables (CRITICAL FIX)
- **Session Storage**: MemoryStore → PostgreSQL (CRITICAL FIX)
- **Rate Limiting**: None → Implemented (HIGH PRIORITY FIX)
- **Security Headers**: None → Helmet middleware (HIGH PRIORITY FIX)

#### Documentation

- **AUDIT.md**: Complete project audit (700+ lines)
  - 20 improvement recommendations
  - Prioritized action plan (4-6 weeks)
  - Code examples for each recommendation
  - Metrics: current vs targets

- **SECURITY.md**: Comprehensive security guide
  - Secret generation instructions
  - Pre-production checklist
  - Incident response procedures
  - Security testing commands

- **QUICKSTART.md**: Quick start guide
  - Step-by-step installation
  - Secret generation (automatic + manual)
  - Common troubleshooting
  - First connection guide

#### Dependencies

**Added:**
- `bcrypt@^6.0.0` - Secure password hashing
- `express-rate-limit@^8.2.1` - Rate limiting middleware
- `helmet@^8.1.0` - Security headers middleware
- `@types/bcrypt@^6.0.0` - TypeScript definitions

**Already Present (now used):**
- `connect-pg-simple@^10.0.0` - PostgreSQL session store

#### Breaking Changes

⚠️ **IMPORTANT**: This update requires manual intervention before deployment.

1. **Environment Variables Required**
   - `SESSION_SECRET` must be set (min 32 chars)
   - `QR_ENCRYPTION_KEY` must be set (64 hex chars)
   - `QR_ENCRYPTION_IV` must be set (32 hex chars)
   - Application will not start without these

2. **Password Reset Required**
   - All existing passwords hashed with SHA-256 are invalid
   - Users must reset their passwords
   - See SECURITY.md for migration procedures

3. **Session Reset**
   - All existing sessions will be invalidated
   - Users will need to log in again

#### Migration Guide

**Before Upgrading:**
1. Read `SECURITY.md` completely
2. Backup your database
3. Notify users of required password reset

**After Upgrading:**
1. Generate secrets (see QUICKSTART.md step 3)
2. Configure `.env` file
3. Recreate admin account via `/api/auth/init`
4. Reset all user passwords

**Automatic Setup:**
```bash
cp .env.example .env
echo "SESSION_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")" >> .env
echo "QR_ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")" >> .env
echo "QR_ENCRYPTION_IV=$(node -e "console.log(require('crypto').randomBytes(16).toString('hex'))")" >> .env
```

#### Impact

- **Security Score**: ⭐⭐ (2/5) → ⭐⭐⭐⭐ (4/5)
- **Production Ready**: ❌ → ✅ (after configuration)
- **All critical vulnerabilities**: Fixed

#### Testing

**Rate Limiting Test:**
```bash
for i in {1..10}; do
  curl -X POST http://localhost:5000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"test","password":"wrong"}' \
    -w "\n%{http_code}\n"
done
```

**Expected**: First 5 return 401, next 5 return 429

---

## [1.0.0] - Initial Release

### Added

- Full-stack event management system
- Participant management (zombie/survivant/staff)
- QR code check-in system
- Squad management with automatic assignment
- Shop inventory management
- Meal service management
- Purchase tracking with discount system
- Real-time dashboard with statistics
- WebSocket synchronization (online/offline modes)
- PDF generation for participants
- Email distribution system (SMTP)
- Audit logging for all operations
- Role-based access control
- Excel import/export functionality

### Technologies

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Shadcn/ui
- **Backend**: Express.js, Node.js, TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Real-time**: WebSocket (ws)

---

## Future Releases (Planned)

### [1.2.0] - Architecture Improvements

- [ ] Modularize `routes.ts` into separate route files
- [ ] Implement unit tests (target: 50% coverage)
- [ ] Add structured logging (Winston)
- [ ] Implement pagination on all list endpoints

### [1.3.0] - Developer Experience

- [ ] API documentation (Swagger/OpenAPI)
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] ESLint + Prettier configuration
- [ ] Pre-commit hooks (Husky)

### [1.4.0] - Performance

- [ ] Redis caching layer
- [ ] Query optimization (N+1 fixes)
- [ ] Frontend lazy loading
- [ ] Bundle size optimization

### [2.0.0] - Enterprise Features

- [ ] Sentry monitoring integration
- [ ] Automated database backups
- [ ] Error boundaries (frontend)
- [ ] PWA / Service Worker
- [ ] Advanced analytics dashboard

---

## Notes

- **Critical Security Update**: Version 1.1.0 is a mandatory security update
- **No Backward Compatibility**: Passwords must be reset after upgrade
- **Documentation**: See AUDIT.md for complete analysis and roadmap

---

**Maintainer**: DarkEventManager Team
**Repository**: https://github.com/WilyKV/DarkEventManager
