import { useEffect, useState, useCallback } from 'react';
import { onForegroundMessage } from '../services/messaging.js';

function extractArticleId(targetRoute) {
  if (!targetRoute) return null;
  try {
    const url = new URL(targetRoute, 'https://example.invalid');
    return url.searchParams.get('article') || null;
  } catch {
    return null;
  }
}

export function useMessaging() {
  const [toast, setToast] = useState(null);

  useEffect(() => {
    let unsub = () => {};
    let cancelled = false;
    onForegroundMessage((payload) => {
      const t = {
        title: payload?.notification?.title || payload?.data?.title || 'Update',
        body: payload?.notification?.body || payload?.data?.body || '',
        articleId: extractArticleId(payload?.data?.targetRoute),
        url: payload?.data?.articleUrl || payload?.data?.url || null,
      };
      setToast(t);
    }).then((fn) => {
      if (cancelled) fn();
      else unsub = fn;
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  const dismiss = useCallback(() => setToast(null), []);
  return { toast, dismiss };
}
