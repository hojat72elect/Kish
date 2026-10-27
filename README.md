# Kish Programming Language

To install dependencies:

```bash
bun install
```


## Tests

The test suite uses Bun's built-in test runner (`bun:test`), so it needs no extra dependencies.

```bash
bun test              # run every test once
```

Tests live in `tests/` and mirror the layout of `src/`. Any file named `*.test.ts` under the project is picked up automatically.

## Other checks

```bash
bun run typecheck     # tsc --noEmit, using the strict options in tsconfig.json
bun run lint          # ESLint, with type-aware rules via typescript-eslint
```