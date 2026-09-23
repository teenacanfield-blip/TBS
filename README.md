# Thirsty Bear Hub

A launcher for your games — the shelf that Steam or the Xbox app would give you,
except it is yours, it is free, and it is four files.

It currently hosts:

- **The 13 Dynasties** — the game in `the-13-dynasties/`
- **Ugg & the Undersaucer** — the game in `ufo-caveman/`

Plain HTML, CSS and JavaScript. No build step, no dependencies, no image files —
every piece of cover art on the site is drawn in code by `art.js`.

## Opening it

Open `index.html` in a browser, or run the dev server and visit
<http://localhost:8123>. The hub is the front page of the whole site, so that
bare address is all anyone needs.

Hitting **Play** runs the game right there in the page, the way a launcher does.
A small pill floats at the top with **Exit game** and a session timer; it fades
out while you play and comes back when you move the mouse. `Shift+Esc` also
exits, and the arrow button on the pill opens the game in its own tab instead.

`Esc` on its own is left alone deliberately — both games use it for their own
menus.

## What it remembers

Time played, number of sessions, when you last played, and which games you have
pinned. All of it lives in your own browser (`localStorage`), on your own
device. There is no account and no server, so nothing is shared between people
or between browsers, and clearing browser data resets it.

## Demos

The six demos in the **Demos** tab each get their own page with a review box —
stars, a name, and a comment — so people can tell you what they think before a
game is finished. Reviews are saved in the reader's own browser.

You never type a path for a demo. Put it in `demos/<name>/index.html`, where
`<name>` is the demo's `id` from `games.js`, and the hub finds it on the next
reload and turns its Play button on. See `demos/README.md` for the list of
folder names.

## Adding a game

1. Put the game in its own folder here, so nothing it does can touch the other
   games.
2. Open `games.js` and copy one of the two entries.
3. Change the fields. The ones that matter:

| Field | What it is |
| --- | --- |
| `id` | A short name with dashes. Must be unique — it becomes the page address. |
| `title` | Shown everywhere. |
| `suffix` | Optional bit shown small and in the accent colour, like `.net`. |
| `tagline` | Five or six words. |
| `url` | Path to the game's HTML file, **relative to this folder**. |
| `accent` | The game's colour, used for buttons and highlights on its pages. |
| `accentDark` | A dark colour that stays readable *on top of* `accent`. |
| `short` | One or two sentences, for the home page banner and the cards. |
| `about` | An array of paragraphs for the detail page. |
| `genres`, `features` | Short words; they become the little pill labels. |
| `controls` | Pairs of `['key', 'what it does']`. |
| `stages` | Optional. Triples of `['number', 'name', 'description']`. |
| `stagesTitle` | Optional heading above that table — `The three worlds`, `The five stages`. Defaults to `Stages`. |
| `notes` | Optional. Honest caveats worth knowing before playing. |
| `rating` | An id from the `RATINGS` list at the top of `games.js` — `everyone`, `e10`, `teen` or `adult`. Required: leave it off and the game shows as **Unrated**, which is the safe way round but looks unfinished. |
| `ratingNotes` | Optional. Short reasons for the rating, like `['Fantasy violence']`. A letter on its own tells a parent nothing. |

4. Add cover art in `art.js`. Write a `yourGameScene(w, h, focal)` function
   alongside the two that are there, then add its `id` to `scene()`, `defs()`
   and `icon()`. `focal` is where the main subject sits across the frame — the
   wide banner passes `0.66` so the title text never covers it, the tall card
   passes `0.5`.

   If you would rather not draw a scene, the quickest shortcut is to make
   `defs()` return a gradient and have your scene return one full-size `<rect>`
   filled with it. The site works fine with a plain coloured card.

That is the whole job. Nothing else needs editing.

## Age ratings

Every game and demo carries an age rating, and the **Ratings** tab is one tab
per rating — All, Everyone, Everyone 10+, Teen, Adult — showing games and demos
together, because somebody checking what is suitable does not care which shelf
a thing came off.

The four ratings are defined at the top of `games.js`, in `RATINGS`. Each one
has a letter for the little box, an age, and a sentence saying what it means.
To add a rating in the middle later, add it to that list with the right `min`
age; the tabs sort by `min`, so nothing else needs changing.

Each game's own page gets an **Age rating** panel: the letter, what the rating
means, and the specific reasons from `ratingNotes`. A game with nothing worth
flagging says so rather than showing an empty box.

**These are our own labels, not official ones.** A real ESRB or PEGI rating
costs money and is meant for boxed games. The site says so on every rating, so
nobody mistakes them for the real thing.

Right now everything on the shelf is **Everyone** or **Everyone 10+**. The Teen
and Adult tabs are there and empty — which is the honest answer, and means
nothing needs building if that ever changes.

## Path gotcha

`url` is relative to this folder — the top of the site — so a game in its own
folder is `./folder/index.html`.

If the filename has spaces or punctuation in it, write it the way a URL wants
it: `./ufo-caveman/game%20load%20up!.html` — `%20` is a space.

## Publishing

See PUBLISHING.md for the full GitHub Pages and Cloudflare walkthrough.

