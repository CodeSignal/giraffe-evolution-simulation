import { advanceRun, createFullRun, createRun, groundFoodSlots, MAX_GENERATIONS, POPULATION_SIZE } from './evolution-model.mjs';

const canvas = document.getElementById('map-canvas');
const ctx = canvas.getContext('2d');
let run = createRun();
let learnerHistory = null;
let timer = null;
let transition = null;
let previewTimer = null;
let pendingGeneration = null;
const demoHistory = createFullRun().history;
const unitTitles = {
  fitness: 'Population & fitness',
  selection: 'Select parents',
  crossover: 'Combine traits',
  mutation: 'Mutation adds variation',
  evolution: 'Watch the herd evolve'
};
const unitNotes = {
  fitness: 'Click a giraffe to see how food and reach affect fitness.',
  selection: 'Three giraffes compete. The highest score becomes a parent.',
  crossover: 'An offspring inherits traits from two parents.',
  mutation: 'A small random change gives the offspring a new neck length.',
  evolution: 'Watch short necks become rare as grass disappears.'
};
const unitAliases = { '1': 'fitness', '2': 'selection', '3': 'crossover', '4': 'mutation', '5': 'evolution' };
const launchParams = new URLSearchParams(window.location.search);
let configuredUnit = null;
try {
  const response = await fetch('/practice-config.json', { cache: 'no-store' });
  if (response.ok) configuredUnit = (await response.json()).unit;
} catch {
  // A local preview without a config still opens the first practice mode.
}
const requestedUnit = launchParams.get('practiceUnit') ?? launchParams.get('unit') ?? window.__GIRAFFE_UNIT__ ?? configuredUnit;
const showModePicker = launchParams.get('modePicker') === '1';
let mode = unitTitles[requestedUnit] ? requestedUnit : unitAliases[requestedUnit] ?? 'fitness';
let lessonExamples = [];
let lessonStep = 0;
let highlightedIds = new Map();
let selectedFitnessId = null;
let giraffeHitZones = [];

const $ = (id) => document.getElementById(id);

const current = () => run.history.at(-1);
const lastGeneration = () => learnerHistory ? learnerHistory.length - 1 : MAX_GENERATIONS;

function lessonHistoryWith(field) {
  return learnerHistory?.some((frame) => frame[field]?.length) ? learnerHistory : demoHistory;
}

function buildLessonExamples() {
  if (mode === 'fitness') {
    const source = learnerHistory ?? demoHistory;
    const frame = source[Math.min(4, source.length - 1)];
    return frame.population.map((giraffe, index) => ({ frame, giraffe, index }));
  }
  if (mode === 'selection') {
    const source = lessonHistoryWith('selectionEvents');
    const preferred = source[Math.min(5, source.length - 1)];
    const frame = preferred?.selectionEvents?.length ? preferred : source.find((item) => item.selectionEvents?.length);
    if (!frame) return [];
    const previous = source[frame.generation - 1];
    const events = frame.selectionEvents.filter((event) =>
      event && Array.isArray(event.contenders) && event.contenders.length === 3 && new Set(event.contenders.map(String)).size === 3);
    return (events.length ? events : frame.selectionEvents).slice(0, 8).map((event) => ({ frame: previous, event }));
  }
  if (mode === 'crossover') {
    const source = lessonHistoryWith('crossovers');
    const targets = [source[Math.min(5, source.length - 1)], ...source.slice(1)].filter(Boolean);
    for (const next of targets) {
      const previous = source[next.generation - 1];
      if (!previous) continue;
      const examples = next.crossovers.filter((event) => {
        const neckParent = previous.population.find((giraffe) => giraffe.id === String(event.neckFrom));
        const energyParent = previous.population.find((giraffe) => giraffe.id === String(event.efficiencyFrom));
        const child = next.population[event.childIndex];
        return neckParent && energyParent && child && neckParent.id !== energyParent.id &&
          child.neck === neckParent.neck && child.efficiency === energyParent.efficiency;
      }).slice(0, 8);
      if (examples.length) return examples.map((event) => ({ frame: previous, next, event }));
    }
    return [];
  }
  if (mode === 'mutation') {
    const source = lessonHistoryWith('mutations');
    return source.slice(1).flatMap((frame) => frame.mutations
      .filter((event) => event.trait === 'neck' && Number.isFinite(Number(event.from)) && Number.isFinite(Number(event.to)))
      .map((event) => ({ frame, event }))).slice(0, 12);
  }
  return [];
}

