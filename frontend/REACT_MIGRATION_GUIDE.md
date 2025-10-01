# React Migration Guide - Vite Edition

## Overview

This guide shows you how to migrate static HTML sections to React components using the **Vite build system**.

**Key Difference from Old Approach:**
- ❌ **OLD**: Create `.jsx` file → Add `window` export → Add `<script>` tag
- ✅ **NEW**: Create `.jsx` file → Use ES6 `export` → Import in `App.jsx`

---

## Migration Pattern (Vite)

### Step 1: Create Component in `src/components/`

```bash
cd frontend/src/components
touch YourSection.jsx
```

### Step 2: Write Component with ES6 Export

```jsx
// src/components/YourSection.jsx
import React from 'react';

const YourSection = () => {
  return (
    <section id="your-section" className="section">
      <div className="container">
        <h2 className="section-title">Your Title</h2>
        {/* Your content */}
      </div>
    </section>
  );
};

export default YourSection;  // ES6 export (NOT window.YourSection)
```

### Step 3: Import in `App.jsx`

```jsx
// src/App.jsx
import React from 'react';
import Hero from './components/Hero';
import Features from './components/Features';
import YourSection from './components/YourSection';  // Add this

function App() {
  return (
    <>
      <Hero />
      <Features />
      <YourSection />  {/* Add this */}
    </>
  );
}

export default App;
```

### Step 4: Remove Static HTML

Delete the corresponding `<section>` from `index.html`.

### Step 5: Rebuild

```bash
npm run build
```

**That's it!** Vite automatically:
- Bundles your component
- Tree-shakes unused code
- Minifies the output
- Generates source maps

---

## Example: Migrating "How It Works"

### Before (Static HTML in index.html)

```html
<section id="how-it-works" class="section fade-in">
  <div class="container">
    <h2 class="section-title">How Lunara Works</h2>
    <div class="steps-grid">
      <div class="step-card">
        <div class="step-number">1</div>
        <h3>Create Project</h3>
        <p>Define scope, milestones, and payment terms...</p>
      </div>
      <div class="step-card">
        <div class="step-number">2</div>
        <h3>Fund Escrow</h3>
        <p>Client deposits project payment...</p>
      </div>
      <!-- More steps... -->
    </div>
  </div>
</section>
```

### After (React Component)

**1. Create component:**

```jsx
// src/components/HowItWorks.jsx
import React from 'react';

const HowItWorks = () => {
  const steps = [
    {
      number: 1,
      title: 'Create Project',
      description: 'Define scope, milestones, and payment terms. Both parties agree to the terms.'
    },
    {
      number: 2,
      title: 'Fund Escrow',
      description: 'Client deposits project payment into secure escrow. Funds are held safely until work is completed.'
    },
    {
      number: 3,
      title: 'Complete Work',
      description: 'Freelancer delivers milestone work. Client reviews and approves deliverables through our platform.'
    },
    {
      number: 4,
      title: 'Release Payment',
      description: 'Upon approval, payment is automatically released to the freelancer. Milestone completed successfully.'
    }
  ];

  return (
    <section id="how-it-works" className="section fade-in">
      <div className="container">
        <h2 className="section-title">How Lunara Works</h2>
        <p className="section-subtitle">
          Simple, secure, and transparent process in four easy steps.
        </p>
        <div className="steps-grid">
          {steps.map((step) => (
            <div key={step.number} className="step-card">
              <div className="step-number">{step.number}</div>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
```

**2. Import in App.jsx:**

```jsx
import HowItWorks from './components/HowItWorks';

function App() {
  return (
    <>
      <Hero />
      <Features />
      <HowItWorks />  {/* Add here */}
    </>
  );
}
```

**3. Delete from index.html:**

Remove the entire `<section id="how-it-works">` block.

**4. Rebuild:**

```bash
npm run build
```

---

## Example: Migrating Pricing Section

### Component with Props and Featured Card

```jsx
// src/components/Pricing.jsx
import React from 'react';

const Pricing = () => {
  const plans = [
    {
      id: 'freelancers',
      icon: '💎',
      title: 'For Freelancers',
      cost: 'Free',
      subtitle: 'Protect your work, maximize earnings',
      description: 'Get paid faster with escrow protection and automated milestone management.',
      cta: 'Start Earning Securely',
      featured: false
    },
    {
      id: 'clients',
      icon: '🏢',
      title: 'For Clients',
      cost: 'Free',
      subtitle: 'Protect your money, hire with confidence',
      description: 'Only pay when milestones are approved. Transparent, secure, stress-free transactions.',
      cta: 'Start Hiring with Confidence',
      featured: true  // This card gets special styling
    }
  ];

  return (
    <section id="pricing" className="section fade-in">
      <div className="container">
        <h2 className="section-title">Simple, Transparent Pricing</h2>
        <p className="section-subtitle">
          Only pay when milestones are met. No hidden fees. Full transparency, always.
        </p>
        <div className="pricing-grid">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`pricing-card ${plan.featured ? 'featured' : ''}`}
            >
              <div className="pricing-icon">{plan.icon}</div>
              <h3>{plan.title}</h3>
              <div className="pricing-cost">
                <span className="cost-main">{plan.cost}</span>
                <span className="cost-sub">{plan.subtitle}</span>
              </div>
              <p>{plan.description}</p>
              <a href="/signup.html" className="btn btn-primary" data-action="sign-up">
                {plan.cta}
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Pricing;
```

---

## Adding Interactivity (State & Events)

### Example: Collapsible FAQ Section

