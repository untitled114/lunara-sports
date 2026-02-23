import React from 'react';
import { FileText } from 'lucide-react';

const sections = [
  {
    title: '1. Acceptance of Terms',
    body: 'By accessing and using Lunara Sports ("the Service"), you agree to be bound by these Terms and Conditions. If you do not agree, you must discontinue use immediately. We reserve the right to modify these terms at any time, and continued use after changes constitutes acceptance.'
  },
  {
    title: '2. Description of Service',
    body: 'Lunara Sports is a free sports information platform providing real-time NBA scores, statistics, standings, player data, and play-by-play feeds. All data is sourced from publicly available ESPN APIs and presented for informational and entertainment purposes only.'
  },
  {
    title: '3. No Betting or Gambling',
    body: 'This platform is strictly an informational service. Lunara Sports does not facilitate, encourage, or endorse sports betting, gambling, or wagering of any kind. No odds, spreads, or betting lines are provided. Users are solely responsible for their own decisions regarding any third-party betting activity.'
  },
  {
    title: '4. User Conduct',
    body: 'You agree to use the Service only for lawful purposes. You will not attempt to disrupt the Service, reverse-engineer any part of it, scrape data at excessive rates, impersonate others, or use the Service in any way that could damage, disable, or impair its operation.'
  },
  {
    title: '5. Intellectual Property',
    body: 'All original content, design, code, and branding of Lunara Sports are the property of its creators. NBA team names, logos, and related marks are trademarks of their respective owners and the National Basketball Association. ESPN data is used under fair use for informational purposes.'
  },
  {
    title: '6. Disclaimers',
    body: 'The Service is provided "as is" and "as available" without warranties of any kind, express or implied. We do not guarantee the accuracy, completeness, or timeliness of any sports data displayed. Game scores and statistics may be delayed or contain errors.'
  },
  {
    title: '7. Limitation of Liability',
    body: 'In no event shall Lunara Sports, its creators, or contributors be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the Service. Our total liability shall not exceed the amount you paid for the Service, which is zero dollars ($0).'
  },
  {
    title: '8. Data Accuracy',
    body: 'Sports data is sourced from third-party APIs and may not always reflect real-time results. We make reasonable efforts to display current information but cannot guarantee accuracy. Always verify critical information through official sources such as NBA.com or ESPN.com.'
  },
  {
    title: '9. Modifications',
    body: 'We reserve the right to modify, suspend, or discontinue the Service at any time without notice. We may also update these Terms periodically. The "Last Updated" date at the top of this page indicates when the latest revision was made.'
  },
  {
    title: '10. Contact',
    body: 'For questions about these Terms and Conditions, please reach out through the project\'s GitHub repository or contact the development team directly.'
  }
];

export default function TermsPage() {
  return (
    <div className="animate-intel">
      {/* Jumbotron */}
      <div className="relative mb-12 overflow-hidden rounded-[2rem] liquid-mirror p-12">
        <div className="absolute inset-0 jumbotron-grid opacity-30 pointer-events-none" />
        <div className="relative z-10 flex items-center gap-6">
          <div className="h-16 w-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
            <FileText className="h-8 w-8 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-4xl font-black text-jumbotron uppercase tracking-tight">Terms & Conditions</h1>
            <p className="text-sm font-bold text-white/30 uppercase tracking-widest mt-2">Last updated: February 19, 2026</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="liquid-mirror rounded-[2rem] p-10 space-y-10">
        {sections.map((section, i) => (
          <div key={i} className="animate-intel" style={{ animationDelay: `${i * 0.05}s` }}>
            <h2 className="text-lg font-black text-white uppercase tracking-wide mb-3">{section.title}</h2>
            <p className="text-sm leading-relaxed text-white/50">{section.body}</p>
            {i < sections.length - 1 && <div className="mt-10 border-b border-white/5" />}
          </div>
        ))}
      </div>
    </div>
  );
}
