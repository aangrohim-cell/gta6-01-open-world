// Story arc: six original jobs across Vice Harbor, with markers, stages and payouts.
import { PIER_X, PIER_END, DOCK_X, DOCK_END } from './config.js';
import { dist } from './random.js';
import { placePos } from './city.js';
import { spawnRivals } from './people.js';

const at = (game, key) => placePos(game.city, key);
const near = (game, pt, r = 90) => dist(game.player.x, game.player.y, pt.x, pt.y) < r;

function say(game, speaker, line) {
  game.dialogue = { speaker, line, ttl: 6.5 };
}

const DEFS = [
  {
    title: 'FIRST SHIFT',
    brief: 'Frankie Two-Fingers is waiting at the noodle stand.',
    reward: 900,
    stages: [
      {
        text: 'Meet Frankie at MR. NOODLE',
        marker: (g) => ({ ...at(g, 'noodles'), label: 'FRANKIE' }),
        enter: (g) => say(g, 'FRANKIE', 'You drive like my aunt. Still, I got work. Meet me at the depot.'),
        check: (g) => near(g, at(g, 'noodles'), 92),
      },
      {
        text: 'Borrow a car and get to HARBOR DEPOT 9',
        marker: (g) => ({ ...at(g, 'warehouse'), label: 'DEPOT' }),
        enter: (g) => say(g, 'FRANKIE', 'Any wheels will do. Just don’t scratch mine. I wasn’t kidding.'),
        check: (g) => !!g.player.car && near(g, at(g, 'warehouse'), 115),
      },
    ],
  },
  {
    title: 'DOCKSIDE DELIVERY',
    brief: 'A crate needs moving from the depot to the end of the pier.',
    reward: 1800,
    stages: [
      {
        text: 'Return to HARBOR DEPOT 9',
        marker: (g) => ({ ...at(g, 'warehouse'), label: 'DEPOT' }),
        check: (g) => near(g, at(g, 'warehouse'), 100),
      },
      {
        text: 'Take the depot van',
        marker: (g) => ({ ...at(g, 'warehouse'), label: 'VAN' }),
        enter: (g, m) => {
          const p = at(g, 'warehouse');
          m.data.van = g.spawnMissionCar('van', { x: p.x + 45, y: p.y - 25 }, 'delivery');
          say(g, 'DOCKS CHIEF', 'Van’s out back. Bring her back in one piece.');
        },
        check: (g, m) => !!m.data.van && g.player.car === m.data.van,
      },
      {
        text: 'Deliver the van to the pier head',
        time: 85,
        failOnTimeout: true,
        marker: () => ({ x: PIER_X, y: PIER_END - 40, label: 'DELIVERY' }),
        enter: (g) => { g.mission.timer = 85; say(g, 'DOCKS CHIEF', 'Clock’s ticking. Traffic’s worse than the weather.'); },
        update: (g, m, dt) => { m.timer -= dt; if (m.timer < 15) g.notify('HURRY UP!', '#f26b6b'); },
        check: (g, m) => !!m.data.van && g.player.car === m.data.van && dist(g.player.x, g.player.y, PIER_X, PIER_END - 40) < 130,
      },
      {
        text: 'Park and meet the dock chief',
        marker: () => ({ x: PIER_X, y: PIER_END - 40, label: 'CHIEF' }),
        check: (g) => !g.player.car && dist(g.player.x, g.player.y, PIER_X, PIER_END - 40) < 90,
      },
    ],
  },
  {
    title: 'PIER PRESSURE',
    brief: 'A crew took the pier. Convince them to leave.',
    reward: 3000,
    stages: [
      {
        text: 'Go to the end of SUNSET PIER',
        marker: () => ({ x: PIER_X, y: PIER_END - 50, label: 'PIER' }),
        check: (g) => dist(g.player.x, g.player.y, PIER_X, PIER_END - 50) < 105,
      },
      {
        text: 'Take down the crew (0/3)',
        marker: () => ({ x: PIER_X, y: PIER_END - 50, label: 'CREW' }),
        enter: (g, m) => {
          m.data.kills = 0;
          spawnRivals(g, [
            { x: PIER_X - 45, y: PIER_END - 96 },
            { x: PIER_X + 50, y: PIER_END - 70 },
            { x: PIER_X, y: PIER_END - 10 },
          ], 'pier-crew');
          say(g, 'CREW BOSS', 'This pier belongs to us, sunshine.');
        },
        check: (g, m) => (m.data.kills || 0) >= 3,
      },
      {
        text: 'Collect the sealed crate',
        marker: () => ({ x: PIER_X, y: PIER_END - 50, label: 'CRATE' }),
        enter: (g) => say(g, 'FRANKIE', 'Nice work. There’s an SMG in the crate. Try not to lose it.'),
        check: (g) => near2(g, PIER_X, PIER_END - 50, 70),
        complete: (g) => { g.player.unlocked.smg = true; g.player.ammo.smg += 90; },
      },
    ],
  },
  {
    title: 'CORAL FEDERAL',
    brief: 'The bank on Coral Avenue is holding our money.',
    reward: 4500,
    stages: [
      {
        text: 'Go to CORAL FEDERAL',
        marker: (g) => ({ ...at(g, 'bank'), label: 'BANK' }),
        check: (g) => near(g, at(g, 'bank'), 105),
      },
      {
        text: 'Crack the vault - press E at the door',
        marker: (g) => ({ ...at(g, 'bank'), label: 'VAULT' }),
        enter: (g) => say(g, 'FRANKIE', 'Get inside, empty the vault, and don’t shoot the guard. He has kids.'),
        interact: (g, m) => {
          m.data.robbed = true;
          g.player.money += 3500;
          g.setHeat(58);
          g.notify('VAULT CRACKED  +$3,500', '#f7d774');
          g.sound.cash();
          return true;
        },
        check: (g, m) => !!m.data.robbed,
      },
      {
        text: 'Lose the heat and reach CASA CIELO',
        marker: (g) => ({ ...at(g, 'safehouse'), label: 'SAFEHOUSE' }),
        check: (g) => near(g, at(g, 'safehouse'), 105),
      },
    ],
  },
  {
    title: 'HOT WIRES',
    brief: 'A red coupe at Vince Motors has your name on it.',
    reward: 6500,
    stages: [
      {
        text: 'Go to VINCE MOTORS',
        marker: (g) => ({ ...at(g, 'garage'), label: 'GARAGE' }),
        check: (g) => near(g, at(g, 'garage'), 105),
      },
      {
        text: 'Steal the red coupe',
        marker: (g) => ({ ...at(g, 'garage'), label: 'COUPE' }),
        enter: (g, m) => {
          const p = at(g, 'garage');
          m.data.coupe = g.spawnMissionCar('sports', { x: p.x + 40, y: p.y + 20 }, 'coupe', '#d8434b');
          say(g, 'VINCE', 'That one’s not for sale. Guess you’re buying it the hard way.');
        },
        check: (g, m) => !!m.data.coupe && g.player.car === m.data.coupe,
      },
      {
        text: 'Get the city chasing you - reach 3 stars',
        marker: (g) => ({ ...at(g, 'police'), label: 'POLICE' }),
        enter: (g) => { g.setHeat(52); say(g, 'DISPATCH', 'Unit 12, suspect in a red coupe. Move in.'); },
        check: (g) => g.stars >= 3,
      },
      {
        text: 'Survive the pursuit (40 seconds)',
        time: 40,
        marker: () => ({ x: 1080, y: 900, label: 'SURVIVE' }),
        enter: (g) => { g.mission.timer = 40; },
        update: (g, m, dt) => { m.timer -= dt; },
        check: (g, m) => m.timer <= 0,
      },
      {
        text: 'Lose the cops at CASA CIELO',
        marker: (g) => ({ ...at(g, 'safehouse'), label: 'SAFEHOUSE' }),
        check: (g) => near(g, at(g, 'safehouse'), 110),
      },
    ],
  },
  {
    title: 'SUNSET SHOWDOWN',
    brief: 'The rival crew is at the marina. End it tonight.',
    reward: 12000,
    stages: [
      {
        text: 'Go to the marina float',
        marker: () => ({ x: DOCK_X, y: DOCK_END - 20, label: 'MARINA' }),
        enter: (g) => say(g, 'FRANKIE', 'Last job. Make the harbor quiet, then meet me on the pier.'),
        check: (g) => dist(g.player.x, g.player.y, DOCK_X, DOCK_END - 20) < 100,
      },
      {
        text: 'Clear the crew (0/5)',
        marker: () => ({ x: DOCK_X, y: DOCK_END - 20, label: 'CREW' }),
        enter: (g, m) => {
          m.data.kills = 0;
          spawnRivals(g, [
            { x: DOCK_X - 60, y: DOCK_END - 20 },
            { x: DOCK_X + 65, y: DOCK_END - 10 },
            { x: DOCK_X, y: DOCK_END + 12 },
            { x: PIER_X - 30, y: PIER_END - 60 },
            { x: PIER_X + 35, y: PIER_END - 20 },
          ], 'final-crew');
          g.setHeat(45);
          say(g, 'RIVAL BOSS', 'You should have stayed on the north side.');
        },
        check: (g, m) => (m.data.kills || 0) >= 5,
      },
      {
        text: 'Meet Frankie at the pier head',
        marker: () => ({ x: PIER_X, y: PIER_END - 45, label: 'FRANKIE' }),
        enter: (g) => say(g, 'FRANKIE', 'That’s my boy. Vice Harbor finally breathing easy.'),
        check: (g) => dist(g.player.x, g.player.y, PIER_X, PIER_END - 45) < 100,
      },
    ],
  },
];

