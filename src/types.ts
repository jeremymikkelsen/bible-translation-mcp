export interface Word {
  text: string;
  lemma: string;
  strong: string;
  morph: string;
}

export interface Verse {
  book: string;
  chapter: number;
  verse: number;
  words: Word[];
  text: string;
}

export interface LexiconEntry {
  strong: string;
  word: string;
  partOfSpeech: string;
  definition: string;
  glosses: string;
  instances: string;
  citations: string;
}

export interface AlignedWord {
  english: string;
  sourceWord: string;
  strong: string;
  lemma: string;
  morph: string;
}

export interface InterlinearVerse {
  book: string;
  chapter: number;
  verse: number;
  alignments: AlignedWord[];
}

// Map of USFM book codes to full names
export const BOOK_NAMES: Record<string, string> = {
  GEN: "Genesis", EXO: "Exodus", LEV: "Leviticus", NUM: "Numbers", DEU: "Deuteronomy",
  JOS: "Joshua", JDG: "Judges", RUT: "Ruth",
  "1SA": "1 Samuel", "2SA": "2 Samuel", "1KI": "1 Kings", "2KI": "2 Kings",
  "1CH": "1 Chronicles", "2CH": "2 Chronicles",
  EZR: "Ezra", NEH: "Nehemiah", EST: "Esther",
  JOB: "Job", PSA: "Psalms", PRO: "Proverbs", ECC: "Ecclesiastes", SNG: "Song of Solomon",
  ISA: "Isaiah", JER: "Jeremiah", LAM: "Lamentations", EZK: "Ezekiel", DAN: "Daniel",
  HOS: "Hosea", JOL: "Joel", AMO: "Amos", OBA: "Obadiah", JON: "Jonah", MIC: "Micah",
  NAM: "Nahum", HAB: "Habakkuk", ZEP: "Zephaniah", HAG: "Haggai", ZEC: "Zechariah", MAL: "Malachi",
  MAT: "Matthew", MRK: "Mark", LUK: "Luke", JHN: "John", ACT: "Acts",
  ROM: "Romans", "1CO": "1 Corinthians", "2CO": "2 Corinthians",
  GAL: "Galatians", EPH: "Ephesians", PHP: "Philippians", COL: "Colossians",
  "1TH": "1 Thessalonians", "2TH": "2 Thessalonians",
  "1TI": "1 Timothy", "2TI": "2 Timothy", TIT: "Titus", PHM: "Philemon",
  HEB: "Hebrews", JAS: "James", "1PE": "1 Peter", "2PE": "2 Peter",
  "1JN": "1 John", "2JN": "2 John", "3JN": "3 John", JUD: "Jude", REV: "Revelation"
};

