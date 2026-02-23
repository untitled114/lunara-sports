import React from 'react';
import { Shield } from 'lucide-react';

const sections = [
  {
    title: '1. Information Collected',
    body: 'Lunara Sports does not require user accounts, registration, or login. We do not collect personal information such as names, email addresses, or passwords. The only data stored is your display preferences (theme, favorite team, sound settings) saved locally in your browser via localStorage.'
  },
  {
    title: '2. Cookies & Local Storage',
    body: 'We use browser localStorage to persist your preferences across sessions. This includes: favorite team selection, sound enabled/disabled state, arena visual intensity, font size, reduced motion preference, refresh interval, and timezone setting. No tracking cookies are used. You can clear all stored data by clearing your browser\'s site data.'
  },
  {
    title: '3. Third-Party Services',
    body: 'Lunara Sports retrieves sports data from ESPN\'s publicly available API (espn.com). We load fonts from Google Fonts (fonts.google.com). These third-party services have their own privacy policies. We do not share any user data with these services \u2014 requests are read-only data fetches.'
  },
  {
    title: '4. Analytics',
    body: 'Lunara Sports does not currently use any analytics, tracking, or telemetry services. No usage data, page views, click events, or behavioral information is collected or transmitted to any server.'
  },
  {
    title: '5. Data Sharing',
    body: 'We do not sell, trade, rent, or otherwise share any user data with third parties. Since we do not collect personal data, there is nothing to share. All preference data remains exclusively in your browser.'
  },
  {
    title: '6. Children\'s Privacy',
    body: 'Lunara Sports is a general-audience informational service. We do not knowingly collect information from children under 13. Since no personal data is collected from any user, no special provisions for children\'s data are necessary.'
  },
  {
    title: '7. Changes to This Policy',
    body: 'We may update this Privacy Policy from time to time. Changes will be reflected on this page with an updated revision date. Continued use of the Service after changes constitutes acceptance of the updated policy.'
  },
  {
    title: '8. Contact',
    body: 'If you have questions or concerns about this Privacy Policy, please reach out through the project\'s GitHub repository or contact the development team directly.'
  }
];

export default function PrivacyPage() {
  return (
    <div className="animate-intel">
      {/* Jumbotron */}
      <div className="relative mb-12 overflow-hidden rounded-[2rem] liquid-mirror p-12">
        <div className="absolute inset-0 jumbotron-grid opacity-30 pointer-events-none" />
        <div className="relative z-10 flex items-center gap-6">
          <div className="h-16 w-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
            <Shield className="h-8 w-8 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-4xl font-black text-jumbotron uppercase tracking-tight">Privacy Policy</h1>
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
