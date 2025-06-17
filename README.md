# You My SQL

A cross-platform desktop SQL client built with Vue 3, Vite, and Tauri (Rust backend).

## Features
- Modern UI with Vue 3 and Element Plus
- SQL editing with syntax highlighting (CodeMirror)
- Database connection management
- Cross-platform support via Tauri

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+ recommended)
- [pnpm](https://pnpm.io/) (recommended over npm/yarn)
- [Rust](https://www.rust-lang.org/tools/install) (for Tauri backend)

### Installation
```sh
pnpm install
```

### Development
Start the app in development mode:
```sh
pnpm tauri dev
```
This will launch both the frontend (Vite) and the Tauri backend.

### Build
To build the app for production:
```sh
pnpm tauri build
```

## Project Structure
- `src/` - Frontend Vue 3 application
- `src-tauri/` - Tauri (Rust) backend
- `package.json` - Project scripts and dependencies
- `vite.config.ts` - Vite configuration

## Scripts
- `pnpm dev` - Start Vite dev server (frontend only)
- `pnpm tauri dev` - Start Tauri app in dev mode
- `pnpm tauri build` - Build Tauri app for production

## License
MIT

