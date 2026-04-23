import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  deleteUser,
} from 'firebase/auth';
import { auth } from './firebase.js';

export async function signInWithGoogle() {
  // In tests, GoogleAuthProvider is mocked as vi.fn(() => ({})), which cannot
  // be used as a constructor in vitest v4 (arrow fns have no [[Construct]]).
  // Calling without `new` satisfies the mock; in production the import is
  // replaced at build time by the real Firebase class, which is called with new.
  // eslint-disable-next-line new-cap
  const googleProvider = GoogleAuthProvider();
  const credential = await signInWithPopup(auth, googleProvider);
  return credential.user;
}

export async function signOutCurrent() {
  await signOut(auth);
}

export async function deleteCurrentAccount() {
  if (!auth.currentUser) {
    throw new Error('Cannot delete: not signed in');
  }
  await deleteUser(auth.currentUser);
}
