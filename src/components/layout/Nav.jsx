import { Link, useNavigate } from 'react-router-dom';
import { C } from '../../lib/colors';
import useLocalUser from '../../hooks/useLocalUser';

export default function Nav() {
  const { user } = useLocalUser();
  const initials = user?.name ? user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?';

  return (
    <nav className="sticky top-0 z-50 backdrop-blur" style={{ background: 'rgba(246,242,233,0.92)', borderBottom: `1px solid ${C.border}` }}>
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-3 shrink-0 no-underline">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: C.navy }}>
            <span className="font-display text-white text-lg leading-none" style={{ fontWeight: 800 }}>26</span>
          </div>
          <div className="hidden sm:block">
            <div className="font-display text-xl leading-none" style={{ fontWeight: 700, color: C.ink }}>Groupstage</div>
            <div className="text-[10px] tracking-[0.2em] mt-1 uppercase" style={{ color: C.muted }}>2026 World Cup pools</div>
          </div>
        </Link>

        <div className="flex items-center gap-3 shrink-0">
          {user?.name && (
            <div className="w-9 h-9 rounded-full flex items-center justify-center font-semibold text-sm" style={{ background: C.navy, color: 'white' }}>
              {initials}
            </div>
          )}
          {!user?.name && (
            <Link to="/" className="text-sm font-semibold" style={{ color: C.navy }}>Sign in</Link>
          )}
        </div>
      </div>
    </nav>
  );
}
