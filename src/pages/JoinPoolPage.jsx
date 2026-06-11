import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Check, ArrowUpRight } from 'lucide-react';
import { C } from '../lib/colors';
import { collection, query, where, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { usePool } from '../hooks/usePool';
import { saveLocalUser, addKnownPool } from '../lib/localUser';
import useLocalUser from '../hooks/useLocalUser';

export default function JoinPoolPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { pool, members, loading } = usePool(id);
  const { setUser } = useLocalUser();

  // Pre-fill from invite link query params
  const tokenParam = searchParams.get('token');   // memberId embedded in link
  const emailParam  = searchParams.get('email');

  const [email, setEmail]           = useState(emailParam || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState('');
  const [claimed, setClaimed]       = useState(false);

  // Find the member slot that matches the email input
  const matchedMember = members.find(m => m.email && m.email === email.trim().toLowerCase());

  // If a token is present, auto-claim as soon as pool data loads
  useEffect(() => {
    if (!tokenParam || loading || claimed || !pool) return;
    claimByToken(tokenParam);
  }, [tokenParam, loading, pool]);

  async function claimByToken(memberId) {
    setSubmitting(true);
    setError('');
    try {
      const memberRef  = doc(db, 'pools', id, 'members', memberId);
      const memberSnap = await getDoc(memberRef);
      if (!memberSnap.exists()) {
        setError('Invite link is invalid or expired. Ask the commissioner to re-send it.');
        return;
      }
      const data = memberSnap.data();
      await updateDoc(memberRef, { status: 'joined' });
      saveLocalUser({ name: data.name, email: data.email || '', memberId });
      setUser({ name: data.name, email: data.email || '', memberId });
      addKnownPool(id, pool?.name);
      setClaimed(true);
      setTimeout(() => navigate(`/p/${id}`), 1500);
    } catch {
      setError('Something went wrong. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleClaim(e) {
    e.preventDefault();
    if (!email.trim()) { setError('Enter your email.'); return; }

    setSubmitting(true);
    setError('');
    try {
      const q = query(
        collection(db, 'pools', id, 'members'),
        where('email', '==', email.trim().toLowerCase())
      );
      const snap = await getDocs(q);

      if (snap.empty) {
        setError(
          "No slot found for that email. Make sure you're using the exact email the commissioner registered for you — " +
          "or ask them to check the member list."
        );
        return;
      }

      const memberDoc  = snap.docs[0];
      const memberData = memberDoc.data();

      await updateDoc(doc(db, 'pools', id, 'members', memberDoc.id), { status: 'joined' });
      saveLocalUser({ name: memberData.name, email: memberData.email, memberId: memberDoc.id });
      setUser({ name: memberData.name, email: memberData.email, memberId: memberDoc.id });
      addKnownPool(id, pool?.name);
      setClaimed(true);
      setTimeout(() => navigate(`/p/${id}`), 1500);
    } catch {
      setError('Something went wrong. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="px-6 py-20 text-center" style={{ color: C.muted }}>Loading…</div>;
  if (!pool)   return <div className="px-6 py-20 text-center" style={{ color: C.red }}>Pool not found.</div>;

  if (claimed) {
    return (
      <div className="px-6 py-20 max-w-md mx-auto text-center">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{ background: C.green }}>
          <Check size={28} color="white" />
        </div>
        <div className="font-display text-3xl mb-2" style={{ fontWeight: 700 }}>You're in!</div>
        <div className="text-sm" style={{ color: C.muted }}>Taking you to the pool…</div>
      </div>
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
          Confirm your email to claim your spot. Use the email the commissioner registered for you.
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
          Confirm your email to join
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

        <button type="submit" disabled={submitting}
          className="w-full py-3 rounded-lg font-semibold flex items-center justify-center gap-2"
          style={{ background: C.navy, color: 'white', opacity: submitting ? 0.6 : 1 }}>
          {submitting ? 'Confirming…' : 'Confirm & join pool'}
          <ArrowUpRight size={16} />
        </button>
      </form>

      <div className="mt-4 text-xs text-center" style={{ color: C.muted }}>
        Don't see your name? Ask the commissioner to double-check the email they registered for you.
      </div>
    </div>
  );
}
