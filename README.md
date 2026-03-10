# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

# local-dashboard

## OpenAPI type generation

The app generates OpenAPI types automatically before `dev` and `build`.

- Primary schema URL: `https://bitloops.local:5667/api/openapi.json`
- Fallback schema URL: `http://127.0.0.1:5667/api/openapi.json`
- Generated file: `src/types/openapi.generated.d.ts`

You can run generation manually:

```bash
pnpm run generate:api-types
```

Optional overrides:

- `OPENAPI_PRIMARY_URL`
- `OPENAPI_FALLBACK_URL`
- `OPENAPI_TYPES_OUTPUT`

## Dashboard API

Dashboard API calls are done via the generated CLI client:

- `src/api/types/schema/BitloopsCli.ts`

Used endpoints:

- `/api/commits`
- `/api/branches`
- `/api/users`
- `/api/agents`

There is no automatic mock fallback during runtime.
Mock values are stored in:

- `src/features/dashboard/data/mock-commit-data.ts`

Optional overrides:

- `VITE_BITLOOPS_CLI_BASE` (base URL used by `BitloopsCli`, default empty string / same origin)
- `VITE_DASHBOARD_REQUEST_TIMEOUT_MS` (per-request timeout, default `2500`)
- `VITE_API_PROXY_TARGET` (Vite `/api` proxy target, default `http://bitloops.local:5667`)
