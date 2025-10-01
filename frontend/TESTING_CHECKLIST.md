# ✅ React Migration Testing Checklist

Use this checklist to verify everything is working after setup.

---

## Initial Setup Verification

### 1. File Structure Check

```bash
cd /home/untitled/Documents/lunara.io/frontend

# Should exist:
ls react-components/Hero.jsx
ls react-components/Features.jsx
ls react-components/Pricing.jsx.example
ls js/react-app.js
```

**Expected**: All files exist ✅

---

### 2. Start Server

```bash
cd /home/untitled/Documents/lunara.io/backend
python manage.py runserver
```

**Expected**: Server starts on port 8000 ✅

---

### 3. Open Page

Visit: http://127.0.0.1:8000/

**Expected**: Page loads without errors ✅

---

## Browser Console Checks

Open Developer Console (F12 → Console tab)

### Check 1: React Initialization Messages

**Look for:**
```
Initializing React app...
React components loaded successfully
React app rendered successfully
```

**Expected**: All 3 messages appear ✅

### Check 2: No Errors

**Look for:** Red error messages

**Expected**: Zero errors ✅

### Check 3: React Available

**Type in console:**
```javascript
React
```

**Expected**: Returns React object (not undefined) ✅

### Check 4: Components Loaded

**Type in console:**
```javascript
window.Hero
window.Features
```

**Expected**: Both return function objects ✅

### Check 5: App Initialized

**Type in console:**
```javascript
window.LunaraReact.initialized()
```

**Expected**: Returns `true` ✅

---

## Visual Checks

### Check 1: Hero Section

**Look for:**
- ✅ "Your Projects. Fully Protected." heading
- ✅ Subtitle text about Lunara
- ✅ "🚀 Let's Go!" button (purple/primary)
- ✅ "👀 Show Me How" button (gray/secondary)

**Expected**: All elements visible with correct styling ✅

### Check 2: Features Section

**Look for:**
- ✅ "Why Lunara?" heading
- ✅ Subtitle about trust and protection
- ✅ Four feature cards in a grid:
  - 🔐 Trust in Every Transaction
  - 📋 Clear Milestones
  - ⚖️ Fair Dispute Resolution
  - 📱 Real-Time Updates

**Expected**: All 4 cards displayed correctly ✅

### Check 3: Static Sections Still Work

**Look for:**
- ✅ "How Lunara Works" section (4 steps)
- ✅ "Simple, Transparent Pricing" section (2 cards)
- ✅ Header navigation bar
- ✅ Mobile menu button

**Expected**: All sections present and styled ✅

### Check 4: Three.js Particles

**Look for:**
- ✅ Animated particles in background
- ✅ Smooth movement
- ✅ No console errors related to Three.js

**Expected**: Particles animating smoothly ✅

---

## Interaction Checks

### Check 1: "Let's Go!" Button

**Action:** Click the "🚀 Let's Go!" button

**Expected:**
- ✅ Navigates to signup.html
- ✅ No console errors

### Check 2: "Show Me How" Button

**Action:** Click the "👀 Show Me How" button

**Expected:**
- ✅ Smooth scrolls to "How It Works" section
- ✅ No console errors

### Check 3: Header Navigation

**Action:** Click "Features" in header nav

**Expected:**
- ✅ Scrolls to Features section
- ✅ No console errors

### Check 4: Mobile Menu

**Action:** Resize browser to mobile width (< 768px), click hamburger menu

**Expected:**
- ✅ Mobile menu slides out
- ✅ All navigation links visible
- ✅ No console errors

---

## Network Tab Checks

Open Developer Tools → Network tab → Refresh page

### Check 1: React Libraries Loaded

**Look for:**
- ✅ react.production.min.js (Status: 200)
- ✅ react-dom.production.min.js (Status: 200)
- ✅ babel.min.js (Status: 200)

**Expected**: All loaded successfully ✅

### Check 2: React Components Loaded

**Look for:**
- ✅ Hero.jsx (Status: 200)
- ✅ Features.jsx (Status: 200)

**Expected**: Both loaded successfully ✅

### Check 3: React App Entry Point

**Look for:**
- ✅ react-app.js (Status: 200)

**Expected**: Loaded successfully ✅

### Check 4: Existing Scripts Still Load

**Look for:**
- ✅ api.js (Status: 200)
- ✅ navigation.js (Status: 200)
- ✅ particles.js (Status: 200)
- ✅ three.min.js (Status: 200)

**Expected**: All loaded successfully ✅

---

## React DevTools Check

### 1. Install Extension

