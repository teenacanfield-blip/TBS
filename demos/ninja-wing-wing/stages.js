/* The maps.
 *
 * Add one by adding an entry here — the game builds the stage-select screen
 * from this list, so nothing else needs touching.
 *
 *   name / tag   what shows on the select screen.
 *   sky          top and bottom colour of the background wash.
 *   ink / lip    the body of a platform, and the lit strip along its top.
 *   moon         { x, y, r } for the disc in the background, or null for none.
 *   platforms    { x, y, w, h }. Landed on from above only — you jump up
 *                through them. Nothing is solid from the side.
 *   spawns       where each fighter starts and respawns. Two of them.
 *
 * The stage is 320 x 180. Anything past roughly 34 pixels off the sides, 70
 * above or 46 below is out of bounds, so leave room to be knocked off — a
 * platform that reaches the edge is a stage nobody can be KO'd on.
 */
const STAGES = [
  {
    id: 'rooftops', name: 'ROOFTOPS', tag: 'Room to breathe',
    sky: ['#150b1d', '#3a1430'],
    ink: '#241426', lip: '#5d3560',
    moon: { x: 262, y: 40, r: 14 },
    platforms: [
      { x: 78, y: 138, w: 164, h: 8 },
      { x: 40, y: 100, w: 54, h: 5 },
      { x: 226, y: 100, w: 54, h: 5 },
      { x: 132, y: 66, w: 56, h: 5 },
    ],
    spawns: [{ x: 104, y: 40 }, { x: 200, y: 40 }],
  },
  {
    id: 'towers', name: 'TWO TOWERS', tag: 'Mind the gap',
    sky: ['#0d1522', '#1e3b52'],
    ink: '#16242f', lip: '#3d6b82',
    moon: { x: 160, y: 34, r: 18 },
    platforms: [
      { x: 30, y: 124, w: 62, h: 8 },
      { x: 228, y: 124, w: 62, h: 8 },
      { x: 138, y: 74, w: 44, h: 5 },
    ],
    spawns: [{ x: 54, y: 40 }, { x: 246, y: 40 }],
  },
  {
    id: 'wire', name: 'THE WIRE', tag: 'One line, no help',
    sky: ['#1a1013', '#40201c'],
    ink: '#2a1a1a', lip: '#7a4238',
    moon: { x: 48, y: 36, r: 10 },
    platforms: [
      { x: 62, y: 128, w: 196, h: 5 },
    ],
    spawns: [{ x: 100, y: 40 }, { x: 212, y: 40 }],
  },
  {
    id: 'shards', name: 'SHARDS', tag: 'Nothing to stand on for long',
    sky: ['#120d20', '#2c1b46'],
    ink: '#1e1630', lip: '#5a4488',
    moon: null,
    platforms: [
      { x: 44, y: 132, w: 46, h: 6 },
      { x: 136, y: 146, w: 50, h: 6 },
      { x: 232, y: 132, w: 46, h: 6 },
      { x: 88, y: 92, w: 38, h: 5 },
      { x: 196, y: 92, w: 38, h: 5 },
      { x: 146, y: 56, w: 30, h: 5 },
    ],
    spawns: [{ x: 64, y: 40 }, { x: 244, y: 40 }],
  },
];
