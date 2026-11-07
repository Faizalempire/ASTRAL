# ASTRAL

### Astronaut Surface Terrain Analysis, Routing & Assessment Layer



ASTRAL is a Mars surface exploration and terrain intelligence platform designed to support preliminary analysis of the Martian landscape. Focused on Jezero Crater, it combines elevation data, terrain slope analysis, traversability modelling, geospatial visualisation and experimental path planning.



## Project Overview



ASTRAL integrates geospatial data processing, terrain analysis and interactive visualisation to support preliminary Martian surface exploration and mission-planning scenarios.



The platform uses a 20-metre-resolution digital elevation model (DEM) associated with the USGS Mars 2020 CTX DEM, as identified in the project's terrain metadata.



## Features



### 1. Mars Explorer

Explore the Martian surface through an interactive map interface and navigate the available region of Jezero Crater.



### 2. Terrain Analysis

Examine elevation, slope and traversability information, including regional statistics and terrain classification.



### 3. Science Explorer

Explore scientific and geological areas of interest through the application's exploratory interface. Displayed sample targets are illustrative unless independently verified against scientific feature datasets.



### 4. Route Planner

Visualise terrain overlays and an experimental A* route.



- Terrain slope overlay

- Traversability overlay

- Independent overlay visibility controls

- Route geometry and start/end markers

- Route distance and terrain-cost information



### 5. Mission Assessment

Review route-related information and terrain conditions to support preliminary mission-planning assessments.



## Technology Stack



| Layer | Technologies |

|---|---|

| Frontend | React, TypeScript, Vite |

| Styling | Tailwind CSS |

| Mapping | Leaflet, React Leaflet |

| Visualisation | Lucide React |

| Backend | Python, FastAPI |

| Geospatial processing | Rasterio, NumPy |

| Image processing | Pillow |

| Route and graph utilities | NetworkX |

| Data formats | GeoTIFF, CSV, GeoJSON, PNG, JSON |



## System Architecture



```text

ASTRAL

|

|-- Frontend

|   |-- React + TypeScript

|   |-- Interactive dashboard

|   |-- Leaflet map visualisation

|   |-- Terrain overlays

|   |-- Mission assessment

|

|-- Backend

|   |-- FastAPI application

|   |-- Coordinate transformation

|   |-- Raster data inspection

|   |-- Regional terrain statistics

|   |-- A* route service

|

|-- Data

|   |-- Raw elevation DEM

|   |-- Processed slope raster

|   |-- Traversability raster

|   |-- Route data

|   |-- Terrain overlay images

|

|-- Scripts

&#x20;   |-- Terrain preprocessing

&#x20;   |-- Route generation

&#x20;   |-- Data validation

```



## Terrain Data

The project uses the USGS Mars 2020 Science Investigation CTX DEM Mosaic covering Jezero Crater.

- Original dataset: `M20_JezeroCrater_CTXDEM_20m.tif`
- Dataset author: Fred Calef
- Publisher: USGS Astrogeology Science Center
- Publication date: 14 October 2021
- Instrument: Mars Reconnaissance Orbiter Context Camera (CTX)
- Spatial resolution: 20 metres per pixel
- Derived products: slope and traversability rasters
- Terrain analysis: elevation statistics, slope statistics and terrain classification
- Visualisation: geospatial terrain overlays

The source mosaic combines the original Mars 2020 Jezero CTX Terrain Relative Navigation DEM with additional crater-wide DEMs produced using the Ames Stereo Pipeline. The dataset is identified as public domain by USGS. Attribution is retained here in accordance with the source record.

**Dataset citation:**

Calef, F. (2021). *Mars 2020 Science Investigation CTX DEM Mosaic* [Dataset]. USGS Astrogeology Science Center.

- [USGS dataset record](https://astrogeology.usgs.gov/search/map/mars_2020_science_investigation_ctx_dem_mosaic)
- [Original DEM download](https://planetarymaps.usgs.gov/mosaic/mars2020_trn/CTX/ScienceInvestigationMaps_JPL/M20_JezeroCrater_CTXDEM_20m.tif)

The terrain classifications and traversability costs are provisional research parameters. They should not be interpreted as validated rover safety limits.

## Experimental A* Route



The current experimental A* implementation produces the following route:



| Metric | Result |

|---|---:|

| Route points | 340 |

| Route distance | 158.13 km |

| Cumulative terrain cost | 336,638.01 |

| Average terrain cost | 2.30 |



The route is an experimental result based on the project's terrain-cost model. It is not a validated rover navigation route.



## API Reference



| Method | Endpoint | Purpose |

|---|---|---|

| GET | `/` | Backend root |

| GET | `/api/health` | Check backend and raster availability |

| GET | `/api/terrain` | Retrieve terrain information for coordinates |

| GET | `/api/terrain/analysis` | Retrieve regional terrain statistics |

| GET | `/api/route/astar` | Retrieve the experimental A* route |



Example terrain request:



`http://127.0.0.1:8000/api/terrain?latitude=18.5&longitude=77.5`



## Installation and Setup



### Prerequisites



- Python

- Node.js and npm

- Git



### 1. Clone the repository



```bash

git clone https://github.com/Faizalempire/ASTRAL.git

cd ASTRAL

```



### 2. Set up the Python environment



```bash

python -m venv .venv

```



Activate it on Windows:



```powershell

.venv\\Scripts\\Activate.ps1

```



Install backend dependencies:



```bash

pip install -r requirements.txt

```



### 3. Start the backend



From the project root:



```bash

python -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000

```



### 4. Start the frontend



Open another terminal:



```bash

cd frontend

npm install

npm run dev

```



### 5. Production build



Run from the frontend directory:



```bash

npm run build

```



## Validation



Run these commands from the project root:



```bash

python backend/validate\_terrain\_data.py

python backend/validate\_astar\_route.py

```



## Repository Structure



```text

ASTRAL/

|

|-- backend/

|-- data/

|   |-- raw/

|   |-- processed/

|

|-- frontend/

|   |-- public/

|   |-- src/

|       |-- components/

|       |-- services/

|

|-- scripts/

|-- requirements.txt

|-- README.md

```



## Limitations and Research Considerations



- Terrain classifications and traversability costs are provisional.

- The experimental A* route is not certified for real rover navigation.

- Science Explorer sample targets require independent scientific verification.

- Terrain statistics describe the available DEM coverage, not necessarily the entire Jezero Crater.

- The original dataset download reference and licence should be verified with the data provider before formal attribution.



## Project



Developed for NASA Space Apps Challenge 2026.



**ASTRAL — Exploring the Martian surface through terrain intelligence.**
