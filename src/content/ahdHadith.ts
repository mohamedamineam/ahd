/**
 * The hadith the app's name comes from. Text supplied verbatim by the project owner (2026-09-29) and shown
 * exactly as given — never edited. Cross-checked the same day against alsunna.net/hadith/657
 * («العهدُ الذي بيننا وبينهم الصلاةُ، فمَن تركها فقد كفرَ» — Ahmad 22937, al-Tirmidhi 2621, al-Nasa'i 463,
 * Ibn Majah 1079; Sahih al-Jami' 4143): same words; that copy adds two vowel marks (فمَن، كفرَ).
 * See docs/ATTRIBUTIONS.md.
 */
export const AHD_HADITH = {
  intro: 'قال رسول الله صلى الله عليه وسلم:',
  text: 'العهدُ الذي بيننا وبينهم الصلاةُ، فمن تركها فقد كفر',
  reference: 'رواه الترمذي والنسائي وابن ماجه.',
  /** The owner's full string, verbatim. */
  full: 'قال رسول الله صلى الله عليه وسلم: "العهدُ الذي بيننا وبينهم الصلاةُ، فمن تركها فقد كفر" رواه الترمذي والنسائي وابن ماجه.',
  references: { tirmidhi: 2621, nasai: 463, ibnMajah: 1079, ahmad: 22937 },
} as const;
