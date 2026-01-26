# Accessibility AI Highlighter

A lightweight VSCode extension that highlights text patterns using configurable regex matching. Designed to visually emphasize specific characters or patterns in your code for accessibility purposes.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      VSCode Extension Host                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌─────────────────┐    ┌────────────────┐  │
│  │   Settings   │───▶│  extension.ts   │───▶│  Decorations   │  │
│  │  (pattern,   │    │  (Main Logic)   │    │  (Visual       │  │
│  │   enabled)   │    │                 │    │   Highlights)  │  │
│  └──────────────┘    └────────┬────────┘    └────────────────┘  │
│                               │                                  │
│                               ▼                                  │
│                    ┌─────────────────────┐                       │
│                    │   Event Listeners   │                       │
│                    ├─────────────────────┤                       │
│                    │ • Editor Changed    │                       │
│                    │ • Document Changed  │                       │
│                    │ • Config Changed    │                       │
│                    └─────────────────────┘                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## File Structure

```
vscode-accessibility-ai/
├── src/
│   └── extension.ts      # Main extension logic
├── out/
│   └── extension.js      # Compiled JavaScript output
├── .vscode/
│   ├── launch.json       # Debug configuration
│   └── tasks.json        # Build tasks
├── package.json          # Extension manifest & dependencies
├── tsconfig.json         # TypeScript configuration
└── README.md             # This file
```

## File Purposes

| File | Purpose |
|------|---------|
| [src/extension.ts](src/extension.ts) | Core extension logic - pattern matching, decoration management, and event handling |
| [package.json](package.json) | Extension metadata, VSCode contribution points, scripts, and dependencies |
| [tsconfig.json](tsconfig.json) | TypeScript compiler settings (ES2022 target, CommonJS modules, strict mode) |
| [.vscode/launch.json](.vscode/launch.json) | Debug configuration for running the extension in a new VSCode window |
| [.vscode/tasks.json](.vscode/tasks.json) | Build tasks for TypeScript compilation (build & watch modes) |

## How It Works

### 1. Activation
The extension activates when VSCode finishes startup (`onStartupFinished`). On activation:
- Creates a reusable decoration type (green highlight styling)
- Loads the regex pattern from user settings
- Registers event listeners
- Performs initial highlighting on all visible editors

### 2. Pattern Matching
- Reads the configured regex pattern (default: `a(?=bc)`)
- Executes the pattern globally against document text
- Converts matches to VSCode `Range` objects
- Limits to 1,000 matches per file for performance

### 3. Decoration Application
- Applies visual decorations to matched ranges
- Styling: green background (40% opacity), green border, bold text
- Includes hover message showing the matched text

### 4. Event-Driven Updates
| Event | Response |
|-------|----------|
| Active editor changed | Immediate decoration update |
| Document text changed | Debounced update (100ms) |
| Configuration changed | Reload pattern, update all editors |
| Visible editors changed | Update all visible editors |

## Configuration

Configure via VSCode settings (`Ctrl/Cmd + ,`):

```json
{
  "accessibilityHighlighter.pattern": "a(?=bc)",
  "accessibilityHighlighter.enabled": true
}
```

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `pattern` | string | `"a(?=bc)"` | Regex pattern to highlight |
| `enabled` | boolean | `true` | Enable/disable highlighting |

## Development

### Prerequisites
- Node.js (v16+)
- VSCode ^1.85.0

### Setup
```bash
npm install
```

### Build
```bash
npm run compile    # One-time build
npm run watch      # Watch mode for development
```

### Debug
1. Open the project in VSCode
2. Press `F5` to launch the Extension Development Host
3. The extension will be active in the new VSCode window

## Dependencies

**Runtime:** None (uses VSCode API only)

**Development:**
- `typescript` ^5.3.0
- `@types/vscode` ^1.85.0
- `@types/node` ^20.10.0

## Performance Considerations

- **Debouncing:** Document changes are debounced (100ms) to prevent excessive updates
- **Match Limit:** Capped at 1,000 matches per file
- **Reusable Decorations:** Decoration type created once and reused
- **Zero-Length Match Handling:** Prevents infinite loops with zero-width patterns
