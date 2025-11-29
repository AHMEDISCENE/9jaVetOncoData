# Overview
9ja VetOncoData is a comprehensive veterinary cancer data management platform for Nigerian clinics. This full-stack PWA enables veterinarians to record, manage, and analyze oncology cases with multi-role access, bulk data import, and advanced reporting. Its PWA capabilities support offline use in areas with limited connectivity, enhancing data accessibility and workflow efficiency.

# User Preferences
Preferred communication style: Simple, everyday language.

# System Architecture
## Frontend Architecture
The client is a React 18 application with TypeScript, built using Vite. UI components leverage shadcn/ui (on Radix UI primitives) and Tailwind CSS for a mobile-first, responsive design. State management is handled by TanStack Query for server state and React Context for authentication. Wouter manages client-side routing, and React Hook Form with Zod provides form validation.

## Backend Architecture
The server is built with Express.js and TypeScript, offering RESTful API endpoints and static file serving. PostgreSQL is the primary database, managed with Drizzle ORM. Session management uses express-session with connect-pg-simple. The backend implements role-based access control (RBAC) with six hierarchical roles (SUPER_ADMIN, ADMIN, MANAGER, CLINICIAN, RESEARCHER, STUDENT) and supports email/password and Google OAuth authentication. A dual-level administration system exists for platform-wide and clinic-level administration.

## Database Design
The PostgreSQL database schema includes entities for clinics, users, cases, tumour types, anatomical sites, attachments, feed posts, follow-ups, and audit logs, utilizing enums and foreign keys for data integrity.

## Data Import System
A robust bulk upload system supports CSV, XLSX, JSON, and ZIP files, featuring intelligent field mapping, validation, error reporting, duplicate detection, and transactional imports.

## File Handling
Multer middleware handles file uploads for images, PDFs, and laboratory documents, associating them with cases and tracking metadata.

## Progressive Web App (PWA)
The application is configured as a PWA with service worker integration, enabling offline capabilities to support users in areas with poor connectivity.

## Security and Audit Trail
The system includes comprehensive audit logging for all CUD operations and implements RBAC to prevent cross-clinic data leakage. A complete password reset system is included with secure token generation, email integration, and bcrypt hashing.

## AI Integration
AI-powered features include case field suggestions in forms and an AI analytics query mode that can operate in "strict" (VetOncoData only) or "universal" (VetOncoData + general knowledge) modes.

# External Dependencies
## Database Services
- **Neon Database**: PostgreSQL hosting.
- **PostgreSQL**: Primary relational database.

## UI Component Libraries
- **Radix UI**: Unstyled, accessible UI primitives.
- **shadcn/ui**: Pre-built UI components.
- **Recharts**: Charting library.
- **Framer Motion**: Animation library.

## Authentication and Security
- **bcrypt**: Password hashing.
- **express-session**: Session management.
- **connect-pg-simple**: PostgreSQL session store.

## File Processing
- **Multer**: File upload handling.

## Email Services
- **Gmail API**: For sending password reset emails.

## External APIs
- **NewsAPI**: Fetches veterinary and oncology news.

## Development and Build Tools
- **Vite**: Build tool and development server.
- **TypeScript**: Type safety.
- **Drizzle Kit**: Database migration and schema management.
- **ESBuild**: JavaScript/TypeScript bundler.

## Validation and Forms
- **Zod**: TypeScript-first schema validation.
- **React Hook Form**: Form library.
- **@hookform/resolvers**: Zod integration for React Hook Form.

## State Management
- **TanStack Query**: Server state management.
- **React Context**: Client-side state management.

## Styling and UI
- **Tailwind CSS**: Utility-first CSS framework.
- **class-variance-authority**: Type-safe variant API for styling.
- **clsx**: Utility for constructing className strings.