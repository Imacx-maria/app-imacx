# Definições - Settings Module

## Overview

The **Definições** (Settings) module provides system administration features including user management, roles, and permissions.

## 🎯 What's Included

### User Management (Gestão de Utilizadores)

Complete user management system with:
- Create users with Supabase Authentication
- Assign profiles with full contact information
- Manage user roles and permissions
- Edit user details
- Delete users with cascade
- View user activity history

## 📂 File Structure

```
definicoes/
├── utilizadores/
│   └── page.tsx                          # Main user management page
├── stocks/
│   └── ...                              # Existing stocks settings
```

## 🚀 Getting Started

### Prerequisites
- Supabase project configured
- Environment variables set (.env.local)
- Database tables created (run migration)

### Step 1: Run Migration
```bash
# In Supabase Dashboard → SQL Editor:
# 1. Create new query
# 2. Copy content from: supabase/migrations/20250102000000_create_user_management.sql
# 3. Execute query
```

### Step 2: Access Feature
1. Start app: `npm run dev`
2. Navigate to: **Definições > Gestão de Utilizadores**
3. Create your first user

## 🎨 Component Structure

### Main Page: `app/definicoes/utilizadores/page.tsx`
- Loads and displays user list
- Handles user creation dialog
- Manages edit/delete operations
- Provides refresh functionality

### Form Component: `components/forms/CreateUserForm.tsx`
- Handles user creation and editing
- Integrates with Supabase Auth
- Validates all inputs
- Shows loading/error states

### List Component: `components/UsersList.tsx`
- Displays users in table format
- Provides edit/delete buttons
- Shows user metadata
- Responsive design

## 💾 Database Schema

### user_roles
```
id         UUID Primary Key
nome       TEXT (unique) - Role name
descricao  TEXT - Description
permissoes JSONB - Permission structure
ativo      BOOLEAN - Active status
created_at TIMESTAMP
updated_at TIMESTAMP
```

**Default Roles:**
- Administrador (Full access)
- Gestor (Manager privileges)
- Designer (Design flow access)
- Utilizador (Basic access)

### user_profiles
```
id           UUID Primary Key
auth_user_id UUID (Foreign Key) - Links to auth.users
email        TEXT (unique)
nome_completo TEXT - Full name
role_id      UUID (Foreign Key) - Links to user_roles
telemovel    TEXT - Phone number
notas        TEXT - Notes
ativo        BOOLEAN
created_at   TIMESTAMP
updated_at   TIMESTAMP
```

## 🔑 Features

### Create User
- Email (unique validation)
- Full name
- Password (6+ chars)
- Role selection
- Phone number (optional)
- Notes (optional)

### Edit User
- Update name, role, phone, notes
- Email cannot be changed
- Password managed through Auth

### Delete User
- Soft confirmation dialog
- Cascades to auth and profiles tables
- Cannot be undone

### View Users
- Table with sorting
- Shows all user information
- Real-time updates
- Refresh button

## 🔐 Security

### Row Level Security (RLS)
- All tables protected with RLS policies
- Authenticated users can read profiles
- Users can edit their own profile
- Admin operations protected

### Authentication
- Uses Supabase Auth
- Passwords stored securely
- Auth session management
- User verification

### Data Validation
- Email format validation
- Password strength requirements
- Required field checking
- Unique constraint enforcement

## 🎯 Use Cases

### Scenario 1: Company Onboarding
```
1. HR creates new user account
2. Sets role based on department
3. User receives login credentials
4. User logs in and completes profile
```

### Scenario 2: Role Change
```
1. Manager clicks Edit on user
2. Changes role dropdown
3. Saves changes
4. New role takes effect immediately
```

### Scenario 3: User Removal
```
1. Click Delete button
2. Confirm removal
3. User removed from all tables
4. User cannot log in
```

## 📊 Data Flow

```
User Interface
      ↓
CreateUserForm / UsersList
      ↓
userManagement.ts utilities
      ↓
Supabase Client
      ↓
├── Auth (auth.signUp/delete)
└── Database (insert/update/delete)
      ↓
Real-time Updates
      ↓
Table Refresh
```

## 🛠️ Development

### Adding to Definições
To add new settings pages:

```bash
# 1. Create page directory
mkdir app/definicoes/nova-secao

# 2. Create page component
touch app/definicoes/nova-secao/page.tsx

# 3. Add menu item to Navigation.tsx
# Add submenu item to Definições section

# 4. Create components as needed
```

### Menu Structure
Edit `components/Navigation.tsx`:
```typescript
{
  title: 'Definições',
  icon: <Settings className="h-5 w-5" />,
  submenu: [
    { title: 'Gestão de Utilizadores', href: '/definicoes/utilizadores', icon: <Users className="h-4 w-4" /> },
    { title: 'Nova Página', href: '/definicoes/nova', icon: <Icon className="h-4 w-4" /> },
  ],
}
```

## 📚 Documentation

| Document | Purpose |
|----------|---------|
| USER_MANAGEMENT_SETUP.md | Complete setup guide |
| USER_MANAGEMENT_IMPLEMENTATION.md | Implementation details |
| USER_MANAGEMENT_QUICK_REFERENCE.md | Quick reference |
| utils/userManagement.ts | Function documentation |

## 🔗 Dependencies

### UI Components (from `components/ui/`)
- Button
- Input
- Label
- Select
- Textarea
- Dialog
- Table
- Popover
- Calendar

### Libraries
- @supabase/supabase-js
- @radix-ui/*
- lucide-react
- date-fns

### Custom Utilities
- utils/userManagement.ts
- utils/supabase.ts

## ⚙️ Configuration

### Environment Variables
```
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### Supabase Settings
- Authentication: Email/Password enabled
- RLS: Enabled on all tables
- Policies: Configured per table

## 🐛 Troubleshooting

### Menu not visible
- Restart dev server
- Hard refresh browser
- Check Navigation.tsx

### Can't create user
- Verify migration ran
- Check user_roles table exists
- Review browser console

### Users not loading
- Click Refresh button
- Check RLS policies
- Verify auth session

## 🎓 Learning Resources

1. **Supabase Documentation**: docs.supabase.com
2. **Next.js Guide**: nextjs.org/learn
3. **React Hooks**: react.dev/reference/react/hooks
4. **TypeScript**: typescriptlang.org/docs

## 🔄 Future Enhancements

- [ ] Bulk user import
- [ ] Password reset UI
- [ ] Activity logging
- [ ] Advanced RBAC UI
- [ ] User groups
- [ ] Department management
- [ ] Custom roles creation
- [ ] Email verification
- [ ] Two-factor auth

## 📞 Support

For help with:
- **Setup Issues**: See USER_MANAGEMENT_SETUP.md
- **Usage Questions**: See USER_MANAGEMENT_QUICK_REFERENCE.md
- **Implementation Details**: See USER_MANAGEMENT_IMPLEMENTATION.md
- **API Reference**: See utils/userManagement.ts

## ✅ Checklist for Production

- [ ] RLS policies reviewed and secured
- [ ] Backup database configured
- [ ] Email verification enabled
- [ ] Password policy configured
- [ ] Audit logging implemented
- [ ] Admin role restrictions applied
- [ ] Error handling tested
- [ ] Load testing completed
- [ ] Security audit passed
- [ ] Documentation updated

## 🎉 Ready to Use!

Your Definições module is complete and ready for use. Start managing users immediately through the Gestão de Utilizadores interface.

---

**Version**: 1.0.0  
**Last Updated**: October 2025  
**Maintainer**: Development Team
