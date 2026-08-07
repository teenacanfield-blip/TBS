# Ugg & the Undersaucer

A sidescrolling platformer about a caveman with a flying saucer bolted to his
underside, in a cave that lies to you. 50 levels across 5 stages, joined by a
Super Mario 3 style world map.

Plain HTML, CSS and JavaScript — no build step, no dependencies, no image, font
or audio files. Every sprite, every tile and every letter on screen is drawn
from character grids inside `game.js`.

This is a **separate game** from The 13 Dynasties in the folder above. Nothing
here touches those files.

Produced by Claude and Thirsty Bear Studios.
Made by Claude, Julian Canfield and Corey Canfield.

## Playing

Open `index.html` in a browser, or run the dev server in the parent folder and
visit <http://localhost:8123/ufo-caveman/index.html>.

| Key | Action |
| --- | --- |
| `←` `→` or `A` `D` | Walk, and move along the world map |
| `Space` / `W` / `↑` / `Enter` | Jump, and select on menus and the map |
| `Shift` / `S` / `↓` | Fire the saucer (hold to hover; limited stamina, recharges on the ground) |
| `R` | Back to the last checkpoint |
| `B` | Open the Mother Board (upgrades) from the map |
| `C` | Open the Character Lab (skin editor) |
| `E` | Open the level editor |
| `Esc` | Level → map → title |
| `M` | Mute |

Touch controls appear automatically on phones and tablets, and they work on the
menus and the map as well as in a level.

## Opening and ending

The game opens on a studio plate — *produced by Claude and Thirsty Bear
Studios*, with the bear having a drink — which holds for four seconds and can be
skipped with `Space`, then hands over to the title screen.

Clearing 5-10, the last level of the last stage, rolls the credits: Ugg reaching
the mothership, then **made by Claude, Julian Canfield and Corey Canfield** under
the Thirsty Bear Studios mark, followed by your run's numbers — levels cleared,
rocks found, chips installed and lifetime Oogs. `Space` returns to the title.

## The world map

Five stages of ten levels each. Every stage is its own map screen: a winding
trail of ten nodes that you walk along, with the tenth marked by a mothership.
Clearing a level lights its node green and opens the next one. Walking off the
right end of a cleared stage takes you to the next stage; walking off the left
end takes you back.

| Stage | | Specialises in |
| --- | --- | --- |
| 1 | The Crust | fake platforms, phantom platforms, critters, reversed controls |
| 2 | The Mirror Shelf | mirrored screens, conveyors, sawblades, input delay |
| 3 | Lightless Deep | darkness, strobing geometry, swapped buttons |
| 4 | The Upside | flipped gravity, wind, heavy and low gravity |
| 5 | The Mothership | crushers, boulders, doppelgängers, everything at once |

Level 1 of the first three stages is hand-built. The other 47 are composed from
a pool of hand-made rooms by a seeded builder, so each level is fixed and the
same on every machine, but no two are laid out alike. Room count and the density
of the stage's tricks both climb across its ten levels.

## The Character Lab

Press `C` on the title screen or the world map. Ugg is a 16x20 grid of coloured
pixels, so making a skin is editing that grid — the lab is a pixel editor for
the character, with a live preview that animates him exactly as the game will.

| Control | Action |
| --- | --- |
| Left mouse | Paint (drag to draw) |
| Right mouse | Erase to transparent |
| Arrows + `Space` | Move the cursor and paint without a mouse |
| `Backspace` | Erase the cursor cell |
| `[` `]` | Previous / next colour, or click a palette swatch |
| `C` | Next beard style (`Shift+C` for previous) |
| `Q` | Shave the beard off entirely |
| `1`–`4` | Switch skin slot |
| `S` | Save to the current slot and wear it |
| `R` | Reset to the original Ugg |
| `X` | Clear to an empty canvas |
| `Ctrl+C` / `Ctrl+V` | Copy / paste a skin code to share |
| `Esc` | Back to the map |

### Beards

The beard is a separate, procedurally drawn layer, so it is picked rather than
painted. `C` cycles the styles and `Q` shaves it off:

**Clean Shaven · Classic · Long · Braided · Goatee · Bushy · Forked · Mutton Chops**

