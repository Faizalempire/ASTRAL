
import numpy as np
import rasterio
from rasterio.windows import Window

# Input and output paths
DEM_PATH = "data/raw/M20_JezeroCrater_CTXDEM_20m.tif"
SLOPE_PATH = "data/processed/jezero_slope.tif"

NODATA = -9999.0
CHUNK_SIZE = 512


def calculate_slope():

    print("\n" + "=" * 55)
    print("       ASTRAL - TERRAIN SLOPE ANALYSIS")
    print("=" * 55)

    total_pixels = 0
    total_sum = 0.0
    minimum_slope = float("inf")
    maximum_slope = float("-inf")

    with rasterio.open(DEM_PATH) as src:

        # Get actual pixel dimensions from the dataset
        pixel_width = abs(src.transform.a)
        pixel_height = abs(src.transform.e)

        profile = src.profile.copy()

        profile.update(
            dtype="float32",
            count=1,
            nodata=NODATA,
            compress="deflate",
            predictor=3,
            tiled=True,
            blockxsize=256,
            blockysize=256
        )

        print("\nProcessing elevation data...")
        print(f"Raster dimensions: {src.width} x {src.height}")
        print(f"Pixel resolution: {pixel_width} m")

        # Create output GeoTIFF
        with rasterio.open(SLOPE_PATH, "w", **profile) as dst:

            for row_start in range(0, src.height, CHUNK_SIZE):

                row_end = min(
                    row_start + CHUNK_SIZE,
                    src.height
                )

                # Read one extra row above and below
                # to calculate gradients at chunk boundaries
                read_start = max(0, row_start - 1)
                read_end = min(src.height, row_end + 1)

                window = Window(
                    0,
                    read_start,
                    src.width,
                    read_end - read_start
                )

                elevation = src.read(
                    1,
                    window=window,
                    masked=True
                )

                # Convert missing measurements to NaN
                z = elevation.filled(np.nan).astype(np.float32)

                # Calculate elevation change per metre
                dz_dy, dz_dx = np.gradient(
                    z,
                    pixel_height,
                    pixel_width
                )

                # Calculate slope angle in degrees
                slope = np.degrees(
                    np.arctan(
                        np.hypot(dz_dx, dz_dy)
                    )
                )

                # Remove the extra rows used for calculation
                crop_start = row_start - read_start
                crop_end = crop_start + (row_end - row_start)

                slope_chunk = slope[crop_start:crop_end, :]

                # Replace invalid values with output NoData
                output = np.where(
                    np.isfinite(slope_chunk),
                    slope_chunk,
                    NODATA
                ).astype(np.float32)

                # Write this chunk to the output raster
                output_window = Window(
                    0,
                    row_start,
                    src.width,
                    row_end - row_start
                )

                dst.write(
                    output,
                    1,
                    window=output_window
                )

                # Collect statistics
                valid = slope_chunk[np.isfinite(slope_chunk)]

                if valid.size > 0:
                    total_pixels += valid.size
                    total_sum += valid.sum(dtype=np.float64)

                    minimum_slope = min(
                        minimum_slope,
                        float(valid.min())
                    )

                    maximum_slope = max(
                        maximum_slope,
                        float(valid.max())
                    )

                print(
                    f"Processed rows: {row_end}/{src.height}"
                )

            dst.set_band_description(
                1,
                "Terrain slope in degrees"
            )

            dst.update_tags(
                units="degrees",
                source="USGS Mars 2020 CTX DEM",
                method="NumPy elevation gradient"
            )

    print("\n" + "=" * 55)
    print("       SLOPE ANALYSIS RESULTS")
    print("=" * 55)

    if total_pixels > 0:
        print(f"Valid slope pixels: {total_pixels:,}")
        print(f"Minimum slope: {minimum_slope:.2f} degrees")
        print(f"Maximum slope: {maximum_slope:.2f} degrees")
        print(f"Mean slope: {total_sum / total_pixels:.2f} degrees")

    print(f"\nOutput saved to: {SLOPE_PATH}")
    print("SLOPE ANALYSIS COMPLETED")


if __name__ == "__main__":
    calculate_slope()
