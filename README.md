# Linea — scroll film website (handover)

A single-page site for Linea, a residential architecture studio. The hero is a pinned "scroll film": as the visitor scrolls, a 10-second video plays forward (and backward) frame by frame, moving through four houses. Each house's name, description, site and build type update in an info strip as it appears.

This is a **design concept**. The studio, houses, contact details and footage are placeholders (see "Before going live").

---

## Contents

```
linea-site/
├── index.html                 Page markup
├── css/styles.css             All styles (design tokens at the top)
├── js/main.js                 Scroll film, work cards, smooth scroll, mobile menu
├── assets/
│   ├── frames/                f001.webp … f240.webp — the film as still frames (24 fps × 10 s)
│   ├── stills/                Images used in the Studio and Selected Work sections
│   └── video/source.mp4       Original video the frames were made from (1280×720, 24 fps)
├── scripts/extract-frames.sh  Rebuilds assets/frames from a video
└── linea-standalone.html      Everything in one file (frames embedded) for quick previews
```

There is no build step and no framework. Plain HTML, CSS and JavaScript.

## Running it locally

The page loads its frames with `fetch()`, which browsers block when you open `index.html` directly from disk. Serve the folder instead:

```bash
cd linea-site
npx serve .            # or: python3 -m http.server 8000
```

Then open the address it prints. `linea-standalone.html` also opens directly by double-clicking. It is useful for sharing a preview, but it is too heavy (≈10 MB) to use as the production page.

## Deploying

Upload the whole folder to any static host (Netlify, Vercel, Cloudflare Pages, S3, shared hosting). Recommended:

- Serve `assets/` with long cache headers (e.g. `Cache-Control: public, max-age=31536000, immutable`) and rename files if they change.
- Make sure `.webp` is served as `image/webp`.
- Leave out `assets/video/source.mp4` and `linea-standalone.html` from the live site. They are only kept for editing.

## External dependencies

Both are loaded from CDNs in `index.html`. You can self-host either one.

| What | Where | Notes |
|---|---|---|
| Playfair Display, Inter | Google Fonts | Display serif and body sans |
| Lenis 1.3.26 (MIT) | cdn.jsdelivr.net | Smooth wheel/trackpad scrolling. The page still works if it fails to load; scrolling is just native. |

---

## How the scroll film works

The film is drawn on a `<canvas>` from still frames rather than by seeking a `<video>`. Seeking video on scroll is unreliable across browsers (especially Safari), while drawing frames is smooth and predictable.

**Scroll → frame.** The `#film` section is `560vh` tall and its `.stage` is `position: sticky`. Scroll progress through the section (0–1) is converted to a frame number by `progressToFrame()` using the `KEYS` table in `js/main.js`:

```js
var KEYS = [[0,0],[.17,36],[.25,72],[.43,110],[.50,130],[.68,160],[.76,184],[1,LAST]];
//          [scroll progress, frame]
```

The segments are uneven on purpose. Scrolling is slow while each house is on screen and quicker through the transitions (concrete wall, valley haze, tree trunk).

**Which house is showing.** `CUTS = [58, 124, 175]` holds the frame numbers where the next house takes over. These drive the counter (01/04) and the info strip.

**Smoothness.**
- The displayed frame eases toward the scroll position (`tick()`, time constant 55 ms), and neighbouring frames are blended for in-between positions.
- Lenis smooths mouse-wheel and trackpad input (`lerp: 0.09`). Touch scrolling on phones stays native.
- Phones (≤ 860 px wide) use every other frame (`STEP = 2`).

**Memory (important).** A decoded 1152×648 frame is about 3 MB. Keeping all 240 decoded would need about 700 MB and crashes phones and Safari. So:
- all frames are downloaded compressed in the background (≈7.4 MB total);
- only a window of frames around the playhead is decoded (`R = 14` desktop, `8` mobile), and frames leaving the window are released with `ImageBitmap.close()`;
- everything decoded is released when the tab is hidden.

In testing, the page held at most about 30 decoded frames on desktop and 21 on mobile. If you raise `R` or the frame resolution, re-check memory on a real iPhone.

**Accessibility.**
- With `prefers-reduced-motion`, Lenis is disabled and the film follows the scroll directly with no easing or text transitions.
- The canvas has an `aria-label`, and the info strip is `aria-live="polite"` so screen readers announce each house.
- The mobile menu is keyboard-accessible (focus moves in and out, Escape closes it).

---

## Common edits

**Change house text.** Edit the `HOUSES` array at the top of `js/main.js`. Each entry has `name`, `site`, `build`, `desc`, `still` (card image), `pos` (card crop, CSS `object-position`) and `jump` (where in the film a card click scrolls to, 0–1). The first house's text is also written into `index.html` so it shows before JavaScript runs.

**Replace the film.**
1. Put the new video at `assets/video/source.mp4`.
2. Run `./scripts/extract-frames.sh` (needs ffmpeg).
3. If the frame count changes, update `FRAME_COUNT` in `js/main.js`.
4. Re-time `KEYS`, `CUTS` and each house's `jump` to the new video. The easiest way is to make a contact sheet with timestamps:
   ```bash
   ffmpeg -i assets/video/source.mp4 -vf "fps=4,scale=240:-1,drawtext=text='%{pts\:hms}':fontcolor=red:fontsize=18:x=4:y=4,tile=8x5" -frames:v 1 sheet.jpg
   ```
   Frame number = seconds × 24.
5. Re-export the stills in `assets/stills/` from good frames.

For a new video to work well: one continuous camera move, constant speed, no cuts or hard fades, and 16:9 at 720p or higher.

**Change the film's pacing.** Make `#film { height: 560vh }` in `css/styles.css` taller for a slower film overall, or shorter for a faster one. Use `KEYS` for pacing within the film.

**Colours and type.** All tokens are CSS variables at the top of `css/styles.css` (`--bg`, `--bg-2`, `--bg-3`, `--ink`, `--muted`, `--line`, `--ghost`, `--serif`, `--sans`).

---

## Before going live

- [ ] **Footage rights and watermark.** The film is AI-generated with Google Gemini and carries Gemini's visible sparkle watermark in the bottom-right corner. Replace it with footage the studio has the rights to publish.
- [ ] **Placeholder content.** Update the email (`hello@linea-studio.example`), phone number, studio stats, house names and descriptions. The houses are fictional.
- [ ] **Social links.** Instagram and Houzz in the hero and footer currently point to `#`.
- [ ] **Demo badge.** Remove `<div class="demo-badge">` from `index.html` and `.demo-badge` from the CSS.
- [ ] **Meta and sharing.** Add a favicon, an Open Graph image and `og:` tags.
- [ ] **Real device testing.** Test on at least one iPhone (Safari) and one Android phone (Chrome), scrolling quickly through the whole film.

## Browser support

Current Chrome, Edge, Firefox and Safari (desktop and iOS 15+). The frames use WebP. `createImageBitmap` is used where available, with an `<img>` fallback.
