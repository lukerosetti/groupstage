import { useEffect } from 'react';
import { X } from 'lucide-react';
import { C } from '../../lib/colors';

export default function Modal({ open, onClose, children, title }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(14,27,51,0.5)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="card-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto relative">
        <div className="flex items-center justify-between p-6 pb-0">
          {title && <div className="font-display text-2xl" style={{ fontWeight: 700 }}>{title}</div>}
          <button onClick={onClose} className="ml-auto p-2 rounded-lg hover:opacity-70" style={{ color: C.muted }}>
            <X size={20} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