```jsx
// src/components/FAQ.jsx
import React, { useState } from 'react';

const FAQ = () => {
  const [openIndex, setOpenIndex] = useState(null);

  const faqs = [
    {
      question: 'How does escrow work?',
      answer: 'Funds are held in secure escrow until milestones are approved...'
    },
    {
      question: 'What are the fees?',
      answer: 'Platform fees are transparent and only charged on completed milestones...'
    }
  ];

  const toggleFAQ = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section id="faq" className="section">
      <div className="container">
        <h2 className="section-title">Frequently Asked Questions</h2>
        <div className="faq-list">
          {faqs.map((faq, index) => (
            <div key={index} className="faq-item">
              <button
                className="faq-question"
                onClick={() => toggleFAQ(index)}
              >
                {faq.question}
                <span>{openIndex === index ? '−' : '+'}</span>
              </button>
              {openIndex === index && (
                <div className="faq-answer">
                  {faq.answer}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FAQ;
```

---

## Component Best Practices

### 1. Keep Components Small and Focused

**Bad:**
```jsx
const Landing = () => {
  return (
    <>
      <Hero />
      <Features />
      <HowItWorks />
      <Pricing />
      <FAQ />
      <Footer />
    </>
  );
};
```

**Good:**
```jsx
// Each component in its own file
import Hero from './components/Hero';
import Features from './components/Features';
// etc.
```

### 2. Extract Reusable Components

**Bad:**
```jsx
<div className="feature-card">
  <div className="feature-icon">🔐</div>
  <h3>Escrow Protection</h3>
  <p>Secure payments...</p>
</div>
<div className="feature-card">
  <div className="feature-icon">💬</div>
  <h3>Real-Time Chat</h3>
  <p>Instant messaging...</p>
</div>
```

**Good:**
```jsx
const FeatureCard = ({ icon, title, description }) => (
  <div className="feature-card">
    <div className="feature-icon">{icon}</div>
    <h3>{title}</h3>
    <p>{description}</p>
  </div>
);

// Usage
{features.map((feature) => (
  <FeatureCard key={feature.id} {...feature} />
))}
```

### 3. Use Data-Driven Rendering

**Bad:**
```jsx
<div className="step-card">
  <div className="step-number">1</div>
  <h3>Create Project</h3>
</div>
<div className="step-card">
  <div className="step-number">2</div>
  <h3>Fund Escrow</h3>
</div>
```

**Good:**
```jsx
const steps = [
  { number: 1, title: 'Create Project' },
  { number: 2, title: 'Fund Escrow' }
];

{steps.map((step) => (
  <div key={step.number} className="step-card">
    <div className="step-number">{step.number}</div>
    <h3>{step.title}</h3>
  </div>
))}
```

---

## Development Workflow

### 1. Development Mode (Hot Reload)

```bash
npm run dev
```

- Edit component → Save → Browser updates instantly
- No manual refresh needed
- Errors shown in browser overlay

### 2. Production Build

```bash
npm run build
```

- Minifies code
- Removes console.logs
- Tree-shakes unused code
- Generates source maps

### 3. Preview Production Build

```bash
npm run preview
```

- Test production bundle locally
- Verify optimizations

---

## Common Patterns

### Event Handlers

```jsx
const Hero = () => {
  const handleSignUp = (e) => {
    e.preventDefault();
    window.location.href = '/signup.html';
  };

  return (
    <button onClick={handleSignUp} className="btn btn-primary">
      Sign Up
    </button>
  );
};
```

### Conditional Rendering

```jsx
const PricingCard = ({ plan }) => (
  <div className={`pricing-card ${plan.featured ? 'featured' : ''}`}>
    {plan.featured && <span className="badge">Best Value</span>}
    <h3>{plan.title}</h3>
  </div>
);
```

### Dynamic Classes

```jsx
const NavLink = ({ section, active }) => (
  <a
    href={`#${section}`}
    className={`nav-link ${active ? 'active' : ''}`}
  >
    {section}
  </a>
);
```

---

## Debugging Tips

### 1. Use React DevTools

Install [React Developer Tools](https://react.dev/learn/react-developer-tools) browser extension.

### 2. Console Logs (Development Only)

```jsx
const MyComponent = () => {
  console.log('Component rendered');  // Removed in production build
  return <div>...</div>;
};
```

### 3. Source Maps

Vite generates source maps automatically. In browser DevTools, you'll see original file names:

```
src/components/Hero.jsx:42
```

Not minified:
```
dist/js/main.js:1234
```

---

## Migration Checklist

Use this checklist when migrating each section:

- [ ] Create component file in `src/components/`
- [ ] Copy HTML structure from `index.html`
- [ ] Convert `class` to `className`
- [ ] Convert inline styles to camelCase
- [ ] Extract data into arrays/objects
- [ ] Add `export default` at bottom
- [ ] Import component in `App.jsx`
- [ ] Add component to JSX render
- [ ] Delete static HTML from `index.html`
- [ ] Run `npm run build`
- [ ] Test in browser

---

## Next Steps

1. ✅ **Migrate "How It Works"** - Practice data-driven rendering
2. ✅ **Migrate "Pricing"** - Practice conditional rendering
3. ⬜ **Add State** - Use `useState` for interactive features
4. ⬜ **Add Effects** - Use `useEffect` for side effects
5. ⬜ **API Integration** - Fetch data from Django backend

---

## Summary

**The Vite migration workflow is simpler and faster:**

1. Create component in `src/components/`
2. Use ES6 `export default`
3. Import in `App.jsx`
4. Run `npm run build`

**No script tags. No window exports. Just clean, modern React.**

For more details, see:
- `BUILD_GUIDE.md` - Vite setup and deployment
- `VITE_MIGRATION_COMPLETE.md` - Performance comparison
- `REACT_SETUP_COMPLETE.md` - Current status and next steps
