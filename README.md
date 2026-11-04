# im8

im8 is the mobile and web frontend for Mexico Parasocial's civic identity wallet and credential-sharing flows.

The app is built with Expo and React Native. It keeps the user-facing identity wallet, grant review, verification, and console flows in the client while talking to an external proof broker through `EXPO_PUBLIC_M8_BROKER_URL`.

## What is in this repo

- Expo app entrypoints and configuration.
- React Native screens, components, hooks, services, and contracts under `src/`.
- App assets under `assets/`.
- Frontend-only development scripts.

The proof broker and backend services are intentionally not included here. They belong in a separate backend repository.

## Requirements

- Node.js 24.18 or newer within 24.x (`engines: >=24.18.0`, `devEngines.runtime: ^24.18.0`; other versions warn).
- pnpm 11.11.0 exactly. `package.json` pins it through `packageManager` and `devEngines.packageManager` with `onFail: "error"`, so npm, Yarn, or a different pnpm version is refused.
- Expo CLI through `pnpm exec expo` (installed as a dependency).

With Node 24, Corepack can supply the pinned pnpm:

```bash
corepack enable
```

## Setup

```bash
pnpm install
```

## Development

```bash
pnpm start
pnpm ios
pnpm android
pnpm web
```

To connect the app to a proof broker, set:

```bash
EXPO_PUBLIC_M8_BROKER_URL=http://127.0.0.1:8787
```

On Android emulator, the default local broker URL resolves to `http://10.0.2.2:8787`.

## Quality Checks

```bash
pnpm check
```

This runs `pnpm typecheck` (`tsc --noEmit`), `pnpm test` (`tsx --test` over `src/**/__tests__`), and `pnpm lint` (`oxlint`). Each can also be run on its own.

## Repository Boundary

This repository is frontend-only. Do not add backend services, SQLite data, local broker state, generated Expo output, `node_modules`, or native build artifacts.

## Storage Split

Sensitive values (broker tokens, local session snapshot, identity data) go through `src/services/secureStorage.ts` (Keychain/Keystore via `expo-secure-store`, AsyncStorage fallback on dev/web). Non-sensitive prefs stay in AsyncStorage.
