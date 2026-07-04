import { TtlCache, versionCache } from '../utils/cache';

describe('TtlCache', () => {
  beforeEach(() => {
    versionCache.clear();
  });

  it('stores and retrieves values', () => {
    versionCache.set('test', { data: 123 });
    expect(versionCache.get('test')).toEqual({ data: 123 });
  });

  it('returns undefined for missing keys', () => {
    expect(versionCache.get('nonexistent')).toBeUndefined();
  });

  it('respects TTL', async () => {
    const shortCache = new TtlCache(10);
    shortCache.set('key', 'value');
    expect(shortCache.get('key')).toBe('value');
    await new Promise(r => setTimeout(r, 20));
    expect(shortCache.get('key')).toBeUndefined();
  });

  it('has() returns correct status', () => {
    versionCache.set('a', 1);
    expect(versionCache.has('a')).toBe(true);
    expect(versionCache.has('b')).toBe(false);
  });

  it('clear() removes all entries', () => {
    versionCache.set('a', 1);
    versionCache.set('b', 2);
    versionCache.clear();
    expect(versionCache.has('a')).toBe(false);
    expect(versionCache.has('b')).toBe(false);
  });
});