Every style still knots up as the saucer's stamina drains, so the beard keeps
working as the gauge whichever you choose. Clean Shaven is the one trade-off:
you get the bare-chested look, but you lose the readout and have to watch the
stamina bar in the HUD instead.

The beard choice is saved with the skin slot and travels inside the shared skin
code, so a code carries both the pixels and the beard.

Four slots, each saved separately; the slot you last saved is the one Ugg wears
everywhere — in levels, as the map marker, on the title screen, and (recoloured)
as the doppelgänger that chases you in stage 5.

**Sharing skins.** `Ctrl+C` copies a skin code — a beard token followed by the
twenty rows, joined with slashes, using the same palette letters the game's own
art uses. It is short enough to paste into a chat message, and `Ctrl+V` in the
lab loads it. Anything unknown in a pasted code is treated as transparent and a
missing beard token falls back to Classic, so a malformed code can't break the
game.

**Two guides on the canvas.** A marker on row 8 shows where the beard hangs
from, and a bar beside rows 14-20 marks the hull band, which is redrawn in front
of the beard. Keep the saucer in those rows and a custom skin behaves exactly
like the built-in one; ignore them and the beard will simply drape differently.

## The Mother Board

Press `B` on the world map. Shiny rocks are the currency, and the upgrade screen
is a printed circuit board: a power rail down the left edge, copper traces
running right, and fourteen chips soldered onto the lines that feed them. A
trace is dull until the chip behind it is installed, then it lights up gold and
carries power to the next socket. Installed chips get a green LED; affordable
ones blink amber.

Arrows move between chips, `Space` installs, `B` or `Esc` goes back.

| Chip | | Cost | Does |
| --- | --- | --- | --- |
| C1 | Power Cell | 6 | +30 saucer stamina |
| VR | Regulator | 6 | Stamina refills 60% faster |
| HS | Heat Sink | 12 | Flying burns 20% less |
| C2 | Power Cell 2 | 18 | +30 more stamina |
| DP | Dampener | 12 | No stun when the saucer crashes |
| BO | Booster | 8 | Run 18% faster |
| OC | Overclock | 20 | Stronger thrust |
| TB | Tractor Beam | 8 | Rocks pull towards you |
| FU | Spare Fuse | 28 | Survive one hit per checkpoint |
| MB | Mag Boots | 14 | Wind no longer pushes you |
| HL | Headlamp | 10 | See much further in the dark |
| GY | Gyro Chip | 22 | Double jump |
| SC | Scanner | 18 | Fake and phantom tiles always show |
| ST | Stabilizer | 34 | Reversed and swapped controls stop |

**Earning rocks.** Every level banks only its best haul, once. Clear 1-4 with
six rocks and you bank six; clear it again with six and you bank nothing; go
back and find all nine and you bank the missing three. So rocks reward finding
more of a level, never grinding the same one. The board costs 216 rocks in
total against roughly 450 in the game, so a full build means real exploration.

The last two chips are the interesting ones: the Scanner and the Stabilizer
switch off lies the cave tells you. That is deliberate — the cave is allowed to
cheat, and the board is how you cheat back.

## The level editor

Press `E` on the world map to open the highlighted level in the editor, or `E`
while playing to edit the level you are standing in.

| Control | Action |
| --- | --- |
| Left mouse | Paint the selected tool (drag to draw) |
| Right mouse | Erase |
| `[` `]` | Previous / next tool, or click a tool in the bottom bar |
| `1`–`9` | Jump to one of the first nine tools |
| `WASD` / arrows | Pan the camera |
| `Z` | Cycle the effect on the room under the cursor |
| `T` | Type a message on the sign under the cursor |
| `S` | Save |
| `X` | Revert this level to its generated original |
| `Enter` | Test play from the spawn |
| `E` / `Esc` | Leave the editor |

Everything the game places is a character in a grid, so the editor paints all of
it the same way: rock and platforms, fake and phantom platforms, blinkers,
conveyors, bounce pads, spikes and goo, sawblades, crushers, homing sparks,
critters, boulder spawns, echo triggers, signs, shiny rocks, checkpoints, the
spawn point, and both the real and decoy motherships. Painting a spawn, goal or
decoy moves the existing one rather than adding a second.

`Z` sets the whole-room lie — reversed, mirrored, delayed, flipped gravity,
darkness, wind, and the rest — one room at a time, matching how the generated
levels are built. `T` replaces a sign's message with your own text, which is
what makes it worth lying on.

