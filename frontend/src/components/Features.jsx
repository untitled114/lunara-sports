import React from 'react';

// --- FEATURE DATA (Refined Content) ---
const FEATURES_DATA = [
    {
        id: 'escrow',
        iconSrc: '/img/logos/stripe-connect.svg', // Placeholder for Stripe Logo
        badge: 'Stripe Verified',
        title: 'High-Fidelity Escrow Security',
        description: 'Funds are secured instantly in a real, transparent Stripe Connect escrow account. This process is auditable and protects both the client and the freelancer until work is approved.',
        accentClass: 'accent-purple' // For security/trust colors
    },
    {
        id: 'video',
        iconSrc: '/img/logos/100ms.svg', // Placeholder for 100ms Logo
        badge: '100ms Integration',
        title: 'Native HD Video Collaboration',
        description: 'Instant, built-in video meetings powered by 100ms. Experience crystal-clear quality, zero-lag screen sharing, and recording—all within your project workspace.',
        accentClass: 'accent-sky-blue' // For clarity/communication
    },
    {
        id: 'messaging',
        iconSrc: '/img/logos/ably.svg', // Placeholder for Ably Logo
        badge: 'Ably Powered Comms',
        title: 'Zero-Lag Real-Time Messaging',
        description: 'Lightning-fast, threaded chat and file sharing powered by Ably. Eliminates the clunky, delayed interfaces of older platforms.',
        accentClass: 'accent-orange' // For speed/real-time
    },
    {
        id: 'fees',
        iconSrc: '💰', // Using an emoji/icon for a concept, not a partner logo
        badge: 'Competitive Rate',
        title: 'Transparent, Competitive Platform Fees',
        description: 'Avoid the surprise 20% cuts from other platforms. Keep more of what you earn with a low, flat transaction fee.',
        accentClass: 'accent-green' // For value/money
    },
    {
        id: 'payouts',
        iconSrc: '⚡️', // Using an emoji/icon for a concept
        badge: 'Instant Transfers',
        title: '⚡️ Instant Payouts (Pro Verified)',
        description: 'For verified professionals, funds are available for instant transfer to your bank or PayPal account upon milestone approval—no more waiting weeks.',
        accentClass: 'accent-yellow' // For speed
    },
    {
        id: 'compliance',
        iconSrc: '⚖️', // Using an emoji/icon for a concept
        badge: 'Guaranteed Resolution',
        title: 'Legal Compliance & Dispute Resolution',
        description: 'Comprehensive legal support includes standardized contracts, automated tax documentation, and guaranteed dispute resolution. Focus on the work, we handle the complexity.',
        accentClass: 'accent-indigo' // For authority
    }
];

const Features = () => {
    return (
        <section id="features" className="py-20 md:py-28 bg-gray-900 relative">
            <div className="container mx-auto px-4 max-w-7xl">
                {/* Section Header */}
                <header className="text-center max-w-3xl mx-auto mb-16">
                    <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-4 leading-tight">
                        Freelance Protection, Built on Modern Tech.
                    </h2>
                    <p className="text-lg md:text-xl text-gray-400 leading-relaxed">
                        We replace ancient, clunky systems with integrated APIs from industry leaders like <span className="text-indigo-400 font-semibold">Stripe, Ably, and 100ms</span>. Stop paying old platforms for old tech.
                    </p>
                </header>

                {/* Features Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
                    {FEATURES_DATA.map((feature, index) => (
                        <div
                            key={feature.id}
                            className={`group relative p-6 bg-gray-800/50 backdrop-blur-sm border rounded-2xl transition-all duration-300 hover:transform hover:-translate-y-2 hover:shadow-2xl ${
                                feature.accentClass === 'accent-purple' ? 'border-purple-500/20 hover:border-purple-500/50 hover:shadow-purple-500/20' :
                                feature.accentClass === 'accent-sky-blue' ? 'border-sky-500/20 hover:border-sky-500/50 hover:shadow-sky-500/20' :
                                feature.accentClass === 'accent-orange' ? 'border-orange-500/20 hover:border-orange-500/50 hover:shadow-orange-500/20' :
                                feature.accentClass === 'accent-green' ? 'border-green-500/20 hover:border-green-500/50 hover:shadow-green-500/20' :
                                feature.accentClass === 'accent-yellow' ? 'border-yellow-500/20 hover:border-yellow-500/50 hover:shadow-yellow-500/20' :
                                'border-indigo-500/20 hover:border-indigo-500/50 hover:shadow-indigo-500/20'
                            }`}
                            style={{ transitionDelay: `${index * 0.05}s` }}
                        >
                            {/* Top Accent Line */}
                            <div className={`absolute top-0 left-0 right-0 h-1 rounded-t-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${
                                feature.accentClass === 'accent-purple' ? 'bg-gradient-to-r from-purple-600 to-purple-400' :
                                feature.accentClass === 'accent-sky-blue' ? 'bg-gradient-to-r from-sky-600 to-sky-400' :
                                feature.accentClass === 'accent-orange' ? 'bg-gradient-to-r from-orange-600 to-orange-400' :
                                feature.accentClass === 'accent-green' ? 'bg-gradient-to-r from-green-600 to-green-400' :
                                feature.accentClass === 'accent-yellow' ? 'bg-gradient-to-r from-yellow-600 to-yellow-400' :
                                'bg-gradient-to-r from-indigo-600 to-indigo-400'
                            }`} />

                            {/* Icon */}
                            <div className="mb-4 flex items-center justify-start">
                                {feature.iconSrc.startsWith('/') ? (
                                    <img
                                        src={feature.iconSrc}
                                        alt={`${feature.badge} logo`}
                                        className="w-14 h-14 object-contain filter brightness-0 invert opacity-90"
                                    />
                                ) : (
                                    <span className="text-5xl">{feature.iconSrc}</span>
                                )}
                            </div>

                            {/* Badge */}
                            <span className={`inline-block px-3 py-1 text-xs font-semibold rounded-full mb-3 ${
                                feature.accentClass === 'accent-purple' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
                                feature.accentClass === 'accent-sky-blue' ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20' :
                                feature.accentClass === 'accent-orange' ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' :
                                feature.accentClass === 'accent-green' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                                feature.accentClass === 'accent-yellow' ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' :
                                'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                            }`}>
                                {feature.badge}
                            </span>

                            {/* Title */}
                            <h3 className="text-xl font-bold text-white mb-3 leading-snug">
                                {feature.title}
                            </h3>

                            {/* Description */}
                            <p className="text-gray-400 leading-relaxed text-sm">
                                {feature.description}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default Features;