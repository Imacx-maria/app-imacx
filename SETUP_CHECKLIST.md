# User Management Setup Checklist

## ✅ Pre-Setup Requirements

- [ ] Supabase project created and configured
- [ ] Supabase URL in environment variables
- [ ] Supabase anonymous key in environment variables
- [ ] Node.js 18+ installed
- [ ] Project dependencies installed (`npm install`)
- [ ] App running locally (`npm run dev`)

## ✅ Database Setup

### Phase 1: Migration

- [ ] Open Supabase Dashboard
- [ ] Navigate to SQL Editor
- [ ] Create new query
- [ ] Copy migration file content:
  - File: `supabase/migrations/20250102000000_create_user_management.sql`
- [ ] Paste SQL into query editor
- [ ] Click "Run" button
- [ ] Verify migration completed successfully
- [ ] Check in Table Editor that both tables exist:
  - [ ] `user_roles` table visible
  - [ ] `user_profiles` table visible

### Phase 2: Verify Tables

- [ ] Navigate to Table Editor
- [ ] Expand `user_roles` table
  - [ ] 4 default roles visible
  - [ ] Columns correct (id, nome, descricao, etc.)
- [ ] Expand `user_profiles` table
  - [ ] Columns correct (id, auth_user_id, email, etc.)
  - [ ] Foreign key to auth.users visible
  - [ ] Foreign key to user_roles visible

### Phase 3: Check RLS Policies

- [ ] Select `user_roles` table
- [ ] Verify RLS enabled
  - [ ] At least 2 policies visible
  - [ ] "SELECT" policy for authenticated
  - [ ] "ALL" policy for management
- [ ] Select `user_profiles` table
- [ ] Verify RLS enabled
  - [ ] At least 4 policies visible
  - [ ] "SELECT" policies visible
  - [ ] "UPDATE" policy visible
  - [ ] "DELETE" policy visible
  - [ ] "INSERT" policy visible

## ✅ Code Files Verification

### Components

- [ ] `app/definicoes/utilizadores/page.tsx` exists
  - [ ] Component renders without errors
  - [ ] Imports correct
  - [ ] Supabase client initialized
- [ ] `components/forms/CreateUserForm.tsx` exists
  - [ ] Form fields present
  - [ ] Validation logic present
  - [ ] Supabase Auth integration present
- [ ] `components/UsersList.tsx` exists
  - [ ] Table structure present
  - [ ] Edit/Delete buttons present
  - [ ] Dialog for confirmation present
- [ ] `components/ui/DatePicker.tsx` exists
  - [ ] Bug fix applied
  - [ ] Uses Popover + Calendar

### Utilities

- [ ] `utils/userManagement.ts` exists
  - [ ] All 12+ functions present
  - [ ] TypeScript types defined
  - [ ] Error handling present
  - [ ] Supabase client usage correct

### Navigation

- [ ] `components/Navigation.tsx` updated
  - [ ] "Definições" menu item added
  - [ ] "Gestão de Utilizadores" submenu added
  - [ ] Correct route: `/definicoes/utilizadores`
  - [ ] Settings and Users icons used

### Database

- [ ] `supabase/migrations/20250102000000_create_user_management.sql` exists
  - [ ] Migration file readable
  - [ ] SQL syntax correct
  - [ ] All tables and policies present

## ✅ Application Testing

### Startup

- [ ] Start app: `npm run dev`
  - [ ] No build errors
  - [ ] No TypeScript errors
  - [ ] App compiles successfully
  - [ ] Dev server running on http://localhost:3000

### Navigation

- [ ] App loads in browser
  - [ ] Sidebar visible
  - [ ] "Definições" menu visible
  - [ ] Menu can be expanded
  - [ ] "Gestão de Utilizadores" submenu visible
  - [ ] Submenu clickable

### Page Access

- [ ] Click "Gestão de Utilizadores"
  - [ ] Page loads: `/definicoes/utilizadores`
  - [ ] Page title visible: "GESTÃO DE UTILIZADORES"
  - [ ] Page description visible
  - [ ] "NOVO UTILIZADOR" button visible
  - [ ] Empty state message or user list visible

## ✅ Feature Testing

### Create User

- [ ] Click "NOVO UTILIZADOR"
  - [ ] Dialog opens
  - [ ] Form fields visible:
    - [ ] Email input
    - [ ] Nome Completo input
    - [ ] Palavra-passe input
    - [ ] Função dropdown
    - [ ] Telemóvel input
    - [ ] Notas textarea
  - [ ] GUARDAR button visible
  - [ ] CANCELAR button visible

### Create User - Success Flow

- [ ] Fill all required fields:
  - [ ] Email: `test@example.com`
  - [ ] Nome Completo: `Test User`
  - [ ] Palavra-passe: `password123`
  - [ ] Função: Select "Utilizador"
- [ ] Fill optional fields:
  - [ ] Telemóvel: `+351 912 345 678`
  - [ ] Notas: `Test user for QA`
