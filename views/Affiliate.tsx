import React, { useState, useEffect } from 'react';
import { AUTH_BACKEND_URL, buildCheckoutUrl } from '../constants';
import { Button } from '../components/ui/Button';
import { User } from '../types';

interface Props {
  user: User | null;
}

export const Affiliate: React.FC<Props> = ({ user }) => {
  const [affiliateCode, setAffiliateCode] = useState<string | null>(null);
  const [totalReferrals, setTotalReferrals] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user?.authToken) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setError(null);
      try {
        const r = await fetch(`${AUTH_BACKEND_URL}/api/affiliates/me`, {
          headers: { Authorization: `Bearer ${user.authToken}` },
        });
        if (cancelled) return;
        if (r.ok) {
          const data = await r.json();
          setAffiliateCode(data.affiliate_code || null);
          setTotalReferrals(data.total_referrals ?? 0);
        } else {
          setAffiliateCode(null);
        }
      } catch (e) {
        if (!cancelled) setError('Could not load the affiliate program.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.authToken]);

  const handleGetCode = async () => {
    if (!user?.authToken) return;
    setRegistering(true);
    setError(null);
    try {
      const r = await fetch(`${AUTH_BACKEND_URL}/api/affiliates/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.authToken}` },
        body: '{}',
      });
      const data = await r.json().catch(() => ({}));
      if (r.ok && data.affiliate_code) {
        setAffiliateCode(data.affiliate_code);
        setTotalReferrals(0);
      } else {
        setError(data.error || 'Registration failed.');
      }
    } catch {
      setError('Registration failed.');
    } finally {
      setRegistering(false);
    }
  };

  const referralLink = affiliateCode ? buildCheckoutUrl('6m', affiliateCode) : '';
  const handleCopy = () => {
    if (!referralLink) return;
    const ta = document.createElement('textarea');
    ta.value = referralLink;
    ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try { document.execCommand('copy'); } catch (_) {}
    document.body.removeChild(ta);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!user) {
    return (
      <div className="p-4 pb-16">
        <div className={`${BRUTAL.card} bg-white`}>
          <h2 className="text-2xl font-black uppercase mb-2 bg-black text-white inline-block px-2">Partner Program</h2>
          <p className="text-sm text-gray-600">Sign in with Figma to get your affiliate code and share Comtra.</p>
        </div>
      </div>
    );
  }

  if (!user.authToken) {
    return (
      <div className="p-4 pb-16">
        <div className={`${BRUTAL.card} bg-white`}>
          <h2 className="text-2xl font-black uppercase mb-2 bg-black text-white inline-block px-2">Partner Program</h2>
          <p className="text-sm text-gray-600">Log in (Login with Figma) to get your affiliate code.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 pb-16 flex flex-col gap-6">
      <div className={`${BRUTAL.card} bg-white`}>
        <h2 className="text-2xl font-black uppercase mb-1 bg-black text-white inline-block px-2">Partner Program</h2>
        <p className="text-xs text-gray-600 mb-6 font-medium mt-2">
          Share Comtra: when someone buys with your link, it's attributed to you. Metrics are in your profile (Affiliates).
        </p>

        {error && (
          <p className="text-xs text-red-600 font-bold mb-2 bg-red-50 border border-red-200 px-2 py-1">{error}</p>
        )}

        {loading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : !affiliateCode ? (
          <div className="bg-[#f0f0f0] border-2 border-black p-4">
            <p className="text-xs text-gray-600 mb-2">You don't have an affiliate code yet. Sign up in one click.</p>
            <Button
              variant="primary"
              layout="row"
              onClick={handleGetCode}
              disabled={registering}
              className="font-bold uppercase text-sm"
            >
              {registering ? 'Registering…' : 'Get your affiliate code'}
            </Button>
          </div>
        ) : (
          <>
            <div className="bg-[#f0f0f0] border-2 border-black p-4 mb-4">
              <label className="text-[10px] font-bold uppercase text-gray-500 mb-1 block">Your code</label>
              <code className="block bg-white border border-gray-400 p-2 font-mono text-sm font-bold">{affiliateCode}</code>
            </div>
            <div className="border-t-2 border-dashed border-black pt-4">
              <label className="text-[10px] font-bold uppercase text-gray-500 mb-1 block">Link to share</label>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={referralLink}
                  className="flex-1 bg-white border-2 border-black p-2 font-mono text-[10px] truncate"
                />
                <button
                  onClick={handleCopy}
                  className="bg-black text-white px-3 py-2 text-[10px] font-bold uppercase hover:bg-[#ff90e8] hover:text-black transition-colors border-2 border-black"
                >
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
            {totalReferrals > 0 && (
              <p className="text-xs font-bold uppercase mt-4 text-gray-600">
                Referral attribuiti: <span className="text-black">{totalReferrals}</span>
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
};
