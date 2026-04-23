import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./firebase.js', () => ({
  auth: { currentUser: null },
}));

vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: vi.fn(() => ({})),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
  deleteUser: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('auth service', () => {
  it('signInWithGoogle calls signInWithPopup with the auth instance and Google provider', async () => {
    const { signInWithGoogle } = await import('./auth.js');
    const firebaseAuth = await import('firebase/auth');
    firebaseAuth.signInWithPopup.mockResolvedValue({ user: { uid: 'abc' } });

    const result = await signInWithGoogle();

    expect(firebaseAuth.signInWithPopup).toHaveBeenCalledOnce();
    expect(result.uid).toBe('abc');
  });

  it('signOutCurrent calls firebase signOut', async () => {
    const { signOutCurrent } = await import('./auth.js');
    const firebaseAuth = await import('firebase/auth');

    await signOutCurrent();

    expect(firebaseAuth.signOut).toHaveBeenCalledOnce();
  });

  it('deleteCurrentAccount throws if no user is signed in', async () => {
    const { deleteCurrentAccount } = await import('./auth.js');
    await expect(deleteCurrentAccount()).rejects.toThrow(/not signed in/i);
  });
});
