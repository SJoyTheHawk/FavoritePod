# AI contributor guide

Use the current source and the user's task as the starting point. Older proposals
remain in Git history; they are not instructions to restart completed phases.

## Before editing

1. Read the relevant part of the [implementation plan](../planning/implementation-plan.md).
2. Use the [code guide](code-guide.md) to locate the implementation.
3. For UI work, follow the [design guide](design-guide.md).
4. Check the working tree and preserve unrelated changes.

## Implementation conventions

- Use TypeScript, React function components, and existing shared components.
- Keep persistence in the storage/import modules and preserve field clocks,
  tombstones, transactions, and snapshot behavior.
- Keep Chrome APIs out of pure data helpers where possible. Service workers
  cannot use the DOM.
- Validate addresses with [validation.ts](../../src/core/validation.ts); open
  favorites through [file-links.ts](../../src/core/file-links.ts).
- Use existing thumbnail resource ownership and cleanup. Do not introduce
  unbounded caches or revoke an object URL still used by another consumer.
- Optional permissions must remain opt-in. Local features must work without
  Google sign-in.
- Read current function signatures rather than copying examples from old plans.

## Verification

Run checks appropriate to the change. Application changes normally require:

```bash
npm test
npm run type-check
npm run lint
npm run format:check
npm run build
```

For focused work, run the relevant test file first. Browser-only behavior also
needs the matching [manual checklist](../testing/). Record what was actually
tested; automated checks do not imply native Chrome acceptance.

Documentation changes need link and content checks. The default formatter
excludes `docs/`; format edited Markdown explicitly with
`npx prettier --ignore-path /dev/null --write <file>`.

## Handoff

Explain the behavior changed, checks performed, and remaining work. Update the
existing guide or checklist rather than creating another overlapping handoff.
For releases, use the single [publishing checklist](../publishing/README.md).
