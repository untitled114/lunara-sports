# Comprehensive Fix Plan - Lunara Application Issues

**Date:** 2025-10-03
**Status:** Analysis Complete - Ready for Implementation
**Severity:** High Priority - Blocking Production Use

---

## Executive Summary

Three critical categories of issues have been identified:
1. **CSP Violations** - Blocking all API calls in development
2. **Authentication Failures** - Registration broken, login bypass present
3. **CSS Warnings** - Minor rendering issues

---

## 1️⃣ CSP (Content Security Policy) Issues

### Problem Analysis

**Current CSP Configuration** (`frontend/staticwebapp.config.json:25`):
```json
"Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com https://unpkg.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://images.unsplash.com https://lunara-api.thankfulhill-c6015f7f.eastus.azurecontainerapps.io https://api.lunara-app.com; frame-ancestors 'none';"
```

**Issue:** The `connect-src` directive does NOT include `http://localhost:8000`, which is required for local development API calls.

**Impact:**
- All XHR/fetch requests to `/api/*` endpoints fail in development
- Browser blocks requests with CSP violation errors
- Development workflow completely broken

### Root Cause

The application uses a **Vite proxy** to forward `/api` requests to `http://127.0.0.1:8000` (see `frontend/vite.config.js:43-48`). However:
1. The CSP is configured in `staticwebapp.config.json` for **production** deployment
2. Development server at `localhost:3000` enforces this production CSP
3. No environment-specific CSP configuration exists

### Solution

**Strategy:** Environment-aware CSP configuration

#### Development Environment
- **Remove CSP from `staticwebapp.config.json`** (production-only file)
- **Add CSP meta tag** to `frontend/index.html` with conditional logic
- **Allow localhost connections** via Vite proxy

#### Production Environment
- Keep restrictive CSP in `staticwebapp.config.json`
- Use only production API domains
- Maintain security posture

### Implementation Steps

**Step 1:** Update `frontend/vite.config.js`
```javascript
// Add CSP plugin for dev environment
plugins: [
  react(),
  {
    name: 'dev-csp-headers',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        res.setHeader('Content-Security-Policy',
          "default-src 'self'; " +
          "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
          "style-src 'self' 'unsafe-inline'; " +
          "connect-src 'self' http://localhost:8000 http://127.0.0.1:8000 ws://localhost:3000; " +
          "img-src 'self' data: https:; " +
          "font-src 'self';"
        );
        next();
      });
    }
  }
],
```

**Step 2:** Keep `staticwebapp.config.json` for production only
- No changes needed
- CSP only applies to production deployments

**Step 3:** Verify environment variable usage
```bash
# Ensure VITE_API_URL is NOT set in development
# Default in api.js: 'http://localhost:8000/api'
```

---

## 2️⃣ Authentication Issues

### Problem 1: Registration Fails

**Error Location:** `backend/apps/accounts/serializers.py:21`

**Frontend sends:**
```javascript
{
  email: "user@example.com",
  password: "password123",
  password_confirm: "password123",
  name: "John Doe",  // ← Field sent
  username: "user"
}
```

**Backend expects:**
```python
fields = ('username', 'email', 'password', 'password_confirm',
          'user_type', 'first_name', 'last_name')
# No 'name' field!
```

**Root Cause:** Field mismatch between frontend and backend serializer.

**Solution:**

**Option A:** Update serializer to accept `name` and split it:
```python
class UserRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, validators=[validate_password])
    password_confirm = serializers.CharField(write_only=True)
    name = serializers.CharField(write_only=True, required=False)  # Add this

    class Meta:
        model = User
        fields = ('username', 'email', 'password', 'password_confirm',
                  'user_type', 'first_name', 'last_name', 'name')
        extra_kwargs = {
            'password': {'write_only': True},
            'email': {'required': True},
            'first_name': {'required': False},
            'last_name': {'required': False}
        }

    def create(self, validated_data):
        validated_data.pop('password_confirm')

        # Handle 'name' field by splitting into first_name/last_name
        name = validated_data.pop('name', None)
        if name:
            name_parts = name.split(' ', 1)
            validated_data['first_name'] = name_parts[0]
            validated_data['last_name'] = name_parts[1] if len(name_parts) > 1 else ''

        user = User.objects.create_user(**validated_data)
        Profile.objects.create(user=user)
        return user
```

**Option B:** Update frontend to send `first_name` and `last_name` instead of `name`.

**Recommendation:** Use Option A (backend fix) - less disruptive, maintains frontend UX.

---

### Problem 2: Login Bypass (Demo Mode)

**Error Location:** `frontend/src/components/SignIn.jsx:58-76`

