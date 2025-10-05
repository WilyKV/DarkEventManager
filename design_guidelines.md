# Design Guidelines: Zombinthedark Event Management System

## Design Approach
**Modern & Professional**: Clean, contemporary design with subtle thematic touches. Focus on usability and efficiency for event staff while maintaining a light connection to the zombie theme through minimal color accents.

## Core Design Elements

### A. Color Palette
**Dark Mode Primary** (modern dark interface):
- Background: 220 15% 10% (cool dark gray - professional)
- Surface: 220 15% 14% (elevated surfaces)
- Primary: 150 45% 45% (modern sage green - subtle nod to theme)
- Accent: 0 60% 55% (muted red for important actions - very subtle blood reference)
- Success: 150 50% 50% (soft green confirmation)
- Text Primary: 220 10% 95% (clean white text)
- Text Secondary: 220 10% 65% (muted gray text)

**Light Mode Alternative** (cleaner, professional):
- Background: 0 0% 98% (soft white)
- Surface: 0 0% 100% (pure white cards)
- Primary: 150 45% 45% (same sage green)
- Accent: 0 60% 55% (same muted red)
- Text Primary: 220 15% 15% (dark gray)
- Text Secondary: 220 10% 45% (medium gray)

**Interactive States**:
- Hover: Subtle brightness increase
- Active: Slight scale down (0.98)
- Disabled: 40% opacity
- Focus: Ring in primary color

### B. Typography
**Fonts** (modern, professional):
- All text: "Inter" - clean, modern, excellent readability
- Monospace: "JetBrains Mono" or "Roboto Mono" - for IDs and locker numbers
- No display fonts - keep it professional

**Scale**:
- H1: 2.5rem/2rem (desktop/mobile), bold
- H2: 2rem/1.75rem, semibold
- H3: 1.5rem/1.25rem, semibold
- Body: 1rem, regular
- Small: 0.875rem, regular

### C. Layout System
**Spacing**: Consistent, generous spacing for modern look
- Card padding: p-6 md:p-8
- Section spacing: space-y-8
- Container: max-w-7xl mx-auto px-4 md:px-6

**Grid System**:
- Home cards: grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6
- Responsive, clean layouts
- Plenty of whitespace

### D. Component Library

**Home Page Cards**:
- Clean rectangular cards
- Subtle shadow and border
- Icon at top (simple, modern icons)
- Clear title and description
- Smooth hover transition (lift + shadow)
- No distressed effects or textures

**Participant Management Interface**:
- Clean search bar with modern styling
- Participant cards: Clean horizontal cards
- Status indicators: Modern badges with subtle colors
- Squad selector: Clean dropdown
- Locker number: Monospace display with subtle background
- Checklist: Simple checkboxes

**Forms & Inputs**:
- Clean backgrounds
- Subtle borders
- Green focus rings
- Clear labels
- Modern error states

**Data Tables**:
- Clean rows with subtle hover states
- Clear headers
- Good spacing
- Status colors: subtle and professional

**Navigation**:
- Clean header with app title
- Simple back button
- Modern breadcrumbs if needed
- Clear action buttons

**Buttons**:
- Primary: Filled with sage green
- Secondary: Subtle gray background
- Danger: Muted red for destructive actions
- Ghost: Transparent with hover
- Modern rounded corners (0.5rem)

### E. Thematic Elements (VERY SUBTLE)

**Minimal Theme References**:
- Color palette includes subtle green (not neon/toxic)
- Occasional red accent (not "blood" but just a warm accent)
- Clean, professional throughout
- No textures, no dripping effects, no distressed edges
- No biohazard symbols or horror elements
- Theme is present only through color choice, not visual effects

**Icons**:
- Lucide React icons (modern, clean)
- No zombie-specific icons
- Professional and functional

**Micro-interactions**:
- Smooth transitions (200-300ms)
- Subtle hover states
- Clean feedback animations
- Professional and polished

### F. Sections Detail

**Home Page**:
- Clean layout with app title
- Grid of feature cards
- Modern, professional appearance
- Quick access to main functions

**Participant Lists**:
- Clean filters and search
- Well-organized list
- Status badges clear and readable
- Quick actions easily accessible

**Forms**:
- Single column layout
- Clear field labels
- Good spacing
- Modern input styling
- Clear validation messages

**Stock Management**:
- Clean table or grid view
- Clear stock levels
- Simple +/- controls
- Status indicators subtle but clear

## Overall Philosophy
- **Clean and Modern**: Professional appearance suitable for event management
- **Subtle Theme**: Green and red accents provide minimal connection to zombie theme without being overwhelming
- **Usability First**: Clear, efficient interface for staff
- **No Horror Effects**: No dripping, distressed, or apocalyptic visual elements
- **Professional**: Could be used for any event management, theme present only through color choices
