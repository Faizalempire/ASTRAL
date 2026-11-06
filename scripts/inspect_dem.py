
import numpy as np
import rasterio

# ASTRAL: Jezero Crater DEM inspection

DEM_PATH = (
    "data/raw/M20_JezeroCrater_CTXDEM_20m.tif"
)


def inspect_dem():
    print("\n" + "=" * 55)
    print("       ASTRAL - MARS TERRAIN DATA INSPECTOR")
    print("=" * 55)

    # Open the original GeoTIFF
    with rasterio.open(DEM_PATH) as dataset:

        print("\n[1] DATASET INFORMATION")
        print("-" * 35)

        print(f"File: {DEM_PATH}")
        print(f"Width: {dataset.width} pixels")
        print(f"Height: {dataset.height} pixels")
        print(f"Bands: {dataset.count}")
        print(f"Data type: {dataset.dtypes[0]}")
        print(f"CRS: {dataset.crs}")
        print(f"Bounds: {dataset.bounds}")

        # Pixel dimensions from the geotransform
        print("\n[2] SPATIAL RESOLUTION")
        print("-" * 35)

        pixel_width = abs(dataset.transform.a)
        pixel_height = abs(dataset.transform.e)

        print(f"Pixel width: {pixel_width}")
        print(f"Pixel height: {pixel_height}")
        print(f"Band units: {dataset.units}")

        # Read elevation data, masking no-data pixels
        print("\n[3] ELEVATION ANALYSIS")
        print("-" * 35)

        elevation = dataset.read(1, masked=True)

        valid_pixels = elevation.compressed()

        if valid_pixels.size == 0:
            print("No valid elevation measurements found.")
            return

        print(f"Valid pixels: {valid_pixels.size:,}")
        print(f"No-data pixels: {elevation.mask.sum():,}")

        print(f"Minimum elevation: {valid_pixels.min():.2f} m")
        print(f"Maximum elevation: {valid_pixels.max():.2f} m")
        print(f"Mean elevation: {valid_pixels.mean():.2f} m")

        print("\n[4] DATA QUALITY")
        print("-" * 35)

        print(f"No-data value: {dataset.nodata}")
        print(f"Valid data percentage: "
              f"{valid_pixels.size / elevation.size * 100:.2f}%")

    print("\n" + "=" * 55)
    print("       DEM INSPECTION COMPLETED")
    print("=" * 55)


if __name__ == "__main__":
    inspect_dem()
