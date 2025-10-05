# Zombinthedark Event Management System

## Overview

Zombinthedark is a specialized event management system designed for a zombie/post-apocalyptic themed event. The application manages two distinct participant types (zombies and survivors), each with separate time slots, squads, and check-in workflows. The system also handles boutique (shop) and meal inventory management, with special rules for zombie participants who receive one free meal.

The application features a dark, atmospheric UI with toxic green accent color, balancing horror aesthetics with operational clarity for event staff.

## Recent Changes (October 5, 2025)

### Latest Updates - Check-in Workflow & Badge Scanning

**New Features Completed:**
1. **Email Field**: Added optional email field to participant schema and registration form for badge distribution
2. **Time Slot Management**: Created AddTimeSlotDialog component for adding/editing time slots on both zombie and survivor pages
3. **Batch Operations**: Implemented checkbox-based selection system in ParticipantList with batch "Arrived" and "Return" buttons
4. **Complete Check-in Workflow**: Created CheckInModal with arrival status, squad assignment, locker display, squad history timeline, and comprehensive volunteer checklist
5. **QR Badge Scanning**: New /scan page for scanning participant badges (format: PARTICIPANT:{id}) that triggers the check-in workflow with automatic timestamp recording
6. **Navigation**: Added "Scanner" card to home page for easy access to QR scanning functionality

**Bug Fixes:**
- Fixed CheckInModal to properly set `arrivedAt` timestamp when marking participant as arrived (ensures stats and exports work correctly)
- Fixed schema insert schemas to exclude auto-generated timestamp fields (arrivedAt, returnedAt)

**Email Integration Note:**
Badge email distribution is ready to implement. Available integration options:
- Resend (connector available - requires authorization setup)
- SendGrid (connector available - requires authorization setup)
- Gmail (connector available - requires OAuth setup)
- Outlook (connector available - requires OAuth setup)
- Custom SMTP (manual implementation with API keys stored as secrets)

To implement email sending, the user can either:
1. Set up one of the Replit connectors above (recommended for automatic credential management)
2. Provide API keys/credentials to store as secrets for manual integration

### Advanced Features - Production Ready
All five advanced features have been completed and architect-reviewed:

1. **Real-time Dashboard Analytics**: Comprehensive dashboard with auto-refreshing statistics (5-second interval) including participant arrivals, squad distribution charts (recharts pie/bar charts), checklist completion rates, and low stock alerts

2. **Filtered Excel Export Reports**: Dropdown-based export system with three filter options (All, By Time Slot, By Squad), sanitized filenames with Unicode normalization, complete French headers, and clear user feedback via toasts

3. **Squad Modification Audit Trail**: SquadAuditLog table tracking all squad reassignments with timestamps, integrated history timeline in check-in modal showing previous assignments with French date formatting, proper data consistency with post-update logging

4. **Printable Badges with QR Codes**: Badge printing page with QR code generation (qrcode library), participant selection UI with search, URL parameter support (?participantId=X) for auto-selection and auto-print, print buttons on participant management pages, print-optimized CSS with @media print

5. **Timing Notification System**: ManagementLayout component providing consistent headers across all pages, NotificationCenter with bell icon and badge counter, timing alerts for meals/briefings/game/exit events within 60-minute window, comprehensive preference system with localStorage persistence (global toggle, per-event-type toggles, per-time-slot toggles), auto-refresh every minute, lucide-react icons only (no emoji)

### Technical Improvements
- **Cache Invalidation**: Updated all mutation handlers to use predicate-based invalidation for TanStack Query, ensuring immediate UI updates
- **Backend Route Optimization**: Restructured API endpoints to use query string parameters (?type=zombie) for better RESTful design
- **Frontend Query Updates**: All useQuery hooks use explicit queryFn with proper URL construction
- **E2E Testing**: Successfully verified all functionality including new features

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Build System:**
- React 18 with TypeScript for type-safe component development
- Vite as the build tool and development server
- Wouter for client-side routing (lightweight React Router alternative)
- TanStack Query (React Query) for server state management and caching

