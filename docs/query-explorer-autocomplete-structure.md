# Structuring the Query Explorer Autocomplete Feature

The autocomplete logic currently lives entirely in `editor-panel.tsx` (~250 lines of types, context detection, and suggestion building). Here’s a cleaner structure.

---

## Current state

- **editor-panel.tsx**: Inline types (`Context`, `Suggestion`), helpers (`getRootTypeName`, `unwrapType`, `resolveFieldType`), `getContext`, `getSuggestions`, and Monaco provider registration.
- **schema-to-sdl.ts**: Exists for SDL conversion (e.g. monaco-graphql path); not used by the current custom provider.

---

## Recommended structure

### 1. Dedicated `autocomplete/` module

Move all “what to suggest” logic out of the panel into a single place:

```
src/features/query-explorer/
  autocomplete/
    types.ts           # Context, SuggestionItem (or Suggestion)
    get-context.ts     # getContext, getRootTypeName, unwrapType, resolveFieldType
    get-suggestions.ts # getSuggestions(context, schema, rootTypeName, documentText)
    index.ts           # re-export public API
    get-context.test.ts
    get-suggestions.test.ts
  components/
    editor-panel.tsx   # only: theme, resize, onMount → register provider using autocomplete
```

**Benefits**

- **editor-panel** stays about the editor and Monaco (layout, theme, resize, register/dispose provider).
- **autocomplete/** is testable in isolation (context and suggestions) and reusable (e.g. another editor or CLI).
- Clear boundary: autocomplete = “context + suggestions”; editor = “Monaco + wiring”.

### 2. What stays in the panel

- Store subscription: `useStore(s => s.schema)`, `schemaRef`.
- `onMount`: get `monaco`, call `getContext(text, offset, schema, rootTypeName)` and `getSuggestions(...)` from `autocomplete/`, map results to `Monaco.languages.CompletionItem` (label, insertText, detail, documentation, kind, range, insertTextRules), then `monaco.languages.registerCompletionItemProvider('graphql', { triggerCharacters, provideCompletionItems })`.
- Cleanup: dispose the provider on unmount.

So the panel only:

- Reads schema and keeps a ref.
- Defines “on completion request, call autocomplete and convert to Monaco items”.
- Registers/disposes the provider.

### 3. Optional: `useGraphQLCompletionProvider` hook

If you want to hide even the provider registration:

- **Hook:** `useGraphQLCompletionProvider(monaco: Monaco | null, schemaRef: RefObject<DevQLSchema | null>)`
  - Returns nothing; in a `useEffect`, when `monaco` is set, register the completion provider (using the same logic as above), and return a cleanup that disposes it.
  - The panel would do: `const monacoRef = useRef<Monaco | null>(null)`; in `onMount` set `monacoRef.current = monaco` and trigger the effect (e.g. by setting “editor ready” state), and pass `monacoRef` and `schemaRef` to the hook.

This keeps “register GraphQL completion for this schema” in one hook and the panel even thinner.

### 4. Naming and boundaries

- **types.ts**: `AutocompleteContext` (or keep `Context` if only used here), `SuggestionItem` (internal) vs Monaco’s `CompletionItem` (used only in the panel or hook).
- **get-context.ts**: Pure function `getContext(text, offset, schema, rootTypeName)`; helpers like `getRootTypeName`, `unwrapType`, `resolveFieldType` can be exported for tests or kept internal.
- **get-suggestions.ts**: Pure function `getSuggestions(context, schema, rootTypeName, documentText)` returning your suggestion shape (e.g. `SuggestionItem[]`); panel converts to Monaco’s type.

### 5. What not to change

- **schema-to-sdl.ts** can stay as-is; it’s the right place for “DevQL → SDL” if you ever use monaco-graphql’s schema or SDL elsewhere.
- **Store and loadSchema** stay as they are; autocomplete only consumes `schema` from the store (and mock fallback).

---

## Summary

| Move out of editor-panel                            | Into                                                  |
| --------------------------------------------------- | ----------------------------------------------------- |
| `Context`, `Suggestion` types                       | `autocomplete/types.ts`                               |
| `getRootTypeName`, `unwrapType`, `resolveFieldType` | `autocomplete/get-context.ts` (or shared util)        |
| `getContext`                                        | `autocomplete/get-context.ts`                         |
| `getSuggestions`                                    | `autocomplete/get-suggestions.ts`                     |
| Unit tests for context/suggestions                  | `autocomplete/*.test.ts`                              |
| Provider registration + mapping                     | Stays in panel (or in `useGraphQLCompletionProvider`) |

Result: a small, testable autocomplete module and a thin editor panel that only wires Monaco to that module.
