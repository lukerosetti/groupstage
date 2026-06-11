import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ChevronDown, LogOut } from 'lucide-react';
import { C } from '../../lib/colors';
import useLocalUser from '../../hooks/useLocalUser';
import { getKnownPools, clearLocalUser } from '../../lib/localUser';

export default function Nav() {
  const { user, setUser } = useLocalUser();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  const pools = getKnownPools();

  // Derive current pool name from URL if on a pool page
  const poolIdMatch = location.pathname.match(/^\/p\/([^/]+)/);
  const currentPoolId = poolIdMatch ? poolIdMatch[1] : null;
  const currentPoolName = currentPoolId
    ? (pools.find(p => p.id === currentPoolId)?.name ?? null)
    : null;

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function signOut() {
    clearLocalUser();
    setUser(null);
    setOpen(false);
    navigate('/');
  }

  return (
    <nav className="sticky top-0 z-50 backdrop-blur"
      style={{ background: 'rgba(246,242,233,0.92)', borderBottom: `1px solid ${C.border}` }}>
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-4">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-3 shrink-0 no-underline">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: C.navy }}>
            <span className="font-display text-white text-lg leading-none" style={{ fontWeight: 800 }}>26</span>
          </div>
          <div className="hidden sm:block">
            <div className="font-display text-xl leading-none" style={{ fontWeight: 700, color: C.ink }}>Groupstage</div>
            <div className="text-[10px] tracking-[0.2em] mt-1 uppercase" style={{ color: C.muted }}>2026 World Cup pools</div>
          </div>
        </Link>

        {/* Current pool name — shown small when on a pool page */}
        {currentPoolName && (
          <div className="flex-1 flex justify-center pointer-events-none">
            <span className="text-xs font-semibold tracking-wide truncate max-w-[180px] sm:max-w-xs"
              style={{ color: C.muted }}>
              {currentPoolName}
            </span>
          </div>
        )}

        {/* Right side */}
        <div className="flex items-center gap-3 shrink-0">
          {user?.name ? (
            <div className="relative" ref={ref}>
              <button onClick={() => setOpen(o => !o)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors"
                style={{ background: open ? 'rgba(30,58,111,0.08)' : 'transparent' }}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center font-semibold text-xs text-white"
                  style={{ background: C.navy }}>
                  {initials}
                </div>
                <span className="hidden sm:block text-sm font-semibold" style={{ color: C.ink }}>
                  {user.name.split(' ')[0]}
                </span>
                <ChevronDown size={14} style={{ color: C.muted, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
              </button>

              {open && (
                <div className="absolute right-0 mt-2 w-56 rounded-xl shadow-lg overflow-hidden z-50"
                  style={{ background: C.card, border: `1px solid ${C.border}` }}>
                  {/* My Pools */}
                  {pools.length > 0 && (
                    <>
                      <div className="px-4 pt-3 pb-1 text-[10px] uppercase tracking-widest font-semibold"
                        style={{ color: C.muted }}>My Pools</div>
                      {pools.map(p => (
                        <Link key={p.id} to={`/p/${p.id}`}
                          onClick={() => setOpen(false)}
                          className="flex items-center gap-3 px-4 py-2.5 text-sm font-semibold no-underline hover:bg-opacity-50 transition-colors"
                          style={{ color: C.ink, background: 'transparent' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(14,27,51,0.04)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                          <div className="w-2 h-2 rounded-full shrink-0" style={{ background: C.navy }} />
                          <span className="truncate">{p.name}</span>
                        </Link>
                      ))}
                      <div className="mx-4 my-1" style={{ borderBottom: `1px solid ${C.border}` }} />
                    </>
                  )}

                  {pools.length === 0 && (
                    <Link to="/create" onClick={() => setOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold no-underline"
                      style={{ color: C.navy }}>
                      + Create a pool
                    </Link>
                  )}

                  {/* Sign out */}
                  <button onClick={signOut}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-left mb-1"
                    style={{ color: C.muted }}>
                    <LogOut size={13} />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link to="/recover" className="text-sm font-semibold px-4 py-2 rounded-lg"
              style={{ color: C.navy, background: 'rgba(30,58,111,0.08)' }}>
              Sign in
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
