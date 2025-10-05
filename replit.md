# Zombinthedark Event Management System

## Overview

Zombinthedark is a specialized event management system designed for a zombie/post-apocalyptic themed event. The application manages two distinct participant types (zombies and survivors), each with separate time slots, squads, and check-in workflows. The system also handles boutique (shop) and meal inventory management, with special rules for zombie participants who receive one free meal.

The application features a dark, atmospheric UI with toxic green accent color, balancing horror aesthetics with operational clarity for event staff.

## Recent Changes (October 5, 2025)

- **Real-time Dashboard Analytics**: Added comprehensive dashboard with auto-refreshing statistics including participant arrivals, squad distribution charts (recharts), checklist completion rates, and stock alerts
- **Filtered Excel Export Reports**: Implemented dropdown export system with sanitized filenames (Unicode normalization) for filtered reports by time slot and squad, complete French headers and clear user feedback
- **Squad Modification Audit Trail**: Created squadAuditLog table tracking all squad reassignments with timestamps, integrated history timeline in check-in modal showing previous assignments, proper data consistency with post-update logging
- **Fixed Critical Cache Invalidation Issues**: Updated all mutation success handlers to use predicate-based invalidation for TanStack Query, ensuring immediate UI updates after Excel import, check-in, and stock management operations
- **Backend Route Optimization**: Restructured API endpoints to use query string parameters (?type=zombie) instead of path parameters for better RESTful design and to avoid route ordering conflicts
- **Frontend Query Updates**: All useQuery hooks now use explicit queryFn with proper URL construction for consistent data fetching
- **E2E Testing**: Successfully verified all MVP functionality including navigation, participant management, check-in flow, squad assignment, locker generation, and stock management

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