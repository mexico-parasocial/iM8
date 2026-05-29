# im8

im8 is the mobile and web frontend for Mexico Parasocial's scoped identity and proof-sharing experience.

The app is built with Expo and React Native. It keeps the user-facing identity wallet, grant review, verification, and console flows in the client while talking to an external proof broker through `EXPO_PUBLIC_M8_BROKER_URL`.

## What is in this repo

- Expo app entrypoints and configuration.
- React Native screens, components, hooks, services, and contracts under `src/`.
- App assets under `assets/`.
- Frontend-only development scripts.

The proof broker and backend services are intentionally not included here. They belong in a separate backend repository.

## Requirements

- Node.js 24 or newer.
- npm 11 or newer.
- Expo CLI through `npx expo`.

## Setup

```bash
npm install
```

## Development

```bash
npm run start
npm run ios
npm run android
npm run web
```

To connect the app to a proof broker, set:

```bash
EXPO_PUBLIC_M8_BROKER_URL=http://127.0.0.1:8787
```

On Android emulator, the default local broker URL resolves to `http://10.0.2.2:8787`.

## Quality Checks

```bash
npm run typecheck
```

## Repository Boundary

This repository is frontend-only. Do not add backend services, SQLite data, local broker state, generated Expo output, `node_modules`, or native build artifacts.
