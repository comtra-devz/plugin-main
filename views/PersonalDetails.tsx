import React, { useState, useEffect } from 'react';
import { FigmaPatInfoDialog } from '../components/FigmaPatInfoDialog';
import { Button } from '../components/ui/Button';
import { AUTH_BACKEND_URL, BRUTAL } from '../constants';
import { User } from '../types';

interface Props {
  user: User | null;
  onUpdateUser: (patch: Partial<User>) => void;
}

function mergeUserFromApiProfile(user: User, p: {
  name?: string;
  first_name?: string | null;
  surname?: string | null;
  figma_user_id?: string | null;
  has_figma_rest_token?: boolean;
  profile_saved_at?: string | null;
  name_conflict?: User['name_conflict'];
  show_profile_badge?: boolean;
  profile_locked?: boolean;
}): User {
  const nextConflict =
    p.name_conflict !== undefined ? p.name_conflict : user.name_conflict;
  const nextProfileSavedAt =
    p.profile_saved_at !== undefined ? p.profile_saved_at : user.profile_saved_at;
  const nextShowProfileBadge =
    p.show_profile_badge !== undefined
      ? p.show_profile_badge
      : (!nextConflict && nextProfileSavedAt ? false : user.show_profile_badge);
  const first = (p.first_name && String(p.first_name).trim()) || user.first_name;
  const avFrom = (first && String(first).trim()) || (p.name && String(p.name).trim()) || user.name;
  const avatar = (avFrom || 'U').charAt(0).toUpperCase();
  return {
    ...user,
    name: p.name ?? user.name,
    first_name: p.first_name ?? user.first_name,
    surname: p.surname ?? user.surname,
    figma_user_id: p.figma_user_id !== undefined ? p.figma_user_id : user.figma_user_id,
    has_figma_rest_token: p.has_figma_rest_token !== undefined ? p.has_figma_rest_token : user.has_figma_rest_token,
    profile_saved_at: nextProfileSavedAt,
    name_conflict: nextConflict,
    show_profile_badge: nextShowProfileBadge,
    profile_locked: p.profile_locked !== undefined ? p.profile_locked : user.profile_locked,
    avatar,
  };
}

