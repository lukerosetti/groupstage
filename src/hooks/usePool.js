import { useState, useEffect } from 'react';
import { doc, collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../lib/firebase';

export function usePool(poolId) {
  const [pool, setPool] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!poolId) return;
    setLoading(true);

    const unsub1 = onSnapshot(doc(db, 'pools', poolId), (snap) => {
      if (snap.exists()) setPool({ id: snap.id, ...snap.data() });
      else setError('Pool not found');
      setLoading(false);
    }, (err) => { setError(err.message); setLoading(false); });

    const unsub2 = onSnapshot(query(collection(db, 'pools', poolId, 'members')), (snap) => {
      setMembers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsub1(); unsub2(); };
  }, [poolId]);

  return { pool, members, loading, error };
}
