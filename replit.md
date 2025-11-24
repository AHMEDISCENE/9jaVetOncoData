# Overview

9ja VetOncoData is a comprehensive veterinary cancer data management platform designed specifically for Nigerian clinics. It's a full-stack web application that enables veterinarians to record, manage, and analyze oncology cases with multi-role access control, bulk data import capabilities, and advanced reporting features. The platform is built as a Progressive Web App (PWA) with offline capabilities to support clinics with limited connectivity.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
The client is built using React 18 with TypeScript, utilizing Vite as the build tool and development server. The UI is constructed with shadcn/ui components built on top of Radix UI primitives and styled with Tailwind CSS. State management is handled through TanStack Query (React Query) for server state and React Context for authentication state. The application uses Wouter for client-side routing instead of React Router for a lighter footprint.

The frontend follows a mobile-first design approach with responsive layouts optimized for both desktop and mobile devices. Form handling is managed through React Hook Form with Zod validation schemas for type-safe form validation.

## Backend Architecture  
The server is built with Express.js and TypeScript, serving both API endpoints and static files. The application uses PostgreSQL as the primary database with Drizzle ORM for database operations and migrations. Session management is implemented using express-session with PostgreSQL session storage via connect-pg-simple.

The backend follows a RESTful API design with role-based access control (RBAC) supporting six user roles in hierarchical order: SUPER_ADMIN, ADMIN, MANAGER, CLINICIAN, RESEARCHER, and STUDENT. Authentication supports both email/password and Google OAuth integration.

**Dual-Level Administration System:**
- **SUPER_ADMIN**: Platform-wide administrator with access to all users across all clinics. Can perform global user management including promoting users to SUPER_ADMIN.
- **ADMIN**: Clinic-level administrator with access only to users within their own clinic. Can manage clinic users (promote, demote, suspend, delete) but cannot promote to SUPER_ADMIN.
- Both admin levels have access to the User Management interface, with SUPER_ADMIN seeing all users platform-wide and ADMIN seeing only their clinic's users.

## Database Design
The database schema includes comprehensive entities for clinics, users, cases, tumour types, anatomical sites, attachments, feed posts, follow-ups, and audit logs. The schema uses PostgreSQL enums for standardized data like Nigerian states, user roles, and case outcomes. Relationships are properly defined with foreign keys and cascading rules to maintain data integrity.

## Data Import System
A sophisticated bulk upload system supports multiple file formats (CSV, XLSX, JSON, ZIP archives) with intelligent field mapping, validation, and error reporting. The system includes features for handling large files, duplicate detection, and transactional imports to ensure data consistency.

## File Handling
File uploads are managed through Multer middleware with support for images, PDFs, and laboratory documents. Files are associated with cases through an attachments system that tracks file types and metadata.

## Progressive Web App (PWA)
The application is configured as a PWA with offline capabilities, service worker integration, and installable features. This enables usage in areas with poor connectivity, which is crucial for the Nigerian veterinary clinic context.

## Security and Audit Trail
The system implements comprehensive audit logging for all create, update, and delete operations. Role-based access control ensures that users can only access data from their own clinics, preventing cross-clinic data leakage.

## Password Reset System
The application includes a complete password reset flow with the following features:
- **Forgot Password Dialog**: Modal dialog accessible from the login page that prompts users for their email address
- **Password Reset Tokens**: Secure tokens (32-byte random hex) generated and stored in `password_reset_tokens` table with 24-hour expiration
- **Token Verification**: Tokens are single-use and become invalid after being used to reset a password
- **Backend Endpoints**:
  - `POST /api/auth/forgot-password`: Generates reset token and sends email via Gmail API (with fallback to development mode token display)
  - `POST /api/auth/reset-password`: Verifies token and updates user password with bcrypt hashing
- **Password Visibility Toggles**: Eye/EyeOff icons in all password fields for easy visibility toggling

## Recent Changes (November 24, 2025)
- **Sidebar UI/UX Revamp**: Completely redesigned sidebar with improved typography, better icons (Home, BarChart3, FileText, MessageCircle, CalendarDays, Gear), enhanced visual hierarchy, glassmorphism effects, hover animations, description text on nav items, active state indicators, and refined user profile section - maintains doodle background
- **Session Role Sync Fix**: `/api/auth/me` endpoint now syncs `req.session.userRole` from database on every call, ensuring role changes immediately reflect in UI after page reload
- **SUPER_ADMIN Setup Endpoint**: Added `/api/admin/setup-super-admin` endpoint for initializing the first platform SUPER_ADMIN. Endpoint checks if any SUPER_ADMIN exists; if not, allows setup via email. Only works once - prevents unauthorized promotions.
- **Gmail integration for password resets**: Connected Gmail API via Replit connector for sending actual password reset emails
- **Email service implementation**: Created `server/email.ts` with OAuth2 authentication for Gmail, handles token expiration and refresh
- **Updated forgot-password endpoint**: Now sends emails via Gmail with fallback to development mode token display if service unavailable
- **Added password visibility toggles**: Eye icons in login/register password fields to show/hide passwords
- **Implemented forgot password flow**: Complete modal dialog workflow for password reset
- **Created password_reset_tokens table**: Secure token storage with indexes for fast lookups and expiration management
- **Added backend password reset endpoints**: Forgot password and reset password API routes with proper validation
- **Database optimization**: Indexes on user_id, token, and expires_at for efficient queries
- **heryourdayg9@gmail.com promoted to SUPER_ADMIN** in production

# External Dependencies

## Database Services
- **Neon Database**: PostgreSQL hosting service configured through the `@neondatabase/serverless` package for serverless database connections
- **PostgreSQL**: Primary database system using connection pooling for performance

## UI Component Libraries  
- **Radix UI**: Comprehensive set of unstyled, accessible UI primitives including dialogs, dropdowns, forms, and navigation components
- **shadcn/ui**: Pre-built component library built on top of Radix UI with Tailwind CSS styling
- **Recharts**: Charting library for analytics dashboards and data visualization

## Authentication and Security
- **bcrypt**: Password hashing for secure user authentication
- **express-session**: Session management middleware
- **connect-pg-simple**: PostgreSQL session store integration

## File Processing
- **Multer**: File upload handling middleware for processing attachments and bulk upload files
- **Sharp**: Planned image processing capabilities for handling medical images and histopathology files

## Email Services
- **Gmail API**: Email service integration for password reset notifications (configured via Gmail/Google OAuth)
  - Connected via Replit's Gmail connector with `googleapis` package
  - Sends password reset emails with tokens and reset links
  - Fallback to development mode token display if email service unavailable

## Development and Build Tools
- **Vite**: Modern build tool and development server with hot module replacement
- **TypeScript**: Type safety across both frontend and backend
- **Drizzle Kit**: Database migration and schema management tool
- **ESBuild**: Fast JavaScript/TypeScript bundler for production builds

## Validation and Forms
- **Zod**: TypeScript-first schema validation for both client and server
- **React Hook Form**: Performant form library with minimal re-renders
- **@hookform/resolvers**: Integration between React Hook Form and Zod validation

## State Management
- **TanStack Query**: Server state management with caching, synchronization, and background updates
- **React Context**: Client-side state management for authentication and global app state

## Styling and UI
- **Tailwind CSS**: Utility-first CSS framework with custom design system
- **class-variance-authority**: Type-safe variant API for component styling
- **clsx**: Utility for constructing className strings conditionally