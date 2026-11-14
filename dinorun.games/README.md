# dinorun.games

A folder to hold the dinorun.games titles. So far:

- **The eyes game** — not started.
- **Laser tag** — in `laser-tag/`, listed in `games.js` as Laser’s Tag. A 3D
  arena game using the Floodlight characters: 1 v 1 up to 5 v 5, an Abilities
  mode (Spider, Gecko), Practice, three difficulties, and a shop paid for with
  coins from wins. Two files: `index.html` is the whole game, and `models.js`
  holds the character models and animations as base64. Only three.js comes from
  a CDN, so the folder also runs by double-clicking `index.html`.
- **Patrol Rush** — in `patrol-rush/`. Cops and robbers in a 3D city, with the
  cars, paint and sky lifted from Kaido Festival. One file; only three.js and
  its post-processing add-ons come from a CDN.

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
it stays in the Library as well. Laser’s Tag and Patrol Rush (the police chaser)
are in it. The ones still being made — the eyes game for now — are in
`DINORUN_SOON` at the bottom of `games.js` and
show as "Soon" cards that cannot be opened. When one is done, give its entry
`collection: 'dinorun'` and delete it from `DINORUN_SOON`.

> This folder is named for a domain, so it is worth saying plainly: nothing in
> here is wired to one. It is served from the same site as everything else
> unless that gets set up separately.
