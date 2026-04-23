import { useEffect, useState, useCallback } from 'react';
import { onForegroundMessage } from '../services/messaging.js';

export function useMessaging() {
  const [toast, setToast] = useState(null);

  useEffect(() => {
    let unsub = () => {};
    let cancelled = false;
    onForegroundMessage((payload) => {
      const t = {
        title: payload?.notification?.title || payload?.data?.title || 'Update',
        body: payload?.notification?.body || payload?.data?.body || '',
        url: payload?.data?.url || null,
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
