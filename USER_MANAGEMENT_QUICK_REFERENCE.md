# User Management - Quick Reference

## 🚀 Quick Setup (2 minutes)

### 1. Run Migration
```sql
-- Go to Supabase Dashboard → SQL Editor
-- Create new query and paste this file content:
-- supabase/migrations/20250102000000_create_user_management.sql
-- Click "Run" button
```

### 2. Start App
```bash
npm run dev
```

### 3. Access
Navigate to: **Definições > Gestão de Utilizadores**

## 📋 Menu Navigation

```
Navigation Sidebar
├── Painel de Controlo
├── Fluxo de Design
├── Produção
├── Stocks
├── Gestão
└── Definições ← NEW
    └── Gestão de Utilizadores ← NEW
```

## ✨ Features at a Glance

| Feature | Description | Icon |
|---------|-------------|------|
| NOVO UTILIZADOR | Create new user | Plus |
| EDITAR | Edit user info | Edit2 |
| ELIMINAR | Delete user | Trash2 |
| RECARREGAR | Refresh table | RefreshCw |

## 📝 Create User Form Fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Email | Text | Yes | Must be unique |
| Nome Completo | Text | Yes | Full name |
| Palavra-passe | Password | Yes* | Min 6 chars (*new only) |
| Função | Dropdown | Yes | Select from DB |
| Telemóvel | Phone | No | Optional |
| Notas | Textarea | No | Optional |

## 🎯 User Workflows

### Create User
```
1. Click "NOVO UTILIZADOR"
2. Fill form fields
3. Click "GUARDAR"
4. User created in Auth + Profile saved
```

### Edit User
```
1. Click "Edit" button next to user
2. Update fields (except email)
3. Click "GUARDAR"
4. Changes saved to profile
```

### Delete User
```
1. Click "Delete" button next to user
2. Confirm in dialog
3. User removed from Auth + Profile deleted
```

## 🗄️ Default Roles

```
1. Administrador  → Full access
2. Gestor         → Manage + Reports
3. Designer       → Design flow
4. Utilizador     → Basic access
```

## 💾 Database Tables

### user_roles
```
Stores available roles
├── id (UUID)
├── nome (TEXT)
├── descricao (TEXT)
├── permissoes (JSONB)
└── ativo (BOOLEAN)
```

### user_profiles
```
Stores user information
├── id (UUID)
├── auth_user_id (links to auth.users)
├── email (TEXT, unique)
├── nome_completo (TEXT)
├── role_id (links to user_roles)
├── telemovel (TEXT)
├── notas (TEXT)
└── ativo (BOOLEAN)
```

## 🔧 Common SQL Operations

### View All Users
```sql
SELECT * FROM user_profiles
ORDER BY created_at DESC;
```

### View User with Role
```sql
SELECT p.*, r.nome as role_nome
FROM user_profiles p
LEFT JOIN user_roles r ON p.role_id = r.id
ORDER BY p.created_at DESC;
```

### Update User Role
```sql
UPDATE user_profiles
SET role_id = 'role-uuid'
WHERE email = 'user@example.com';
```

### Deactivate User
```sql
UPDATE user_profiles
SET ativo = false
WHERE email = 'user@example.com';
```

### Delete User Profile
```sql
DELETE FROM user_profiles
WHERE email = 'user@example.com';
```

### Add New Role
```sql
INSERT INTO user_roles (nome, descricao, permissoes, ativo)
VALUES ('Operador', 'Warehouse operator', '{"warehouse": true}'::jsonb, true);
```

## 🎨 Component Files

| File | Purpose |
|------|---------|
| `app/definicoes/utilizadores/page.tsx` | Main page |
| `components/forms/CreateUserForm.tsx` | Create/Edit form |
| `components/UsersList.tsx` | User table display |
| `components/Navigation.tsx` | Menu (updated) |
| `utils/userManagement.ts` | Helper functions |
| `components/ui/DatePicker.tsx` | Date selector |

## 📞 Useful Functions (from utils/userManagement.ts)

