import React from 'react';

// --- Stripe Logo SVG Component ---
const StripeLogo = () => (
    <svg viewBox="0 0 60 25" xmlns="http://www.w3.org/2000/svg" className="w-16 h-16">
        <path fill="#635BFF" d="M59.64 14.28h-8.06c.19 1.93 1.6 2.55 3.2 2.55 1.64 0 2.96-.37 4.05-.95v3.32a8.33 8.33 0 0 1-4.56 1.1c-4.01 0-6.83-2.5-6.83-7.48 0-4.19 2.39-7.52 6.3-7.52 3.92 0 5.96 3.28 5.96 7.5 0 .4-.04 1.26-.06 1.48zm-5.92-5.62c-1.03 0-2.17.73-2.17 2.58h4.25c0-1.85-1.07-2.58-2.08-2.58zM40.95 20.3c-1.44 0-2.32-.6-2.9-1.04l-.02 4.63-4.12.87V5.57h3.76l.08 1.02a4.7 4.7 0 0 1 3.23-1.29c2.9 0 5.62 2.6 5.62 7.4 0 5.23-2.7 7.6-5.65 7.6zM40 8.95c-.95 0-1.54.34-1.97.81l.02 6.12c.4.44.98.78 1.95.78 1.52 0 2.54-1.65 2.54-3.87 0-2.15-1.04-3.84-2.54-3.84zM28.24 5.57h4.13v14.44h-4.13V5.57zm0-4.7L32.37 0v3.36l-4.13.88V.88zm-4.32 9.35v9.79H19.8V5.57h3.7l.12 1.22c1-1.77 3.07-1.41 3.62-1.22v3.79c-.52-.17-2.29-.43-3.32.86zm-8.55 4.72c0 2.43 2.6 1.68 3.12 1.46v3.36c-.55.3-1.54.54-2.89.54a4.15 4.15 0 0 1-4.27-4.24l.01-13.17 4.02-.86v3.54h3.14V9.1h-3.13v5.85zm-4.91.7c0 2.97-2.31 4.66-5.73 4.66a11.2 11.2 0 0 1-4.46-.93v-3.93c1.38.75 3.1 1.31 4.46 1.31.92 0 1.53-.24 1.53-1C6.26 13.77 0 14.51 0 9.95 0 7.04 2.28 5.3 5.62 5.3c1.36 0 2.72.2 4.09.75v3.88a9.23 9.23 0 0 0-4.1-1.06c-.86 0-1.44.25-1.44.93 0 1.85 6.29.97 6.29 5.88z"/>
    </svg>
);

// --- PayPal Logo SVG Component ---
const PayPalLogo = () => (
    <svg viewBox="0 0 100 32" xmlns="http://www.w3.org/2000/svg" className="w-16 h-16">
        <path fill="#003087" d="M12 4.917h-7.5c-.527 0-.976.383-1.061.905l-3.12 19.797c-.062.392.22.748.611.748h3.558l.893-5.661-.028.178c.085-.522.534-.905 1.061-.905h2.21c4.35 0 7.751-1.767 8.747-6.875.027-.138.067-.398.067-.398.245-1.619-.001-2.719-.896-3.673C15.692 8.028 14.146 4.917 12 4.917z"/>
        <path fill="#009cde" d="M35 4.917h-7.5c-.527 0-.976.383-1.061.905l-3.12 19.797c-.062.392.22.748.611.748h3.558l.893-5.661-.028.178c.085-.522.534-.905 1.061-.905h2.21c4.35 0 7.751-1.767 8.747-6.875.027-.138.067-.398.067-.398.245-1.619-.001-2.719-.896-3.673C38.692 8.028 37.146 4.917 35 4.917z"/>
        <path fill="#003087" d="M46.5 13.618c-.246 1.619-.001 2.719.896 3.673.861 1.005 2.407 4.117 4.553 4.117h7.5c.527 0 .976-.383 1.061-.905l3.12-19.797c.062-.392-.22-.748-.611-.748h-3.558l-.893 5.661.028-.178c-.085.522-.534.905-1.061.905h-2.21c-4.35 0-7.751 1.767-8.747 6.875-.027.138-.067.398-.067.398z"/>
    </svg>
);

