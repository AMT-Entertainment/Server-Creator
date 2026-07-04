# Contributing

## Setup

```bash
npm install
npm run build
```

## Development

```bash
npm run dev
```

## Before committing

Pre-commit hooks will auto-fix lint and format issues. To run manually:

```bash
npm run lint
npm run format
npm test
```

## Testing

```bash
npm test            # Run all tests
npm test -- --watch # Watch mode
```

## Code style

- TypeScript strict mode — no `any` types
- Follow existing patterns in the codebase
- Use barrel exports (`index.ts`) for modules
- Add tests for new utilities

## Pull requests

1. Fork the repo
2. Create a feature branch
3. Run lint + tests
4. Open a PR against `main`
