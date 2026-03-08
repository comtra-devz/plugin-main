import { useEffect, useState } from 'react';
import { fetchAffiliates, type AdminAffiliate } from '../api';
import PageHeader from '../components/PageHeader';

export default function Affiliates() {
  const [data, setData] = useState<{ total: number; affiliates: AdminAffiliate[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAffiliates()
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) return <p className="loading">Caricamento…</p>;
  if (error) return <p className="error">{error}</p>;
  if (!data) return null;

  return (
    <>
      <PageHeader title="Affiliati" />
      <p style={{ color: 'var(--muted)', marginBottom: '1rem' }}>
        Totale: <strong>{data.total}</strong> · Referral totali: <strong>{data.affiliates.reduce((s, a) => s + a.total_referrals, 0)}</strong>
      </p>

      {data.affiliates.length === 0 ? (
        <p className="loading">Nessun affiliato.</p>
      ) : (
        <div className="brutal-table-wrap">
          <table className="brutal-table">
            <thead>
              <tr>
                <th scope="col">Codice</th>
                <th scope="col">Referral</th>
                <th scope="col">Guadagni (cent)</th>
                <th scope="col">Registrato</th>
              </tr>
            </thead>
            <tbody>
              {data.affiliates.map((a) => (
                <tr key={a.affiliate_code}>
                  <td className="mono">{a.affiliate_code}</td>
                  <td>{a.total_referrals}</td>
                  <td>{a.total_earnings_cents}</td>
                  <td>
                    {new Date(a.created_at).toLocaleDateString('it-IT', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
