import React from 'react';
import { BRUTAL } from '../constants';

export const Terms: React.FC = () => {
  return (
    <div className="p-4 pb-24 flex flex-col gap-6">
      <div className={`${BRUTAL.card} bg-white`}>
        <h2 className="text-2xl font-black uppercase mb-4 bg-black text-white inline-block px-2">Terms & Conditions</h2>
        
        <div className="space-y-4 text-xs leading-relaxed font-medium text-gray-700">
          <p>
            <strong className="block text-black uppercase mb-1">1. Audit Data Caching</strong>
            To improve performance and sustainability, audit scan results are cached for 1 hour. This means if you navigate away from a selected frame and return within this timeframe, you will see the existing report without consuming additional credits. Data is automatically flushed after 1 hour.
          </p>
          
          <p>
            <strong className="block text-black uppercase mb-1">2. Credits & Usage</strong>
            Credits are consumed upon initiating actions (e.g., Scan, Generate, Fix). Unused credits for the Free Tier reset monthly. Pro Tier credits depend on the active subscription cycle.
          </p>
          
          <p>
            <strong className="block text-black uppercase mb-1">3. Liability</strong>
            Comtra provides suggestions based on AI analysis. Users are responsible for verifying the generated code and design changes before production deployment.
          </p>

          <p>
            <strong className="block text-black uppercase mb-1">4. Cookies</strong>
            We use technical cookies essential for the functionality of the plugin (session management). No third-party advertising cookies are used.
          </p>
        </div>
        
        <div className="mt-6 pt-4 border-t-2 border-dashed border-black text-[10px] text-gray-500">
          Last updated: October 2023
        </div>
      </div>
    </div>
  );
};