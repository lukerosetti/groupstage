import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, Check } from 'lucide-react';
import { C } from '../lib/colors';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { saveLocalUser, addKnownPool } from '../lib/localUser';
import useLocalUser from '../hooks/useLocalUser';

function genCode() {
  return Math.random().toString(36).slice(2, 8).toLowerCase();
}

const MEMBER_COLORS = ['#C8252C', '#1E3A6F', '#3A8E5C', '#C9A14A', '#7C3AED', '#0891B2'];

export default function CreatePoolPage() {
  const navigate = useNavigate();
  const { setUser } = useLocalUser();
  const [form, setForm] = useState({ poolName: '', name: '', email: '', memberCount: 4 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.poolName.trim() || !form.name.trim() || !form.email.trim()) {
      setError('Fill in all fields.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const inviteCode = genCode();
      const poolRef = await addDoc(collection(db, 'pools'), {
        name: form.poolName.trim(),
        creatorEmail: form.email.trim().toLowerCase(),
        createdAt: serverTimestamp(),
        memberCount: form.memberCount,
        status: 'setup',
        inviteCode,
      });

      const memberRef = await addDoc(collection(db, 'pools', poolRef.id, 'members'), {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        color: MEMBER_COLORS[0],
        teams: [],
        draftedAt: null,
        role: 'owner',
      });

      saveLocalUser({ name: form.name.trim(), email: form.email.trim().toLowerCase(), memberId: memberRef.id });
      setUser({ name: form.name.trim(), email: form.email.trim().toLowerCase(), memberId: memberRef.id });
      addKnownPool(poolRef.id);
      navigate(`/p/${poolRef.id}/draft`);
    } catch (err) {
      setError('Failed to create pool. Check your connection.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="px-6 py-12 max-w-2xl mx-auto">
      <div className="mb-10">
        <div className="text-xs uppercase tracking-widest font-semibold mb-2" style={{ color: C.muted }}>Set up your pool</div>
        <h2 className="font-display text-5xl" style={{ fontWeight: 700 }}>
          Create a <span className="font-italic-serif" style={{ color: C.navy }}>new pool.</span>
        </h2>
      </div>

      <form onSubmit={handleSubmit}>
        <Section number="01" title="Pool basics">
          <div className="space-y-5">
            <Field label="Pool name">
              <input value={form.poolName} onChange={e => set('poolName', e.target.value)}
                placeholder="e.g. The Breakfast Club"
                className="w-full mt-2 p-3 rounded-lg text-sm font-medium outline-none"
                style={{ background: C.card, border: `1px solid ${C.border}` }} />
            </Field>
            <Field label="Your name">
              <input value={form.name} onChange={e => set('name', e.target.value)}
                placeholder="First Last"
                className="w-full mt-2 p-3 rounded-lg text-sm font-medium outline-none"
                style={{ background: C.card, border: `1px solid ${C.border}` }} />
            </Field>
            <Field label="Your email (used for recovery — no password)">
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                placeholder="you@email.com"
                className="w-full mt-2 p-3 rounded-lg text-sm font-medium outline-none"
                style={{ background: C.card, border: `1px solid ${C.border}` }} />
              <div className="text-xs mt-1.5" style={{ color: C.muted }}>
                Email is only used to restore access if your browser clears. No password, no spam.
              </div>
            </Field>
          </div>
        </Section>

        <Section number="02" title="Pool size">
          <div className="flex gap-2 flex-wrap">
            {[2, 3, 4, 5, 6].map(n => (
              <button key={n} type="button" onClick={() => set('memberCount', n)}
                className="px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors"
                style={{
                  background: form.memberCount === n ? C.navy : C.card,
                  color: form.memberCount === n ? 'white' : C.ink,
                  border: `1px solid ${form.memberCount === n ? C.navy : C.border}`,
                }}>
                {n} people
              </button>
            ))}
          </div>
          <div className="mt-3 text-sm" style={{ color: C.muted }}>
            Each member picks teams from all 48 in the field. More members = tighter competition.
          </div>
        </Section>

        {error && <div className="mb-4 text-sm" style={{ color: C.red }}>{error}</div>}

        <div className="flex justify-end gap-3">
          <button type="submit" disabled={loading}
            className="px-6 py-3 rounded-lg font-semibold flex items-center gap-2"
            style={{ background: C.navy, color: 'white', opacity: loading ? 0.6 : 1 }}>
            {loading ? 'Creating…' : 'Create pool · Pick teams'}
            <ArrowUpRight size={16} />
          </button>
        </div>
      </form>
    </div>
  );
}

function Section({ number, title, children }) {
  return (
    <div className="mb-8">
      <div className="flex items-baseline gap-4 mb-4">
        <div className="font-display text-2xl" style={{ fontWeight: 700, color: C.gold }}>{number}</div>
        <h3 className="font-display text-2xl" style={{ fontWeight: 700 }}>{title}</h3>
      </div>
      <div className="card-lg p-6">{children}</div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-widest font-semibold" style={{ color: C.muted }}>{label}</div>
      {children}
    </div>
  );
}
