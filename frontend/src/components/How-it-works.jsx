import React from 'react';
import { Zap, Handshake, DollarSign } from 'lucide-react'; // Using lucide icons for modern visual appeal

const STEPS = [
    {
        icon: Handshake,
        title: '1. Secure Match & Escrow',
        description: 'The client finds the perfect professional and secures the project funds instantly in a verified Stripe Connect escrow. The pro can start immediately, knowing the budget is locked and protected.',
        accentColor: 'text-indigo-400'
    },
    {
        icon: Zap,
        title: '2. Real-Time Collaboration & Review',
        description: 'Work is managed directly in the platform using native HD video (100ms) and zero-lag messaging (Ably). Once a milestone is complete, the client submits a full review and approval.',
        accentColor: 'text-sky-400'
    },
    {
        icon: DollarSign,
        title: '3. Instant Payout & Transfer',
        description: 'Upon client approval, funds are released immediately from the secure escrow. Verified professionals benefit from instant payouts, bypassing the weeks-long delays common on older platforms.',
        accentColor: 'text-green-400'
    },
];

const HowItWorks = () => {
    return (
        <section id="how-it-works" className="py-20 md:py-28 bg-gray-900 border-t border-b border-gray-800">
            <div className="container mx-auto px-4 max-w-7xl">
                <header className="text-center max-w-3xl mx-auto mb-16">
                    <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-4 leading-tight">
                        A Simple, Three-Step Workflow
                    </h2>
                    <p className="text-lg md:text-xl text-gray-400 leading-relaxed">
                        Modern freelancing shouldn't be complicated. Here's how we ensure security and speed.
                    </p>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
                    {STEPS.map((step, index) => {
                        const Icon = step.icon;
                        const accentClass = index === 0 ? 'accent-indigo' : index === 1 ? 'accent-sky-blue' : 'accent-green';
                        return (
                            <div
                                key={index}
                                className={`group relative p-6 bg-gray-800/50 backdrop-blur-sm border rounded-2xl transition-all duration-300 hover:transform hover:-translate-y-2 hover:shadow-2xl ${
                                    accentClass === 'accent-indigo' ? 'border-indigo-500/20 hover:border-indigo-500/50 hover:shadow-indigo-500/20' :
                                    accentClass === 'accent-sky-blue' ? 'border-sky-500/20 hover:border-sky-500/50 hover:shadow-sky-500/20' :
                                    'border-green-500/20 hover:border-green-500/50 hover:shadow-green-500/20'
                                }`}
                                style={{ transitionDelay: `${index * 0.05}s` }}
                            >
                                {/* Top Accent Line */}
                                <div className={`absolute top-0 left-0 right-0 h-1 rounded-t-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${
                                    accentClass === 'accent-indigo' ? 'bg-gradient-to-r from-indigo-600 to-indigo-400' :
                                    accentClass === 'accent-sky-blue' ? 'bg-gradient-to-r from-sky-600 to-sky-400' :
                                    'bg-gradient-to-r from-green-600 to-green-400'
                                }`} />

                                {/* Icon */}
                                <div className="mb-4 flex items-center justify-start">
                                    <div className={`w-14 h-14 rounded-full flex items-center justify-center ${
                                        accentClass === 'accent-indigo' ? 'bg-indigo-500/10' :
                                        accentClass === 'accent-sky-blue' ? 'bg-sky-500/10' :
                                        'bg-green-500/10'
                                    }`}>
                                        <Icon className={`w-7 h-7 ${step.accentColor}`} strokeWidth={2.5} />
                                    </div>
                                </div>

                                {/* Badge */}
                                <span className={`inline-block px-3 py-1 text-xs font-semibold rounded-full mb-3 ${
                                    accentClass === 'accent-indigo' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' :
                                    accentClass === 'accent-sky-blue' ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20' :
                                    'bg-green-500/10 text-green-400 border border-green-500/20'
                                }`}>
                                    Step {index + 1}
                                </span>

                                {/* Title */}
                                <h3 className="text-xl font-bold text-white mb-3 leading-snug">
                                    {step.title}
                                </h3>

                                {/* Description */}
                                <p className="text-gray-400 leading-relaxed text-sm">
                                    {step.description}
                                </p>
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
};

export default HowItWorks;
