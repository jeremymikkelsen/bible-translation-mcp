import { readdirSync, readFileSync, existsSync } from "fs";
import { join, resolve } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { BibleDB } from "./db.js";
import { parseOriginalLanguageUSFM, parseULT, parseLexiconEntry } from "./usfm-parser.js";
import { BOOK_FILE_PREFIX } from "../types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, "../..");

const DB_PATH = join(ROOT, "bible.db");
const UGNT_DIR = join(ROOT, "data/ugnt");
const UHB_DIR = join(ROOT, "data/uhb");
const ULT_DIR = join(ROOT, "data/ult");
const GREEK_LEX_DIR = join(ROOT, "data/greek-lexicon/content");
const HEBREW_LEX_DIR = join(ROOT, "data/hebrew-lexicon/content");

function getBookCodeFromFilename(filename: string): string | null {
  // Filenames like "01-GEN.usfm" or "41-MAT.usfm"
  const match = filename.match(/^\d+-([A-Z0-9]+)\.usfm$/);
  return match ? match[1] : null;
}

async function main() {
  console.log("Initializing database...");
  const db = new BibleDB(DB_PATH);
  db.initialize();

  // Ingest UGNT (Greek NT)
  if (existsSync(UGNT_DIR)) {
    console.log("Ingesting UGNT (Greek New Testament)...");
    const files = readdirSync(UGNT_DIR).filter(f => f.endsWith(".usfm"));
    for (const file of files) {
      const bookCode = getBookCodeFromFilename(file);
      if (!bookCode) continue;
      const filePath = join(UGNT_DIR, file);
      console.log(`  ${file} -> ${bookCode}`);
      const verses = parseOriginalLanguageUSFM(filePath, bookCode);
      for (const verse of verses) {
        db.insertVerse("ugnt", verse);
      }
    }
    console.log(`  Done. Processed ${files.length} books.`);
  } else {
    console.warn("UGNT directory not found. Run: git submodule update --init");
  }

  // Ingest UHB (Hebrew Bible)
  if (existsSync(UHB_DIR)) {
    console.log("Ingesting UHB (Hebrew Bible)...");
    const files = readdirSync(UHB_DIR).filter(f => f.endsWith(".usfm"));
    for (const file of files) {
      const bookCode = getBookCodeFromFilename(file);
      if (!bookCode) continue;
      const filePath = join(UHB_DIR, file);
      console.log(`  ${file} -> ${bookCode}`);
      const verses = parseOriginalLanguageUSFM(filePath, bookCode);
      for (const verse of verses) {
        db.insertVerse("uhb", verse);
      }
    }
    console.log(`  Done. Processed ${files.length} books.`);
  } else {
    console.warn("UHB directory not found. Run: git submodule update --init");
  }

  // Ingest ULT (English Literal Text) + interlinear alignments
  if (existsSync(ULT_DIR)) {
    console.log("Ingesting ULT (English Literal Text) with interlinear alignments...");
    const files = readdirSync(ULT_DIR).filter(f => f.endsWith(".usfm"));
    for (const file of files) {
      const bookCode = getBookCodeFromFilename(file);
      if (!bookCode) continue;
      const filePath = join(ULT_DIR, file);
      console.log(`  ${file} -> ${bookCode}`);
      const { verses, interlinear } = parseULT(filePath, bookCode);
      for (const verse of verses) {
        db.insertVerse("ult", verse);
      }
      for (const iv of interlinear) {
        db.insertInterlinear(iv);
      }
    }
    console.log(`  Done. Processed ${files.length} books.`);
  } else {
    console.warn("ULT directory not found. Run: git submodule update --init");
  }

  // Ingest Greek Lexicon
  if (existsSync(GREEK_LEX_DIR)) {
    console.log("Ingesting Greek Lexicon...");
    let count = 0;
    const entries = readdirSync(GREEK_LEX_DIR);
    for (const entry of entries) {
      const entryPath = join(GREEK_LEX_DIR, entry);
      // Greek lexicon entries are in directories like G00010/01.md
      const mdFile = join(entryPath, "01.md");
      if (existsSync(mdFile)) {
        const content = readFileSync(mdFile, "utf-8");
        const parsed = parseLexiconEntry(content);
        // Strong's number from directory name (e.g. G00010 -> G0001)
        // Actually keep the full directory name as the strong's ID
        db.insertLexiconEntry(entry, "greek", parsed);
        count++;
      }
    }
    console.log(`  Done. Processed ${count} entries.`);
  } else {
    console.warn("Greek Lexicon directory not found.");
  }

  // Ingest Hebrew Lexicon
  if (existsSync(HEBREW_LEX_DIR)) {
    console.log("Ingesting Hebrew Lexicon...");
    let count = 0;
    const entries = readdirSync(HEBREW_LEX_DIR).filter(f => f.endsWith(".md") && f.startsWith("H"));
    for (const file of entries) {
      const filePath = join(HEBREW_LEX_DIR, file);
      const content = readFileSync(filePath, "utf-8");
      const parsed = parseLexiconEntry(content);
      const strong = file.replace(".md", "");
      db.insertLexiconEntry(strong, "hebrew", parsed);
      count++;
    }
    console.log(`  Done. Processed ${count} entries.`);
  } else {
    console.warn("Hebrew Lexicon directory not found.");
  }

  db.close();
  console.log(`\nDatabase created at: ${DB_PATH}`);
}

main().catch(err => {
  console.error("Ingestion failed:", err);
  process.exit(1);
});