**UI Component Library:**
- Radix UI primitives for accessible, unstyled components
- shadcn/ui design system (New York variant) with custom zombie/post-apocalyptic theming
- Tailwind CSS for utility-first styling with custom HSL color variables
- Custom dark mode theme as the primary (and only) theme

**Design System:**
- Typography: "Creepster" or "Nosifer" for display text, "Inter" for body text, "Roboto Mono" for locker numbers
- Color palette: Deep toxic green-black backgrounds (140 8% 8%), radioactive green primary (140 60% 35%), blood orange accents (35 85% 45%)
- Layout: Responsive grid system with mobile-first approach, max container width of 7xl
- Component patterns: Card-based layouts, modal dialogs for check-ins, toast notifications

**State Management:**
- TanStack Query handles all server state with automatic caching and invalidation
- Query keys use predicate-based invalidation for flexible cache management
- Local component state (useState) for ephemeral UI state
- No global state management library needed due to server-centric architecture

### Backend Architecture

**Server Framework:**
- Express.js on Node.js for HTTP server and API routing
- TypeScript throughout for type safety
- ESM module system (type: "module" in package.json)
- Custom logging middleware for request/response tracking

**API Design:**
- RESTful API with resource-based endpoints
- Consistent error handling middleware
- JSON request/response format
- File upload support via Multer (for Excel imports)

**Database Layer:**
- Drizzle ORM for type-safe database operations
- Neon Serverless (PostgreSQL) as the database provider with WebSocket support
- Schema-first design with Zod validation
- Connection pooling for efficient database access

**Data Models:**
- **Participants**: Core entity with firstName, lastName, type (zombie/survivant), relationships to timeSlots and squads, check-in status flags, locker assignments
- **TimeSlots**: Schedule blocks with mealTime, briefingTime, gameTime, exitTime, separated by participant type
- **Squads**: Team assignments with maxMembers limits, type-specific (zombie squads: Alpha/Bravo/Charlie/Delta/Echo, survivor squads: Team 1-8)
- **ShopItems**: Boutique inventory with name, stock, price, category
- **MealItems**: Food inventory with name, stock, price, category
- **SquadAuditLog**: Audit trail for squad modifications tracking participantId, previousSquadId, newSquadId, changedAt timestamp

**Business Logic:**
- Automatic locker number generation (4-digit unique codes)
- Squad initialization on startup with predefined names and member limits
- Participant check-in workflow with multi-step checklist (meal ticket, water bottle, squad assignment, briefing, makeup wait, map)
- Free meal entitlement tracking for zombies (hasFreemeal, freeMealClaimed flags)
- Excel import functionality for bulk participant creation with automatic time slot matching
- Squad modification audit logging with automatic history tracking after successful updates
- Real-time dashboard statistics with 5-second auto-refresh
- Filtered Excel export with sanitized filenames by time slot and squad

### External Dependencies

**Database:**
- Neon Serverless PostgreSQL (via @neondatabase/serverless)
- Drizzle ORM for query building and schema management
- Migration system via drizzle-kit

**UI Component Libraries:**
- Radix UI ecosystem (@radix-ui/*) for 20+ accessible component primitives
- lucide-react for consistent iconography
- class-variance-authority (cva) for variant-based component styling
- cmdk for command palette functionality

**Form Handling:**
- React Hook Form for form state management
- @hookform/resolvers for Zod schema integration
- Zod for runtime type validation (drizzle-zod for schema generation)

**File Processing:**
- Multer for multipart/form-data file uploads
- xlsx library for Excel file parsing and generation

**Utilities:**
- date-fns for date manipulation
- clsx & tailwind-merge for conditional className composition
- nanoid for unique ID generation

**Development Tools:**
- tsx for running TypeScript directly in development
- esbuild for production server bundling
- Replit-specific plugins for development banners and error overlays