// --- FEATURE DATA (Sales-Focused Content) ---
const FEATURES_DATA = [
    {
        id: 'escrow',
        icon: 'stripe',
        badge: 'Powered by Stripe',
        title: 'Bank-Level Escrow Security',
        description: 'Your payments are protected by Stripe\'s enterprise-grade security. Every transaction is held in escrow until you approve the work—guaranteed protection for both clients and freelancers.',
        accentClass: 'accent-purple'
    },
    {
        id: 'payouts',
        icon: 'paypal',
        badge: 'Multiple Payment Options',
        title: 'Instant Payouts with Stripe & PayPal',
        description: 'Get paid your way. Receive instant transfers to your bank account via Stripe, or use PayPal for maximum flexibility. No waiting weeks—your money, when you need it.',
        accentClass: 'accent-blue'
    },
    {
        id: 'video',
        iconSrc: '🎥',
        badge: '100ms Integration',
        title: 'Built-In HD Video Meetings',
        description: 'Stop juggling multiple apps. Crystal-clear video calls, screen sharing, and recording are built right into your workspace. Powered by 100ms for enterprise-quality collaboration.',
        accentClass: 'accent-sky-blue'
    },
    {
        id: 'messaging',
        iconSrc: '💬',
        badge: 'Real-Time Communication',
        title: 'Lightning-Fast Messaging',
        description: 'Forget delayed email threads. Instant messaging, file sharing, and threaded conversations keep your projects moving at the speed of business.',
        accentClass: 'accent-orange'
    },
    {
        id: 'fees',
        iconSrc: '💰',
        badge: 'Transparent Pricing',
        title: 'Keep More of What You Earn',
        description: 'Unlike platforms that take 20%+ in hidden fees, we keep our costs low and transparent. More money in your pocket means better business for everyone.',
        accentClass: 'accent-green'
    },
    {
        id: 'compliance',
        iconSrc: '📋',
        badge: 'Legal Protection',
        title: 'Complete Legal & Tax Coverage',
        description: 'Stop worrying about contracts and tax forms. We handle standardized agreements, automated tax documentation, and professional dispute resolution—so you can focus on great work.',
        accentClass: 'accent-indigo'
    }
];

const Features = () => {
    return (
        <section id="features" className="py-20 md:py-28 bg-gray-900 relative">
            <div className="container mx-auto px-4 max-w-7xl">
                {/* Section Header */}
                <header className="text-center max-w-3xl mx-auto mb-16">
                    <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-4 leading-tight">
                        Why Top Freelancers Choose Lunara
                    </h2>
                    <p className="text-lg md:text-xl text-gray-400 leading-relaxed mb-8">
                        Built on enterprise-grade technology from industry leaders. Get the security of Stripe, the speed of Ably, and the clarity of 100ms—all in one powerful platform.
                    </p>

                    {/* Powered By Section */}
                    <div className="flex flex-col items-center gap-4 pt-6 border-t border-gray-700/50">
                        <span className="text-sm text-gray-500 uppercase tracking-wider font-semibold">Trusted Partners</span>
                        <div className="flex items-center justify-center gap-8 flex-wrap">
                            <div className="flex items-center gap-2 px-4 py-2 bg-gray-800/30 rounded-lg border border-gray-700/30">
                                <StripeLogo />
                            </div>
                            <div className="flex items-center gap-2 px-4 py-2 bg-gray-800/30 rounded-lg border border-gray-700/30">
                                <PayPalLogo />
                            </div>
                        </div>
                    </div>
                </header>

                {/* Features Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
                    {FEATURES_DATA.map((feature, index) => (
                        <div
                            key={feature.id}
                            className={`group relative p-6 bg-gray-800/50 backdrop-blur-sm border rounded-2xl transition-all duration-300 hover:transform hover:-translate-y-2 hover:shadow-2xl ${
                                feature.accentClass === 'accent-purple' ? 'border-purple-500/20 hover:border-purple-500/50 hover:shadow-purple-500/20' :
                                feature.accentClass === 'accent-blue' ? 'border-blue-500/20 hover:border-blue-500/50 hover:shadow-blue-500/20' :
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
                                feature.accentClass === 'accent-blue' ? 'bg-gradient-to-r from-blue-600 to-blue-400' :
                                feature.accentClass === 'accent-sky-blue' ? 'bg-gradient-to-r from-sky-600 to-sky-400' :
                                feature.accentClass === 'accent-orange' ? 'bg-gradient-to-r from-orange-600 to-orange-400' :
                                feature.accentClass === 'accent-green' ? 'bg-gradient-to-r from-green-600 to-green-400' :
                                feature.accentClass === 'accent-yellow' ? 'bg-gradient-to-r from-yellow-600 to-yellow-400' :
                                'bg-gradient-to-r from-indigo-600 to-indigo-400'
                            }`} />

                            {/* Icon */}
                            <div className="mb-4 flex items-center justify-start">
                                {feature.icon === 'stripe' ? (
                                    <StripeLogo />
                                ) : feature.icon === 'paypal' ? (
                                    <PayPalLogo />
                                ) : feature.iconSrc && feature.iconSrc.startsWith('/') ? (
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
                                feature.accentClass === 'accent-blue' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
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