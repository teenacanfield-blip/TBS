# The 13 Dynasties.net

A top-down pixel-art survival game. Plain HTML, CSS, and JavaScript — no build step,
no dependencies. Runs in Chrome, Safari, Firefox, Edge, DuckDuckGo, and mobile browsers.

## Playing locally

Open `index.html` in a browser, or run the local dev server and visit
<http://localhost:8123/the-13-dynasties/>. Plain <http://localhost:8123> is the
hub now, which has a Play button for this game.

> **`localhost` only works on your own computer.** Sending that address to a friend
> will not work — their browser looks at *their* machine. To let other people play,
> publish the game (below).

## Playing on a phone or tablet

Touch controls appear automatically on touch devices: a movement pad on the left and
action buttons on the right. The game scales to fit any screen. Landscape gives you a
much larger view than portrait.

## The three worlds

The game is three worlds stacked on top of each other, and each one is meaningfully
nastier than the one above it.

| | Hunger | Healing | Holds |
| --- | --- | --- | --- |
| **The Surface** | slow | fast | cave guards, and wolves after dark |
| **The Undergrove** | 2x | barely | thugs, spitters, brutes, three Wardens |
| **The Deep Hollow** | 3x | none at all | all of the above, and the Goblin King |

Sprinting burns food, so it is worth saving for when it counts.

### Getting to the end

There is no beeline any more. The route is:

1. **Days 1–4 on the surface.** Repair the house, get an axe, a pickaxe and a sword.
   Sleeping only works after dark and costs food, so a day takes a day — and wolves come
   out at night, so a wall or two is time well spent. Nine **supply crates** are buried
   around the map; each one opens once, and walking out to find them beats chopping the
   same clearing over and over.
2. **Day 5:** the rotting log gives way and the Undergrove opens.
3. **Three Wardens** hold one **Dynasty Seal** each, one to a corner chamber. All three
   open the Sealed Stair in the fourth corner. A Warden never gives up a chase.
4. **The Deep Hollow.** Crystal only grows down here, and the throne doors are barred
   from the inside — nothing short of an **iron sword** levers them apart.
5. **The Goblin King**, who fights in three phases, calls his guard when he is hurt, and
   enrages for the last quarter of his health. Watch the ground for his slam.

   He has **40,000 health** and hits for 40 — 46 on the slam. That is 728 swings of a
   Tier 3 iron sword, so go in with a full shield, armour, food and med kits. Ungeared he
   kills you in three hits; with a Tier 3 shield and iron armour it takes twenty.

### Tools go to Tier 3

The upgrade bench has two rungs now, not one. Tier 2 is stone-and-wood work you can do
above ground. Tier 3 needs Undergrove iron and Deep Hollow crystal — and a Tier 2 pickaxe
is what lets you cut iron in the first place. So the ore chain runs: stone pickaxe → iron
→ iron pickaxe → crystal → iron sword.

Three things are new on the crafting list: the **Lantern** (you carry your own light,
which is the difference between groping through the Deep Hollow and seeing it), **Iron
Armour** (soaks a flat 8 damage off every hit), and the **Med Kit** (+65 health, for when
bandages are not enough).

## Controls

| Key | Action |
| --- | --- |
| `WASD` | Move |
| `Shift` | Sprint |
| `Space` | Gather / attack |
| `F` | Eat |
| `B` | Use bandage, then med kit |
| `E` | Interact (repair, sleep, enter cave, free Ned, upgrade bench, open doors) |
| `C` | Crafting menu |
| `I` | Inventory |
| `J` | Play together |
| `K` | Choose your look |
| `1`–`6` | Place wall / stone wall / campfire / torch / bedroll / workbench |
| `P` / `L` | Save / load |
| `X` | Skip cutscene |

## Publishing

This game is now one of the games on the Thirsty Bear Hub, and the whole site
publishes together. The steps — GitHub Pages, the Cloudflare DNS records, and
the `thirstybearstudios.com` setup — are in `../PUBLISHING.md`.

Do not create a `CNAME` file in this folder. There is one at the top of the
site, and a second one here would fight with it.

To publish a change to this game, run the bumper at the top of the site and
push:

```bash
powershell -ExecutionPolicy Bypass -File ../bump-version.ps1
```

It gives this game, the hub and Ugg their own version counters, so a change here
does not force everyone to re-download the others.

## Save data

Saves live in the player's own browser (`localStorage`), on their own device. They are
not shared between people or between browsers, and clearing browser data erases them.
If a browser blocks storage (for example Safari private mode), the game shows a message
instead of crashing.

The game autosaves every 45 seconds, after sleeping, when moving between the surface and
the Undergrove, and when the tab is closed or hidden. `P` saves manually and `L` reloads
the last save.

## Dying

Death is not a wipe. Choosing **Get Back Up** revives you at the house, keeping your
tools, buildings, level and world progress, at the cost of half your carried raw
materials. **Start Over** erases the save and begins a fresh run.

## Multiplayer (two players)

Press **J** to open the Play Together panel. One player hosts and gets a six-character
code; the other types it in and joins.

There are two ways to connect:

- **Same Computer** — two tabs in one browser, using `BroadcastChannel`. No internet, no
  library, nothing that can fail to connect. Host in one tab, then open a second tab,
  type the code, and press *Same Computer* again.
- **Host a World / Join** — over the internet, peer-to-peer via WebRTC. Loads PeerJS from
  a CDN the first time it is used.

### How it works

The host is authoritative. It owns the clock, the enemies, and Ned; joiners mirror that
state and send their own position plus *requests* to act. When a joiner swings at a thug
it does not change the thug's health directly — it asks the host, and the result comes
back in the next snapshot, so the two games can never disagree about who is alive.

On connecting, the host sends its world seed and the joiner regenerates its whole map to
match. Both players end up in an identical world.

Shared between players: the map, felled trees and rocks, placed buildings, enemy health
and positions, the day/night clock, and Ned. Kept private to each player: inventory,
health, hunger, level, and explored fog.

### Limits worth knowing

- **Two players.** The protocol is written for one host and one joiner.
- **Strict networks block WebRTC.** Some school and guest wifi will refuse peer-to-peer
  connections, and fixing that needs a paid relay (TURN) server. Same Computer mode
  always works and is the reliable fallback.
- **PeerJS is an external service.** Internet play depends on their free signalling
  server being up.
