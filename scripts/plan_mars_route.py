
import os
import csv
import math
import heapq
import networkx as nx
import numpy as np
import rasterio
from rasterio.transform import xy


# ==========================================
# ASTRAL - MARS A* ROUTE PLANNER
# ==========================================

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

INPUT_FILE = os.path.join(
    BASE_DIR,
    "data",
    "processed",
    "jezero_route_cost_400m.tif"
)

OUTPUT_FILE = os.path.join(
    BASE_DIR,
    "data",
    "processed",
    "jezero_test_route.csv"
)

NODATA = -9999.0

# Initial test locations.
# These are grid row/column indices, not geographic coordinates.
START = (10, 10)
GOAL = None


def main():

    print("\n" + "=" * 60)
    print("          ASTRAL - MARS ROUTE PLANNER")
    print("                 A* ALGORITHM")
    print("=" * 60)

    # --------------------------------------
    # 1. Load terrain cost grid
    # --------------------------------------

    print("\n[1] LOADING TERRAIN GRID")

    with rasterio.open(INPUT_FILE) as src:

        terrain = src.read(1)
        transform = src.transform
        height, width = terrain.shape

        print("Grid dimensions:", width, "x", height)
        print("Cell size:", abs(transform.a), "metres (nominal)")

    # Select a test destination near the opposite corner.
    goal = (height - 11, width - 11)

    start = START

    # --------------------------------------
    # 2. Validate start and destination
    # --------------------------------------

    print("\n[2] VALIDATING ROUTE ENDPOINTS")

    for name, point in [("START", start), ("GOAL", goal)]:

        row, col = point

        if not (0 <= row < height and 0 <= col < width):
            raise ValueError(f"{name} is outside the terrain grid.")

        if terrain[row, col] == NODATA:
            raise ValueError(f"{name} lies on NoData terrain.")

        print(
            f"{name}: row={row}, column={col}, "
            f"terrain cost={terrain[row, col]}"
        )

    # --------------------------------------
    # 3. Build weighted terrain graph
    # --------------------------------------

    print("\n[3] BUILDING NETWORKX GRAPH")

    graph = nx.Graph()

    valid = np.isfinite(terrain) & (terrain != NODATA)

    rows, cols = np.where(valid)

    graph.add_nodes_from(zip(rows.tolist(), cols.tolist()))

    print("Valid terrain nodes:", graph.number_of_nodes())

    # Eight possible movement directions.
    directions = [
        (0, 1),
        (1, 0),
        (1, 1),
        (1, -1)
    ]

    for row, col in zip(rows, cols):

        current_cost = float(terrain[row, col])

        for dr, dc in directions:

            nr = row + dr
            nc = col + dc

            if not (0 <= nr < height and 0 <= nc < width):
                continue

            if not valid[nr, nc]:
                continue

            # Prevent diagonal movement through blocked corners.
            if dr != 0 and dc != 0:

                if not valid[row + dr, col]:
                    continue

                if not valid[row, col + dc]:
                    continue

            next_cost = float(terrain[nr, nc])

            # Calculate physical movement distance using
            # the raster's projected coordinate transform.
            dx = transform.a * dc + transform.b * dr
            dy = transform.d * dc + transform.e * dr

            distance = math.hypot(dx, dy)

            # Average terrain penalty along this movement edge.
            movement_cost = distance * (
                current_cost + next_cost
            ) / 2.0

            graph.add_edge(
                (row, col),
                (nr, nc),
                weight=movement_cost
            )

    print("Graph edges:", graph.number_of_edges())

    # --------------------------------------
    # 4. Define A* heuristic
    # --------------------------------------

    print("\n[4] PREPARING A* SEARCH")

    min_cost = float(terrain[valid].min())

    def heuristic(current, destination):

        r1, c1 = current
        r2, c2 = destination

        dx = transform.a * (c2 - c1) + transform.b * (r2 - r1)
        dy = transform.d * (c2 - c1) + transform.e * (r2 - r1)

        straight_distance = math.hypot(dx, dy)

        return straight_distance * min_cost

    # --------------------------------------
    # 5. Calculate route
    # --------------------------------------

    print("\n[5] CALCULATING LOW-COST ROUTE")

    try:

        path = nx.astar_path(
            graph,
            start,
            goal,
            heuristic=heuristic,
            weight="weight"
        )

    except nx.NetworkXNoPath:

        print("No route exists between the selected points.")
        return

    print("Route successfully calculated!")

    # --------------------------------------
    # 6. Calculate route statistics
    # --------------------------------------

    print("\n[6] ANALYSING ROUTE")

    total_distance = 0.0
    total_cost = 0.0

    route_rows = []

    for index, (row, col) in enumerate(path):

        x, y = xy(transform, row, col, offset="center")

        terrain_cost = float(terrain[row, col])

        segment_distance = 0.0
        segment_cost = 0.0

        if index > 0:

            previous_row, previous_col = path[index - 1]

            dr = row - previous_row
            dc = col - previous_col

            dx = transform.a * dc + transform.b * dr
            dy = transform.d * dc + transform.e * dr

            segment_distance = math.hypot(dx, dy)

            previous_cost = float(
                terrain[previous_row, previous_col]
            )

            segment_cost = segment_distance * (
                previous_cost + terrain_cost
            ) / 2.0

            total_distance += segment_distance
            total_cost += segment_cost

        route_rows.append({
            "step": index,
            "row": row,
            "column": col,
            "mars_x_metres": x,
            "mars_y_metres": y,
            "terrain_cost": terrain_cost,
            "segment_distance_metres": segment_distance,
            "segment_cost": segment_cost,
            "cumulative_cost": total_cost
        })

    # --------------------------------------
    # 7. Save route as CSV
    # --------------------------------------

    print("\n[7] SAVING ROUTE")

    with open(OUTPUT_FILE, "w", newline="") as file:

        writer = csv.DictWriter(
            file,
            fieldnames=route_rows[0].keys()
        )

        writer.writeheader()
        writer.writerows(route_rows)

    # --------------------------------------
    # 8. Final report
    # --------------------------------------

    print("\n" + "=" * 60)
    print("              ASTRAL ROUTE REPORT")
    print("=" * 60)

    print("Start:", start)
    print("Destination:", goal)
    print("Path cells:", len(path))
    print(f"Total route distance: {total_distance / 1000:.2f} km")
    print(f"Total weighted movement cost: {total_cost:,.2f}")

    print("Route CSV:", OUTPUT_FILE)

    print("\nA* route planning completed successfully!")


if __name__ == "__main__":
    main()
