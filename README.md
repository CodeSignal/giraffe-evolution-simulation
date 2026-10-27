# Giraffe Evolution Simulation

An interactive visual companion for a five-unit genetic algorithm course. **The student writes the algorithm; the simulation shows what their code produced.** Students implement fitness, parent selection, crossover, mutation, and the generation loop in Python. The course runner executes their code and sends the resulting giraffes and events to this page for visualization.

The scenario starts with mostly short-necked giraffes. As ground food becomes scarce, giraffes that can reach leaves may have an advantage. Traits change across generations through inheritance and mutation; an individual giraffe does not grow a longer neck during its lifetime.

## What students implement

| Unit | Student code | What the student sees |
| --- | --- | --- |
| 1 · Fitness | Represent giraffes and calculate food access and fitness. | Click a giraffe to inspect the food it reached and the score returned by the student's function. |
| 2 · Selection | Run a three-contender tournament to choose parents. | See the contenders, their scores, and the selected giraffe. |
| 3 · Crossover | Choose which parent supplies the child's neck length and energy efficiency. | See both parents beside their child and where each trait came from. |
| 4 · Mutation | Apply bounded changes to inherited traits. | Compare a giraffe before and after a neck mutation. |
| 5 · Evolution | Combine the functions into a generation loop. | Watch the herd change over generations as ground food declines. |

This is an incremental coding course: each unit builds on the previous functions. A changed fitness function should change the displayed scores; different selection, crossover, or mutation results should change the corresponding giraffes and events. The full evolution mode shows the outcome of those combined decisions.

## How learner code reaches the simulation

The visualizer does not run Python. A CodeSignal course runner needs to:

1. Execute the student's Python solution against the practice input.
2. Collect the evaluated population and, where relevant, selection, crossover, and mutation events.
3. Convert those results into the generation-history format in [SIMULATION-CONTRACT.md](SIMULATION-CONTRACT.md).
4. Load the history into the visualizer, for example with `window.loadGiraffeEvolution(history)`.

The repository currently opens with a deterministic demonstration so authors can preview all five modes. **The runner bridge described above is not implemented here yet.** Until the course runner supplies a student's history, the animation shows demonstration data rather than the student's code output.

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. Use `?unit=1` through `?unit=5` to launch one practice activity without a mode picker:

| Unit | Activity |
| --- | --- |
| 1 | Population and fitness |
| 2 | Parent selection |
| 3 | Crossover |
| 4 | Mutation |
| 5 | Full evolution |

For an author preview with all five buttons, use `?unit=1&modePicker=1`.

See [SIMULATION-CONTRACT.md](SIMULATION-CONTRACT.md) for the exact history fields, event format, and launch configuration. Each practice should select its unit mode when it starts; the mode picker is for author preview.

This repository derives from the CodeSignal bespoke template and retains its [license](LICENSE). It has no design-system submodule or graph-traversal code.
