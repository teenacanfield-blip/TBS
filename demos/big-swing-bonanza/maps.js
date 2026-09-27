/* The twenty-five Golden Bat courses.
 *
 * A course is a list of segments laid end to end down +Z, starting grid first
 * and the golden bat last. The segment builders live in game.js; this file is
 * only which ones, in what order, under which sky. `diff` (0–1) tightens the
 * gaps, speeds up the sweepers and adds hazards inside every segment, so the
 * same segment on map 3 and map 23 are not the same obstacle.
 *
 * Segment ids:
 *   run        flat floor, a breather
 *   stones     bases floating over the void, jump base to base
 *   sweep      a giant bat spinning at shin height — jump it
 *   highbar    a bat spinning at head height — dive under it
 *   pendulum   bats hung from the sky, swinging across the lane
 *   rollers    giant baseballs rolling back down at you
 *   movers     platforms sliding side to side over a gap
 *   lifts      platforms rising and falling over a gap
 *   conveyor   a backwards belt with hurdles on it
 *   doors      walls across the course with only a couple of ways through
 *   bleachers  a staircase of stands, up a level
 *   bounce     a wall you can only get over from the pads in front of it
 *   machines   pitching machines firing across the lane
 *   beams      two narrow foul lines over the void
 *   drop       a long step back down
 *
 * The courses check themselves on load: a segment id nobody wrote is a typo,
 * and it says so in the console rather than showing up as a hole in map 19.
 */
const MAP_THEMES = {
  sandlot:  { sky: '#8fd3ff', fog: '#bfe6ff', floor: ['#7bc96f', '#6ab85f'], edge: '#c9925a', accent: '#ffd166', ground: '#d8a86a' },
  dusk:     { sky: '#ff9e6b', fog: '#ffc7a1', floor: ['#6fbf73', '#5fae63'], edge: '#b86b4b', accent: '#ffe14d', ground: '#7b4b8f' },
  night:    { sky: '#0c1433', fog: '#1a2552', floor: ['#3f9b5a', '#358a4e'], edge: '#1f2a4f', accent: '#fff3a3', ground: '#101a38', night: true },
  desert:   { sky: '#ffd9a0', fog: '#ffe6c2', floor: ['#e3b27a', '#d6a36b'], edge: '#b0703f', accent: '#2ec27e', ground: '#e0a96a' },
  rain:     { sky: '#6b7a8f', fog: '#8795a8', floor: ['#4f8f5a', '#46814f'], edge: '#3b4658', accent: '#9fd8ff', ground: '#4a5566', rain: true },
  candy:    { sky: '#ffc4ec', fog: '#ffe0f4', floor: ['#ff8fd0', '#ffb3de'], edge: '#b04d9a', accent: '#7cf2ff', ground: '#f7a8d8' },
  snow:     { sky: '#d6ecff', fog: '#eef7ff', floor: ['#f4fbff', '#dcecf7'], edge: '#8fb3cf', accent: '#ff4d6d', ground: '#ffffff' },
  lava:     { sky: '#3a0e0e', fog: '#5a1a10', floor: ['#5a5a66', '#4a4a55'], edge: '#ff5a1f', accent: '#ffb01f', ground: '#ff4a12', night: true },
  space:    { sky: '#05030f', fog: '#140b2e', floor: ['#6a4cff', '#5a3ce6'], edge: '#29ffd6', accent: '#ffe14d', ground: '#05030f', night: true, stars: true },
  city:     { sky: '#a8c8ff', fog: '#c8dcff', floor: ['#b3bdff', '#9fabf5'], edge: '#ffb01f', accent: '#ff4d6d', ground: '#5b6070' },
  jungle:   { sky: '#9fe8b0', fog: '#c7f2cf', floor: ['#3fa34d', '#378f44'], edge: '#6b4226', accent: '#ffe14d', ground: '#2e6b35' },
  beach:    { sky: '#7fe0ff', fog: '#b8f0ff', floor: ['#f7df9e', '#efd48c'], edge: '#1fa3c2', accent: '#ff6b6b', ground: '#1fb6d6' },
  retro:    { sky: '#e9dcc0', fog: '#efe5cf', floor: ['#8fae6a', '#809e5d'], edge: '#7a5a3a', accent: '#b0122a', ground: '#b89a6a' },
};

