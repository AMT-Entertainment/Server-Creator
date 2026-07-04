# Changelog

## v1.5.0 (2026-07-04)

- Added logging system (Pino) — replaces console.error in services
- Added React Error Boundary for graceful crash recovery
- Added barrel exports (`src/components/index.ts`, `electron/utils/index.ts`)
- Added TTL cache for version/build API fetches
- Added code splitting + content hashing in Webpack
- Added Webpack Bundle Analyzer (`npm run analyze`)
- Added Husky pre-commit hooks with lint-staged
- Added lint-staged config (auto-fix on commit)
- Added Dependabot config for weekly dependency updates
- Added Linux build support (`npm run dist:linux`)
- Added `npm run audit` script
- Added accessibility: ARIA labels on icon buttons, keyboard handlers
- Added CHANGELOG, CONTRIBUTING, SECURITY docs
- Added Jest config `collectCoverage` + `coverageThreshold`
- Modularized utils: `logger.ts`, `cache.ts` with barrel exports
- Updated Webpack config: `[contenthash]` filenames, `splitChunks`
- Updated package.json scripts: `prepare`, `audit`, `dist:linux`, `analyze`
- Updated `.npmrc` with `audit-level=high`

## v1.4.0 (2026-07-04)

- TypeScript strict mode enabled, removed 90+ `any` types
- Centralized error handling: `getErrorMessage()`, `AppError` class
- ESLint + Prettier configuration with scripts
- Jest testing framework with 6 passing tests
- Shared types directory: `electron/types/electron.d.ts`
- CI/CD: lint+test gate before builds
- Bundle optimization: tree-shaking, minification
- Proper typing for IPC, PaperAPI, CurseForge, settings

## v1.3.0 (2026-06-28)

- Added total download progress display
- Improved mod/modpack installation UI
- Fixed CurseForge project ID extraction

## v1.2.0 (2026-06-21)

- Better file organization with utilities folder
- Enhanced settings management
- Improved error messages throughout

## v1.1.0 (2026-06-14)

- Initial public release
- Basic server creation workflow
- Paper + Purpur + Spigot server types
- Mod/modpack installation via CurseForge
- Modrinth support