function hideLessonOverlays() {
  for (const id of ['fitness-overlay', 'selection-overlay', 'crossover-overlay', 'mutation-overlay']) $(id).hidden = true;
  $('fitness-prompt').hidden = true;
}

function renderLessonExample() {
  hideLessonOverlays();
  highlightedIds = new Map();
  const example = lessonExamples[lessonStep];
  if (!example) {
    run = { history: [demoHistory[0]] };
    setStatus('No example is available yet');
    return;
  }
  run = { history: [example.frame] };
  if (mode === 'fitness') {
    const selected = example.frame.population.find((giraffe) => giraffe.id === selectedFitnessId);
    $('fitness-prompt').hidden = Boolean(selected);
    if (selected) {
      const index = example.frame.population.indexOf(selected);
      highlightedIds.set(selected.id, 'focus');
      $('fitness-number').textContent = String(index + 1);
      $('fitness-neck').textContent = String(selected.neck);
      $('fitness-food').textContent = selected.food === 'none' ? 'None' : selected.food === 'leaves' ? 'Leaves' : selected.food === 'grass' ? 'Grass' : 'Unknown';
      $('fitness-score').textContent = selected.fitness.toFixed(1);
      $('fitness-overlay').hidden = false;
      setStatus(selected.fed ? 'Fed · fitness ' + selected.fitness.toFixed(1) : 'Hungry · fitness ' + selected.fitness.toFixed(1));
    } else {
      setStatus('Click a giraffe to inspect its fitness');
    }
  } else if (mode === 'selection') {
    const contenders = example.event.contenders.map((id) => example.frame.population.find((giraffe) => giraffe.id === String(id)));
    if (contenders.some((candidate) => !candidate)) return;
    document.querySelectorAll('.contestant-card').forEach((card, index) => {
      const candidate = contenders[index];
      const number = example.frame.population.indexOf(candidate) + 1;
      card.querySelector('.contestant-name').textContent = `Giraffe ${number}`;
      card.querySelector('.contestant-score').textContent = candidate.fitness.toFixed(1);
      card.classList.toggle('winner', candidate.id === String(example.event.winner));
      highlightedIds.set(candidate.id, candidate.id === String(example.event.winner) ? 'winner' : 'contender');
    });
    $('selection-overlay').hidden = false;
    const winner = contenders.find((candidate) => candidate.id === String(example.event.winner));
    setStatus(`Giraffe ${example.frame.population.indexOf(winner) + 1} wins · highest fitness`);
  } else if (mode === 'crossover') {
    showCrossover(example.frame, { ...example.next, crossovers: [example.event] });
  } else if (mode === 'mutation') {
    const { event } = example;
    const child = example.frame.population[event.childIndex];
    if (child) highlightedIds.set(child.id, 'focus');
    $('mutation-before-value').textContent = `Neck ${event.from}`;
    $('mutation-after-value').textContent = `Neck ${event.to}`;
    $('mutation-overlay').hidden = false;
    setStatus(`Neck ${event.from} → ${event.to}`);
  }
}

function stepLesson() {
  if (!lessonExamples.length) return;
  lessonStep = (lessonStep + 1) % lessonExamples.length;
  renderLessonExample();
  update();
}

function setMode(nextMode, updateUrl = true) {
  const resolved = unitAliases[nextMode] ?? nextMode;
  if (!unitTitles[resolved]) return;
  mode = resolved;
  document.body.dataset.unitMode = mode;
  $('scene-title').textContent = unitTitles[mode];
  $('stats-title').textContent = mode === 'evolution' ? 'Evolution' : unitTitles[mode];
  $('concept-note').textContent = unitNotes[mode];
  document.querySelectorAll('.mode-switch button').forEach((button) =>
    button.setAttribute('aria-pressed', String(button.dataset.mode === mode)));
  if (updateUrl) {
    const url = new URL(window.location.href);
    url.searchParams.set('unit', String(Object.keys(unitTitles).indexOf(mode) + 1));
    if (showModePicker) url.searchParams.set('modePicker', '1');
    window.history.replaceState({}, '', url);
  }
  reset();
  if (mode === 'evolution') startPlay();
}

