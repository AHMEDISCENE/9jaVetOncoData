# Overview

9ja VetOncoData is a comprehensive veterinary cancer data management platform designed for Nigerian clinics. This full-stack web application enables veterinarians to record, manage, and analyze oncology cases. It features multi-role access control, bulk data import, and advanced reporting. Built as a Progressive Web App (PWA), it offers offline capabilities to support clinics with limited connectivity.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
The client is a React 18 application with TypeScript, using Vite for building. UI components are built with shadcn/ui (on Radix UI primitives) and styled with Tailwind CSS, following a mobile-first, responsive design. State management uses TanStack Query for server state and React Context for authentication. Wouter handles client-side routing, and React Hook Form with Zod manages form validation.

## Backend Architecture
The server is built with Express.js and TypeScript, providing RESTful API endpoints and static file serving. PostgreSQL is the primary database, managed with Drizzle ORM. Session management uses express-session with connect-pg-simple for PostgreSQL storage. The backend implements role-based access control (RBAC) with six hierarchical roles (SUPER_ADMIN, ADMIN, MANAGER, CLINICIAN, RESEARCHER, STUDENT) and supports email/password and Google OAuth authentication. A dual-level administration system distinguishes between platform-wide SUPER_ADMINs and clinic-level ADMINs.

## Database Design
The database schema includes entities for clinics, users, cases, tumour types, anatomical sites, attachments, feed posts, follow-ups, and audit logs. It uses PostgreSQL enums for standardized data and defines relationships with foreign keys for data integrity.

## Data Import System
A bulk upload system supports CSV, XLSX, JSON, and ZIP files with intelligent field mapping, validation, error reporting, duplicate detection, and transactional imports.

## File Handling
Multer middleware manages file uploads for images, PDFs, and laboratory documents, associating them with cases via an attachment system that tracks metadata.

## Progressive Web App (PWA)
The application is configured as a PWA with service worker integration and offline capabilities for use in areas with poor connectivity.

## Security and Audit Trail
The system features comprehensive audit logging for all CUD operations and implements RBAC to prevent cross-clinic data leakage. A complete password reset system is included with secure token generation, email integration (via Gmail API), and bcrypt hashing.

# External Dependencies

## Database Services
- **Neon Database**: PostgreSQL hosting for serverless database connections.
- **PostgreSQL**: Primary relational database.

## UI Component Libraries
- **Radix UI**: Unstyled, accessible UI primitives.
- **shadcn/ui**: Pre-built UI components based on Radix UI and Tailwind CSS.
- **Recharts**: Charting library for data visualization.

## Authentication and Security
- **bcrypt**: Password hashing.
- **express-session**: Session management middleware.
- **connect-pg-simple**: PostgreSQL session store.

## File Processing
- **Multer**: File upload handling.
- **Sharp**: (Planned) Image processing capabilities.

## Email Services
- **Gmail API**: Integrated via Replit connector for sending password reset emails using Google OAuth.

## Development and Build Tools
- **Vite**: Build tool and development server.
- **TypeScript**: Type safety.
- **Drizzle Kit**: Database migration and schema management.
- **ESBuild**: JavaScript/TypeScript bundler.

## Validation and Forms
- **Zod**: TypeScript-first schema validation.
- **React Hook Form**: Performant form library.
- **@hookform/resolvers**: Integration for Zod with React Hook Form.

## State Management
- **TanStack Query**: Server state management.
- **React Context**: Client-side state management.

## Styling and UI
- **Tailwind CSS**: Utility-first CSS framework.
- **class-variance-authority**: Type-safe variant API for styling.
- **clsx**: Utility for constructing className strings.

# Recent Changes

## November 29, 2025

### Navigation Pane 3D Shadow Effects
- **Enhanced Visual Design**: Added professional 3D shadow and depth effects to sidebar navigation
  - `shadow-2xl` for deep elevation with `dark:shadow-black/50` for dark mode
  - 3D perspective (1200px) with Y-axis rotation on slide-in animation
  - Glassmorphism effect with `backdrop-blur-sm` for modern appearance
  - Gradient background overlay and gradient border on header
