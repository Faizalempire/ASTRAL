
import { useEffect, useState, type FormEvent } from 'react'

import {
  Globe2,
  Mountain,
  FlaskConical,
  Route,
  ClipboardList,
  Activity,
  Satellite,
  Layers3,
  Crosshair,
  Eye,
  EyeOff,
  Navigation,
  MapPin,
  Loader2,
  AlertCircle,
  Gauge,
  MountainSnow,
} from 'lucide-react'

import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Tooltip,
  ImageOverlay,
  GeoJSON as GeoJSONLayer,
  Pane,
  useMap,
  useMapEvents,
} from 'react-leaflet'

import type {
  FeatureCollection,
  LineString,
  Position,
} from 'geojson'

import {
  getTerrainAtLocation,
  type TerrainResponse,
} from './services/terrainService'

import RegionalTerrainAnalysis from './components/RegionalTerrainAnalysis'
import MissionAssessment from './components/MissionAssessment'
import RoutePlanner from './components/RoutePlanner'

import 'leaflet/dist/leaflet.css'

// --------------------------------------------------
// TYPES
// --------------------------------------------------

type Section =
  | 'Mars Explorer'
  | 'Terrain Analysis'
  | 'Science Explorer'
  | 'Route Planner'
  | 'Mission Assessment'

type SlopeMetadata = {
  image: string
  bounds: [[number, number], [number, number]]
  coordinate_system: string
  source: string
  derived_layer: string
  source_resolution: string
  classification_degrees: number[]
  colours: string[]
}

type RouteProperties = {
  name: string
  algorithm: string
  point_count: number
  average_terrain_cost: number
  note: string
}

type RouteGeoJSON = FeatureCollection<LineString, RouteProperties>

type ScienceExplorerProps = {
  onTerrainInspect: (coordinates: [number, number]) => void
  terrainResult: TerrainResponse | null
  terrainLoading: boolean
  terrainError: string | null
}

// --------------------------------------------------
// NAVIGATION
// --------------------------------------------------

const navigation = [
  { label: 'Mars Explorer', icon: Globe2 },
  { label: 'Terrain Analysis', icon: Mountain },
  { label: 'Science Explorer', icon: FlaskConical },
  { label: 'Route Planner', icon: Route },
  { label: 'Mission Assessment', icon: ClipboardList },
] as const

const descriptions: Record<Section, string> = {
  'Mars Explorer': 'Explore the Martian surface and identify regions of interest.',
  'Terrain Analysis': 'Analyse elevation, slope and surface conditions.',
  'Science Explorer': 'Investigate geological features and scientific targets.',
  'Route Planner': 'Explore potential paths across the Martian landscape.',
  'Mission Assessment': 'Review mission distance, terrain and planning assumptions.',
}

const JEZERO: [number, number] = [18.4, 77.4]

const slopeLegend = [
  { label: 'Gentle', range: '0–5°', colour: '#163F35' },
  { label: 'Moderate', range: '5–15°', colour: '#6B8E45' },
  { label: 'Steep', range: '15–25°', colour: '#D5B84A' },
  { label: 'Very steep', range: '25–35°', colour: '#D9823B' },
  { label: 'Extremely steep', range: '35°+', colour: '#B9433F' },
]

// --------------------------------------------------
// MAP COORDINATE TRACKER
// --------------------------------------------------

function CoordinateTracker({
  onCoordinatesChange,
  onMapClick,
}: {
  onCoordinatesChange: (coordinates: [number, number]) => void
  onMapClick: (coordinates: [number, number]) => void
}) {
  useMapEvents({
    mousemove(event) {
      onCoordinatesChange([
        event.latlng.lat,
        event.latlng.lng,
      ])
    },

    click(event) {
      const clickedCoordinates: [number, number] = [
        event.latlng.lat,
        event.latlng.lng,
      ]

      onCoordinatesChange(clickedCoordinates)
      onMapClick(clickedCoordinates)
    },
  })

  return null
}

// --------------------------------------------------
// ROUTE BOUNDS CONTROLLER
// --------------------------------------------------

function RouteBoundsController({
  coordinates,
}: {
  coordinates: Position[]
}) {
  const map = useMap()

  useEffect(() => {
    if (coordinates.length < 2) return

    const bounds = coordinates.map((position) => [
      position[1],
      position[0],
    ] as [number, number])

    map.fitBounds(bounds, {
      padding: [45, 45],
      maxZoom: 5,
    })
  }, [map, coordinates])

  return null
}

// --------------------------------------------------
// MAP NAVIGATION CONTROLLER
// --------------------------------------------------

function MapFlyTo({
  coordinates,
}: {
  coordinates: [number, number] | null
}) {
  const map = useMap()

  useEffect(() => {
    if (!coordinates) return

    map.flyTo(coordinates, 7, {
      duration: 1.2,
    })
  }, [map, coordinates])

  return null
}

// --------------------------------------------------
// MARS MAP
// --------------------------------------------------

