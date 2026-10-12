export const POPULATION_SIZE = 12;
export const MAX_GENERATIONS = 24;
export const DEFAULT_SEED = 7;

const INITIAL_NECKS = [2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 6, 6];
const INITIAL_EFFICIENCY = [3, 5, 2, 4, 5, 3, 4, 2, 5, 3, 4, 2];

function random(state) {
  // A small, repeatable generator makes the same seed produce the same lesson.
  const next = (Math.imul(state, 1664525) + 1013904223) >>> 0;
  return [next, next / 4294967296];
}

function draw(state, count) {
  const [next, value] = random(state);
  return [next, Math.floor(value * count)];
}

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function groundFoodSlots(generation) {
  return Math.max(1, Math.round(POPULATION_SIZE * Math.pow(0.88, generation)));
}

function evaluate(population, generation, state) {
  const order = population.map((_, index) => index);
  for (let i = order.length - 1; i > 0; i -= 1) {
    let choice;
    [state, choice] = draw(state, i + 1);
    [order[i], order[choice]] = [order[choice], order[i]];
  }
  const grassEaters = new Set(order.slice(0, groundFoodSlots(generation)));
  const scored = population.map((giraffe, index) => {
    const grass = grassEaters.has(index);
    const leaves = giraffe.neck >= 8 ? 14 : giraffe.neck >= 6 ? 11 : 0;
    const food = Math.max(grass ? 10 : 0, leaves);
    const energyCost = giraffe.neck * 0.15 - giraffe.efficiency * 0.1;
    return {
      ...giraffe,
      food: food ? (leaves > (grass ? 10 : 0) ? 'leaves' : 'grass') : 'none',
      fed: food > 0,
      fitness: Math.round(Math.max(0, food - energyCost) * 10) / 10
    };
  });
  return [state, scored];
}

function snapshot(generation, population, selectedParents = [], mutations = [], crossovers = [], selectionEvents = []) {
  const best = population.reduce((winner, giraffe) => giraffe.fitness > winner.fitness ? giraffe : winner);
  return {
    generation,
    groundFood: groundFoodSlots(generation),
    population,
    selectedParents,
    mutations,
    crossovers,
    selectionEvents,
    bestFitness: best.fitness,
    averageFitness: population.reduce((sum, giraffe) => sum + giraffe.fitness, 0) / population.length,
    averageNeckLength: population.reduce((sum, giraffe) => sum + giraffe.neck, 0) / population.length
  };
}

export function createRun(seed = DEFAULT_SEED) {
  let state = Number(seed) >>> 0;
  const initial = INITIAL_NECKS.map((neck, index) => ({
    id: `g0-${index}`,
    neck,
    efficiency: INITIAL_EFFICIENCY[index]
  }));
  let population;
  [state, population] = evaluate(initial, 0, state);
  return { seed, randomState: state, history: [snapshot(0, population)] };
}

export function advanceRun(run) {
  const current = run.history.at(-1);
  if (current.generation >= MAX_GENERATIONS) return run;
  let state = run.randomState;
  const parents = current.population;
  const selectionEvents = [];
  const chooseParent = () => {
    let winner = null;
    const contenders = [];
    for (let i = 0; i < 3; i += 1) {
      let index;
      [state, index] = draw(state, parents.length);
      contenders.push(parents[index].id);
      if (!winner || parents[index].fitness > winner.fitness) winner = parents[index];
    }
    selectionEvents.push({ contenders, winner: winner.id });
    return winner;
  };
  const generation = current.generation + 1;
  const elite = parents.reduce((winner, giraffe) => giraffe.fitness > winner.fitness ? giraffe : winner);
  const children = [{ id: `g${generation}-0`, neck: elite.neck, efficiency: elite.efficiency }];
  const selectedParents = [elite.id];
  const mutations = [];
  const crossovers = [];
  while (children.length < POPULATION_SIZE) {
    const first = chooseParent();
    const second = chooseParent();
    selectedParents.push(first.id, second.id);
    let choice;
    [state, choice] = draw(state, 2);
    let neck = choice ? first.neck : second.neck;
    const neckFrom = choice ? first.id : second.id;
    [state, choice] = draw(state, 2);
    let efficiency = choice ? first.efficiency : second.efficiency;
    const efficiencyFrom = choice ? first.id : second.id;
    const childIndex = children.length;
    crossovers.push({ childIndex, parents: [first.id, second.id], neckFrom, efficiencyFrom });
    let roll;
    [state, roll] = random(state);
    if (roll < 0.35) {
      const before = neck;
      [state, choice] = draw(state, 2);
      neck = clamp(neck + (choice ? 1 : -1), 1, 10);
      if (neck !== before) mutations.push({ childIndex, trait: 'neck', from: before, to: neck });
    }
    [state, roll] = random(state);
    if (roll < 0.12) {
      [state, choice] = draw(state, 2);
      efficiency = clamp(efficiency + (choice ? 1 : -1), 1, 5);
    }
    children.push({ id: `g${generation}-${childIndex}`, neck, efficiency });
  }
  let population;
  [state, population] = evaluate(children, generation, state);
  return {
    ...run,
    randomState: state,
    history: [...run.history, snapshot(generation, population, selectedParents, mutations, crossovers, selectionEvents)]
  };
}

export function createFullRun(seed = DEFAULT_SEED) {
  let run = createRun(seed);
  while (run.history.at(-1).generation < MAX_GENERATIONS) run = advanceRun(run);
  return run;
}
