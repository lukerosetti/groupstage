import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { C } from '../lib/colors';
import { collectionGroup, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { saveLocalUser, addKnownPool } from '../lib/localUser';
import useLocalUser from '../hooks/useLocalUser';

export default function RecoverPage() {
  const navigate = useNavigate();
  const { setUser } = useLocalUser();
  const [email, setEmail] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleRecover(e) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError('');
    try {
      const q = query(collectionGroup(db, 'members'), where('email', '==', email.trim().toLowerCase()));
      const snap = await getDocs(q);

      // Fetch pool names in parallel
      const found = await Promise.all(snap.docs.map(async d => {
        const poolId = d.ref.parent.parent.id;
        let poolName = poolId;
        try {
          const poolSnap = await getDoc(doc(db, 'pools', poolId));
          if (poolSnap.exists()) poolName = poolSnap.data().name || poolId;
        } catch { /* fallback to id */ }
        return { memberId: d.id, poolId, poolName, ...d.data() };
      }));

      setResults(found);
      if (found.length === 0) setError('No pools found for that email.');
    } catch (err) {
      setError('Error searching. Check your connection.');
    } finally {
      setLoading(false);
    }
  }

  function restore(member) {
    saveLocalUser({ name: member.name, email: member.email, memberId: member.memberId });
    setUser({ name: member.name, email: member.email, memberId: member.memberId });
    addKnownPool(member.poolId, member.poolName);
    navigate(`/p/${member.poolId}`);
  }

  return (
    <div className="px-6 py-12 max-w-lg mx-auto">
      <div className="mb-8">
        <div className="text-xs uppercase tracking-widest font-semibold mb-2" style={{ color: C.muted }}>Session recovery</div>
        <h2 className="font-display text-4xl" style={{ fontWeight: 700 }}>
          Restore your <span className="font-italic-serif" style={{ color: C.navy }}>session.</span>
        </h2>
        <p className="mt-3 text-sm" style={{ color: C.muted }}>
          Enter the email you used when you joined your pool. We'll find it and restore your access.
        </p>
      </div>

      <form onSubmit={handleRecover} className="card-lg p-6 space-y-4">
        <input type="email" value={email} onChange={e => setEmail(e.target.value)}
          placeholder="you@email.com"
          className="w-full p-3 rounded-lg text-sm font-medium outline-none"
          style={{ background: C.bg, border: `1px solid ${C.border}` }} />
        {error && <div className="text-sm" style={{ color: C.red }}>{error}</div>}
        <button type="submit" disabled={loading}
          className="w-full py-3 rounded-lg font-semibold"
          style={{ background: C.navy, color: 'white', opacity: loading ? 0.6 : 1 }}>
          {loading ? 'Searching…' : 'Find my pools'}
        </button>
      </form>

      {results && results.length > 0 && (
        <div className="mt-6 card-lg overflow-hidden">
          <div className="px-5 pt-4 pb-2 text-xs uppercase tracking-widest font-semibold" style={{ color: C.muted }}>
            Found {results.length} pool{results.length !== 1 ? 's' : ''}
          </div>
          <div style={{ borderTop: `1px solid ${C.border}` }}>
            {results.map(m => (
              <button key={m.memberId} onClick={() => restore(m)}
                className="w-full text-left px-5 py-4 flex items-center justify-between gap-3"
                style={{ borderBottom: `1px solid ${C.border}` }}>
                <div className="min-w-0">
                  <div className="font-semibold text-sm">{m.poolName}</div>
                  <div className="text-xs mt-0.5" style={{ color: C.muted }}>Playing as <strong>{m.name}</strong></div>
                </div>
                <span className="text-sm font-semibold shrink-0" style={{ color: C.navy }}>Restore →</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
