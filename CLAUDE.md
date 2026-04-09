# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Web2Markdown is a Chrome browser extension (Manifest V3) that converts web pages to Markdown format and saves them to local disk. It includes support for downloading images and managing local image references.

- **Language**: Vanilla JavaScript (ES6+)
- **Key Technology**: Turndown.js for HTML-to-Markdown conversion
- **Build System**: None - this is a vanilla JS project loaded directly into Chrome

## High-Level Architecture

The extension follows a typical Chrome Extension architecture:

1. **Popup UI** ([src/popup/popup.js](src/popup/popup.js)) - Main controller orchestrating the entire workflow
2. **Content Script** ([src/content.js](src/content.js)) - Injected into web pages to extract and clean content
3. **Background Service Worker** ([src/background.js](src/background.js)) - Minimal implementation, just logs installation
4. **Utility Classes** ([src/utils/](src/utils/)) - Modular components for conversion, downloading, and path management

### Key Files

| File | Purpose |
|------|---------|
| [manifest.json](manifest.json) | Extension manifest defining permissions and scripts |
| [src/popup/popup.js](src/popup/popup.js) | Main workflow controller |
| [src/content.js](src/content.js) | Page content extraction with smart selector prioritization |
| [src/utils/converter.js](src/utils/converter.js) | Markdown conversion with custom Turndown rules |
| [src/utils/imageExtractor.js](src/utils/imageExtractor.js) | Image URL extraction and deduplication |
| [src/utils/imageDownloader.js](src/utils/imageDownloader.js) | Concurrent image downloading with retries |
| [src/utils/imagePathManager.js](src/utils/imagePathManager.js) | Path management and Markdown reference updates |

## How It Works

1. User clicks extension icon → Popup loads
2. Popup displays current page info and loads saved settings
3. User clicks "Save as Markdown":
   - Injects content script into active tab
   - Extracts cleaned page content (title, HTML, URL)
   - If image download enabled: extracts all image info
   - Creates Markdown Blob and triggers "Save As" dialog via `chrome.downloads.download()`
   - User selects save location
   - If images enabled: downloads images concurrently to `images/` folder in default download directory
   - Updates Markdown with local `images/xxx.jpg` references
   - Re-saves updated Markdown file
   - Shows success status with statistics

## Development Setup

### Loading the Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top-right)
3. Click "Load unpacked"
4. Select the `Web2Markdown` project root directory
5. The extension is now ready to use

### Testing

See [TEST-GUIDE.md](TEST-GUIDE.md) for detailed manual testing instructions.

There's also a Node.js test script for basic conversion testing:

```bash
node test-conversion.js
```

## Permissions Required

From [manifest.json](manifest.json):
- `activeTab` - Access current active tab
- `clipboardWrite` - Write to clipboard (not currently used)
- `scripting` - Inject scripts into pages
- `downloads` - Download files and manage downloads
- `storage` - Persist user settings
- `<all_urls>` - Access all URLs for image downloading

## Known Limitations

1. **Chrome Downloads API Restriction**:
   - Markdown files can be saved anywhere via "Save As" dialog
   - Images can only be saved to the default download directory (Chrome security limitation)
   - Users must manually move the `images/` folder to the same directory as the MD file
