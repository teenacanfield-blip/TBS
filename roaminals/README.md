# Roaminals

A monster-catching game in the shape of the original Game Boy ones, set
entirely inside one very large building: the Rothsay Grand Hotel, shut for
forty years.

The ghosts in it could not stay ghosts, so each one moved into an **object** — a
mop, a boiler, a ledger, a chandelier, a bell — and the object moved into an
**animal** that had wandered in out of the cold. That fusion is a Roaminal, and
what the ghost possessed is the creature's type. It is why the type chart is a
wheel of household things instead of fire and water.

You are the new night porter. Ten floors, a satchel of jars, and a lift that
only stops where you have a key.

Plain HTML, CSS and JavaScript — no build step, no dependencies, no image, font
or audio files. Every sprite, tile and letter is drawn from character grids
inside `game.js` into a 160&times;144 buffer — a Game Boy screen — and blown up
whole.

This is a **separate game** from the others in the folders alongside it.
Nothing here touches those files.

Produced by Claude and Thirsty Bear Studios.
Made by Claude, Julian Canfield and Corey Canfield.

## Playing

Open `index.html` in a browser, or run the dev server in the parent folder and
visit <http://localhost:8123/roaminals/index.html>.

| Key | Action |
| --- | --- |
| Arrows or `WASD` | Walk, and move any cursor |
| `Z` / `Space` | A — talk, open, confirm |
| `X` / `Esc` | B — back |
| `Enter` | Start — the menu |

Touch controls appear automatically on phones and tablets.

Saving is under Start &rarr; SAVE, into your own browser on your own device.
Clearing browser data erases it.

## One generation

Forty-four species, numbered 001 to 044, all catchable.

* **Commons** fill the floors. Most run in three-stage lines that evolve by
  level; three run in two stages.
* **Ultra rares** — five of them — turn up about one encounter in forty. They
  do not evolve into anything and nothing evolves into them; they arrived
  finished.
* **Legendaries** — three — exist once each, waiting on a fitting rather than in
  the dust: the desk bell in the lobby (six floor keys), the furnace door in the
  boiler room (three keys), and the clock face on the roof (all ten). Beat one
  or run from it and it goes back into the fitting, so it is never lost.
* **Shinies** roll on every wild creature, about one in 220. On a four-shade
  screen a shiny has to announce itself with shade alone, so ours wears the
  whole grid turned inside out. The Bright Penny, in the boiler room, doubles
  the odds.

Every species has its own silhouette: the family shape it is drawn from, plus a
mark nothing else in the generation wears — bristles, a horn, drawer fronts, a
winding key, a crown of keys, a canopy.

## The Ledger Wheel

    FLAME  CLOTH  BROOM  PAPER  WIRE
    BRASS  GLASS  FROST  ROOT   TOY   ...and round again

Each type overpowers the **two that follow it** and struggles against the **two
before it**. Ten links, no exceptions, printed on the lobby wall so nobody has
to memorise a chart.

## The building

| | Floor | What is in it |
| --- | --- | --- |
| 1F | The Lobby | Where you start. Bellhop Oskar holds the first key |
| B1 | Laundry | Lint, suds, and Laundress Maud |
| B2 | Boiler Room | Heat, pipes, the Bright Penny, and a furnace with something in it |
| 2F | Kitchens | Cutlery, a walk-in freezer, Chef Anouk |
| 3F | Guest Rooms | Velvet, room thirteen, Housekeeper Vane |
| 4F | Ballroom | Eight bars of music since the lights went out |
| 5F | Offices | Every guest since 1912, filed |
| 6F | Nursery | The toys are asleep. Were asleep |
| 7F | Conservatory | Glass held, everything under it grew back meaner |
| R | The Roof | The Night Manager, and the clock |

Floors are laid out by a seeded generator — nine rooms joined by corridors,
dressed with dust drifts, furniture and fittings — so the hotel is large, is the
same hotel for everybody, and costs the file nothing. A repair pass floods every
floor from the lift doors afterwards and digs a corridor to anything the flood
did not reach, so no room, box or member of staff can ever be sealed off.

Dust is this game's tall grass. Walk through a drift and something in it wakes
up.

## Systems

* Turn-based battles, four move slots with PP, damage that reads speed, attack,
  defence, a same-type bonus, criticals and the wheel.
* Attack and defence stages from BRACE, SNARL, SHARPEN and the moves that carry
  them; RATTLED costs a turn about a quarter of the time.
* Three jars — Jar, Ghost Jar, Vault Jar. A worn-down, rattled creature goes in
  far more easily than a fresh one.
* Levelling to 60, moves learned on the way, evolution when a line's level
  comes up.
* Staff ghosts to fight on every floor, a boss on each holding that floor's
  key, and a housekeeping cart that mends everything for free.
* Faint your whole party and you come to at the cart, having lost half your
  tokens. Nothing else.

## Ending

Beat the Night Manager on the roof for the tenth key, then take the clock at
midnight. Catching **044 MIDNIGHTER** rolls the credits.
