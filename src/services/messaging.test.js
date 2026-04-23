import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetToken = vi.fn();
const mockOnMessage = vi.fn();
const mockIsSupported = vi.fn();
const mockGetMessaging = vi.fn(() => ({ __messaging: true }));

vi.mock('firebase/messaging', () => ({
  getMessaging: (...args) => mockGetMessaging(...args),
  getToken: (...args) => mockGetToken(...args),
  onMessage: (...args) => mockOnMessage(...args),
  isSupported: (...args) => mockIsSupported(...args),
}));

vi.mock('./firebase.js', () => ({
  app: { __app: true },
  db: {},
}));

const mockAddFcmToken = vi.fn();
vi.mock('./prefs.js', () => ({
  addFcmToken: (...args) => mockAddFcmToken(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
  globalThis.navigator = {
    ...globalThis.navigator,
    serviceWorker: {
      register: vi.fn().mockResolvedValue({ __swReg: true }),
    },
  };
  globalThis.Notification = { permission: 'granted' };
  globalThis.window = globalThis.window || {};
  globalThis.window.location = { origin: 'http://localhost' };
  import.meta.env.VITE_FCM_VAPID_KEY = 'test-vapid';
});

describe('subscribeToken', () => {
  it('returns null when messaging is unsupported', async () => {
    mockIsSupported.mockResolvedValue(false);
    const { subscribeToken } = await import('./messaging.js');
    const result = await subscribeToken('user-1');
    expect(result).toBeNull();
    expect(mockGetToken).not.toHaveBeenCalled();
  });

  it('returns null when permission not granted', async () => {
    mockIsSupported.mockResolvedValue(true);
    globalThis.Notification.permission = 'default';
    const { subscribeToken } = await import('./messaging.js');
    const result = await subscribeToken('user-1');
    expect(result).toBeNull();
    expect(mockGetToken).not.toHaveBeenCalled();
  });

  it('registers SW, fetches token, saves to prefs', async () => {
    mockIsSupported.mockResolvedValue(true);
    mockGetToken.mockResolvedValue('tok-xyz');
    const { subscribeToken } = await import('./messaging.js');
    const result = await subscribeToken('user-1');
    expect(globalThis.navigator.serviceWorker.register).toHaveBeenCalledOnce();
    const swArg = globalThis.navigator.serviceWorker.register.mock.calls[0][0];
    expect(swArg).toMatch(/\/firebase-messaging-sw\.js\?/);
    const scopeArg = globalThis.navigator.serviceWorker.register.mock.calls[0][1];
    expect(scopeArg).toEqual({ scope: '/firebase-cloud-messaging-push-scope' });
    expect(mockGetToken).toHaveBeenCalledOnce();
    const opts = mockGetToken.mock.calls[0][1];
    expect(opts.vapidKey).toBe('test-vapid');
    expect(opts.serviceWorkerRegistration).toEqual({ __swReg: true });
    expect(mockAddFcmToken).toHaveBeenCalledWith('user-1', 'tok-xyz');
    expect(result).toBe('tok-xyz');
  });

  it('returns null if getToken returns empty string', async () => {
    mockIsSupported.mockResolvedValue(true);
    mockGetToken.mockResolvedValue('');
    const { subscribeToken } = await import('./messaging.js');
    const result = await subscribeToken('user-1');
    expect(result).toBeNull();
    expect(mockAddFcmToken).not.toHaveBeenCalled();
  });
});

describe('onForegroundMessage', () => {
  it('wires onMessage and returns unsubscribe', async () => {
    mockIsSupported.mockResolvedValue(true);
    const unsub = vi.fn();
    mockOnMessage.mockReturnValue(unsub);
    const cb = vi.fn();
    const { onForegroundMessage } = await import('./messaging.js');
    const off = await onForegroundMessage(cb);
    expect(mockOnMessage).toHaveBeenCalledOnce();
    expect(typeof off).toBe('function');
    off();
    expect(unsub).toHaveBeenCalled();
  });

  it('returns noop if messaging unsupported', async () => {
    mockIsSupported.mockResolvedValue(false);
    const { onForegroundMessage } = await import('./messaging.js');
    const off = await onForegroundMessage(() => {});
    expect(mockOnMessage).not.toHaveBeenCalled();
    off();
  });
});
