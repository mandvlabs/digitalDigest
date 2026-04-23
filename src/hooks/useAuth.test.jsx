import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';

const onAuthStateChangedMock = vi.fn();

vi.mock('../services/firebase.js', () => ({
  auth: { __type: 'mockAuth' },
}));

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (...args) => onAuthStateChangedMock(...args),
}));

vi.mock('../services/prefs.js', () => ({
  ensurePrefsDoc: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
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
    onAuthStateChangedMock.mockImplementation(() => () => {});
    await renderWithProvider();
    expect(screen.getByTestId('result').textContent).toBe('loading');
  });

  it('transitions to signed-out when callback fires with null', async () => {
    let callback;
    onAuthStateChangedMock.mockImplementation((_auth, cb) => {
      callback = cb;
      return () => {};
    });
    await renderWithProvider();
    await act(async () => callback(null));
    expect(screen.getByTestId('result').textContent).toBe('anon');
  });

  it('transitions to signed-in when callback fires with a user', async () => {
    let callback;
    onAuthStateChangedMock.mockImplementation((_auth, cb) => {
      callback = cb;
      return () => {};
    });
    const { ensurePrefsDoc } = await import('../services/prefs.js');
    await renderWithProvider();
    await act(async () => callback({ uid: 'u-1' }));
    expect(screen.getByTestId('result').textContent).toBe('user:u-1');
    expect(ensurePrefsDoc).toHaveBeenCalledWith('u-1');
  });
});
