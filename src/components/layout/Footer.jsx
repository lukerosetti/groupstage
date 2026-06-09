import { C } from '../../lib/colors';
export default function Footer() {
  return (
    <footer className="mt-24 px-6 py-10 border-t" style={{ borderColor: C.border }}>
      <div className="max-w-7xl mx-auto flex flex-wrap justify-between gap-4 items-center text-xs" style={{ color: C.muted }}>
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: C.navy }}>
            <span className="font-display text-white text-xs leading-none" style={{ fontWeight: 800 }}>26</span>
          </div>
          <span>Groupstage · 2026 World Cup bracket pools</span>
        </div>
        <div className="flex gap-4 items-center">
          <span>🇺🇸 United States</span>
          <span>🇲🇽 Mexico</span>
          <span>🇨🇦 Canada</span>
        </div>
      </div>
    </footer>
  );
}
