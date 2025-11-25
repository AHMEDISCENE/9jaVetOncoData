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

## November 25, 2025

### AI Analytics Query System (Natural Language Data Analysis)
- **Feature**: Ask AI about your data using natural language on Analytics page
  - **Frontend**: New "AI Analytics" tab on Analytics page for querying database
  - **Backend Endpoint**: `POST /api/ai/analytics-query` 
  - **Functionality**: Accepts natural language questions, uses ChatGPT to generate safe SQL SELECT queries, executes queries, and returns results with AI-generated summary
  - **Safety**: Implemented SQL validation (whitelist tables: cases, clinics, tumour_types, anatomical_sites; only SELECT allowed; no mutations)
  - **Services**: 
    - `server/services/analyticsQueryService.ts`: Handles SQL generation, validation, and execution
    - `client/src/components/analytics/AIAnalyticsPanel.tsx`: User interface for asking questions
  - **UI**: Integrated as separate tab in Analytics page with question textarea, results table, and AI summary
  
### AI Case Field Suggestion (Form Pre-filling)
- **Feature**: Extract case fields from clinical notes text
  - **Backend Endpoint**: `POST /api/ai/case-suggest` (authentication required)
  - **Request**: `{ text: string }` - clinical notes text
  - **Response**: `{ suggested: { species?, breed?, sex?, ageYears?, ageMonths?, tumourType?, anatomicalSite?, stage?, diagnosisMethod?, notesSummary? } }`
  - **Functionality**: Uses ChatGPT to intelligently extract and suggest case form fields from freetext clinical notes, returning suggested values as null if not found
  - **Error Handling**: Gracefully handles JSON parsing failures, returns empty object instead of crashing
  - **Use Case**: Helps pre-fill New Case form from existing clinical text, improving data entry speed

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