function MarsMap({
  onTerrainInspect,
}: {
  onTerrainInspect: (coordinates: [number, number]) => void
}) {
  const [showSlope, setShowSlope] = useState(true)
  const [showRoute, setShowRoute] = useState(true)

  const [coordinates, setCoordinates] =
    useState<[number, number]>(JEZERO)

  const [latitudeInput, setLatitudeInput] = useState('')
  const [longitudeInput, setLongitudeInput] = useState('')

  const [selectedCoordinates, setSelectedCoordinates] =
    useState<[number, number] | null>(null)

  const [searchCoordinates, setSearchCoordinates] =
    useState<[number, number] | null>(null)

  const [coordinateError, setCoordinateError] =
    useState<string | null>(null)

  const [slopeMetadata, setSlopeMetadata] =
    useState<SlopeMetadata | null>(null)

  const [routeData, setRouteData] =
    useState<RouteGeoJSON | null>(null)

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [routeLoading, setRouteLoading] = useState(true)
  const [routeError, setRouteError] = useState<string | null>(null)

  // LOAD SLOPE METADATA

  useEffect(() => {
    let cancelled = false

    async function loadSlopeMetadata() {
      try {
        setLoading(true)
        setLoadError(null)

        const response = await fetch(
          '/terrain/jezero_slope_bounds.json'
        )

        if (!response.ok) {
          throw new Error(
            `Metadata request failed: ${response.status}`
          )
        }

        const metadata: SlopeMetadata = await response.json()

        if (
          !metadata.bounds ||
          metadata.bounds.length !== 2 ||
          !metadata.image
        ) {
          throw new Error('Invalid terrain metadata.')
        }

        if (!cancelled) {
          setSlopeMetadata(metadata)
          setLoading(false)
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(
            error instanceof Error
              ? error.message
              : 'Unable to load terrain metadata.'
          )

          setLoading(false)
        }
      }
    }

    loadSlopeMetadata()

    return () => {
      cancelled = true
    }
  }, [])

  // LOAD A* ROUTE GEOJSON

  useEffect(() => {
    let cancelled = false

    async function loadRoute() {
      try {
        setRouteLoading(true)
        setRouteError(null)

        const response = await fetch(
          '/terrain/jezero_test_route.geojson'
        )

        if (!response.ok) {
          throw new Error(
            `Route request failed: ${response.status}`
          )
        }

        const data: RouteGeoJSON = await response.json()

        if (
          data.type !== 'FeatureCollection' ||
          !data.features ||
          data.features.length === 0 ||
          data.features[0].geometry.type !== 'LineString' ||
          data.features[0].geometry.coordinates.length < 2
        ) {
          throw new Error('Invalid A* route GeoJSON.')
        }

        if (!cancelled) {
          setRouteData(data)
          setRouteLoading(false)
        }
      } catch (error) {
        if (!cancelled) {
          setRouteError(
            error instanceof Error
              ? error.message
              : 'Unable to load A* route.'
          )

          setRouteLoading(false)
        }
      }
    }

    loadRoute()

    return () => {
      cancelled = true
    }
  }, [])

  // COORDINATE SEARCH HANDLER

  function handleCoordinateSearch(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()

    const latitude = Number(latitudeInput)
    const longitude = Number(longitudeInput)

    if (
      latitudeInput.trim() === '' ||
      longitudeInput.trim() === '' ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      setCoordinateError(
        'Enter valid latitude and longitude values.'
      )
      return
    }

    if (
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      setCoordinateError(
        'Latitude must be between -90 and 90, and longitude between -180 and 180.'
      )
      return
    }

    const target: [number, number] = [
      latitude,
      longitude,
    ]

    setCoordinateError(null)
    setSelectedCoordinates(target)
    setSearchCoordinates(target)
    setCoordinates(target)

    onTerrainInspect(target)
  }

  // ROUTE DATA

  const routeFeature = routeData?.features[0]

  const routeCoordinates: Position[] =
    routeFeature?.geometry.coordinates ?? []

  const start = routeCoordinates.length > 0
    ? routeCoordinates[0] as [number, number]
    : null

  const destination = routeCoordinates.length > 0
    ? routeCoordinates[routeCoordinates.length - 1] as [number, number]
    : null

  // MAP RENDER

  return (
    <div className="relative h-[520px] w-full bg-[#111B2B]">

      <MapContainer
        center={JEZERO}
        zoom={5}
        minZoom={2}
        maxZoom={10}
        scrollWheelZoom={true}
        className="h-full w-full"
      >

        <MapFlyTo coordinates={searchCoordinates} />

        <TileLayer
          attribution='Map tiles: <a href="https://openplanetarymap.org/">OpenPlanetaryMap</a>'
          url="https://cartocdn-gusc.global.ssl.fastly.net/opmbuilder/api/v1/map/named/opm-mars-basemap-v0-2/all/{z}/{x}/{y}.png"
        />

        {/* SLOPE OVERLAY */}
        {showSlope && slopeMetadata && (
          <ImageOverlay
            url={slopeMetadata.image}
            bounds={slopeMetadata.bounds}
            opacity={0.78}
            zIndex={500}
          />
        )}

        {/* A* ROUTE */}
        {showRoute && routeData && start && destination && (
          <>
            <RouteBoundsController
              coordinates={routeCoordinates}
            />

            <Pane name="routePane" style={{ zIndex: 650 }}>

              <GeoJSONLayer
                data={routeData}
                style={() => ({
                  color: '#22D3EE',
                  weight: 4,
                  opacity: 0.95,
                  dashArray: '8 7',
                  lineCap: 'round',
                  lineJoin: 'round',
                })}
              />

              <CircleMarker
                center={[start[1], start[0]]}
                radius={8}
                pathOptions={{
                  color: '#86EFAC',
                  fillColor: '#16A34A',
                  fillOpacity: 1,
                  weight: 3,
                }}
              >
                <Tooltip permanent direction="top">
                  A* Start
                </Tooltip>
              </CircleMarker>

              <CircleMarker
                center={[destination[1], destination[0]]}
                radius={8}
                pathOptions={{
                  color: '#FCA5A5',
                  fillColor: '#DC2626',
                  fillOpacity: 1,
                  weight: 3,
                }}
              >
                <Tooltip permanent direction="top">
                  A* Destination
                </Tooltip>
              </CircleMarker>

            </Pane>
          </>
        )}

        {/* JEZERO MARKER */}
        <CircleMarker
          center={JEZERO}
          radius={9}
          pathOptions={{
            color: '#FDBA74',
            fillColor: '#EA5800',
            fillOpacity: 0.9,
            weight: 2,
          }}
        >
          <Tooltip permanent direction="top" offset={[0, -10]}>
            Jezero Crater
          </Tooltip>
        </CircleMarker>

        {/* SELECTED LOCATION */}
        {selectedCoordinates && (
          <CircleMarker
            center={selectedCoordinates}
            radius={10}
            pathOptions={{
              color: '#FFFFFF',
              fillColor: '#06B6D4',
              fillOpacity: 1,
              weight: 3,
            }}
          >
            <Tooltip permanent direction="top">
              Selected Location
            </Tooltip>
          </CircleMarker>
        )}

        <CoordinateTracker
          onCoordinatesChange={setCoordinates}
          onMapClick={(target) => {
            setSelectedCoordinates(target)
            setCoordinateError(null)
            onTerrainInspect(target)
          }}
        />

      </MapContainer>

      {/* COORDINATE SEARCH */}
      <form
        onSubmit={handleCoordinateSearch}
        className="absolute left-1/2 top-4 z-[1100] w-[min(440px,calc(100%-180px))] -translate-x-1/2 rounded-xl border border-cyan-500/20 bg-[#080D18]/95 p-3 shadow-xl backdrop-blur-md"
      >

        <div className="mb-2 flex items-center gap-2">

          <Crosshair size={14} className="text-cyan-400" />

          <p className="text-[9px] tracking-widest text-cyan-300">
            COORDINATE NAVIGATION
          </p>

        </div>

        <div className="flex gap-2">

          <input
            type="number"
            step="any"
            value={latitudeInput}
            onChange={(event) =>
              setLatitudeInput(event.target.value)
            }
            placeholder="Latitude"
            aria-label="Latitude"
            className="min-w-0 w-1/2 rounded-lg border border-white/10 bg-[#111B2B] px-3 py-2 text-xs text-white outline-none focus:border-cyan-500/50"
          />

          <input
            type="number"
            step="any"
            value={longitudeInput}
            onChange={(event) =>
              setLongitudeInput(event.target.value)
            }
            placeholder="Longitude"
            aria-label="Longitude"
            className="min-w-0 w-1/2 rounded-lg border border-white/10 bg-[#111B2B] px-3 py-2 text-xs text-white outline-none focus:border-cyan-500/50"
          />

          <button
            type="submit"
            className="flex shrink-0 items-center gap-1 rounded-lg bg-cyan-500 px-3 py-2 text-xs font-semibold text-[#080D18] transition hover:bg-cyan-400"
          >
            <Navigation size={13} />
            Locate
          </button>

        </div>

        {coordinateError && (
          <p className="mt-2 text-[10px] text-red-400">
            {coordinateError}
          </p>
        )}

        <p className="mt-2 text-[9px] text-slate-500">
          Enter decimal-degree coordinates to locate a Martian surface point.
        </p>

      </form>

      {/* SURFACE COORDINATES */}
      <div className="pointer-events-none absolute top-16 left-4 z-[1000] rounded-lg border border-cyan-500/20 bg-[#080D18]/95 px-4 py-3 shadow-lg backdrop-blur-md">

        <p className="text-[9px] tracking-widest text-slate-500">
          SURFACE COORDINATES
        </p>

        <p className="mt-1 font-mono text-xs text-cyan-300">
          {Math.abs(coordinates[0]).toFixed(4)}° {coordinates[0] >= 0 ? 'N' : 'S'}
          {' / '}
          {Math.abs(coordinates[1]).toFixed(4)}° {coordinates[1] >= 0 ? 'E' : 'W'}
        </p>

        <p className="mt-1 text-[9px] text-slate-500">
          Move cursor over map
        </p>

      </div>

      {/* REGION LABEL */}
      <div className="absolute top-4 left-4 z-[1000] flex items-center gap-2 rounded-lg border border-white/10 bg-[#080D18]/90 px-3 py-2">

        <Crosshair size={14} className="text-orange-400" />

        <span className="text-[10px] tracking-wider text-slate-300">
          JEZERO REGION
        </span>

      </div>

      {/* LAYER CONTROLS */}
      <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">

        <button
          onClick={() => setShowSlope((current) => !current)}
          disabled={!slopeMetadata}
          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs backdrop-blur-md transition-all ${showSlope
            ? 'border-orange-500/40 bg-[#080D18]/95 text-orange-300'
            : 'border-white/10 bg-[#080D18]/90 text-slate-300'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {showSlope ? <Eye size={14} /> : <EyeOff size={14} />}
          {showSlope ? 'Slope ON' : 'Slope OFF'}
        </button>

        <button
          onClick={() => setShowRoute((current) => !current)}
          disabled={!routeData}
          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs backdrop-blur-md transition-all ${showRoute
            ? 'border-cyan-500/40 bg-[#080D18]/95 text-cyan-300'
            : 'border-white/10 bg-[#080D18]/90 text-slate-300'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {showRoute ? <Eye size={14} /> : <EyeOff size={14} />}
          {showRoute ? 'A* Route ON' : 'A* Route OFF'}
        </button>

      </div>

      {/* SLOPE LEGEND */}
      {showSlope && slopeMetadata && (
        <div className="absolute bottom-4 left-4 z-[1000] w-48 rounded-lg border border-white/10 bg-[#080D18]/95 p-3 backdrop-blur-md">

          <p className="mb-3 text-[9px] tracking-widest text-slate-400">
            TERRAIN SLOPE
          </p>

          <div className="space-y-2">

            {slopeLegend.map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between gap-3"
              >

                <div className="flex items-center gap-2">

                  <span
                    className="h-3 w-3 rounded-sm"
                    style={{ backgroundColor: item.colour }}
                  />

                  <span className="text-[10px] text-slate-300">
                    {item.label}
                  </span>

                </div>

                <span className="font-mono text-[10px] text-slate-500">
                  {item.range}
                </span>

              </div>
            ))}

          </div>

          <p className="mt-3 border-t border-white/10 pt-2 text-[9px] text-slate-500">
            Slope angle · Degrees
          </p>

        </div>
      )}

      {/* ROUTE INFORMATION */}
      {showRoute && routeData && routeFeature && (
        <div className="absolute bottom-4 right-4 z-[1000] w-52 rounded-lg border border-cyan-500/20 bg-[#080D18]/95 p-3 backdrop-blur-md">

          <div className="mb-3 flex items-center gap-2">

            <Navigation size={14} className="text-cyan-400" />

            <p className="text-[9px] tracking-widest text-cyan-300">
              A* ROUTE COMPUTED
            </p>

          </div>

          <div className="grid grid-cols-2 gap-3">

            <div>
              <p className="text-[9px] text-slate-500">
                DISTANCE
              </p>

              <p className="mt-1 text-lg font-semibold text-white">
                158.13 <span className="text-xs text-slate-400">km</span>
              </p>
            </div>

            <div>
              <p className="text-[9px] text-slate-500">
                WAYPOINTS
              </p>

              <p className="mt-1 text-lg font-semibold text-white">
                {routeFeature.properties.point_count}
              </p>
            </div>

          </div>

          <div className="mt-3 flex items-center gap-2 border-t border-white/10 pt-3">

            <span className="h-[3px] w-5 rounded bg-cyan-400" />

            <span className="text-[9px] text-slate-400">
              Experimental slope-based route
            </span>

          </div>

        </div>
      )}

      {/* SLOPE LOADING / ERROR */}
      {loading && (
        <div className="absolute right-4 top-16 z-[1000] rounded-lg border border-white/10 bg-[#080D18]/95 px-3 py-2">

          <p className="text-[10px] text-cyan-300">
            Loading terrain metadata...
          </p>

        </div>
      )}

      {loadError && (
        <div className="absolute right-4 top-16 z-[1000] max-w-64 rounded-lg border border-red-500/30 bg-[#080D18]/95 px-3 py-2">

          <p className="text-[10px] text-red-300">
            Terrain layer unavailable
          </p>

          <p className="mt-1 text-[9px] text-slate-400">
            {loadError}
          </p>

        </div>
      )}

      {/* ROUTE LOADING / ERROR */}
      {routeLoading && (
        <div className="absolute right-4 top-28 z-[1000] rounded-lg border border-white/10 bg-[#080D18]/95 px-3 py-2">

          <p className="text-[10px] text-cyan-300">
            Loading A* route...
          </p>

        </div>
      )}

      {routeError && (
        <div className="absolute right-4 top-28 z-[1000] max-w-64 rounded-lg border border-red-500/30 bg-[#080D18]/95 px-3 py-2">

          <p className="text-[10px] text-red-300">
            A* route unavailable
          </p>

          <p className="mt-1 text-[9px] text-slate-400">
            {routeError}
          </p>

        </div>
      )}

    </div>
  )
}

