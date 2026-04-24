import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const mockOnForegroundMessage = vi.fn();
vi.mock('../services/messaging.js', () => ({
  onForegroundMessage: (...args) => mockOnForegroundMessage(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useMessaging', () => {
  it('subscribes on mount and returns latest payload with articleId + url', async () => {
    let capturedCb;
    const unsub = vi.fn();
    mockOnForegroundMessage.mockImplementation(async (cb) => {
      capturedCb = cb;
      return unsub;
    });
    const { useMessaging } = await import('./useMessaging.js');
    const { result, unmount } = renderHook(() => useMessaging());
    expect(result.current.toast).toBeNull();

    await act(async () => {
      await Promise.resolve();
    });
    act(() => {
      capturedCb({
        notification: { title: 'BBC', body: 'Headline here' },
        data: {
          targetRoute: '/?article=abc123',
          articleUrl: 'https://example.com/a',
        },
      });
    });

    expect(result.current.toast).toEqual({
      title: 'BBC',
      body: 'Headline here',
      articleId: 'abc123',
      url: 'https://example.com/a',
    });

    act(() => result.current.dismiss());
    expect(result.current.toast).toBeNull();

    unmount();
    expect(unsub).toHaveBeenCalledOnce();
  });

  it('falls back to null articleId when targetRoute missing', async () => {
    let capturedCb;
    mockOnForegroundMessage.mockImplementation(async (cb) => {
      capturedCb = cb;
      return () => {};
    });
    const { useMessaging } = await import('./useMessaging.js');
    const { result } = renderHook(() => useMessaging());
    await act(async () => {
      await Promise.resolve();
    });
    act(() => {
      capturedCb({
        notification: { title: 'X', body: 'Y' },
        data: { url: 'https://example.com/a' },
      });
    });
    expect(result.current.toast?.articleId).toBeNull();
    expect(result.current.toast?.url).toBe('https://example.com/a');
  });
});
