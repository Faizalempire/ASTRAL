
from pathlib import Path
import numpy as np
import rasterio

BASE_DIR = Path(__file__).resolve().parent.parent

RASTERS = {
    "Elevation": BASE_DIR / "data/raw/M20_JezeroCrater_CTXDEM_20m.tif",
    "Slope": BASE_DIR / "data/processed/jezero_slope.tif",
    "Traversability": BASE_DIR / "data/processed/jezero_traversability.tif",
}


def main():
    datasets = {}

    try:
        # Open all three datasets.
        for name, path in RASTERS.items():
            if not path.exists():
                raise FileNotFoundError(f"Missing file: {path}")

            datasets[name] = rasterio.open(path)

        reference = datasets["Elevation"]

        total_pixels = reference.width * reference.height

        valid_counts = {name: 0 for name in datasets}
        common_valid_pixels = 0
        mismatch_pixels = {name: 0 for name in datasets}

        print("\nTERRAIN DATA COVERAGE VALIDATION")
        print("=" * 55)

        # Process the rasters in small windows to reduce memory usage.
        for _, window in reference.block_windows(1):

            masks = {}

            for name, dataset in datasets.items():
                data = dataset.read(1, window=window, masked=True)

                valid = (
                    ~np.ma.getmaskarray(data)
                    & np.isfinite(np.asarray(data.data))
                )

                masks[name] = valid
                valid_counts[name] += int(np.count_nonzero(valid))

            # Pixels valid in all three datasets.
            common = np.logical_and.reduce(list(masks.values()))

            common_valid_pixels += int(np.count_nonzero(common))

            # Count pixels missing from each dataset while
            # the other two datasets contain valid data.
            for name in datasets:
                other_masks = [
                    mask
                    for other_name, mask in masks.items()
                    if other_name != name
                ]

                other_valid = np.logical_and.reduce(other_masks)

                mismatch_pixels[name] += int(
                    np.count_nonzero(other_valid & ~masks[name])
                )

        print(f"Total raster pixels: {total_pixels:,}")

        print("\nVALID PIXELS")
        print("-" * 55)

        for name, count in valid_counts.items():
            percentage = count / total_pixels * 100

            print(
                f"{name}: {count:,} "
                f"({percentage:.2f}%)"
            )

        print("\nCOMMON VALID COVERAGE")
        print("-" * 55)

        percentage = common_valid_pixels / total_pixels * 100

        print(f"Common valid pixels: {common_valid_pixels:,}")
        print(f"Common coverage: {percentage:.2f}%")

        print("\nMISSING DATA MISMATCHES")
        print("-" * 55)

        for name, count in mismatch_pixels.items():
            print(f"{name}: {count:,}")

        print("\nVALIDATION RESULT")
        print("-" * 55)

        if all(count == 0 for count in mismatch_pixels.values()):
            print("PASS: All three datasets have matching valid coverage.")
        else:
            print("REVIEW: Some datasets have different valid-data coverage.")

    finally:
        for dataset in datasets.values():
            dataset.close()


if __name__ == "__main__":
    main()