```javascript
// Fallback to mock auth if backend is unavailable
if (error.isNetworkError || !error.status) {
  console.log('Backend unavailable, using mock auth for:', formData.email);

  const mockToken = btoa(JSON.stringify({
    email: formData.email,
    timestamp: Date.now()
  }));

  localStorage.setItem('auth_token', mockToken);
  localStorage.setItem('user_email', formData.email);

  showSuccess('Welcome back! (Demo mode) Redirecting to dashboard...');

  setTimeout(() => {
    navigate('/dashboard');
  }, 1000);
  return;
}
```

**Root Cause:** Demo mode allows ANY email/password to "login" when backend is unreachable.

**Issue:** Once CSP is fixed and backend is reachable, this fallback SHOULD NOT trigger. However, the code path exists and could be exploited.

**Solution:**

**Option A:** Remove demo mode fallback entirely (recommended for production)
```javascript
} catch (error) {
  console.error('Login error:', error);

  let errorMessage = 'Login failed. Please check your credentials.';

  // Handle specific API error messages
  if (error.status === 401) {
    errorMessage = 'Invalid email or password.';
  } else if (error.status === 404) {
    errorMessage = 'No account found with this email.';
  } else if (error.isNetworkError) {
    errorMessage = 'Cannot connect to server. Please try again later.';
  }

  showError(errorMessage);
} finally {
  setLoading(false);
}
```

**Option B:** Add environment check for demo mode:
```javascript
if (import.meta.env.MODE === 'development' &&
    import.meta.env.VITE_ENABLE_DEMO_MODE === 'true' &&
    (error.isNetworkError || !error.status)) {
  // Demo mode fallback (development only)
}
```

**Recommendation:** Use Option A - Remove demo mode. Once CSP and registration are fixed, real authentication should always work.

---

### Problem 3: Demo Data Always Loads

**Current Behavior:** Application loads static demo data instead of real user-specific data.

**Root Cause Analysis:**

After reviewing the codebase:
1. Frontend components use real API calls (e.g., `projectsAPI.getAll()`, `messagesAPI.getAll()`)
2. Dashboard uses `dashboard_stats` endpoint for real data (`backend/apps/accounts/views.py:191-249`)
3. NO hardcoded demo data found in dashboard components

**Hypothesis:** Demo data appears because:
- API calls fail due to CSP violations
- Frontend falls back to empty states or cached data
- Login bypass allows access without valid tokens

**Solution:**
Once CSP and authentication are fixed, real user-specific data should load automatically. No code changes needed for this issue.

**Verification Steps:**
1. Fix CSP to allow API calls
2. Fix registration to create real accounts
3. Remove login bypass
4. Test: Create new account → Login → Verify dashboard shows real (empty) data
5. Test: Create project → Verify it appears in dashboard

---

## 3️⃣ CSS Parsing Errors

### Identified Issues

**Issue 1: Invalid `-webkit-` and `-moz-` prefixed properties**
- Location: `frontend/src/styles.css:29-30`
- Error: `Expected color but found "Arial"` and similar

```css
/* Current code */
-webkit-font-smoothing: antialiased;
-moz-osx-font-smoothing: grayscale;
```

**Solution:** These are VALID properties. Browser warnings can be ignored. No fix needed.

---

**Issue 2: `interpolate-size` property**
- Status: Experimental CSS property
- Browser support: Limited

**Solution:** If used, remove or replace with standard alternative.

---

**Issue 3: `app-region` property**
- Common in Electron apps for draggable regions
- Not needed for web apps

**Solution:** Remove if found in codebase.

---

**Issue 4: Invalid `vertical-align` and `transition` usage**
- Likely related to CSS-in-JS or Tailwind utilities

**Solution:** Audit components for:
```css
/* Invalid */
vertical-align: middle; /* on non-inline elements */

/* Valid */
vertical-align: middle; /* only on inline/inline-block */
```

### CSS Cleanup Actions

1. **Search for experimental properties:**
```bash
grep -r "interpolate-size\|app-region" frontend/src/
```

2. **Review Tailwind config:**
- Check `frontend/tailwind.config.js` for custom utilities
- Ensure no invalid property definitions

3. **Validate CSS files:**
```bash
npx stylelint "frontend/src/**/*.css"
```

4. **Browser compatibility check:**
- Test in Chrome, Firefox, Safari
- Use autoprefixer for vendor prefixes

---

## Implementation Plan

### Phase 1: Environment Fixes (HIGH PRIORITY)

**Task 1.1:** Fix CSP for Development
- File: `frontend/vite.config.js`
- Add CSP middleware plugin
- Test: `npm run dev` → verify API calls work

**Task 1.2:** Verify Production CSP
- File: `frontend/staticwebapp.config.json`
- Ensure production API domains are whitelisted
- No changes needed (already correct)

