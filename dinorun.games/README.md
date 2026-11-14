# dinorun.games

A folder to hold the dinorun.games titles. So far:

- **The eyes game** — not started.
- **Laser tag** — in `laser-tag/`, listed in `games.js` as Laser’s Tag. A 3D
  three-a-side arena game using the Floodlight characters. It is one file: the
  character models and animations are packed inside it as base64, and only
  three.js comes from a CDN, so it also runs by double-clicking it offline of
  the site.
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

> This folder is named for a domain, so it is worth saying plainly: nothing in
> here is wired to one. It is served from the same site as everything else
> unless that gets set up separately.
