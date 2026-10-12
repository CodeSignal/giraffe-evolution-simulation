# Giraffe Evolution Simulation

An interactive visual companion for a five-unit genetic algorithm course. Learners inspect giraffe fitness, see parent selection, crossover, and mutation, then watch the herd evolve as ground food disappears.

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

The simulation currently includes a deterministic demonstration. To show a learner's algorithm output, the course runner must build a generation history and call `window.loadGiraffeEvolution(history)`. See [SIMULATION-CONTRACT.md](SIMULATION-CONTRACT.md) for the data format and launch configuration.

This repository derives from the CodeSignal bespoke template and retains its [license](LICENSE). It has no design-system submodule or graph-traversal code.