function near2(g, x, y, r) { return dist(g.player.x, g.player.y, x, y) < r; }

export function missionCount() { return DEFS.length; }

export function startMission(game, index) {
  const def = DEFS[index];
  if (!def) return;
  game.mission.index = index;
  game.mission.stage = 0;
  game.mission.active = true;
  game.mission.timer = 0;
  game.mission.data = {};
  game.notify(`MISSION: ${def.title}`, '#f7d774');
  game.sound.confirm();
  const stage = def.stages[0];
  if (stage.enter) stage.enter(game, game.mission);
}

export function completeMission(game) {
  const m = game.mission;
  const def = DEFS[m.index];
  if (!def) return;
  if (!m.done.includes(m.index)) m.done.push(m.index);
  if (def.stages[m.stage] && def.stages[m.stage].complete) def.stages[m.stage].complete(game, m);
  game.player.money += def.reward;
  game.sound.cash();
  game.notify(`MISSION COMPLETE  +$${def.reward}`, '#9ce7a4');
  game.missionBanner = { title: def.title, reward: def.reward, ttl: 4.5 };
  m.active = false;
  m.data = {};
  m.index = Math.min(m.index + 1, DEFS.length);
  m.stage = 0;
  game.setHeat(0);
  if (m.index >= DEFS.length) game.ending = true;
  game.save();
}

