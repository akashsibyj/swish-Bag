# Swish Loader

A kraft bag, sealed with two red anti-tamper tapes and a red **FEEDBACK** label carrying a QR
code (it scans to https://www.swishhh.net), drops onto a silver digital scale, trailing thin grey speed streaks, matched frame
by frame to the reference video. The scale's green standby LED is always lit. As the bag tumbles on
landing and its right side comes down onto the scale, the display shows `. . . . .` (evenly spaced); once the bag has settled each dot
turns into its letter in place, one every 0.28 s — `S....`, `SW...`, `SWi..`, `SWiS.`, **SWiSH** — on a 16-segment readout with a small `i`,
in the reference project's segment green (#2FE8AC). The animation plays **once** and then holds that
finished frame (bag on the scale, SWiSH lit, quote underneath). With `loop` turned on, the bag and
display instead fade out where they are and the drop replays every 5.02 s.

## How it works (no video is played)

It is a **React component** (`<SwishLoader />`) that renders one SVG scene and animates it with
CSS keyframes. There is no `<video>` element and no video file in the project:

- The **scale, backdrop, LCD and LED** are an image layer plus vector shapes; the SWiSH readout is
  drawn as 16-segment SVG polygons (`readout.js`).
- The **bag** is a set of still images: each frame of the reference video's bag was cut out,
  cleaned, upscaled 2× (Real-ESRGAN) and packed into WebP image sheets. CSS shows them one after
  another, cross-fading each into the next while it glides along the measured path, so the motion
  is continuous at 60/120 Hz rather than stepping at the video's 24 fps.
- The **speed streaks, seals, haze, quote** and all timing are code.

Nothing re-renders in React while it plays; the browser's animation engine does the work.

## Run it

Requires **Node.js 18 or newer** (https://nodejs.org).

```bash
npm start
```

The first `npm start` installs the dependencies automatically, then opens
http://localhost:3000 in your browser. If port 3000 is busy, the next free port is used and
printed in the terminal. Set `NO_OPEN=1` to stop the browser opening.

Other commands:

| Command           | What it does                                   |
| ----------------- | ---------------------------------------------- |
| `npm run build`   | Production build into `dist/`                  |
| `npm run preview` | Serves the production build on port 4173       |

### URL switches (for checking)

| URL                                   | Effect                                                      |
| ------------------------------------- | ----------------------------------------------------------- |
| `http://localhost:3000/?motion=always` | Animate even if the OS asks for reduced motion (e.g. over RDP) |

## Project structure

```
index.html                     page shell (grey background before JS loads)
vite.config.js                 dev server on port 3000, production build
scripts/preflight.mjs          Node version check + automatic npm install
src/
  main.jsx                     mounts the app, global error logging
  App.jsx / App.css            the page: the loader full screen, nothing else
  index.css                    base styles
  components/
    ErrorBoundary.jsx          keeps the page alive if a component fails
    SwishLoader/               the reusable loader component
      SwishLoader.jsx          component
      SwishLoader.css          layout, responsiveness, animation bindings
      SwishLoader.timeline.css keyframes measured from the reference video
      geometry.js              stage size, layer positions, timeline constants
      frames.js                position of each video frame in the image sheets
      assets.js                small image layers (backdrop, scale, resting bag + its seals), inlined
      readout.js               the 16-segment LCD readout (geometry, colour), shared with the LED
      player.js                draws the bag's video frames (3 reusable slots, clocked by the CSS)
      track.js                 measured timing/positions of each video frame (generated)
      sheets.js                picks the 1x or 2x footage for the screen
      assets/bag-frames-0.webp the moving bag, one 2x cut-out per video frame (sheet 1 of 2)
      assets/bag-frames-1.webp the moving bag (sheet 2 of 2)
      assets/ground-frames.webp the bag's shadow/reflection on the scale top, per frame
      assets/seal-frames.webp  the tamper tapes + FEEDBACK/QR label, registered to each video frame
      assets/1x/               the same four sheets at half resolution (phones, ordinary screens)
      SwishLoader.d.ts         TypeScript types
      index.js                 export
```

## Publishing to GitHub

The repo is ready to push: `.gitignore` excludes `node_modules/`, `dist/`, logs, `.env` files,
editor/OS files and preview renders. Commit everything else (including `package-lock.json` and
the `.webp` sheets in `src/components/SwishLoader/assets/`, which the app needs).

## Using the loader in another React app

Copy `src/components/SwishLoader/` into the app, then:

```jsx
import SwishLoader from './components/SwishLoader';

<SwishLoader />                         // fills its parent (880:720 if it has no height), loader centred
<SwishLoader fullscreen />              // fixed overlay over the whole viewport
<SwishLoader style={{ '--swish-size': '240px' }} />   // choose the loader's height
<SwishLoader onComplete={() => setReady(true)} />   // plays once, holds, tells you when SWiSH is done
<SwishLoader loop />                    // repeats every 5.02 s
```

| Prop         | Default     | Description                                              |
| ------------ | ----------- | -------------------------------------------------------- |
| `loop`       | `false`     | `false`: play once and hold on SWiSH; `true`: repeat every 5.02 s |
| `fullscreen` | `false`     | Fixed overlay covering the viewport                      |
| `motion`     | `"auto"`    | `"always"` animates even when the OS asks for reduced motion |
| `speed`      | `1`         | Playback-rate multiplier (clamped to 0.1–10)             |
| `label`      | `"Loading"` | Text announced to screen readers                         |
| `onComplete` | –           | Called each time SWiSH completes (3.36 s into a cycle)   |
| `quote`      | *see below* | Line under the loader; `false` hides it                  |
| `resolution` | `"auto"`    | Bag footage: `"1x"` (phones, normal screens), `"2x"` (large high-density screens) |
| `className`, `style` | –   | Passed to the root element                               |

## The seals

The tapes and label follow the reference project's design (same red, same caption, same QR
payload `HTTPS://WWW.SWISHHH.NET`; the QR is a real, decodable symbol). Because the bag is video
footage, they are applied per frame: the seal artwork is registered to each frame of the bag
(pose from the motion track, refined by image alignment and smoothed over time), lit by that
frame's paper so creases and shading read through the tape, motion-blurred like the footage
during the fall, and clipped to the bag's silhouette. Each frame's seal layer is drawn inside the
same group as that frame of the bag, so the two always move, fade and glide together.

## The quote

Under the loader sits the reference project's line, *"Still working… good food takes a
moment."*, shown from the start. Pass `quote="…"` to change it or `quote={false}` to hide it.
(It is decorative for screen readers, which hear the `label`, "Loading", instead.)

## Behaviour and safeguards

- **Compact and centred:** the loader is centred in whatever box it is given, with the quote
  under it, on a calm backdrop that settles to one flat grey towards the edges. Its height is
  44% of the smaller screen side, between 190 px (phones) and 360 px (large desktops), and never
  more than 72% of the box height, so it always fits with room around it (override with
  `--swish-size`). The box itself never shrinks below 260 px tall.
- **Reduced motion:** with the OS "reduce motion" setting on, it shows the finished frame
  (bag on the scale, SWISH and the LED lit) with a gentle fade instead of the animation.
  Windows turns this on when animations are disabled, which Remote Desktop sessions often do;
  open `http://localhost:3000/?motion=always` to animate anyway. In your own app pass
  `motion="always"` to override.
- **Remote Desktop:** RDP streams the screen at a reduced, variable frame rate, so motion can
  look choppy or frozen over RDP even when it plays at 60 fps on the machine itself. The loader
  uses ~2 ms of main-thread time per frame and holds 60 fps with the GPU disabled.
- **Background tabs / minimised windows:** it waits until it is visible and then starts from the
  beginning, rather than playing unseen.
- **Loading:** it starts as soon as its images are decoded (about 0.5 s on a normal
  connection). If the bag footage is not ready within 0.7 s, or fails to load, it plays a
  built-in fallback (the resting bag moving along the measured path) and switches to the full
  footage as soon as it has loaded and the bag is resting on the scale, where both look identical.
- **Any screen shape:** on boxes taller or wider than the 880:720 scene the backdrop extends
  smoothly, and the bag falls in out of a soft haze at the top of the scene instead of being cut.
- **Errors:** error boundaries keep the page alive (after a render failure the page shows
  "Loading…" and remounts the loader, up to 3 times; a failed app download shows a Reload
  button); unexpected errors are logged to the console with a `[swish]` prefix.
- **Phones / memory:** iPhone Safari closes a page that uses too much memory ("A problem
  repeatedly occurred"). The bag's 47 video frames are therefore drawn by a small frame player
  into three reusable slots (instead of 47 separately animated layers), and phones and ordinary
  screens get the half-resolution footage. Graphics layers went from ~117 to ~24 and the page's
  memory use roughly halved, with the same picture frame for frame.
- **No network needed** beyond loading the app itself; no external fonts or CDNs.
