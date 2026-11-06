
from pathlib import Path
import math
import csv
import json

import numpy as np
import rasterio
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

# --------------------------------------------------
# ASTRAL - TERRAIN INTELLIGENCE API
# --------------------------------------------------

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data" / "processed"

SLOPE_PATH = DATA_DIR / "jezero_slope.tif"
ELEVATION_PATH = (
    BASE_DIR / "data" / "raw" / "M20_JezeroCrater_CTXDEM_20m.tif"
)
TRAVERSABILITY_PATH = DATA_DIR / "jezero_traversability.tif"

# Precomputed A* route files
ROUTE_CSV_PATH = DATA_DIR / "jezero_test_route.csv"

ROUTE_GEOJSON_PATH = (
    BASE_DIR
    / "frontend"
    / "public"
    / "terrain"
    / "jezero_test_route.geojson"
)

MARS_RADIUS = 3396190.0
STANDARD_PARALLEL = math.radians(18.4663)

# Terrain thresholds are provisional research parameters.
TERRAIN_CLASSES = [
    {"name": "Gentle", "minimum": 0, "maximum": 5, "cost": 1},
    {"name": "Moderate", "minimum": 5, "maximum": 15, "cost": 2},
    {"name": "Steep", "minimum": 15, "maximum": 25, "cost": 5},
    {"name": "Very Steep", "minimum": 25, "maximum": 35, "cost": 10},
    {"name": "Extremely Steep", "minimum": 35, "maximum": None, "cost": 100},
]

