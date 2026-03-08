# bible-mcp

A Model Context Protocol (MCP) server for accessing unfoldingWord Bible resources — Greek New Testament (UGNT), Hebrew Old Testament (UHB), English Literal Text (ULT), and Greek/Hebrew lexicons.

## Data Sources

All texts are from [unfoldingWord](https://unfoldingword.org/) and licensed under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/):

| Resource | Description |
|----------|-------------|
| **UGNT** | unfoldingWord Greek New Testament — morphologically parsed, lexically tagged |
| **UHB** | unfoldingWord Hebrew Bible — morphologically parsed, lexically tagged |
| **ULT** | unfoldingWord Literal Text — English translation with word-level alignment to source |
| **UGL** | unfoldingWord Greek Lexicon |
| **UHAL** | unfoldingWord Hebrew & Aramaic Lexicon |

## MCP Tools

| Tool | Description |
|------|-------------|
| `get_verse` | Fetch verse(s) by reference in ULT, UGNT, or UHB |
| `get_interlinear` | Word-by-word interlinear alignment (original language + English) |
| `search_text` | Full-text search across any source |
| `get_lexicon` | Look up a word by Strong's number |
| `search_lexicon` | Search lexicon entries by word, gloss, or definition |
| `get_morphology` | Detailed morphological parsing for every word in a verse |

## Setup

```bash
# Clone with submodules
git clone --recurse-submodules https://github.com/jeremymikkelsen/bible-mcp.git
cd bible-mcp

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
      "args": ["/path/to/bible-mcp/dist/index.js"]
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
