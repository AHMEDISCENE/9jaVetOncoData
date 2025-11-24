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