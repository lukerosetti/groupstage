const KEY = 'groupstage_user';

export function getLocalUser() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveLocalUser(data) {
  const existing = getLocalUser() || { knownPools: [] };
  localStorage.setItem(KEY, JSON.stringify({ ...existing, ...data }));
}

export function addKnownPool(poolId) {
  const user = getLocalUser() || { knownPools: [] };
  if (!user.knownPools.includes(poolId)) {
    user.knownPools = [...(user.knownPools || []), poolId];
    localStorage.setItem(KEY, JSON.stringify(user));
  }
}

export function clearLocalUser() {
  localStorage.removeItem(KEY);
}
