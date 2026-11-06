
import os
import csv
import math
import heapq

import numpy as np
import networkx as nx
import rasterio


# ==================================================
# ASTRAL - A* OPTIMALITY VALIDATION
# ==================================================

BASE_DIR = os.path.dirname(
    os.path.dirname(os.path.abspath(__file__))
)

INPUT_FILE = os.path.join(
    BASE_DIR,
    "data",
    "processed",
    "jezero_route_cost_400m.tif"
)

ROUTE_FILE = os.path.join(
    BASE_DIR,
    "data",
    "processed",
    "jezero_test_route.csv"
)

NODATA = -9999.0

START = (10, 10)


# ==================================================
# BUILD THE SAME GRAPH AS THE A* PLANNER
# ==================================================

def build_terrain_graph():

    print("\n[1] LOADING TERRAIN GRID")

    if not os.path.exists(INPUT_FILE):
        raise FileNotFoundError(INPUT_FILE)

    with rasterio.open(INPUT_FILE) as src:

        terrain = src.read(1)
        raster_transform = src.transform

        height, width = terrain.shape

    goal = (height - 11, width - 11)

    print("Grid dimensions:", width, "x", height)
    print("Start:", START)
    print("Goal:", goal)

    # ----------------------------------------------
    # Validate endpoints
    # ----------------------------------------------

    for name, point in [
        ("START", START),
        ("GOAL", goal)
    ]:

        row, col = point

        if not (
            0 <= row < height
            and 0 <= col < width
        ):
            raise ValueError(
                f"{name} is outside the terrain grid."
            )

        if (
            not np.isfinite(terrain[row, col])
            or terrain[row, col] == NODATA
        ):
            raise ValueError(
                f"{name} lies on invalid terrain."
            )

    # ----------------------------------------------
    # Identify valid cells
    # ----------------------------------------------

    valid = (
        np.isfinite(terrain)
        & (terrain != NODATA)
    )

    if not np.all(terrain[valid] > 0):
        raise ValueError(
            "Terrain costs must be positive."
        )

    graph = nx.Graph()

    rows, cols = np.where(valid)

    graph.add_nodes_from(
        zip(rows.tolist(), cols.tolist())
    )

    print("Valid terrain nodes:", graph.number_of_nodes())

    # ----------------------------------------------
    # Same movement directions as A* planner
    # ----------------------------------------------

    directions = [
        (0, 1),
        (1, 0),
        (1, 1),
        (1, -1)
    ]

    for row, col in zip(rows, cols):

        current_cost = float(
            terrain[row, col]
        )

        for dr, dc in directions:

            nr = row + dr
            nc = col + dc

            if not (
                0 <= nr < height
                and 0 <= nc < width
            ):
                continue

            if not valid[nr, nc]:
                continue

            # Prevent diagonal corner cutting.
            if dr != 0 and dc != 0:

                if not valid[row + dr, col]:
                    continue

                if not valid[row, col + dc]:
                    continue

            next_cost = float(
                terrain[nr, nc]
            )

            # Calculate physical movement distance.
            dx = (
                raster_transform.a * dc
                + raster_transform.b * dr
            )

            dy = (
                raster_transform.d * dc
                + raster_transform.e * dr
            )

            distance = math.hypot(dx, dy)

            # Same weighted edge cost as A*.
            movement_cost = (
                distance
                * (current_cost + next_cost)
                / 2.0
            )

            graph.add_edge(
                (row, col),
                (nr, nc),
                weight=movement_cost
            )

    print("Graph edges:", graph.number_of_edges())

    if START not in graph:
        raise ValueError("Start node is missing from graph.")

    if goal not in graph:
        raise ValueError("Goal node is missing from graph.")

    return graph, terrain, raster_transform, goal


# ==================================================
# A* HEURISTIC
# ==================================================

