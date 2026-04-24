# Herbie

A lightweight AI assistant that runs 24x7 in your macOS menubar.

Built with [Electrobun](https://electrobun.dev) — Bun-powered, native WebView, under 10MB binary.

## Stack

| Layer | Tool |
|---|---|
| App shell | Electrobun |
| Backend | Bun |
| Frontend | React + Vite + Tailwind v4 |
| Routing | TanStack Router |
| AI | Vercel AI SDK + Anthropic |
| Linting | Biome |

## Dev

```sh
bun install

# Dev with watch (no HMR)
bun run dev

# Dev with Vite HMR
bun run dev:hmr
```

## Scripts

| Command | Description |
|---|---|
| `bun run dev` | Electrobun dev mode with file watching |
| `bun run dev:hmr` | Vite HMR + Electrobun (two processes) |
| `bun run build` | Vite production build |
| `bun run start` | Build then launch via Electrobun |
| `bun run lint` | Biome lint check |
| `bun run lint:fix` | Biome lint + autofix |
| `bun run typecheck` | TypeScript type check |

## Behavior

- Lives in the menubar — no dock icon
- Click the tray icon to toggle the popover window
- Closing the window hides it to tray (doesn't quit)
- Tray menu → **Quit** to fully exit
