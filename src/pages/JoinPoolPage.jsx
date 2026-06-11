import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Check, ArrowUpRight, Copy, Link as LinkIcon } from 'lucide-react';
import { C } from '../lib/colors';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { usePool } from '../hooks/usePool';
import { saveLocalUser, addKnownPool } from '../lib/localUser';
import useLocalUser from '../hooks/useLocalUser';

export default function JoinPoolPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { pool, members, loading } = usePool(id);
  const { setUser } = useLocalUser();

  const [email, setEmail]   = useState('');
  const [error, setError]   = useState('');
  const [claimed, setClaimed] = useState(false);
  // Stored after a successful claim so the recovery screen can build the link
  const [claimedMeta, setClaimedMeta] = useState(null); // { memberId, name, email }

  // Find the member slot that matches the email input
  const matchedMember = members.find(m => m.email && m.email === email.trim().toLowerCase());

  function handleClaim(e) {
    e.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) { setError('Enter your email.'); return; }

    // Use already-loaded members — no extra Firestore query needed.
    const matched = members.find(m => m.email && m.email === normalizedEmail);
    if (!matched) {
      setError(
        "No slot found for that email. Make sure you're using the exact email the commissioner registered for you — " +
        "or ask them to check the member list."
      );
      return;
    }

    // Set identity synchronously — this must never be gated on a Firestore write.
    saveLocalUser({ name: matched.name, email: matched.email, memberId: matched.id });
    setUser({ name: matched.name, email: matched.email, memberId: matched.id });
    addKnownPool(id, pool?.name);
    setClaimedMeta({ memberId: matched.id, name: matched.name, email: matched.email || '' });
    setClaimed(true);

    // Update joined status in the background — best-effort, non-blocking.
    updateDoc(doc(db, 'pools', id, 'members', matched.id), { status: 'joined' })
      .catch(err => console.warn('Status update failed (non-fatal):', err));
  }

  if (loading) return <div className="px-6 py-20 text-center" style={{ color: C.muted }}>Loading…</div>;
  if (!pool)   return <div className="px-6 py-20 text-center" style={{ color: C.red }}>Pool not found.</div>;

  if (claimed && claimedMeta) {
    return (
      <RecoveryReminder
        poolId={id}
        poolName={pool?.name}
        meta={claimedMeta}
        onContinue={() => navigate(`/p/${id}`)}
      />
    );
  }

  return (
    <div className="px-6 py-12 max-w-lg mx-auto">
      <div className="mb-8">
        <div className="text-xs uppercase tracking-widest font-semibold mb-2" style={{ color: C.muted }}>You're invited</div>
        <h2 className="font-display text-4xl" style={{ fontWeight: 700 }}>
          Join <span className="font-italic-serif" style={{ color: C.navy }}>{pool.name}</span>
        </h2>
        <p className="mt-3 text-sm" style={{ color: C.muted }}>
          Enter your email to claim your spot — or to get back in on a new device.
        </p>
      </div>

      {/* Member list */}
      <div className="card-lg p-5 mb-6">
        <div className="text-xs uppercase tracking-widest font-semibold mb-3" style={{ color: C.muted }}>
          {members.length} member{members.length !== 1 ? 's' : ''} in this pool
        </div>
        <div className="space-y-2">
          {members.map(m => (
            <div key={m.id} className="flex items-center gap-3 p-2.5 rounded-lg"
              style={{ background: m.email === email.trim().toLowerCase() ? 'rgba(30,58,111,0.06)' : C.bg }}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                style={{ background: m.color }}>
                {m.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1">
                <div className="font-semibold text-sm">{m.name}</div>
                <div className="text-xs" style={{ color: C.muted }}>{m.email}</div>
              </div>
              {m.status === 'joined'
                ? <span className="text-xs font-semibold" style={{ color: C.green }}>✓ Joined</span>
                : <span className="text-xs" style={{ color: C.muted }}>Invited</span>
              }
            </div>
          ))}
        </div>
      </div>

      {/* Claim form */}
      <form onSubmit={handleClaim} className="card-lg p-6 space-y-4">
        <div className="text-xs uppercase tracking-widest font-semibold" style={{ color: C.muted }}>
          Enter your email
        </div>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)}
          placeholder="your@email.com"
          className="w-full p-3 rounded-lg text-sm font-medium outline-none"
          style={{ background: C.bg, border: `1px solid ${matchedMember ? C.green : C.border}` }} />

        {matchedMember && (
          <div className="flex items-center gap-2 text-sm" style={{ color: C.green }}>
            <Check size={14} />
            Matched to <strong>{matchedMember.name}</strong>
          </div>
        )}

        {error && <div className="text-sm" style={{ color: C.red }}>{error}</div>}

        <button type="submit"
          className="w-full py-3 rounded-lg font-semibold flex items-center justify-center gap-2"
          style={{ background: C.navy, color: 'white' }}>
          Confirm & join pool
          <ArrowUpRight size={16} />
        </button>
      </form>

      <div className="mt-4 text-xs text-center" style={{ color: C.muted }}>
        Don't see your name? Ask the commissioner to add your email to the member list.
      </div>
    </div>
  );
}

// ── Recovery reminder shown immediately after joining ─────────────────────────
function RecoveryReminder({ poolId, poolName, meta, onContinue }) {
  const [copied, setCopied] = useState(false);

  // The pool join link is the recovery link — user just enters their email
  const recoveryLink = `${window.location.origin}/p/${poolId}/join${poolName ? `?pool=${encodeURIComponent(poolName)}` : ''}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(recoveryLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked */
    }
  }

  return (
    <div className="px-6 py-12 max-w-md mx-auto">
      {/* Success header */}
      <div className="flex flex-col items-center text-center mb-8">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
          style={{ background: C.green }}>
          <Check size={28} color="white" />
        </div>
        <div className="font-display text-3xl mb-1" style={{ fontWeight: 700 }}>You're in!</div>
        <div className="text-sm" style={{ color: C.muted }}>
          Playing as <strong>{meta.name}</strong> in <strong>{poolName}</strong>
        </div>
      </div>

      {/* Recovery link card */}
      <div className="card-lg p-5 mb-4">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: 'rgba(30,58,111,0.1)' }}>
            <LinkIcon size={16} style={{ color: C.navy }} />
          </div>
          <div>
            <div className="font-semibold text-sm mb-0.5">Bookmark this link</div>
            <div className="text-xs leading-relaxed" style={{ color: C.muted }}>
              On a new device or after clearing your browser? Open this link and enter
              your email (<strong>{meta.email || 'the one you just used'}</strong>) to get back in instantly.
            </div>
          </div>
        </div>

        {/* Link preview */}
        <div className="rounded-lg px-3 py-2 mb-3 font-mono text-xs truncate"
          style={{ background: C.bg, color: C.muted, border: `1px solid ${C.border}` }}>
          {recoveryLink}
        </div>

        <button onClick={copyLink}
          className="w-full py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2"
          style={{ background: copied ? C.green : C.navy, color: 'white', transition: 'background 0.2s' }}>
          <Copy size={14} />
          {copied ? 'Copied!' : 'Copy link'}
        </button>
      </div>

      <button onClick={onContinue}
        className="w-full py-3 rounded-lg font-semibold flex items-center justify-center gap-2"
        style={{ background: C.navy, color: 'white' }}>
        Go to {poolName || 'pool'}
        <ArrowUpRight size={16} />
      </button>
    </div>
  );
}
