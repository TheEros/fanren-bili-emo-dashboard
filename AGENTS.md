# Repository Guidelines

## Project Structure & Module Organization
- `src/` holds all application code.
- `src/main.tsx` bootstraps React; `src/App.tsx` is the top-level component.
- Feature UI lives in `src/FanrenDashboard.tsx` and supporting pieces in `src/components/ui/`.
- Global styles and Tailwind directives live in `src/index.css`.
- Build and tooling configs live at repo root (`vite.config.ts`, `tailwind.config.js`, `tsconfig.json`).

## Build, Test, and Development Commands
- `npm install` installs dependencies.
- `npm run dev` starts the Vite dev server for local development.
- `npm run build` type-checks (`tsc -b`) and builds the production bundle.
- `npm run preview` serves the built bundle locally for a production-like check.

## Coding Style & Naming Conventions
- TypeScript + React with JSX in `.tsx` files; keep components in PascalCase (e.g., `FanrenDashboard.tsx`).
- Use 2-space indentation (match existing files) and Tailwind utility classes for styling.
- Keep UI primitives in `src/components/ui/` and reuse them before adding new variants.
- No repo-level lint/format scripts are defined; rely on consistent formatting and TypeScript checks.

## Testing Guidelines
- No automated test framework is currently configured.
- If adding tests, place them near sources (e.g., `src/Foo.test.tsx`) and document the chosen runner in `package.json`.

## Commit & Pull Request Guidelines
- Git history only shows an initial commit; no established convention yet.
- Use concise, imperative commit messages (e.g., "Add export zip flow").
- PRs should include a clear description of user-facing changes, screenshots for UI changes, and any manual test steps.

## Configuration Tips
- Use `npm run dev` or `npm run preview`; do not open `index.html` directly via `file://`.
- If new environment variables are required, document them in `README.md` and provide safe defaults.