function reset() {
  stop();
  if (previewTimer) clearTimeout(previewTimer);
  previewTimer = null;
  pendingGeneration = null;
  hideLessonOverlays();
  transition = null;
  lessonStep = 0;
  highlightedIds = new Map();
  selectedFitnessId = null;
  if (mode === 'evolution') {
    run = learnerHistory ? { history: [learnerHistory[0]] } : createRun();
    lessonExamples = [];
  } else {
    lessonExamples = buildLessonExamples();
    renderLessonExample();
  }
  update();
  if (mode === 'evolution') setStatus(learnerHistory ? 'Replaying learner evolution' : 'Grass is plentiful');
}

function nextGeneration() {
  if (mode !== 'evolution') {
    stepLesson();
    return;
  }
  if (pendingGeneration || transition) return;
  if (current().generation >= lastGeneration()) {
    setStatus('Long necks can reach the leaves');
    return;
  }
  const previous = current();
  const nextRun = learnerHistory
    ? { history: learnerHistory.slice(0, previous.generation + 2) }
    : advanceRun(run);
  pendingGeneration = { from: previous, run: nextRun };
  if (showCrossover(previous, nextRun.history.at(-1))) {
    $('step-btn').disabled = true;
    previewTimer = setTimeout(commitGeneration, 1800);
  } else {
    commitGeneration();
  }
}

function commitGeneration() {
  if (!pendingGeneration) return;
  const { from, run: nextRun } = pendingGeneration;
  pendingGeneration = null;
  previewTimer = null;
  $('crossover-overlay').hidden = true;
  run = nextRun;
  transition = { from, to: current(), start: performance.now(), duration: 2200 };
  update();
  const frame = current();
  setStatus(frame.groundFood > 8 ? 'Grass is plentiful' : frame.groundFood > 3 ? 'Grass is disappearing' : 'Long necks reach the leaves');
}

function showCrossover(previous, next) {
  const candidates = next.crossovers.filter((event) => event && typeof event === 'object').map((event) => {
    const [firstId, secondId] = Array.isArray(event.parents) ? event.parents.map(String) : [];
    const neckFrom = String(event.neckFrom);
    const efficiencyFrom = String(event.efficiencyFrom);
    const first = previous.population.find((giraffe) => giraffe.id === firstId);
    const second = previous.population.find((giraffe) => giraffe.id === secondId);
    const neckSource = previous.population.find((giraffe) => giraffe.id === neckFrom);
    const energySource = previous.population.find((giraffe) => giraffe.id === efficiencyFrom);
    const child = next.population[event.childIndex];
    if (!first || !second || !neckSource || !energySource || !child ||
      ![firstId, secondId].includes(neckFrom) || ![firstId, secondId].includes(efficiencyFrom) ||
      child.neck !== neckSource.neck || child.efficiency !== energySource.efficiency) return null;
    return { event: { ...event, neckFrom, efficiencyFrom }, first, second, child };
  }).filter(Boolean);
  const example = candidates.find(({ event }) => event.neckFrom !== event.efficiencyFrom) ?? candidates[0];
  if (!example) return false;

  const { event, first, second, child } = example;
  $('parent-a-neck').textContent = `Neck ${first.neck}`;
  $('parent-a-energy').textContent = `Energy ${first.efficiency}`;
  $('parent-b-neck').textContent = `Neck ${second.neck}`;
  $('parent-b-energy').textContent = `Energy ${second.efficiency}`;
  $('child-neck').textContent = `Neck ${child.neck}`;
  $('child-energy').textContent = `Energy ${child.efficiency}`;
  $('parent-a-neck').classList.toggle('chosen', event.neckFrom === first.id);
  $('parent-b-neck').classList.toggle('chosen', event.neckFrom === second.id);
  $('parent-a-energy').classList.toggle('chosen', event.efficiencyFrom === first.id);
  $('parent-b-energy').classList.toggle('chosen', event.efficiencyFrom === second.id);
  $('crossover-overlay').hidden = false;
  if (mode === 'evolution') {
    highlightedIds = new Map([[first.id, 'focus'], [second.id, 'focus']]);
  }
  const neckParent = event.neckFrom === first.id ? 'A' : 'B';
  const energyParent = event.efficiencyFrom === first.id ? 'A' : 'B';
  setStatus(`Neck from Parent ${neckParent} · Energy from Parent ${energyParent}`);
  return true;
}

function stop() {
  if (timer) clearTimeout(timer);
  timer = null;
  $('play-btn').textContent = 'Play';
}

