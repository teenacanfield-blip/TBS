# Demos

Drop each demo in here, in its own folder, with an `index.html` inside.

That is the whole setup. There is no path to type and nothing to edit — the hub
checks this folder when it loads and turns the Play button on for any demo it
finds.

## The folder names it looks for

| Demo | Folder | Status | Came from |
| --- | --- | --- | --- |
| RC Craze | `rc-craze` | playable | `Downloads\rc craze.html` |
| Liz | `liz` | playable | `Downloads\lizard3d_1.html` |
| Ninja Wing Wing | `ninja-wing-wing` | **not built** | only a sprite sheet exists |
| Legend Cart | `legend-cart` | playable | `Downloads\hyrule_speedway (8).html` |
| Animabal1 | `animabal1` | playable | `Downloads\diamond_at_bat_3d (4).html` |
| The Dragon's Last Breath | `dragons-last-breath` | playable | `Downloads\the-dragons-last-breath (8).html` |

Five of these were copied out of Downloads, which had many numbered versions of
each — the newest of each was taken. The copies in here are now the real ones;
editing the file in Downloads will not change what the site shows.

### These four need the internet

RC Craze, Liz, Legend Cart and Animabal1 are 3D and load `three.js` from
`cdnjs.cloudflare.com` when they start. That is fine on a normal connection, but
on wifi that blocks CDNs — some school and guest networks do — they will open to
a blank screen. The Dragon's Last Breath and both full games have no such
dependency and always work.

So RC Craze lives at `demos/rc-craze/index.html`.

**The spelling is flexible.** Ninja Wing Wing is found in `ninja-wing-wing`,
`NinjaWingWing` or `Ninja Wing Wing` — whichever you actually named it. Same for
the rest.

`game.html` and `play.html` work too, if that is what the demo's main file is
already called. The hub also checks for the same folder names sitting next to
`arcade/` instead of in here, so a demo that already lives elsewhere in the
project still gets picked up.

## What counts as a demo the hub can open

It has to be a **web** game — an `.html` file the browser can open, with its
JavaScript and CSS beside it, the same shape as The 13 Dynasties and Ugg.

Art files on their own are not enough. A folder holding only
`NinjaSpriteSheet1.aseprite` and `NinjaSpriteSheet1.png`, for example, has no
`index.html` for the browser to run, so the hub leaves that demo on **Soon**
until there is one. Aseprite files in particular are the editor's own format —
a browser cannot read them at all. Export to PNG and load that from your game
code.

## Adding a demo that is not on the list

Open `arcade/games.js` and copy one of the entries in `DEMOS`. The `id` you give
it is the folder name to make in here.

## If a demo does not show up

- Check the folder name matches the table exactly — all lowercase, dashes
  instead of spaces.
- Check there is an `index.html` directly inside it, not one folder deeper.
- Reload the page. The check runs once, when the hub loads.
- Opening the hub by double-clicking the file (a `file:///` address) stops
  browsers from doing this check at all. Run the dev server and open
  <http://localhost:8123/arcade/index.html> instead.
