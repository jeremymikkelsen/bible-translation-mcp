import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";
import { BibleDB } from "./data/db.js";
import { parseReference, BOOK_NAMES, resolveBookCode } from "./types.js";
import * as helloao from "./api/helloao.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, "..");

const DB_PATH = resolve(ROOT, "bible.db");

if (!existsSync(DB_PATH)) {
  console.error("Database not found. Run 'npm run ingest' first to build the database.");
  process.exit(1);
}

const db = new BibleDB(DB_PATH);

const server = new McpServer({
  name: "bible-translation-mcp",
  version: "0.1.0",
  description: "Enables AI to accurately access Bible translations in hundreds of languages, original Greek/Hebrew texts with morphology, interlinear alignments, and lexicons"
});

// Helper: determine OT vs NT
const OT_BOOKS = new Set(Object.keys(BOOK_NAMES).slice(0, 39));
const NT_BOOKS = new Set(Object.keys(BOOK_NAMES).slice(39));

function autoSource(book: string, requestedSource: string): string {
  if (requestedSource === "ugnt" && !NT_BOOKS.has(book)) return "uhb";
  if (requestedSource === "uhb" && !OT_BOOKS.has(book)) return "ugnt";
  if (requestedSource === "hebrew") return OT_BOOKS.has(book) ? "uhb" : "ugnt";
  if (requestedSource === "greek") return NT_BOOKS.has(book) ? "ugnt" : "uhb";
  return requestedSource;
}

// Tool: get_verse
server.tool(
  "get_verse",
  "Get Bible verse(s) from local unfoldingWord texts. Use source 'uhb' for Hebrew OT, 'ugnt' for Greek NT, or 'ult' for English. Includes word-level morphology for original languages. For other translations (BSB, WEB, etc.), use get_translation_verse instead.",
  {
    reference: z.string().describe("Bible reference as a string, e.g. 'Gen 1:1', 'John 3:16', 'Ps 23:1-6', 'Psalms 20'. Supports book name + chapter, or book + chapter:verse, or book + chapter:verse-verse."),
    source: z.enum(["ult", "ugnt", "uhb"]).default("ult").describe("Text source: 'ult' = English (unfoldingWord Literal Text), 'ugnt' = Greek New Testament, 'uhb' = Hebrew Old Testament. Auto-corrects if source doesn't match testament.")
  },
  async ({ reference, source }) => {
    const ref = parseReference(reference);
    if (!ref) {
      return { content: [{ type: "text" as const, text: `Could not parse reference: "${reference}". Use format like "Gen 1:1", "John 3:16-18", or "Psalms 20" (full chapter).` }] };
    }

    // Auto-correct source if it doesn't match the testament
    const resolvedSource = autoSource(ref.book, source);
    if (resolvedSource !== source) {
      // Silently correct rather than error
    }

    if (ref.verse && !ref.endVerse) {
      const result = db.getVerse(resolvedSource, ref.book, ref.chapter, ref.verse);
      if (!result) {
        return { content: [{ type: "text" as const, text: `Verse not found: ${reference} (source: ${resolvedSource})` }] };
      }
      let text = `**${BOOK_NAMES[ref.book]} ${ref.chapter}:${ref.verse}** (${resolvedSource.toUpperCase()})\n\n${result.text}`;
      if (result.words.length > 0 && resolvedSource !== "ult") {
        text += "\n\n**Words:**\n";
        for (const w of result.words) {
          text += `- ${w.text} — lemma: ${w.lemma}, Strong's: ${w.strong}, morph: ${w.morph}\n`;
        }
      }
      return { content: [{ type: "text" as const, text }] };
    }

    if (ref.verse && ref.endVerse) {
      const lines: string[] = [];
      lines.push(`**${BOOK_NAMES[ref.book]} ${ref.chapter}:${ref.verse}-${ref.endVerse}** (${resolvedSource.toUpperCase()})\n`);
      for (let v = ref.verse; v <= ref.endVerse; v++) {
        const result = db.getVerse(resolvedSource, ref.book, ref.chapter, v);
        if (result) {
          lines.push(`**${v}** ${result.text}`);
        }
      }
      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    }

    // No verse specified — return whole chapter
    const chapter = db.getChapter(resolvedSource, ref.book, ref.chapter);
    if (chapter.length === 0) {
      return { content: [{ type: "text" as const, text: `Chapter not found: ${BOOK_NAMES[ref.book]} ${ref.chapter} (source: ${resolvedSource})` }] };
    }
    const lines = [`**${BOOK_NAMES[ref.book]} ${ref.chapter}** (${resolvedSource.toUpperCase()})\n`];
    for (const v of chapter) {
      lines.push(`**${v.verse}** ${v.text}`);
    }
    return { content: [{ type: "text" as const, text: lines.join("\n") }] };
  }
);