// --------------------------------------------------
// TERRAIN DIFFICULTY COLOUR
// --------------------------------------------------

function getDifficultyColour(difficulty: string) {
  switch (difficulty.toLowerCase()) {
    case 'low':
      return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'

    case 'moderate':
      return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20'

    case 'high':
      return 'text-orange-400 bg-orange-500/10 border-orange-500/20'

    case 'very high':
      return 'text-red-400 bg-red-500/10 border-red-500/20'

    default:
      return 'text-slate-300 bg-white/5 border-white/10'
  }
}

// --------------------------------------------------
// SCIENCE EXPLORER
// --------------------------------------------------

const scienceTargets = [
  {
    number: '01',
    title: 'Western Delta Deposits',
    category: 'SEDIMENTARY ENVIRONMENT',
    description:
      'Ancient delta deposits preserve sediments transported by flowing water into the former Jezero lake.',
    question:
      'What do layered sediments reveal about ancient water activity and environmental conditions?',
    objective: 'Sediment and depositional history',
    icon: Layers3,
    colour: 'cyan',
    research:
      'Investigate sedimentary structures, depositional environments and evidence of ancient fluvial activity.',
    coordinates: [18.35, 77.55] as [number, number],
  },
  {
    number: '02',
    title: 'Crater Floor',
    category: 'ANCIENT BASIN ENVIRONMENT',
    description:
      'The crater floor provides geological context for the basin history and the processes that shaped its surface.',
    question:
      'What do the rocks and surface materials reveal about the evolution of the ancient crater environment?',
    objective: 'Surface geology and crater history',
    icon: Mountain,
    colour: 'orange',
    research:
      'Examine surface morphology, elevation and slope to understand the geological context of the crater floor.',
    coordinates: [18.4, 77.4] as [number, number],
  },
  {
    number: '03',
    title: 'Carbonate-Bearing Margin',
    category: 'MINERALOGICAL ENVIRONMENT',
    description:
      'Carbonate-bearing rocks around parts of Jezero provide important clues about past water–rock interactions.',
    question:
      'What can carbonate minerals tell us about ancient aqueous environments and habitability?',
    objective: 'Mineralogy and water–rock interaction',
    icon: Activity,
    colour: 'emerald',
    research:
      'Investigate the geological significance of carbonate-bearing materials and their potential records of ancient aqueous environments.',
    coordinates: [17.646990093685726, 78.50928325000798] as [number, number],
  },
]

