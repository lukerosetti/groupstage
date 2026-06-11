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

// knownPools is now an array of { id, name } objects (legacy: plain strings)
export function addKnownPool(poolId, poolName) {
  const user = getLocalUser() || { knownPools: [] };
  const pools = (user.knownPools || []).map(p => typeof p === 'string' ? { id: p, name: p } : p);
  if (!pools.find(p => p.id === poolId)) {
    pools.push({ id: poolId, name: poolName || poolId });
    user.knownPools = pools;
    localStorage.setItem(KEY, JSON.stringify(user));
  }
}

export function getKnownPools() {
  const user = getLocalUser();
  if (!user?.knownPools) return [];
  return (user.knownPools).map(p => typeof p === 'string' ? { id: p, name: p } : p);
}

export function clearLocalUser() {
  localStorage.removeItem(KEY);
}
