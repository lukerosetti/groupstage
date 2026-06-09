import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { C } from '../lib/colors';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { usePool } from '../hooks/usePool';
import { saveLocalUser, addKnownPool } from '../lib/localUser';
import useLocalUser from '../hooks/useLocalUser';

const MEMBER_COLORS = ['#C8252C', '#1E3A6F', '#3A8E5C', '#C9A14A', '#7C3AED', '#0891B2'];

export default function JoinPoolPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { pool, members, loading } = usePool(id);
  const { setUser } = useLocalUser();
  const [form, setForm] = useState({ name: '', email: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleJoin(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) { setError('Fill in all fields.'); return; }
    setSubmitting(true);
    setError('');
    try {
      const color = MEMBER_COLORS[members.length % MEMBER_COLORS.length];
      const memberRef = await addDoc(collection(db, 'pools', id, 'members'), {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        color,
        teams: [],
        draftedAt: null,
        role: 'member',
      });
      saveLocalUser({ name: form.name.trim(), email: form.email.trim().toLowerCase(), memberId: memberRef.id });
      setUser({ name: form.name.trim(), email: form.email.trim().toLowerCase(), memberId: memberRef.id });
      addKnownPool(id);
      navigate(`/p/${id}/draft`);
    } catch {
      setError('Failed to join. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="px-6 py-20 text-center" style={{ color: C.muted }}>Loading pool…</div>;
  if (!pool) return <div className="px-6 py-20 text-center" style={{ color: C.red }}>Pool not found.</div>;

  return (
    <div className="px-6 py-12 max-w-lg mx-auto">
      <div className="mb-8">
        <div className="text-xs uppercase tracking-widest font-semibold mb-2" style={{ color: C.muted }}>You're invited</div>
        <h2 className="font-display text-4xl" style={{ fontWeight: 700 }}>
          Join <span className="font-italic-serif" style={{ color: C.navy }}>{pool.name}</span>
        </h2>
      </div>

      <div className="card-lg p-6 mb-6">
        <div className="text-xs uppercase tracking-widest font-semibold mb-3" style={{ color: C.muted }}>Members joined</div>
        <div className="space-y-2">
          {members.map(m => (
            <div key={m.id} className="flex items-center gap-3 p-2.5 rounded-lg" style={{ background: C.bg }}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                style={{ background: m.color }}>
                {m.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <span className="font-semibold text-sm">{m.name}</span>
              {m.teams?.length > 0 && <span className="text-xs ml-auto" style={{ color: C.green }}>✓ picked teams</span>}
            </div>
          ))}
          {members.length < pool.memberCount && (
            <div className="p-2.5 rounded-lg border-2 border-dashed text-sm" style={{ borderColor: C.border, color: C.muted }}>
              {pool.memberCount - members.length} spot{pool.memberCount - members.length !== 1 ? 's' : ''} remaining
            </div>
          )}
        </div>
      </div>

      <form onSubmit={handleJoin} className="card-lg p-6 space-y-4">
        <div className="text-xs uppercase tracking-widest font-semibold mb-1" style={{ color: C.muted }}>Your details</div>
        <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          placeholder="Your name"
          className="w-full p-3 rounded-lg text-sm font-medium outline-none"
          style={{ background: C.bg, border: `1px solid ${C.border}` }} />
        <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
          placeholder="Your email (for recovery)"
          className="w-full p-3 rounded-lg text-sm font-medium outline-none"
          style={{ background: C.bg, border: `1px solid ${C.border}` }} />
        {error && <div className="text-sm" style={{ color: C.red }}>{error}</div>}
        <button type="submit" disabled={submitting}
          className="w-full py-3 rounded-lg font-semibold flex items-center justify-center gap-2"
          style={{ background: C.navy, color: 'white', opacity: submitting ? 0.6 : 1 }}>
          Join pool · Pick teams <ArrowUpRight size={16} />
        </button>
      </form>
    </div>
  );
}
