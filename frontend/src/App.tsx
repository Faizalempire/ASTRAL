
import { useEffect, useState } from 'react'

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

import type { FeatureCollection, LineString } from 'geojson'

import {
  getTerrainAtLocation,
  type TerrainResponse,
} from './services/terrainService'

import RegionalTerrainAnalysis from './components/RegionalTerrainAnalysis'
import MissionAssessment from './components/MissionAssessment'
import RoutePlanner from './components/RoutePlanner'

import 'leaflet/dist/leaflet.css'

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
  coordinates: number[][]
}) {
  const map = useMap()

  useEffect(() => {
    if (coordinates.length < 2) return

    const bounds = coordinates.map(([longitude, latitude]) => [
      latitude,
      longitude,
    ] as [number, number])

    map.fitBounds(bounds, {
      padding: [45, 45],
      maxZoom: 5,
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

  const routeFeature = routeData?.features[0]
  const routeCoordinates =
    routeFeature?.geometry.coordinates ?? []

  const start = routeCoordinates.length > 0
    ? routeCoordinates[0] as [number, number]
    : null

  const destination = routeCoordinates.length > 0
    ? routeCoordinates[routeCoordinates.length - 1] as [number, number]
    : null

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

              {/* START MARKER */}
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

              {/* DESTINATION MARKER */}
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

        <CoordinateTracker
          onCoordinatesChange={setCoordinates}
          onMapClick={onTerrainInspect}
        />

      </MapContainer>

      {/* SURFACE COORDINATE DISPLAY */}
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
          {showSlope ? (
            <Eye size={14} />
          ) : (
            <EyeOff size={14} />
          )}

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
          {showRoute ? (
            <Eye size={14} />
          ) : (
            <EyeOff size={14} />
          )}

          {showRoute ? 'A* Route ON' : 'A* Route OFF'}
        </button>

      </div>

      {/* SLOPE LEGEND */}
      {showSlope && slopeMetadata && (
        <div className="absolute bottom-4 left-4 z-[1000] w-48 rounded-lg border border-white/10 bg-[#080D18]/95 p-3 backdrop-blur-md">

          <p className="text-[9px] tracking-widest text-slate-400 mb-3">
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

                <span className="text-[10px] font-mono text-slate-500">
                  {item.range}
                </span>

              </div>
            ))}

          </div>

          <p className="text-[9px] text-slate-500 mt-3 pt-2 border-t border-white/10">
            Slope angle · Degrees
          </p>

        </div>
      )}

      {/* ROUTE INFORMATION */}
      {showRoute && routeData && routeFeature && (
        <div className="absolute bottom-4 right-4 z-[1000] w-52 rounded-lg border border-cyan-500/20 bg-[#080D18]/95 p-3 backdrop-blur-md">

          <div className="flex items-center gap-2 mb-3">

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

              <p className="text-lg font-semibold text-white mt-1">
                158.13 <span className="text-xs text-slate-400">km</span>
              </p>
            </div>

            <div>
              <p className="text-[9px] text-slate-500">
                WAYPOINTS
              </p>

              <p className="text-lg font-semibold text-white mt-1">
                {routeFeature.properties.point_count}
              </p>
            </div>

          </div>

          <div className="mt-3 pt-3 border-t border-white/10 flex items-center gap-2">

            <span className="w-5 h-[3px] rounded bg-cyan-400" />

            <span className="text-[9px] text-slate-400">
              Experimental slope-based route
            </span>

          </div>

        </div>
      )}

      {/* SLOPE LOADING / ERROR */}
      {loading && (
        <div className="absolute top-16 right-4 z-[1000] rounded-lg border border-white/10 bg-[#080D18]/95 px-3 py-2">

          <p className="text-[10px] text-cyan-300">
            Loading terrain metadata...
          </p>

        </div>
      )}

      {loadError && (
        <div className="absolute top-16 right-4 z-[1000] max-w-64 rounded-lg border border-red-500/30 bg-[#080D18]/95 px-3 py-2">

          <p className="text-[10px] text-red-300">
            Terrain layer unavailable
          </p>

          <p className="text-[9px] text-slate-400 mt-1">
            {loadError}
          </p>

        </div>
      )}

      {/* ROUTE LOADING / ERROR */}
      {routeLoading && (
        <div className="absolute top-28 right-4 z-[1000] rounded-lg border border-white/10 bg-[#080D18]/95 px-3 py-2">

          <p className="text-[10px] text-cyan-300">
            Loading A* route...
          </p>

        </div>
      )}

      {routeError && (
        <div className="absolute top-28 right-4 z-[1000] max-w-64 rounded-lg border border-red-500/30 bg-[#080D18]/95 px-3 py-2">

          <p className="text-[10px] text-red-300">
            A* route unavailable
          </p>

          <p className="text-[9px] text-slate-400 mt-1">
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
  },
]

function ScienceExplorer() {
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

  return (
    <div className="space-y-6">

      {/* SCIENCE OVERVIEW */}
      <section className="rounded-2xl border border-white/10 bg-[#0D1727] p-6 md:p-8">

        <div className="flex flex-wrap items-start justify-between gap-5">

          <div className="max-w-2xl">

            <div className="flex items-center gap-2 text-orange-400 text-xs tracking-[0.2em]">
              <FlaskConical size={15} />
              SCIENTIFIC TARGET CATALOGUE
            </div>

            <h3 className="text-2xl md:text-3xl font-semibold mt-4">
              Explore Jezero Crater
            </h3>

            <p className="text-sm text-slate-400 mt-3 leading-7">
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

            <p className="text-sm font-semibold text-orange-400 mt-1">
              Jezero Crater
            </p>

            <p className="text-xs text-slate-500 mt-1">
              Mars · Planetary Science
            </p>

          </div>

        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-7">

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
                className="rounded-xl bg-[#111E30] border border-white/5 p-4"
              >

                <Icon size={20} className={`${item.colour} mb-3`} />

                <p className="text-xs text-slate-500">
                  {item.label}
                </p>

                <p className="text-sm font-medium mt-1">
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

          <h3 className="text-xl font-semibold mt-2">
            Scientific Target Regions
          </h3>

          <p className="text-xs text-slate-500 mt-1">
            Three geological environments of scientific interest
          </p>

        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {scienceTargets.map((target) => {
            const Icon = target.icon

            const colourClasses: Record<string, string> = {
              cyan: 'text-cyan-400 border-cyan-500/30',
              orange: 'text-orange-400 border-orange-500/30',
              emerald: 'text-emerald-400 border-emerald-500/30',
            }

            return (
              <article
                key={target.number}
                className="rounded-2xl border border-white/10 bg-[#0D1727] p-5 hover:border-white/20 transition-colors"
              >

                <div className="flex justify-between items-center">

                  <span className={`text-[10px] tracking-widest ${colourClasses[target.colour].split(' ')[0]}`}>
                    TARGET {target.number}
                  </span>

                  <Icon
                    size={20}
                    className={colourClasses[target.colour].split(' ')[0]}
                  />

                </div>

                <h4 className="text-lg font-semibold mt-5">
                  {target.title}
                </h4>

                <p className="text-[9px] tracking-widest text-slate-500 mt-2">
                  {target.category}
                </p>

                <p className="text-sm text-slate-400 leading-6 mt-4">
                  {target.description}
                </p>

                <div className="border-t border-white/10 mt-5 pt-4">

                  <p className="text-[10px] tracking-widest text-orange-400">
                    SCIENTIFIC QUESTION
                  </p>

                  <p className="text-sm text-slate-300 leading-6 mt-2">
                    {target.question}
                  </p>

                </div>

                <div className={`mt-5 pt-3 border-t border-white/5 flex items-center gap-2 text-xs ${colourClasses[target.colour].split(' ')[0]}`}>

                  <Crosshair size={14} />

                  {target.objective}

                </div>

              </article>
            )
          })}

        </div>

      </section>

      {/* INVESTIGATION PRIORITIES */}
      <section className="rounded-2xl border border-white/10 bg-[#0D1727] p-6">

        <div className="flex items-center gap-2">

          <Satellite size={19} className="text-orange-400" />

          <h3 className="text-lg font-semibold">
            Mission Investigation Priorities
          </h3>

        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-6">

          {objectives.map((objective, index) => (
            <div key={objective.title} className="flex gap-3">

              <div className="w-9 h-9 shrink-0 rounded-lg bg-orange-500/10 flex items-center justify-center">

                <span className="text-xs text-orange-400">
                  0{index + 1}
                </span>

              </div>

              <div>

                <p className="text-sm font-medium">
                  {objective.title}
                </p>

                <p className="text-xs text-slate-500 leading-5 mt-1">
                  {objective.description}
                </p>

              </div>

            </div>
          ))}

        </div>

      </section>

      {/* SCIENTIFIC CONTEXT */}
      <section className="rounded-xl border border-orange-500/20 bg-orange-500/[0.04] p-4 flex gap-3">

        <AlertCircle
          size={18}
          className="text-orange-400 shrink-0 mt-0.5"
        />

        <div>

          <p className="text-xs font-semibold text-orange-400">
            SCIENTIFIC CONTEXT
          </p>

          <p className="text-xs text-slate-400 leading-6 mt-2">
            These are conceptual geological research areas based
            on established scientific understanding of Jezero
            Crater. They are not live target detections or rover
            observations. Dedicated geological and mineralogical
            dataset integration is a future enhancement.
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

  // FETCH TERRAIN DATA WHEN MAP IS CLICKED
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

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-[#080D18] text-slate-100">

      {/* HEADER */}
      <header className="h-16 border-b border-white/10 flex items-center justify-between px-6">

        <div className="flex items-center gap-3">

          <div className="w-9 h-9 rounded-lg bg-orange-600 flex items-center justify-center">
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

        <div className="hidden md:flex items-center gap-2 text-xs text-slate-400">

          <Activity size={15} className="text-emerald-400" />

          <span className="w-2 h-2 rounded-full bg-emerald-400" />

          SYSTEM INITIALISED

        </div>

        <div className="text-xs text-slate-400 tracking-wider">
          MISSION CONTROL
        </div>

      </header>

      <div className="flex min-h-[calc(100vh-64px)]">

        {/* SIDEBAR */}
        <aside className="hidden md:flex w-60 shrink-0 border-r border-white/10 p-5 flex-col">

          <p className="text-[10px] tracking-[0.2em] text-slate-500 mb-5">
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
                  className={`w-full flex items-center gap-3 rounded-lg px-4 py-3 text-sm text-left transition-all ${isActive
                    ? 'bg-orange-500/10 border border-orange-500/20 text-orange-400'
                    : 'border border-transparent text-slate-400 hover:text-white hover:bg-white/5'
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

            <p className="text-sm text-slate-300 mt-2">
              ASTRAL v0.3
            </p>

            <p className="text-xs text-slate-600 mt-1">
              Research prototype
            </p>

          </div>

        </aside>

        {/* MAIN WORKSPACE */}
        <main className="relative flex-1 min-w-0 w-0 max-w-full overflow-x-clip p-4 sm:p-6 xl:p-8">

          <div className="flex flex-wrap justify-between items-end gap-4 mb-7">

            <div>

              <p className="text-orange-400 text-xs tracking-[0.2em] mb-2">
                PLANETARY SURFACE OPERATIONS
              </p>

              <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
                {activeSection}
              </h2>

              <p className="text-sm text-slate-500 mt-2">
                {descriptions[activeSection]}
              </p>

            </div>

            <div className="border border-white/10 bg-white/[0.03] rounded-lg px-4 py-3">

              <p className="text-[10px] text-slate-500 tracking-widest">
                TARGET REGION
              </p>

              <p className="text-sm font-medium mt-1">
                Jezero Crater
              </p>

            </div>

          </div>

          {/* MARS EXPLORER */}
          {activeSection === 'Mars Explorer' ? (

            <div className="grid grid-cols-1 xl:grid-cols-[1fr_290px] gap-5">

              {/* MAP */}
              <section className="rounded-2xl border border-white/10 overflow-hidden bg-[#0D1727]">

                <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">

                  <div>

                    <h3 className="text-sm font-semibold">
                      Surface Intelligence
                    </h3>

                    <p className="text-xs text-slate-500 mt-1">
                      Interactive Martian surface map
                    </p>

                  </div>

                  <span className="text-[10px] text-emerald-400 border border-emerald-500/20 bg-emerald-500/10 rounded-full px-3 py-1">
                    MAP CONNECTED
                  </span>

                </div>

                <MarsMap
                  onTerrainInspect={handleTerrainInspect}
                />

                <div className="px-5 py-3 border-t border-white/10 flex flex-wrap justify-between gap-2">

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

                  <div className="flex items-center gap-2 mb-4">

                    <Crosshair
                      size={16}
                      className="text-cyan-400"
                    />

                    <p className="text-[10px] tracking-widest text-cyan-400">
                      TERRAIN INSPECTOR
                    </p>

                  </div>

                  <p className="text-sm text-slate-300 leading-6">
                    Click any location on the Mars map to inspect its
                    elevation, slope and terrain difficulty.
                  </p>

                  {/* SELECTED COORDINATES */}
                  {terrainCoordinates && (
                    <div className="mt-4 rounded-lg bg-[#080D18] border border-white/5 p-3">

                      <div className="flex items-center gap-2 mb-2">

                        <MapPin
                          size={13}
                          className="text-cyan-400"
                        />

                        <p className="text-[9px] tracking-widest text-slate-500">
                          SELECTED LOCATION
                        </p>

                      </div>

                      <p className="text-xs font-mono text-cyan-300">
                        {Math.abs(terrainCoordinates[0]).toFixed(5)}° {terrainCoordinates[0] >= 0 ? 'N' : 'S'}
                      </p>

                      <p className="text-xs font-mono text-cyan-300 mt-1">
                        {Math.abs(terrainCoordinates[1]).toFixed(5)}° {terrainCoordinates[1] >= 0 ? 'E' : 'W'}
                      </p>

                    </div>
                  )}

                  {/* INITIAL STATE */}
                  {!terrainCoordinates && !terrainLoading && (
                    <div className="mt-4 rounded-lg border border-dashed border-white/10 p-5 text-center">

                      <Crosshair
                        size={24}
                        className="mx-auto text-slate-600"
                      />

                      <p className="text-xs text-slate-500 mt-3">
                        Awaiting map selection
                      </p>

                    </div>
                  )}

                  {/* LOADING STATE */}
                  {terrainLoading && (
                    <div className="mt-4 rounded-lg bg-cyan-500/5 border border-cyan-500/10 p-5 text-center">

                      <Loader2
                        size={24}
                        className="mx-auto text-cyan-400 animate-spin"
                      />

                      <p className="text-xs text-cyan-300 mt-3">
                        Analysing terrain...
                      </p>

                      <p className="text-[10px] text-slate-500 mt-1">
                        Retrieving scientific raster data
                      </p>

                    </div>
                  )}

                  {/* ERROR STATE */}
                  {terrainError && (
                    <div className="mt-4 rounded-lg bg-red-500/5 border border-red-500/20 p-3">

                      <div className="flex items-center gap-2">

                        <AlertCircle
                          size={15}
                          className="text-red-400"
                        />

                        <p className="text-xs text-red-300">
                          Terrain inspection failed
                        </p>

                      </div>

                      <p className="text-[11px] text-slate-400 mt-2 leading-5">
                        {terrainError}
                      </p>

                      <p className="text-[10px] text-slate-500 mt-2">
                        Try selecting a location within the Jezero
                        DEM coverage area.
                      </p>

                    </div>
                  )}

                  {/* TERRAIN RESULTS */}
                  {terrainResult && !terrainLoading && (
                    <div className="mt-4 space-y-3">

                      {/* ELEVATION */}
                      <div className="rounded-lg bg-[#080D18] border border-white/5 p-3">

                        <div className="flex items-center gap-2">

                          <Mountain
                            size={14}
                            className="text-orange-400"
                          />

                          <p className="text-[9px] tracking-widest text-slate-500">
                            ELEVATION
                          </p>

                        </div>

                        <p className="text-xl font-semibold text-white mt-2">
                          {terrainResult.elevation_m.toLocaleString(
                            'en-US',
                            { maximumFractionDigits: 2 }
                          )}

                          <span className="text-xs text-slate-400 ml-2">
                            metres
                          </span>
                        </p>

                      </div>

                      {/* SLOPE */}
                      <div className="rounded-lg bg-[#080D18] border border-white/5 p-3">

                        <div className="flex items-center gap-2">

                          <Gauge
                            size={14}
                            className="text-yellow-400"
                          />

                          <p className="text-[9px] tracking-widest text-slate-500">
                            SLOPE ANGLE
                          </p>

                        </div>

                        <p className="text-xl font-semibold text-white mt-2">
                          {terrainResult.slope_degrees.toFixed(2)}

                          <span className="text-xs text-slate-400 ml-2">
                            degrees
                          </span>

                        </p>

                      </div>

                      {/* TERRAIN CLASS */}
                      <div className="rounded-lg bg-[#080D18] border border-white/5 p-3">

                        <div className="flex items-center gap-2">

                          <MountainSnow
                            size={14}
                            className="text-orange-400"
                          />

                          <p className="text-[9px] tracking-widest text-slate-500">
                            TERRAIN CLASS
                          </p>

                        </div>

                        <p className="text-base font-semibold text-white mt-2">
                          {terrainResult.terrain_class}
                        </p>

                      </div>

                      {/* DIFFICULTY AND COST */}
                      <div className="grid grid-cols-2 gap-2">

                        <div className="rounded-lg bg-[#080D18] border border-white/5 p-3">

                          <p className="text-[9px] tracking-widest text-slate-500">
                            DIFFICULTY
                          </p>

                          <span
                            className={`inline-block mt-2 rounded-md border px-2 py-1 text-[10px] font-medium ${getDifficultyColour(
                              terrainResult.difficulty
                            )}`}
                          >
                            {terrainResult.difficulty}
                          </span>

                        </div>

                        <div className="rounded-lg bg-[#080D18] border border-white/5 p-3">

                          <p className="text-[9px] tracking-widest text-slate-500">
                            TRAVERSABILITY
                          </p>

                          <p className="text-lg font-semibold text-white mt-2">
                            {terrainResult.traversability_cost}
                          </p>

                        </div>

                      </div>

                      {/* INTERPRETATION */}
                      <div className="rounded-lg border border-cyan-500/10 bg-cyan-500/5 p-3">

                        <p className="text-[9px] tracking-widest text-cyan-400">
                          TERRAIN INTERPRETATION
                        </p>

                        <p className="text-xs text-slate-300 leading-5 mt-2">
                          {terrainResult.interpretation}
                        </p>

                      </div>

                      {/* SCIENTIFIC NOTE */}
                      <p className="text-[9px] text-slate-500 leading-4">
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

                  <h3 className="text-lg font-semibold mt-3">
                    Jezero Crater
                  </h3>

                  <p className="text-sm text-slate-400 leading-6 mt-2">
                    A scientifically significant impact crater on Mars
                    and the landing region explored by NASA's
                    Perseverance rover.
                  </p>

                  <div className="mt-4 pt-4 border-t border-white/5">

                    <p className="text-[10px] text-slate-500">
                      APPROXIMATE CENTRE
                    </p>

                    <p className="text-xs font-mono text-cyan-300 mt-2">
                      18.4° N · 77.4° E
                    </p>

                  </div>

                </section>

                {/* DATA LAYERS */}
                <section className="rounded-2xl border border-white/10 bg-[#0D1727] p-5">

                  <div className="flex items-center gap-2 mb-4">

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
                      className="flex items-center justify-between gap-2 py-3 border-b border-white/5 last:border-0"
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

                  <p className="text-sm text-slate-300 mt-3 leading-6">
                    An experimental A* route has been generated
                    using slope-derived terrain costs from the
                    Jezero CTX DEM.
                  </p>

                  <p className="text-xs text-slate-500 mt-3 leading-5">
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

                  <p className="text-sm text-slate-300 mt-3 leading-6">
                    USGS terrain data has been processed into
                    a slope raster, geographic overlay and
                    experimental A* route.
                  </p>

                </section>

              </aside>

            </div>

          ) : activeSection === 'Terrain Analysis' ? (

            /* REGIONAL TERRAIN ANALYSIS */
            <RegionalTerrainAnalysis />

          ) : activeSection === 'Science Explorer' ? (

            /* SCIENCE EXPLORER */
            <ScienceExplorer />

          ) : activeSection === 'Route Planner' ? (

            /* A* ROUTE PLANNER */
            <RoutePlanner />

          ) : activeSection === 'Mission Assessment' ? (

            /* MISSION ASSESSMENT */
            <MissionAssessment />

          ) : (

            /* OTHER MODULE PLACEHOLDERS */
            <section className="rounded-2xl border border-white/10 bg-[#0D1727] p-8 min-h-[420px] flex flex-col justify-center">

              <div className="w-14 h-14 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mb-6">

                {activeSection === 'Science Explorer' && (
                  <FlaskConical size={26} className="text-orange-400" />
                )}

                {activeSection === 'Route Planner' && (
                  <Route size={26} className="text-orange-400" />
                )}

                {activeSection === 'Mission Assessment' && (
                  <ClipboardList size={26} className="text-orange-400" />
                )}

              </div>

              <p className="text-xs tracking-[0.2em] text-orange-400 mb-3">
                ASTRAL MODULE
              </p>

              <h3 className="text-2xl font-semibold">
                {activeSection}
              </h3>

              <p className="text-sm text-slate-400 max-w-lg leading-7 mt-3">
                {descriptions[activeSection]}
                {' '}This workspace will be connected to scientific
                datasets and processing capabilities as development progresses.
              </p>

              <div className="mt-7 inline-flex items-center gap-2 text-xs text-slate-500">

                <span className="w-2 h-2 rounded-full bg-orange-400" />

                MODULE UNDER DEVELOPMENT

              </div>

            </section>

          )}

          <footer className="mt-8 border-t border-white/10 pt-5 flex flex-wrap justify-between gap-3 text-[10px] text-slate-600 tracking-wider">

            <span>ASTRAL · MARS MISSION PLANNING</span>

            <span>PLANETARY DATA INTEGRATION IN PROGRESS</span>

          </footer>

        </main>

      </div>

    </div>
  )
}

export default App
