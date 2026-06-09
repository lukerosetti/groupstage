import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowUpRight, Users } from 'lucide-react';
import { C } from '../lib/colors';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';

export default function HomePage() {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleJoin(e) {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setError('');
    try {
      const q = query(collection(db, 'pools'), where('inviteCode', '==', code.trim().toLowerCase()));
      const snap = await getDocs(q);
      if (snap.empty) { setError('No pool found with that code.'); return; }
      navigate(`/p/${snap.docs[0].id}/join`);
    } catch (err) {
      setError('Error finding pool. Check your connection.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <section className="px-6 pt-14 pb-16">
        <div className="grid lg:grid-cols-12 gap-10 items-center max-w-7xl mx-auto">
          <div className="lg:col-span-7">
            <div className="flex items-center gap-3 mb-6 fade-1">
              <div className="px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-2" style={{ background: 'rgba(200,37,44,0.1)', color: C.red }}>
                <div className="w-1.5 h-1.5 rounded-full pulse-dot" style={{ background: C.red }} />
                Tournament live
              </div>
              <span className="text-sm" style={{ color: C.muted }}>Jun 11 — Jul 19 · USA · Mexico · Canada</span>
            </div>
            <h1 className="font-display fade-2" style={{ fontSize: 'clamp(2.5rem, 6.5vw, 5.5rem)', lineHeight: 1, fontWeight: 800 }}>
              Pick the champions.<br />
              <span className="font-italic-serif" style={{ fontWeight: 500, color: C.navy }}>Beat your friends.</span>
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-relaxed fade-3" style={{ color: C.muted }}>
              Build your roster, start a pool, and track every match across North America. Forty-eight nations, one tournament, one winner in your group chat.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link to="/create"
                className="text-white px-6 py-3.5 rounded-lg font-semibold flex items-center gap-2 no-underline"
                style={{ background: C.navy }}>
                Create a pool <ArrowUpRight size={16} />
              </Link>

              <form onSubmit={handleJoin} className="flex gap-2">
                <input
                  value={code}
                  onChange={e => setCode(e.target.value)}
                  placeholder="Enter pool code"
                  className="card px-4 py-3.5 text-sm font-medium outline-none rounded-lg"
                  style={{ minWidth: 160 }}
                />
                <button type="submit" disabled={loading}
                  className="px-4 py-3.5 rounded-lg font-semibold text-sm"
                  style={{ background: C.ink, color: 'white', opacity: loading ? 0.6 : 1 }}>
                  Join
                </button>
              </form>
            </div>
            {error && <div className="mt-3 text-sm" style={{ color: C.red }}>{error}</div>}
            <div className="mt-5">
              <Link to="/recover" className="text-sm" style={{ color: C.muted }}>
                Lost access? Restore session with your email →
              </Link>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="card-lg p-7 soft-shadow relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1" style={{ background: `linear-gradient(90deg, ${C.red}, ${C.navy})` }} />
              <div className="flex justify-between items-start mb-6">
                <div>
                  <div className="text-xs uppercase tracking-widest font-semibold" style={{ color: C.muted }}>How it works</div>
                  <div className="font-display text-xl mt-1" style={{ fontWeight: 700 }}>4 easy steps</div>
                </div>
              </div>
              <ol className="space-y-4">
                {[
                  { n: '01', title: 'Create a pool', desc: 'Name it, share the invite code with up to 4 friends.' },
                  { n: '02', title: 'Pick your teams', desc: 'Each member selects teams from all 48 in the tournament.' },
                  { n: '03', title: 'Track the matches', desc: "Live scores update automatically. See who's winning your pool." },
                  { n: '04', title: 'Claim the crown', desc: 'Most points when the final whistle blows wins.' },
                ].map(s => (
                  <li key={s.n} className="flex items-start gap-4">
                    <div className="font-display text-2xl shrink-0" style={{ fontWeight: 800, color: C.gold }}>{s.n}</div>
                    <div>
                      <div className="font-semibold">{s.title}</div>
                      <div className="text-sm mt-0.5" style={{ color: C.muted }}>{s.desc}</div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