export function updateMissions(game, dt) {
  const m = game.mission;
  if (!m.active) {
    if (m.index >= DEFS.length) return;
    const def = DEFS[m.index];
    const stage = def.stages[0];
    if (!stage) return;
    const pt = stage.marker(game);
    if (near2(game, pt.x, pt.y, 86) && game.interactPressed) startMission(game, m.index);
    return;
  }
  const def = DEFS[m.index];
  const stage = def.stages[m.stage];
  if (!stage) { completeMission(game); return; }
  if (stage.update) stage.update(game, m, dt);
  if (stage.check(game, m)) {
    m.stage++;
    m.timer = 0;
    if (m.stage >= def.stages.length) { completeMission(game); return; }
    const next = def.stages[m.stage];
    game.notify(next.text, '#8ee9df');
    if (next.enter) next.enter(game, m);
    return;
  }
  if (stage.failOnTimeout && stage.time && m.timer <= 0) {
    game.notify('TIME UP - TRY AGAIN', '#f26b6b');
    game.sound.hit();
    m.timer = 0;
    if (stage.enter) stage.enter(game, m);
  }
}

export function missionInteract(game) {
  const m = game.mission;
  if (!m.active) return false;
  const def = DEFS[m.index];
  const stage = def && def.stages[m.stage];
  if (!stage || !stage.interact) return false;
  const pt = stage.marker(game);
  if (!near2(game, pt.x, pt.y, 110)) return false;
  return stage.interact(game, m);
}

export function currentMarker(game) {
  if (game.ending) return null;
  const m = game.mission;
  if (m.active) {
    const def = DEFS[m.index];
    const stage = def && def.stages[m.stage];
    if (stage) return { ...stage.marker(game), color: '#f7d774' };
  }
  if (m.index < DEFS.length) {
    const def = DEFS[m.index];
    const stage = def && def.stages[0];
    if (stage) return { ...stage.marker(game), color: '#8ee9df', label: 'NEW JOB' };
  }
  return null;
}

export function currentObjective(game) {
  const m = game.mission;
  if (game.ending) return 'ALL JOBS DONE - VICE HARBOR IS YOURS';
  if (m.active) {
    const def = DEFS[m.index];
    const stage = def && def.stages[m.stage];
    if (stage) return `${def.title}: ${stage.text.replace(/\(\d\/\d\)/, `(${m.data.kills || 0}/${m.data.killsTarget || 3})`)}`;
  }
  if (m.index < DEFS.length) return `NEXT JOB: ${DEFS[m.index].title} - ${DEFS[m.index].brief}`;
  return 'FREE ROAM';
}

export function onRivalDown(game, ped) {
  const m = game.mission;
  if (!m.active || !ped.missionTag) return;
  const def = DEFS[m.index];
  if (!def) return;
  const stage = def.stages[m.stage];
  if (!stage || stage.text.indexOf('crew') < 0) return;
  if (ped.missionTag === 'pier-crew' && m.index !== 2) return;
  if (ped.missionTag === 'final-crew' && m.index !== 5) return;
  m.data.kills = (m.data.kills || 0) + 1;
  m.data.killsTarget = ped.missionTag === 'final-crew' ? 5 : 3;
  game.notify(`CREW DOWN  ${m.data.kills}/${m.data.killsTarget}`, '#ff9b9b');
}

export function missionDefs() { return DEFS; }
