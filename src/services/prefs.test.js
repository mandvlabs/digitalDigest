import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./firebase.js', () => ({ db: {} }));

const mockDocRef = { __type: 'docRef' };
const mockGetDoc = vi.fn();
const mockSetDoc = vi.fn();
const mockUpdateDoc = vi.fn();
const mockOnSnapshot = vi.fn();
const mockServerTimestamp = vi.fn(() => '__server_ts__');

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => mockDocRef),
  getDoc: (...args) => mockGetDoc(...args),
  setDoc: (...args) => mockSetDoc(...args),
  updateDoc: (...args) => mockUpdateDoc(...args),
  onSnapshot: (...args) => mockOnSnapshot(...args),
  serverTimestamp: () => mockServerTimestamp(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('prefs service', () => {
  it('ensurePrefsDoc writes defaults when doc does not exist', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });
    const { ensurePrefsDoc } = await import('./prefs.js');

    await ensurePrefsDoc('user-1');

    expect(mockSetDoc).toHaveBeenCalledOnce();
    const payload = mockSetDoc.mock.calls[0][1];
    expect(payload.onboardingComplete).toBe(false);
    expect(payload.bulgariaOutlets).toEqual([]);
    expect(payload.worldTopics).toEqual([]);
    expect(payload.worldRegions).toEqual([]);
    expect(payload.footballTeams).toEqual([]);
    expect(payload.f1Follow).toBe(false);
    expect(payload.notifications).toEqual({
      bulgariaBreaking: false,
      worldBreaking: false,
      sportsBreaking: false,
    });
    expect(payload.fcmTokens).toEqual([]);
  });

  it('ensurePrefsDoc does not overwrite an existing doc', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => true });
    const { ensurePrefsDoc } = await import('./prefs.js');

    await ensurePrefsDoc('user-1');

    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it('updatePrefs calls updateDoc with merged data and updatedAt', async () => {
    const { updatePrefs } = await import('./prefs.js');

    await updatePrefs('user-1', { bulgariaOutlets: ['dnevnik'] });

    expect(mockUpdateDoc).toHaveBeenCalledOnce();
    const payload = mockUpdateDoc.mock.calls[0][1];
    expect(payload.bulgariaOutlets).toEqual(['dnevnik']);
    expect(payload.updatedAt).toBe('__server_ts__');
  });

  it('subscribePrefs wires onSnapshot and returns the unsubscribe fn', async () => {
    const unsub = vi.fn();
    mockOnSnapshot.mockReturnValue(unsub);
    const { subscribePrefs } = await import('./prefs.js');
    const cb = vi.fn();

    const returned = subscribePrefs('user-1', cb);

    expect(mockOnSnapshot).toHaveBeenCalledOnce();
    expect(returned).toBe(unsub);
  });
});
