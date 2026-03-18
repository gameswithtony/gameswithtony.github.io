# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a static website repository hosting "Games With Tony" - a collection of online board game helpers and solo variants. The site provides digital tools for popular board games including Brass: Birmingham, Kanban EV, On Mars, Marvel Champions, Nemo's War, Hegemony, and Voidfall.

## Architecture

The repository is organized as a collection of separate web applications, each in its own directory:

- **Root level**: Main landing page (`index.html`) with site-wide styles
- **Game-specific directories**: Each contains a complete web app with:
  - `index.html` - Main application page
  - `app.js` - Vue.js application logic and game state management
  - `styles.css` - Application-specific styling
  - `images/` - Game assets and icons
  - Additional data files (e.g., `data.js`, `lang-str.js`)

## Key Applications

### Eliza (Brass: Birmingham Solo)
- **Location**: `/eliza/`
- **Purpose**: Complete solo opponent system for Brass: Birmingham
- **Key files**: `app.js` (main game logic), `data.js` (game data), `loadgame.html`, `reset.html`
- **Features**: AI decision making, game state persistence, turn management

### Marvel Champions (MC)
- **Location**: `/mc/`
- **Purpose**: Digital token replacement for hit points, threat, and counters
- **Key files**: `converter/` directory with JSON data for all card packs
- **Features**: Card data conversion, state tracking, multiple pack support

### Kanban EV
- **Location**: `/kanbanev/`
- **Purpose**: Solo mode automation for Kanban EV
- **Key files**: `images.js` (asset management), extensive image assets
- **Features**: Lacerda/Turczi solo mode automation

## Common Patterns

### State Management
- Most applications use Vue.js for reactive UI
- Local storage for game state persistence (key pattern: `LOCALSTORAGENAME`)
- Games implement save/load functionality with JSON serialization

### UI Components
- Shared styling patterns across applications
- Responsive design with mobile-first approach
- Common utility functions for dice rolling, number formatting

### Asset Organization
- Each app maintains its own `/images/` directory
- Favicon files typically in each app directory
- Large rulesets/PDFs stored alongside relevant apps

## Development Notes

- This is a static site with no build process - files are served directly
- No package.json or dependency management - uses CDN links for libraries
- Vue.js applications use the development build loaded from CDN
- Each application is completely self-contained

## Testing

No automated testing framework is present. Testing should be done manually in browser for each application.