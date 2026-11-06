
import os
import numpy as np
import rasterio

# ==========================================
# ASTRAL - TERRAIN TRAVERSABILITY MODEL
# ==========================================

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

INPUT_FILE = os.path.join(
    BASE_DIR, "data", "processed", "jezero_slope.tif"
)

OUTPUT_FILE = os.path.join(
    BASE_DIR, "data", "processed", "jezero_traversability.tif"
)


def main():

    print("\n" + "=" * 55)
    print("       ASTRAL - TRAVERSABILITY ANALYSIS")
    print("=" * 55)

    # 1. Read slope raster
    print("\n[1] READING SLOPE DATA")

    with rasterio.open(INPUT_FILE) as src:
        slope = src.read(1, masked=True)
        profile = src.profile.copy()

        print("Dimensions:", src.width, "x", src.height)
        print("CRS:", src.crs)
        print("Slope raster loaded successfully.")

    # 2. Identify valid pixels
    print("\n[2] PREPARING TERRAIN DATA")

    slope_values = slope.data

    valid = (
        ~np.ma.getmaskarray(slope)
        & np.isfinite(slope_values)
        & (slope_values >= 0)
    )

    if not np.any(valid):
        raise ValueError("No valid slope pixels found.")

    # 3. Assign relative movement costs
    print("\n[3] CALCULATING TRAVERSABILITY COSTS")

    cost = np.full(
        slope.shape,
        -9999.0,
        dtype=np.float32
    )

    cost[valid & (slope_values < 5)] = 1.0

    cost[
        valid & (slope_values >= 5) & (slope_values < 15)
    ] = 2.0

    cost[
        valid & (slope_values >= 15) & (slope_values < 25)
    ] = 5.0

    cost[
        valid & (slope_values >= 25) & (slope_values < 35)
    ] = 10.0

    cost[
        valid & (slope_values >= 35)
    ] = 100.0

    # 4. Save output raster
    print("\n[4] SAVING COST RASTER")

    profile.update(
        dtype="float32",
        count=1,
        nodata=-9999.0,
        compress="deflate"
    )

    with rasterio.open(OUTPUT_FILE, "w", **profile) as dst:
        dst.write(cost, 1)

        dst.update_tags(
            model="ASTRAL relative terrain traversability model",
            source="Jezero slope raster derived from CTX DEM",
            interpretation="Relative movement penalty, not a safety rating"
        )

    # 5. Display statistics
    print("\n[5] TERRAIN COST SUMMARY")

    classes = [
        ("Gentle", 1),
        ("Moderate", 2),
        ("Steep", 5),
        ("Very steep", 10),
        ("Extremely steep", 100)
    ]

    total = np.count_nonzero(valid)

    for name, value in classes:
        count = np.count_nonzero(cost == value)
        percentage = count / total * 100

        print(
            f"{name:16} | Cost: {value:3} | "
            f"Pixels: {count:12,} | {percentage:6.2f}%"
        )

    print("\nOutput:", OUTPUT_FILE)
    print("Traversability cost map generated successfully!")


if __name__ == "__main__":
    main()
