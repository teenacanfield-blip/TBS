# Thirsty Bear Hub

A launcher for your games — the shelf that Steam or the Xbox app would give you,
except it is yours, it is free, and it is four files.

It currently hosts:

- **The 13 Dynasties** — the game in the folder above this one
- **Ugg & the Undersaucer** — the game in `../ufo-caveman/`

Plain HTML, CSS and JavaScript. No build step, no dependencies, no image files —
every piece of cover art on the site is drawn in code by `art.js`.

## Opening it

Open `index.html` in a browser, or run the dev server in the folder above and
visit <http://localhost:8123/arcade/index.html>.

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

You never type a path for a demo. Put it in `../demos/<name>/index.html`, where
`<name>` is the demo's `id` from `games.js`, and the hub finds it on the next
reload and turns its Play button on. See `../demos/README.md` for the list of
folder names.

## Adding a game

1. Put the game in its own folder next to this one, so nothing it does can touch
   the other games.
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

4. Add cover art in `art.js`. Write a `yourGameScene(w, h, focal)` function
   alongside the two that are there, then add its `id` to `scene()`, `defs()`
   and `icon()`. `focal` is where the main subject sits across the frame — the
   wide banner passes `0.66` so the title text never covers it, the tall card
   passes `0.5`.

   If you would rather not draw a scene, the quickest shortcut is to make
   `defs()` return a gradient and have your scene return one full-size `<rect>`
   filled with it. The site works fine with a plain coloured card.

That is the whole job. Nothing else needs editing.

## Path gotcha

`url` is relative to this folder, so a game one level up is `../index.html` and
a sibling folder is `../folder/index.html`.

If the filename has spaces or punctuation in it, write it the way a URL wants
it: `../ufo-caveman/game%20load%20up!.html` — `%20` is a space.

## Publishing

The hub goes up with the rest of the folder. Follow the *Publishing to GitHub
Pages* steps in `../README.md`, and it will be live at:

```
https://YOUR-USERNAME.github.io/YOUR-REPO-NAME/arcade/
```

## Putting it on thirstybearstudios.com

Corey owns `thirstybearstudios.com`, so the buying step is done. Two things left,
and only the first is a code change.

Remember to renew it — a domain is rented yearly, not bought once. If it lapses
the address stops working and someone else can take it.

### 1. Make the hub the front page

Right now the root address opens The 13 Dynasties, because that game's
`index.html` is the one sitting at the top of the project. For
`thirstybearstudios.com` to land on the hub, the hub has to be the file at the
top instead:

1. Make a folder next to this one called `the-13-dynasties` and move
   `index.html`, `game.js` and `style.css` from the parent folder into it.
2. Move `bump-version.ps1` in there too — it edits whichever `index.html` is
   sitting next to it.
3. Move `arcade/index.html`, `style.css`, `app.js`, `art.js` and `games.js` up
   into the parent folder.
4. In `games.js`, change the two `url` values from `../` to `./` — so
   `./the-13-dynasties/index.html` and `./ufo-caveman/game%20load%20up!.html`.

### 2. Point the domain at GitHub

Make a file called exactly `CNAME` — no extension, no `.txt` — in the top
folder, containing one line:

```
thirstybearstudios.com
```

Then, in the registrar's DNS settings, add these records:

| Type | Name | Value |
| --- | --- | --- |
| A | `@` | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |
| CNAME | `www` | `YOUR-USERNAME.github.io` |

Finally, in the repository go to **Settings → Pages**, put
`thirstybearstudios.com` in *Custom domain*, save, and tick **Enforce HTTPS**
once it lights up.

DNS takes anywhere from a few minutes to a day to spread. After that, typing
`thirstybearstudios.com` into any browser opens the hub.

### Typing it and searching it are not the same thing

Typing `thirstybearstudios.com` into the address bar works the moment DNS is
live.

Having it come up when someone *searches* "thirsty bear studios" on Google is a
different, slower thing: Google has to find the site, decide it is worth listing,
and rank it — which takes weeks and is never guaranteed. What helps:

- The page already has a real `<title>`, a description and share tags, which is
  most of the technical side.
- Submit the domain once at <https://search.google.com/search-console>.
- Links from anywhere real — an itch.io page, a YouTube description, a Discord
  server — matter more than anything you can change in the HTML.

Until it is indexed, share the link itself. That always works.
