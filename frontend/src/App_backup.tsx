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

function CoordinateTracker({
  onCoordinatesChange,
}: {
  onCoordinatesChange: (coordinates: [number, number]) => void
}) {
  useMapEvents({
    mousemove(event) {
      onCoordinatesChange([
        event.latlng.lat,
        event.latlng.lng,
      ])
    },

    click(event) {
      onCoordinatesChange([
        event.latlng.lat,
        event.latlng.lng,
      ])
    },
  })

  return null
}

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

function MarsMap() {
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

        <CoordinateTracker onCoordinatesChange={setCoordinates} />

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
          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs backdrop-blur-md transition-all ${
            showSlope
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
          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs backdrop-blur-md transition-all ${
            showRoute
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

function App() {
  const [activeSection, setActiveSection] =
    useState<Section>('Mars Explorer')

  return (
    <div className="min-h-screen bg-[#080D18] text-slate-100">

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
                  className={`w-full flex items-center gap-3 rounded-lg px-4 py-3 text-sm text-left transition-all ${
                    isActive
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
        <main className="flex-1 min-w-0 p-5 md:p-8">

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

                <MarsMap />

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

                <section className="rounded-2xl border border-white/10 bg-[#0D1727] p-5">

                  <div className="flex items-center gap-2 mb-4">
                    <Layers3 size={15} className="text-orange-400" />

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
                        className={`text-[9px] ${
                          layer.status === 'PROCESSED'
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

          ) : (

            <section className="rounded-2xl border border-white/10 bg-[#0D1727] p-8 min-h-[420px] flex flex-col justify-center">

              <div className="w-14 h-14 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mb-6">

                {activeSection === 'Terrain Analysis' && (
                  <Mountain size={26} className="text-orange-400" />
                )}

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