// Tool: get_interlinear
server.tool(
  "get_interlinear",
  "Get word-by-word interlinear alignment between original language (Hebrew/Greek) and English. Supports single verses, verse ranges, and full chapters.",
  {
    reference: z.string().describe("Bible reference — single verse ('Gen 1:1'), range ('Ps 20:1-9'), or full chapter ('Psalms 20')")
  },
  async ({ reference }) => {
    const ref = parseReference(reference);
    if (!ref) {
      return { content: [{ type: "text" as const, text: `Could not parse reference: "${reference}". Examples: "Gen 1:1", "Ps 20:1-9", "Psalms 20"` }] };
    }

    const rows = db.getInterlinearRange(ref.book, ref.chapter, ref.verse, ref.endVerse ?? ref.verse);
    if (rows.length === 0) {
      return { content: [{ type: "text" as const, text: `No interlinear data found for ${reference}` }] };
    }

    const label = ref.verse
      ? (ref.endVerse ? `${ref.chapter}:${ref.verse}-${ref.endVerse}` : `${ref.chapter}:${ref.verse}`)
      : `${ref.chapter}`;

    let text = `**${BOOK_NAMES[ref.book]} ${label} — Interlinear**\n\n`;
    for (const row of rows) {
      text += `**Verse ${row.verse}**\n`;
      text += "| Source | Lemma | Strong's | Morphology | English |\n";
      text += "|--------|-------|----------|------------|----------|\n";
      for (const a of row.alignments) {
        text += `| ${a.sourceWord} | ${a.lemma} | ${a.strong} | ${a.morph} | ${a.english} |\n`;
      }
      text += "\n";
    }

    return { content: [{ type: "text" as const, text }] };
  }
);

// Tool: search_text
server.tool(
  "search_text",
  "Search Bible text for a word or phrase across a source",
  {
    query: z.string().describe("Search term or phrase"),
    source: z.enum(["ult", "ugnt", "uhb"]).default("ult").describe("Text source to search"),
    limit: z.number().default(25).describe("Max results to return")
  },
  async ({ query, source, limit }) => {
    const results = db.searchText(source, query, limit);
    if (results.length === 0) {
      return { content: [{ type: "text" as const, text: `No results found for "${query}" in ${source.toUpperCase()}` }] };
    }

    let text = `**Search results for "${query}" in ${source.toUpperCase()}** (${results.length} results)\n\n`;
    for (const r of results) {
      text += `**${BOOK_NAMES[r.book]} ${r.chapter}:${r.verse}** — ${r.text}\n\n`;
    }

    return { content: [{ type: "text" as const, text }] };
  }
);

// Tool: get_lexicon
server.tool(
  "get_lexicon",
  "Look up a Greek or Hebrew word in the lexicon by Strong's number (e.g. G0001, H0430)",
  {
    strong: z.string().describe("Strong's number, e.g. 'G0001', 'H0430', 'G26010'")
  },
  async ({ strong }) => {
    const entry = db.getLexiconEntry(strong.toUpperCase());
    if (!entry) {
      return { content: [{ type: "text" as const, text: `No lexicon entry found for Strong's ${strong}` }] };
    }

    let text = `**${entry.word}** (${strong.toUpperCase()})\n\n`;
    if (entry.partOfSpeech) text += `**Part of Speech:** ${entry.partOfSpeech}\n\n`;
    if (entry.definition) text += `**Definition:** ${entry.definition}\n\n`;
    if (entry.glosses) text += `**Glosses:** ${entry.glosses}\n\n`;
    if (entry.citations) text += `**Citations:** ${entry.citations}\n`;

    return { content: [{ type: "text" as const, text }] };
  }
);