// Reverse map: full name (lowercase) -> USFM code
export const NAME_TO_CODE: Record<string, string> = {};
for (const [code, name] of Object.entries(BOOK_NAMES)) {
  NAME_TO_CODE[name.toLowerCase()] = code;
}
// Add common abbreviations
const ABBREVIATIONS: Record<string, string> = {
  gen: "GEN", ex: "EXO", exod: "EXO", lev: "LEV", num: "NUM", deut: "DEU", deu: "DEU",
  josh: "JOS", judg: "JDG", jdg: "JDG", ruth: "RUT",
  "1sam": "1SA", "2sam": "2SA", "1kgs": "1KI", "2kgs": "2KI", "1ki": "1KI", "2ki": "2KI",
  "1chr": "1CH", "2chr": "2CH", "1ch": "1CH", "2ch": "2CH",
  ezr: "EZR", neh: "NEH", esth: "EST",
  job: "JOB", ps: "PSA", psa: "PSA", psalm: "PSA", psalms: "PSA",
  prov: "PRO", pro: "PRO", eccl: "ECC", ecc: "ECC",
  song: "SNG", sng: "SNG", sos: "SNG",
  isa: "ISA", jer: "JER", lam: "LAM", ezek: "EZK", ezk: "EZK", dan: "DAN",
  hos: "HOS", joel: "JOL", jol: "JOL", amos: "AMO", amo: "AMO",
  obad: "OBA", oba: "OBA", jon: "JON", jonah: "JON", mic: "MIC", micah: "MIC",
  nah: "NAM", nam: "NAM", hab: "HAB", zeph: "ZEP", zep: "ZEP",
  hag: "HAG", zech: "ZEC", zec: "ZEC", mal: "MAL",
  matt: "MAT", mat: "MAT", mk: "MRK", mrk: "MRK", mark: "MRK",
  lk: "LUK", luk: "LUK", luke: "LUK",
  jn: "JHN", jhn: "JHN", john: "JHN",
  acts: "ACT", act: "ACT",
  rom: "ROM", "1cor": "1CO", "2cor": "2CO", "1co": "1CO", "2co": "2CO",
  gal: "GAL", eph: "EPH", phil: "PHP", php: "PHP",
  col: "COL", "1thess": "1TH", "2thess": "2TH", "1th": "1TH", "2th": "2TH",
  "1tim": "1TI", "2tim": "2TI", "1ti": "1TI", "2ti": "2TI",
  tit: "TIT", phlm: "PHM", phm: "PHM",
  heb: "HEB", jas: "JAS", james: "JAS",
  "1pet": "1PE", "2pet": "2PE", "1pe": "1PE", "2pe": "2PE",
  "1jn": "1JN", "2jn": "2JN", "3jn": "3JN",
  "1john": "1JN", "2john": "2JN", "3john": "3JN",
  jude: "JUD", jud: "JUD",
  rev: "REV", revelation: "REV"
};
for (const [abbr, code] of Object.entries(ABBREVIATIONS)) {
  NAME_TO_CODE[abbr] = code;
}

// File number prefix map for finding USFM files
export const BOOK_FILE_PREFIX: Record<string, string> = {
  GEN: "01", EXO: "02", LEV: "03", NUM: "04", DEU: "05",
  JOS: "06", JDG: "07", RUT: "08", "1SA": "09", "2SA": "10",
  "1KI": "11", "2KI": "12", "1CH": "13", "2CH": "14",
  EZR: "15", NEH: "16", EST: "17", JOB: "18", PSA: "19", PRO: "20",
  ECC: "21", SNG: "22", ISA: "23", JER: "24", LAM: "25",
  EZK: "26", DAN: "27", HOS: "28", JOL: "29", AMO: "30",
  OBA: "31", JON: "32", MIC: "33", NAM: "34", HAB: "35",
  ZEP: "36", HAG: "37", ZEC: "38", MAL: "39",
  MAT: "41", MRK: "42", LUK: "43", JHN: "44", ACT: "45",
  ROM: "46", "1CO": "47", "2CO": "48", GAL: "49", EPH: "50",
  PHP: "51", COL: "52", "1TH": "53", "2TH": "54",
  "1TI": "55", "2TI": "56", TIT: "57", PHM: "58",
  HEB: "59", JAS: "60", "1PE": "61", "2PE": "62",
  "1JN": "63", "2JN": "64", "3JN": "65", JUD: "66", REV: "67"
};

export function resolveBookCode(input: string): string | null {
  const normalized = input.trim().toLowerCase().replace(/\s+/g, "");
  if (NAME_TO_CODE[normalized]) return NAME_TO_CODE[normalized];
  // Try matching the USFM code directly
  const upper = input.trim().toUpperCase();
  if (BOOK_NAMES[upper]) return upper;
  return null;
}

export function parseReference(ref: string): { book: string; chapter: number; verse?: number; endVerse?: number } | null {
  // Match patterns like "Gen 1:1", "Genesis 1:1-3", "1 John 3:16", "Ps 119:105"
  const match = ref.match(/^(\d?\s*[A-Za-z]+)\s+(\d+)(?::(\d+)(?:-(\d+))?)?$/);
  if (!match) return null;
  const bookInput = match[1].trim();
  const book = resolveBookCode(bookInput);
  if (!book) return null;
  return {
    book,
    chapter: parseInt(match[2], 10),
    verse: match[3] ? parseInt(match[3], 10) : undefined,
    endVerse: match[4] ? parseInt(match[4], 10) : undefined
  };
}
