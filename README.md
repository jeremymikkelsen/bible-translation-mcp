# bible-translation-mcp

A Model Context Protocol (MCP) server that enables AI to accurately access Bible translations in hundreds of languages, original Greek and Hebrew texts with morphology, word-level interlinear alignments, and lexicons.

## Data Sources

### Local (Offline) — unfoldingWord
Mirrored as git submodules, licensed [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/):

| Resource | Description |
|----------|-------------|
| **UGNT** | unfoldingWord Greek New Testament — morphologically parsed, lexically tagged |
| **UHB** | unfoldingWord Hebrew Bible — morphologically parsed, lexically tagged |
| **ULT** | unfoldingWord Literal Text — English translation with word-level alignment to source |
| **UGL** | unfoldingWord Greek Lexicon |
| **UHAL** | unfoldingWord Hebrew & Aramaic Lexicon |

### API — HelloAO Bible API
Access 100+ translations in many languages via [bible.helloao.org](https://bible.helloao.org):

- BSB (Berean Standard Bible), WEB, NASB, ESV, and many more
- Translations in Arabic, Hindi, Chinese, Spanish, Portuguese, and dozens of other languages

## MCP Tools

### Original Language & Scholarly Tools (Local)
| Tool | Description |
|------|-------------|
| `get_verse` | Fetch verse(s) in ULT (English), UGNT (Greek), or UHB (Hebrew) |
| `get_interlinear` | Word-by-word interlinear alignment (original language + English) |
| `get_morphology` | Detailed morphological parsing for every word in a verse |
| `search_text` | Full-text search across ULT, UGNT, or UHB |
| `get_lexicon` | Look up a word by Strong's number |
| `search_lexicon` | Search lexicon entries by word, gloss, or definition |

### Translation Tools (HelloAO API)
| Tool | Description |
|------|-------------|
| `list_translations` | List all available translations, optionally filtered by language |
| `list_translation_books` | List books in a specific translation |
| `get_translation_verse` | Fetch verse(s) or chapters from any available translation |
| `compare_translations` | Compare a verse side-by-side across multiple translations |

## Setup

```bash
# Clone with submodules
git clone --recurse-submodules https://github.com/jeremymikkelsen/bible-translation-mcp.git
cd bible-translation-mcp

# Install dependencies
npm install

# Build the database from USFM sources
npm run ingest

# Build TypeScript
npm run build
```

## Configure for Claude Code

Add to `~/.claude/claude_code_config.json`:

```json
{
  "mcpServers": {
    "bible": {
      "command": "node",
      "args": ["/path/to/bible-translation-mcp/dist/index.js"]
    }
  }
}
```

## Development

```bash
# Run in dev mode (no build step)
npm run dev

# Test with MCP Inspector
npx @modelcontextprotocol/inspector node dist/index.js
```

## License

Code: MIT
Data: [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) (unfoldingWord)
