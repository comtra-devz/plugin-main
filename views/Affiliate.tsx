import React, { useState, useEffect } from 'react';
import { BRUTAL, COLORS, AUTH_BACKEND_URL, buildCheckoutUrl } from '../constants';
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
        if (!cancelled) setError('Impossibile caricare il programma affiliati.');
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
        setError(data.error || 'Registrazione fallita.');
      }
    } catch {
      setError('Registrazione fallita.');
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
          <p className="text-sm text-gray-600">Accedi con Figma per ottenere il tuo codice affiliato e condividere Comtra.</p>
        </div>
      </div>
    );
  }

  if (!user.authToken) {
    return (
      <div className="p-4 pb-16">
        <div className={`${BRUTAL.card} bg-white`}>
          <h2 className="text-2xl font-black uppercase mb-2 bg-black text-white inline-block px-2">Partner Program</h2>
          <p className="text-sm text-gray-600">Effettua il login (Login with Figma) per ottenere il tuo codice affiliato.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 pb-16 flex flex-col gap-6">
      <div className={`${BRUTAL.card} bg-white`}>
        <h2 className="text-2xl font-black uppercase mb-1 bg-black text-white inline-block px-2">Partner Program</h2>
        <p className="text-xs text-gray-600 mb-6 font-medium mt-2">
          Condividi Comtra: quando qualcuno acquista con il tuo link, viene attribuito a te. Le metriche sono nel tuo profilo (Affiliates).
        </p>

        {error && (
          <p className="text-xs text-red-600 font-bold mb-2 bg-red-50 border border-red-200 px-2 py-1">{error}</p>
        )}

        {loading ? (
          <p className="text-sm text-gray-500">Caricamento…</p>
        ) : !affiliateCode ? (
          <div className="bg-[#f0f0f0] border-2 border-black p-4">
            <p className="text-xs text-gray-600 mb-2">Non hai ancora un codice affiliato. Registrati in un click.</p>
            <button
              onClick={handleGetCode}
              disabled={registering}
              className={`${BRUTAL.btn} bg-[${COLORS.primary}] font-bold uppercase text-sm py-2 px-4 border-2 border-black disabled:opacity-60`}
            >
              {registering ? 'Registrazione…' : 'Ottieni il tuo codice affiliato'}
            </button>
          </div>
        ) : (
          <>
            <div className="bg-[#f0f0f0] border-2 border-black p-4 mb-4">
              <label className="text-[10px] font-bold uppercase text-gray-500 mb-1 block">Il tuo codice</label>
              <code className="block bg-white border border-gray-400 p-2 font-mono text-sm font-bold">{affiliateCode}</code>
            </div>
            <div className="border-t-2 border-dashed border-black pt-4">
              <label className="text-[10px] font-bold uppercase text-gray-500 mb-1 block">Link da condividere</label>
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
                  {copied ? 'Copiato' : 'Copia'}
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
