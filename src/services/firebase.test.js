import { describe, it, expect } from 'vitest';
import { auth, db } from './firebase.js';

describe('firebase service', () => {
  it('exports an auth instance', () => {
    expect(auth).toBeDefined();
    expect(auth.app).toBeDefined();
  });

  it('exports a firestore instance', () => {
    expect(db).toBeDefined();
    expect(typeof db.type).toBe('string');
  });
});