// Tool: search_lexicon
server.tool(
  "search_lexicon",
  "Search Greek or Hebrew lexicon entries by word, gloss, or definition",
  {
    query: z.string().describe("Search term (word, gloss, or definition)"),
    language: z.enum(["greek", "hebrew"]).optional().describe("Filter by language")
  },
  async ({ query, language }) => {
    const results = db.searchLexicon(query, language);
    if (results.length === 0) {
      return { content: [{ type: "text" as const, text: `No lexicon entries found for "${query}"` }] };
    }

    let text = `**Lexicon search: "${query}"** (${results.length} results)\n\n`;
    for (const r of results) {
      text += `**${r.word}** (${r.strong}) — ${r.glosses || r.definition || "No gloss available"}\n\n`;
    }

    return { content: [{ type: "text" as const, text }] };
  }
);

// Tool: get_morphology
server.tool(
  "get_morphology",
  "Get detailed morphological parsing for every word in a verse or range from the original language (Hebrew OT / Greek NT). Supports single verses, ranges, and full chapters.",
  {
    reference: z.string().describe("Bible reference — e.g. 'Gen 1:1', 'Ps 20:1-9', 'John 1'")
  },
  async ({ reference }) => {
    const ref = parseReference(reference);
    if (!ref) {
      return { content: [{ type: "text" as const, text: `Could not parse reference: "${reference}". Examples: "Gen 1:1", "Ps 20:1-9", "John 1"` }] };
    }

    const source = OT_BOOKS.has(ref.book) ? "uhb" : "ugnt";
    const langLabel = source === "uhb" ? "Hebrew" : "Greek";

    if (ref.verse && !ref.endVerse) {
      const result = db.getVerse(source, ref.book, ref.chapter, ref.verse);
      if (!result || result.words.length === 0) {
        return { content: [{ type: "text" as const, text: `No morphology data found for ${reference}` }] };
      }
      let text = `**${BOOK_NAMES[ref.book]} ${ref.chapter}:${ref.verse} — ${langLabel} Morphology**\n\n`;
      text += "| Word | Lemma | Strong's | Morphology |\n";
      text += "|------|-------|----------|------------|\n";
      for (const w of result.words) {
        text += `| ${w.text} | ${w.lemma} | ${w.strong} | ${w.morph} |\n`;
      }
      return { content: [{ type: "text" as const, text }] };
    }

    // Range or full chapter
    const chapter = db.getChapter(source, ref.book, ref.chapter);
    const filtered = ref.verse
      ? chapter.filter(v => v.verse >= ref.verse! && v.verse <= (ref.endVerse ?? ref.verse!))
      : chapter;

    if (filtered.length === 0) {
      return { content: [{ type: "text" as const, text: `No morphology data found for ${reference}` }] };
    }

    const label = ref.verse
      ? `${ref.chapter}:${ref.verse}-${ref.endVerse}`
      : `${ref.chapter}`;

    let text = `**${BOOK_NAMES[ref.book]} ${label} — ${langLabel} Morphology**\n\n`;
    for (const v of filtered) {
      if (v.words.length === 0) continue;
      text += `**Verse ${v.verse}**\n`;
      text += "| Word | Lemma | Strong's | Morphology |\n";
      text += "|------|-------|----------|------------|\n";
      for (const w of v.words) {
        text += `| ${w.text} | ${w.lemma} | ${w.strong} | ${w.morph} |\n`;
      }
      text += "\n";
    }
    return { content: [{ type: "text" as const, text }] };
  }
);

// =============================================================================
// HelloAO Bible API Tools — Access 100+ translations in many languages
// =============================================================================