const scienceColourClasses: Record<string, string> = {
  cyan: 'text-cyan-400 border-cyan-500/30',
  orange: 'text-orange-400 border-orange-500/30',
  emerald: 'text-emerald-400 border-emerald-500/30',
}

function ScienceExplorer({
  onTerrainInspect,
  terrainResult,
  terrainLoading,
  terrainError,
}: ScienceExplorerProps) {
  const [selectedTarget, setSelectedTarget] = useState('01')

  const [latitude, setLatitude] = useState(
    scienceTargets[0].coordinates[0].toString()
  )

  const [longitude, setLongitude] = useState(
    scienceTargets[0].coordinates[1].toString()
  )

  const [coordinateError, setCoordinateError] =
    useState<string | null>(null)

  const selectedResearchTarget = scienceTargets.find(
    (target) => target.number === selectedTarget
  )!
  const resultMatchesCoordinates =
    terrainResult !== null &&
    Math.abs(
      terrainResult.location.latitude - Number(latitude)
    ) < 0.000001 &&
    Math.abs(
      terrainResult.location.longitude - Number(longitude)
    ) < 0.000001

  const objectives = [
    {
      title: 'Identify sedimentary structures',
      description:
        'Investigate deposits that may preserve evidence of ancient fluvial and lacustrine processes.',
    },
    {
      title: 'Characterise surface materials',
      description:
        'Examine terrain and geological context to understand the region’s formation.',
    },
    {
      title: 'Investigate mineral signatures',
      description:
        'Study minerals that may record past interactions between water and Martian rocks.',
    },
    {
      title: 'Assess potential biosignature preservation',
      description:
        'Identify environments that could potentially preserve evidence of ancient microbial activity.',
    },
  ]

  function handleScienceInspection(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()

    const lat = Number(latitude)
    const lon = Number(longitude)

    if (
      latitude.trim() === '' ||
      longitude.trim() === '' ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lon)
    ) {
      setCoordinateError(
        'Enter valid latitude and longitude coordinates.'
      )
      return
    }

    if (
      lat < -90 ||
      lat > 90 ||
      lon < -180 ||
      lon > 180
    ) {
      setCoordinateError(
        'Latitude must be between -90 and 90 and longitude between -180 and 180.'
      )
      return
    }

    setCoordinateError(null)
    onTerrainInspect([lat, lon])
  }

  return (
    <div className="space-y-6">

      {/* SCIENCE OVERVIEW */}
      <section className="rounded-2xl border border-white/10 bg-[#0D1727] p-6 md:p-8">

        <div className="flex flex-wrap items-start justify-between gap-5">

          <div className="max-w-2xl">

            <div className="flex items-center gap-2 text-xs tracking-[0.2em] text-orange-400">
              <FlaskConical size={15} />
              SCIENTIFIC TARGET CATALOGUE
            </div>

            <h3 className="mt-4 text-2xl font-semibold md:text-3xl">
              Explore Jezero Crater
            </h3>

            <p className="mt-3 text-sm leading-7 text-slate-400">
              Investigate geological environments that can help
              scientists understand the history of water,
              sediment deposition and potential past habitability
              on Mars.
            </p>

          </div>

          <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 px-4 py-3">

            <p className="text-[10px] tracking-widest text-slate-500">
              STUDY REGION
            </p>

            <p className="mt-1 text-sm font-semibold text-orange-400">
              Jezero Crater
            </p>

            <p className="mt-1 text-xs text-slate-500">
              Mars · Planetary Science
            </p>

          </div>

        </div>

        <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-3">

          {[
            {
              label: 'RESEARCH FOCUS',
              value: 'Geological Features',
              icon: Layers3,
              colour: 'text-cyan-400',
            },
            {
              label: 'STUDY ENVIRONMENT',
              value: 'Ancient Lake Basin',
              icon: Mountain,
              colour: 'text-orange-400',
            },
            {
              label: 'MISSION OBJECTIVE',
              value: 'Past Habitability',
              icon: Activity,
              colour: 'text-emerald-400',
            },
          ].map((item) => {
            const Icon = item.icon

            return (
              <div
                key={item.label}
                className="rounded-xl border border-white/5 bg-[#111E30] p-4"
              >

                <Icon
                  size={20}
                  className={`${item.colour} mb-3`}
                />

                <p className="text-xs text-slate-500">
                  {item.label}
                </p>

                <p className="mt-1 text-sm font-medium">
                  {item.value}
                </p>

              </div>
            )
          })}

        </div>

      </section>

      {/* GEOLOGICAL TARGETS */}
      <section>

        <div className="mb-4">

          <p className="text-[10px] tracking-[0.2em] text-orange-400">
            GEOLOGICAL INVESTIGATION
          </p>

          <h3 className="mt-2 text-xl font-semibold">
            Scientific Target Regions
          </h3>

          <p className="mt-1 text-xs text-slate-500">
            Select a geological environment to explore its research priorities.
          </p>

        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">

          {scienceTargets.map((target) => {
            const Icon = target.icon
            const colourClass =
              scienceColourClasses[target.colour]

            const isSelected = selectedTarget === target.number

            return (
              <button
                key={target.number}
                type="button"
                onClick={() => {
                  setSelectedTarget(target.number)

                  setLatitude(target.coordinates[0].toString())
                  setLongitude(target.coordinates[1].toString())

                  setCoordinateError(null)
                }}
                aria-pressed={isSelected}
                className={`rounded-2xl border p-5 text-left transition-all ${isSelected
                  ? 'border-orange-500/50 bg-orange-500/[0.07] shadow-lg shadow-orange-950/10'
                  : 'border-white/10 bg-[#0D1727] hover:border-white/25'
                  }`}
              >

                <div className="flex items-center justify-between">

                  <span
                    className={`text-[10px] tracking-widest ${colourClass.split(' ')[0]}`}
                  >
                    TARGET {target.number}
                  </span>

                  <div className="flex items-center gap-2">

                    {isSelected && (
                      <span className="text-[9px] text-orange-400">
                        SELECTED
                      </span>
                    )}

                    <Icon
                      size={20}
                      className={colourClass.split(' ')[0]}
                    />

                  </div>

                </div>

                <h4 className="mt-5 text-lg font-semibold">
                  {target.title}
                </h4>

                <p className="mt-2 text-[9px] tracking-widest text-slate-500">
                  {target.category}
                </p>

                <p className="mt-4 text-sm leading-6 text-slate-400">
                  {target.description}
                </p>

                <div className="mt-5 border-t border-white/10 pt-4">

                  <p className="text-[10px] tracking-widest text-orange-400">
                    SCIENTIFIC QUESTION
                  </p>

                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    {target.question}
                  </p>

                </div>

                <div
                  className={`mt-5 flex items-center gap-2 border-t border-white/5 pt-3 text-xs ${colourClass.split(' ')[0]}`}
                >

                  <Crosshair size={14} />

                  {target.objective}

                </div>

              </button>
            )
          })}

        </div>

      </section>

      {/* SELECTED RESEARCH TARGET */}
      <section className="rounded-2xl border border-cyan-500/20 bg-[#0D1727] p-6">

        <div className="flex flex-wrap items-center justify-between gap-3">

          <div>

            <p className="text-[10px] tracking-[0.2em] text-cyan-400">
              ACTIVE RESEARCH AREA
            </p>

            <h3 className="mt-2 text-xl font-semibold">
              {selectedResearchTarget.title}
            </h3>

          </div>

          <span className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-[10px] text-cyan-300">
            TARGET {selectedResearchTarget.number}
          </span>

        </div>

        <p className="mt-4 text-sm leading-6 text-slate-400">
          {selectedResearchTarget.research}
        </p>

        <div className="mt-5 rounded-xl border border-white/5 bg-[#080D18] p-4">

          <div className="flex items-center gap-2">

            <Crosshair size={15} className="text-cyan-400" />

            <p className="text-[10px] tracking-widest text-cyan-400">
              INSPECT A LOCATION
            </p>

          </div>

          <p className="mt-2 text-xs leading-5 text-slate-500">
            Enter a location within the available Jezero DEM coverage
            to retrieve its terrain measurements.
          </p>

          <form
            onSubmit={handleScienceInspection}
            className="mt-4 space-y-3"
          >

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">

              <div>

                <label
                  htmlFor="science-latitude"
                  className="mb-2 block text-[10px] text-slate-400"
                >
                  LATITUDE
                </label>

                <input
                  id="science-latitude"
                  type="number"
                  step="any"
                  value={latitude}
                  onChange={(event) => setLatitude(event.target.value)}
                  placeholder="e.g. 18.4"
                  className="w-full rounded-lg border border-white/10 bg-[#111B2B] px-3 py-3 text-sm text-white outline-none focus:border-cyan-500/50"
                />

              </div>

              <div>

                <label
                  htmlFor="science-longitude"
                  className="mb-2 block text-[10px] text-slate-400"
                >
                  LONGITUDE
                </label>

                <input
                  id="science-longitude"
                  type="number"
                  step="any"
                  value={longitude}
                  onChange={(event) => setLongitude(event.target.value)}
                  placeholder="e.g. 77.4"
                  className="w-full rounded-lg border border-white/10 bg-[#111B2B] px-3 py-3 text-sm text-white outline-none focus:border-cyan-500/50"
                />

              </div>

            </div>

            {coordinateError && (
              <p className="text-xs text-red-400">
                {coordinateError}
              </p>
            )}

            <button
              type="submit"
              disabled={terrainLoading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-500 px-4 py-3 text-xs font-semibold text-[#080D18] transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
            >

              {terrainLoading ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  ANALYSING LOCATION
                </>
              ) : (
                <>
                  <Activity size={15} />
                  ANALYSE TERRAIN
                </>
              )}

            </button>

          </form>

        </div>

        {/* TERRAIN RESULTS */}
        {terrainLoading && (
          <div className="mt-5 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-5 text-center">

            <Loader2
              size={25}
              className="mx-auto animate-spin text-cyan-400"
            />

            <p className="mt-3 text-xs text-cyan-300">
              Retrieving terrain measurements...
            </p>

          </div>
        )}

        {terrainError && !terrainLoading && (
          <div className="mt-5 rounded-xl border border-red-500/20 bg-red-500/5 p-4">

            <div className="flex items-center gap-2">

              <AlertCircle size={15} className="text-red-400" />

              <p className="text-xs font-medium text-red-300">
                Terrain inspection failed
              </p>

            </div>

            <p className="mt-2 text-xs leading-5 text-slate-400">
              {terrainError}
            </p>

            <p className="mt-2 text-[10px] text-slate-500">
              Check that the coordinates fall within the available DEM coverage.
            </p>

          </div>
        )}

        {resultMatchesCoordinates && !terrainLoading && (
          <div className="mt-5">

            <div className="mb-4 flex items-center gap-2">

              <Activity size={15} className="text-emerald-400" />

              <p className="text-[10px] tracking-widest text-emerald-400">
                TERRAIN INSPECTION RESULTS
              </p>

            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">

              <div className="rounded-xl border border-white/5 bg-[#080D18] p-4">

                <p className="text-[9px] tracking-widest text-slate-500">
                  ELEVATION
                </p>

                <p className="mt-2 text-xl font-semibold">
                  {terrainResult.elevation_m.toFixed(2)}
                  <span className="ml-1 text-[10px] text-slate-500">
                    m
                  </span>
                </p>

              </div>

              <div className="rounded-xl border border-white/5 bg-[#080D18] p-4">

                <p className="text-[9px] tracking-widest text-slate-500">
                  SLOPE
                </p>

                <p className="mt-2 text-xl font-semibold">
                  {terrainResult.slope_degrees.toFixed(2)}
                  <span className="ml-1 text-[10px] text-slate-500">
                    °
                  </span>
                </p>

              </div>

              <div className="rounded-xl border border-white/5 bg-[#080D18] p-4">

                <p className="text-[9px] tracking-widest text-slate-500">
                  TERRAIN CLASS
                </p>

                <p className="mt-2 text-sm font-semibold">
                  {terrainResult.terrain_class}
                </p>

              </div>

              <div className="rounded-xl border border-white/5 bg-[#080D18] p-4">

                <p className="text-[9px] tracking-widest text-slate-500">
                  TRAVERSABILITY COST
                </p>

                <p className="mt-2 text-xl font-semibold">
                  {terrainResult.traversability_cost.toFixed(2)}
                </p>

              </div>

            </div>

            <div className="mt-3 rounded-xl border border-white/5 bg-[#080D18] p-4">

              <div className="flex flex-wrap items-center justify-between gap-2">

                <p className="text-[10px] tracking-widest text-slate-500">
                  TERRAIN DIFFICULTY
                </p>

                <span className="rounded-md border border-orange-500/20 bg-orange-500/10 px-3 py-1 text-[10px] text-orange-300">
                  {terrainResult.difficulty}
                </span>

              </div>

              <p className="mt-3 text-xs leading-5 text-slate-300">
                {terrainResult.interpretation}
              </p>

              <p className="mt-3 border-t border-white/5 pt-3 text-[9px] leading-5 text-slate-500">
                {terrainResult.model_note}
              </p>

            </div>

            <p className="mt-3 text-[9px] text-slate-500">
              Inspected coordinates: {terrainResult.location.latitude.toFixed(5)}°,
              {' '}{terrainResult.location.longitude.toFixed(5)}°
            </p>

          </div>
        )}

      </section>

      {/* INVESTIGATION PRIORITIES */}
      <section className="rounded-2xl border border-white/10 bg-[#0D1727] p-6">

        <div className="flex items-center gap-2">

          <Satellite size={19} className="text-orange-400" />

          <h3 className="text-lg font-semibold">
            Mission Investigation Priorities
          </h3>

        </div>

        <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">

          {objectives.map((objective, index) => (
            <div key={objective.title} className="flex gap-3">

              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-500/10">

                <span className="text-xs text-orange-400">
                  0{index + 1}
                </span>

              </div>

              <div>

                <p className="text-sm font-medium">
                  {objective.title}
                </p>

                <p className="mt-1 text-xs leading-5 text-slate-500">
                  {objective.description}
                </p>

              </div>

            </div>
          ))}

        </div>

      </section>

      {/* SCIENTIFIC CONTEXT */}
      <section className="flex gap-3 rounded-xl border border-orange-500/20 bg-orange-500/[0.04] p-4">

        <AlertCircle
          size={18}
          className="mt-0.5 shrink-0 text-orange-400"
        />

        <div>

          <p className="text-xs font-semibold text-orange-400">
            SCIENTIFIC CONTEXT
          </p>

          <p className="mt-2 text-xs leading-6 text-slate-400">
            The geological target descriptions represent conceptual
            research environments informed by scientific understanding
            of Jezero Crater. They are not live target detections or
            rover observations. Terrain measurements are retrieved
            from the available processed DEM at the coordinates
            entered above. Terrain measurements do not independently
            establish mineral composition or biosignature presence.
          </p>

        </div>

      </section>

    </div>
  )
}