**Expected Outcome:** API calls succeed in both dev and production

---

### Phase 2: Authentication Fixes (HIGH PRIORITY)

**Task 2.1:** Fix Registration Serializer
- File: `backend/apps/accounts/serializers.py`
- Add `name` field handling
- Split `name` into `first_name` and `last_name`

**Task 2.2:** Remove Login Bypass
- File: `frontend/src/components/SignIn.jsx`
- Remove demo mode fallback (lines 58-76)
- Add proper error handling for network failures

**Task 2.3:** Test Authentication Flow
```bash
# Backend
cd backend
python manage.py runserver

# Frontend
cd frontend
npm run dev

# Test sequence:
1. Sign up with new account
2. Verify user created in database
3. Log out
4. Log in with correct credentials → success
5. Log in with wrong credentials → error
```

**Expected Outcome:**
- Registration creates real accounts
- Login validates credentials properly
- Dashboard loads user-specific data

---

### Phase 3: CSS Cleanup (LOW PRIORITY)

**Task 3.1:** Audit CSS Files
- Run linter on all CSS files
- Remove experimental properties
- Fix invalid property usage

**Task 3.2:** Test Rendering
- Visual regression testing
- Cross-browser compatibility check

**Expected Outcome:** No CSS parsing warnings in browser console

---

## Testing Checklist

### CSP Testing
- [ ] Dev server runs without CSP errors
- [ ] API calls to `/api/projects/` succeed
- [ ] API calls to `/api/messages/` succeed
- [ ] API calls to `/api/auth/login/` succeed
- [ ] Production build works with production CSP

### Authentication Testing
- [ ] Sign up creates new user in database
- [ ] Sign up returns JWT tokens
- [ ] Login with valid credentials succeeds
- [ ] Login with invalid credentials fails with proper error
- [ ] Login with non-existent email fails with proper error
- [ ] Dashboard loads after successful authentication
- [ ] Protected routes require valid token

### Data Persistence Testing
- [ ] Create project → verify it saves to database
- [ ] Create message → verify it saves to database
- [ ] Refresh page → verify data persists
- [ ] Logout → Login → verify user's data loads
- [ ] Multiple users → verify data isolation

### CSS Testing
- [ ] No CSS parsing errors in console
- [ ] Components render correctly in Chrome
- [ ] Components render correctly in Firefox
- [ ] Components render correctly in Safari
- [ ] No visual regressions

---

## Risk Assessment

| Issue | Severity | Impact | Mitigation |
|-------|----------|--------|------------|
| CSP blocking API calls | **CRITICAL** | Dev workflow broken | Test in multiple browsers after fix |
| Registration failing | **CRITICAL** | No new users | Add integration tests for auth flow |
| Login bypass | **HIGH** | Security vulnerability | Remove demo mode, add proper error handling |
| Demo data loading | **MEDIUM** | User confusion | Will resolve after CSP/auth fixes |
| CSS warnings | **LOW** | Console noise | Incremental cleanup, no user impact |

---

## Rollback Plan

If issues occur after implementing fixes:

### CSP Rollback
```bash
git checkout HEAD -- frontend/vite.config.js
```

### Auth Rollback
```bash
git checkout HEAD -- backend/apps/accounts/serializers.py
git checkout HEAD -- frontend/src/components/SignIn.jsx
```

### Database Rollback
```bash
python manage.py migrate accounts <previous_migration>
```

---

## Success Criteria

**Phase 1 (CSP):**
✅ All API calls succeed in development
✅ No CSP violation errors in browser console
✅ Production deployment still works with existing CSP

**Phase 2 (Authentication):**
✅ New users can register successfully
✅ Login validates credentials against database
✅ Invalid credentials return proper error messages
✅ Dashboard loads user-specific data (not demo data)

**Phase 3 (CSS):**
✅ No CSS parsing warnings in console
✅ Visual appearance unchanged
✅ Cross-browser compatibility maintained

---

## Next Steps

1. **Get approval** for fix plan
2. **Implement Phase 1** (CSP fixes)
3. **Implement Phase 2** (Authentication fixes)
4. **Test thoroughly** using checklist above
5. **Update QA Master Report** with results
6. **Deploy to production** once all tests pass

---

## Notes

- All fixes are **backwards compatible** (no database migrations required for Phase 1-2)
- **No data loss risk** - fixes only affect authentication and API connectivity
- **Estimated time:** 2-3 hours for implementation + 1 hour for testing
- **Can be deployed incrementally** (Phase 1 → test → Phase 2 → test → Phase 3)

---

**Prepared by:** Claude Code
**Review Status:** Pending User Approval
**Next Review Date:** After Phase 1 implementation
