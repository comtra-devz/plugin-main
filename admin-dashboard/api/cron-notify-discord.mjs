/**
 * Endpoint invocato dal cron Vercel per inviare le notifiche admin su Discord.
 * GET /api/cron-notify-discord
 * Auth: Vercel invia Authorization: Bearer <CRON_SECRET>; oppure ?key=<CRON_SECRET>.
 *
 * Env (progetto dashboard): CRON_SECRET, ADMIN_SECRET, ADMIN_NOTIFICATIONS_WEBHOOK_URL.
 * Opzionale: VERCEL_URL (usato come base per chiamare /api/admin).
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const cronSecret = process.env.CRON_SECRET || '';
  const authHeader = (req.headers.authorization || '').trim();
  const queryKey = (req.query?.key || '').trim();
  const valid =
    cronSecret &&
    (authHeader === `Bearer ${cronSecret}` || queryKey === cronSecret);

  if (!valid) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const webhookUrl = process.env.ADMIN_NOTIFICATIONS_WEBHOOK_URL || '';
  const adminSecret = process.env.ADMIN_SECRET || '';

  if (!webhookUrl || !webhookUrl.startsWith('https://discord.com/api/webhooks/')) {
    return res.status(500).json({
      error: 'ADMIN_NOTIFICATIONS_WEBHOOK_URL non configurato o non valido',
    });
  }
  if (!adminSecret) {
    return res.status(500).json({ error: 'ADMIN_SECRET non configurato' });
  }

  const baseUrl =
    process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : (process.env.VITE_ADMIN_API_URL || '').replace(/\/$/, '');
  if (!baseUrl) {
    return res.status(500).json({
      error: 'Impostare VERCEL_URL (automatico su Vercel) o VITE_ADMIN_API_URL',
    });
  }

  let data;
  try {
    const apiRes = await fetch(`${baseUrl}/api/admin?route=notifications`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminSecret}`,
        'X-Admin-Key': adminSecret,
      },
    });
    if (!apiRes.ok) {
      const text = await apiRes.text().catch(() => '');
      throw new Error(`API admin ${apiRes.status}: ${text || 'nessun dettaglio'}`);
    }
    data = await apiRes.json();
  } catch (err) {
    console.error('cron-notify-discord: fetch notifications', err);
    return res.status(502).json({
      error: 'Impossibile leggere le notifiche',
      detail: err instanceof Error ? err.message : String(err),
    });
  }

  const items = Array.isArray(data?.items) ? data.items : [];
  if (!items.length) {
    return res.status(200).json({ ok: true, sent: 0, message: 'Nessuna notifica' });
  }

  const lines = [];
  lines.push('📣 **Comtra — notifiche admin**');
  lines.push('');

  for (const n of items) {
    const when = n.created_at
      ? new Date(n.created_at).toLocaleString('it-IT', {
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '';
    const sev =
      n.severity === 'critical'
        ? '🟥 Critico'
        : n.severity === 'warning'
          ? '🟨 Avviso'
          : '🟦 Info';
    lines.push(`- ${sev} — **${n.title}**`);
    if (n.description) lines.push(`  ${n.description}`);
    if (when) lines.push(`  _(creata il ${when})_`);
    lines.push('');
  }

  const content = lines.join('\n').trim();
  const toSend = content.length > 2000 ? content.slice(0, 1990) + '\n… (troncato)' : content;

  try {
    const discordRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: toSend }),
    });
    if (!discordRes.ok) {
      const text = await discordRes.text().catch(() => '');
      throw new Error(`Discord ${discordRes.status}: ${text || 'errore'}`);
    }
  } catch (err) {
    console.error('cron-notify-discord: Discord webhook', err);
    return res.status(502).json({
      error: 'Errore invio a Discord',
      detail: err instanceof Error ? err.message : String(err),
    });
  }

  return res.status(200).json({ ok: true, sent: items.length });
}
