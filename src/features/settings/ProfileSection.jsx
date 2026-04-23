import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth.js';
import { signOutCurrent, deleteCurrentAccount } from '../../services/auth.js';

export default function ProfileSection() {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  if (!user) return null;

  async function onSignOut() {
    setBusy(true);
    setError(null);
    try {
      await signOutCurrent();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!confirm('Delete your account? This removes your preferences and signs you out.')) return;
    setBusy(true);
    setError(null);
    try {
      await deleteCurrentAccount();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ color: '#333' }}>Signed in as <strong>{user.email}</strong></div>
      <button onClick={onSignOut} disabled={busy}>Sign out</button>
      <button onClick={onDelete} disabled={busy} style={{ color: '#b00' }}>
        Delete account
      </button>
      {error && <div style={{ color: '#b00' }}>{error}</div>}
    </div>
  );
}