const MAPS = [
  { name: 'Sandlot Sprint', theme: 'sandlot', diff: 0.0,
    segs: ['run', 'stones', 'sweep', 'run', 'bleachers', 'doors'] },
  { name: 'Bleacher Bounce', theme: 'sandlot', diff: 0.05,
    segs: ['bleachers', 'bounce', 'stones', 'drop', 'sweep'] },
  { name: 'Dugout Dash', theme: 'dusk', diff: 0.1,
    segs: ['doors', 'run', 'pendulum', 'stones', 'doors'] },
  { name: 'Infield Fly', theme: 'sandlot', diff: 0.12,
    segs: ['movers', 'run', 'sweep', 'highbar', 'lifts'] },
  { name: 'Seventh-Inning Stretch', theme: 'dusk', diff: 0.15,
    segs: ['conveyor', 'stones', 'bleachers', 'rollers', 'drop'] },
  { name: 'Rain Delay', theme: 'rain', diff: 0.2,
    segs: ['beams', 'run', 'pendulum', 'movers', 'doors'] },
  { name: 'Under the Lights', theme: 'night', diff: 0.22,
    segs: ['machines', 'stones', 'sweep', 'bleachers', 'bounce'] },
  { name: 'Spring Training', theme: 'desert', diff: 0.25,
    segs: ['rollers', 'run', 'lifts', 'conveyor', 'doors'] },
  { name: 'Bullpen Bash', theme: 'retro', diff: 0.28,
    segs: ['machines', 'highbar', 'stones', 'pendulum', 'drop'] },
  { name: 'Hot Dog Highway', theme: 'city', diff: 0.3,
    segs: ['conveyor', 'movers', 'sweep', 'bleachers', 'rollers'] },
  { name: 'Cotton Candy Corner', theme: 'candy', diff: 0.33,
    segs: ['bounce', 'stones', 'highbar', 'lifts', 'doors'] },
  { name: 'Frozen Foul Pole', theme: 'snow', diff: 0.36,
    segs: ['beams', 'sweep', 'stones', 'bleachers', 'pendulum'] },
  { name: 'Grand Slam Canyon', theme: 'desert', diff: 0.4,
    segs: ['stones', 'movers', 'bounce', 'drop', 'machines', 'lifts'] },
  { name: 'Warning Track', theme: 'retro', diff: 0.42,
    segs: ['rollers', 'doors', 'conveyor', 'sweep', 'highbar'] },
  { name: 'Beach Ball Park', theme: 'beach', diff: 0.45,
    segs: ['movers', 'rollers', 'stones', 'pendulum', 'bleachers'] },
  { name: 'Jungle Gym Jam', theme: 'jungle', diff: 0.48,
    segs: ['lifts', 'sweep', 'beams', 'doors', 'bounce', 'drop'] },
  { name: 'Skyline Swing', theme: 'city', diff: 0.52,
    segs: ['bleachers', 'movers', 'machines', 'stones', 'highbar'] },
  { name: 'Double Header', theme: 'night', diff: 0.55,
    segs: ['sweep', 'highbar', 'sweep', 'pendulum', 'stones', 'doors'] },
  { name: 'Lava Lamp Stadium', theme: 'lava', diff: 0.6,
    segs: ['stones', 'lifts', 'pendulum', 'beams', 'rollers'] },
  { name: 'Blizzard Bash', theme: 'snow', diff: 0.64,
    segs: ['conveyor', 'machines', 'movers', 'bleachers', 'bounce'] },
  { name: 'Moon Ball', theme: 'space', diff: 0.68,
    segs: ['lifts', 'stones', 'highbar', 'movers', 'pendulum'] },
  { name: 'Extra Innings', theme: 'rain', diff: 0.72,
    segs: ['doors', 'rollers', 'beams', 'sweep', 'lifts', 'machines'] },
  { name: 'Candy Crush Classic', theme: 'candy', diff: 0.78,
    segs: ['movers', 'pendulum', 'conveyor', 'stones', 'highbar', 'drop'] },
  { name: 'Volcano Walk-Off', theme: 'lava', diff: 0.86,
    segs: ['beams', 'machines', 'lifts', 'sweep', 'stones', 'rollers'] },
  { name: 'The Golden Diamond', theme: 'space', diff: 1.0,
    segs: ['stones', 'highbar', 'movers', 'pendulum', 'beams', 'lifts', 'doors'] },
];