function startPlay() {
  if (timer || (mode === 'evolution' ? lastGeneration() === 0 : lessonExamples.length < 2)) return;
  $('play-btn').textContent = 'Pause';
  timer = setTimeout(autoTick, 900);
}

function autoTick() {
  if (mode !== 'evolution') {
    stepLesson();
    timer = setTimeout(autoTick, 2800);
    return;
  }
  if (current().generation >= lastGeneration()) {
    reset();
    startPlay();
    return;
  }
  const finalNext = current().generation + 1 >= lastGeneration();
  nextGeneration();
  timer = setTimeout(autoTick, finalNext ? 7000 : 4900);
}

function togglePlay() {
  if (timer) stop();
  else startPlay();
}

function setStatus(message) { $('status-text').textContent = message; }

function loadLearnerHistory(history) {
  try {
    if (!Array.isArray(history) || history.length < 1 || history.length > MAX_GENERATIONS + 1) {
      throw new Error(`History must contain 1 to ${MAX_GENERATIONS + 1} generations.`);
    }
    const normalized = history.map((entry, generation) => {
      if (!entry || entry.generation !== generation || !Array.isArray(entry.population) || entry.population.length !== POPULATION_SIZE) {
        throw new Error(`Generation ${generation} must have ${POPULATION_SIZE} giraffes and a matching generation number.`);
      }
      const population = entry.population.map((candidate, index) => {
        const neck = Number(candidate.neck_length ?? candidate.neck);
        const efficiency = Number(candidate.energy_efficiency ?? candidate.efficiency ?? 3);
        const fitness = Number(candidate.fitness);
        if (!Number.isFinite(neck) || neck < 1 || neck > 10 || !Number.isFinite(efficiency) || efficiency < 1 || efficiency > 5 || !Number.isFinite(fitness) || fitness < 0 || typeof candidate.fed !== 'boolean') {
          throw new Error(`Giraffe ${index + 1} in generation ${generation} has invalid traits, fitness, or fed status.`);
        }
        return { id: String(candidate.id ?? `g${generation}-${index}`), neck, efficiency, fitness, fed: candidate.fed, food: candidate.food ?? 'unknown' };
      });
      const groundFood = Number(entry.ground_food ?? entry.groundFood ?? groundFoodSlots(generation));
      if (!Number.isInteger(groundFood) || groundFood < 0 || groundFood > POPULATION_SIZE) {
        throw new Error(`Generation ${generation} has an invalid ground food count.`);
      }
      return {
        generation,
        groundFood,
        population,
        selectedParents: Array.isArray(entry.selected_parents) ? entry.selected_parents : [],
        selectionEvents: Array.isArray(entry.selection_events) ? entry.selection_events : Array.isArray(entry.selectionEvents) ? entry.selectionEvents : [],
        mutations: Array.isArray(entry.mutations) ? entry.mutations : [],
        crossovers: Array.isArray(entry.crossovers) ? entry.crossovers : [],
        bestFitness: Math.max(...population.map((candidate) => candidate.fitness)),
        averageFitness: population.reduce((sum, candidate) => sum + candidate.fitness, 0) / POPULATION_SIZE,
        averageNeckLength: population.reduce((sum, candidate) => sum + candidate.neck, 0) / POPULATION_SIZE
      };
    });
    learnerHistory = normalized;
    setMode(mode, false);
  } catch (error) {
    console.error('Could not load learner evolution history:', error);
    setStatus(`Could not load learner run: ${error.message}`);
  }
}

window.addEventListener('giraffe:evolution-history', (event) => loadLearnerHistory(event.detail?.history));
window.loadGiraffeEvolution = loadLearnerHistory;

function mixColor(start, end, amount) {
  const parts = [1, 3, 5].map((at) => {
    const from = parseInt(start.slice(at, at + 2), 16);
    const to = parseInt(end.slice(at, at + 2), 16);
    return Math.round(from + (to - from) * amount);
  });
  return `rgb(${parts.join(',')})`;
}

function stableOffset(id) {
  let value = 2166136261;
  for (const char of String(id)) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  return (value >>> 0) / 4294967295;
}

