import { describe, expect, it } from 'vitest';
import { formatHHMM, fromDigits, parseHHMM } from './format';

describe('time fields', () => {
  it('reads what people type', () => {
    expect(parseHHMM('21:30')).toBe('21:30');
    expect(parseHHMM('9:05')).toBe('09:05');
    expect(parseHHMM('9.30')).toBe('09:30');
    expect(parseHHMM('2130')).toBe('21:30');
    expect(parseHHMM('930')).toBe('09:30');
    expect(parseHHMM('9')).toBe('09:00');
    expect(parseHHMM('٢١:٣٠')).toBe('21:30');
    expect(parseHHMM('9:30 PM')).toBe('21:30');
    expect(parseHHMM('12:15 am')).toBe('00:15');
    expect(parseHHMM('12:00 م')).toBe('12:00');
    expect(parseHHMM('10:30 م')).toBe('22:30');
    expect(parseHHMM('6:00 ص')).toBe('06:00');
  });
  it('rejects impossible times', () => {
    expect(parseHHMM('24:00')).toBeNull();
    expect(parseHHMM('9:75')).toBeNull();
    expect(parseHHMM('13:00 pm')).toBeNull();
    expect(parseHHMM('abc')).toBeNull();
    expect(parseHHMM('')).toBeNull();
  });
  it('shows times in the chosen format', () => {
    expect(formatHHMM('21:30', { lang: 'ar', digits: 'latn', format: '24h' })).toBe('21:30');
    expect(formatHHMM('21:30', { lang: 'ar', digits: 'latn', format: '12h' })).toBe('9:30 م');
    expect(formatHHMM('00:15', { lang: 'en', digits: 'latn', format: '12h' })).toBe('12:15 AM');
    expect(formatHHMM('09:00', { lang: 'ar', digits: 'arab', format: '24h' })).toBe('٠٩:٠٠');
  });
  it('reads both Arabic digit systems', () => {
    expect(fromDigits('٠١٢٣ ۴۵۶')).toBe('0123 456');
  });
});
