# dinorun.games

A folder to hold the dinorun.games titles. So far:

- **Eyes** — in `eyes/`. A pixel-art stealth game from the USB stick: sneak
  past seven watching eyes, take the necklace from its glass case and get back
  out the window. The eyes doze for 2.5 seconds at the start of a run, it goes
  full screen when you start (F toggles), and its chiptune sound effects are
  made live with Web Audio. Sound starts off; M or the Sound button turns it on,
  and the choice is remembered. One file with nothing loaded from the
  internet, so it also runs by double-clicking `index.html`.
- **Laser tag** — in `laser-tag/`, listed in `games.js` as Laser’s Tag. A 3D
  arena game using the Floodlight characters: 1 v 1 up to 5 v 5, an Abilities
  mode (Spider, Gecko), Practice, three difficulties, and a shop paid for with
  coins from wins. Two files: `index.html` is the whole game, and `models.js`
  holds the character models and animations as base64. Only three.js comes from
  a CDN, so the folder also runs by double-clicking `index.html`.
- **Patrol Rush** — in `patrol-rush/`. Cops and robbers in a 3D city, with the
  cars, paint and sky lifted from Kaido Festival. One file; only three.js and
  its post-processing add-ons come from a CDN.
- **Flight Deck** — in `flight-deck/`, in the dinorungames.co tab. The flight sim
  from the USB stick: six aircraft, ten airfields, autoland, stalls and G-force.
  One file with no libraries. The sky, ground and 3D grass are drawn with WebGL 2
  on a canvas under the 2D one; without WebGL 2 it falls back to flat ground. The
  same file runs on its own (`flight-sim.html` on the stick), minus the gamepad
  line at the bottom.

## Adding one

Each game gets its own folder in here with an `index.html` that is playable on
its own, the same as everything in `demos/`:

```
dinorun.games/
  eyes/
    index.html
  laser-tag/
    index.html
```

A game is not on the site until it is listed in `games.js` at the top of the
project — that file is the shelf, and the hub builds every page from it. Add an
entry with the folder's path as `url` and it appears.

Two things every game here should have, because everything else on the site
does:

- **A viewport tag**, or a phone renders it at about 980px and scales it down.
- **The gamepad layer** — one line before `</body>`, which turns an Xbox pad
  into the keys the game already reads:

  ```html
  <script src="../../gamepad.js?v=2"></script>
  <script>window.Pad && Pad.start({ a: 'Space', b: 'Escape', start: 'Enter' });</script>
  ```

  If the game's menus are buttons you click rather than keys you press, name
  them so the d-pad can walk them: `Pad.start(keys, { menu: '.btn' })`. See
  `gamepad.js` for the full set of controls.

## The dinorungames.co tab

The hub has a tab named **dinorungames.co** (`#/dinorun`) that shows these
games together. Only its label is that name; the folder stays `dinorun.games`
so the games' addresses do not change.
A finished one is a normal `games.js` entry with `collection: 'dinorun'` added;
it stays in the Library as well. Laser’s Tag, Patrol Rush (the police chaser),
Eyes and Flight Deck are in it. A game still being made goes in `DINORUN_SOON` at the
bottom of `games.js` (empty right now) and shows as a "Soon" card that cannot
be opened. When one is done, give its entry `collection: 'dinorun'` and delete
it from `DINORUN_SOON`.

> This folder is named for a domain, so it is worth saying plainly: nothing in
> here is wired to one. It is served from the same site as everything else
> unless that gets set up separately.
