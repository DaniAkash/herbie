# packages/

Empty on purpose.

This workspace has one member today, `apps/desktop`, which holds all three
runtimes: the webview in `src/`, the Bun sidecar in `src-bun/`, and the Rust
shell in `src-tauri/`. The sidecar is not a package of its own, because it is
spawned by the desktop app, versioned with it, bundled inside it and shipped as
one artifact.

The `packages/*` glob exists so that adding the first shared package is a
`mkdir` and a `package.json` rather than a migration of every config, import
path and CI reference.

A member appears here when there is a **second consumer or a separate shipping
artifact**, never before.

| Candidate | Trigger that would justify it |
|---|---|
| `packages/ui` | A second surface renders Herbie's own components |
| `packages/acp` | The ACP adapter is reused by something that is not the desktop app |

A `packages/ui` with one app in the repository is the specific mistake to
avoid: it turns every component change into a cross-package edit and buys
nothing until a second surface exists.
