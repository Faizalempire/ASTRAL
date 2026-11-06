
from pathlib import Path
import csv
import json

import numpy as np


# ==================================================
# ASTRAL - A* ROUTE VALIDATION
# ==================================================

BASE_DIR = Path(__file__).resolve().parent.parent

CSV_PATH = (
    BASE_DIR
    / "data"
    / "processed"
    / "jezero_test_route.csv"
)

GEOJSON_PATH = (
    BASE_DIR
    / "frontend"
    / "public"
    / "terrain"
    / "jezero_test_route.geojson"
)


# ==================================================
# MARS PROJECTION PARAMETERS
# ==================================================

MARS_RADIUS = 3396190.0
STANDARD_PARALLEL_DEGREES = 18.4663

STANDARD_PARALLEL = np.radians(
    STANDARD_PARALLEL_DEGREES
)


# ==================================================
# LOAD CSV ROUTE
# ==================================================

def load_csv_route():

    if not CSV_PATH.exists():
        raise FileNotFoundError(
            f"CSV route not found: {CSV_PATH}"
        )

    with open(
        CSV_PATH,
        "r",
        newline="",
        encoding="utf-8"
    ) as file:

        return list(csv.DictReader(file))


# ==================================================
# LOAD GEOJSON ROUTE
# ==================================================

def load_geojson_route():

    if not GEOJSON_PATH.exists():
        raise FileNotFoundError(
            f"GeoJSON route not found: {GEOJSON_PATH}"
        )

    with open(
        GEOJSON_PATH,
        "r",
        encoding="utf-8"
    ) as file:

        data = json.load(file)

    features = data.get("features", [])

    if not features:
        raise ValueError(
            "GeoJSON contains no features."
        )

    geometry = features[0].get("geometry", {})

    if geometry.get("type") != "LineString":
        raise ValueError(
            "Expected GeoJSON geometry type: LineString."
        )

    coordinates = geometry.get("coordinates", [])

    if not coordinates:
        raise ValueError(
            "GeoJSON route contains no coordinates."
        )

    return coordinates


# ==================================================
# CONVERT GEOJSON TO MARS PROJECTED COORDINATES
# ==================================================

def convert_geojson_to_mars_coordinates(coordinates):

    """
    Convert geographic longitude/latitude coordinates
    into the custom Mars Equirectangular projection.

    Projection:
        Type: Equidistant Cylindrical (Spherical)
        Mars radius: 3,396,190 metres
        Standard parallel: 18.4663 degrees
        Central meridian: 0 degrees

    GeoJSON input:
        [longitude, latitude]

    Output:
        Projected Mars X and Y coordinates in metres.
    """

    geojson_coordinates = np.asarray(
        coordinates,
        dtype=float
    )

    if (
        geojson_coordinates.ndim != 2
        or geojson_coordinates.shape[1] < 2
    ):
        raise ValueError(
            "Invalid GeoJSON coordinate structure."
        )

    longitude = np.radians(
        geojson_coordinates[:, 0]
    )

    latitude = np.radians(
        geojson_coordinates[:, 1]
    )

    projected_x = (
        MARS_RADIUS
        * longitude
        * np.cos(STANDARD_PARALLEL)
    )

    projected_y = (
        MARS_RADIUS
        * latitude
    )

    return projected_x, projected_y


# ==================================================
# VALIDATE ROUTE
# ==================================================