// Tool: list_translations
server.tool(
  "list_translations",
  "List all available Bible translations from the HelloAO API. Returns translation IDs, names, languages, and verse counts. Use a translation ID with get_translation_verse.",
  {
    language: z.string().optional().describe("Filter by language name (e.g. 'English', 'Spanish', 'Arabic')")
  },
  async ({ language }) => {
    const translations = await helloao.listTranslations();
    let filtered = translations;
    if (language) {
      const lang = language.toLowerCase();
      filtered = translations.filter(t =>
        t.languageEnglishName?.toLowerCase().includes(lang) ||
        t.languageName?.toLowerCase().includes(lang) ||
        t.language?.toLowerCase().includes(lang)
      );
    }
    if (filtered.length === 0) {
      return { content: [{ type: "text" as const, text: `No translations found${language ? ` for language "${language}"` : ""}.` }] };
    }
    let text = `**Available Bible Translations** (${filtered.length} results)\n\n`;
    text += "| ID | Name | Language | Books | Verses |\n";
    text += "|----|------|----------|-------|--------|\n";
    for (const t of filtered) {
      text += `| ${t.id} | ${t.englishName || t.name} | ${t.languageEnglishName || t.language} | ${t.numberOfBooks} | ${t.totalNumberOfVerses} |\n`;
    }
    return { content: [{ type: "text" as const, text }] };
  }
);

// Tool: list_translation_books
server.tool(
  "list_translation_books",
  "List all books available in a specific Bible translation from the HelloAO API",
  {
    translation: z.string().describe("Translation ID (e.g. 'BSB', 'WEB', 'NASB')")
  },
  async ({ translation }) => {
    try {
      const books = await helloao.listBooks(translation);
      let text = `**Books in ${translation}** (${books.length} books)\n\n`;
      text += "| # | ID | Name | Chapters | Verses |\n";
      text += "|---|-----|------|----------|--------|\n";
      for (const b of books) {
        text += `| ${b.order} | ${b.id} | ${b.name} | ${b.numberOfChapters} | ${b.totalNumberOfVerses} |\n`;
      }
      return { content: [{ type: "text" as const, text }] };
    } catch {
      return { content: [{ type: "text" as const, text: `Translation "${translation}" not found. Use list_translations to see available IDs.` }] };
    }
  }
);

// Tool: get_translation_verse
server.tool(
  "get_translation_verse",
  "Get Bible verse(s) or a full chapter from any translation via the HelloAO API. Supports hundreds of translations including Hebrew (hbo_wlc, heb_mod), Greek, English (BSB, WEB), and many other languages.",
  {
    reference: z.string().describe("Bible reference, e.g. 'Gen 1:1', 'John 3:16', 'Ps 23:1-6', 'Psalms 20'"),
    translation: z.string().default("BSB").describe("Translation ID (e.g. 'BSB', 'WEB', 'hbo_wlc' for Hebrew WLC, 'heb_mod' for Modern Hebrew). Use list_translations to see all available.")
  },
  async ({ reference, translation }) => {
    const ref = parseReference(reference);
    if (!ref) {
      return { content: [{ type: "text" as const, text: `Could not parse reference: "${reference}". Use format like "Gen 1:1", "John 3:16-18", or "Psalms 20" (full chapter).` }] };
    }

    try {
      // Always fetch the full chapter (single API call) and extract what's needed
      const result = await helloao.getChapter(translation, ref.book, ref.chapter);
      const translationName = result.translation.englishName || result.translation.name;
      const translationLabel = `${translationName} (${translation})`;

      if (ref.verse && !ref.endVerse) {
        const v = result.verses.find(v => v.number === ref.verse);
        if (!v || !v.text) {
          return { content: [{ type: "text" as const, text: `Verse not found: ${reference} (${translationLabel})` }] };
        }
        return { content: [{ type: "text" as const, text: `**${BOOK_NAMES[ref.book]} ${ref.chapter}:${ref.verse}** (${translationLabel})\n\n${v.text}` }] };
      }

      if (ref.verse && ref.endVerse) {
        const verses = result.verses.filter(v => v.number >= ref.verse! && v.number <= ref.endVerse!);
        const lines = [`**${BOOK_NAMES[ref.book]} ${ref.chapter}:${ref.verse}-${ref.endVerse}** (${translationLabel})\n`];
        for (const v of verses) {
          lines.push(`**${v.number}** ${v.text}`);
        }
        return { content: [{ type: "text" as const, text: lines.join("\n") }] };
      }

      // Full chapter
      const lines = [`**${BOOK_NAMES[ref.book]} ${ref.chapter}** (${translationLabel})\n`];
      for (const v of result.verses) {
        lines.push(`**${v.number}** ${v.text}`);
      }
      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    } catch {
      return { content: [{ type: "text" as const, text: `Failed to fetch ${reference} from translation "${translation}". Check the translation ID with list_translations.` }] };
    }
  }
);

