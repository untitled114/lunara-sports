/**
 * Features.jsx - React component for features section
 * Converted from static HTML while preserving all classes and structure
 */

const Features = () => {
  const features = [
    {
      id: 'escrow',
      icon: '🔐',
      title: 'Real Escrow Protection',
      description: 'Powered by Stripe. Not fake holding accounts—real escrow that protects both sides. Your money is safe until work is approved.',
      badge: 'Powered by Stripe'
    },
    {
      id: 'video',
      icon: '🎥',
      title: 'HD Video Calls',
      description: 'Built-in video collaboration with 100ms. Crystal clear quality, no laggy screen shares. Better than Zoom, right in your project.',
      badge: '100ms Technology'
    },
    {
      id: 'messaging',
      icon: '💬',
      title: 'Real-Time Communication',
      description: 'Lightning-fast messaging powered by Ably. No clunky interfaces, no delays. Chat flows like Slack, not like Upwork.',
      badge: 'Ably Powered'
    },
    {
      id: 'fees',
      icon: '💰',
      title: 'Lower Platform Fees',
      description: 'Keep more of what you earn. While Fiverr takes 20% and Upwork takes 10-20%, we keep it transparent and competitive with Stripe Connect.',
      badge: 'Transparent Pricing'
    },
    {
      id: 'payouts',
      icon: '⚡',
      title: 'Instant Payouts Available',
      description: 'Pro members with verified accounts and proven track records can access instant payouts. No waiting weeks for your money.',
      badge: 'For Verified Users'
    },
    {
      id: 'compliance',
      icon: '⚖️',
      title: 'Trust & Compliance Handled',
      description: 'All the legal stuff taken care of. Contracts, disputes, payments—we handle the complexity so you can focus on the work.',
      badge: 'Fully Compliant'
    }
  ];

  return (
    <section id="features" className="section">
      <div className="container">
        <h2 className="section-title">Full Marketplace Platform. Zero BS.</h2>
        <p className="section-subtitle">
          Everything Fiverr and Upwork have, but faster, cleaner, and built for people who actually freelance.
        </p>
        <div className="features-grid">
          {features.map((feature) => (
            <div key={feature.id} className="feature-card">
              <div className="feature-icon">{feature.icon}</div>
              {feature.badge && (
                <span className="feature-badge">{feature.badge}</span>
              )}
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;