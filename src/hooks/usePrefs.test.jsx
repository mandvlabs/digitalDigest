import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';

const subscribePrefs = vi.fn();
const updatePrefs = vi.fn();

vi.mock('../services/prefs.js', () => ({
  subscribePrefs: (...a) => subscribePrefs(...a),
  updatePrefs: (...a) => updatePrefs(...a),
}));

vi.mock('./useAuth.js', () => ({
  useAuth: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

async function renderWithAuth(authValue) {
  const { useAuth } = await import('./useAuth.js');
  useAuth.mockReturnValue(authValue);
  const { PrefsProvider } = await import('../contexts/PrefsContext.jsx');
  const { usePrefs } = await import('./usePrefs.js');

  function Probe() {
    const { prefs, loading } = usePrefs();
    return (
      <div data-testid="result">
        {loading ? 'loading' : prefs ? `prefs:${JSON.stringify(prefs)}` : 'null'}
      </div>
    );
  }

  render(
    <PrefsProvider>
      <Probe />
    </PrefsProvider>
  );
}

describe('usePrefs', () => {
  it('returns null prefs + not-loading when user is signed out', async () => {
    await renderWithAuth({ user: null, loading: false });
    expect(screen.getByTestId('result').textContent).toBe('null');
    expect(subscribePrefs).not.toHaveBeenCalled();
  });

  it('subscribes when user is signed in, updates state on snapshot', async () => {
    let callback;
    subscribePrefs.mockImplementation((uid, cb) => {
      callback = cb;
      return () => {};
    });
    await renderWithAuth({ user: { uid: 'u-1' }, loading: false });
    expect(subscribePrefs).toHaveBeenCalledWith('u-1', expect.any(Function));
    await act(async () => callback({ onboardingComplete: true, bulgariaOutlets: ['dnevnik'] }));
    expect(screen.getByTestId('result').textContent).toContain('onboardingComplete":true');
  });
});