function drawGiraffe(x, ground, giraffe, scale = 1, time = 0, walking = 0, row = 0, showBadge = true) {
  const { neck, fed } = giraffe;
  const bodyW = 34 * scale;
  const bodyH = 22 * scale;
  const neckH = (18 + neck * 12) * scale;
  const spot = '#87552f';
  const phase = time / 260 + stableOffset(giraffe.id) * Math.PI * 2;
  const stride = Math.sin(phase) * 6 * scale * walking;
  ctx.save();
  ctx.translate(x, ground + Math.abs(Math.sin(phase)) * 2 * scale * walking + Math.sin(time / 480 + x * .025) * scale);
  ctx.rotate(Math.sin(phase) * .025 * walking + (stableOffset(giraffe.id) - .5) * .045);
  // Legs move in opposite directions while the herd walks.
  ctx.strokeStyle = '#9b642f'; ctx.lineWidth = 4 * scale; ctx.lineCap = 'round';
  [-bodyW * .28, bodyW * .3].forEach((dx, index) => {
    const swing = index ? -stride : stride;
    ctx.beginPath();
    ctx.moveTo(dx, -bodyH * .25);
    ctx.lineTo(dx + swing * .45, -bodyH * .08);
    ctx.lineTo(dx + swing, 0);
    ctx.stroke();
  });
  // Body and spots vary slightly between animals.
  ctx.fillStyle = fed ? (stableOffset(giraffe.id) > .5 ? '#f1bd58' : '#eeb653') : '#caa36d';
  ctx.beginPath(); ctx.ellipse(0, -bodyH * .7, bodyW / 2, bodyH / 2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = spot;
  [[-9,-17],[1,-22],[10,-15],[-2,-11]].forEach(([sx, sy]) => {
    ctx.beginPath(); ctx.arc(sx * scale, sy * scale, 2.2 * scale, 0, Math.PI * 2); ctx.fill();
  });
  // long neck, head, ears and ossicones
  ctx.strokeStyle = fed ? '#e9ad43' : '#bd955e'; ctx.lineWidth = 8 * scale; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(bodyW * .27, -bodyH * .9); ctx.lineTo(bodyW * .42, -bodyH * .9 - neckH); ctx.stroke();
  ctx.fillStyle = fed ? '#f1bd58' : '#caa36d';
  ctx.beginPath(); ctx.ellipse(bodyW * .47, -bodyH * .9 - neckH, 10 * scale, 6 * scale, -.12, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(bodyW * .45, -bodyH * .9 - neckH - 8 * scale, 1.6 * scale, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(bodyW * .57, -bodyH * .9 - neckH - 8 * scale, 1.6 * scale, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#533b2b'; ctx.beginPath(); ctx.arc(bodyW * .55, -bodyH * .9 - neckH - 1 * scale, 1.3 * scale, 0, Math.PI * 2); ctx.fill();
  if (fed && giraffe.food === 'leaves') {
    ctx.fillStyle = '#5b9653';
    ctx.beginPath();
    ctx.ellipse(bodyW * .47 + 12 * scale, -bodyH * .9 - neckH + Math.sin(time / 220 + x) * 2 * scale, 4 * scale, 2.5 * scale, -.4, 0, Math.PI * 2);
    ctx.fill();
  }
  // Tail wag and a high contrast feeding badge below the feet.
  ctx.strokeStyle = '#9b642f'; ctx.lineWidth = 2 * scale;
  ctx.beginPath();
  ctx.moveTo(-bodyW/2, -bodyH*.7);
  ctx.lineTo(-bodyW/2 - 8*scale, -bodyH*.48 + Math.sin(phase) * 3*scale);
  ctx.stroke();
  if (showBadge) {
    const badgeX = (row ? 8 : -8) * scale;
    const badgeY = 17 * scale;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(badgeX, badgeY, 12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = fed ? '#1f7a4e' : '#b8443d';
    ctx.beginPath(); ctx.arc(badgeX, badgeY, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '700 13px Work Sans, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(fed ? '✓' : '×', badgeX, badgeY + .5);
  }
  ctx.restore();
}

function drawTree(x, ground, height, drought, time) {
  const sway = Math.sin(time / 1250 + x) * 2;
  ctx.strokeStyle = '#76512f'; ctx.lineWidth = 12; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x, ground); ctx.lineTo(x, ground-height); ctx.stroke();
  ctx.strokeStyle = '#76512f'; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(x, ground-height*.63); ctx.lineTo(x-38, ground-height*.82); ctx.moveTo(x, ground-height*.54); ctx.lineTo(x+43, ground-height*.75); ctx.stroke();
  const foliage = ['#527e50', '#6a935e', '#83a968'].map((green, index) =>
    mixColor(green, ['#858852', '#a2a165', '#b1ac69'][index], drought));
  const leaves = [[-35,.84],[0,.98],[35,.78],[-15,.70],[22,.65],[-49,.76],[48,.86]];
  leaves.forEach(([dx, dy], i) => {
    ctx.fillStyle = foliage[i % foliage.length];
    ctx.beginPath(); ctx.arc(x+dx+sway, ground-height*dy, 17-drought*2, 0, Math.PI*2); ctx.fill();
  });
}

function drawChart() {
  const chart = $('trend-canvas');
  const c = chart.getContext('2d');
  const w = chart.width, h = chart.height;
  c.clearRect(0, 0, w, h);
  c.strokeStyle = '#d6ddcf'; c.lineWidth = 1;
  for (let i=0; i<3; i++) { const y = 12 + i*(h-24)/2; c.beginPath(); c.moveTo(30,y); c.lineTo(w-8,y); c.stroke(); }
  c.fillStyle = '#788273'; c.font = '11px Work Sans, sans-serif'; c.fillText('10', 5, 16); c.fillText('1', 12, h-7);
  if (run.history.length < 2) return;
  c.strokeStyle = '#39815c'; c.lineWidth = 3; c.beginPath();
  run.history.forEach((frame, i) => {
    const x = 30 + i*(w-40)/Math.max(1, lastGeneration());
    const y = h-10 - (frame.averageNeckLength-1)/9*(h-24);
    if (i===0) c.moveTo(x,y); else c.lineTo(x,y);
  });
  c.stroke();
}

function drawLandscape(w, h, ground, drought, grass, time) {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, mixColor('#d9eef0', '#f4d8a9', drought));
  sky.addColorStop(1, mixColor('#f7f1d9', '#f2d39b', drought));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // Clouds fade and the distant hills become dusty as ground food declines.
  ctx.save();
  ctx.globalAlpha = .55 * (1 - drought * .75);
  ctx.fillStyle = '#ffffff';
  for (const [baseX, baseY, size] of [[.18, .18, 1], [.53, .12, .75]]) {
    const x = w * baseX + Math.sin(time / 8000 + baseX) * 12;
    const y = h * baseY;
    for (const [dx, dy, radius] of [[-16, 3, 18], [0, -5, 24], [21, 3, 17]]) {
      ctx.beginPath(); ctx.arc(x + dx * size, y + dy * size, radius * size, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();

  ctx.fillStyle = mixColor('#b2cfaa', '#d9bb8b', drought);
  ctx.beginPath();
  ctx.moveTo(0, ground - h*.08);
  ctx.quadraticCurveTo(w*.22, ground - h*.21, w*.44, ground - h*.1);
  ctx.quadraticCurveTo(w*.7, ground - h*.23, w, ground - h*.11);
  ctx.lineTo(w, ground); ctx.lineTo(0, ground); ctx.fill();

  ctx.fillStyle = mixColor('#a7c98a', '#c7ae78', drought);
  ctx.fillRect(0, ground, w, h-ground);
  ctx.fillStyle = mixColor('#7ea967', '#a78b60', drought);
  ctx.fillRect(0, ground+18, w, h-ground-18);
  ctx.fillStyle = mixColor('#6c9d59', '#947a52', drought);
  ctx.fillRect(0, ground+18, w, 3);

  const bladeCount = Math.round(grass / POPULATION_SIZE * 60);
  for (let i = 0; i < bladeCount; i += 1) {
    const x = (i * 79 + 17) % w;
    const y = ground + 5 + (i % 3) * 7;
    const height = (7 + i % 8) * (1 - drought * .42);
    const sway = Math.sin(time / 800 + i) * 2;
    ctx.strokeStyle = mixColor(i % 2 ? '#578b45' : '#689850', '#a28c59', drought);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 4 + sway, y - height);
    ctx.moveTo(x, y);
    ctx.lineTo(x + 4 + sway, y - height * .85);
    ctx.stroke();
  }

  drawTree(w*.76, ground, h*.37, drought, time);
  drawTree(w*.91, ground, h*.33, drought, time);
}

function drawFocusScene(w, ground, time) {
  const example = lessonExamples[lessonStep];
  if (!example) return;
  let animals = [];
  if (mode === 'selection') {
    animals = example.event.contenders.map((id) => example.frame.population.find((giraffe) => giraffe.id === String(id)));
  } else if (mode === 'crossover') {
    const [firstId, secondId] = example.event.parents.map(String);
    animals = [
      example.frame.population.find((giraffe) => giraffe.id === firstId),
      example.next.population[example.event.childIndex],
      example.frame.population.find((giraffe) => giraffe.id === secondId)
    ];
  } else if (mode === 'mutation') {
    const child = example.frame.population[example.event.childIndex];
    if (child) animals = [{ ...child, neck: Number(example.event.from) }, child];
  }
  const positions = animals.length === 2 ? [.34, .66] : [.19, .5, .81];
  const scale = Math.min(1.35, Math.max(.82, w / 650));
  animals.forEach((giraffe, index) => {
    if (!giraffe) return;
    const x = w * positions[index];
    const y = ground + (index % 2 ? 7 : 0);
    const winner = mode === 'selection' && giraffe.id === String(example.event.winner);
    if (winner) {
      ctx.fillStyle = '#dff2d5a8';
      ctx.beginPath(); ctx.ellipse(x, y - 67 * scale, 49 * scale, 84 * scale, 0, 0, Math.PI * 2); ctx.fill();
    }
    drawGiraffe(x, y, giraffe, scale, time, .08, index % 2, false);
    if (winner) {
      ctx.fillStyle = '#22734a';
      ctx.font = `700 ${17 * scale}px Work Sans, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('★', x, y - (39 + giraffe.neck * 12) * scale);
    }
  });
  if (mode === 'crossover' || mode === 'mutation') {
    ctx.strokeStyle = '#3b8159';
    ctx.fillStyle = '#3b8159';
    ctx.lineWidth = 3;
    const arrows = mode === 'mutation' ? [[.43, .57]] : [[.29, .41], [.71, .59]];
    arrows.forEach(([from, to]) => {
      const y = ground - 45;
      ctx.beginPath(); ctx.moveTo(w * from, y); ctx.lineTo(w * to, y); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(w * to, y);
      ctx.lineTo(w * to + (to > from ? -9 : 9), y - 6);
      ctx.lineTo(w * to + (to > from ? -9 : 9), y + 6);
      ctx.closePath(); ctx.fill();
    });
  }
}

function renderScene(time = performance.now()) {
  const frame = current();
  const rect = canvas.getBoundingClientRect();
  if (!rect.width) return;
  const dpr = window.devicePixelRatio || 1;
  const w = rect.width;
  const h = w / 1.85;
  const pixelWidth = Math.round(w * dpr);
  const pixelHeight = Math.round(h * dpr);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  ctx.setTransform(dpr,0,0,dpr,0,0);
  const ground = h*.78;
  const progress = transition ? Math.min(1, (time - transition.start) / transition.duration) : 1;
  const grass = transition && progress < 1
    ? transition.from.groundFood + (frame.groundFood - transition.from.groundFood) * progress
    : frame.groundFood;
  if (transition && progress >= 1) {
    transition = null;
    $('step-btn').disabled = frame.generation >= lastGeneration();
  }
  drawLandscape(w, h, ground, Math.max(0, Math.min(1, 1 - grass / POPULATION_SIZE)), grass, time);
  giraffeHitZones = [];
  if (['selection', 'crossover', 'mutation'].includes(mode)) {
    drawFocusScene(w, ground, time);
    return;
  }
  const drawHerd = (population, opacity, offset, walking) => {
    const columns = Math.ceil(population.length / 2);
    const spacing = w * .72 / columns;
    ctx.save();
    ctx.globalAlpha = opacity;
    for (const row of [0, 1]) {
      population.forEach((giraffe, i) => {
        if (i % 2 !== row) return;
        const column = Math.floor(i / 2);
        const variation = stableOffset(giraffe.id);
        const x = w*.06 + spacing*(column+.5+row*.36) + (variation-.5)*spacing*.24 + offset;
        const y = ground + (row ? 23 : 5) + (variation-.5)*8;
        const scale = Math.min(1.35, w/820)*(row ? 1 : .88);
        if (mode === 'fitness') giraffeHitZones.push({ giraffe, x, y, scale });
        const highlight = highlightedIds.get(giraffe.id);
        if (highlight && !transition) {
          ctx.save();
          ctx.strokeStyle = highlight === 'winner' ? '#20824e' : highlight === 'contender' ? '#397dba' : '#b77a26';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.ellipse(x, y - 16*scale, 25*scale, 23*scale, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
        drawGiraffe(x, y, giraffe, scale, time, walking, row);
      });
    }
    ctx.restore();
  };
  if (transition) {
    drawHerd(transition.from.population, Math.max(0, 1 - progress * progress * 1.5), progress * w*.55, 1);
    drawHerd(frame.population, Math.min(1, Math.max(0, (progress - .05) * 1.4)), -(1-progress) * w*.55, 1);
  } else {
    drawHerd(frame.population, 1, 0, .12);
  }
}

function animate(time) {
  renderScene(time);
  requestAnimationFrame(animate);
}

function update() {
  const frame = current();
  $('generation-value').textContent = `${frame.generation} / ${lastGeneration()}`;
  $('grass-value').textContent = `${frame.groundFood} / ${POPULATION_SIZE}`;
  $('avg-neck-value').textContent = frame.averageNeckLength.toFixed(1);
  const fedCount = frame.population.filter((giraffe) => giraffe.fed).length;
  $('fed-value').textContent = `${fedCount} / ${POPULATION_SIZE}`;
  $('fed-legend').textContent = `Fed ${fedCount}`;
  $('hungry-legend').textContent = `Hungry ${POPULATION_SIZE - fedCount}`;
  $('step-btn').disabled = mode === 'evolution'
    ? frame.generation >= lastGeneration() || Boolean(pendingGeneration || transition)
    : mode === 'fitness' || lessonExamples.length < 2;
  $('play-btn').disabled = mode === 'fitness' || (mode === 'evolution' ? lastGeneration() === 0 : lessonExamples.length < 2);
  renderScene(); drawChart();
}

function selectFitnessGiraffe(giraffe) {
  if (mode !== 'fitness' || !giraffe) return;
  selectedFitnessId = giraffe.id;
  renderLessonExample();
  update();
}

canvas.addEventListener('click', (event) => {
  if (mode !== 'fitness') return;
  const bounds = canvas.getBoundingClientRect();
  const x = event.clientX - bounds.left;
  const y = event.clientY - bounds.top;
  const candidates = giraffeHitZones.filter(({ giraffe, x: gx, y: gy, scale }) =>
    Math.abs(x - gx) < 25 * scale && y >= gy - (46 + giraffe.neck * 12) * scale && y <= gy + 23 * scale);
  const nearest = candidates.sort((a, b) => Math.abs(x - a.x) - Math.abs(x - b.x))[0];
  selectFitnessGiraffe(nearest?.giraffe);
});

canvas.addEventListener('keydown', (event) => {
  if (mode !== 'fitness' || !['ArrowRight', 'ArrowLeft', 'Enter', ' '].includes(event.key)) return;
  event.preventDefault();
  const population = current().population;
  const currentIndex = population.findIndex((giraffe) => giraffe.id === selectedFitnessId);
  const shift = event.key === 'ArrowLeft' ? -1 : 1;
  selectFitnessGiraffe(population[(currentIndex + shift + population.length) % population.length]);
});

$('step-btn').addEventListener('click', () => { stop(); nextGeneration(); });
$('play-btn').addEventListener('click', togglePlay);
$('reset-btn').addEventListener('click', reset);
document.querySelectorAll('.mode-switch button').forEach((button) =>
  button.addEventListener('click', () => setMode(button.dataset.mode)));
document.querySelector('.mode-switch').hidden = !showModePicker;
window.setGiraffeUnit = setMode;
window.addEventListener('resize', () => renderScene());
requestAnimationFrame(animate);
if (Array.isArray(window.__GIRAFFE_HISTORY__)) loadLearnerHistory(window.__GIRAFFE_HISTORY__);
else setMode(mode, false);

// The course runner writes this file after executing solution.py. Watch it so
// the open CodeSignal preview updates even when the host does not reload it.
let lastHistoryText = null;
async function refreshLearnerHistory() {
  try {
    const response = await fetch('/giraffe-history.json', { cache: 'no-store' });
    if (!response.ok) return;
    const text = await response.text();
    if (text === lastHistoryText) return;
    lastHistoryText = text;
    loadLearnerHistory(JSON.parse(text));
  } catch (error) {
    console.error('Could not read learner evolution history:', error);
  }
}
void refreshLearnerHistory();
setInterval(refreshLearnerHistory, 2000);
