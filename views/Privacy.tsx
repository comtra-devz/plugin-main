import React from 'react';
import { BRUTAL } from '../constants';

export const Privacy: React.FC = () => {
  return (
    <div className="p-4 pb-24 flex flex-col gap-6">
      <div className={`${BRUTAL.card} bg-white`}>
        <h2 className="text-2xl font-black uppercase mb-4 bg-black text-white inline-block px-2">Privacy Policy</h2>
        
        <div className="space-y-4 text-xs leading-relaxed font-medium text-gray-700">
          <p>
            <strong className="block text-black uppercase mb-1">1. Data Collection</strong>
            We only collect data necessary for the functionality of the Comtra plugin, including your Figma user ID and email for authentication purposes. We do not store your design files.
          </p>
          
          <p>
            <strong className="block text-black uppercase mb-1">2. AI Processing</strong>
            Data sent to our AI models (Gemini) is ephemeral. We send prompts derived from your layer names and properties, but we do not use your data to train our models.
          </p>
          
          <p>
            <strong className="block text-black uppercase mb-1">3. Security</strong>
            All connections are encrypted via SSL. Payments are processed securely by Stripe; we do not hold your credit card information.
          </p>

          <p>
            <strong className="block text-black uppercase mb-1">4. Contact</strong>
            For any privacy concerns, please contact privacy@comtra.ai.
          </p>
        </div>
        
        <div className="mt-6 pt-4 border-t-2 border-dashed border-black text-[10px] text-gray-500">
          Last updated: October 2023
        </div>
      </div>
    </div>
  );
};