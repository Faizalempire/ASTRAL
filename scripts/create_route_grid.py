
import os
import math
import numpy as np
import rasterio
from affine import Affine


# ==========================================
# ASTRAL - ROUTE PLANNING GRID GENERATOR
# ==========================================

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

INPUT_FILE = os.path.join(
    BASE_DIR,
    "data",
    "processed",
    "jezero_traversability.tif"
)

OUTPUT_FILE = os.path.join(
    BASE_DIR,
    "data",
    "processed",
    "jezero_route_cost_400m.tif"
)

BLOCK_SIZE = 20
NODATA = -9999.0


def main():

    print("\n" + "=" * 55)
    print("       ASTRAL - ROUTE GRID GENERATOR")
    print("=" * 55)

    # 1. Read source raster
    print("\n[1] READING TRAVERSABILITY DATA")

    with rasterio.open(INPUT_FILE) as src:

        original_width = src.width
        original_height = src.height

        print("Original dimensions:",
              original_width, "x", original_height)

        source = src.read(1, masked=True)
        profile = src.profile.copy()
        original_transform = src.transform

    # 2. Calculate output dimensions
    print("\n[2] PREPARING REDUCED GRID")

    new_width = math.ceil(original_width / BLOCK_SIZE)
    new_height = math.ceil(original_height / BLOCK_SIZE)

    print("Block size:", BLOCK_SIZE, "x", BLOCK_SIZE)
    print("New dimensions:", new_width, "x", new_height)

    # 3. Prepare source data
    print("\n[3] CALCULATING MAXIMUM TERRAIN COST")

    values = source.filled(-np.inf).astype(np.float32)

    # Pad incomplete edge blocks with negative infinity.
    padded_height = new_height * BLOCK_SIZE
    padded_width = new_width * BLOCK_SIZE

    padded = np.full(
        (padded_height, padded_width),
        -np.inf,
        dtype=np.float32
    )

    padded[:original_height, :original_width] = values

    # Group each 20 x 20 block into one planning cell.
    blocks = padded.reshape(
        new_height,
        BLOCK_SIZE,
        new_width,
        BLOCK_SIZE
    )

    # Maximum cost within each block.
    reduced = np.max(blocks, axis=(1, 3))

    # Restore NoData for blocks containing no valid source pixels.
    reduced[~np.isfinite(reduced)] = NODATA

    # 4. Update geospatial metadata
    print("\n[4] UPDATING GRID METADATA")

    new_transform = original_transform * Affine.scale(
        BLOCK_SIZE,
        BLOCK_SIZE
    )

    profile.update(
        width=new_width,
        height=new_height,
        transform=new_transform,
        dtype="float32",
        count=1,
        nodata=NODATA,
        compress="deflate"
    )

    # 5. Save output
    print("\n[5] SAVING ROUTE PLANNING GRID")

    with rasterio.open(OUTPUT_FILE, "w", **profile) as dst:

        dst.write(reduced, 1)

        dst.update_tags(
            model="ASTRAL route planning cost grid",
            source="Jezero traversability raster",
            aggregation="Maximum cost within each 20x20 source block",
            nominal_cell_size_metres="400",
            interpretation="Relative terrain movement penalty"
        )

    # 6. Display statistics
    print("\n[6] GRID SUMMARY")

    valid = reduced[reduced != NODATA]

    print("Output dimensions:", new_width, "x", new_height)
    print("Total planning cells:", reduced.size)
    print("Valid cells:", valid.size)
    print("NoData cells:", reduced.size - valid.size)

    if valid.size > 0:

        print("Minimum cost:", float(valid.min()))
        print("Maximum cost:", float(valid.max()))

        print("\nCost distribution:")

        for value in [1, 2, 5, 10, 100]:

            count = np.count_nonzero(valid == value)
            percentage = count / valid.size * 100

            print(
                f"Cost {value:3}: "
                f"{count:8,} cells ({percentage:6.2f}%)"
            )

    print("\nOutput:", OUTPUT_FILE)
    print("\nRoute planning grid generated successfully!")


if __name__ == "__main__":
    main()
