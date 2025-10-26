# User Management System - Setup Guide

## Overview

The user management system allows you to create and manage users with profiles and roles directly from Supabase Authentication. It's accessible via the **Definições > Gestão de Utilizadores** menu.

## Features

- ✅ Create new users with Supabase Auth
- ✅ Assign user profiles with full information (name, phone, role)
- ✅ Manage user roles and permissions
- ✅ Edit user information
- ✅ Delete users from the system
- ✅ View user list with creation dates

## Database Setup

### 1. Run Migrations

The system requires two new tables: `user_roles` and `user_profiles`.

**Run the migration:**
```bash
# Navigate to your Supabase project
# Run this SQL in the SQL editor:
```

The migration file is located at:
`supabase/migrations/20250102000000_create_user_management.sql`

This creates:
- **user_roles** table: Stores role definitions (Admin, Gestor, Designer, Utilizador)
- **user_profiles** table: Stores user profile information linked to Supabase Auth users

### 2. Default Roles Created

The migration automatically creates 4 default roles:

| Role | Description | Permissions |
|------|-------------|-------------|
| Administrador | Full system access | `{"all": true}` |
| Gestor | Manager with reports access | `{"manage_users": true, "view_reports": true}` |
| Designer | Design flow access | `{"design_flow": true}` |
| Utilizador | Basic user access | `{"view_basic": true}` |

## Components Created

### 1. **app/definicoes/utilizadores/page.tsx**
Main user management page that displays the user list and handles creation/editing/deletion.

**Features:**
- Load users from database
- Display users in table format
- Open dialog to create new user
- Edit existing users
- Delete users with confirmation

### 2. **components/forms/CreateUserForm.tsx**
Form component for creating and editing users.

**Form Fields:**
- **Email** - User email (disabled when editing)
- **Nome Completo** - Full name
- **Palavra-passe** - Password (only for new users, min 6 characters)
- **Função** - Role selection dropdown
- **Telemóvel** - Phone number (optional)
- **Notas** - Additional notes (optional)

**Validation:**
- Email, name, and role are required
- Password required for new users
- Email must be unique (Supabase will enforce)

### 3. **components/UsersList.tsx**
Component to display all users in a table format.

**Columns:**
- Nome Completo
- Email
- Função (Role)
- Telemóvel
- Data Criação
- Ações (Edit/Delete buttons)

**Features:**
- Sortable table
- Edit/Delete buttons
- Refresh button
- Delete confirmation dialog
- Hover states

## How to Use

### Create a New User

1. Navigate to **Definições > Gestão de Utilizadores**
2. Click **NOVO UTILIZADOR** button
3. Fill in the form:
   - Email
   - Nome Completo
   - Palavra-passe (min 6 characters)
   - Função (select from dropdown)
   - Telemóvel (optional)
   - Notas (optional)
4. Click **GUARDAR**

The user will be created in Supabase Auth and a profile will be linked in the database.

### Edit a User

1. Click the **Edit** button next to the user
2. Update the fields (except email which is locked)
3. Click **GUARDAR**

### Delete a User

1. Click the **Delete** button next to the user
2. Confirm the deletion in the dialog
3. User will be removed from both Auth and user_profiles table

### Manage Roles

To add/modify roles, access the Supabase SQL editor and edit the `user_roles` table:

```sql
-- Add a new role
INSERT INTO user_roles (nome, descricao, permissoes, ativo)
VALUES ('Operador', 'Warehouse operator', '{"warehouse": true}'::jsonb, true);

-- Update role permissions
UPDATE user_roles
SET permissoes = '{"manage_users": true, "view_reports": true, "edit_inventory": true}'::jsonb
WHERE nome = 'Gestor';

-- Deactivate a role
UPDATE user_roles SET ativo = false WHERE nome = 'Utilizador';
```

## Database Schema

### user_roles Table
```sql
{
  id: UUID (Primary Key)
  nome: TEXT (Unique) - Role name
  descricao: TEXT - Role description
  permissoes: JSONB - Permissions object
  ativo: BOOLEAN - Is role active
  created_at: TIMESTAMP
  updated_at: TIMESTAMP
}
```

### user_profiles Table
```sql
{
  id: UUID (Primary Key)
  auth_user_id: UUID (Foreign Key to auth.users)
  email: TEXT (Unique)
  nome_completo: TEXT
  role_id: UUID (Foreign Key to user_roles)
  telemovel: TEXT (Optional)
  notas: TEXT (Optional)
  ativo: BOOLEAN
  created_at: TIMESTAMP
  updated_at: TIMESTAMP
}
```

## Row Level Security (RLS)

The system uses RLS policies to protect data:

- **user_roles**: All authenticated users can read; admin can manage
- **user_profiles**: Users can read their own profile; authenticated users can read all profiles; users can update their own profile

**Important:** For production, you should implement role-based access control (RBAC) by checking user roles in RLS policies.

## API Integration

The components use the following Supabase client functions:

```typescript
// Create user via Auth
await supabase.auth.signUp({
  email: email,
  password: password,
  options: { data: { nome_completo: name } }
})

// Get user profiles with roles
const { data } = await supabase
  .from('user_profiles')
  .select(`
    *,
    role:role_id (id, nome)
  `)

// Update user profile
await supabase
  .from('user_profiles')
  .update({ /* fields */ })
  .eq('auth_user_id', userId)

// Delete user profile
await supabase
  .from('user_profiles')
  .delete()
  .eq('auth_user_id', userId)
```

## Navigation Integration

The menu item is automatically added to the navigation sidebar:
- Menu: **Definições**
- Submenu: **Gestão de Utilizadores**
- Route: `/definicoes/utilizadores`

The navigation uses the design system styling (uppercase, custom colors, etc).

## Troubleshooting

### Issue: "Error loading roles"
- **Cause**: Supabase migration not run
- **Solution**: Run the migration SQL file in Supabase dashboard

### Issue: "Erro ao carregar utilizadores"
- **Cause**: RLS policy issue or no user_profiles records
- **Solution**: Check Supabase logs and verify RLS policies are correctly set

### Issue: "Error: Email already in use"
- **Cause**: Email exists in another record
- **Solution**: Use a unique email address

### Issue: User created but profile not visible
- **Cause**: Auth user created but profile insertion failed
- **Solution**: Check database constraints and try editing the user to create profile

## Future Enhancements

Consider implementing:
- [ ] Bulk user import (CSV)
- [ ] Password reset functionality
- [ ] User activity logs
- [ ] Advanced RBAC with permission management UI
- [ ] User deactivation instead of hard delete
- [ ] Email verification
- [ ] Two-factor authentication
- [ ] User groups/teams
- [ ] Department management
- [ ] User search and filtering

## Security Notes

1. **Passwords**: Only admins should see/reset passwords through UI
2. **Permissions**: Implement proper RBAC checks in RLS policies
3. **Audit**: Log all user management changes
4. **Access**: Restrict user management to admins only (add role check in RLS)
5. **Email verification**: Consider enabling email verification in Supabase Auth settings

## Support

For issues or questions:
1. Check Supabase dashboard logs
2. Verify all components are in correct directories
3. Ensure database tables exist with correct schema
4. Check browser console for JavaScript errors