export const PersonalDetails: React.FC<Props> = ({ user, onUpdateUser }) => {
  const [first, setFirst] = useState('');
  const [surname, setSurname] = useState('');
  const [saving, setSaving] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [patToken, setPatToken] = useState('');
  const [patSaving, setPatSaving] = useState(false);
  const [patMsg, setPatMsg] = useState<string | null>(null);
  const [patInfoOpen, setPatInfoOpen] = useState(false);
  const locked = Boolean(user?.profile_locked ?? user?.figma_user_id);
  const c = user?.name_conflict;

  useEffect(() => {
    if (!user) return;
    setFirst(user.first_name || (locked ? (user.name || '').split(/\s+/)[0] : '') || '');
    setSurname(user.surname || (locked && user.name ? user.name.split(/\s+/).slice(1).join(' ') : '') || '');
  }, [user, locked]);


  if (!user) return null;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (locked) return;
    setError(null);
    const fn = first.trim();
    if (!fn) {
      setError('First name is required.');
      return;
    }
    setSaving(true);
    try {
      const r = await fetch(`${AUTH_BACKEND_URL}/api/user/profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.authToken}`,
        },
        body: JSON.stringify({ first_name: fn, surname: surname.trim() || undefined }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(
          d?.message || (d?.error === 'first_name_required' ? 'First name is required.' : 'Could not save.'),
        );
        return;
      }
      if (d?.profile) {
        onUpdateUser(mergeUserFromApiProfile(user, d.profile as Record<string, unknown>));
      }
    } catch {
      setError('Network error.');
    } finally {
      setSaving(false);
    }
  };

  const resolve = async (use: 'figma' | 'keep') => {
    if (!user.authToken) return;
    setResolving(true);
    setError(null);
    try {
      const r = await fetch(`${AUTH_BACKEND_URL}/api/user/profile/resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.authToken}`,
        },
        body: JSON.stringify({ use }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(d?.message || 'Could not update.');
        return;
      }
      if (d?.profile) {
        onUpdateUser(mergeUserFromApiProfile(user, d.profile as Record<string, unknown>));
      }
    } catch {
      setError('Network error.');
    } finally {
      setResolving(false);
    }
  };

  const savePersonalAccessToken = async () => {
    const tok = patToken.trim();
    if (!tok || !user.authToken) return;
    setPatSaving(true);
    setPatMsg(null);
    try {
      const r = await fetch(`${AUTH_BACKEND_URL}/api/figma/personal-access-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.authToken}`,
        },
        body: JSON.stringify({ token: tok }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setPatMsg(typeof d?.error === 'string' ? d.error : 'Could not save token.');
        return;
      }
      setPatMsg('Saved. Audits will use Figma REST like OAuth.');
      setPatToken('');
      onUpdateUser({ ...user, has_figma_rest_token: true });
    } catch {
      setPatMsg('Network error.');
    } finally {
      setPatSaving(false);
    }
  };

  return (
    <div className="p-4 flex flex-col min-h-0">
      <h2 className="text-2xl font-black uppercase border-b-2 border-black pb-2 mb-4">Personal details</h2>
      {c && (
        <div className={`${BRUTAL.snackbarWarning} mb-4`}>
          <p className="text-xs font-bold">
            Figma is linked. Your name in Comtra was different from your Figma account name. Choose one:
          </p>
          <p className="text-[10px] mt-1">
            Figma: <strong>{c.figma_handle || '—'}</strong> · Saved before: <strong>
              {([c.manual_first, c.manual_surname].filter(Boolean).join(' ')) || '—'}
            </strong>
          </p>
          <div className="flex flex-col gap-2 mt-2">
            <Button type="button" variant="black" className="py-2" disabled={resolving} onClick={() => void resolve('figma')}>
              Use Figma name
            </Button>
            <Button type="button" variant="secondary" className="py-2" disabled={resolving} onClick={() => void resolve('keep')}>
              Keep my name
            </Button>
          </div>
        </div>
      )}
      <form onSubmit={save} className="space-y-4 max-w-sm">
        {locked && (
          <p className="text-xs font-bold text-black/70">These fields come from your Figma account and can’t be changed here.</p>
        )}
        {error && (
          <p className="text-sm font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-1">{error}</p>
        )}
        <div>
          <p className="text-xs font-bold text-black/70 text-left mb-1">First name</p>
          <input
            type="text"
            value={first}
            onChange={(e) => setFirst(e.target.value)}
            disabled={locked}
            className={`${BRUTAL.input} rounded ${locked ? 'opacity-80 cursor-not-allowed' : ''} w-full`}
            autoComplete="given-name"
          />
        </div>
        <div>
          <p className="text-xs font-bold text-black/70 text-left mb-1">Surname (optional)</p>
          <input
            type="text"
            value={surname}
            onChange={(e) => setSurname(e.target.value)}
            disabled={locked}
            className={`${BRUTAL.input} rounded ${locked ? 'opacity-80 cursor-not-allowed' : ''} w-full`}
            autoComplete="family-name"
          />
        </div>
        {!locked && (
          <Button type="submit" variant="black" className="w-full py-3" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        )}
      </form>
      {!user.figma_user_id && (
        <div className={`mt-8 pt-6 border-t-2 border-black max-w-sm`}>
          <h3 className="text-sm font-black uppercase mb-2">Figma file access (audits)</h3>
          <p className="text-[10px] font-medium text-black/80 mb-3 leading-snug">
            Paste a Figma Personal Access Token so scans use the same fast server path as OAuth. Create one under Figma → Settings → Security.
          </p>
          {user.has_figma_rest_token && (
            <p className="text-[10px] font-bold text-green-800 bg-green-50 border border-green-600 px-2 py-1 mb-2">
              Token on file — audits use Figma REST.
            </p>
          )}
          {patMsg && (
            <p className="text-[10px] font-bold text-black bg-[#ffc900] border-2 border-black px-2 py-1 mb-2">{patMsg}</p>
          )}
          <div className="relative mb-2">
            <input
              type="password"
              autoComplete="off"
              placeholder="figd_…"
              value={patToken}
              onChange={(e) => setPatToken(e.target.value)}
              className={`${BRUTAL.input} rounded w-full pr-10 font-mono text-[11px]`}
            />
            <button
              type="button"
              onClick={() => setPatInfoOpen(true)}
              className="absolute right-1 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded border-2 border-black bg-white text-black shadow-[2px_2px_0_0_#000] hover:bg-[#ffc900] focus:outline-none focus:ring-2 focus:ring-black"
              aria-label="Why we need your Figma token"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" aria-hidden>
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4M12 8h.01" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <Button
            type="button"
            variant="black"
            className="w-full py-2"
            disabled={patSaving || !patToken.trim()}
            onClick={() => void savePersonalAccessToken()}
          >
            {patSaving ? 'Saving…' : 'Save Figma token'}
          </Button>
        </div>
      )}
      {patInfoOpen ? <FigmaPatInfoDialog onClose={() => setPatInfoOpen(false)} /> : null}

    </div>
  );
};
