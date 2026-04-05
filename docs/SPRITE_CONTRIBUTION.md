# Sprite Contribution Guide

This guide explains how to create and submit animated sprites for buddy.land pet species.

---

## Overview

Each species can have a full sprite sheet system (like the dragon) alongside the existing canvas-drawn fallback in `BuddySprite.tsx`. The canvas fallback will always be there — the sprite sheet system is an enhancement that makes the pet come alive with smooth animations.

---

## Animations required

Every species needs **5 animation files**:

| Animation | Description | Min frames | FPS |
|-----------|-------------|------------|-----|
| `idle`    | Standing/floating, breathing loop | 6–12 | 8 |
| `walkr`   | Walking to the right | 3–6 | 10 |
| `walkl`   | Walking to the left | 3–6 | 10 |
| `sleep`   | Sleeping / resting loop | 4–12 | 4 |
| `special` | Special moment (celebration, sneeze, etc.) — **plays once, does not loop** | 6–12 | 12 |

---

## File format

Each animation = 1 pair of files:

```
client/public/sprites/{species}/
├── idle.json
├── idle.webp
├── walkr.json
├── walkr.webp
├── walkl.json
├── walkl.webp
├── sleep.json
├── sleep.webp
├── special.json
└── special.webp
```

### Sprite sheet (WebP)

- Format: **WebP** (preferred) or PNG
- All frames packed into a single image (sprite atlas / sprite sheet)
- Transparent background (alpha channel)
- Recommended source size per frame: **512×512 px**
- Tools that export this format well: [Aseprite](https://www.aseprite.org/), TexturePacker, Shoebox

### Atlas JSON

The JSON describes where each frame lives inside the sprite sheet. Format matches the [TexturePacker JSON (hash) format](https://www.codeandweb.com/texturepacker/documentation/data-formats/json-hash):

```json
{
  "frames": {
    "frame_0.png": {
      "frame":            { "x": 0, "y": 0, "w": 304, "h": 379 },
      "rotated":          false,
      "trimed":           true,
      "spriteSourceSize": { "x": 104, "y": 68, "w": 408, "h": 447 },
      "sourceSize":       { "w": 512, "h": 512 }
    },
    "frame_1.png": { ... }
  },
  "meta": {
    "image": "./idle.webp",
    "format": "RGBA8888",
    "size": { "w": 1024, "h": 2048 },
    "scale": 1
  }
}
```

**Key fields:**

| Field | Description |
|-------|-------------|
| `frame` | Position and size of this frame inside the sprite sheet |
| `spriteSourceSize` | Where to position the frame within the `sourceSize` canvas (accounts for trimmed transparency) |
| `sourceSize` | Logical canvas size for the sprite (all frames should share the same value) |
| `meta.image` | Relative path to the WebP file (`./idle.webp`) — can also be an absolute HTTPS URL |

> The frames are read in insertion order. Name them `frame_0.png`, `frame_1.png`, etc. (or any consistent naming — order matters, names are ignored at runtime).

---

## Art style guidelines

- The dragon is the reference: chunky, expressive, pixel-friendly at small sizes
- The sprite should look good at **200×200 px** on screen (the default render size)
- Avoid thin lines that disappear when scaled down
- Use the species' palette from `server/sprites.ts` as a starting point:

```
p  — primary body color
d  — dark / shadow
l  — light / highlight  
b  — belly / white areas
K  — outline (dark)
a  — accent (beak, horn, glow, etc.)
```

---

## Registering the sprite in code

**You don't need to touch any code.** The app automatically detects atlas files via [`AtlasBuddy`](../client/src/components/AtlasBuddy.tsx): it fetches `/sprites/{species}/idle.json` on load. If the file exists, the full atlas animation plays. If it doesn't (404), it falls back to the canvas-drawn sprite silently.

Just drop the files in the right folder and the app picks them up.

### (Optional) Add a background

If you want a custom scene behind the pet (like the dragon's night sky), create `client/src/backgrounds/{Species}Background.tsx` following [`DragonBackground.tsx`](../client/src/backgrounds/DragonBackground.tsx) as a reference, then add the species check in `BuddyMode.tsx` and `PlayMode.tsx` alongside the existing `dragon` check.

---

## Submitting

1. Fork the repo
2. Add your files to `client/public/sprites/{species}/`
3. Add the `{Species}Buddy.tsx` component
4. Register in `client/src/sprites/index.tsx`
5. Open a PR with the title: `feat(sprites): add {species} sprite animations`

> **Important:** Do NOT modify `server/buddy.ts`, `server/sprites.ts`, or `BuddySprite.tsx` — the canvas fallback must remain intact.

---

## Questions?

Open an issue tagged `sprites` or `help wanted`.