- [ ] Click GUARDAR
  - [ ] Form disables (loading state)
  - [ ] Success message appears (optional)
  - [ ] Dialog closes
  - [ ] User appears in table
  - [ ] User data correct in table

### Create User - Validation

- [ ] Try submit empty form
  - [ ] Error for missing email
  - [ ] Error for missing name
  - [ ] Error for missing password
  - [ ] Error for missing role
- [ ] Enter invalid email
  - [ ] Error message for invalid format
  - [ ] Form doesn't submit
- [ ] Enter short password (<6 chars)
  - [ ] Error message shown
  - [ ] Form doesn't submit

### View Users

- [ ] Table displays all users
  - [ ] Headers visible: Nome, Email, Função, Telemóvel, Data Criação, Ações
  - [ ] All user data correct
  - [ ] Edit buttons visible (✏️)
  - [ ] Delete buttons visible (❌)
- [ ] Hover on table row
  - [ ] Background color changes (light/dark mode)
  - [ ] Buttons remain visible

### Edit User

- [ ] Click Edit button on user
  - [ ] Dialog opens
  - [ ] Form title: "EDITAR UTILIZADOR"
  - [ ] Email field disabled/grayed out
  - [ ] Password field not shown
  - [ ] Other fields populated with user data
- [ ] Update a field (e.g., Nome Completo)
  - [ ] Field updates visually
- [ ] Click GUARDAR
  - [ ] Dialog closes
  - [ ] Table updates with new data
  - [ ] Change persists on refresh

### Edit User - Validation

- [ ] Try to edit nome completo with empty value
  - [ ] Error message shown
  - [ ] Form doesn't submit
- [ ] Try to edit to empty role
  - [ ] Error message shown
  - [ ] Form doesn't submit

### Delete User

- [ ] Click Delete button on user
  - [ ] Confirmation dialog opens
  - [ ] Shows user name being deleted
  - [ ] "CANCELAR" button visible
  - [ ] "ELIMINAR" button visible (red)
- [ ] Click "CANCELAR"
  - [ ] Dialog closes
  - [ ] User still in table
  - [ ] No change made
- [ ] Click Delete button again
  - [ ] Dialog opens
- [ ] Click "ELIMINAR"
  - [ ] Dialog closes
  - [ ] User removed from table
  - [ ] Success feedback (optional)
  - [ ] User no longer visible

### Refresh Button

- [ ] Click "RECARREGAR"
  - [ ] Loading state shows (optional)
  - [ ] Table refreshes
  - [ ] All users still displayed
  - [ ] Latest data loaded from database

## ✅ Responsive Testing

### Mobile (< 640px)

- [ ] Resize browser to mobile width
- [ ] Page layout adjusts
  - [ ] Single column
  - [ ] Sidebar collapses
  - [ ] Buttons stack
  - [ ] Table scrolls horizontally
- [ ] All buttons clickable
- [ ] Dialog responsive

### Tablet (640px - 1024px)

- [ ] Resize browser to tablet width
- [ ] Layout adapts
  - [ ] Two column possible
  - [ ] Sidebar visible or toggle works
  - [ ] Table readable
- [ ] All features work

### Desktop (> 1024px)

- [ ] Full width view
  - [ ] All columns visible
  - [ ] Sidebar expanded
  - [ ] Full table with all data
  - [ ] No horizontal scroll needed

## ✅ Dark Mode Testing

- [ ] Toggle theme to dark mode
  - [ ] Colors change correctly
  - [ ] Text readable
  - [ ] Buttons visible
  - [ ] Icons visible
  - [ ] No color contrast issues
- [ ] Toggle theme to light mode
  - [ ] Colors revert
  - [ ] All visible again
- [ ] Test in both modes:
  - [ ] Table hover states
  - [ ] Form styling
  - [ ] Dialogs
  - [ ] Buttons

## ✅ Error Handling Testing

### Network Errors

- [ ] Disconnect from internet (dev tools)
- [ ] Try to load users
  - [ ] Error message appears
  - [ ] Graceful error handling
- [ ] Try to create user
  - [ ] Error message appears
  - [ ] Form doesn't break
- [ ] Reconnect internet
- [ ] Click Refresh
  - [ ] Data loads successfully

### Form Errors

- [ ] Try to create user with existing email
  - [ ] Error: "Email já existe"
  - [ ] Form doesn't submit
- [ ] Try to create with duplicate email
  - [ ] Same error handling
- [ ] Try incomplete form
  - [ ] Required field errors

### Database Errors

- [ ] Check browser console
  - [ ] No JavaScript errors
  - [ ] No TypeScript errors
  - [ ] All imports resolved
- [ ] Check network tab
  - [ ] Supabase calls successful
  - [ ] Status codes correct (200, 201, etc.)
  - [ ] No 5xx errors

## ✅ Performance Testing

- [ ] Page load time acceptable
  - [ ] Sidebar loads quickly
  - [ ] Page visible in <2s
