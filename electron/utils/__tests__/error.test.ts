import { getErrorMessage, AppError } from '../error';

describe('getErrorMessage', () => {
  it('extracts message from Error objects', () => {
    expect(getErrorMessage(new Error('test error'))).toBe('test error');
  });

  it('returns string directly', () => {
    expect(getErrorMessage('string error')).toBe('string error');
  });

  it('converts non-Error objects with message', () => {
    expect(getErrorMessage({ message: 'object message' })).toBe('object message');
  });

  it('converts unknown values to string', () => {
    expect(getErrorMessage(42)).toBe('42');
    expect(getErrorMessage(null)).toBe('null');
    expect(getErrorMessage(undefined)).toBe('undefined');
  });
});

describe('AppError', () => {
  it('creates error with code and details', () => {
    const err = new AppError('test', 'ERR_TEST', { foo: 'bar' });
    expect(err.message).toBe('test');
    expect(err.code).toBe('ERR_TEST');
    expect(err.details).toEqual({ foo: 'bar' });
    expect(err.name).toBe('AppError');
  });

  it('works with getErrorMessage', () => {
    expect(getErrorMessage(new AppError('app error', 'ERR_APP'))).toBe('app error');
  });
});
