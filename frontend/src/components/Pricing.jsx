import React, { useState } from 'react';
import { Check, X, ArrowRight } from 'lucide-react';

// --- Pricing Data ---
const PRICING_DATA = [
    {
        name: 'Freelancer (Standard)',
        monthlyPrice: '0',
        annualPrice: '0', // Still free, but emphasizing commitment
        isPrimary: false,
        features: [
            { name: 'Secure Stripe Escrow', available: true },
            { name: 'Standard 5% Platform Fee', available: true },
            { name: 'Real-Time Messaging (Ably)', available: true },
            { name: 'HD Video Meetings (100ms)', available: false },
            { name: 'Standard Payout (5-7 days)', available: true },
            { name: 'Dedicated Account Manager', available: false },
        ],
        ctaText: 'Start for Free',
    },
    {
        name: 'Pro (Verified)',
        monthlyPrice: '29',
        annualPrice: '299', // Discounted annual rate
        isPrimary: true,
        features: [
            { name: 'Secure Stripe Escrow', available: true },
            { name: 'Reduced 2% Platform Fee', available: true, highlight: true },
            { name: 'Real-Time Messaging (Ably)', available: true },
            { name: 'HD Video Meetings (100ms)', available: true, highlight: true },
            { name: 'Instant Payouts (⚡️)', available: true, highlight: true },
            { name: 'Dedicated Account Manager', available: false },
        ],
        ctaText: 'Go Pro Now',
    },
    {
        name: 'Studio / Enterprise',
        monthlyPrice: 'Custom',
        annualPrice: 'Custom',
        isPrimary: false,
        features: [
            { name: 'Secure Stripe Escrow', available: true },
            { name: 'Custom Platform Fee', available: true },
            { name: 'Real-Time Messaging (Ably)', available: true },
            { name: 'HD Video Meetings (100ms)', available: true },
            { name: 'Instant Payouts (⚡️)', available: true },
            { name: 'Dedicated Account Manager', available: true, highlight: true },
        ],
        ctaText: 'Contact Sales',
    },
];

const Pricing = () => {
    // State to manage Monthly (true) or Annual (false)
    const [isMonthly, setIsMonthly] = useState(true);

    const FeatureItem = ({ name, available, highlight = false }) => (
        <li className="flex items-start space-x-3 py-2">
            {available ? (
                <Check className={`w-5 h-5 flex-shrink-0 ${highlight ? 'text-green-400' : 'text-indigo-400'}`} />
            ) : (
                <X className="w-5 h-5 flex-shrink-0 text-gray-500" />
            )}
            <span className={`text-sm ${available ? 'text-gray-200' : 'text-gray-500'} ${highlight ? 'font-semibold' : ''}`}>
                {name}
            </span>
        </li>
    );

    return (
        <section id="pricing" className="py-20 md:py-32 bg-gray-900">
            <div className="container mx-auto px-4 max-w-7xl">
                <header className="text-center mb-16">
                    <h2 className="text-4xl font-extrabold text-white sm:text-5xl">
                        Pricing Designed for Growth.
                    </h2>
                    <p className="mt-4 text-xl text-gray-400">
                        Maximize your earnings with competitive fees and powerful, integrated tools.
                    </p>
                </header>

                {/* Billing Cycle Toggle */}
                <div className="flex justify-center mb-12">
                    <div className="inline-flex p-1 bg-gray-800 rounded-full shadow-lg">
                        <button
                            onClick={() => setIsMonthly(true)}
                            className={`px-6 py-2 rounded-full text-sm font-medium transition-colors duration-200 ${
                                isMonthly ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-white'
                            }`}
                        >
                            Monthly
                        </button>
                        <button
                            onClick={() => setIsMonthly(false)}
                            className={`relative px-6 py-2 rounded-full text-sm font-medium transition-colors duration-200 ${
                                !isMonthly ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-white'
                            }`}
                        >
                            Annually (Save 14%)
                            {!isMonthly && (
                                <span className="absolute -top-3 right-0 bg-yellow-500 text-gray-900 text-xs font-bold px-2 py-0.5 rounded-full transform rotate-3 shadow-md">
                                    SAVE!
                                </span>
                            )}
                        </button>
                    </div>
                </div>

                {/* Pricing Cards Grid */}
                <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
                    {PRICING_DATA.map((plan) => (
                        <div
                            key={plan.name}
                            className={`flex flex-col p-8 rounded-2xl shadow-2xl ${
                                plan.isPrimary
                                    ? 'bg-gray-800 border-4 border-indigo-600 transform lg:scale-105 transition-transform duration-300'
                                    : 'bg-gray-800/80 border border-gray-700'
                            }`}
                        >
                            {plan.isPrimary && (
                                <p className="text-sm font-semibold text-center text-indigo-400 mb-4">Most Popular</p>
                            )}
                            
                            <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
                            <p className="text-gray-400 text-sm mb-6">Perfect for {plan.isPrimary ? 'scaling professionals' : plan.name.toLowerCase().includes('freelancer') ? 'new users' : 'large agencies'}.</p>

                            <div className="flex items-end mb-8">
                                <span className="text-5xl font-extrabold text-white">
                                    {plan.monthlyPrice === 'Custom' ? plan.monthlyPrice : '$'}
                                    {plan.monthlyPrice !== 'Custom' && (isMonthly ? plan.monthlyPrice : plan.annualPrice)}
                                </span>
                                {plan.monthlyPrice !== 'Custom' && (
                                    <span className="text-xl font-medium text-gray-400 ml-2">
                                        {isMonthly ? '/ month' : '/ year'}
                                    </span>
                                )}
                            </div>
                            
                            <ul className="flex-1 space-y-2 mb-10">
                                {plan.features.map((feature, idx) => (
                                    <FeatureItem key={idx} {...feature} />
                                ))}
                            </ul>

                            <a
                                href={plan.ctaText === 'Contact Sales' ? '#contact' : '#signup'}
                                className={`flex justify-center items-center px-6 py-3 rounded-xl font-bold transition duration-300 text-center ${
                                    plan.isPrimary
                                        ? 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-500/50'
                                        : 'bg-gray-700 text-indigo-300 hover:bg-gray-600'
                                }`}
                            >
                                {plan.ctaText}
                                <ArrowRight className="w-4 h-4 ml-2" />
                            </a>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default Pricing;
