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
        <section id="how-it-works" className="py-16 md:py-24 bg-gray-900 border-t border-b border-gray-800">
            <div className="container mx-auto px-4 max-w-6xl">
                <header className="text-center mb-12">
                    <h2 className="text-4xl font-extrabold text-white sm:text-5xl">
                        A Simple, Three-Step Workflow
                    </h2>
                    <p className="mt-4 text-xl text-gray-400">
                        Modern freelancing shouldn't be complicated. Here's how we ensure security and speed.
                    </p>
                </header>

                <div className="relative">
                    {/* Responsive Timeline Connector (Hidden on Mobile, Visible on Desktop) */}
                    <div className="hidden lg:block absolute inset-0 w-2/3 mx-auto">
                        <svg className="w-full h-full" viewBox="0 0 800 100">
                            <line x1="5%" y1="50" x2="95%" y2="50" stroke="#4B5563" strokeWidth="4" strokeDasharray="10 10" />
                        </svg>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-8">
                        {STEPS.map((step, index) => {
                            const Icon = step.icon;
                            return (
                                <div 
                                    key={index} 
                                    className="relative flex flex-col items-center text-center p-6 bg-gray-800/50 rounded-xl shadow-2xl transition duration-300 hover:bg-gray-800 hover:shadow-indigo-500/30 group"
                                >
                                    {/* Icon & Connector */}
                                    <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-6 ring-4 ${step.accentColor} ring-opacity-30 bg-gray-900`}>
                                        <Icon className={`w-8 h-8 ${step.accentColor}`} strokeWidth={2.5} />
                                    </div>

                                    {/* Content */}
                                    <h3 className="text-2xl font-semibold text-white mb-3">
                                        {step.title}
                                    </h3>
                                    <p className="text-gray-400">
                                        {step.description}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </section>
    );
};

export default HowItWorks;
