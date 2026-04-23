import { createContext, useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth.js';
import { subscribePrefs, updatePrefs } from '../services/prefs.js';

export const PrefsContext = createContext({
  prefs: null,
  loading: true,
  update: async () => {},
});

export function PrefsProvider({ children }) {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setPrefs(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = subscribePrefs(user.uid, (next) => {
      setPrefs(next);
      setLoading(false);
    });
    return unsub;
  }, [user]);

  async function update(patch) {
    if (!user) throw new Error('Cannot update prefs: not signed in');
    await updatePrefs(user.uid, patch);
  }

  return (
    <PrefsContext.Provider value={{ prefs, loading, update }}>
      {children}
    </PrefsContext.Provider>
  );
}
