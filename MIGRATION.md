# Migration from Supabase to MySQL

This document outlines the migration from Supabase (PostgreSQL) to MySQL.

## Changes Made

### Backend
- Created Express.js API server (`server/index.js`)
- MySQL connection using `mysql2` package
- JWT-based authentication replacing Supabase Auth
- RESTful API endpoints for all database operations

### Frontend
- Replaced Supabase client with custom API client (`src/lib/api.ts`)
- Updated authentication hooks (`useAuth`, `useUserRole`)
- Updated all pages to use new API endpoints
- Removed Supabase dependencies

### Database Schema
The MySQL database should have the same tables as the PostgreSQL schema:
- `profiles` (with `password_hash` column added)
- `user_roles`
- `clients`
- `products`
- `product_components`
- `commandes`
- `chaines`
- `defaut_categories`
- `defaut_list`
- `role_permissions`
- `custom_roles`
- `fab_orders` (if exists)

## Setup Instructions

### 1. Install Backend Dependencies
```bash
cd server
npm install
```

### 2. Configure Environment Variables
Create `server/.env` file:
```
DB_HOST=localhost
DB_PORT=3306
DB_DATABASE=pcd_db
DB_USERNAME=root
DB_PASSWORD=
JWT_SECRET=your-secret-key-change-in-production
FRONTEND_URL=http://localhost:8080
PORT=3001
```

### 3. Create MySQL Database
```sql
CREATE DATABASE pcd_db;
```

### 4. Run Database Migrations
Import your existing schema or create tables matching the PostgreSQL structure.

### 5. Start Backend Server
```bash
cd server
npm start
# or for development
npm run dev
```

### 6. Configure Frontend
Create `.env` file in root:
```
VITE_API_URL=http://localhost:3001/api
```

### 7. Install Frontend Dependencies
```bash
npm install
```

### 8. Start Frontend
```bash
npm run dev
```

## Important Notes

1. **Password Hashing**: The `profiles` table now includes a `password_hash` column for storing bcrypt-hashed passwords.

2. **UUIDs**: The system uses UUIDs for IDs. Ensure your MySQL setup supports UUID generation or use the `uuid()` function.

3. **Timestamps**: MySQL uses `DATETIME` instead of `TIMESTAMPTZ`. The backend handles timestamp conversions.

4. **Authentication**: JWT tokens are stored in `localStorage` instead of Supabase's session management.

5. **CORS**: The backend is configured to allow requests from the frontend URL specified in `FRONTEND_URL`.

## Remaining Tasks

- [ ] Update admin pages (Roles, Permissions, Backups)
- [ ] Update atelier pages (FabOrders, FabOrderCreate, FabOrderEdit, FabOrderView)
- [ ] Remove Supabase dependencies from package.json
- [ ] Test all CRUD operations
- [ ] Update database schema documentation
