import { C } from '../../lib/colors';

export function PrimaryButton({ children, onClick, type = 'button', disabled, className = '' }) {
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={`px-6 py-3 rounded-lg font-semibold flex items-center gap-2 transition-opacity ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
      style={{ background: C.navy, color: 'white' }}>
      {children}
    </button>
  );
}

export function SecondaryButton({ children, onClick, type = 'button', className = '' }) {
  return (
    <button type={type} onClick={onClick}
      className={`card px-6 py-3 rounded-lg font-semibold transition-opacity ${className}`}
      style={{ color: C.ink }}>
      {children}
    </button>
  );
}

export function Pill({ children, active, onClick }) {
  return (
    <button onClick={onClick}
      className="px-3 py-1.5 rounded-full text-xs font-semibold transition-colors"
      style={{
        background: active ? C.ink : C.bg,
        color: active ? 'white' : C.ink,
        border: `1px solid ${active ? C.ink : C.border}`,
      }}>
      {children}
    </button>
  );
}
