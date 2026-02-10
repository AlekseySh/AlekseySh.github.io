# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Static HTML/CSS multi-page site for Cutto — a video processing tool that cuts boring parts, generates highlights, timecodes, thumbnails, and SEO tags from video files or stream links.

## Architecture

Static site with no build tools, no package manager, no framework. Supports EN/RU via a lightweight JS-based i18n system.

- `index.html` — landing page (How It Works)
- `app.html` — config/setup page (CTA target)
- `assets/css/styles.css` — all shared CSS
- `assets/js/lucide.min.js` — Lucide Icons v0.563.0
- `assets/js/i18n.js` — translation engine (reads `[data-i18n]` attributes)
- `assets/lang/en.js` — English strings
- `assets/lang/ru.js` — Russian strings
- `assets/img/` — image assets (thumbnails and demo images)

## Development

Open `index.html` directly in a browser. No build step or dev server required. Works on `file://` protocol.

## Styling

All CSS lives in `assets/css/styles.css`. Key conventions:

- **CSS custom properties** for theming (colors, shadows, gradients defined at `:root`)
- **Kebab-case** class names (e.g., `.upload-dropzone`, `.step-number-container`)
- **Color palette**: primary `#6366f1` (indigo), accent `#8b5cf6` (purple), success `#10b981`, danger `#ef4444`, warning `#f59e0b`
- **Responsive breakpoints**: 1100px (tablet), 600px (mobile)
- Alternating step layouts use CSS Grid with `direction: rtl` on even steps

## Icons

Lucide Icons via `<i data-lucide="icon-name"></i>` syntax, initialized with `lucide.createIcons()` at page load.

## i18n

- Translation keys use flat dot-notation: `section.element` (e.g., `step1.title`, `cta.use`)
- Translatable elements have `data-i18n="key"` attribute; the i18n engine sets `textContent`
- Mixed icon+text elements wrap the text in `<span data-i18n="...">` so icons aren't destroyed
- Language files are `.js` (not `.json`) to work on `file://` — they register on `window.__translations`
- Language preference stored in `localStorage` key `cutto_lang`
- Switcher UI is a fixed pill in top-right corner on both pages

## Page Structure

**index.html** — Three-step "How It Works" flow:
1. **Upload & Configure** — upload options (Twitch/YouTube/file), settings panel
2. **Cloud Processing** — timeline visualization with keep/cut segments, task list
3. **Get Your Content** — output video, highlight clips, timecodes, tags, download

**app.html** — Configuration page (skeleton), linked from CTA buttons