Chrome/Edge: [React Developer Tools](https://chrome.google.com/webstore/detail/react-developer-tools/fmkadmapgofadopljbjfkapdkoienihi)

Firefox: [React Developer Tools](https://addons.mozilla.org/en-US/firefox/addon/react-devtools/)

### 2. Open DevTools

Open Developer Tools → Components tab

### 3. Check Component Tree

**Expected structure:**
```
<App>
  <Hero />
  <Features />
</App>
```

**Expected**: Component tree visible ✅

### 4. Inspect Components

**Action:** Click on Hero component in tree

**Expected:**
- ✅ Shows component props
- ✅ Shows rendered elements
- ✅ No errors

---

## Styling Verification

### Check 1: Compare Before/After

**Open original screenshot/version (if available)**

**Expected:**
- ✅ Hero section looks identical
- ✅ Features section looks identical
- ✅ Colors match
- ✅ Spacing matches
- ✅ Fonts match

### Check 2: Responsive Design

**Action:** Resize browser to different widths:
- Desktop: 1920px
- Laptop: 1366px
- Tablet: 768px
- Mobile: 375px

**Expected:**
- ✅ Layout adjusts at each breakpoint
- ✅ No horizontal scroll
- ✅ All text readable
- ✅ Buttons accessible

### Check 3: Hover Effects

**Action:** Hover over:
- Feature cards
- Buttons
- Navigation links

**Expected:**
- ✅ Hover effects work
- ✅ Transitions are smooth
- ✅ No visual glitches

---

## Performance Checks

### Check 1: Load Time

Open DevTools → Network tab → Disable cache → Refresh

**Look at:** Total load time at bottom

**Expected:**
- ✅ Page loads in < 3 seconds
- ✅ React overhead is acceptable (~400ms)

### Check 2: Console Warnings

**Look for:** Yellow warning messages

**Expected:**
- ⚠️ May see Babel deprecation warnings (acceptable for dev)
- ✅ No React warnings about keys or hydration

### Check 3: Smooth Scrolling

**Action:** Scroll page up and down

**Expected:**
- ✅ Smooth 60fps scrolling
- ✅ No jank or stuttering
- ✅ Particles don't slow down page

---

## Integration Checks

### Check 1: Navigation System

**Type in console:**
```javascript
window.LunaraNavigate('dashboard.html')
```

**Expected:**
- ✅ Navigates to dashboard (if logged in) or signin
- ✅ No errors

### Check 2: API Integration

**Type in console:**
```javascript
window.LunaraAPI
```

**Expected:**
- ✅ Returns API object
- ✅ Has methods like login, register, etc.

### Check 3: Three.js Independent

**Action:** Stop React app (type in console):
```javascript
document.getElementById('react-root').innerHTML = ''
```

**Expected:**
- ✅ Three.js particles still animate
- ✅ Proves independence

**Action:** Refresh page to restore

---

## Cross-Browser Testing

### Test in Multiple Browsers

Test in: Chrome, Firefox, Safari, Edge

**For each browser:**
- ✅ Page loads without errors
- ✅ React initializes correctly
- ✅ All interactions work
- ✅ Styling looks correct

---

## Final Verification

### Checklist Summary

```
[ ] All files created correctly
[ ] Server starts without errors
[ ] Page loads without errors
[ ] Console shows React initialized
[ ] Hero section displays correctly
[ ] Features section displays correctly
[ ] Static sections still work
[ ] Three.js particles animate
[ ] Buttons navigate correctly
[ ] Smooth scrolling works
[ ] Mobile menu functions
[ ] All scripts load (Network tab)
[ ] React DevTools shows component tree
[ ] Styling matches original
[ ] Responsive design works
[ ] Performance is acceptable
[ ] Navigation system integrated
[ ] API client still works
[ ] Cross-browser compatible
```

---

## If Any Test Fails

### 1. Check Console

Most issues show errors in console.

### 2. Verify File Paths

```bash
# Run from frontend directory
ls -la react-components/
ls -la js/react-app.js
```

### 3. Check Script Load Order

View page source → Verify scripts load in this order:
1. React libraries
2. Existing Lunara scripts
3. React components (.jsx)
4. react-app.js

### 4. Clear Cache

Hard refresh: Ctrl+Shift+R (Cmd+Shift+R on Mac)

### 5. Check CSP

If scripts blocked, check:
- staticwebapp.config.json has `https://unpkg.com` in script-src
- No meta tag CSP conflicts

### 6. Debugging Commands

```javascript
// Check what's loaded
console.log('React:', typeof React);
console.log('Hero:', typeof window.Hero);
console.log('Features:', typeof window.Features);
console.log('Root element:', document.getElementById('react-root'));

// Manual initialization (if needed)
window.LunaraReact.reinitialize();
```

---

## Success! 🎉

If all checks pass, you have successfully:

✅ Integrated React into Lunara
✅ Migrated Hero and Features sections
✅ Maintained all existing functionality
✅ Preserved Three.js and animations
✅ Kept Django backend unchanged

**You're ready to continue migrating more sections!**

Refer to `REACT_MIGRATION_GUIDE.md` for next steps.

---

## Report Template

If you need help, use this template:

```
Browser: Chrome 120 / Firefox 121 / etc.
Issue: [Describe what's not working]

Console errors:
[Copy any red errors from console]

What I checked:
[ ] Files exist
[ ] Server running
[ ] Console messages
[ ] Network tab
[ ] React DevTools

Additional info:
[Any other relevant details]
```