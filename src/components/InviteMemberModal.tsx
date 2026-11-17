import { useEffect, useState, type FormEvent } from 'react';
import { Capacitor } from '@capacitor/core';
import QRCode from 'qrcode';
import { homeApi, type Home, type HomeInvitation } from '../services/home';

function shareUrl(code: string) {
  const url = new URL(Capacitor.isNativePlatform() ? 'https://neurolinx.in/neuro-series/' : window.location.href);
  url.hash = new URLSearchParams({ invite: code }).toString();
  return url.toString();
}

export function InviteMemberModal({ home, onClose }: { home: Home; onClose: () => void }) {
  const [email, setEmail] = useState('');
  const [invite, setInvite] = useState<{ id: string; code: string; url: string; qr: string } | null>(null);
  const [pending, setPending] = useState<HomeInvitation[]>([]);
  const [members, setMembers] = useState<{ id: string; full_name: string | null }[]>([]);
  const [memberToRemove, setMemberToRemove] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let ignore = false;
    void Promise.all([homeApi.getInvitations(home.id), homeApi.getMembers(home.id)]).then(([items, currentMembers]) => {
      if (ignore) return;
      setPending(items);
      setMembers(currentMembers);
    }).catch(() => {
      if (!ignore) setError('Pending invitations could not be loaded.');
    });
    return () => { ignore = true; };
  }, [home.id]);

  async function create(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await homeApi.createInvitation(home.id, email.trim() || undefined);
      const url = shareUrl(result.code);
      setInvite({ id: result.id, code: result.code, url, qr: '' });
      setPending(items => [{ id: result.id, home_id: home.id, invited_by: home.owner_id, email, access_level: 'Device control', status: 'pending' }, ...items]);
      const qr = await QRCode.toDataURL(url, { width: 240, margin: 2 });
      setInvite({ id: result.id, code: result.code, url, qr });
    } catch {
      setError('Could not create the invitation or QR code. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await homeApi.revokeInvitation(home.id, id);
      setPending(items => items.filter(item => item.id !== id));
      setInvite(current => current?.id === id ? null : current);
      setNotice('Invitation revoked.');
    } catch {
      setError('Could not revoke the invitation. It may already have been accepted.');
    } finally {
      setBusy(false);
    }
  }

  async function removeMember(id: string) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await homeApi.removeMember(home.id, id);
      setMembers(current => current.filter(member => member.id !== id));
      setMemberToRemove(null);
      setNotice('Member access removed.');
    } catch {
      setError('Could not remove access. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/55 p-4" role="dialog" aria-modal="true" aria-labelledby="invite-title">
      <section className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-5 text-slate-900 sm:p-6">
        <header className="flex items-center justify-between gap-3">
          <h2 id="invite-title" className="text-lg font-bold">Invite someone to {home.name}</h2>
          <button className="min-h-11 font-semibold text-slate-700" onClick={onClose}>Close</button>
        </header>
        <p className="mt-2 text-sm leading-relaxed text-slate-700">
          Members can view rooms and control devices. Each invitation can be used once and expires in seven days.
        </p>
        <form onSubmit={create} className="mt-4 grid gap-3">
          <label className="grid gap-1.5 text-sm font-medium">
            Recipient email (optional)
            <input type="email" maxLength={255} value={email} onChange={event => setEmail(event.target.value)}
              className="min-h-11 rounded-xl border border-slate-300 px-3 text-base" />
          </label>
          <p className="text-xs text-slate-600">Adding an email restricts the invitation to the account with that address.</p>
          <button type="submit" disabled={busy} className="min-h-11 rounded-xl bg-sky-700 px-4 font-semibold text-white disabled:opacity-50">Create invitation</button>
        </form>
        {invite && (
          <div className="mt-4 space-y-3 rounded-2xl bg-slate-50 p-4 text-sm">
            {invite.qr && <img className="mx-auto w-44 rounded-xl" src={invite.qr} alt="Scan to open the invitation" />}
            <label className="grid gap-1 font-medium">
              Invitation link
              <input className="min-h-11 rounded-lg border border-slate-300 bg-white px-2 text-base" value={invite.url} readOnly onFocus={event => event.target.select()} />
            </label>
            <button className="min-h-11 font-semibold text-sky-800" onClick={() => void navigator.clipboard?.writeText(invite.url).then(
              () => setNotice('Link copied.'), () => setError('Copy the link from the field above.')
            )}>Copy link</button>
            <p className="break-all text-slate-700">App invite code <code>{invite.code}</code></p>
          </div>
        )}
        {pending.length > 0 && (
          <section className="mt-5 border-t border-slate-200 pt-4 text-sm">
            <h3 className="font-semibold">Pending invitations</h3>
            <ul className="mt-2 divide-y divide-slate-100">
              {pending.map(item => (
                <li key={item.id} className="flex items-center justify-between gap-3">
                  <span className="break-all text-slate-700">{item.email || 'Invitation link'}</span>
                  <button disabled={busy} onClick={() => void revoke(item.id)} className="min-h-11 shrink-0 font-semibold text-rose-700">Revoke</button>
                </li>
              ))}
            </ul>
          </section>
        )}
        {members.length > 0 && (
          <section className="mt-5 border-t border-slate-200 pt-4 text-sm">
            <h3 className="font-semibold">Members</h3>
            <ul className="mt-2 divide-y divide-slate-100">
              {members.map(member => (
                <li key={member.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span>{member.full_name || 'Neuro Series member'}</span>
                  {memberToRemove === member.id ? (
                    <div className="flex gap-3">
                      <button className="min-h-11" disabled={busy} onClick={() => setMemberToRemove(null)}>Cancel</button>
                      <button className="min-h-11 font-semibold text-rose-700" disabled={busy} onClick={() => void removeMember(member.id)}>Confirm removal</button>
                    </div>
                  ) : (
                    <button className="min-h-11 font-semibold text-rose-700" disabled={busy} onClick={() => setMemberToRemove(member.id)}>Remove access</button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
        {notice && <p role="status" className="mt-3 text-sm text-emerald-800">{notice}</p>}
        {error && <p role="alert" className="mt-3 text-sm text-rose-800">{error}</p>}
      </section>
    </div>
  );
}
