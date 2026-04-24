import { createContext, useEffect, useState } from 'react';
import { onAuthStateChanged, getRedirectResult } from 'firebase/auth';
import { auth } from '../services/firebase.js';
import { ensurePrefsDoc } from '../services/prefs.js';

export const AuthContext = createContext({ user: null, loading: true });

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (next) => {
      if (next) {
        await ensurePrefsDoc(next.uid);
        try {
          sessionStorage.removeItem('dfd:signing-in');
        } catch {}
      }
      setUser(next);
    });
    getRedirectResult(auth)
      .catch(() => {})
      .finally(() => setLoading(false));
    return unsub;
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
