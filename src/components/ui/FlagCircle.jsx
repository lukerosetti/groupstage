import { teamByCode } from '../../lib/teams';
import { C } from '../../lib/colors';

export default function FlagCircle({ code, size = 40 }) {
  const team = teamByCode[code];
  if (!team) return null;
  return (
    <div className="rounded-full flex items-center justify-center"
      style={{ width: size, height: size, background: C.bg, fontSize: size * 0.5, flexShrink: 0 }}>
      {team.flag}
    </div>
  );
}