// Tool: compare_translations
server.tool(
  "compare_translations",
  "Compare a Bible verse across multiple translations side by side",
  {
    reference: z.string().describe("Bible reference, e.g. 'John 3:16'"),
    translations: z.array(z.string()).default(["BSB", "WEB"]).describe("Array of translation IDs to compare")
  },
  async ({ reference, translations }) => {
    const ref = parseReference(reference);
    if (!ref || !ref.verse) {
      return { content: [{ type: "text" as const, text: `Please provide a specific verse like "John 3:16"` }] };
    }

    let text = `**${BOOK_NAMES[ref.book]} ${ref.chapter}:${ref.verse} — Translation Comparison**\n\n`;

    for (const tid of translations) {
      try {
        const verseText = await helloao.getVerse(tid, ref.book, ref.chapter, ref.verse);
        text += `**${tid}:** ${verseText ?? "Not available"}\n\n`;
      } catch {
        text += `**${tid}:** (translation not available)\n\n`;
      }
    }

    return { content: [{ type: "text" as const, text }] };
  }
);

// Tool: get_plain_text
server.tool(
  "get_plain_text",
  "Get plain scripture text optimized for LLM consumption — no tables, no formatting, just the text. Works with any translation (HelloAO API) or local source (ult/ugnt/uhb). This is the simplest way to get Bible text.",
  {
    reference: z.string().describe("Bible reference, e.g. 'Gen 1:1', 'John 3:16-18', 'Psalms 20'"),
    translation: z.string().default("BSB").describe("Translation ID ('BSB', 'WEB', 'hbo_wlc', etc.) or local source ('ult', 'ugnt', 'uhb')")
  },
  async ({ reference, translation }) => {
    const ref = parseReference(reference);
    if (!ref) {
      return { content: [{ type: "text" as const, text: `Could not parse reference: "${reference}".` }] };
    }

    const localSources = ["ult", "ugnt", "uhb"];
    const isLocal = localSources.includes(translation.toLowerCase());

    if (isLocal) {
      const source = autoSource(ref.book, translation.toLowerCase());
      if (ref.verse && !ref.endVerse) {
        const result = db.getVerse(source, ref.book, ref.chapter, ref.verse);
        return { content: [{ type: "text" as const, text: result?.text ?? `Not found: ${reference}` }] };
      }
      const chapter = db.getChapter(source, ref.book, ref.chapter);
      const filtered = ref.verse
        ? chapter.filter(v => v.verse >= ref.verse! && v.verse <= (ref.endVerse ?? ref.verse!))
        : chapter;
      const plain = filtered.map(v => `${v.verse} ${v.text}`).join("\n");
      return { content: [{ type: "text" as const, text: plain || `Not found: ${reference}` }] };
    }

    // HelloAO API
    try {
      const result = await helloao.getChapter(translation, ref.book, ref.chapter);
      let verses = result.verses;
      if (ref.verse && ref.endVerse) {
        verses = verses.filter(v => v.number >= ref.verse! && v.number <= ref.endVerse!);
      } else if (ref.verse) {
        verses = verses.filter(v => v.number === ref.verse);
      }
      const plain = verses.map(v => `${v.number} ${v.text}`).join("\n");
      return { content: [{ type: "text" as const, text: plain || `Not found: ${reference} (${translation})` }] };
    } catch {
      return { content: [{ type: "text" as const, text: `Failed to fetch ${reference} from "${translation}".` }] };
    }
  }
);

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(err => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
