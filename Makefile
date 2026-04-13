# SmartSnapshot Chrome Extension Build
EXTENSION_NAME = SmartSnapshot
VERSION = $(shell grep '"version"' manifest.json | sed 's/.*"version": "\([^"]*\)".*/\1/')

# Files and directories to include in the zip
FILES = \
	manifest.json \
	background.js \
	content-script.js \
	styles.css \
	html2canvas.min.js \
	preview.html \
	preview.js \
	icons \
	_locales

# Output zip file name
DIST_FILE = $(EXTENSION_NAME)-v$(VERSION).zip

.PHONY: all build clean version bump-version

all: build

version:
	@echo "Current version: $(VERSION)"

# Bump version to a new version number
# Usage: make bump-version NEW_VERSION=x.x.x
bump-version:
	@bash -c ' \
		NEW_VERSION="$(NEW_VERSION)"; \
		if [ -z "$$NEW_VERSION" ]; then \
			echo "❌ Error: Please specify NEW_VERSION"; \
			echo "Usage: make bump-version NEW_VERSION=1.2.0"; \
			exit 1; \
		fi; \
		CURRENT_VERSION="$(VERSION)"; \
		echo "📝 Bumping version: $$CURRENT_VERSION → $$NEW_VERSION"; \
		TODAY=$$(date +%Y-%m-%d); \
		\
		sed -i.bak "s/\"version\": \"$$CURRENT_VERSION\"/\"version\": \"$$NEW_VERSION\"/" manifest.json && rm -f manifest.json.bak; \
		echo "✅ Updated manifest.json"; \
		\
		if ! grep -q "## $$NEW_VERSION" CHANGELOG.md 2>/dev/null; then \
			{ head -3 CHANGELOG.md; echo ""; echo "## $$NEW_VERSION - $$TODAY"; echo ""; echo "### Fixes"; echo "- "; tail -n +4 CHANGELOG.md; } > CHANGELOG.md.tmp && mv CHANGELOG.md.tmp CHANGELOG.md; \
			echo "✅ Updated CHANGELOG.md"; \
		fi; \
		\
		if ! grep -q "## $$NEW_VERSION" CHANGELOG.zh.md 2>/dev/null; then \
			{ head -3 CHANGELOG.zh.md; echo ""; echo "## $$NEW_VERSION - $$TODAY"; echo ""; echo "### 修复"; echo "- "; tail -n +4 CHANGELOG.zh.md; } > CHANGELOG.zh.md.tmp && mv CHANGELOG.zh.md.tmp CHANGELOG.zh.md; \
			echo "✅ Updated CHANGELOG.zh.md"; \
		fi; \
		\
		echo "✅ Version bumped to $$NEW_VERSION"; \
		echo "⚠️  Please edit CHANGELOG files to add your changes" \
	'

build: clean
	@echo "📦 Building $(EXTENSION_NAME) v$(VERSION)..."
	@zip -r $(DIST_FILE) $(FILES) -x "*.DS_Store" "*.git*" "__MACOSX"
	@echo "✅ Build complete: $(DIST_FILE)"
	@ls -lh $(DIST_FILE)

clean:
	@echo "🧹 Cleaning old builds..."
	@rm -f $(EXTENSION_NAME)-v*.zip

help:
	@echo "SmartSnapshot Build Commands:"
	@echo "  make build                    - Build the extension zip file"
	@echo "  make clean                    - Remove all built zip files"
	@echo "  make version                  - Show current version"
	@echo "  make bump-version NEW_VERSION=x.x.x  - Bump version number"
	@echo "  make help                     - Show this help message"
