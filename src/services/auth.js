import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  deleteUser,
} from 'firebase/auth';
import { auth } from './firebase.js';

export async function signInWithGoogle() {
  const googleProvider = new GoogleAuthProvider();
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
