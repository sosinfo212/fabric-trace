# Fabrication Tracker - Developer Documentation

## Table of Contents
1. [Project Overview](#project-overview)
2. [Technology Stack](#technology-stack)
3. [Project Structure](#project-structure)
4. [Authentication & Authorization](#authentication--authorization)
5. [Database Schema](#database-schema)
6. [Routes & Pages](#routes--pages)
7. [Components Architecture](#components-architecture)
8. [Role-Based Access Control](#role-based-access-control)
9. [Edge Functions](#edge-functions)
10. [Getting Started](#getting-started)

---

## Project Overview

**Fabrication Tracker** is a comprehensive manufacturing management system designed to track production workflows, manage orders, products, clients, and production chains. The application supports multiple user roles with granular permissions.

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| Routing | React Router DOM v6 |
| State Management | TanStack Query (React Query) |
| Backend | Supabase |
| Database | PostgreSQL |
| Authentication | Supabase Auth |
| Build Tool | Vite |

---

## Project Structure

```
src/
├── components/
│   ├── layouts/
│   │   └── DashboardLayout.tsx    # Main layout with sidebar
│   ├── ui/                        # shadcn/ui components
│   ├── AppSidebar.tsx             # Navigation sidebar
│   └── NavLink.tsx                # Navigation link component
├── config/
│   └── menuConfig.ts              # Sidebar menu configuration
├── hooks/
│   ├── useAuth.tsx                # Authentication hook
│   ├── useUserRole.tsx            # User role management hook
│   ├── use-mobile.tsx             # Mobile detection hook
│   └── use-toast.ts               # Toast notifications
├── integrations/
│   └── supabase/
│       ├── client.ts              # Supabase client (auto-generated)
│       └── types.ts               # Database types (auto-generated)
├── pages/
│   ├── admin/                     # Admin pages
│   │   ├── Users.tsx              # User management
│   │   ├── Roles.tsx              # Role management
│   │   ├── Permissions.tsx        # Permission management
│   │   └── Backups.tsx            # Database backups
│   ├── entry/                     # Data entry pages
│   │   ├── Clients.tsx            # Client management
│   │   ├── Products.tsx           # Product & components management
│   │   ├── Chains.tsx             # Production chains
│   │   └── Defects.tsx            # Defect categories
│   ├── planning/                  # Planning pages
│   │   └── Commandes.tsx          # Order management
│   ├── Auth.tsx                   # Login/Signup page
│   ├── Dashboard.tsx              # Main dashboard
│   ├── Index.tsx                  # Entry point (redirects)
│   └── NotFound.tsx               # 404 page
├── types/
│   └── roles.ts                   # Role type definitions
├── lib/
│   └── utils.ts                   # Utility functions
├── App.tsx                        # Main app with routes
├── main.tsx                       # App entry point
└── index.css                      # Global styles & CSS variables

supabase/
├── config.toml                    # Supabase configuration
├── functions/
│   ├── create-user/               # Create user edge function
│   └── export-database/           # Database export function
└── migrations/                    # Database migrations (read-only)
```

---

## Authentication & Authorization

### Authentication Flow
1. User navigates to `/auth` for login/signup
2. Supabase Auth handles email/password authentication
3. On successful auth, user is redirected to `/` (Dashboard)
4. `useAuth` hook provides user state throughout the app

### Auth Hook Usage
```typescript
import { useAuth } from '@/hooks/useAuth';

const { user, loading, signOut } = useAuth();

if (loading) return <Loading />;
if (!user) return <Navigate to="/auth" />;
```

### User Role Hook Usage
```typescript
import { useUserRole } from '@/hooks/useUserRole';

const { role, loading, isAdmin } = useUserRole();

if (!isAdmin) return <Navigate to="/" />;
```

---

## Database Schema

### Tables Overview

#### 1. `profiles`
Stores user profile information (linked to auth.users).
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key (matches auth.users.id) |
| email | TEXT | User email |
| full_name | TEXT | User's full name |
| created_at | TIMESTAMPTZ | Creation timestamp |
| updated_at | TIMESTAMPTZ | Last update timestamp |

#### 2. `user_roles`
Assigns roles to users.
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | Reference to profiles.id |
| role | app_role | Enum role value |
| created_at | TIMESTAMPTZ | Creation timestamp |

#### 3. `clients`
Stores client information.
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| name | TEXT | Client name |
| designation | TEXT | Client designation |
| instruction | TEXT | General instructions |
| instruction_logistique | TEXT | Logistics instructions |
| created_at | TIMESTAMPTZ | Creation timestamp |
| updated_at | TIMESTAMPTZ | Last update timestamp |

#### 4. `products`
Stores product information.
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| ref_id | VARCHAR | Product reference code |
| product_name | VARCHAR | Product name |
| image_url | VARCHAR | Product image URL |
| created_at | TIMESTAMPTZ | Creation timestamp |
| updated_at | TIMESTAMPTZ | Last update timestamp |

#### 5. `product_components`
Stores components for each product (1 product → many components).
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| product_id | UUID | Foreign key to products.id |
| component_name | VARCHAR | Component name |
| component_code | VARCHAR | Component code |
| quantity | FLOAT | Quantity per product |
| created_at | TIMESTAMPTZ | Creation timestamp |
| updated_at | TIMESTAMPTZ | Last update timestamp |

#### 6. `commandes` (Orders)
Stores order/command information.
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| num_commande | VARCHAR | Order number |
| client_id | UUID | Foreign key to clients.id |
| date_planifiee | DATE | Planned date |
| date_debut | DATE | Start date |
| date_fin | DATE | End date |
| instruction | TEXT | Order instructions |
| created_at | TIMESTAMPTZ | Creation timestamp |
| updated_at | TIMESTAMPTZ | Last update timestamp |

#### 7. `chaines` (Production Chains)
Stores production chain information.
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| num_chaine | INTEGER | Chain number |
| chef_de_chaine_id | UUID | Chain chief user ID |
| responsable_qlty_id | UUID | Quality manager user ID |
| nbr_operateur | INTEGER | Number of operators |
| created_at | TIMESTAMPTZ | Creation timestamp |
| updated_at | TIMESTAMPTZ | Last update timestamp |

#### 8. `defaut_categories` & `defaut_list`
Stores defect categories and defect types.

#### 9. `role_permissions`
Maps roles to menu paths for access control.
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| role | app_role | Role enum |
| menu_path | TEXT | Menu path (e.g., "/admin/users") |
| can_access | BOOLEAN | Access permission |

#### 10. `custom_roles`
Stores custom role definitions.
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| name | TEXT | Role system name |
| label | TEXT | Display label |
| description | TEXT | Role description |
| is_system | BOOLEAN | Whether it's a system role |

### Database Functions

```sql
-- Get user's role
get_user_role(_user_id UUID) RETURNS app_role

-- Check if user has specific role
has_role(_user_id UUID, _role app_role) RETURNS BOOLEAN

-- Auto-update updated_at column
update_updated_at_column() RETURNS TRIGGER

-- Handle new user creation (creates profile + default role)
handle_new_user() RETURNS TRIGGER
```

### App Roles Enum
```sql
CREATE TYPE app_role AS ENUM (
  'admin',
  'planificatrice',
  'responsable_magasin_pf',
  'controle',
  'chef_de_chaine',
  'agent_qualite',
  'chef_equipe_serigraphie',
  'responsable_magasin',
  'chef_equipe_injection',
  'chef_equipe_pf',
  'agent_logistique',
  'agent_magasin',
  'responsable_transport',
  'operator'
);
```

---

## Routes & Pages

### Route Configuration (App.tsx)

| Path | Component | Description | Access |
|------|-----------|-------------|--------|
| `/` | Index → Dashboard | Main dashboard | Authenticated |
| `/auth` | Auth | Login/Signup | Public |
| `/admin/users` | Users | User management | Admin only |
| `/admin/roles` | Roles | Role management | Admin only |
| `/admin/permissions` | Permissions | Permission settings | Admin only |
| `/admin/backups` | Backups | Database backups | Admin only |
| `/entry/clients` | Clients | Client management | Admin, Planificatrice |
| `/entry/products` | Products | Product management | Admin |
| `/entry/chains` | Chains | Production chains | Admin |
| `/entry/defects` | Defects | Defect categories | Admin |
| `/planning/orders` | Commandes | Order management | Admin, Planificatrice |
| `*` | NotFound | 404 page | Public |

---

## Components Architecture

### Layout Components

#### DashboardLayout
Wraps all authenticated pages with sidebar navigation.
```typescript
<DashboardLayout>
  <YourPageContent />
</DashboardLayout>
```

#### AppSidebar
Navigation sidebar with collapsible menu groups based on `menuConfig.ts`.

### Page Pattern
Each data management page follows this pattern:
1. Auth check (redirect if not authenticated)
2. Role check (redirect if not authorized)
3. Data fetching with TanStack Query
4. CRUD operations with mutations
5. Search/filter functionality
6. Table display with actions
7. Dialog forms for create/edit
8. Delete confirmation with AlertDialog

### Example Page Structure
```typescript
export default function EntityPage() {
  // Auth & role checks
  const { user, loading: authLoading } = useAuth();
  const { role, loading: roleLoading, isAdmin } = useUserRole();
  
  // Data fetching
  const { data, isLoading, refetch } = useQuery({...});
  
  // Mutations
  const createMutation = useMutation({...});
  const updateMutation = useMutation({...});
  const deleteMutation = useMutation({...});
  
  // Redirect logic
  if (!user) return <Navigate to="/auth" />;
  if (!isAdmin && role !== 'planificatrice') return <Navigate to="/" />;
  
  return (
    <DashboardLayout>
      <Card>
        {/* Search bar */}
        {/* Data table */}
        {/* Create/Edit dialogs */}
      </Card>
    </DashboardLayout>
  );
}
```

---

## Role-Based Access Control

### Role Labels (French)
```typescript
const ROLE_LABELS = {
  admin: 'Administrateur',
  planificatrice: 'Planificatrice',
  responsable_magasin_pf: 'Responsable Magasin PF',
  controle: 'Contrôle',
  chef_de_chaine: 'Chef de Chaîne',
  agent_qualite: 'Agent Qualité',
  chef_equipe_serigraphie: "Chef d'équipe Sérigraphie",
  responsable_magasin: 'Responsable Magasin',
  chef_equipe_injection: "Chef d'équipe Injection",
  chef_equipe_pf: "Chef d'équipe PF",
  agent_logistique: 'Agent Logistique',
  agent_magasin: 'Agent Magasin',
  responsable_transport: 'Responsable Transport',
  operator: 'Opérateur',
};
```

### RLS Policies Pattern
Each table has Row-Level Security policies:
- **Admin**: Full access (SELECT, INSERT, UPDATE, DELETE)
- **Specific roles**: Limited access based on function
- **Authenticated users**: Often read-only access

---

## Edge Functions

### create-user
Creates a new user with admin privileges.
Location: `supabase/functions/create-user/index.ts`

### export-database
Exports database data for backup purposes.
Location: `supabase/functions/export-database/index.ts`

---

## Getting Started

### Prerequisites
- Node.js 18+
- npm or bun

### Installation
```bash
# Clone the repository
git clone <repo-url>

# Install dependencies
npm install

# Start development server
npm run dev
```

### Environment Variables
The following are environment variables:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`

### Adding New Features

#### Adding a New Page
1. Create component in `src/pages/`
2. Add route in `src/App.tsx`
3. Add menu item in `src/config/menuConfig.ts`
4. Wrap with `DashboardLayout`

#### Adding a New Table
1. Create migration with SQL
2. Include RLS policies
3. Types auto-update in `src/integrations/supabase/types.ts`

#### Adding New Role Permissions
1. Insert into `role_permissions` table
2. Update role checks in page components

---

## Future Development (Planned)

### Phase 4: Workshop & Production Tracking
- Production sessions per chain
- Hourly production entry
- Quality control checks
- Defect tracking per session

### Phase 5: Inventory Management
- Raw material stock
- Finished product inventory
- Stock movements

### Phase 6: Reporting & Analytics
- Production dashboards
- Quality metrics
- Export capabilities

---

## Troubleshooting

### Common Issues

1. **User can't access page**: Check role in `user_roles` table and RLS policies
2. **Data not loading**: Verify RLS policies allow SELECT for user's role
3. **Can't create/update**: Check INSERT/UPDATE RLS policies
4. **Auth redirect loop**: Clear browser storage, check `useAuth` hook

### Useful Queries
```sql
-- Check user's role
SELECT * FROM user_roles WHERE user_id = '<user-id>';

-- Check role permissions
SELECT * FROM role_permissions WHERE role = 'planificatrice';

-- List all users with roles
SELECT p.email, p.full_name, ur.role 
FROM profiles p 
JOIN user_roles ur ON p.id = ur.user_id;
```

---

## Contact & Support

For questions or issues, contact the development team.

**Last Updated**: January 2026