```typescript
// Import from utils/userManagement.ts

import {
  createUser,
  updateUserProfile,
  getUserProfile,
  getAllUserProfiles,
  getAllRoles,
  deleteUser,
  userHasRole,
  userHasPermission,
  searchUsers,
  deactivateUser,
  reactivateUser,
  validatePassword,
  validateEmail
} from '@/utils/userManagement'

// Usage examples:
const user = await getUserProfile(authUserId)
const roles = await getAllRoles()
const hasAdmin = await userHasRole(userId, 'Administrador')
```

## 🐛 Troubleshooting

### Menu item not showing?
```
1. Check Navigation.tsx updated
2. Restart app (npm run dev)
3. Hard refresh browser (Ctrl+F5)
```

### Can't create user?
```
1. Check migration ran in Supabase
2. Verify user_roles table exists
3. Check browser console for errors
4. Verify .env.local has Supabase keys
```

### Users not showing in list?
```
1. Click "RECARREGAR" button
2. Check RLS policies in Supabase
3. Verify auth.users records exist
4. Check network tab in dev tools
```

### Delete button doesn't work?
```
1. Check RLS policy for DELETE on user_profiles
2. Verify CASCADE delete configured
3. Try from Supabase dashboard directly
```

## 📊 User Table Columns

| Column | Type | Visible |
|--------|------|---------|
| Nome Completo | TEXT | ✅ |
| Email | TEXT | ✅ |
| Função | JOIN | ✅ |
| Telemóvel | TEXT | ✅ |
| Data Criação | TIMESTAMP | ✅ |
| Ações | BUTTONS | ✅ |
| Notas | TEXT | ❌ Modal |
| Ativo | BOOLEAN | ❌ Backend |

## ⌨️ Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Focus email input | Tab |
| Submit form | Enter (in form) |
| Cancel dialog | Escape |
| Collapse sidebar | - |

## 🔐 Permission System

```javascript
// Permission structure in user_roles.permissoes
{
  "all": true                          // Full access
  "manage_users": true                 // User management
  "view_reports": true                 // Report viewing
  "design_flow": true                  // Design access
  "view_basic": true                   // Basic viewing
  "warehouse": true                    // Warehouse ops
  "edit_inventory": true               // Inventory edit
}
```

## 📱 Responsive Behavior

| Device | Layout |
|--------|--------|
| Mobile < 640px | Single column, horizontal scroll on table |
| Tablet 640-1024px | Two columns, table visible |
| Desktop > 1024px | Full layout, all visible |

## 🎯 Validation Rules

```
Email:
  - Must be unique
  - Must be valid email format
  - Example: user@example.com

Password (on create):
  - Minimum 6 characters
  - Can use any characters
  - Stored securely in Supabase Auth

Nome Completo:
  - Any text allowed
  - No length limit (text type)

Função:
  - Must select from dropdown
  - Must exist in user_roles table

Telemóvel:
  - Optional
  - Any format (no validation)
  - Example: +351 XXX XXX XXX
```

## 🔄 Data Flow

```
User Management Page
    ↓
CreateUserForm (or edit)
    ↓
userManagement.ts utilities
    ↓
Supabase Client
    ↓
├── auth.signUp() → Auth users table
└── insert/update → user_profiles table
    ↓
UsersList displays updated data
```

## 🎓 Learning Resources

1. **Supabase Auth**: supabase.com/docs/guides/auth
2. **Row Level Security**: supabase.com/docs/guides/auth/row-level-security
3. **Radix UI**: radix-ui.com/docs/primitives
4. **Next.js**: nextjs.org/docs
5. **TypeScript**: typescriptlang.org/docs

## ✅ Implementation Checklist

- [x] Navigation menu updated
- [x] Database tables created
- [x] User management page built
- [x] Create user form created
- [x] Users list component built
- [x] Utility functions added
- [x] Documentation written
- [x] Design system compliance
- [x] Error handling implemented
- [x] Loading states added
- [x] Responsive design verified

## 📞 Getting Help

1. Check `USER_MANAGEMENT_SETUP.md` for detailed guide
2. Review component code comments
3. Check browser console for errors
4. Verify Supabase configuration
5. Review React/Next.js docs

## 🎉 You're All Set!

Your user management system is ready to use. Start by:
1. Running the migration
2. Creating your first user
3. Assigning roles and permissions
4. Managing users through the UI
