import { readFileSync } from "fs";
import { Word, Verse, AlignedWord, InterlinearVerse } from "../types.js";

export function parseOriginalLanguageUSFM(filePath: string, bookCode: string): Verse[] {
  const content = readFileSync(filePath, "utf-8");
  const verses: Verse[] = [];
  let currentChapter = 0;

  const lines = content.split("\n");
  let currentVerseNum = 0;
  let currentWords: Word[] = [];

  for (const line of lines) {
    const chapterMatch = line.match(/^\\c\s+(\d+)/);
    if (chapterMatch) {
      // Save previous verse if any
      if (currentVerseNum > 0 && currentWords.length > 0) {
        verses.push({
          book: bookCode,
          chapter: currentChapter,
          verse: currentVerseNum,
          words: currentWords,
          text: currentWords.map(w => w.text).join(" ")
        });
      }
      currentChapter = parseInt(chapterMatch[1], 10);
      currentVerseNum = 0;
      currentWords = [];
      continue;
    }

    const verseMatch = line.match(/^\\v\s+(\d+)/);
    if (verseMatch) {
      // Save previous verse
      if (currentVerseNum > 0 && currentWords.length > 0) {
        verses.push({
          book: bookCode,
          chapter: currentChapter,
          verse: currentVerseNum,
          words: currentWords,
          text: currentWords.map(w => w.text).join(" ")
        });
      }
      currentVerseNum = parseInt(verseMatch[1], 10);
      currentWords = [];
    }

    // Parse \w ...|lemma="..." strong="..." x-morph="..."\w* patterns
    const wordRegex = /\\w\s+([^|]+)\|lemma="([^"]*)" strong="([^"]*)" x-morph="([^"]*)"/g;
    let wordMatch;
    while ((wordMatch = wordRegex.exec(line)) !== null) {
      currentWords.push({
        text: wordMatch[1].trim(),
        lemma: wordMatch[2],
        strong: wordMatch[3],
        morph: wordMatch[4]
      });
    }
  }

  // Save last verse
  if (currentVerseNum > 0 && currentWords.length > 0) {
    verses.push({
      book: bookCode,
      chapter: currentChapter,
      verse: currentVerseNum,
      words: currentWords,
      text: currentWords.map(w => w.text).join(" ")
    });
  }

  return verses;
}

export function parseULT(filePath: string, bookCode: string): { verses: Verse[]; interlinear: InterlinearVerse[] } {
  const content = readFileSync(filePath, "utf-8");
  const verses: Verse[] = [];
  const interlinear: InterlinearVerse[] = [];
  let currentChapter = 0;

  // Split into lines and process
  const lines = content.split("\n");
  let currentVerseNum = 0;
  let verseTextParts: string[] = [];
  let alignments: AlignedWord[] = [];
  let currentAlignment: { strong: string; lemma: string; morph: string; content: string } | null = null;
  let currentEnglishWords: string[] = [];

  function saveVerse() {
    if (currentVerseNum > 0) {
      const text = verseTextParts.join(" ").replace(/\s+/g, " ").trim();
      if (text) {
        verses.push({
          book: bookCode,
          chapter: currentChapter,
          verse: currentVerseNum,
          words: [],
          text
        });
        if (alignments.length > 0) {
          interlinear.push({
            book: bookCode,
            chapter: currentChapter,
            verse: currentVerseNum,
            alignments: [...alignments]
          });
        }
      }
    }
  }

  for (const line of lines) {
    const chapterMatch = line.match(/^\\c\s+(\d+)/);
    if (chapterMatch) {
      saveVerse();
      currentChapter = parseInt(chapterMatch[1], 10);
      currentVerseNum = 0;
      verseTextParts = [];
      alignments = [];
      continue;
    }

    const verseMatch = line.match(/\\v\s+(\d+)\s*/);
    if (verseMatch) {
      saveVerse();
      currentVerseNum = parseInt(verseMatch[1], 10);
      verseTextParts = [];
      alignments = [];
      currentAlignment = null;
      currentEnglishWords = [];
    }

    // Process alignment starts
    const zalnStartRegex = /\\zaln-s\s+\|x-strong="([^"]*)" x-lemma="([^"]*)" x-morph="([^"]*)"[^*]*x-content="([^"]*)"/g;
    let zalnMatch;
    while ((zalnMatch = zalnStartRegex.exec(line)) !== null) {
      // If we had a previous alignment with collected words, save it
      if (currentAlignment && currentEnglishWords.length > 0) {
        alignments.push({
          english: currentEnglishWords.join(" "),
          sourceWord: currentAlignment.content,
          strong: currentAlignment.strong,
          lemma: currentAlignment.lemma,
          morph: currentAlignment.morph
        });
        currentEnglishWords = [];
      }
      currentAlignment = {
        strong: zalnMatch[1],
        lemma: zalnMatch[2],
        morph: zalnMatch[3],
        content: zalnMatch[4]
      };
    }

    // Process English words within \w ...\w* tags
    const engWordRegex = /\\w\s+([^|\\]+?)(?:\|[^\\]*)?\s*\\w\*/g;
    let engMatch;
    while ((engMatch = engWordRegex.exec(line)) !== null) {
      const word = engMatch[1].trim();
      if (word) {
        verseTextParts.push(word);
        if (currentAlignment) {
          currentEnglishWords.push(word);
        }
      }
    }

    // Process alignment ends
    if (line.includes("\\zaln-e\\*") && currentAlignment && currentEnglishWords.length > 0) {
      alignments.push({
        english: currentEnglishWords.join(" "),
        sourceWord: currentAlignment.content,
        strong: currentAlignment.strong,
        lemma: currentAlignment.lemma,
        morph: currentAlignment.morph
      });
      currentEnglishWords = [];
      currentAlignment = null;
    }
  }
  saveVerse();

  return { verses, interlinear };
}

export function parseLexiconEntry(content: string): { word: string; partOfSpeech: string; definition: string; glosses: string; citations: string } {
  const wordMatch = content.match(/^#\s+(.+)/m);
  const posMatch = content.match(/\*\s*Part of [Ss]peech:\s*\n\n(.+)/m);
  const defMatch = content.match(/####\s+Definition:\s*\n\n(.+)/m);
  const glossMatch = content.match(/####\s+Glosses:\s*\n\n(.+)/m);
  const citMatch = content.match(/####\s+Citations:\s*\n\n([\s\S]*?)(?:\n##|\n$|$)/m);

  return {
    word: wordMatch?.[1]?.trim() ?? "",
    partOfSpeech: posMatch?.[1]?.trim() ?? "",
    definition: defMatch?.[1]?.trim() ?? "",
    glosses: glossMatch?.[1]?.trim() ?? "",
    citations: citMatch?.[1]?.trim() ?? ""
  };
}
