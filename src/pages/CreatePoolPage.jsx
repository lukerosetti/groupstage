import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, Check, Users, Upload, Plus, Trash2, Copy } from 'lucide-react';
import { C } from '../lib/colors';
import { collection, addDoc, serverTimestamp, writeBatch, doc } from 'firebase/firestore';
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

  const [step, setStep]           = useState(1); // 1=basics, 2=members, 3=format
  const [poolName, setPoolName]   = useState('');
  const [creatorName, setCreatorName] = useState('');
  const [creatorEmail, setCreatorEmail] = useState('');
  const [draftFormat, setDraftFormat]  = useState('');
  const [commissionerIdx, setCommissionerIdx] = useState(0); // index into members array
  // Members: creator is always slot 0, pre-filled, locked
  const [members, setMembers] = useState([{ name: '', email: '' }]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [poolId, setPoolId]     = useState(null);   // set after creation, for invite display
  const [memberIds, setMemberIds] = useState([]);   // parallel array to members[], set after creation

  // Keep slot 0 in sync with creator fields
  function setCreator(field, val) {
    if (field === 'name') { setCreatorName(val); setMembers(m => m.map((x, i) => i === 0 ? { ...x, name: val } : x)); }
    if (field === 'email') { setCreatorEmail(val); setMembers(m => m.map((x, i) => i === 0 ? { ...x, email: val } : x)); }
  }

  function addMember() {
    if (members.length >= 8) return;
    setMembers(m => [...m, { name: '', email: '' }]);
  }

  function removeMember(idx) {
    if (idx === 0) return; // can't remove creator
    setMembers(m => m.filter((_, i) => i !== idx));
  }

  function updateMember(idx, field, val) {
    setMembers(m => m.map((x, i) => i === idx ? { ...x, [field]: val } : x));
  }

  function validateStep1() {
    if (!poolName.trim())      { setError('Enter a pool name.'); return false; }
    if (!creatorName.trim())   { setError('Enter your name.'); return false; }
    if (!creatorEmail.trim())  { setError('Enter your email.'); return false; }
    setError(''); return true;
  }

  function validateStep2() {
    for (let i = 0; i < members.length; i++) {
      if (!members[i].name.trim()) { setError(`Enter a name for member ${i + 1}.`); return false; }
    }
    // The commissioner MUST have an email — they need it to recover the pool
    // if their browser is cleared.  Creator email is already required in step 1.
    if (commissionerIdx !== 0 && !members[commissionerIdx]?.email.trim()) {
      const commName = members[commissionerIdx]?.name || `Player ${commissionerIdx + 1}`;
      setError(`${commName} is set as commissioner — their email is required for pool recovery.`);
      return false;
    }
    // Only check for duplicate emails among those that are filled in
    const filledEmails = members.map(m => m.email.trim().toLowerCase()).filter(Boolean);
    if (new Set(filledEmails).size !== filledEmails.length) { setError('Two members have the same email address.'); return false; }
    setError(''); return true;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!draftFormat) { setError('Choose a draft format.'); return; }
    setLoading(true);
    setError('');
    try {
      const inviteCode = genCode();
      const commissionerEmail = members[commissionerIdx]?.email.trim().toLowerCase() || creatorEmail.trim().toLowerCase();
      const poolRef = await addDoc(collection(db, 'pools'), {
        name: poolName.trim(),
        creatorEmail: creatorEmail.trim().toLowerCase(),
        commissionerEmail,
        createdAt: serverTimestamp(),
        memberCount: members.length,
        draftFormat,
        status: 'setup',
        inviteCode,
      });

      // Create all member docs in one batch
      const batch = writeBatch(db);
      const memberIds = [];
      for (let i = 0; i < members.length; i++) {
        const mRef = doc(collection(db, 'pools', poolRef.id, 'members'));
        memberIds.push(mRef.id);
        const mEmail = members[i].email.trim().toLowerCase();
        batch.set(mRef, {
          name: members[i].name.trim(),
          email: mEmail,
          color: MEMBER_COLORS[i % MEMBER_COLORS.length],
          teams: [],
          draftedAt: null,
          role: i === 0 ? 'owner' : 'member',
          isCommissioner: mEmail === commissionerEmail,
          status: i === 0 ? 'joined' : 'invited',
          memberId: mRef.id,
        });
      }
      await batch.commit();

      // Link creator's session
      saveLocalUser({ name: members[0].name.trim(), email: members[0].email.trim().toLowerCase(), memberId: memberIds[0] });
      setUser({ name: members[0].name.trim(), email: members[0].email.trim().toLowerCase(), memberId: memberIds[0] });
      addKnownPool(poolRef.id, poolName.trim());
      setPoolId(poolRef.id);
      setMemberIds(memberIds);  // expose to invite step for token links
      setStep(4);
    } catch (err) {
      setError('Failed to create pool. Check your connection.');
    } finally {
      setLoading(false);
    }
  }

  // ── Invite step (step 4) ────────────────────────────────────────────────
  if (step === 4 && poolId) {
    const poolInviteLink = `${window.location.origin}/p/${poolId}/join?pool=${encodeURIComponent(poolName.trim())}`;
    return (
      <div className="px-6 py-12 max-w-2xl mx-auto">
        <div className="mb-8">
          <div className="text-xs uppercase tracking-widest font-semibold mb-2" style={{ color: C.green }}>✓ Pool created</div>
          <h2 className="font-display text-4xl" style={{ fontWeight: 700 }}>
            Invite your <span className="font-italic-serif" style={{ color: C.navy }}>crew.</span>
          </h2>
          <p className="mt-3 text-sm" style={{ color: C.muted }}>
            Share one link with everyone. Each person enters their email to claim their spot — no per-person links needed.
          </p>
        </div>

        {/* Single invite link */}
        <div className="card-lg p-6 mb-6">
          <div className="text-xs uppercase tracking-widest font-semibold mb-3" style={{ color: C.muted }}>Pool invite link</div>
          <div className="rounded-lg px-3 py-2 mb-3 font-mono text-xs truncate"
            style={{ background: C.bg, color: C.muted, border: `1px solid ${C.border}` }}>
            {poolInviteLink}
          </div>
          <CopyButton url={poolInviteLink} label="Copy invite link" />
        </div>

        {/* Member list — for reference */}
        <div className="card-lg p-6 space-y-3 mb-6">
          <div className="text-xs uppercase tracking-widest font-semibold mb-1" style={{ color: C.muted }}>Members</div>
          {members.map((m, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: C.bg }}>
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                style={{ background: MEMBER_COLORS[i % MEMBER_COLORS.length] }}>
                {m.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm">{m.name} {i === 0 && <span className="text-[10px] px-1.5 py-0.5 rounded font-bold ml-1" style={{ background: 'rgba(30,58,111,0.1)', color: C.navy }}>YOU</span>}</div>
                <div className="text-xs truncate font-mono mt-0.5" style={{ color: m.email.trim() ? C.muted : C.gold }}>
                  {m.email.trim() || 'No email — they can still join but won\'t be recoverable'}
                </div>
              </div>
              {i === 0
                ? <span className="text-xs font-semibold" style={{ color: C.green }}>✓ Joined</span>
                : <span className="text-xs" style={{ color: C.muted }}>Invited</span>
              }
            </div>
          ))}
        </div>

        <div className="card-lg p-5 mb-6" style={{ background: 'rgba(30,58,111,0.04)', border: `1px solid ${C.border}` }}>
          <div className="text-xs uppercase tracking-widest font-semibold mb-2" style={{ color: C.muted }}>How it works</div>
          <ol className="space-y-1.5 text-sm" style={{ color: C.muted }}>
            <li>1. Copy the link above and drop it in your group chat</li>
            <li>2. Everyone opens it and enters their email — they're matched to their slot</li>
            <li>3. The same link works on any device, any time — it's also how they recover access</li>
          </ol>
        </div>

        <div className="flex justify-end gap-3">
          <button onClick={() => navigate(`/p/${poolId}/draft`)}
            className="px-6 py-3 rounded-lg font-semibold flex items-center gap-2"
            style={{ background: C.navy, color: 'white' }}>
            Continue to draft upload <ArrowUpRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 py-12 max-w-2xl mx-auto">
      <div className="mb-10">
        <div className="text-xs uppercase tracking-widest font-semibold mb-2" style={{ color: C.muted }}>Set up your pool</div>
        <h2 className="font-display text-5xl" style={{ fontWeight: 700 }}>
          Create a <span className="font-italic-serif" style={{ color: C.navy }}>new pool.</span>
        </h2>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-10">
        {['Basics', 'Members', 'Format'].map((label, i) => {
          const n = i + 1;
          const done = step > n;
          const active = step === n;
          return (
            <div key={n} className="flex items-center gap-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{ background: done ? C.green : active ? C.navy : C.border, color: done || active ? 'white' : C.muted }}>
                  {done ? <Check size={13} /> : n}
                </div>
                <span className="text-sm font-semibold" style={{ color: active ? C.ink : C.muted }}>{label}</span>
              </div>
              {i < 2 && <div className="w-8 h-px mx-1" style={{ background: C.border }} />}
            </div>
          );
        })}
      </div>

      <form onSubmit={handleSubmit}>

        {/* ── STEP 1: BASICS ─────────────────────────────────────────── */}
        {step === 1 && (
          <Section number="01" title="Pool basics">
            <div className="space-y-5">
              <Field label="Pool name">
                <input value={poolName} onChange={e => setPoolName(e.target.value)}
                  placeholder="e.g. The Breakfast Club"
                  className="w-full mt-2 p-3 rounded-lg text-sm font-medium outline-none"
                  style={{ background: C.card, border: `1px solid ${C.border}` }} />
              </Field>
              <Field label="Your name (commissioner)">
                <input value={creatorName} onChange={e => setCreator('name', e.target.value)}
                  placeholder="First Last"
                  className="w-full mt-2 p-3 rounded-lg text-sm font-medium outline-none"
                  style={{ background: C.card, border: `1px solid ${C.border}` }} />
              </Field>
              <Field label="Your email (used for session recovery — no password)">
                <input type="email" value={creatorEmail} onChange={e => setCreator('email', e.target.value)}
                  placeholder="you@email.com"
                  className="w-full mt-2 p-3 rounded-lg text-sm font-medium outline-none"
                  style={{ background: C.card, border: `1px solid ${C.border}` }} />
                <div className="text-xs mt-1.5" style={{ color: C.muted }}>
                  Email is only used to restore access if your browser clears. No password, no spam.
                </div>
              </Field>
            </div>
          </Section>
        )}

        {/* ── STEP 2: MEMBERS ────────────────────────────────────────── */}
        {step === 2 && (
          <Section number="02" title="Add all members">
            <div className="text-sm mb-5" style={{ color: C.muted }}>
              Enter every player's name. Email is optional now — you can add it later from the pool page to generate their unique invite link.
              <strong style={{ color: C.ink }}> Names must match exactly what's used in the draft upload.</strong>
            </div>

            <div className="space-y-3">
              {members.map((m, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl"
                  style={{ background: i === 0 ? 'rgba(30,58,111,0.04)' : C.bg, border: `1px solid ${C.border}` }}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                    style={{ background: MEMBER_COLORS[i % MEMBER_COLORS.length] }}>
                    {i + 1}
                  </div>
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <input value={m.name} onChange={e => i === 0 ? setCreator('name', e.target.value) : updateMember(i, 'name', e.target.value)}
                      placeholder={i === 0 ? 'Your name' : `Player ${i + 1} name`}
                      readOnly={i === 0 && creatorName !== ''}
                      className="p-2.5 rounded-lg text-sm font-medium outline-none"
                      style={{ background: C.card, border: `1px solid ${C.border}`, color: C.ink }} />
                    <input type="email" value={m.email} onChange={e => i === 0 ? setCreator('email', e.target.value) : updateMember(i, 'email', e.target.value)}
                      placeholder={i === 0 ? 'Your email' : 'Email (optional)'}
                      readOnly={i === 0 && creatorEmail !== ''}
                      className="p-2.5 rounded-lg text-sm outline-none"
                      style={{ background: C.card, border: `1px solid ${C.border}`, color: C.ink }} />
                  </div>
                  {i === 0
                    ? <div className="text-[10px] px-2 py-1 rounded font-bold shrink-0" style={{ background: 'rgba(30,58,111,0.1)', color: C.navy }}>YOU</div>
                    : <button type="button" onClick={() => removeMember(i)} className="shrink-0 p-1.5 rounded-lg hover:opacity-70" style={{ color: C.muted }}>
                        <Trash2 size={14} />
                      </button>
                  }
                </div>
              ))}
            </div>

            {members.length < 8 && (
              <button type="button" onClick={addMember}
                className="mt-3 flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-lg w-full justify-center"
                style={{ border: `2px dashed ${C.border}`, color: C.navy }}>
                <Plus size={15} /> Add another player
              </button>
            )}

            {/* Commissioner selector */}
            <div className="mt-5">
              <div className="text-xs uppercase tracking-widest font-semibold mb-2" style={{ color: C.muted }}>
                Who is the commissioner?
              </div>
              <div className="flex flex-wrap gap-2">
                {members.map((m, i) => (
                  <button key={i} type="button" onClick={() => setCommissionerIdx(i)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-all"
                    style={{
                      background: commissionerIdx === i ? C.navy : C.bg,
                      color: commissionerIdx === i ? 'white' : C.ink,
                      border: `2px solid ${commissionerIdx === i ? C.navy : C.border}`,
                    }}>
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                      style={{ background: commissionerIdx === i ? 'rgba(255,255,255,0.3)' : MEMBER_COLORS[i % MEMBER_COLORS.length], color: 'white' }}>
                      {(m.name || `P${i + 1}`).charAt(0).toUpperCase()}
                    </div>
                    {m.name || `Player ${i + 1}`}
                    {i === 0 && <span className="text-[10px] opacity-70">(you)</span>}
                  </button>
                ))}
              </div>
              <div className="text-xs mt-2" style={{ color: C.muted }}>
                The commissioner uploads the draft results and can edit team assignments.
              </div>
            </div>

            <div className="mt-4 p-3 rounded-lg text-xs" style={{ background: 'rgba(201,161,74,0.08)', color: C.muted }}>
              <strong style={{ color: C.ink }}>Important:</strong> Names entered here must match what the commissioner types in the
              "Picked By" column of the draft spreadsheet. Tell your commissioner to copy names from the invite screen — not to use nicknames or abbreviations.
            </div>
          </Section>
        )}

        {/* ── STEP 3: FORMAT ─────────────────────────────────────────── */}
        {step === 3 && (
          <Section number="03" title="Draft format">
            <div className="grid sm:grid-cols-2 gap-4">
              <FormatCard
                id="upload"
                selected={draftFormat === 'upload'}
                onSelect={() => setDraftFormat('upload')}
                icon={<Upload size={22} style={{ color: C.navy }} />}
                iconBg="rgba(30,58,111,0.1)"
                tagline="Async"
                title="Upload roster"
                description="Run the draft on a video call using our commissioner spreadsheet, then upload the results. Teams are assigned automatically."
                features={[
                  'Commissioner manages the draft live',
                  'Upload one master file after',
                  'Works over FaceTime, Zoom, etc.',
                  'Best for casual groups',
                ]}
              />
              <FormatCard
                id="live"
                selected={draftFormat === 'live'}
                onSelect={() => setDraftFormat('live')}
                icon={<Users size={22} style={{ color: C.red }} />}
                iconBg="rgba(200,37,44,0.1)"
                tagline="Most competitive"
                title="Live snake draft"
                description="Everyone joins a live draft room and takes turns picking teams in snake order. No two people can pick the same team."
                features={[
                  'Real-time, everyone online together',
                  'Snake order — fair to all',
                  `Each member owns ~${Math.floor(48 / members.length)} teams`,
                  'Best for committed groups',
                ]}
                recommended
              />
            </div>
          </Section>
        )}

        {error && <div className="mb-4 text-sm" style={{ color: C.red }}>{error}</div>}

        {/* Navigation */}
        <div className="flex justify-between gap-3 pt-2">
          {step > 1
            ? <button type="button" onClick={() => { setError(''); setStep(s => s - 1); }}
                className="px-5 py-3 rounded-lg font-semibold card" style={{ color: C.ink }}>
                ← Back
              </button>
            : <div />
          }

          {step < 3 && (
            <button type="button" onClick={() => {
              if (step === 1 && !validateStep1()) return;
              if (step === 2 && !validateStep2()) return;
              setStep(s => s + 1);
            }}
              className="px-6 py-3 rounded-lg font-semibold flex items-center gap-2"
              style={{ background: C.navy, color: 'white' }}>
              Next <ArrowUpRight size={16} />
            </button>
          )}

          {step === 3 && (
            <button type="submit" disabled={loading || !draftFormat}
              className="px-6 py-3 rounded-lg font-semibold flex items-center gap-2"
              style={{ background: C.navy, color: 'white', opacity: (loading || !draftFormat) ? 0.5 : 1 }}>
              {loading ? 'Creating…' : 'Create pool · Send invites'}
              <ArrowUpRight size={16} />
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

// ── sub-components ───────────────────────────────────────────────────────

function CopyButton({ url, label }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }
  return (
    <button onClick={copy} type="button"
      className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
      style={{ background: copied ? C.green : C.navy, color: 'white' }}>
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? 'Copied!' : label}
    </button>
  );
}

function FormatCard({ id, selected, onSelect, icon, iconBg, tagline, title, description, features, recommended }) {
  return (
    <button type="button" onClick={onSelect}
      className="text-left relative p-6 rounded-2xl transition-all"
      style={{
        background: selected ? C.card : 'rgba(255,255,255,0.5)',
        border: `2px solid ${selected ? C.navy : C.border}`,
        boxShadow: selected ? '0 8px 24px -8px rgba(30,58,111,0.2)' : 'none',
      }}>
      {recommended && (
        <div className="absolute -top-2.5 right-5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
          style={{ background: C.gold, color: 'white' }}>★ Recommended</div>
      )}
      <div className="flex items-start justify-between mb-4">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: iconBg }}>{icon}</div>
        <div className="w-6 h-6 rounded-full flex items-center justify-center"
          style={{ background: selected ? C.navy : 'transparent', border: `2px solid ${selected ? C.navy : C.border}` }}>
          {selected && <Check size={14} color="white" />}
        </div>
      </div>
      <div className="text-[10px] uppercase tracking-widest font-bold mb-1.5" style={{ color: id === 'live' ? C.red : C.navy }}>{tagline}</div>
      <div className="font-display text-xl mb-2" style={{ fontWeight: 700 }}>{title}</div>
      <div className="text-sm mb-4" style={{ color: C.muted }}>{description}</div>
      <ul className="space-y-1.5">
        {features.map((f, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <Check size={13} style={{ color: C.green, marginTop: 3, flexShrink: 0 }} />
            <span>{f}</span>
          </li>
        ))}
      </ul>
    </button>
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
