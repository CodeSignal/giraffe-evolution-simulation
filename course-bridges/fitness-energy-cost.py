"""Read solution.py and publish the first Fitness practice's giraffe scores."""

import json
import math
import os
from pathlib import Path

from giraffe_helpers import INITIAL_EFFICIENCIES, INITIAL_NECKS, giraffe_id, round_fitness
from solution import energy_cost


PAIRS = [(2, 3), (2, 5), (4, 2), (6, 4), (8, 1), (10, 5)]

for neck_length, energy_efficiency in PAIRS:
    cost = energy_cost(neck_length, energy_efficiency)
    shown = round(cost, 1) + 0.0
    print("energy_cost({}, {}) -> {:.1f}".format(neck_length, energy_efficiency, shown))

population = []
for index, (neck_length, energy_efficiency) in enumerate(zip(INITIAL_NECKS, INITIAL_EFFICIENCIES)):
    has_grass = index < 6
    leaves = 14 if neck_length >= 8 else 11 if neck_length >= 6 else 0
    grass = 10 if has_grass else 0
    food_points = max(leaves, grass)
    food = "leaves" if leaves > grass else "grass" if grass else "none"
    cost = float(energy_cost(neck_length, energy_efficiency))
    if not math.isfinite(cost):
        raise ValueError("energy_cost must return a finite number")
    population.append({
        "id": giraffe_id(0, index),
        "neck_length": neck_length,
        "energy_efficiency": energy_efficiency,
        "fitness": round_fitness(max(0, food_points - cost)),
        "fed": food_points > 0,
        "food": food,
    })

history = [{"generation": 0, "ground_food": 6, "population": population}]
payload = json.dumps(history)
Path("giraffe_history.json").write_text(payload, encoding="utf-8")

# The release and source-build setups serve different dist directories.
for directory in (Path("bespoke-simulation/dist"), Path("bespoke-simulation/src/dist")):
    if directory.is_dir():
        temporary = directory / "giraffe-history.json.tmp"
        temporary.write_text(payload, encoding="utf-8")
        os.replace(temporary, directory / "giraffe-history.json")
