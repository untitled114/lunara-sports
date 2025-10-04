import React from 'react';
import { Check, Rocket } from 'lucide-react';
import { Link } from 'react-router-dom';

// --- Pricing Data (Currently Free) ---
const PRICING_DATA = {
    name: 'Lunara Platform',
    price: 'Free',
    isPrimary: true,
    features: [
        { name: 'Secure Stripe Escrow', available: true },
        { name: 'Real-Time Messaging (Ably)', available: true },
        { name: 'HD Video Meetings (100ms)', available: true },
        { name: 'Project Management Tools', available: true },
        { name: 'Payment Processing', available: true },
        { name: 'Unlimited Projects', available: true },
    ],
    ctaText: 'Get Started Free',
};

const Pricing = () => {
    const FeatureItem = ({ name, available }) => (
        <li className="flex items-start space-x-3 py-2">
            <Check className="w-5 h-5 flex-shrink-0 text-indigo-400" />
            <span className="text-sm text-gray-200">
                {name}
            </span>
        </li>
    );

    return (
        <section id="pricing" className="py-20 md:py-32 bg-gray-900">
            <div className="container mx-auto px-4 max-w-7xl">
                <header className="text-center mb-16">
                    <h2 className="text-4xl md:text-5xl font-extrabold text-white leading-tight">
                        Simple, Transparent Pricing
                    </h2>
                    <p className="mt-4 text-lg md:text-xl text-gray-400 max-w-3xl mx-auto">
                        Get started today with full access to all features. No hidden fees, no surprises.
                    </p>
                </header>

                {/* Single Centered Pricing Card */}
                <div className="max-w-lg mx-auto">
                    <div className="relative flex flex-col p-10 bg-gray-800 border-4 border-indigo-600 rounded-2xl shadow-2xl">
                        {/* Badge */}
                        <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                            <span className="inline-block px-4 py-1.5 text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-indigo-500 rounded-full shadow-lg">
                                Limited Time Offer
                            </span>
                        </div>

                        <div className="text-center mt-4 mb-8">
                            <h3 className="text-3xl font-bold text-white mb-2">{PRICING_DATA.name}</h3>
                            <p className="text-gray-400">Everything you need to manage projects securely</p>
                        </div>

                        <div className="text-center mb-8">
                            <div className="flex items-center justify-center gap-3">
                                <span className="text-6xl font-extrabold bg-gradient-to-r from-indigo-400 to-indigo-300 bg-clip-text text-transparent">
                                    {PRICING_DATA.price}
                                </span>
                                <span className="text-2xl font-medium text-gray-400">
                                    Forever
                                </span>
                            </div>
                            <p className="mt-3 text-sm text-indigo-300">No credit card required</p>
                        </div>

                        <ul className="flex-1 space-y-2 mb-10">
                            {PRICING_DATA.features.map((feature, idx) => (
                                <FeatureItem key={idx} {...feature} />
                            ))}
                        </ul>

                        <Link
                            to="/signup"
                            className="group flex justify-center items-center gap-2 px-6 py-4 rounded-xl font-bold text-lg text-white bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 transition-all duration-300 shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40 hover:scale-105"
                        >
                            <Rocket className="w-5 h-5" />
                            {PRICING_DATA.ctaText}
                        </Link>

                        <p className="text-center text-xs text-gray-500 mt-6">
                            Join thousands of professionals already using Lunara
                        </p>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default Pricing;
