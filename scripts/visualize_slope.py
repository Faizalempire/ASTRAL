
import numpy as np
import rasterio
import matplotlib.pyplot as plt
from matplotlib.colors import ListedColormap, BoundaryNorm

SLOPE_PATH = "data/processed/jezero_slope.tif"
OUTPUT_PATH = "data/processed/jezero_slope_map.png"


def visualize_slope():

    print("\nASTRAL - SLOPE MAP VISUALIZATION")
    print("-" * 45)

    with rasterio.open(SLOPE_PATH) as dataset:

        # Read slope values and exclude NoData
        slope = dataset.read(1, masked=True)

        # Create a smaller version for visualization.
        # This keeps memory usage reasonable.
        scale = 4

        display_slope = slope[::scale, ::scale]

        # Define slope categories in degrees
        boundaries = [0, 5, 15, 25, 35, 90]

        labels = [
            "0–5°  | Gentle",
            "5–15° | Moderate",
            "15–25° | Steep",
            "25–35° | Very steep",
            "35°+ | Extremely steep",
        ]

        colors = [
            "#163F35",
            "#6B8E45",
            "#D5B84A",
            "#D9823B",
            "#B9433F",
        ]

        cmap = ListedColormap(colors)
        cmap.set_bad("#111827")

        norm = BoundaryNorm(
            boundaries,
            cmap.N
        )

        # Create the figure
        fig, ax = plt.subplots(
            figsize=(15, 10),
            facecolor="#080D18"
        )

        ax.set_facecolor("#080D18")

        image = ax.imshow(
            display_slope,
            cmap=cmap,
            norm=norm,
            interpolation="nearest"
        )

        # Title and labels
        ax.set_title(
            "ASTRAL | JEZERO CRATER TERRAIN SLOPE",
            fontsize=18,
            color="white",
            fontweight="bold",
            pad=22
        )

        ax.set_xlabel(
            "Raster Column (sampled pixels)",
            color="#CBD5E1",
            fontsize=11
        )

        ax.set_ylabel(
            "Raster Row (sampled pixels)",
            color="#CBD5E1",
            fontsize=11
        )

        ax.tick_params(
            colors="#94A3B8"
        )

        # Legend
        legend_items = []

        for label, color in zip(labels, colors):

            legend_items.append(
                plt.Rectangle(
                    (0, 0),
                    1,
                    1,
                    color=color,
                    label=label
                )
            )

        legend = ax.legend(
            handles=legend_items,
            loc="lower right",
            title="SLOPE CLASSIFICATION",
            facecolor="#111827",
            edgecolor="#334155",
            labelcolor="white",
            fontsize=10
        )

        legend.get_title().set_color("white")

        # Add source information
        fig.text(
            0.5,
            0.025,
            "Source: USGS Mars 2020 CTX DEM | "
            "Resolution: 20 m | "
            "Slope calculated using NumPy",
            ha="center",
            color="#94A3B8",
            fontsize=9
        )

        plt.tight_layout(
            rect=[0, 0.06, 1, 1]
        )

        # Save the visualization
        plt.savefig(
            OUTPUT_PATH,
            dpi=200,
            facecolor=fig.get_facecolor(),
            bbox_inches="tight"
        )

        plt.close(fig)

        print(f"\nMap saved successfully:")
        print(OUTPUT_PATH)

        print("\nVisualization resolution:")
        print(display_slope.shape)

    print("\nSLOPE VISUALIZATION COMPLETED")


if __name__ == "__main__":
    visualize_slope()
