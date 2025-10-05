# Design Guidelines: Zombinthedark Event Management System

## Design Approach
**Hybrid Approach**: Material Design foundation with heavy zombie/post-apocalyptic theming. Balance atmospheric horror aesthetics with operational clarity for event staff efficiency.

## Core Design Elements

### A. Color Palette
**Dark Mode Primary** (the app should be dark throughout):
- Background: 140 8% 8% (deep toxic green-black)
- Surface: 140 10% 12% (elevated dark green)
- Primary: 140 60% 35% (radioactive green)
- Accent: 35 85% 45% (blood orange for alerts)
- Success: 140 55% 40% (toxic green confirmation)
- Text Primary: 140 5% 95%
- Text Secondary: 140 8% 70%

**Interactive States**:
- Hover: Brighten by 5% lightness
- Active: Darken by 5% lightness
- Disabled: 30% opacity

### B. Typography
**Fonts** (via Google Fonts):
- Display/Headers: "Creepster" or "Nosifer" - horror-themed for main titles
- Body/Interface: "Inter" - clean, readable for data-heavy content
- Monospace: "Roboto Mono" - for locker numbers and IDs

**Scale**:
- H1: 3rem/2.5rem (desktop/mobile), bold, display font
- H2: 2rem/1.75rem, semibold, display font
- H3: 1.5rem/1.25rem, semibold, body font
- Body: 1rem, regular, body font
- Small: 0.875rem, regular

### C. Layout System
**Spacing Units**: Use Tailwind units of 2, 4, 6, 8, 12, 16, 20
- Card padding: p-6 md:p-8
- Section spacing: space-y-6 md:space-y-8
- Container: max-w-7xl mx-auto px-4

**Grid System**:
- Home cards: grid-cols-1 md:grid-cols-2 gap-6
- Participant lists: Single column with cards
- Form layouts: Single column, max-w-2xl

### D. Component Library

**Home Page Cards** (4 large cards):
- Large square/slightly tall cards (aspect-ratio-square md:aspect-auto)
- Distressed borders with subtle glow effect
- Icon at top (zombie head, survivor icon, shopping bag, utensils)
- Title in display font with dripping effect
- Subtle background texture (scratches, grunge)
- Hover: Lift effect (translate-y) + increased glow

**Participant Management Interface**:
- Search bar: Prominent at top, dark input with green focus ring
- Participant cards: Compact horizontal cards with avatar placeholder
- Status indicators: Checkboxes with custom zombie-themed checks
- Squad selector: Dropdown with custom styling
- Locker number display: Large monospace with border
- Checklist: Items with checkboxes, strikethrough on complete

**Forms & Inputs**:
- Dark backgrounds (surface color)
- Green borders on focus
- Labels above inputs
- Error states in blood orange

**Data Tables** (for stock management):
- Alternating row colors for readability
- Sticky headers
- Inline edit capabilities
- Stock level indicators (color-coded: low=orange, out=red, normal=green)

**Navigation**:
- Top bar: App title + back button (when applicable)
- Breadcrumbs for nested sections
- Bottom fixed bar for primary actions

**Buttons**:
- Primary: Filled with primary green, white text
- Secondary: Outline with green border
- Danger: Filled with blood orange for destructive actions
- Icon buttons: Square with hover background

### E. Thematic Elements

**Visual Atmosphere**:
- Subtle texture overlays (grunge, scratches) on cards
- Dripping blood/slime effects on headers (pure CSS)
- Distressed edges on containers
- Faint biohazard symbols as background watermarks
- Flickering animation on critical alerts (very subtle)

**Icons**:
- Use Font Awesome for standard icons
- Zombie-themed variations: skull icons, biohazard symbols
- Status indicators: Custom checkmarks styled as X's or check marks

**Micro-interactions**:
- Success feedback: Brief green pulse
- Error feedback: Shake animation + orange glow
- Check-in completion: Satisfying confirmation animation
- Minimal, purposeful animations only

### F. Sections Detail

**Home Page**:
- Full viewport height hero area
- 2x2 grid of large cards (stacks to single column on mobile)
- Event title at top in massive display font
- Each card clickable with clear hover state

**Participant Lists**:
- Filters at top: By time slot, by squad, by status
- Search bar prominent
- Scrollable list of participant cards
- Each card shows: Name, time slot, status badges, quick actions

**Check-in Flow**:
- Full-screen modal or dedicated page
- Progress indicator (5 steps: Search → Arrival → Squad → Locker → Checklist)
- Large, clear action buttons
- Confirmation screen with summary

**Stock Management**:
- Split view: Categories sidebar + items grid
- Add/remove quantity with +/- buttons
- Low stock warnings prominent
- Quick search and filter

## Images
No hero images needed - this is a functional management tool. Use icon illustrations for the 4 main cards instead of photos. If any background imagery, use subtle post-apocalyptic textures/patterns, not full photos.