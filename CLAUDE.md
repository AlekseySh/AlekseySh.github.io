# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Static HTML/CSS landing page for Cutto — a video processing tool that cuts boring parts, generates highlights, timecodes, thumbnails, and SEO tags from video files or stream links.

## Architecture

Single-file static site — no build tools, no package manager, no framework.

- `index.html` — entire page (HTML structure + embedded CSS + minimal JS)
- `assets/img/` — image assets (thumbnails and demo images)
- `assets/js/lucide.min.js` — Lucide Icons v0.563.0 (only external dependency)

## Development

Open `index.html` directly in a browser. No build step or dev server required.

## Styling

All CSS is embedded in `<style>` tags within `index.html`. Key conventions:

- **CSS custom properties** for theming (colors, shadows, gradients defined at `:root`)
- **Kebab-case** class names (e.g., `.upload-dropzone`, `.step-number-container`)
- **Color palette**: primary `#6366f1` (indigo), accent `#8b5cf6` (purple), success `#10b981`, danger `#ef4444`, warning `#f59e0b`
- **Responsive breakpoints**: 1100px (tablet), 600px (mobile)
- Alternating step layouts use CSS Grid with `direction: rtl` on even steps

## Icons

Lucide Icons via `<i data-lucide="icon-name"></i>` syntax, initialized with `lucide.createIcons()` at page load.

## Page Structure

Three-step "How It Works" flow:
1. **Upload & Configure** — upload options (Twitch/YouTube/file), settings panel
2. **Cloud Processing** — timeline visualization with keep/cut segments, task list
3. **Get Your Content** — output video, highlight clips, timecodes, tags, download
