# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Am I in Thailand?** is a minimal static joke website answering a single question: whether the visitor is currently in Thailand. It deploys to GitHub Pages with no backend — pure HTML/CSS/JavaScript.

The full product specification is in `am-i-in-thailand-spec.md`. Read it before making significant decisions.

## Architecture

Single-page static site. No build step, no framework, no server.

**Location detection (priority order):**
1. Browser Geolocation API (preferred, most accurate)
2. GeoIP fallback via a free third-party API (approximate)
3. Indeterminate — shown when both fail or are denied

**Four user-visible states:** `checking` → `yes` / `no` / `can't tell`

**Main visual element:** A face (SVG or CSS-drawn) that shifts expression — neutral (checking/indeterminate), happy (yes), sad (no). The answer must also appear as text, not only as a face expression.

## Key Constraints

- Static only — no server-side code, no backend owned by the site
- GeoIP must be treated as approximate; never imply it equals device GPS accuracy
- No analytics, no storage of visitor location data
- Graceful degradation: the site must remain coherent when location is denied or unavailable
- Minimal text — dry humor from premise, not from copywriting
- Mobile-responsive

## Deployment

Target: GitHub Pages. Files should be deployable by pushing to the repo (typically `index.html` at the root or a `docs/` folder, depending on Pages configuration).