- **Interactive Hover Effects**:
  - Individual nav item shadows with hover enhancement
  - Lift animation on hover (`hover:-translate-y-0.5`) for interactive feedback
  - Gradient styling on active nav items for better visual hierarchy
  - Smooth 300ms transitions for all effects

### Bulk Upload Template Instructions
- **Comprehensive User Guide**: Enhanced CSV template with complete instructions
  - Added general guidelines section with best practices
  - Detailed field descriptions for all 20 columns with examples
  - Valid values guide (e.g., sex options: MALE_INTACT, MALE_NEUTERED, FEMALE_INTACT, FEMALE_SPAYED)
  - Clear marking of REQUIRED (*) vs OPTIONAL fields
  - Tips for successful import (8 practical guidelines)
  - Information about flexible column mapping during import
  - 3 example data rows showing real-world scenarios:
    1. Standard case with recognized tumour type and anatomical site
    2. Case with standard tumour type (lymphoma)
    3. Case with custom anatomical site (nasal carcinoma)
  - Nigerian state context and date format specifications (YYYY-MM-DD)
  - Guidance on custom vs standard values for tumour types and anatomical sites
- **Location**: `/api/imports/template.csv` endpoint returns template with embedded instructions

## November 28, 2025

### Tumour Type Filter Production Fix
- **Critical Bug Fix**: Fixed tumour type filter not working in production
- **Root Cause Analysis**: 
  1. Sequential `.where()` calls in Drizzle ORM were overwriting each other instead of combining conditions
  2. Many cases used `tumourTypeCustom` (text field) instead of `tumourTypeId` (UUID foreign key)
- **Implementation**:
  - Refactored `getCases()` in `server/storage.ts` to use `and(...conditions)` pattern
  - Added fallback filter logic: when filtering by `tumourTypeId`, also matches cases where `tumourTypeCustom` contains the same tumour type name
  - Updated both main query path and fallback path for consistency
  - Added comprehensive logging for debugging filter application
- **Technical Pattern**: Accumulate all filter conditions in an array, then apply once with `query.where(and(...conditions))`
- **Important Note**: After code changes, production deployment required for fix to take effect

## November 25, 2025

### Feed Post Image Attachments
- **Image Upload Feature**: Added full image attachment capability to feed posts
  - **Create Post**: Users can attach multiple images when creating new posts via "Add Images" button
  - **Edit Post**: Authors can add or remove images when editing existing posts
  - **Image Display**: Attached images displayed in 2-column grid above post content for optimal viewing
  - **Image Management**: Users can remove individual images with hover-activated delete button
- **Backend Implementation**:
  - New API endpoint: `POST /api/feeds/upload-image` handles image uploads (10MB max per image)
  - Multer configuration for feed images with memory storage
  - Image URLs stored in post `attachments` array (utilizes existing schema field)
  - Fallback to base64 data URLs if object storage unavailable
  - Supports JPEG, PNG, GIF, WebP image formats
- **Frontend Implementation**:
  - Image selection with multi-file support
  - Real-time upload with loading state
  - Toast notifications for upload success/errors
  - Form validation for file size and type
  - Both create and edit dialogs support image management
- **Existing Fields Utilized**: Leveraged the already-existing `attachments` field in feedPosts table to store image URLs

### Account Information Update Bug Fix
- **Fixed HTTP 304 Caching Issue**: Replaced `refetchQueries()` with `queryClient.setQueryData()` in profile, clinic, and theme mutations
- **Result**: Account updates now immediately reflect in UI without requiring server refetch

### Dark Mode Text Visibility Fix
- **Fixed Invisible Navigation Text**: Replaced hardcoded black text (`text-[#000000]`) with theme-adaptive colors
- **Updated Sidebar Elements**: All nav items, user name, and clinic name now use `text-foreground dark:text-foreground` pattern
- **Result**: Perfect text contrast in both light and dark modes

