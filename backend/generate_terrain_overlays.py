
from pathlib import Path
import json
import math

import numpy as np
import rasterio
from rasterio.enums import Resampling
from PIL import Image


# ASTRAL - TERRAIN OVERLAY GENERATOR

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data" / "processed"
OUTPUT_DIR = BASE_DIR / "frontend" / "public" / "terrain"

SLOPE_PATH = DATA_DIR / "jezero_slope.tif"
TRAVERSABILITY_PATH = DATA_DIR / "jezero_traversability.tif"

MAX_SIZE = 1800

# Mars equirectangular projection parameters
MARS_RADIUS = 3396190.0
STANDARD_PARALLEL = math.radians(18.4663)


def calculate_geographic_bounds(bounds):
    """Convert projected Mars raster bounds to geographic coordinates."""

    west = (
        bounds.left
        / (MARS_RADIUS * math.cos(STANDARD_PARALLEL))
        * 180 / math.pi
    )

    east = (
        bounds.right
        / (MARS_RADIUS * math.cos(STANDARD_PARALLEL))
        * 180 / math.pi
    )

    south = bounds.bottom / MARS_RADIUS * 180 / math.pi
    north = bounds.top / MARS_RADIUS * 180 / math.pi

    return [
        [south, west],
        [north, east],
    ]


def calculate_output_shape(width, height):
    scale = min(MAX_SIZE / width, MAX_SIZE / height, 1.0)

    output_width = max(1, round(width * scale))
    output_height = max(1, round(height * scale))

    return output_height, output_width


def create_overlay(input_path, output_path, overlay_type):

    print(f"\nProcessing: {input_path.name}")

    with rasterio.open(input_path) as dataset:

        output_height, output_width = calculate_output_shape(
            dataset.width,
            dataset.height,
        )

        # Downsample using Rasterio while respecting NoData masks.
        raster = dataset.read(
            1,
            out_shape=(output_height, output_width),
            masked=True,
            resampling=Resampling.average,
        )

        bounds = dataset.bounds

    data = np.asarray(
        raster.filled(np.nan),
        dtype=np.float32,
    )

    valid = np.isfinite(data)

    if not np.any(valid):
        raise ValueError(f"No valid pixels in {input_path.name}")

    values = data[valid]

    # SLOPE COLOUR SCALE
    if overlay_type == "slope":

        minimum = 0.0
        maximum = 60.0

        stops = [
            (0, (34, 197, 94)),
            (5, (132, 204, 22)),
            (15, (250, 204, 21)),
            (25, (249, 115, 22)),
            (35, (239, 68, 68)),
            (60, (153, 27, 27)),
        ]

        positions = [
            (value - minimum) / (maximum - minimum)
            for value, _ in stops
        ]

    # TRAVERSABILITY COLOUR SCALE
    else:

        minimum = float(np.percentile(values, 2))
        maximum = float(np.percentile(values, 98))

        if maximum <= minimum:
            maximum = minimum + 1.0

        stops = [
            (0.0, (34, 197, 94)),
            (0.25, (132, 204, 22)),
            (0.50, (250, 204, 21)),
            (0.75, (249, 115, 22)),
            (1.0, (239, 68, 68)),
        ]

        positions = [position for position, _ in stops]

    # Replace invalid values before colour interpolation.
    normalized = np.zeros(data.shape, dtype=np.float32)

    normalized[valid] = np.clip(
        (data[valid] - minimum) / (maximum - minimum),
        0,
        1,
    )

    # Create RGBA image.
    rgba = np.zeros((*data.shape, 4), dtype=np.uint8)

    for channel in range(3):

        rgba[..., channel] = np.interp(
            normalized,
            positions,
            [color[channel] for _, color in stops],
        ).astype(np.uint8)

    # Transparent NoData pixels.
    rgba[..., 3] = np.where(valid, 165, 0).astype(np.uint8)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    Image.fromarray(rgba).save(output_path)

    print("Output:", output_path)
    print("Image dimensions:", output_width, "x", output_height)
    print("Valid pixels:", int(np.count_nonzero(valid)))
    print(
        "Value range:",
        round(float(np.min(values)), 2),
        "to",
        round(float(np.max(values)), 2),
    )

    return {
        "image": output_path.name,
        "width": output_width,
        "height": output_height,
        "value_min": round(float(np.min(values)), 4),
        "value_max": round(float(np.max(values)), 4),
        "display_min": minimum,
        "display_max": maximum,
        "valid_pixels": int(np.count_nonzero(valid)),
        "bounds": calculate_geographic_bounds(bounds),
    }


def main():

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    slope_metadata = create_overlay(
        SLOPE_PATH,
        OUTPUT_DIR / "jezero_slope_overlay.png",
        "slope",
    )

    traversability_metadata = create_overlay(
        TRAVERSABILITY_PATH,
        OUTPUT_DIR / "jezero_traversability_overlay.png",
        "traversability",
    )

    # Save exact geographic bounds and image dimensions.
    metadata = {
        "region": "Jezero Crater, Mars",
        "coordinate_system": "Mars Equirectangular",
        "overlays": {
            "slope": slope_metadata,
            "traversability": traversability_metadata,
        },
    }

    metadata_path = OUTPUT_DIR / "jezero_overlay_metadata.json"

    with open(metadata_path, "w", encoding="utf-8") as file:
        json.dump(metadata, file, indent=4)

    print("\n" + "=" * 55)
    print("ASTRAL TERRAIN OVERLAYS GENERATED SUCCESSFULLY")
    print("=" * 55)
    print("Metadata:", metadata_path)


if __name__ == "__main__":
    main()
