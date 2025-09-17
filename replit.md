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

The backend follows a RESTful API design with role-based access control (RBAC) supporting four user roles: ADMIN, MANAGER, CLINICIAN, and RESEARCHER. Authentication supports both email/password and planned Google OAuth integration.

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
- **SendGrid**: Email service integration for notifications, invitations, and report delivery (configured via `@sendgrid/mail`)

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