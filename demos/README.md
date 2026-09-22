# Demos

Drop each demo in here, in its own folder, with an `index.html` inside.

That is the whole setup. There is no path to type and nothing to edit — the hub
checks this folder when it loads and turns the Play button on for any demo it
finds.

## The folder names it looks for

| Demo | Folder | Status | Came from |
| --- | --- | --- | --- |
| Pokémon Rip and Go | `rip-and-go` | playable | written here, from nothing |
| The Show | `the-show` | playable | written here, from nothing |
| 2B or Not 2B | `2b-or-not-2b` | playable | written here, from nothing |
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

2B or Not 2B is 3D as well, and does not. It carries its own renderer in
`gfx.js` — plain WebGL, one shader — because a game set in a classroom is the
last one that should go blank on a school network. Nothing in that folder is
fetched: the sound is synthesised, the level is code, and there are no images.

The Show is the same deal in 2D. Four files, nothing fetched: the sprites are
typed out as letters in `art.js`, the eight leagues are functions in
`levels.js`, and the organ between innings is oscillators in `sound.js`. It
also checks its own levels on load — a gap wider than a jump is a typo, and it
says so in the console rather than waiting to be found on the fifth league.

Pokémon Rip and Go holds to the same rule, and it is the one demo where that
took some arguing with itself: a game about collecting creature art, with no
creature art in it. It used to cheat — nineteen body plans wearing three
palettes each — and you could feel it, because three creatures that share a
drawing are one creature with three names. So every one of the thirty-three is
now typed out on its own in `dex.js`, sixteen rows of sixteen characters, and
the people in `folks.js` the same way: four bodies, six frames apiece, a
palette and a name each. A shiny is still the palette turned, because that one
really is the same creature.

`world.js` is the rest of it — every town, route, cave and interior as a block
of text, one character per tile, with the doors, the encounter tables and
everyone standing in one listed underneath. All three files check themselves on
load, the way The Show checks its levels: a row one character short shifts a
whole creature, a map that names a tile nobody drew is a typo, and a door
pointing at a room that does not exist is a dead end nobody would find until
they walked into it. They say so in the console instead of waiting.

The pack loop survives as its own mode rather than as the whole game. A pack
battle is a sealed pack each, five kept out of eight, and no team, bag or exit
— the card shop runs brackets for a purse, and every gym leader will hand over
the badge that way if you would rather not bring a team. The first build of it
was a lottery: a last-stage rare landed at the same level as everybody's
first-stage commons and swept all five without being hit back. Cards now enter
at fighting weight, their level set from their own base total, which put a
same-skill match back to roughly a coin flip and left the draft and the chart
to decide it.

`codes.js` also holds the pack seeds, which are the other half of the same
idea. Every draft runs on a seed, shown while you choose, and six characters
carry a version, a bracket and twenty-five bits of it. The generator is a
mulberry32 sitting behind one swappable source that every `rnd`, `pick` and
`chance` in the game already goes through, so a pack can be torn open on a
seeded run and the real dice put back the moment it is done — restored in a
`finally`, because a game left running on a seeded generator repeats itself
forever. The house draws one step along the same seed, so two people on the
same six characters face the same table rather than the same hand and a
different opponent.

`codes.js` is the multiplayer, such as it is. There is no server behind any of
this, so a team code is the oldest kind there is: your six turned into about
twenty characters you can read down a phone, and a battle against whatever
somebody types back in. It carries which creature, what level and whether it is
the odd colour — fourteen bits each — and deliberately not the moves, which are
worked out from the learnset instead. That trade is what keeps the code at
twenty characters rather than fifty, and it also means nobody can hand you
something holding four moves it could never learn. Base 32 without I, O, 0 or
1, a ten-bit checksum so a mistyped letter is caught rather than arriving as a
level 93 nothing, and a self-check that round-trips every creature at five
levels and confirms single-character typos actually fail.

The one thing it does load is whatever you give it. `lab.html` takes a PNG
sprite sheet off your desktop, cuts it into frames, and lets you point a frame
at any of eighty-nine targets — all thirty-three creatures and all fourteen
people, four frames each. The assignment is kept in the browser and every
screen in the game asks for it before it draws its own art. Nothing is fetched
over a network either way.

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