def validate_route():

    print("\n" + "=" * 55)
    print("       ASTRAL - A* ROUTE VALIDATION")
    print("=" * 55)

    # --------------------------------------------------
    # LOAD DATA
    # --------------------------------------------------

    rows = load_csv_route()

    geojson_coordinates = load_geojson_route()

    if len(rows) < 2:
        raise ValueError(
            "Route must contain at least two points."
        )

    # --------------------------------------------------
    # EXTRACT CSV DATA
    # --------------------------------------------------

    steps = np.array(
        [int(row["step"]) for row in rows]
    )

    terrain_costs = np.array(
        [float(row["terrain_cost"]) for row in rows]
    )

    segment_distances = np.array(
        [float(row["segment_distance_metres"]) for row in rows]
    )

    segment_costs = np.array(
        [float(row["segment_cost"]) for row in rows]
    )

    cumulative_costs = np.array(
        [float(row["cumulative_cost"]) for row in rows]
    )

    mars_x = np.array(
        [float(row["mars_x_metres"]) for row in rows]
    )

    mars_y = np.array(
        [float(row["mars_y_metres"]) for row in rows]
    )

    # --------------------------------------------------
    # BASIC DATA VALIDATION
    # --------------------------------------------------

    sequential_steps_valid = np.array_equal(
        steps,
        np.arange(len(rows))
    )

    point_counts_valid = (
        len(rows) == len(geojson_coordinates)
    )

    first_segment_valid = (
        np.isclose(segment_distances[0], 0.0)
        and np.isclose(segment_costs[0], 0.0)
    )

    distances_nonnegative = np.all(
        segment_distances >= 0
    )

    terrain_costs_positive = np.all(
        terrain_costs > 0
    )

    cumulative_cost_non_decreasing = np.all(
        np.diff(cumulative_costs) >= -0.05
    )

    # --------------------------------------------------
    # COORDINATE SYSTEM CONVERSION
    # --------------------------------------------------

    geojson_x_projected, geojson_y_projected = (
        convert_geojson_to_mars_coordinates(
            geojson_coordinates
        )
    )

    # --------------------------------------------------
    # COORDINATE ALIGNMENT VALIDATION
    # --------------------------------------------------

    coordinate_errors = np.sqrt(
        (mars_x - geojson_x_projected) ** 2
        + (mars_y - geojson_y_projected) ** 2
    )

    maximum_coordinate_error = np.max(
        coordinate_errors
    )

    coordinate_alignment_valid = (
        np.allclose(
            mars_x,
            geojson_x_projected,
            atol=1.0
        )
        and
        np.allclose(
            mars_y,
            geojson_y_projected,
            atol=1.0
        )
    )

    # --------------------------------------------------
    # SEGMENT DISTANCE VALIDATION
    # --------------------------------------------------

    expected_segment_distances = np.sqrt(
        np.diff(mars_x) ** 2
        + np.diff(mars_y) ** 2
    )

    segment_distance_valid = np.allclose(
        segment_distances[1:],
        expected_segment_distances,
        rtol=1e-6,
        atol=0.05
    )

    total_distance = np.sum(
        segment_distances
    )

    # --------------------------------------------------
    # SEGMENT TERRAIN-COST VALIDATION
    # --------------------------------------------------

    expected_segment_costs = (
        segment_distances[1:]
        *
        (
            terrain_costs[:-1]
            + terrain_costs[1:]
        )
        / 2
    )

    segment_cost_formula_valid = np.allclose(
        segment_costs[1:],
        expected_segment_costs,
        rtol=1e-6,
        atol=0.05
    )

    # --------------------------------------------------
    # CUMULATIVE COST VALIDATION
    # --------------------------------------------------

    expected_cumulative_costs = np.cumsum(
        segment_costs
    )

    cumulative_progression_valid = np.allclose(
        cumulative_costs,
        expected_cumulative_costs,
        rtol=1e-6,
        atol=0.05
    )

    total_cumulative_cost = cumulative_costs[-1]

    # --------------------------------------------------
    # VALIDATION CHECKS
    # --------------------------------------------------

    checks = {

        "Sequential route steps":
            sequential_steps_valid,

        "CSV / GeoJSON point counts":
            point_counts_valid,

        "First segment starts at zero":
            first_segment_valid,

        "Non-negative segment distances":
            distances_nonnegative,

        "Positive terrain costs":
            terrain_costs_positive,

        "Non-decreasing cumulative cost":
            cumulative_cost_non_decreasing,

        "Coordinate alignment (within 1 metre)":
            coordinate_alignment_valid,

        "Segment distance consistency":
            segment_distance_valid,

        "Segment terrain-cost formula":
            segment_cost_formula_valid,

        "Running cumulative-cost calculation":
            cumulative_progression_valid,
    }

    # --------------------------------------------------
    # DISPLAY COORDINATE INFORMATION
    # --------------------------------------------------

    print("\nCOORDINATE SYSTEM")
    print("-" * 55)

    print(
        "CSV: Projected Mars coordinates (metres)"
    )

    print(
        "GeoJSON: Geographic coordinates (longitude/latitude)"
    )

    print(
        f"Mars radius: {MARS_RADIUS:,.0f} m"
    )

    print(
        f"Standard parallel: {STANDARD_PARALLEL_DEGREES} degrees"
    )

    # --------------------------------------------------
    # DISPLAY VALIDATION RESULTS
    # --------------------------------------------------

    print("\nVALIDATION CHECKS")
    print("-" * 55)

    for check_name, result in checks.items():

        status = "PASS" if result else "FAIL"

        print(
            f"{status}: {check_name}"
        )

    # --------------------------------------------------
    # ROUTE STATISTICS
    # --------------------------------------------------

    average_terrain_cost = np.mean(
        terrain_costs
    )

    maximum_segment_distance_error = np.max(
        np.abs(
            segment_distances[1:]
            - expected_segment_distances
        )
    )

    maximum_segment_cost_error = np.max(
        np.abs(
            segment_costs[1:]
            - expected_segment_costs
        )
    )

    maximum_cumulative_cost_error = np.max(
        np.abs(
            cumulative_costs
            - expected_cumulative_costs
        )
    )

    print("\nROUTE STATISTICS")
    print("-" * 55)

    print(
        f"CSV route points: {len(rows)}"
    )

    print(
        f"GeoJSON route points: {len(geojson_coordinates)}"
    )

    print(
        f"Total distance: {total_distance:.2f} metres"
    )

    print(
        f"Total distance: {total_distance / 1000:.2f} km"
    )

    print(
        f"Total cumulative cost: {total_cumulative_cost:.2f}"
    )

    print(
        f"Average terrain cost: {average_terrain_cost:.2f}"
    )

    print(
        f"Maximum coordinate error: "
        f"{maximum_coordinate_error:.4f} m"
    )

    print(
        f"Maximum segment distance error: "
        f"{maximum_segment_distance_error:.4f} m"
    )

    print(
        f"Maximum segment cost error: "
        f"{maximum_segment_cost_error:.4f}"
    )

    print(
        f"Maximum cumulative cost error: "
        f"{maximum_cumulative_cost_error:.4f}"
    )

    # --------------------------------------------------
    # FINAL RESULT
    # --------------------------------------------------

    print("\n" + "=" * 55)

    if all(checks.values()):

        print(
            "PASS: All A* route consistency checks passed."
        )

    else:

        print(
            "FAIL: One or more route validation checks failed."
        )

    print("=" * 55)

    if not all(checks.values()):
        raise SystemExit(1)


# ==================================================
# EXECUTION
# ==================================================

if __name__ == "__main__":
    validate_route()
