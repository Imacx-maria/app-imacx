# Security Incident Report: Mixed Supabase Project Credentials

**Date:** 2025-10-26  
**Severity:** CRITICAL  
**Status:** INVESTIGATED & MITIGATED

---

## Executive Summary

A critical security issue was discovered where two different Supabase projects' credentials were being mixed during application runtime:
- **Expected Project:** `bnfixjkjrbfalgcqhzof` (in `.env.local` file)
- **Actually Loaded:** `ocajcjdlrmbmfiirxndn` (at runtime)

This represents a serious data security breach where client credentials from different projects could be inadvertently mixed.

---

## Timeline

### Initial Discovery
- **Time:** 2025-10-26 ~20:00
- **Symptom:** Login failing with "Invalid login credentials"
- **Investigation:** Browser DevTools showed requests going to wrong Supabase project

### Root Cause Analysis
- `.env.local` file contained correct credentials for `bnfixjkjrbfalgcqhzof`
- Runtime environment was loading credentials for `ocajcjdlrmbmfiirxndn`
- Node.js `dotenv` package appeared to be loading from unknown source

---

## Investigation Findings

### 1. File System Analysis
**Checked:**
- ✅ System environment variables (User & Machine level) - **None found**
- ✅ `.env.local` file content - **Correct values present**
- ✅ Parent directory .env files - **None found**
- ✅ IDE settings (.vscode, .cursor) - **No env injection found**
- ✅ Multiple projects on same machine - **Multiple Supabase projects found**

**Projects Found on Machine:**
- `bnfixjkjrbfalgcqhzof` - IMACX Production (correct)
- `ocajcjdlrmbmfiirxndn` - Unknown project (WRONG - source of contamination)
- `macibvbokjobzppestna` - Ferias project
- `nrgmmhqyzfzfzpzquzpl` - FSC Gestao project

### 2. dotenv Package Behavior
- Reading `.env.local` directly showed **CORRECT** values
- Loading via `dotenv` package showed **WRONG** values
- Suggests environment variable precedence issue or cached values

### 3. Key Findings
```
File Content (.env.local):
  URL: https://bnfixjkjrbfalgcqhzof.supabase.co
  JWT ref: bnfixjkjrbfalgcqhzof

Runtime (via dotenv):
  URL: https://ocajcjdlrmbmfiirxndn.supabase.co
  JWT ref: ocajcjdlrmbmfiirxndn
```

---

## Root Cause (Suspected)

The exact source of `ocajcjdlrmbmfiirxndn` credentials could not be definitively identified, but possible causes:

1. **PowerShell Session Variables**: Previous commands may have set session-level environment variables that persist
2. **Node Process Cache**: Node.js process might have cached environment variables from previous runs
3. **IDE Environment Injection**: VS Code/Cursor might inject environment from another project
4. **Workspace Settings**: Multi-project workspace might be mixing environments
5. **NPM/PNPM Configuration**: Package manager might have stored environment variables

---

## Immediate Actions Taken

### 1. Runtime Security Guards
Added verification in `utils/supabase.ts`:
```typescript
const EXPECTED_PROJECT_ID = 'bnfixjkjrbfalgcqhzof'

// Verify JWT matches expected project before creating client
// Throws error if mismatch detected
```

### 2. Environment Verification Script
Created `scripts/verify_env.js` to check:
- Environment variable values
- JWT payload contents
- URL/Key consistency

### 3. Clean Startup Script
Created `start_clean.bat` to:
- Clear all Supabase environment variables
- Verify clean state
- Start dev server with clean environment

### 4. Process Cleanup
- Killed all Node.js processes
- Cleared Next.js build cache
- Cleared node_modules cache

---

## Mitigation Steps

### Short Term (COMPLETED)
- ✅ Hardcoded correct project URL in browser client
- ✅ Added runtime JWT verification
- ✅ Created clean startup script
- ✅ Documented incident

### Medium Term (RECOMMENDED)
- [ ] Restart development in fresh PowerShell session using `start_clean.bat`
- [ ] Test login with correct credentials for `bnfixjkjrbfalgcqhzof` project
- [ ] Verify debug page shows correct project
- [ ] Document correct credentials for `bnfixjkjrbfalgcqhzof` project only

### Long Term (RECOMMENDED)
- [ ] Add pre-commit hook to prevent wrong project credentials
- [ ] Implement environment validation tests
- [ ] Separate workspaces for different client projects
- [ ] Use .env.production and .env.development with strict validation
- [ ] Audit all machines for mixed credentials
- [ ] Consider credential rotation for both projects

---

## Security Recommendations

### 1. Workspace Isolation
**CRITICAL:** Each client project should be in completely separate:
- Physical directories (not just subdirectories)
- IDE workspaces
- Terminal sessions
- Git repositories

### 2. Environment Variable Hygiene
- Always verify environment on startup
- Never commit .env files
- Use distinct naming for different clients (e.g., `CLIENT_A_SUPABASE_URL`)
- Clear shell session between projects

### 3. Runtime Validation
- Always validate project ID at runtime
- Log security events
- Fail fast on mismatches
- Never silently fall back to wrong credentials

### 4. Access Control
- Audit who has access to both projects
- Review if cross-project access is needed
- Consider separate machines/accounts for different clients

---

## Questions Requiring Answers

1. **Where did `ocajcjdlrmbmfiirxndn` come from?**
   - Is this another IMACX project?
   - Is this from a different client?
   - When was it last legitimately used?

2. **How long has this been happening?**
   - Check git history for when wrong project first appeared
   - Review logs for cross-project data access

3. **Has data been compromised?**
   - Review if any data was written to wrong project
   - Check if wrong project received any requests
   - Audit recent authentication logs in both projects

4. **Who else is affected?**
   - Are other developers using same machine?
   - Are CI/CD pipelines affected?

---

## Lessons Learned

1. **Environment variables are dangerous**
   - Can persist across sessions
   - Hard to track source
   - Silent failures

2. **Multiple client projects on one machine is risky**
   - Credential mixing can happen easily
   - Difficult to debug
   - Potential for serious data breaches

3. **Runtime validation is essential**
   - Don't trust environment variables alone
   - Always verify at critical points
   - Fail loudly on security issues

---

## Next Steps

1. **Immediate:** Use `start_clean.bat` to restart with verified clean environment
2. **Short term:** Test and verify correct project is being used
3. **Medium term:** Audit for any data leakage
4. **Long term:** Implement workspace isolation recommendations

---

**Report Prepared By:** Factory Droid  
**Reviewed By:** [Pending]  
**Status:** Open - Awaiting verification of fix
