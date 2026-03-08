import Database from "better-sqlite3";
import { Verse, Word, LexiconEntry, InterlinearVerse, AlignedWord } from "../types.js";

export class BibleDB {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
  }

  initialize() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS verses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source TEXT NOT NULL,
        book TEXT NOT NULL,
        chapter INTEGER NOT NULL,
        verse INTEGER NOT NULL,
        text TEXT NOT NULL,
        words_json TEXT,
        UNIQUE(source, book, chapter, verse)
      );

      CREATE TABLE IF NOT EXISTS interlinear (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        book TEXT NOT NULL,
        chapter INTEGER NOT NULL,
        verse INTEGER NOT NULL,
        alignments_json TEXT NOT NULL,
        UNIQUE(book, chapter, verse)
      );

      CREATE TABLE IF NOT EXISTS lexicon (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        strong TEXT NOT NULL UNIQUE,
        language TEXT NOT NULL,
        word TEXT NOT NULL,
        part_of_speech TEXT,
        definition TEXT,
        glosses TEXT,
        citations TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_verses_ref ON verses(source, book, chapter, verse);
      CREATE INDEX IF NOT EXISTS idx_verses_text ON verses(text);
      CREATE INDEX IF NOT EXISTS idx_lexicon_strong ON lexicon(strong);
      CREATE INDEX IF NOT EXISTS idx_lexicon_word ON lexicon(word);
    `);
  }

  insertVerse(source: string, verse: Verse) {
    const stmt = this.db.prepare(
      `INSERT OR REPLACE INTO verses (source, book, chapter, verse, text, words_json) VALUES (?, ?, ?, ?, ?, ?)`
    );
    stmt.run(source, verse.book, verse.chapter, verse.verse, verse.text, JSON.stringify(verse.words));
  }

  insertInterlinear(iv: InterlinearVerse) {
    const stmt = this.db.prepare(
      `INSERT OR REPLACE INTO interlinear (book, chapter, verse, alignments_json) VALUES (?, ?, ?, ?)`
    );
    stmt.run(iv.book, iv.chapter, iv.verse, JSON.stringify(iv.alignments));
  }

  insertLexiconEntry(strong: string, language: string, entry: { word: string; partOfSpeech: string; definition: string; glosses: string; citations: string }) {
    const stmt = this.db.prepare(
      `INSERT OR REPLACE INTO lexicon (strong, language, word, part_of_speech, definition, glosses, citations) VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    stmt.run(strong, language, entry.word, entry.partOfSpeech, entry.definition, entry.glosses, entry.citations);
  }

  getVerse(source: string, book: string, chapter: number, verse: number): { text: string; words: Word[] } | null {
    const row = this.db.prepare(
      `SELECT text, words_json FROM verses WHERE source = ? AND book = ? AND chapter = ? AND verse = ?`
    ).get(source, book, chapter, verse) as any;
    if (!row) return null;
    return { text: row.text, words: JSON.parse(row.words_json || "[]") };
  }

  getChapter(source: string, book: string, chapter: number): { verse: number; text: string; words: Word[] }[] {
    const rows = this.db.prepare(
      `SELECT verse, text, words_json FROM verses WHERE source = ? AND book = ? AND chapter = ? ORDER BY verse`
    ).all(source, book, chapter) as any[];
    return rows.map(r => ({ verse: r.verse, text: r.text, words: JSON.parse(r.words_json || "[]") }));
  }

  getInterlinear(book: string, chapter: number, verse: number): AlignedWord[] | null {
    const row = this.db.prepare(
      `SELECT alignments_json FROM interlinear WHERE book = ? AND chapter = ? AND verse = ?`
    ).get(book, chapter, verse) as any;
    if (!row) return null;
    return JSON.parse(row.alignments_json);
  }

  searchText(source: string, query: string, limit: number = 25): { book: string; chapter: number; verse: number; text: string }[] {
    const rows = this.db.prepare(
      `SELECT book, chapter, verse, text FROM verses WHERE source = ? AND text LIKE ? LIMIT ?`
    ).all(source, `%${query}%`, limit) as any[];
    return rows;
  }

  getLexiconEntry(strong: string): LexiconEntry | null {
    const row = this.db.prepare(
      `SELECT * FROM lexicon WHERE strong = ?`
    ).get(strong) as any;
    if (!row) return null;
    return {
      strong: row.strong,
      word: row.word,
      partOfSpeech: row.part_of_speech,
      definition: row.definition,
      glosses: row.glosses,
      instances: "",
      citations: row.citations
    };
  }

  searchLexicon(query: string, language?: string): LexiconEntry[] {
    let sql = `SELECT * FROM lexicon WHERE (word LIKE ? OR glosses LIKE ? OR definition LIKE ?)`;
    const params: any[] = [`%${query}%`, `%${query}%`, `%${query}%`];
    if (language) {
      sql += ` AND language = ?`;
      params.push(language);
    }
    sql += ` LIMIT 20`;
    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map(r => ({
      strong: r.strong,
      word: r.word,
      partOfSpeech: r.part_of_speech,
      definition: r.definition,
      glosses: r.glosses,
      instances: "",
      citations: r.citations
    }));
  }

  close() {
    this.db.close();
  }
}
