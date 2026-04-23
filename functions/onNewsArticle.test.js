import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCollectionGroup = vi.fn();
const mockDocRefs = new Map();
const mockSendEachForMulticast = vi.fn();

const mockFirestore = {
  collectionGroup: (...args) => mockCollectionGroup(...args),
  doc: vi.fn((path) => {
    if (!mockDocRefs.has(path)) {
      mockDocRefs.set(path, {
        set: vi.fn(),
        update: vi.fn(),
        get: vi.fn(async () => ({ exists: false })),
        path,
      });
    }
    return mockDocRefs.get(path);
  }),
};

const mockFieldValue = {
  serverTimestamp: () => ({ __server: true }),
  arrayRemove: (v) => ({ __arrayRemove: v }),
};

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => mockFirestore,
  FieldValue: mockFieldValue,
}));

vi.mock('firebase-admin/messaging', () => ({
  getMessaging: () => ({
    sendEachForMulticast: (...args) => mockSendEachForMulticast(...args),
  }),
}));

vi.mock('firebase-functions/v2/firestore', () => ({
  onDocumentCreated: vi.fn((_path, handler) => ({ __handler: handler })),
}));

vi.mock('firebase-functions/v2', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { handleNewsArticle } = await import('./onNewsArticle.js');

function mkQuerySnap(users) {
  return {
    empty: users.length === 0,
    forEach: (cb) => users.forEach(cb),
    docs: users.map((u) => ({
      ref: { parent: { parent: { id: u.uid } } },
      data: () => u.data,
    })),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDocRefs.clear();
});

describe('handleNewsArticle', () => {
  it('no-ops when article is stale', async () => {
    const article = {
      section: 'bulgaria',
      tags: ['outlet:dnevnik'],
      publishedAt: { toDate: () => new Date('2026-04-23T00:00:00Z') },
    };
    await handleNewsArticle({
      data: article,
      now: new Date('2026-04-23T12:00:00Z'),
    });
    expect(mockCollectionGroup).not.toHaveBeenCalled();
  });

  it('sends FCM to matching user and writes pushState', async () => {
    const userSnap = mkQuerySnap([
      {
        uid: 'user-1',
        data: {
          bulgariaOutlets: ['dnevnik'],
          notifications: { bulgariaBreaking: true },
          fcmTokens: ['tok-a', 'tok-b'],
        },
      },
    ]);
    mockCollectionGroup.mockReturnValue({
      where: () => ({ get: async () => userSnap }),
    });
    mockSendEachForMulticast.mockResolvedValue({
      successCount: 2,
      failureCount: 0,
      responses: [{ success: true }, { success: true }],
    });

    await handleNewsArticle({
      data: {
        section: 'bulgaria',
        tags: ['outlet:dnevnik'],
        publishedAt: { toDate: () => new Date('2026-04-23T11:30:00Z') },
        headline: 'H',
        source: 'Dnevnik',
        url: 'https://example.com/a',
      },
      now: new Date('2026-04-23T12:00:00Z'),
    });

    expect(mockSendEachForMulticast).toHaveBeenCalledOnce();
    const payload = mockSendEachForMulticast.mock.calls[0][0];
    expect(payload.tokens).toEqual(['tok-a', 'tok-b']);
    expect(payload.notification.title).toBe('Dnevnik');
    expect(payload.notification.body).toBe('H');
    expect(payload.data.url).toBe('https://example.com/a');
    const stateRef = mockFirestore.doc.mock.results
      .map((r) => r.value)
      .find((r) => r && r.path === 'users/user-1/private/pushState');
    expect(stateRef.set).toHaveBeenCalledOnce();
  });

  it('prunes dead tokens', async () => {
    const userSnap = mkQuerySnap([
      {
        uid: 'user-1',
        data: {
          bulgariaOutlets: ['dnevnik'],
          notifications: { bulgariaBreaking: true },
          fcmTokens: ['tok-a', 'tok-dead'],
        },
      },
    ]);
    mockCollectionGroup.mockReturnValue({
      where: () => ({ get: async () => userSnap }),
    });
    mockSendEachForMulticast.mockResolvedValue({
      successCount: 1,
      failureCount: 1,
      responses: [
        { success: true },
        {
          success: false,
          error: { code: 'messaging/registration-token-not-registered' },
        },
      ],
    });

    await handleNewsArticle({
      data: {
        section: 'bulgaria',
        tags: ['outlet:dnevnik'],
        publishedAt: { toDate: () => new Date('2026-04-23T11:30:00Z') },
        headline: 'H',
        source: 'Dnevnik',
        url: 'https://example.com/a',
      },
      now: new Date('2026-04-23T12:00:00Z'),
    });

    const prefsRef = mockFirestore.doc.mock.results
      .map((r) => r.value)
      .find((r) => r && r.path === 'users/user-1/private/preferences');
    expect(prefsRef.update).toHaveBeenCalledOnce();
    const patch = prefsRef.update.mock.calls[0][0];
    expect(patch.fcmTokens).toEqual({ __arrayRemove: 'tok-dead' });
  });

  it('skips users whose notifications flag is off (none returned)', async () => {
    mockCollectionGroup.mockReturnValue({
      where: () => ({ get: async () => mkQuerySnap([]) }),
    });
    await handleNewsArticle({
      data: {
        section: 'bulgaria',
        tags: ['outlet:dnevnik'],
        publishedAt: { toDate: () => new Date('2026-04-23T11:30:00Z') },
      },
      now: new Date('2026-04-23T12:00:00Z'),
    });
    expect(mockSendEachForMulticast).not.toHaveBeenCalled();
  });
});
