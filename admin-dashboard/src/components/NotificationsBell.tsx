import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchNotifications, type AdminNotification } from '../api';

export default function NotificationsBell() {
  const [items, setItems] = useState<AdminNotification[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetchNotifications()
      .then((r) => {
        if (!cancelled) setItems(r.items || []);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const total = items.length;
  const critical = items.filter((n) => n.severity === 'critical').length;
  const hasAlerts = total > 0;

  return (
    <Link
      to="/notifications"
      className="notif-bell"
      aria-label={hasAlerts ? `Notifiche: ${total} totali, ${critical} critiche` : 'Nessuna notifica'}
      title="Notifiche"
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 32,
        height: 32,
        borderRadius: 16,
        border: '2px solid var(--black)',
        background: 'var(--white)',
        boxShadow: '2px 2px 0 0 var(--black)',
        textDecoration: 'none',
        fontSize: '1rem',
        marginLeft: '0.5rem',
      }}
    >
      <span aria-hidden="true">🔔</span>
      {hasAlerts && (
        <span
          style={{
            position: 'absolute',
            top: -4,
            right: -4,
            minWidth: 16,
            height: 16,
            padding: '0 3px',
            borderRadius: 999,
            background: critical > 0 ? 'var(--alert)' : 'var(--yellow)',
            color: 'var(--white)',
            border: '2px solid var(--black)',
            fontSize: '0.6rem',
            fontWeight: 800,
            lineHeight: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {total}
        </span>
      )}
    </Link>
  );
}

