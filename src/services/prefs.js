import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import { db } from './firebase.js';

const DEFAULTS = {
  bulgariaOutlets: [],
  worldTopics: [],
  worldRegions: [],
  footballTeams: [],
  f1Follow: false,
  notifications: {
    bulgariaBreaking: false,
    worldBreaking: false,
    sportsBreaking: false,
  },
  fcmTokens: [],
  onboardingComplete: false,
};

function prefsRef(uid) {
  return doc(db, 'users', uid, 'private', 'preferences');
}

export async function ensurePrefsDoc(uid) {
  const ref = prefsRef(uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      ...DEFAULTS,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
}

export async function updatePrefs(uid, patch) {
  await updateDoc(prefsRef(uid), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

export function subscribePrefs(uid, callback) {
  return onSnapshot(prefsRef(uid), (snap) => {
    callback(snap.exists() ? snap.data() : null);
  });
}

export async function addFcmToken(uid, token) {
  await updateDoc(prefsRef(uid), {
    fcmTokens: arrayUnion(token),
    updatedAt: serverTimestamp(),
  });
}

export async function removeFcmToken(uid, token) {
  await updateDoc(prefsRef(uid), {
    fcmTokens: arrayRemove(token),
    updatedAt: serverTimestamp(),
  });
}
