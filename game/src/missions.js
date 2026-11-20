// The story: six jobs from Dex, the fixer who owns the garage on Calle Ocho. Each mission is a
// list of steps with an objective line, an optional map marker, a setup and a done test, so the
// runner only has to show dialogue, tick the timer and decide when a job is failed or complete.
//
// Progress (how many jobs are done) is saved by main.js; this module owns nothing persistent.

import { clamp, distance } from './random.js';

const DEX = 'DEX';
const VIC = 'VIC';
const REY = 'REY';

function at(pos, radius = 52, kind = 'objective') {
  return { x: pos.x, y: pos.y, r: radius, kind };
}

export const MISSIONS = [
  {
    id: 'sunset-score',
    title: 'SUNSET SCORE',
    reward: 2500,
    time: 190,
    intro: [
      { who: DEX, text: 'That cherry Torero down at the marina? Belongs to a bookie who forgot what he owes me.' },
      { who: DEX, text: 'Bring it to my garage in one piece. The second you touch it, every cop in Vice Harbor will know.' },
      { who: DEX, text: 'Lose them before you get here. I don\'t do traffic stops.' },
    ],
    steps: [
      {
        text: 'Steal the cherry Torero at the marina',
        marker: (ctx) => {
          const car = ctx.world.missionCar;
          return { x: car.x, y: car.y, r: 46, kind: 'vehicle' };
        },
        update: (ctx) => ctx.world.player.inCar === ctx.world.missionCar,
      },
      {
        text: 'Take the Torero to Dex\'s garage — lose the heat',
        marker: (ctx) => at(ctx.sites.garage, 62),
        enter: (ctx) => {
          ctx.world.setHeat(1.35);
          ctx.world.notify('The Torero has been reported stolen', '#ffcf5c', 3);
          ctx.world.audio.sirenBlip();
        },
        fail: (ctx) => (ctx.world.missionCar.kind === 'wreck' ? 'The Torero is wrecked.' : null),
        update: (ctx) => ctx.world.player.inCar === ctx.world.missionCar && distance(ctx.world.player.x, ctx.world.player.y, ctx.sites.garage.x, ctx.sites.garage.y) < 86,
        complete: (ctx) => ctx.world.clearWanted(),
      },
    ],
  },
  {
    id: 'bad-debt',
    title: 'BAD DEBT',
    reward: 3500,
    time: 260,
    intro: [
      { who: DEX, text: 'Three deadbeats owe me money. Manny at the bodega, Carla at the pawn shop, and a little rat named Tito.' },
      { who: DEX, text: 'Lean on them. Hard. And take what\'s in the register.' },
      { who: DEX, text: 'They keep muscle around. Muscle bleeds like everybody else.' },
    ],
    steps: null,
  },
  {
    id: 'heat-check',
    title: 'HEAT CHECK',
    reward: 4000,
    time: 240,
    intro: [
      { who: DEX, text: 'So you want to run with me? Then show me you can wear heat.' },
      { who: DEX, text: 'Get the cops to two stars, then disappear. Clean. No trail.' },
      { who: DEX, text: 'Do that, and I\'ll put something better than a pistol in your hands.' },
    ],
    steps: [
      {
        text: 'Cause enough trouble to reach a 2-star wanted level',
        marker: () => null,
        update: (ctx) => ctx.world.stars() >= 2,
      },
      {
        text: 'Lose the police — no marker, just vanish',
        marker: () => null,
        enter: (ctx) => ctx.world.notify('Now lose them. Find somewhere quiet.', '#ffcf5c', 3),
        update: (ctx) => ctx.world.stars() === 0,
      },
    ],
    onComplete: (ctx) => {
      ctx.world.player.reserve.smg += 120;
      ctx.world.player.mag.smg = 30;
      ctx.world.notify('Dex left an SMG in your ride. Ammo included.', '#ffcf5c', 4);
    },
  },
  {
    id: 'the-drop',
    title: 'THE DROP',
    reward: 6000,
    time: 260,
    intro: [
      { who: DEX, text: 'Courier job. A case goes to the pier, my buyer\'s crew meets you there.' },
      { who: DEX, text: 'Except they\'re not my crew. If it goes loud, put them down and keep breathing.' },
      { who: DEX, text: 'Bring the case back to me. And don\'t open it.' },
    ],
    steps: [
      {
        text: 'Take the case to the pier',
        marker: (ctx) => at(ctx.sites.pierDrop, 60),
        update: (ctx) => distance(ctx.world.player.x, ctx.world.player.y, ctx.sites.pierDrop.x, ctx.sites.pierDrop.y) < 88,
      },
      {
        text: 'Deal with Vic\'s crew',
        marker: (ctx) => at(ctx.sites.pierDrop, 100, 'kill'),
        enter: (ctx) => {
          ctx.world.showDialog([
            { who: VIC, text: 'You\'re late, courier. And you brought the whole neighborhood.' },
            { who: VIC, text: 'Take the case off him, boys.' },
          ]);
          ctx.mission.data.rivals = ctx.world.people.spawnGang(ctx.sites.pierDrop.x, ctx.sites.pierDrop.y, 4, { tag: 'rival' });
          ctx.world.addWanted(0.5, null);
        },
        update: (ctx) => ctx.mission.data.rivals.every((man) => man.dead),
      },
      {
        text: 'Bring the case back to Dex',
        marker: (ctx) => at(ctx.sites.garage, 60),
        update: (ctx) => distance(ctx.world.player.x, ctx.world.player.y, ctx.sites.garage.x, ctx.sites.garage.y) < 84,
      },
    ],
  },
  {
    id: 'pier-pressure',
    title: 'PIER PRESSURE',
    reward: 9000,
    time: 0,
    intro: [
      { who: DEX, text: 'The cartel moved product onto my pier. Six men. No case this time.' },
      { who: DEX, text: 'Take the SMG. Make it loud. I want them to remember my name.' },
      { who: DEX, text: 'Nobody walks off that sand.' },
    ],
    steps: [
      {
        text: 'Go to the pier',
        marker: (ctx) => at(ctx.sites.pierCrew, 70),
        update: (ctx) => distance(ctx.world.player.x, ctx.world.player.y, ctx.sites.pierCrew.x, ctx.sites.pierCrew.y) < 240,
      },
      {
        text: 'Wipe out the cartel crew (6 left)',
        marker: (ctx) => at(ctx.sites.pierCrew, 130, 'kill'),
        enter: (ctx) => {
          ctx.mission.data.crew = ctx.world.people.spawnGang(ctx.sites.pierCrew.x, ctx.sites.pierCrew.y, 6, { tag: 'cartel', aggroRange: 700 });
          ctx.world.player.reserve.smg = Math.max(ctx.world.player.reserve.smg, 90);
          ctx.world.player.mag.smg = Math.max(ctx.world.player.mag.smg, 30);
          ctx.world.notify('SMG loaded. Make it loud.', '#ffcf5c', 2.6);
        },
        update: (ctx) => ctx.mission.data.crew.every((man) => man.dead),
      },
    ],
  },
  {
    id: 'last-sunset',
    title: 'LAST SUNSET',
    reward: 50000,
    time: 0,
    intro: [
      { who: DEX, text: 'Rey Mendez took everything from me. The garage, my brother, ten years.' },
      { who: DEX, text: 'He\'s at the mansion on Palm Row with his whole crew. I\'m done waiting.' },
      { who: DEX, text: 'Kill Rey. Then get out alive. Whatever it takes.' },
    ],
    steps: [
      {
        text: 'Drive to the Mendez mansion on Palm Row',
        marker: (ctx) => at(ctx.sites.mansion, 90),
        update: (ctx) => distance(ctx.world.player.x, ctx.world.player.y, ctx.sites.mansion.x, ctx.sites.mansion.y) < 110,
      },
      {
        text: 'Kill Rey Mendez and his crew',
        marker: (ctx) => at(ctx.sites.mansion, 120, 'kill'),
        enter: (ctx) => {
          ctx.world.showDialog([
            { who: REY, text: 'Dex sent a delivery boy. Cute.' },
            { who: REY, text: 'You should have stayed in your lane, kid.' },
          ]);
          const crew = ctx.world.people.spawnGang(ctx.sites.mansion.x, ctx.sites.mansion.y, 4, { tag: 'mendez', aggroRange: 900 });
          const boss = ctx.world.people.spawnBoss(ctx.sites.mansion.x + 40, ctx.sites.mansion.y - 40);
          ctx.mission.data.crew = crew;
          ctx.mission.data.boss = boss;
          ctx.world.addWanted(0.6, null);
        },
        update: (ctx) => ctx.mission.data.boss.dead && ctx.mission.data.crew.every((man) => man.dead),
      },
      {
        text: 'Lose the cops and reach the marina',
        marker: (ctx) => at(ctx.sites.marina, 80),
        enter: (ctx) => {
          ctx.world.setHeat(4);
          ctx.world.notify('Rey is dead. Every cop in the city is coming.', '#ffcf5c', 4);
          ctx.world.audio.sirenBlip();
        },
        update: (ctx) => distance(ctx.world.player.x, ctx.world.player.y, ctx.sites.marina.x, ctx.sites.marina.y) < 96,
        complete: (ctx) => ctx.world.clearWanted(),
      },
    ],
  },
];

