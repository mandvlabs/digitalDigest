import { describe, it, expect, beforeEach } from 'vitest';

describe('isStandalone / isIos', () => {
  beforeEach(() => {
    globalThis.window = globalThis.window || {};
  });

  it('isStandalone true when navigator.standalone is true', async () => {
    globalThis.navigator = { ...globalThis.navigator, standalone: true };
    globalThis.window.matchMedia = () => ({ matches: false });
    const { isStandalone } = await import('./standalone.js');
    expect(isStandalone()).toBe(true);
  });

  it('isStandalone true when display-mode is standalone', async () => {
    globalThis.navigator = { ...globalThis.navigator, standalone: false };
    globalThis.window.matchMedia = (q) => ({
      matches: q === '(display-mode: standalone)',
    });
    const { isStandalone } = await import('./standalone.js');
    expect(isStandalone()).toBe(true);
  });

  it('isStandalone false otherwise', async () => {
    globalThis.navigator = { ...globalThis.navigator, standalone: false };
    globalThis.window.matchMedia = () => ({ matches: false });
    const { isStandalone } = await import('./standalone.js');
    expect(isStandalone()).toBe(false);
  });

  it('isIos detects iPhone/iPad user-agent', async () => {
    globalThis.navigator = {
      ...globalThis.navigator,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    };
    const { isIos } = await import('./standalone.js');
    expect(isIos()).toBe(true);
  });

  it('isIos false on desktop Chrome', async () => {
    globalThis.navigator = {
      ...globalThis.navigator,
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X) Chrome/120',
    };
    const { isIos } = await import('./standalone.js');
    expect(isIos()).toBe(false);
  });
});
