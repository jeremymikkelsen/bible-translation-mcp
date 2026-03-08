const BASE_URL = "https://bible.helloao.org/api";

export interface Translation {
  id: string;
  name: string;
  shortName: string;
  englishName: string;
  language: string;
  textDirection: string;
  numberOfBooks: number;
  totalNumberOfChapters: number;
  totalNumberOfVerses: number;
  languageName: string;
  languageEnglishName: string;
}

export interface Book {
  id: string;
  name: string;
  commonName: string;
  title: string;
  order: number;
  numberOfChapters: number;
  firstChapterNumber: number;
  lastChapterNumber: number;
  totalNumberOfVerses: number;
}

interface VerseContentItem {
  text?: string;
  poem?: number;
  noteId?: number;
  lineBreak?: boolean;
}

interface VerseContent {
  type: string;
  number?: number;
  content?: (string | VerseContentItem)[];
}

interface ChapterResponse {
  translation: Translation;
  book: Book;
  chapter: {
    number: number;
    content: VerseContent[];
    footnotes: { noteId: number; caller: string; text: string; reference?: { chapter: number; verse: number } }[];
  };
  thisChapterLink: string;
  nextChapterApiLink?: string;
  previousChapterApiLink?: string;
}

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API request failed: ${res.status} ${res.statusText} for ${url}`);
  return res.json() as Promise<T>;
}

export async function listTranslations(): Promise<Translation[]> {
  const data = await fetchJSON<{ translations: Translation[] }>(`${BASE_URL}/available_translations.json`);
  return data.translations;
}

export async function listBooks(translationId: string): Promise<Book[]> {
  const data = await fetchJSON<{ books: Book[] }>(`${BASE_URL}/${translationId}/books.json`);
  return data.books;
}

function extractText(content: (string | VerseContentItem)[]): string {
  return content
    .map(c => {
      if (typeof c === "string") return c;
      if (c && typeof c === "object" && "text" in c && c.text) return c.text;
      return "";
    })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function getChapter(translationId: string, bookId: string, chapter: number): Promise<{ translation: Translation; verses: { number: number; text: string }[]; footnotes: string[] }> {
  const data = await fetchJSON<ChapterResponse>(`${BASE_URL}/${translationId}/${bookId}/${chapter}.json`);

  const verses: { number: number; text: string }[] = [];
  for (const item of data.chapter.content) {
    if (item.type === "verse" && item.number !== undefined && item.content) {
      verses.push({ number: item.number, text: extractText(item.content) });
    }
  }

  const footnotes = data.chapter.footnotes?.map(f => `[${f.caller}] ${f.text}`) ?? [];

  return { translation: data.translation, verses, footnotes };
}

export async function getVerse(translationId: string, bookId: string, chapter: number, verse: number): Promise<string | null> {
  const result = await getChapter(translationId, bookId, chapter);
  const v = result.verses.find(v => v.number === verse);
  return v?.text ?? null;
}

export async function getVerseRange(translationId: string, bookId: string, chapter: number, startVerse: number, endVerse: number): Promise<{ number: number; text: string }[]> {
  const result = await getChapter(translationId, bookId, chapter);
  return result.verses.filter(v => v.number >= startVerse && v.number <= endVerse);
}
