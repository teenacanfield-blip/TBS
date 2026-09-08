/* The roster.
 *
 * This is the only file you edit to change a fighter — their art, their name,
 * or how they play. Open character-lab.html, draw, press Copy, and paste the
 * result over the FIGHTERS list below.
 *
 * ---------------------------------------------------------------- the art
 *
 * Each sprite is 14 columns by 14 rows, one character per pixel:
 *
 *     '.'        nothing — the background shows through
 *     '0'-'7'    an index into that fighter's `palette`
 *
 * The body sits in the middle eight columns; the three either side are for
 * wings, a trailing scarf, a weapon — anything that should stick out. Sprites
 * are drawn facing RIGHT and the game mirrors them when the fighter turns, so
 * you only ever draw one side.
 *
 * ------------------------------------------------------------- the numbers
 *
 *   weight   how hard you are to launch. Higher survives longer.
 *   speed    how fast you walk and how much you steer in the air.
 *   flaps    wing beats before you have to touch the ground again.
 *   atk      damage multiplier on everything you throw or swing.
 *   up       the move ATTACK gives while holding UP.
 *   dive     the move ATTACK gives while holding DOWN in the air.
 *
 * `up` and `dive` have to be names the game knows: fan, screw, bounce, upper,
 * drop, kick, pound, meteor. Anything else falls back to a plain jab.
 */
const FIGHTERS = [
  {
    id: 'wing', name: 'WING', tag: 'The all-rounder',
    weight: 1.00, speed: 1.00, flaps: 2, atk: 1.00, up: 'fan', dive: 'drop',
    palette: ['#0d1018', '#3f4c6b', '#55659a', '#7d90c8', '#f4e9ec', '#ff5f6d', '#9fc4e6', '#dff0ff'],
    sprite: [
      '...02222220...',
      '...02224440...',
      '...02224440...',
      '66602222230666',
      '66655511130666',
      '...55511130...',
      '...01111130...',
      '...01111130...',
      '...01111130...',
      '...01111130...',
      '...01111130...',
      '...00110110...',
      '...00110110...',
      '...00110110...',
    ],
  },
  {
    id: 'kite', name: 'KITE', tag: 'Light and quick',
    weight: 0.80, speed: 1.24, flaps: 3, atk: 0.82, up: 'screw', dive: 'kick',
    palette: ['#0d1018', '#2f5f74', '#4a8ba6', '#8fd6ee', '#f4e9ec', '#7ce6ff', '#9fc4e6', '#dff0ff'],
    sprite: [
      '...02222220...',
      '...02224440...',
      '...02224440...',
      '66602222230666',
      '66655511130666',
      '...55511130...',
      '...01111130...',
      '...01111130...',
      '...01111130...',
      '...01111130...',
      '...01111130...',
      '...00110110...',
      '...00110110...',
      '...00110110...',
    ],
  },
  {
    id: 'tanuki', name: 'TANUKI', tag: 'Heavy, hard to shift',
    weight: 1.34, speed: 0.84, flaps: 1, atk: 1.18, up: 'bounce', dive: 'pound',
    palette: ['#0d1018', '#6b4a2f', '#8a6340', '#c99a63', '#f4e9ec', '#ffd166', '#9fc4e6', '#dff0ff'],
    sprite: [
      '...02222220...',
      '...02224440...',
      '...02224440...',
      '66602222230666',
      '66655511130666',
      '...55511130...',
      '...01111130...',
      '...01111130...',
      '...01111130...',
      '...01111130...',
      '...01111130...',
      '...00110110...',
      '...00110110...',
      '...00110110...',
    ],
  },
  {
    id: 'oni', name: 'ONI', tag: 'Hits like a door',
    weight: 1.14, speed: 0.90, flaps: 2, atk: 1.38, up: 'upper', dive: 'meteor',
    palette: ['#0d1018', '#5a3b6b', '#7d5594', '#b78ccc', '#f4e9ec', '#c77dff', '#9fc4e6', '#dff0ff'],
    sprite: [
      '...02222220...',
      '...02224440...',
      '...02224440...',
      '66602222230666',
      '66655511130666',
      '...55511130...',
      '...01111130...',
      '...01111130...',
      '...01111130...',
      '...01111130...',
      '...01111130...',
      '...00110110...',
      '...00110110...',
      '...00110110...',
    ],
  },
];
