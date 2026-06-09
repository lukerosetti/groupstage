import { C } from '../../lib/colors';
export default function TopStripe() {
  return (
    <div className="flex h-1 w-full">
      <div className="flex-1" style={{ background: C.red }} />
      <div className="flex-1" style={{ background: C.bg }} />
      <div className="flex-1" style={{ background: C.navy }} />
    </div>
  );
}