def create_heuristic(terrain, raster_transform):

    valid = (
        np.isfinite(terrain)
        & (terrain != NODATA)
    )

    min_cost = float(
        terrain[valid].min()
    )

    def heuristic(current, destination):

        r1, c1 = current
        r2, c2 = destination

        dx = (
            raster_transform.a * (c2 - c1)
            + raster_transform.b * (r2 - r1)
        )

        dy = (
            raster_transform.d * (c2 - c1)
            + raster_transform.e * (r2 - r1)
        )

        straight_distance = math.hypot(dx, dy)

        return straight_distance * min_cost

    return heuristic, min_cost


# ==================================================
# LOAD EXISTING A* ROUTE
# ==================================================

def load_existing_route():

    print("\n[2] LOADING EXISTING A* ROUTE")

    if not os.path.exists(ROUTE_FILE):
        raise FileNotFoundError(ROUTE_FILE)

    with open(
        ROUTE_FILE,
        "r",
        newline="",
        encoding="utf-8"
    ) as file:

        rows = list(csv.DictReader(file))

    if len(rows) < 2:
        raise ValueError(
            "Existing route contains insufficient points."
        )

    route = [
        (
            int(row["row"]),
            int(row["column"])
        )
        for row in rows
    ]

    print("Existing A* route points:", len(route))

    return route


# ==================================================
# CALCULATE EXISTING ROUTE COST
# ==================================================

def calculate_route_cost(graph, route):

    total_cost = 0.0

    for index in range(1, len(route)):

        previous = route[index - 1]
        current = route[index]

        if not graph.has_edge(previous, current):
            raise ValueError(
                f"Invalid route edge: {previous} -> {current}"
            )

        total_cost += graph[previous][current]["weight"]

    return total_cost


# ==================================================
# VALIDATE HEURISTIC CONSISTENCY
# ==================================================

def validate_heuristic(graph, goal, heuristic):

    maximum_violation = 0.0

    for u, v, data in graph.edges(data=True):

        weight = data["weight"]

        h_u = heuristic(u, goal)
        h_v = heuristic(v, goal)

        violation_uv = h_u - (weight + h_v)
        violation_vu = h_v - (weight + h_u)

        maximum_violation = max(
            maximum_violation,
            violation_uv,
            violation_vu
        )

    return maximum_violation <= 1e-6, max(
        0.0,
        maximum_violation
    )


# ==================================================
# MAIN OPTIMALITY VALIDATION
# ==================================================