- [ ] User table loads quickly
  - [ ] No lag or stutter
  - [ ] Smooth scrolling
- [ ] Create user form responsive
  - [ ] No input lag
  - [ ] Form submission fast
- [ ] Refresh works quickly
  - [ ] Reloads in <1s

## ✅ Accessibility Testing

### Keyboard Navigation

- [ ] Tab through form fields
  - [ ] Focus visible
  - [ ] Logical order
  - [ ] All elements reachable
- [ ] Press Enter to submit form
  - [ ] Form submits
- [ ] Press Escape in dialog
  - [ ] Dialog closes
- [ ] Tab to buttons
  - [ ] All buttons reachable
  - [ ] Focus visible

### Screen Reader (NVDA/JAWS)

- [ ] Headings announced correctly
- [ ] Form labels announced
- [ ] Buttons announced with labels
- [ ] Dialogs announced with title
- [ ] Errors announced clearly
- [ ] Table headers announced
- [ ] Table data announced correctly

### Color Contrast

- [ ] Light mode: Black text on light beige
  - [ ] Contrast ratio > 12:1
  - [ ] WCAG AAA
- [ ] Dark mode: Light text on dark gray
  - [ ] Contrast ratio > 7:1
  - [ ] WCAG AA
- [ ] All text readable
- [ ] No color-only indicators

## ✅ Browser Testing

Test in each supported browser:

- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

For each browser:
- [ ] Page loads
- [ ] All features work
- [ ] Styling correct
- [ ] No console errors
- [ ] Performance acceptable

## ✅ Integration Testing

- [ ] User created in Supabase Auth
  - [ ] Check in Auth users list
  - [ ] Email correct
- [ ] User profile in database
  - [ ] Check in Table Editor
  - [ ] Data matches form
  - [ ] Link to Auth correct
- [ ] Role assigned correctly
  - [ ] Role shows in table
  - [ ] Matches selected role
- [ ] User can log in with new password
  - [ ] Login works
  - [ ] Session created

## ✅ Security Testing

- [ ] Password not visible in form
  - [ ] Masked input dots
- [ ] Password not logged
  - [ ] Check console
- [ ] Email unique
  - [ ] Can't create duplicate email
- [ ] Unauthorized users can't access
  - [ ] Not logged in → login required
  - [ ] Check RLS policies work
- [ ] Permissions enforced
  - [ ] Check Auth user is required
  - [ ] Check session required

## ✅ Documentation Review

- [ ] USER_MANAGEMENT_SETUP.md
  - [ ] Complete and clear
  - [ ] All steps accurate
  - [ ] No missing information
- [ ] USER_MANAGEMENT_QUICK_REFERENCE.md
  - [ ] Quick and easy to reference
  - [ ] All common tasks covered
- [ ] USER_MANAGEMENT_IMPLEMENTATION.md
  - [ ] Technical details correct
  - [ ] API reference complete
- [ ] USER_MANAGEMENT_UI_GUIDE.md
  - [ ] Visual guide accurate
  - [ ] All states covered
- [ ] DEFINICOES_README.md
  - [ ] Module overview clear
  - [ ] Features documented
- [ ] Code comments
  - [ ] Components have comments
  - [ ] Complex logic explained
  - [ ] Types documented

## ✅ Team Communication

- [ ] Team trained on new system
- [ ] Documentation shared
- [ ] Questions answered
- [ ] Feedback collected
- [ ] Future improvements noted

## ✅ Production Readiness

- [ ] Code review completed
- [ ] All tests pass
- [ ] No console errors
- [ ] Performance acceptable
- [ ] Security audit passed
- [ ] Documentation complete
- [ ] Backup configured
- [ ] Monitoring setup
- [ ] Error tracking enabled
- [ ] Team ready

## 🎯 Final Verification

- [ ] Build successful: `npm run build`
- [ ] Lint passes: `npm run lint`
- [ ] No TypeScript errors
- [ ] No runtime errors
- [ ] All features work end-to-end
- [ ] Mobile responsive
- [ ] Dark mode works
- [ ] Accessible
- [ ] Database queries efficient
- [ ] Error handling complete

## 🎉 Go Live!

Once all checkboxes are checked:

1. ✅ Final code review
2. ✅ Deploy to staging
3. ✅ Final testing in staging
4. ✅ Deploy to production
5. ✅ Monitor for errors
6. ✅ Celebrate! 🎊

## 📝 Sign Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Developer | | | |
| QA | | | |
| Product Owner | | | |
| Deployment Lead | | | |

## 📞 Support Contacts

| Issue | Contact | Phone |
|-------|---------|-------|
| Technical | Dev Team | |
| Database | DBA | |
| Support | Support Team | |

## 🚀 You're Ready!

All items checked? You're ready for:
- ✅ Production deployment
- ✅ Team usage
- ✅ Feature request integration
- ✅ Continuous improvement

---

**Checklist Version**: 1.0
**Last Updated**: October 2025
**Status**: Ready for Production ✅