/** The Bad Debt steps are three near-identical shakedowns; build them here. */
function buildDebtSteps(sites) {
  const debtors = [
    { name: 'Manny', pos: sites.debtors[0] },
    { name: 'Carla', pos: sites.debtors[1] },
    { name: 'Tito', pos: sites.debtors[2] },
  ];
  return debtors.map((debtor, index) => ({
    text: `Collect from ${debtor.name} — ${debtor.pos.x === sites.debtors[0].x ? 'bodega' : index === 1 ? 'pawn shop' : 'back alley'}`,
    marker: () => at(debtor.pos, 66, 'kill'),
    enter: (ctx) => {
      ctx.mission.data[`thugs${index}`] = ctx.world.people.spawnGang(debtor.pos.x, debtor.pos.y, 2, {
        tag: `debt${index}`, aggroRange: 460,
      });
    },
    update: (ctx) => ctx.mission.data[`thugs${index}`].every((man) => man.dead),
    complete: (ctx) => {
      ctx.world.addPickup('cash', debtor.pos.x, debtor.pos.y, 650);
      ctx.world.notify(`${debtor.name} paid up.`, '#9fe870', 2);
    },
  }));
}

export function createMissions(worldRef, startProgress = 0, storyDone = false) {
  const sites = {
    ...worldRef.city.storySites,
    pierDrop: { x: 5820, y: 6640 },
    pierCrew: { x: 5900, y: 6680 },
  };
  // Bad Debt's steps need the sites, and its mission entry is shared in MISSIONS.
  if (!MISSIONS[1].steps) MISSIONS[1].steps = buildDebtSteps(sites);

  let progress = clamp(startProgress, 0, MISSIONS.length);
  let storyComplete = storyDone;
  let mission = null;
  let nearStart = false;

  const system = {
    get progress() { return progress; },
    get active() { return Boolean(mission); },
    get storyComplete() { return storyComplete; },
    get missionIndex() { return mission ? mission.index : -1; },
    get stepIndex() { return mission ? mission.step : -1; },
    sites,
    MISSIONS,
  };

  function ctx() {
    return { world: worldRef, mission, data: mission.data, sites };
  }

  function startMission() {
    if (mission || storyComplete || progress >= MISSIONS.length) return false;
    const def = MISSIONS[progress];
    mission = { def, index: progress, step: -1, timer: def.time ?? 0, totalTime: def.time ?? 0, data: {}, waiting: true };
    worldRef.setObjective({ title: def.title, text: '', timer: mission.timer, total: mission.totalTime, index: progress });
    worldRef.showDialog(def.intro);
    worldRef.audio.ui();
    advance();
    return true;
  }

  function advance() {
    mission.step += 1;
    const step = mission.def.steps[mission.step];
    if (!step) {
      complete();
      return;
    }
    if (step.enter) step.enter(ctx());
    if (step.time) {
      mission.timer = step.time;
      mission.totalTime = step.time;
    }
    updateObjective();
  }

  function updateObjective() {
    if (!mission) return;
    const step = mission.def.steps[mission.step];
    worldRef.setObjective({
      title: mission.def.title,
      text: step ? (typeof step.text === 'function' ? step.text(ctx()) : step.text) : '',
      timer: mission.timer,
      total: mission.totalTime,
      index: mission.index,
    });
  }

  function fail(reason) {
    if (!mission) return;
    const def = mission.def;
    mission = null;
    worldRef.setObjective(null);
    worldRef.setMarkers([]);
    worldRef.state.missionPrompt = '';
    worldRef.audio.fail();
    worldRef.notify(`MISSION FAILED — ${reason}`, '#ff7a7a', 4.5);
    worldRef.showBanner('MISSION FAILED', def.title, '#ff7a7a', 3.4);
    worldRef.emit('missionFailed', { index: def.id, reason });
  }

  function complete() {
    if (!mission) return;
    const def = mission.def;
    const index = mission.index;
    const reward = def.reward ?? 0;
    worldRef.player.money += reward;
    if (def.onComplete) def.onComplete(ctx());
    progress = index + 1;
    worldRef.state.missionsDone = progress;
    mission = null;
    worldRef.setObjective(null);
    worldRef.setMarkers([]);
    worldRef.audio.mission();
    worldRef.showBanner('MISSION COMPLETE', `${def.title}   +$${reward}`, '#9fe870', 4.6);
    worldRef.notify(`+$${reward}`, '#9fe870', 3);
    worldRef.emit('missionComplete', { index, progress, title: def.title });
    if (progress >= MISSIONS.length) {
      storyComplete = true;
      worldRef.state.storyComplete = true;
      worldRef.showBanner('THE END', 'Vice Harbor is yours. Keep the engine running.', '#ffcf5c', 9);
      worldRef.emit('storyComplete', {});
    }
  }

  function markerForStep(step) {
    if (!step || !step.marker) return null;
    const marker = step.marker(ctx());
    if (!marker) return null;
    return { ...marker, kind: marker.kind ?? 'objective' };
  }

  system.update = function update(dt, controls) {
    nearStart = !storyComplete && !mission
      && distance(worldRef.player.x, worldRef.player.y, sites.garage.x, sites.garage.y) < 84;
    worldRef.state.missionPrompt = '';

    if (!mission) {
      if (nearStart) {
        const def = MISSIONS[progress];
        if (def) {
          worldRef.state.missionPrompt = `E  START MISSION — ${def.title}`;
          if (controls.enterPressed && !worldRef.player.inCar) {
            controls.enterPressed = false;
            startMission();
          }
        }
      }
      const markers = [];
      if (!storyComplete && MISSIONS[progress]) {
        markers.push({ ...at(sites.garage, 54, 'mission'), label: `M${progress + 1}`, title: MISSIONS[progress].title });
      }
      worldRef.setMarkers(markers);
      if (storyComplete) {
        worldRef.setObjective(null);
        if (nearStart) worldRef.state.missionPrompt = 'Dex: Nothing left to prove. Enjoy the sunset.';
      }
      return;
    }

    if (worldRef.player.dead) {
      fail('You went down.');
      return;
    }
    if (worldRef.state.dialog) {
      updateObjective();
      return;
    }

    const step = mission.def.steps[mission.step];
    if (!step) return;
    if (mission.timer > 0) {
      mission.timer -= dt;
      if (mission.timer <= 0) {
        fail('Out of time.');
        return;
      }
    }
    if (step.fail) {
      const reason = step.fail(ctx());
      if (reason) {
        fail(reason);
        return;
      }
    }
    updateObjective();
    const marker = markerForStep(step);
    worldRef.setMarkers(marker ? [marker] : []);
    if (step.update && step.update(ctx(), dt)) {
      if (step.complete) step.complete(ctx());
      advance();
    }
  };

  system.startMission = startMission;
  system.fail = fail;
  system.complete = complete;
  Object.defineProperty(system, 'nearStart', { get: () => nearStart });
  return system;
}
