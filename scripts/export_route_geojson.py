
import os
import csv
import json
import math


# ==========================================
# ASTRAL - ROUTE CSV TO GEOJSON
# ==========================================

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

INPUT_FILE = os.path.join(
    BASE_DIR,
    "data",
    "processed",
    "jezero_test_route.csv"
)

OUTPUT_FILE = os.path.join(
    BASE_DIR,
    "frontend",
    "public",
    "terrain",
    "jezero_test_route.geojson"
)

MARS_RADIUS = 3396190.0
STANDARD_PARALLEL = 18.4663


def mars_to_lonlat(x, y):

    longitude = math.degrees(
        x / (MARS_RADIUS * math.cos(math.radians(STANDARD_PARALLEL)))
    )

    latitude = math.degrees(y / MARS_RADIUS)

    return [longitude, latitude]


def main():

    print("\n" + "=" * 55)
    print("       ASTRAL - ROUTE GEOJSON EXPORT")
    print("=" * 55)

    print("\n[1] READING A* ROUTE")

    coordinates = []
    route_costs = []

    with open(INPUT_FILE, "r", newline="") as file:

        reader = csv.DictReader(file)

        for row in reader:

            x = float(row["mars_x_metres"])
            y = float(row["mars_y_metres"])

            coordinates.append(mars_to_lonlat(x, y))

            route_costs.append(float(row["terrain_cost"]))

    if len(coordinates) < 2:
        raise ValueError("Route must contain at least two points.")

    print("Route points:", len(coordinates))

    print("\n[2] CONVERTING MARS COORDINATES")

    print("First point:", coordinates[0])
    print("Last point:", coordinates[-1])

    print("\n[3] CREATING GEOJSON")

    geojson = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {
                    "name": "ASTRAL A* Test Route",
                    "algorithm": "A*",
                    "point_count": len(coordinates),
                    "average_terrain_cost": (
                        sum(route_costs) / len(route_costs)
                    ),
                    "note": "Experimental slope-based route"
                },
                "geometry": {
                    "type": "LineString",
                    "coordinates": coordinates
                }
            }
        ]
    }

    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)

    with open(OUTPUT_FILE, "w") as file:

        json.dump(geojson, file, indent=2)

    print("\n[4] EXPORT COMPLETE")

    print("Output:", OUTPUT_FILE)
    print("GeoJSON route points:", len(coordinates))

    print("\nRoute GeoJSON generated successfully!")


if __name__ == "__main__":
    main()