### Dashboard Flip Card Animation with View More
- **Interactive Stat Cards**: Added smooth 3D flip animation to all 4 dashboard stat cards with retained full functionality
  - **Total Cases Card**: Flips to show breakdown by species (top 5) with "View More" button
  - **New This Month Card**: Flips to show monthly trend (last 5 months) with "View More" button
  - **Active Clinics Card**: Flips to show cases by state (top 5) with "View More" button
  - **Remission Rate Card**: Flips to show treatment outcomes breakdown with "View More" button
- **Animation Details**:
  - Uses Framer Motion for smooth 3D rotateY animation (0.6s ease-in-out)
  - CSS `transform-style: preserve-3d` and `backface-visibility: hidden` for proper 3D effect
  - Cards maintain their gradient styling on both front and back sides
- **Enhanced UX**:
  - "View More" button on each card's back side opens full drilldown modal
  - Compact breakdown display with scrollable content
  - Color-matched buttons (blue, purple, amber, green) for visual consistency
  - Click hint text ("Click to see breakdown", etc.) on front
  - Full accessibility with keyboard support (Enter/Space)
  - Retains all original functionality (detailed charts, analytics)

### Mobile Navigation Alignment & Squicircle Design
- **Perfect Squicircle Selection Box**: Updated active nav item styling to use `border-radius: 1.25rem`
- **Mobile View Left Alignment**: Added mobile-specific CSS (max-width: 1024px) for proper left alignment
  - Nav items use `justify-content: flex-start` with full width on mobile
  - Icons have consistent sizing for proper alignment
  - Text is left-aligned with proper spacing

### AI Case Field Suggestions Feature
- **New CaseAIHelper Component**: Integrated AI-powered form field suggestions into New Case Form Step 1
  - **Fixed Endpoint Placement Bug**: Moved `/api/ai/suggest-case-fields` endpoint before catch-all middleware to fix 404 errors
  - **Field Extraction**: AI analyzes clinical notes and suggests: species, breed, sex, age, diagnosis method, tumour type, anatomical site, laterality, stage, treatment plan, notes
  - **Form Integration**: Handler function (`handleApplySuggestions`) applies AI suggestions to form fields using React Hook Form's `setValue()`

### AI Analytics Query Mode Support (Backend & Frontend)
- **Extended AI Analytics Endpoint**: Added optional `mode` parameter to `/api/ai/analytics-query` for dual-mode AI responses
  - **"strict" Mode** (default): AI answers ONLY from VetOncoData database results, strictly limiting responses to available context
  - **"universal" Mode**: AI can combine VetOncoData results with general veterinary/oncology knowledge for enriched answers
- **ChatGPT Helper Enhancement**: Updated `callChatGPT()` in `openaiClient.ts` to support mode parameter
  - Mode="strict": Appends strict instruction to system prompt: "You must answer ONLY using the VetOncoData context. If the context is not enough, say you cannot answer from VetOncoData data."
  - Mode="universal": Appends instruction to system prompt: "You may also use your general veterinary/oncology knowledge, but remind users this is not a substitute for a veterinarian's judgement."
  - Normalized mode validation: Invalid modes default to "strict" for safety
- **Analytics Query Service**: Extended `executeAnalyticsQuery()` to accept and pass through mode parameter to the summary generation step
- **Request Format**: `POST /api/ai/analytics-query` now accepts `{ question: string; mode?: "strict" | "universal" }`
- **Frontend UI Toggle**: Added mode toggle to "Ask AI About Your Data" panel on Analytics page
  - Two pill buttons: "Strictly VetOncoData" and "Universal Oncology AI"
  - Selected mode defaults to "strict"
  - Descriptive caption updates based on selected mode
  - Mode sent with each API request to ensure consistent AI behavior