app = FastAPI(
    title="ASTRAL Terrain Intelligence API",
    description="Terrain inspection and regional analysis for Jezero Crater on Mars.",
    version="1.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
analysis_cache = None
# Cache the full-region analysis after its first calculation.
# Cache the precomputed A* route.
route_cache = None


def load_astar_route():
    """
    Load the precomputed A* route geometry and statistics.
    The result is cached after the first successful read.
    """

    global route_cache

    if route_cache is not None:
        return route_cache

    if not ROUTE_CSV_PATH.exists():
        raise FileNotFoundError(
            f"Route CSV not found: {ROUTE_CSV_PATH.name}"
        )

    if not ROUTE_GEOJSON_PATH.exists():
        raise FileNotFoundError(
            f"Route GeoJSON not found: {ROUTE_GEOJSON_PATH.name}"
        )

    # Read route geometry.
    with open(ROUTE_GEOJSON_PATH, "r", encoding="utf-8") as file:
        geojson_data = json.load(file)

    features = geojson_data.get("features", [])

    if not features:
        raise ValueError("No route features found in GeoJSON.")

    route_feature = next(
        (
            feature for feature in features
            if feature.get("geometry", {}).get("type") == "LineString"
        ),
        None,
    )

    if route_feature is None:
        raise ValueError("No LineString route found in GeoJSON.")

    coordinates = route_feature["geometry"]["coordinates"]

    if len(coordinates) < 2:
        raise ValueError("Route must contain at least two coordinates.")

    # Read detailed A* route statistics.
    with open(ROUTE_CSV_PATH, "r", encoding="utf-8", newline="") as file:
        reader = csv.DictReader(file)
        route_rows = list(reader)

    if not route_rows:
        raise ValueError("The A* route CSV is empty.")

    final_row = route_rows[-1]

    total_distance_m = sum(
        float(row["segment_distance_metres"])
        for row in route_rows
    )

    total_cost = float(final_row["cumulative_cost"])

    terrain_costs = [
        float(row["terrain_cost"])
        for row in route_rows
    ]

    average_terrain_cost = (
        sum(terrain_costs) / len(terrain_costs)
    )

    route_properties = route_feature.get("properties", {})

    route_cache = {
        "region": "Jezero Crater, Mars",
        "algorithm": "A*",
        "route_type": "Experimental slope-based route",
        "total_distance_metres": round(total_distance_m, 2),
        "total_distance_km": round(total_distance_m / 1000, 2),
        "total_cumulative_cost": round(total_cost, 2),
        "average_terrain_cost": round(average_terrain_cost, 2),
        "point_count": len(coordinates),
        "start_coordinates": coordinates[0],
        "destination_coordinates": coordinates[-1],
        "geometry": route_feature["geometry"],
        "model_note": (
            "This is an experimental route generated using provisional "
            "terrain costs. It is not a validated rover navigation route."
        ),
    }

    return route_cache


def mars_coordinates_to_projected(latitude: float, longitude: float):
    """Convert Mars longitude/latitude to the DEM's projected coordinates."""

    x = (
        MARS_RADIUS
        * math.cos(STANDARD_PARALLEL)
        * math.radians(longitude)
    )
    y = MARS_RADIUS * math.radians(latitude)

    return x, y


def read_raster_value(path: Path, x: float, y: float):
    """Read one raster pixel at the requested projected coordinates."""

    if not path.exists():
        raise FileNotFoundError(f"Dataset not found: {path.name}")

    with rasterio.open(path) as dataset:
        row, col = dataset.index(x, y)

        if not (0 <= row < dataset.height and 0 <= col < dataset.width):
            raise ValueError(f"Location is outside {path.name}")

        value = dataset.read(
            1,
            window=((row, row + 1), (col, col + 1)),
            masked=True,
        )[0, 0]

        if np.ma.is_masked(value):
            raise ValueError(f"No valid data at this location in {path.name}")

        return float(value)


def classify_terrain(slope: float):
    """Classify terrain using ASTRAL's provisional thresholds."""

    if slope < 5:
        return "Gentle", "Low", 1
    elif slope < 15:
        return "Moderate", "Moderate", 2
    elif slope < 25:
        return "Steep", "High", 5
    elif slope < 35:
        return "Very Steep", "Very High", 10
    else:
        return "Extremely Steep", "Very High", 100


def calculate_terrain_analysis():
    """
    Calculate full-DEM elevation, slope and traversability statistics.
    The result is cached after the first successful calculation.
    """

    global analysis_cache

    if analysis_cache is not None:
        return analysis_cache

    required_files = [
        ELEVATION_PATH,
        SLOPE_PATH,
        TRAVERSABILITY_PATH,
    ]

    for path in required_files:
        if not path.exists():
            raise FileNotFoundError(f"Dataset not found: {path.name}")

    # Read elevation data and obtain its pixel resolution.
    with rasterio.open(ELEVATION_PATH) as dataset:
        elevation_data = dataset.read(1, masked=True)
        pixel_width, pixel_height = dataset.res
        pixel_area_km2 = (
            abs(pixel_width * pixel_height) / 1_000_000
        )

    # Read slope data.
    with rasterio.open(SLOPE_PATH) as dataset:
        slope_data = dataset.read(1, masked=True)

    # Read actual traversability-cost data.
    with rasterio.open(TRAVERSABILITY_PATH) as dataset:
        traversability_data = dataset.read(1, masked=True)

    elevation_values = np.ma.compressed(elevation_data).astype(
        np.float64
    )
    slope_values = np.ma.compressed(slope_data).astype(
        np.float64
    )
    cost_values = np.ma.compressed(traversability_data).astype(
        np.float64
    )

    if elevation_values.size == 0 or slope_values.size == 0:
        raise ValueError("No valid elevation or slope data found.")

    # --------------------------------------------------
    # ELEVATION STATISTICS
    # --------------------------------------------------

    elevation_statistics = {
        "minimum_m": round(float(np.min(elevation_values)), 2),
        "maximum_m": round(float(np.max(elevation_values)), 2),
        "mean_m": round(float(np.mean(elevation_values)), 2),
        "standard_deviation_m": round(
            float(np.std(elevation_values)), 2
        ),
        "valid_pixels": int(elevation_values.size),
    }

    # --------------------------------------------------
    # SLOPE STATISTICS
    # --------------------------------------------------

    slope_statistics = {
        "minimum_degrees": round(float(np.min(slope_values)), 2),
        "maximum_degrees": round(float(np.max(slope_values)), 2),
        "mean_degrees": round(float(np.mean(slope_values)), 2),
        "standard_deviation_degrees": round(
            float(np.std(slope_values)), 2
        ),
        "valid_pixels": int(slope_values.size),
    }

    # --------------------------------------------------
    # TERRAIN CLASS DISTRIBUTION
    # --------------------------------------------------

    terrain_distribution = []

    for terrain_class in TERRAIN_CLASSES:
        lower = terrain_class["minimum"]
        upper = terrain_class["maximum"]

        if upper is None:
            class_mask = slope_values >= lower
            slope_range = f"{lower}°+"
        else:
            class_mask = (
                (slope_values >= lower)
                & (slope_values < upper)
            )
            slope_range = f"{lower}°–{upper}°"

        pixel_count = int(np.count_nonzero(class_mask))
        percentage = (
            pixel_count / slope_values.size * 100
        )
        area_km2 = pixel_count * pixel_area_km2

        terrain_distribution.append({
            "terrain_class": terrain_class["name"],
            "slope_range": slope_range,
            "traversability_cost": terrain_class["cost"],
            "pixel_count": pixel_count,
            "percentage": round(percentage, 2),
            "area_km2": round(area_km2, 2),
        })

    # --------------------------------------------------
    # TRAVERSABILITY COST DISTRIBUTION
    # --------------------------------------------------

    cost_distribution = []

    if cost_values.size > 0:
        unique_costs, cost_counts = np.unique(
            cost_values,
            return_counts=True,
        )

        for cost, count in zip(unique_costs, cost_counts):
            cost_distribution.append({
                "cost": round(float(cost), 2),
                "pixel_count": int(count),
                "percentage": round(
                    float(count) / cost_values.size * 100,
                    2,
                ),
            })

    # --------------------------------------------------
    # FINAL ANALYSIS RESPONSE
    # --------------------------------------------------

    analysis_cache = {
        "region": "Jezero Crater, Mars",
        "analysis_scope": "Entire available DEM coverage",
        "dataset": {
            "elevation_source": ELEVATION_PATH.name,
            "slope_source": SLOPE_PATH.name,
            "traversability_source": TRAVERSABILITY_PATH.name,
            "pixel_width_m": round(float(pixel_width), 2),
            "pixel_height_m": round(float(pixel_height), 2),
            "pixel_area_km2": round(pixel_area_km2, 8),
        },
        "elevation": elevation_statistics,
        "slope": slope_statistics,
        "terrain_distribution": terrain_distribution,
        "traversability_distribution": cost_distribution,
        "model_note": (
            "Terrain classes and traversability costs are provisional "
            "research parameters, not validated rover safety limits. "
            "Statistics describe the available DEM coverage, not the "
            "entire Jezero Crater."
        ),
    }

    return analysis_cache


@app.get("/")
def root():
    return {
        "project": "ASTRAL",
        "system": "Terrain Intelligence API",
        "status": "online",
    }


@app.get("/api/health")
def health():
    return {
        "status": "healthy",
        "dem_available": ELEVATION_PATH.exists(),
        "slope_available": SLOPE_PATH.exists(),
        "traversability_available": TRAVERSABILITY_PATH.exists(),
    }


@app.get("/api/terrain")
def inspect_terrain(
    latitude: float = Query(..., ge=-90, le=90),
    longitude: float = Query(..., ge=-180, le=180),
):
    """Inspect elevation, slope and terrain difficulty at a Mars location."""

    x, y = mars_coordinates_to_projected(latitude, longitude)

    try:
        elevation = read_raster_value(ELEVATION_PATH, x, y)
        slope = read_raster_value(SLOPE_PATH, x, y)
        traversability = read_raster_value(
            TRAVERSABILITY_PATH, x, y
        )

        terrain, difficulty, cost = classify_terrain(slope)

        return {
            "location": {
                "latitude": latitude,
                "longitude": longitude,
            },
            "elevation_m": round(elevation, 2),
            "slope_degrees": round(slope, 2),
            "terrain_class": terrain,
            "difficulty": difficulty,
            "traversability_cost": round(traversability, 2),
            "interpretation": (
                f"This location has {terrain.lower()} terrain "
                f"with a slope of {slope:.2f} degrees."
            ),
            "model_note": (
                "Terrain classes and costs are provisional research "
                "parameters, not validated rover safety limits."
            ),
        }

    except FileNotFoundError as error:
        raise HTTPException(status_code=500, detail=str(error))

    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error))

    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error))


@app.get("/api/terrain/analysis")
def terrain_analysis():
    """Return full-region terrain statistics for the available DEM."""

    try:
        return calculate_terrain_analysis()

    except FileNotFoundError as error:
        raise HTTPException(status_code=500, detail=str(error))

    except ValueError as error:
        raise HTTPException(status_code=500, detail=str(error))

    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error))

@app.get("/api/route/astar")
def get_astar_route():
    """Return the precomputed A* route and its statistics."""

    try:
        return load_astar_route()

    except FileNotFoundError as error:
        raise HTTPException(
            status_code=500,
            detail=str(error),
        )

    except ValueError as error:
        raise HTTPException(
            status_code=500,
            detail=str(error),
        )

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=str(error),
        )