Edits are saved per level in `localStorage`. A level with an edit loads from
that edit forever after, and the map marks it `EDITED`; `X` throws the edit away
and puts the generated level back. The generated levels are produced from a
fixed seed, so reverting always returns exactly the original.

## The beard

Ugg's beard hangs from his chin, tucks behind the UFO, and comes back out below
the hull as a long tuft. That tuft is the stamina gauge. Fly, and it slowly knots itself up — shorter, lumpier, more matted the
lower the stamina gets. Run the stamina all the way out and the beard is fully
tangled, the saucer quits, and he drops out of the sky.

The crash does not kill him. He lands hard, sits there sprawled for a moment,
and the UFO charges back up while he sits. Once it has enough charge it
restarts on its own and floats him back up. The only way the crash kills you is
if you were flying over something that kills you.

So the beard tells you how much flight you have left without ever looking at the
HUD — and running out is a delay, not a death.

## The point of the game

The cave is allowed to lie about the world. It reverses your controls, delays
them, swaps your jump and thrust buttons, mirrors the screen, flips gravity,
turns out the lights, blows you sideways, and builds platforms that are not
there.

Two things never lie:

- **The badge row** at the top of the screen always names the trick that is
  currently running, so you can always tell *what* is being done to you.
- **Checkpoints** are honest. They are frequent, and dying only costs you the
  walk back.

Everything else is fair game. The wooden signs are wrong on purpose. One of the
motherships is a decoy.

## The tricks

| Badge | What it does |
| --- | --- |
| `<> REVERSED` | Left and right are swapped |
| `BUTTONS SWAPPED` | Jump becomes thrust and thrust becomes jump |
| `INPUT DELAY` | Your input arrives about a fifth of a second late |
| `MIRRORED` | The whole world renders back to front |
| `GRAVITY FLIPPED` | You fall upward and walk on the ceiling |
| `HEAVY` / `LOW GRAVITY` | Gravity doubles or nearly disappears |
| `LIGHTS OUT` | You can only see a small circle around yourself |
| `WIND` | A constant shove sideways |
| `FLICKER` | The level itself strobes in and out of view |

Plus, without any badge to warn you: platforms that look solid and are not,
platforms that are invisible and are, blinking platforms, conveyors, crushers,
sawblades, homing sparks, a rolling boulder, cave critters, and a doppelgänger
that copies everything you did two and a half seconds ago and kills you with it.

## How it is built

- `index.html` — a canvas and four touch buttons, nothing else
- `style.css` — page furniture and the touch pad; no game text lives here
- `game.js` — everything

**Rendering.** The game draws into a 320x180 art-pixel buffer and scales it up
3x with nearest-neighbour filtering, which is where the handheld look comes
from. One art pixel is two world pixels, so a tile is a 16x16 sprite. Sprites
are authored as character grids and baked once into small canvases; the
doppelgänger is the player sprite through a palette swap. Because the player is
just such a grid, the Character Lab can rewrite it at runtime and re-bake — a
custom skin is not a special case anywhere in the renderer.

**Text.** All of it — HUD, menus, map, signs — is a 5x7 bitmap font defined in
`FONT`, baked per string and cached. At 3x a glyph is 15x21 screen pixels, so it
stays pixel-art and stays readable. There is no web font and no DOM text.

**Levels.** Rooms are 16x18 tile **chunks** written as ASCII art (`CHUNKS`).
`STAGES` gives each stage its palette, its pool of rooms and the set of lies it
may tell; `composeLevel` stitches a level out of them with a seeded RNG. To add
a room, write a chunk and drop its name into a stage pool.

A level is a plain character grid plus a zone list — `sourceFromChunks` builds
that grid, `buildLevel` turns it into a playable level by extracting the entity
markers out of it, and the editor writes to the same grid. That is why anything
the generator can place, the editor can place too.

Keep every chunk's walking surface on the same row as its neighbours' — a
mismatch there becomes an invisible wall at the seam.

## Saves

Progress (cleared nodes, best rock haul per level, installed chips, rocks spent,
furthest unlocked level, total deaths) lives in `localStorage` on the player's
own device, alongside any edited levels. Clearing browser data resets it. If
storage is blocked, the game still runs, it just will not remember anything.
