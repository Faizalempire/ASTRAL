
import os
import numpy as np
import rasterio

# ==========================================
# ASTRAL - TRAVERSABILITY MODEL VALIDATION
# ==========================================

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

SLOPE_FILE = os.path.join(
    BASE_DIR, "data", "processed", "jezero_slope.tif"
)

COST_FILE = os.path.join(
    BASE_DIR, "data", "processed", "jezero_traversability.tif"
)

NODATA = -9999.0

CLASSES = [
    ("Gentle", 1.0, 0, 5),
    ("Moderate", 2.0, 5, 15),
    ("Steep", 5.0, 15, 25),
    ("Very steep", 10.0, 25, 35),
    ("Extremely steep", 100.0, 35, float("inf")),
]


def main():

    print("\n" + "=" * 60)
    print("       ASTRAL - TRAVERSABILITY VALIDATION")
    print("=" * 60)

    # 1. Load both rasters
    print("\n[1] LOADING TERRAIN DATA")

    with rasterio.open(SLOPE_FILE) as slope_src:
        slope = slope_src.read(1, masked=True)
        slope_profile = slope_src.profile.copy()

    with rasterio.open(COST_FILE) as cost_src:
        cost = cost_src.read(1)
        cost_profile = cost_src.profile.copy()

    slope_values = slope.data

    slope_valid = (
        ~np.ma.getmaskarray(slope)
        & np.isfinite(slope_values)
        & (slope_values >= 0)
    )

    cost_valid = (
        np.isfinite(cost)
        & (cost != NODATA)
    )

    print("Raster dimensions:", slope_profile["width"], "x",
          slope_profile["height"])
    print("Valid slope pixels:", f"{np.count_nonzero(slope_valid):,}")
    print("Valid cost pixels:", f"{np.count_nonzero(cost_valid):,}")

    # 2. Check raster alignment
    print("\n[2] CHECKING RASTER ALIGNMENT")

    alignment_checks = {
        "Dimensions": (
            slope_profile["width"] == cost_profile["width"]
            and slope_profile["height"] == cost_profile["height"]
        ),
        "CRS": slope_profile["crs"] == cost_profile["crs"],
        "Transform": slope_profile["transform"] == cost_profile["transform"],
    }

    for name, passed in alignment_checks.items():
        print(f"{'PASS' if passed else 'FAIL'}: {name} alignment")

    # 3. Recalculate expected costs independently
    print("\n[3] VERIFYING COST CLASSIFICATION")

    expected = np.full(slope.shape, NODATA, dtype=np.float32)

    expected[slope_valid & (slope_values < 5)] = 1.0
    expected[
        slope_valid & (slope_values >= 5) & (slope_values < 15)
    ] = 2.0
    expected[
        slope_valid & (slope_values >= 15) & (slope_values < 25)
    ] = 5.0
    expected[
        slope_valid & (slope_values >= 25) & (slope_values < 35)
    ] = 10.0
    expected[slope_valid & (slope_values >= 35)] = 100.0

    coverage_match = np.array_equal(slope_valid, cost_valid)

    print(
        f"{'PASS' if coverage_match else 'FAIL'}: "
        "Slope and cost valid-data coverage"
    )

    mismatch_count = np.count_nonzero(
        slope_valid & (cost != expected)
    )

    print(
        f"{'PASS' if mismatch_count == 0 else 'FAIL'}: "
        f"Cost classification ({mismatch_count:,} mismatches)"
    )

    # 4. Check allowed cost values
    print("\n[4] CHECKING COST VALUES")

    allowed_costs = np.array([1.0, 2.0, 5.0, 10.0, 100.0])

    invalid_cost_count = np.count_nonzero(
        cost_valid & ~np.isin(cost, allowed_costs)
    )

    print(
        f"{'PASS' if invalid_cost_count == 0 else 'FAIL'}: "
        f"Only approved cost values are present"
    )

    # 5. Check NoData handling
    print("\n[5] CHECKING MISSING DATA")

    nodata_mismatch = np.count_nonzero(
        (~slope_valid) & (cost != NODATA)
    )

    print(
        f"{'PASS' if nodata_mismatch == 0 else 'FAIL'}: "
        f"NoData pixels are preserved ({nodata_mismatch:,} mismatches)"
    )

    # 6. Terrain class statistics
    print("\n[6] TERRAIN COST DISTRIBUTION")
    print("-" * 60)

    total = np.count_nonzero(cost_valid)

    for name, value, lower, upper in CLASSES:
        mask = cost_valid & (cost == value)
        count = np.count_nonzero(mask)
        percentage = count / total * 100 if total else 0

        print(
            f"{name:16} | Cost: {value:6.1f} | "
            f"Pixels: {count:12,} | {percentage:6.2f}%"
        )

    # 7. Overall validation
    all_checks = (
        all(alignment_checks.values())
        and coverage_match
        and mismatch_count == 0
        and invalid_cost_count == 0
        and nodata_mismatch == 0
        and total > 0
    )

    print("\n" + "=" * 60)

    if all_checks:
        print("PASS: TRAVERSABILITY MODEL VALIDATION SUCCESSFUL")
        print("All cost values match the defined slope thresholds.")
    else:
        print("FAIL: TRAVERSABILITY MODEL VALIDATION")
        print("Review the failed checks before proceeding.")

    print("=" * 60)

    if not all_checks:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
