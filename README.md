# SmartSnapshot

A smart web element selector with multi-select, preview and screenshot capabilities.

[中文文档](README.zh-CN.md)

## Features

- 🔍 **Element Selection**: Mouse selection similar to Chrome DevTools
- ✨ **Multi-Select**: Click to select, click again to deselect
- 👁️ **Live Preview**: Sidebar shows merged preview of selected elements
- 📸 **One-Click Screenshot**: Save selected elements as an image
- 💾 **Smart Memory**: Auto-save and restore selections per domain
- ⌨️ **Keyboard Shortcuts**: ESC to exit selection mode
- 🌍 **Internationalization**: Supports English and Chinese

## Screenshots

### Usage

![Usage](snapshots/usage.png)

### Screenshot Effect

![Effect](snapshots/effect.png)

## Installation

1. Open Chrome browser and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top right corner
3. Click "Load unpacked"
4. Select this project folder

## Usage

1. **Start Selection**: Click the extension icon to enter selection mode
2. **Select Elements**:
   - Move mouse to see element highlighting
   - Click to select an element (green border)
   - Click again to deselect
   - Cannot select child elements after parent is selected
3. **View Preview**: Sidebar on the right shows real-time preview
4. **Take Screenshot**: Click the "Screenshot" button at the bottom of sidebar
5. **Save Selection**: Click "Save Selection" to record current selection (stored per domain)
6. **Forget Selection**: Click "Forget" to clear current domain's records
7. **Exit Mode**: Press ESC or click the extension icon again

## Storage Notes

- Maximum 1 record per domain
- Uses CSS selectors to record element positions
- Previous selections may not restore if page structure changes

## Keyboard Shortcuts

- `ESC` - Exit selection mode

## Technical Details

- Built on Chrome Extension Manifest V3
- Uses native Canvas API for screenshot functionality
- Data storage via Chrome Storage API
- i18n support via Chrome i18n API

## License

MIT
