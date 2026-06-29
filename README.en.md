# Heno Heno Moji-e

[日本語](./README.md) | **English**

A project whose goal is to place lyric characters one by one at the right size and color, eventually drawing a single picture made entirely of characters.

## Concept

- Display a reasonable number of characters on the canvas.
- Draw the first character large, then progressively shrink later characters so the picture is built in "background → detail" order.
- Generate several candidates at random positions, render them onto an empty texture, compare it against the source image, and record a score. A character's color is chosen automatically from the average color of the image pixels it overlaps.
- Extract the top n candidates and slightly mutate values such as position and size by adding variance.
- Repeat "extract top candidates → mutate" many times to finally select the character with the optimal position and size.
- Bake the confirmed character into the texture, then place the next character on top of it and compare again.

## Tech stack

- **Svelte 5** (runes syntax) + **Vite** based SPA
- **TypeGPU / WebGPU**: character placement search and image comparison
- **PixiJS 8**: rendering the extracted character placements onto the canvas
- **TextAlive App API**: extracting lyric/timing data and controlling real-time playback
- **In-house lightweight i18n module** (`src/i18n`): manages multilingual UI strings (no external library). The default language is Japanese, with Japanese, Korean, and English supported.

## Screens

`src/main.ts` mounts `src/lib/Root.svelte` and switches between two screens via component state, without using URL paths.

| Screen      | Component                | Role                                                          |
| ----------- | ------------------------ | ------------------------------------------------------------ |
| `home`      | `PixiPreviewPage.svelte` | Song selection/intro screen → play the chosen song with music |
| `workspace` | `UploadTrainPage.svelte` | Image upload + song selection → run character placement training |

Pressing "Train your own" on `home` goes to `workspace`; when training finishes (`onPlay`), it returns to `home` and auto-plays the song you just trained.

The main features are:

- **Song selection & playback** (`PixiPreviewPage` → `GlyphPlayer`): shows song cards and plays the chosen song in sync with music via the TextAlive Player. Characters appear with an entrance animation and particles (fireworks), and you can configure display effects such as constellation mode and the outline overlay.
- **Upload & training** (`UploadTrainPage` → `GlyphTrainer`): upload an image (or pick a sample), choose a song, and run the "prepare image → extract lyrics → train → finalize → done" pipeline. You can cancel at any point.
- **Multilingual UI** (`src/i18n`): UI strings are separated from components and read through `t()`, so the UI re-renders automatically when the language changes.

## Directory structure

```
src/
├─ const/      # Immutable constants (texture config, song catalog, API token, etc.)
├─ types/      # Shared type definitions
├─ stores/     # Global state (module singletons)
├─ util/       # General utilities (math / color / time / image / text canvas, etc.)
├─ pixijs/     # PixiJS helpers (tint / textures / firework particles)
├─ textAlive/  # TextAlive logic (lyrics extraction / JSONL serialization)
├─ i18n/       # Multilingual UI strings (messages / locale / index)
├─ assets/     # Song images, outline images, lyric data (jsonl)
├─ webgpu/     # WebGPU/TypeGPU compute (candidate generation, comparison, color, Sobel, etc.)
└─ lib/        # Screens (Svelte components) and shared UI components
```

## JSONL data format

One JSON record per line, distinguished by the `type` field. Pre-extracted songs are bundled as `src/assets/*.jsonl`, and training your own generates a string in the same format in memory (`trainedStore`).

- `song`: song metadata (title, artist, duration, full lyrics, etc.)
- `phrase`: phrase-level text with start/end times
- `word`: word-level text with times
- `char`: character-level text, time, and whether it is renderable
- `placement`: placement info for an extracted character
  - `step`: display order
  - `char`: the character
  - `pos`: `{ x, y, scale, opacity, rotation }` (x/y are 0–1 normalized coordinates)
  - `color`: `[r, g, b]` (each 0–1)
  - `diff`: the difference score for that placement

The playback screen uses `placement` / `char` / `phrase` / `song` from these, rendering characters in `step` order.

## Development

```bash
# Install dependencies
npm install

# Dev server (http://localhost:5173/)
npm run dev

# Type / Svelte check
npm run check

# Production build / preview
npm run build
npm run preview
```

> To use the training feature, run it in a browser that supports WebGPU (e.g. a recent version of Chrome or Edge). Even on unsupported environments, the home screen and playback of bundled songs work fine.