def validate_optimality():

    print("\n" + "=" * 60)
    print("       ASTRAL - A* OPTIMALITY VALIDATION")
    print("=" * 60)

    # ----------------------------------------------
    # 1. Build graph
    # ----------------------------------------------

    graph, terrain, raster_transform, goal = (
        build_terrain_graph()
    )

    # ----------------------------------------------
    # 2. Load existing route
    # ----------------------------------------------

    existing_route = load_existing_route()

    # ----------------------------------------------
    # 3. Prepare heuristic
    # ----------------------------------------------

    heuristic, min_cost = create_heuristic(
        terrain,
        raster_transform
    )

    print("\n[3] HEURISTIC INFORMATION")
    print("-" * 60)

    print(f"Minimum terrain cost: {min_cost:.6f}")

    # ----------------------------------------------
    # 4. Validate existing route endpoints
    # ----------------------------------------------

    endpoint_valid = (
        existing_route[0] == START
        and existing_route[-1] == goal
    )

    # ----------------------------------------------
    # 5. Calculate existing route cost
    # ----------------------------------------------

    existing_route_cost = calculate_route_cost(
        graph,
        existing_route
    )

    # ----------------------------------------------
    # 6. Run A* independently
    # ----------------------------------------------

    print("\n[4] RUNNING A* ALGORITHM")

    astar_cost = nx.astar_path_length(
        graph,
        START,
        goal,
        heuristic=heuristic,
        weight="weight"
    )

    print(f"A* minimum path cost: {astar_cost:.6f}")

    # ----------------------------------------------
    # 7. Run Dijkstra independently
    # ----------------------------------------------

    print("\n[5] RUNNING DIJKSTRA ALGORITHM")

    dijkstra_path = nx.dijkstra_path(
        graph,
        START,
        goal,
        weight="weight"
    )

    dijkstra_cost = nx.dijkstra_path_length(
        graph,
        START,
        goal,
        weight="weight"
    )

    print(
        "Dijkstra route points:",
        len(dijkstra_path)
    )

    print(
        f"Dijkstra minimum path cost: {dijkstra_cost:.6f}"
    )

    # ----------------------------------------------
    # 8. Validate heuristic consistency
    # ----------------------------------------------

    print("\n[6] CHECKING HEURISTIC")

    heuristic_consistent, maximum_violation = (
        validate_heuristic(
            graph,
            goal,
            heuristic
        )
    )

    # ----------------------------------------------
    # 9. Compare route costs
    # ----------------------------------------------

    comparison_tolerance = max(
        1e-5,
        abs(dijkstra_cost) * 1e-8
    )

    astar_matches_dijkstra = math.isclose(
        astar_cost,
        dijkstra_cost,
        rel_tol=1e-8,
        abs_tol=1e-5
    )

    existing_route_matches_dijkstra = math.isclose(
        existing_route_cost,
        dijkstra_cost,
        rel_tol=1e-8,
        abs_tol=1e-5
    )

    # ----------------------------------------------
    # 10. Validation checks
    # ----------------------------------------------

    checks = {

        "Existing route starts and ends correctly":
            endpoint_valid,

        "Existing route uses valid graph edges":
            all(
                graph.has_edge(
                    existing_route[i - 1],
                    existing_route[i]
                )
                for i in range(1, len(existing_route))
            ),

        "A* cost matches Dijkstra cost":
            astar_matches_dijkstra,

        "Existing route cost matches Dijkstra":
            existing_route_matches_dijkstra,

        "A* heuristic is consistent":
            heuristic_consistent,
    }

    # ----------------------------------------------
    # 11. Display results
    # ----------------------------------------------

    print("\nOPTIMALITY VALIDATION CHECKS")
    print("-" * 60)

    for name, passed in checks.items():

        status = "PASS" if passed else "FAIL"

        print(f"{status}: {name}")

    # ----------------------------------------------
    # 12. Route comparison
    # ----------------------------------------------

    print("\nROUTE COST COMPARISON")
    print("-" * 60)

    print(
        f"Existing CSV route cost: "
        f"{existing_route_cost:,.6f}"
    )

    print(
        f"A* recalculated cost: "
        f"{astar_cost:,.6f}"
    )

    print(
        f"Dijkstra minimum cost: "
        f"{dijkstra_cost:,.6f}"
    )

    print(
        f"Existing route difference: "
        f"{existing_route_cost - dijkstra_cost:.8f}"
    )

    print(
        f"A* / Dijkstra difference: "
        f"{astar_cost - dijkstra_cost:.8f}"
    )

    print(
        f"Comparison tolerance: "
        f"{comparison_tolerance:.8f}"
    )

    print(
        f"Maximum heuristic consistency violation: "
        f"{maximum_violation:.10f}"
    )

    print(
        f"Existing A* route points: "
        f"{len(existing_route)}"
    )

    print(
        f"Dijkstra route points: "
        f"{len(dijkstra_path)}"
    )

    # ----------------------------------------------
    # 13. Final result
    # ----------------------------------------------

    print("\n" + "=" * 60)

    if all(checks.values()):

        print(
            "PASS: A* optimality validation successful."
        )

        print(
            "A* and Dijkstra agree on the minimum path cost."
        )

    else:

        print(
            "FAIL: A* optimality validation requires investigation."
        )

    print("=" * 60)

    if not all(checks.values()):
        raise SystemExit(1)


# ==================================================
# EXECUTION
# ==================================================

if __name__ == "__main__":

    validate_optimality()
