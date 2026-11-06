
import os
import json
import math

import numpy as np
import rasterio
from PIL import Image
from matplotlib.colors import ListedColormap, BoundaryNorm


# --------------------------------------------------
# ASTRAL - MARS SLOPE OVERLAY
# --------------------------------------------------

INPUT_PATH = "data/processed/jezero_slope.tif"

OUTPUT_PNG = (
    "frontend/public/terrain/jezero_slope_overlay.png"
)

OUTPUT_JSON = (
    "frontend/public/terrain/jezero_slope_bounds.json"
)

# Mars reference values from the source DEM CRS
MARS_RADIUS = 3396190.0
STANDARD_PARALLEL = 18.4663

# Slope classification in degrees
BOUNDARIES = [0, 5, 15, 25, 35, 90]

COLORS = [
    "#163F35",  # Gentle
    "#6B8E45",  # Moderate
    "#D5B84A",  # Steep
    "#D9823B",  # Very steep
    "#B9433F",  # Extremely steep
]


def convert_mars_coordinates(x, y):
    """
    Convert the source Mars equirectangular
    coordinates into longitude and latitude.

    This is a mathematical conversion using
    the Mars sphere radius and standard parallel.
    It does not use an Earth CRS transformation.
    """

    parallel_rad = math.radians(STANDARD_PARALLEL)

    longitude = math.degrees(
        x / (MARS_RADIUS * math.cos(parallel_rad))
    )

    latitude = math.degrees(
        y / MARS_RADIUS
    )

    return longitude, latitude


def create_overlay():

    print("\n")
    print("=" * 55)
    print("       ASTRAL - MARS SLOPE OVERLAY")
    print("=" * 55)

    # Check that the input exists
    if not os.path.exists(INPUT_PATH):
        raise FileNotFoundError(
            f"Slope raster not found: {INPUT_PATH}"
        )

    # Create the output directory
    os.makedirs(
        os.path.dirname(OUTPUT_PNG),
        exist_ok=True
    )

    print("\n[1] SOURCE DATA")
    print("-" * 40)

    with rasterio.open(INPUT_PATH) as dataset:

        print(f"Dimensions: {dataset.width} x {dataset.height}")
        print("Coordinate system: Custom Mars equirectangular")
        print(f"Bounds: {dataset.bounds}")

        # Read the slope raster while preserving NoData pixels
        slope = dataset.read(1, masked=True)

        # Convert raster bounds to Mars longitude/latitude
        bounds = dataset.bounds

        west, south = convert_mars_coordinates(
            bounds.left,
            bounds.bottom
        )

        east, north = convert_mars_coordinates(
            bounds.right,
            bounds.top
        )

        print("\n[2] GEOGRAPHIC BOUNDS")
        print("-" * 40)

        print(f"West longitude:  {west:.6f}°")
        print(f"East longitude:  {east:.6f}°")
        print(f"South latitude:  {south:.6f}°")
        print(f"North latitude:  {north:.6f}°")

        # Create the slope colour map
        print("\n[3] GENERATING TRANSPARENT OVERLAY")
        print("-" * 40)

        colour_map = ListedColormap(COLORS)

        # Make NoData pixels transparent
        colour_map.set_bad(
            color=(0, 0, 0, 0)
        )

        normalisation = BoundaryNorm(
            BOUNDARIES,
            colour_map.N,
            clip=True
        )

        # Convert classified slope values into RGBA pixels
        rgba = colour_map(
            normalisation(slope),
            bytes=True
        )

        # Save the image
        image = Image.fromarray(rgba)

        image.save(
            OUTPUT_PNG,
            optimize=True
        )

        print(f"Overlay saved: {OUTPUT_PNG}")
        print(f"Image dimensions: {image.width} x {image.height}")

        # Store the image bounds and provenance
        metadata = {
            "image": "/terrain/jezero_slope_overlay.png",

            "bounds": [
                [south, west],
                [north, east]
            ],

            "coordinate_system": (
                "Mars equirectangular converted "
                "to longitude and latitude"
            ),

            "mars_radius_metres": MARS_RADIUS,

            "standard_parallel_degrees": STANDARD_PARALLEL,

            "source": "USGS Mars 2020 CTX DEM",

            "derived_layer": "Terrain slope in degrees",

            "source_resolution": "20 metres",

            "classification_degrees": BOUNDARIES,

            "colours": COLORS
        }

        with open(
            OUTPUT_JSON,
            "w",
            encoding="utf-8"
        ) as file:

            json.dump(
                metadata,
                file,
                indent=4
            )

        print(f"Metadata saved: {OUTPUT_JSON}")

    print("\n[4] COMPLETED")
    print("-" * 40)
    print("Mars slope overlay generated successfully.")
    print("Original DEM and slope raster remain unchanged.")
    print("=" * 55)


if __name__ == "__main__":
    create_overlay()