// --------------------------------------------------
// MAIN APPLICATION
// --------------------------------------------------

function App() {
  const [activeSection, setActiveSection] =
    useState<Section>('Mars Explorer')

  // TERRAIN INSPECTOR STATE

  const [terrainResult, setTerrainResult] =
    useState<TerrainResponse | null>(null)

  const [terrainCoordinates, setTerrainCoordinates] =
    useState<[number, number] | null>(null)

  const [terrainLoading, setTerrainLoading] =
    useState(false)

  const [terrainError, setTerrainError] =
    useState<string | null>(null)

  // FETCH TERRAIN DATA WHEN A LOCATION IS SELECTED

  async function handleTerrainInspect(
    coordinates: [number, number]
  ) {
    const [latitude, longitude] = coordinates

    setTerrainCoordinates(coordinates)
    setTerrainResult(null)
    setTerrainError(null)
    setTerrainLoading(true)

    try {
      const result = await getTerrainAtLocation(
        latitude,
        longitude
      )

      setTerrainResult(result)
    } catch (error) {
      setTerrainError(
        error instanceof Error
          ? error.message
          : 'Unable to retrieve terrain information.'
      )
    } finally {
      setTerrainLoading(false)
    }
  }

  // MAIN RENDER

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-[#080D18] text-slate-100">

      {/* HEADER */}
      <header className="flex h-16 items-center justify-between border-b border-white/10 px-6">

        <div className="flex items-center gap-3">

          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-600">
            <Satellite size={21} />
          </div>

          <div>
            <h1 className="text-lg font-bold tracking-[0.2em]">
              ASTRAL
            </h1>

            <p className="text-[9px] tracking-[0.25em] text-slate-500">
              MARS EXPLORATION SYSTEM
            </p>
          </div>

        </div>

        <div className="hidden items-center gap-2 text-xs text-slate-400 md:flex">

          <Activity size={15} className="text-emerald-400" />

          <span className="h-2 w-2 rounded-full bg-emerald-400" />

          SYSTEM INITIALISED

        </div>

        <div className="text-xs tracking-wider text-slate-400">
          MISSION CONTROL
        </div>

      </header>

      <div className="flex min-h-[calc(100vh-64px)]">

        {/* SIDEBAR */}
        <aside className="hidden w-60 shrink-0 flex-col border-r border-white/10 p-5 md:flex">

          <p className="mb-5 text-[10px] tracking-[0.2em] text-slate-500">
            EXPLORATION
          </p>

          <nav className="space-y-2">

            {navigation.map((item) => {
              const Icon = item.icon
              const isActive = activeSection === item.label

              return (
                <button
                  key={item.label}
                  onClick={() => setActiveSection(item.label)}
                  className={`flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-all ${isActive
                    ? 'border-orange-500/20 bg-orange-500/10 text-orange-400'
                    : 'border-transparent text-slate-400 hover:bg-white/5 hover:text-white'
                    }`}
                >

                  <Icon size={17} />

                  {item.label}

                </button>
              )
            })}

          </nav>

          <div className="mt-auto border-t border-white/10 pt-5">

            <p className="text-[10px] tracking-widest text-slate-500">
              PROJECT
            </p>

            <p className="mt-2 text-sm text-slate-300">
              ASTRAL v0.3
            </p>

            <p className="mt-1 text-xs text-slate-600">
              Research prototype
            </p>

          </div>

        </aside>

        {/* MAIN WORKSPACE */}
        <main className="relative min-w-0 w-0 max-w-full flex-1 overflow-x-clip p-4 sm:p-6 xl:p-8">

          {/* PAGE HEADER */}
          <div className="mb-7 flex flex-wrap items-end justify-between gap-4">

            <div>

              <p className="mb-2 text-xs tracking-[0.2em] text-orange-400">
                PLANETARY SURFACE OPERATIONS
              </p>

              <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
                {activeSection}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                {descriptions[activeSection]}
              </p>

            </div>

            <div className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3">

              <p className="text-[10px] tracking-widest text-slate-500">
                TARGET REGION
              </p>

              <p className="mt-1 text-sm font-medium">
                Jezero Crater
              </p>

            </div>

          </div>

          {/* MARS EXPLORER */}
          {activeSection === 'Mars Explorer' ? (

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_290px]">

              {/* MAP */}
              <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#0D1727]">

                <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">

                  <div>

                    <h3 className="text-sm font-semibold">
                      Surface Intelligence
                    </h3>

                    <p className="mt-1 text-xs text-slate-500">
                      Interactive Martian surface map
                    </p>

                  </div>

                  <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[10px] text-emerald-400">
                    MAP CONNECTED
                  </span>

                </div>

                <MarsMap
                  onTerrainInspect={handleTerrainInspect}
                />

                <div className="flex flex-wrap justify-between gap-2 border-t border-white/10 px-5 py-3">

                  <span className="text-[10px] text-slate-500">
                    BASEMAP · OPENPLANETARYMAP
                  </span>

                  <span className="text-[10px] text-slate-500">
                    TERRAIN · USGS CTX DEM DERIVED SLOPE
                  </span>

                </div>

              </section>

              {/* INFORMATION PANEL */}
              <aside className="space-y-5">

                {/* TERRAIN INSPECTOR */}
                <section className="rounded-2xl border border-cyan-500/20 bg-[#0D1727] p-5">

                  <div className="mb-4 flex items-center gap-2">

                    <Crosshair
                      size={16}
                      className="text-cyan-400"
                    />

                    <p className="text-[10px] tracking-widest text-cyan-400">
                      TERRAIN INSPECTOR
                    </p>

                  </div>

                  <p className="text-sm leading-6 text-slate-300">
                    Enter coordinates in the map search or click any
                    location on the Mars map to inspect its elevation,
                    slope and terrain difficulty.
                  </p>

                  {terrainCoordinates && (
                    <div className="mt-4 rounded-lg border border-white/5 bg-[#080D18] p-3">

                      <div className="mb-2 flex items-center gap-2">

                        <MapPin
                          size={13}
                          className="text-cyan-400"
                        />

                        <p className="text-[9px] tracking-widest text-slate-500">
                          SELECTED LOCATION
                        </p>

                      </div>

                      <p className="font-mono text-xs text-cyan-300">
                        {Math.abs(terrainCoordinates[0]).toFixed(5)}° {terrainCoordinates[0] >= 0 ? 'N' : 'S'}
                      </p>

                      <p className="mt-1 font-mono text-xs text-cyan-300">
                        {Math.abs(terrainCoordinates[1]).toFixed(5)}° {terrainCoordinates[1] >= 0 ? 'E' : 'W'}
                      </p>

                    </div>
                  )}

                  {!terrainCoordinates && !terrainLoading && (
                    <div className="mt-4 rounded-lg border border-dashed border-white/10 p-5 text-center">

                      <Crosshair
                        size={24}
                        className="mx-auto text-slate-600"
                      />

                      <p className="mt-3 text-xs text-slate-500">
                        Awaiting map selection
                      </p>

                    </div>
                  )}

                  {terrainLoading && (
                    <div className="mt-4 rounded-lg border border-cyan-500/10 bg-cyan-500/5 p-5 text-center">

                      <Loader2
                        size={24}
                        className="mx-auto animate-spin text-cyan-400"
                      />

                      <p className="mt-3 text-xs text-cyan-300">
                        Analysing terrain...
                      </p>

                      <p className="mt-1 text-[10px] text-slate-500">
                        Retrieving scientific raster data
                      </p>

                    </div>
                  )}

                  {terrainError && (
                    <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/5 p-3">

                      <div className="flex items-center gap-2">

                        <AlertCircle
                          size={15}
                          className="text-red-400"
                        />

                        <p className="text-xs text-red-300">
                          Terrain inspection failed
                        </p>

                      </div>

                      <p className="mt-2 text-[11px] leading-5 text-slate-400">
                        {terrainError}
                      </p>

                      <p className="mt-2 text-[10px] text-slate-500">
                        Try selecting a location within the Jezero DEM coverage area.
                      </p>

                    </div>
                  )}

                  {terrainResult && !terrainLoading && (
                    <div className="mt-4 space-y-3">

                      {/* ELEVATION */}
                      <div className="rounded-lg border border-white/5 bg-[#080D18] p-3">

                        <div className="flex items-center gap-2">

                          <Mountain
                            size={14}
                            className="text-orange-400"
                          />

                          <p className="text-[9px] tracking-widest text-slate-500">
                            ELEVATION
                          </p>

                        </div>

                        <p className="mt-2 text-xl font-semibold text-white">
                          {terrainResult.elevation_m.toLocaleString(
                            'en-US',
                            { maximumFractionDigits: 2 }
                          )}

                          <span className="ml-2 text-xs text-slate-400">
                            metres
                          </span>
                        </p>

                      </div>

                      {/* SLOPE */}
                      <div className="rounded-lg border border-white/5 bg-[#080D18] p-3">

                        <div className="flex items-center gap-2">

                          <Gauge
                            size={14}
                            className="text-yellow-400"
                          />

                          <p className="text-[9px] tracking-widest text-slate-500">
                            SLOPE ANGLE
                          </p>

                        </div>

                        <p className="mt-2 text-xl font-semibold text-white">
                          {terrainResult.slope_degrees.toFixed(2)}

                          <span className="ml-2 text-xs text-slate-400">
                            degrees
                          </span>

                        </p>

                      </div>

                      {/* TERRAIN CLASS */}
                      <div className="rounded-lg border border-white/5 bg-[#080D18] p-3">

                        <div className="flex items-center gap-2">

                          <MountainSnow
                            size={14}
                            className="text-orange-400"
                          />

                          <p className="text-[9px] tracking-widest text-slate-500">
                            TERRAIN CLASS
                          </p>

                        </div>

                        <p className="mt-2 text-base font-semibold text-white">
                          {terrainResult.terrain_class}
                        </p>

                      </div>

                      {/* DIFFICULTY AND COST */}
                      <div className="grid grid-cols-2 gap-2">

                        <div className="rounded-lg border border-white/5 bg-[#080D18] p-3">

                          <p className="text-[9px] tracking-widest text-slate-500">
                            DIFFICULTY
                          </p>

                          <span
                            className={`mt-2 inline-block rounded-md border px-2 py-1 text-[10px] font-medium ${getDifficultyColour(
                              terrainResult.difficulty
                            )}`}
                          >
                            {terrainResult.difficulty}
                          </span>

                        </div>

                        <div className="rounded-lg border border-white/5 bg-[#080D18] p-3">

                          <p className="text-[9px] tracking-widest text-slate-500">
                            TRAVERSABILITY
                          </p>

                          <p className="mt-2 text-lg font-semibold text-white">
                            {terrainResult.traversability_cost}
                          </p>

                        </div>

                      </div>

                      {/* INTERPRETATION */}
                      <div className="rounded-lg border border-cyan-500/10 bg-cyan-500/5 p-3">

                        <p className="text-[9px] tracking-widest text-cyan-400">
                          TERRAIN INTERPRETATION
                        </p>

                        <p className="mt-2 text-xs leading-5 text-slate-300">
                          {terrainResult.interpretation}
                        </p>

                      </div>

                      <p className="text-[9px] leading-4 text-slate-500">
                        {terrainResult.model_note}
                      </p>

                    </div>
                  )}

                </section>

                {/* MISSION OVERVIEW */}
                <section className="rounded-2xl border border-white/10 bg-[#0D1727] p-5">

                  <p className="text-[10px] tracking-widest text-slate-500">
                    MISSION OVERVIEW
                  </p>

                  <h3 className="mt-3 text-lg font-semibold">
                    Jezero Crater
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    A scientifically significant impact crater on Mars
                    and the landing region explored by NASA's
                    Perseverance rover.
                  </p>

                  <div className="mt-4 border-t border-white/5 pt-4">

                    <p className="text-[10px] text-slate-500">
                      APPROXIMATE CENTRE
                    </p>

                    <p className="mt-2 font-mono text-xs text-cyan-300">
                      18.4° N · 77.4° E
                    </p>

                  </div>

                </section>

                {/* DATA LAYERS */}
                <section className="rounded-2xl border border-white/10 bg-[#0D1727] p-5">

                  <div className="mb-4 flex items-center gap-2">

                    <Layers3
                      size={15}
                      className="text-orange-400"
                    />

                    <p className="text-[10px] tracking-widest text-slate-500">
                      DATA LAYERS
                    </p>

                  </div>

                  {[
                    { name: 'Elevation', status: 'SOURCE DEM' },
                    { name: 'Terrain Slope', status: 'PROCESSED' },
                    { name: 'A* Route', status: 'EXPERIMENTAL' },
                    { name: 'Surface Hazards', status: 'PENDING' },
                    { name: 'Geological Features', status: 'PENDING' },
                  ].map((layer) => (
                    <div
                      key={layer.name}
                      className="flex items-center justify-between gap-2 border-b border-white/5 py-3 last:border-0"
                    >

                      <span className="text-sm text-slate-300">
                        {layer.name}
                      </span>

                      <span
                        className={`text-[9px] ${layer.status === 'PROCESSED'
                          ? 'text-emerald-400'
                          : layer.status === 'EXPERIMENTAL'
                            ? 'text-cyan-400'
                            : 'text-slate-500'
                          }`}
                      >
                        {layer.status}
                      </span>

                    </div>
                  ))}

                </section>

                {/* ROUTE PLANNING */}
                <section className="rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.04] p-5">

                  <p className="text-[10px] tracking-widest text-cyan-400">
                    ROUTE PLANNING
                  </p>

                  <p className="mt-3 text-sm leading-6 text-slate-300">
                    An experimental A* route has been generated
                    using slope-derived terrain costs from the
                    Jezero CTX DEM.
                  </p>

                  <p className="mt-3 text-xs leading-5 text-slate-500">
                    This route is a research demonstration.
                    It has not been validated for rover safety
                    or operational navigation.
                  </p>

                </section>

                {/* DEVELOPMENT STATUS */}
                <section className="rounded-2xl border border-orange-500/20 bg-orange-500/[0.05] p-5">

                  <p className="text-[10px] tracking-widest text-orange-400">
                    DEVELOPMENT STATUS
                  </p>

                  <p className="mt-3 text-sm leading-6 text-slate-300">
                    USGS terrain data has been processed into
                    a slope raster, geographic overlay and
                    experimental A* route.
                  </p>

                </section>

              </aside>

            </div>

          ) : activeSection === 'Terrain Analysis' ? (

            <RegionalTerrainAnalysis
              coordinates={terrainCoordinates}
              result={terrainResult}
              loading={terrainLoading}
              error={terrainError}
            />

          ) : activeSection === 'Science Explorer' ? (

            <ScienceExplorer
              onTerrainInspect={handleTerrainInspect}
              terrainResult={terrainResult}
              terrainLoading={terrainLoading}
              terrainError={terrainError}
            />

          ) : activeSection === 'Route Planner' ? (

            <RoutePlanner />

          ) : (
            <MissionAssessment
              result={terrainResult}
              loading={terrainLoading}
              error={terrainError}
            />
          )}

          {/* FOOTER */}
          <footer className="mt-8 flex flex-wrap justify-between gap-3 border-t border-white/10 pt-5 text-[10px] tracking-wider text-slate-600">

            <span>ASTRAL · MARS MISSION PLANNING</span>

            <span>PLANETARY DATA INTEGRATION IN PROGRESS</span>

          </footer>

        </main>

      </div>

    </div>
  )
}

export default App
