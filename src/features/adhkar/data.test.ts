// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { findDhikr, loadAdhkar, withoutBrackets } from './data';
import raw from '@/content/adhkar/adhkar.json';

const shipped = (id: string) => raw.chapters.flatMap((c) => c.items).find((i) => i.id === id)!;

describe('adhkar text as shown', () => {
  it('drops the square brackets of the book and nothing else', () => {
    expect(withoutBrackets('a، [b c]')).toBe('a، b c');
    expect(withoutBrackets('[a]، b')).toBe('a، b');
    expect(withoutBrackets('a (b)')).toBe('a (b)');
  });

  it('shows the dua after the adhan without its brackets, with the English translation', async () => {
    const data = await loadAdhkar();
    const dua = findDhikr(data, data.special.duaAfterAdhan)!;
    const book = shipped(data.special.duaAfterAdhan).text;
    expect(book).toMatch(/\[[^\]]+\]$/); // the data stays as in the book: the last words in brackets
    expect(dua.text).toBe(book.replace(/[[\]]/g, ''));
    expect(dua.en).toMatch(/^‘O Allah, Owner of this perfect call/);
  });

  it('has the English translation of nearly every item: none empty, none with sentences run together', async () => {
    const items = (await loadAdhkar()).chapters.flatMap((c) => c.items);
    const translated = items.filter((i) => i.en !== undefined);
    expect(translated.length).toBeGreaterThan(280);
    for (const i of translated) {
      expect(i.en!.trim().length, i.id).toBeGreaterThan(3);
      expect(i.en, i.id).not.toMatch(/[.’)\]][A-Z‘(]|\)[a-z]|:[A-Za-z‘(]/);
    }
  });

  it('never gives an evening dhikr the morning words alone', async () => {
    const items = (await loadAdhkar()).chapters.flatMap((c) => c.items);
    // أمسينا وأمسى الملك لله رب العالمين: the translation gives the evening version after the morning one
    expect(findDhikr(await loadAdhkar(), 'c27-15')!.en).toContain('We have reached the evening');
    // أمسينا وأمسى الملك لله والحمد لله: the site has the morning words only, so no translation
    expect(shipped('c27-3').text).toMatch(/^أَمْسَيْنَا/);
    expect(findDhikr(await loadAdhkar(), 'c27-3')!.en).toBeUndefined();
    expect(items.length).toBe(raw.chapters.flatMap((c) => c.items).length);
  });
});
