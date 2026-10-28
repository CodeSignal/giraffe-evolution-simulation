# Giraffe evolution simulation

The page opens with a deterministic demonstration (seed `7`). A herd of 12 begins with mostly short necks. Each generation has less ground food; giraffes with enough reach can also eat leaves. A longer neck has a small energy cost. The demonstration uses three-candidate tournament selection, crossover, mutation, and one elite survivor to produce the next generation.

The visuals can also replay a learner's genetic algorithm output. The learner should produce the generation history; the page handles drawing, controls, statistics, and playback. A giraffe's neck does not change during its lifetime. New neck lengths appear in offspring through inheritance and mutation.

The current preview runs the built-in demonstration. This repository does not yet execute learner functions or convert their return values into generation history. The course runner must call the learner's functions, build the history below, and pass it to the page. A changed fitness function then changes the displayed scores and feeding outcomes when its calculated values are supplied. Selection, crossover, and mutation modes use the learner's event records when present; otherwise they show demonstration examples.

## Learner history format

Provide 1 to 25 consecutive generations, starting at `0`. Each generation needs exactly 12 giraffes. Every giraffe needs a neck length from 1 to 10, energy efficiency from 1 to 5, a nonnegative fitness value, and a Boolean `fed` value. The renderer calculates summary statistics from the population so displayed values stay consistent.

```json
[
  {
    "generation": 0,
    "ground_food": 12,
    "population": [
      { "id": "g0-0", "neck_length": 2, "energy_efficiency": 3, "fitness": 10, "fed": true }
    ],
    "selected_parents": [],
    "selection_events": [],
    "crossovers": [],
    "mutations": []
  }
]
```

The example shows one giraffe for brevity; a real `population` must contain 12. `ground_food`, `selected_parents`, `selection_events`, `crossovers`, and `mutations` are optional. `ground_food` defaults to the demonstration schedule. Selection events have `contenders` (three giraffe IDs from the previous generation) and `winner` (the selected ID). To show the crossover preview, include records with `childIndex`, `parents` (two parent IDs), `neckFrom` (a parent ID), and `efficiencyFrom` (a parent ID). The preview highlights the parent that supplied each trait before the offspring joins the herd. Mutation records have `childIndex`, `trait`, `from`, and `to`.

## Course unit modes

Choose the activity in the course's `setup.sh` by writing `dist/practice-config.json` after the build, with a `unit` value of `fitness`, `selection`, `crossover`, `mutation`, or `evolution`. The page reads that file at startup. The included default selects Fitness. A URL parameter such as `?unit=3` or `?practiceUnit=3` overrides the file; the course host can also set `window.__GIRAFFE_UNIT__ = 3` before the module loads, or call `window.setGiraffeUnit(3)` later. The five mode buttons are hidden unless an author explicitly adds `?modePicker=1`.

In Fitness, learners click a giraffe to inspect its food and score; the focused canvas also supports arrow-key selection. Selection shows three competing giraffes and marks the winner. Crossover shows both parents beside their offspring. Mutation shows the inherited and mutated neck lengths as giraffes. `Next` steps through examples in units 2–4; `Play` cycles through them. Unit 5 plays the complete evolution run with its herd visible during crossover. If the learner history does not include selection, crossover, or mutation events, those unit modes use the demonstration examples.

The course host can set `window.__GIRAFFE_HISTORY__` before the simulation module loads, or send a new run later:

```js
window.loadGiraffeEvolution(result.history);
// Or:
window.dispatchEvent(new CustomEvent('giraffe:evolution-history', {
  detail: { history: result.history }
}));
```

`Reset` returns to the first generation of the loaded run. Invalid data leaves the current run in place and displays a validation error. Reload the page without supplied history to return to the built-in demonstration.

## Demonstration rules

- Ground food portions per generation: `max(1, round(12 × 0.88^generation))`.
- Neck length 6 reaches low leaves; length 8 reaches high leaves.
- Grass gives 10 food points, low leaves 11, and high leaves 14. A giraffe uses the most valuable food it can reach.
- Fitness is food points minus `0.15 × neck_length − 0.1 × energy_efficiency`, floored at zero and rounded to one decimal.
- Three-candidate tournament selection chooses parents. Each child receives its neck and efficiency traits independently from either parent. Neck mutation has a 35% chance of moving one unit up or down; efficiency mutation has a 12% chance. Traits stay within their allowed ranges.

These rules are an instructional model. A learner's algorithm may calculate fitness differently; its returned `fitness` and `fed` values drive the replay.
