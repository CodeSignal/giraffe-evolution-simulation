# Giraffe Evolution Simulation

An interactive visual companion for a five-unit genetic algorithm course. **Students edit one file, `solution.py`.** Each practice asks them to implement the function for that task, and the matching visualization shows the result of that function. The course runner executes their Python code and sends its output to this page.

The scenario starts with mostly short-necked giraffes. As ground food becomes scarce, giraffes that can reach leaves may have an advantage. Traits change across generations through inheritance and mutation; an individual giraffe does not grow a longer neck during its lifetime.

## The learner workflow

For every practice, the learner opens `solution.py` and fills in the requested function. The task supplies its signature, inputs, starter code, and any helpers already completed. The learner does not edit this repository's JavaScript, simulation data, or a separate configuration file. A practice focuses on one function; later practices can provide earlier functions in the starter file when they are needed.

| Mode | Function implemented in `solution.py` | What the student sees |
| --- | --- | --- |
| 1 · Fitness | `evaluate_fitness(...)` calculates a giraffe's food access and score. | Click a giraffe to inspect the food it reached and the score returned by the function. |
| 2 · Selection | `tournament_selection(...)` chooses a parent from three contenders. | See those giraffes, their scores, and the selected parent. |
| 3 · Crossover | `crossover(...)` chooses which parent supplies each trait to a child. | See both parents beside the child and where its traits came from. |
| 4 · Mutation | `mutate(...)` changes inherited traits within their bounds. | Compare the giraffe before and after the change. |
| 5 · Evolution | `evolve(...)` combines the operations over generations. | Watch the resulting herd change as ground food declines. |

These names describe the intended functions; each course task defines the exact signature and return value. The course runner supplies the rest of the scenario, converts the function's output into the visualization data, and opens the corresponding mode. If a task implements only selection, for example, the runner provides the evaluated giraffes and uses the student's selection result to determine which parent the mode highlights.

## How learner code reaches the simulation

The visualizer does not run Python. A CodeSignal course runner needs to:

1. Execute the requested function in the student's `solution.py` against the practice input, using supplied helpers for the other operations.
2. Collect that function's result and any needed selection, crossover, or mutation event.
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
