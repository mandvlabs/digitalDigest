import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';

const onAuthStateChangedMock = vi.fn();
const getRedirectResultMock = vi.fn();

vi.mock('../services/firebase.js', () => ({
  auth: { __type: 'mockAuth' },
}));

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (...args) => onAuthStateChangedMock(...args),
  getRedirectResult: (...args) => getRedirectResultMock(...args),
}));

vi.mock('../services/prefs.js', () => ({
  ensurePrefsDoc: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  getRedirectResultMock.mockResolvedValue(null);
});

async function renderWithProvider(testId = 'result') {
  const { AuthProvider } = await import('../contexts/AuthContext.jsx');
  const { useAuth } = await import('./useAuth.js');
  function Probe() {
    const { user, loading } = useAuth();
    return (
      <div data-testid={testId}>
        {loading ? 'loading' : user ? `user:${user.uid}` : 'anon'}
      </div>
    );
  }
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>
  );
}

describe('useAuth', () => {
  it('starts in loading state', async () => {
    // Never-resolving redirect result keeps us in loading
    getRedirectResultMock.mockReturnValue(new Promise(() => {}));
    onAuthStateChangedMock.mockImplementation(() => () => {});
    await renderWithProvider();
    expect(screen.getByTestId('result').textContent).toBe('loading');
  });

  it('transitions to signed-out when auth callback fires with null and redirect resolves', async () => {
    let callback;
    onAuthStateChangedMock.mockImplementation((_auth, cb) => {
      callback = cb;
      return () => {};
    });
    await renderWithProvider();
    await act(async () => {
      callback(null);
      await Promise.resolve();
    });
    expect(screen.getByTestId('result').textContent).toBe('anon');
  });

  it('transitions to signed-in when auth callback fires with a user and redirect resolves', async () => {
    let callback;
    onAuthStateChangedMock.mockImplementation((_auth, cb) => {
      callback = cb;
      return () => {};
    });
    const { ensurePrefsDoc } = await import('../services/prefs.js');
    await renderWithProvider();
    await act(async () => {
      await callback({ uid: 'u-1' });
      await Promise.resolve();
    });
    expect(screen.getByTestId('result').textContent).toBe('user:u-1');
    expect(ensurePrefsDoc).toHaveBeenCalledWith('u-1');
  });

  it('clears the signing-in session flag when user signs in', async () => {
    sessionStorage.setItem('dfd:signing-in', '1');
    let callback;
    onAuthStateChangedMock.mockImplementation((_auth, cb) => {
      callback = cb;
      return () => {};
    });
    await renderWithProvider();
    await act(async () => {
      await callback({ uid: 'u-2' });
      await Promise.resolve();
    });
    expect(sessionStorage.getItem('dfd:signing-in')).toBeNull();
  });
});
