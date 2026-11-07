
import { useEffect, useState } from 'react'
import type { ElementType } from 'react'

import {
    Activity,
    AlertCircle,
    Crosshair,
    Gauge,
    Info,
    Layers3,
    Loader2,
    Navigation,
    RefreshCw,
    Route,
    Satellite,
} from 'lucide-react'

import {
    CircleMarker,
    GeoJSON,
    ImageOverlay,
    MapContainer,
    TileLayer,
    Tooltip,
    useMap,
} from 'react-leaflet'

import type { Feature, LineString } from 'geojson'

import 'leaflet/dist/leaflet.css'

// --------------------------------------------------
// ASTRAL - ROUTE PLANNER
// --------------------------------------------------

const API_URL = 'http://127.0.0.1:8000/api/route/astar'

const OVERLAY_METADATA_URL =
    '/terrain/jezero_overlay_metadata.json'

// --------------------------------------------------
// TYPES
// --------------------------------------------------

type Coordinate = [number, number]

type GeographicBounds = [
    [number, number],
    [number, number],
]

type OverlayMetadata = {
    region: string
    coordinate_system: string
    overlays: {
        slope: {
            image: string
            width: number
            height: number
            value_min: number
            value_max: number
            display_min: number
            display_max: number
            valid_pixels: number
            bounds: GeographicBounds
        }
        traversability: {
            image: string
            width: number
            height: number
            value_min: number
            value_max: number
            display_min: number
            display_max: number
            valid_pixels: number
            bounds: GeographicBounds
        }
    }
}

type AStarRouteResponse = {
    region: string
    algorithm: string
    route_type: string

    total_distance_metres: number
    total_distance_km: number
    total_cumulative_cost: number
    average_terrain_cost: number

    point_count: number

    start_coordinates: Coordinate
    destination_coordinates: Coordinate

    geometry: LineString

    model_note: string
}

// --------------------------------------------------
// MAP BOUNDS CONTROLLER
// --------------------------------------------------

function RouteBoundsController({
    coordinates,
}: {
    coordinates: Coordinate[]
}) {
    const map = useMap()

    useEffect(() => {
        if (coordinates.length < 2) return

        const positions: [number, number][] = coordinates.map(
            ([longitude, latitude]) => [latitude, longitude],
        )

        map.fitBounds(positions, {
            padding: [40, 40],
            maxZoom: 7,
        })
    }, [map, coordinates])

    return null
}

// --------------------------------------------------
// REUSABLE METRIC CARD
// --------------------------------------------------

function MetricCard({
    title,
    value,
    unit,
    icon: Icon,
    description,
}: {
    title: string
    value: string
    unit?: string
    icon: ElementType
    description: string
}) {
    return (
        <div className="min-w-0 rounded-xl border border-white/10 bg-[#101b2b] p-4 transition hover:border-cyan-400/30">
            <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-medium tracking-wide text-slate-400">
                    {title}
                </p>

                <Icon size={17} className="shrink-0 text-cyan-400" />
            </div>

            <div className="mt-3 flex flex-wrap items-baseline gap-1.5">
                <span className="text-2xl font-semibold tracking-tight text-white">
                    {value}
                </span>

                {unit && (
                    <span className="text-xs text-slate-400">
                        {unit}
                    </span>
                )}
            </div>

            <p className="mt-2 text-xs text-slate-500">
                {description}
            </p>
        </div>
    )
}

// --------------------------------------------------
// COORDINATE DISPLAY
// --------------------------------------------------

function CoordinateDisplay({
    title,
    coordinates,
    color,
}: {
    title: string
    coordinates: Coordinate
    color: string
}) {
    const [longitude, latitude] = coordinates

    return (
        <div className="rounded-xl border border-white/10 bg-[#101b2b] p-4">
            <div className="mb-3 flex items-center gap-2">
                <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: color }}
                />

                <p className="text-sm font-medium text-slate-200">
                    {title}
                </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div>
                    <p className="text-xs text-slate-500">
                        Latitude
                    </p>

                    <p className="mt-1 break-all font-mono text-sm text-white">
                        {latitude.toFixed(6)}°
                    </p>
                </div>

                <div>
                    <p className="text-xs text-slate-500">
                        Longitude
                    </p>

                    <p className="mt-1 break-all font-mono text-sm text-white">
                        {longitude.toFixed(6)}°
                    </p>
                </div>
            </div>
        </div>
    )
}

// --------------------------------------------------
// TERRAIN OVERLAY TOGGLE
// --------------------------------------------------

function OverlayToggle({
    title,
    description,
    enabled,
    onToggle,
    color,
}: {
    title: string
    description: string
    enabled: boolean
    onToggle: () => void
    color: string
}) {
    return (
        <button
            type="button"
            onClick={onToggle}
            aria-pressed={enabled}
            className={`flex min-w-0 items-center gap-3 rounded-xl border p-3 text-left transition ${
                enabled
                    ? 'border-cyan-400/40 bg-cyan-400/10'
                    : 'border-white/10 bg-[#101b2b] hover:border-white/20'
            }`}
        >
            <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: color }}
            />

            <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-white">
                    {title}
                </span>

                <span className="mt-0.5 block text-xs text-slate-500">
                    {description}
                </span>
            </span>

            <span
                className={`relative h-5 w-9 shrink-0 rounded-full transition ${
                    enabled ? 'bg-cyan-500' : 'bg-slate-700'
                }`}
            >
                <span
                    className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${
                        enabled ? 'left-[18px]' : 'left-0.5'
                    }`}
                />
            </span>
        </button>
    )
}

// --------------------------------------------------
// TERRAIN LEGEND
// --------------------------------------------------

function TerrainLegend({
    type,
}: {
    type: 'slope' | 'traversability'
}) {
    const isSlope = type === 'slope'

    return (
        <div className="rounded-xl border border-white/10 bg-[#101b2b] p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-white">
                    {isSlope ? 'Slope (degrees)' : 'Traversability Cost'}
                </p>

                <span className="text-[10px] text-slate-500">
                    {isSlope ? '0° – 60°+' : 'Low – High'}
                </span>
            </div>

            <div
                className={`h-2.5 rounded-full ${
                    isSlope
                        ? 'bg-gradient-to-r from-green-500 via-lime-400 via-yellow-400 via-orange-500 to-red-900'
                        : 'bg-gradient-to-r from-green-500 via-lime-400 via-yellow-400 via-orange-500 to-red-500'
                }`}
            />

            <div className="mt-2 flex justify-between text-[10px] text-slate-400">
                <span>{isSlope ? 'Gentle' : 'Lower cost'}</span>
                <span>{isSlope ? 'Steep' : 'Higher cost'}</span>
            </div>

            <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
                {isSlope
                    ? 'Colour represents terrain gradient. Higher values indicate steeper terrain.'
                    : 'Colour represents the modelled traversal cost. Higher values indicate greater modelled difficulty.'}
            </p>
        </div>
    )
}

// --------------------------------------------------
// MAIN COMPONENT
// --------------------------------------------------

export default function RoutePlanner() {
    const [routeData, setRouteData] =
        useState<AStarRouteResponse | null>(null)

    const [loading, setLoading] = useState(true)

    const [error, setError] = useState<string | null>(null)

    const [reloadKey, setReloadKey] = useState(0)

    // Terrain overlay state
    const [overlayMetadata, setOverlayMetadata] =
        useState<OverlayMetadata | null>(null)

    const [overlayError, setOverlayError] =
        useState<string | null>(null)

    const [showSlope, setShowSlope] = useState(false)

    const [showTraversability, setShowTraversability] =
        useState(false)

    // ------------------------------------------------
    // FETCH ROUTE DATA
    // ------------------------------------------------

    useEffect(() => {
        const controller = new AbortController()

        async function fetchRoute() {
            try {
                setLoading(true)
                setError(null)

                const response = await fetch(API_URL, {
                    signal: controller.signal,
                })

                if (!response.ok) {
                    let message = `Server returned status ${response.status}`

                    try {
                        const errorData = await response.json()
                        message = errorData.detail || message
                    } catch {
                        // Keep original error message.
                    }

                    throw new Error(message)
                }

                const data: AStarRouteResponse =
                    await response.json()

                if (
                    !data.geometry ||
                    data.geometry.type !== 'LineString' ||
                    data.geometry.coordinates.length < 2
                ) {
                    throw new Error(
                        'The API returned invalid route geometry.',
                    )
                }

                setRouteData(data)
            } catch (err) {
                if (
                    err instanceof Error &&
                    err.name === 'AbortError'
                ) {
                    return
                }

                setError(
                    err instanceof Error
                        ? err.message
                        : 'Unable to load route data.',
                )
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false)
                }
            }
        }

        fetchRoute()

        return () => controller.abort()
    }, [reloadKey])

    // ------------------------------------------------
    // FETCH TERRAIN OVERLAY METADATA
    // ------------------------------------------------

    useEffect(() => {
        const controller = new AbortController()

        async function fetchOverlayMetadata() {
            try {
                setOverlayError(null)

                const response = await fetch(
                    OVERLAY_METADATA_URL,
                    { signal: controller.signal },
                )

                if (!response.ok) {
                    throw new Error(
                        `Overlay metadata unavailable (${response.status})`,
                    )
                }

                const data: OverlayMetadata = await response.json()

                if (
                    !data.overlays?.slope?.bounds ||
                    !data.overlays?.traversability?.bounds
                ) {
                    throw new Error(
                        'Invalid terrain overlay metadata.',
                    )
                }

                setOverlayMetadata(data)
            } catch (err) {
                if (
                    err instanceof Error &&
                    err.name === 'AbortError'
                ) {
                    return
                }

                setOverlayError(
                    err instanceof Error
                        ? err.message
                        : 'Unable to load overlay metadata.',
                )
            }
        }

        fetchOverlayMetadata()

        return () => controller.abort()
    }, [])

    // ------------------------------------------------
    // LOADING STATE
    // ------------------------------------------------

    if (loading) {
        return (
            <div className="flex min-h-[500px] flex-col items-center justify-center gap-4 rounded-2xl border border-white/10 bg-[#0b1422]">
                <Loader2
                    size={36}
                    className="animate-spin text-cyan-400"
                />

                <div className="text-center">
                    <p className="font-medium text-white">
                        Loading A* Route
                    </p>

                    <p className="mt-1 text-sm text-slate-400">
                        Retrieving Mars terrain navigation data...
                    </p>
                </div>
            </div>
        )
    }

    // ------------------------------------------------
    // ERROR STATE
    // ------------------------------------------------

    if (error || !routeData) {
        return (
            <div className="flex min-h-[450px] flex-col items-center justify-center rounded-2xl border border-red-400/20 bg-[#0b1422] p-6 text-center">
                <AlertCircle
                    size={40}
                    className="text-red-400"
                />

                <h2 className="mt-4 text-lg font-semibold text-white">
                    Unable to Load Route
                </h2>

                <p className="mt-2 max-w-md text-sm text-slate-400">
                    {error || 'No route information is currently available.'}
                </p>

                <p className="mt-3 text-xs text-slate-500">
                    Make sure your FastAPI backend is running.
                </p>

                <button
                    onClick={() =>
                        setReloadKey((previous) => previous + 1)
                    }
                    className="mt-6 flex items-center gap-2 rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-300 transition hover:bg-cyan-400/20"
                >
                    <RefreshCw size={15} />
                    Retry
                </button>
            </div>
        )
    }

    // ------------------------------------------------
    // ROUTE DATA
    // ------------------------------------------------

    const coordinates: Coordinate[] =
        routeData.geometry.coordinates.map(
            (position) => [
                Number(position[0]),
                Number(position[1]),
            ] as Coordinate,
        )

    const routeFeature: Feature<LineString> = {
        type: 'Feature',
        properties: {},
        geometry: routeData.geometry,
    }

    const [startLongitude, startLatitude] =
        routeData.start_coordinates

    const [endLongitude, endLatitude] =
        routeData.destination_coordinates

    // ------------------------------------------------
    // MAIN UI
    // ------------------------------------------------

    return (
        <div className="w-full min-w-0 max-w-full space-y-6 overflow-x-clip">

            {/* HEADER */}

            <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                    <div className="mb-2 flex items-center gap-2">
                        <Route size={18} className="text-cyan-400" />

                        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">
                            ASTRAL / Navigation Intelligence
                        </span>
                    </div>

                    <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                        Mars Route Planner
                    </h1>

                    <p className="mt-2 text-sm text-slate-400">
                        Terrain-aware route analysis across Jezero Crater.
                    </p>
                </div>

                <button
                    onClick={() =>
                        setReloadKey((previous) => previous + 1)
                    }
                    className="flex w-fit items-center gap-2 rounded-lg border border-white/10 bg-[#101b2b] px-4 py-2.5 text-sm text-slate-300 transition hover:border-cyan-400/40 hover:text-cyan-300"
                >
                    <RefreshCw size={15} />
                    Refresh Route
                </button>
            </section>

            {/* STATUS */}

            <section className="flex flex-wrap items-center gap-3 rounded-xl border border-emerald-400/20 bg-emerald-400/5 px-4 py-3">
                <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
                </span>

                <span className="text-sm font-medium text-emerald-300">
                    Route Data Loaded
                </span>

                <span className="text-xs text-slate-500">•</span>

                <span className="text-xs text-slate-400">
                    {routeData.algorithm} algorithm
                </span>

                <span className="text-xs text-slate-500">•</span>

                <span className="text-xs text-slate-400">
                    {routeData.region}
                </span>
            </section>

            {/* METRIC CARDS */}

            <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                    title="TOTAL DISTANCE"
                    value={routeData.total_distance_km.toFixed(2)}
                    unit="km"
                    icon={Route}
                    description="Calculated route length"
                />

                <MetricCard
                    title="WAYPOINTS"
                    value={routeData.point_count.toLocaleString()}
                    icon={Crosshair}
                    description="Route geometry coordinates"
                />

                <MetricCard
                    title="AVERAGE TERRAIN COST"
                    value={routeData.average_terrain_cost.toFixed(2)}
                    icon={Gauge}
                    description="Mean terrain traversal cost"
                />

                <MetricCard
                    title="CUMULATIVE COST"
                    value={routeData.total_cumulative_cost.toLocaleString(
                        'en-US',
                        { maximumFractionDigits: 2 },
                    )}
                    icon={Activity}
                    description="Accumulated path cost"
                />
            </section>

            {/* TERRAIN OVERLAY CONTROLS */}

            <section className="rounded-2xl border border-white/10 bg-[#0b1422] p-4 sm:p-5">
                <div className="mb-4 flex items-center gap-3">
                    <Layers3
                        size={19}
                        className="text-cyan-400"
                    />

                    <div>
                        <h2 className="font-semibold text-white">
                            Terrain Visualization Layers
                        </h2>

                        <p className="mt-1 text-xs text-slate-500">
                            Toggle scientific raster overlays on the Mars map.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <OverlayToggle
                        title="Slope Analysis"
                        description="Terrain gradient in degrees"
                        enabled={showSlope}
                        onToggle={() =>
                            setShowSlope((previous) => !previous)
                        }
                        color="#f97316"
                    />

                    <OverlayToggle
                        title="Traversability Analysis"
                        description="Modelled terrain traversal cost"
                        enabled={showTraversability}
                        onToggle={() =>
                            setShowTraversability(
                                (previous) => !previous,
                            )
                        }
                        color="#22c55e"
                    />
                </div>

                {overlayError && (
                    <div className="mt-3 flex items-start gap-2 rounded-lg border border-orange-400/20 bg-orange-400/5 p-3">
                        <AlertCircle
                            size={16}
                            className="mt-0.5 shrink-0 text-orange-400"
                        />

                        <p className="text-xs text-orange-300">
                            Terrain overlay metadata could not be loaded:
                            {' '}{overlayError}
                        </p>
                    </div>
                )}

                {!overlayMetadata && !overlayError && (
                    <p className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                        <Loader2
                            size={13}
                            className="animate-spin"
                        />
                        Loading terrain layer metadata...
                    </p>
                )}

                {overlayMetadata && (
                    <p className="mt-3 text-[11px] text-emerald-400">
                        Terrain datasets ready · {overlayMetadata.region}
                    </p>
                )}
            </section>

            {/* MAP SECTION */}

            <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#0b1422]">
                <div className="flex flex-col justify-between gap-3 border-b border-white/10 p-4 sm:flex-row sm:items-center">
                    <div>
                        <div className="flex items-center gap-2">
                            <Satellite
                                size={17}
                                className="text-cyan-400"
                            />

                            <h2 className="font-semibold text-white">
                                A* Navigation Map
                            </h2>
                        </div>

                        <p className="mt-1 text-xs text-slate-500">
                            Jezero Crater • Mars planetary basemap
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs">
                        <div className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                            <span className="text-slate-400">Start</span>
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                            <span className="text-slate-400">Destination</span>
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="h-1 w-5 rounded-full bg-cyan-400" />
                            <span className="text-slate-400">A* Route</span>
                        </div>
                    </div>
                </div>

                <div className="relative h-[420px] w-full sm:h-[520px]">
                    <MapContainer
                        center={[
                            startLatitude,
                            startLongitude,
                        ]}
                        zoom={5}
                        minZoom={2}
                        maxZoom={18}
                        scrollWheelZoom={true}
                        className="h-full w-full bg-[#101b2b]"
                    >
                        <TileLayer
                            url="https://cartocdn-gusc.global.ssl.fastly.net/opmbuilder/api/v1/map/named/opm-mars-basemap-v0-2/all/{z}/{x}/{y}.png"
                            attribution="Map data: OpenPlanetaryMap"
                            maxZoom={18}
                        />

                        {/* TRAVERSABILITY OVERLAY */}

                        {overlayMetadata && showTraversability && (
                            <ImageOverlay
                                url={`/terrain/${overlayMetadata.overlays.traversability.image}`}
                                bounds={
                                    overlayMetadata.overlays.traversability.bounds
                                }
                                opacity={0.85}
                                zIndex={300}
                                interactive={false}
                            />
                        )}

                        {/* SLOPE OVERLAY */}

                        {overlayMetadata && showSlope && (
                            <ImageOverlay
                                url={`/terrain/${overlayMetadata.overlays.slope.image}`}
                                bounds={
                                    overlayMetadata.overlays.slope.bounds
                                }
                                opacity={0.85}
                                zIndex={310}
                                interactive={false}
                            />
                        )}

                        {/* A* ROUTE */}

                        <GeoJSON
                            data={routeFeature}
                            style={{
                                color: '#22d3ee',
                                weight: 4,
                                opacity: 0.95,
                                lineCap: 'round',
                                lineJoin: 'round',
                            }}
                        />

                        {/* START MARKER */}

                        <CircleMarker
                            center={[
                                startLatitude,
                                startLongitude,
                            ]}
                            radius={8}
                            pathOptions={{
                                color: '#34d399',
                                fillColor: '#34d399',
                                fillOpacity: 1,
                                weight: 2,
                            }}
                        >
                            <Tooltip direction="top">
                                Starting Location
                            </Tooltip>
                        </CircleMarker>

                        {/* DESTINATION MARKER */}

                        <CircleMarker
                            center={[
                                endLatitude,
                                endLongitude,
                            ]}
                            radius={8}
                            pathOptions={{
                                color: '#f87171',
                                fillColor: '#f87171',
                                fillOpacity: 1,
                                weight: 2,
                            }}
                        >
                            <Tooltip direction="top">
                                Destination
                            </Tooltip>
                        </CircleMarker>

                        <RouteBoundsController
                            coordinates={coordinates}
                        />
                    </MapContainer>

                    {/* MAP LABEL */}

                    <div className="pointer-events-none absolute bottom-4 left-4 z-[1000] rounded-lg border border-white/10 bg-[#08111f]/90 px-3 py-2 backdrop-blur-md">
                        <p className="text-[10px] uppercase tracking-widest text-slate-500">
                            Navigation Algorithm
                        </p>

                        <p className="mt-1 text-sm font-semibold text-cyan-300">
                            A* Pathfinding
                        </p>
                    </div>
                </div>

                {/* ACTIVE OVERLAY LEGENDS */}

                {(showSlope || showTraversability) && (
                    <div className="grid grid-cols-1 gap-3 border-t border-white/10 p-4 sm:grid-cols-2">
                        {showSlope && (
                            <TerrainLegend type="slope" />
                        )}

                        {showTraversability && (
                            <TerrainLegend type="traversability" />
                        )}
                    </div>
                )}
            </section>

            {/* ROUTE DETAILS */}

            <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <CoordinateDisplay
                    title="Starting Location"
                    coordinates={routeData.start_coordinates}
                    color="#34d399"
                />

                <CoordinateDisplay
                    title="Destination Location"
                    coordinates={routeData.destination_coordinates}
                    color="#f87171"
                />
            </section>

            {/* ALGORITHM INFORMATION */}

            <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-[#101b2b] p-5">
                    <div className="flex items-center gap-2">
                        <Navigation
                            size={18}
                            className="text-cyan-400"
                        />

                        <h3 className="font-semibold text-white">
                            Route Configuration
                        </h3>
                    </div>

                    <div className="mt-5 space-y-4">
                        <div className="flex items-center justify-between gap-3">
                            <span className="text-sm text-slate-400">
                                Algorithm
                            </span>

                            <span className="text-sm font-medium text-cyan-300">
                                {routeData.algorithm}
                            </span>
                        </div>

                        <div className="h-px bg-white/5" />

                        <div className="flex items-center justify-between gap-3">
                            <span className="text-sm text-slate-400">
                                Route Type
                            </span>

                            <span className="text-right text-sm text-white">
                                {routeData.route_type}
                            </span>
                        </div>

                        <div className="h-px bg-white/5" />

                        <div className="flex items-center justify-between gap-3">
                            <span className="text-sm text-slate-400">
                                Route Points
                            </span>

                            <span className="text-sm text-white">
                                {routeData.point_count}
                            </span>
                        </div>

                        <div className="h-px bg-white/5" />

                        <div className="flex items-center justify-between gap-3">
                            <span className="text-sm text-slate-400">
                                Distance
                            </span>

                            <span className="text-sm text-white">
                                {routeData.total_distance_metres.toLocaleString(
                                    'en-US',
                                    { maximumFractionDigits: 2 },
                                )}{' '}
                                m
                            </span>
                        </div>
                    </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-[#101b2b] p-5">
                    <div className="flex items-center gap-2">
                        <Gauge
                            size={18}
                            className="text-orange-400"
                        />

                        <h3 className="font-semibold text-white">
                            Terrain Cost Analysis
                        </h3>
                    </div>

                    <div className="mt-5">
                        <div className="flex items-end justify-between gap-3">
                            <div>
                                <p className="text-xs text-slate-500">
                                    Average Terrain Cost
                                </p>

                                <p className="mt-2 text-3xl font-semibold text-white">
                                    {routeData.average_terrain_cost.toFixed(2)}
                                </p>
                            </div>

                            <Activity
                                size={30}
                                className="mb-1 text-orange-400"
                            />
                        </div>

                        <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
                            <div
                                className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-orange-400"
                                style={{
                                    width: `${Math.min(
                                        (routeData.average_terrain_cost / 5) * 100,
                                        100,
                                    )}%`,
                                }}
                            />
                        </div>

                        <p className="mt-3 text-xs leading-relaxed text-slate-400">
                            The terrain cost represents the average traversal
                            cost assigned to the cells along the calculated
                            route. It is a model value, not a measured rover
                            performance or safety score.
                        </p>
                    </div>
                </div>
            </section>

            {/* SCIENTIFIC DISCLAIMER */}

            <section className="rounded-xl border border-orange-400/20 bg-orange-400/5 p-4">
                <div className="flex items-start gap-3">
                    <Info
                        size={19}
                        className="mt-0.5 shrink-0 text-orange-400"
                    />

                    <div>
                        <h3 className="text-sm font-semibold text-orange-300">
                            Research Model Disclaimer
                        </h3>

                        <p className="mt-2 text-xs leading-relaxed text-slate-400">
                            {routeData.model_note}
                        </p>

                        <p className="mt-2 text-xs leading-relaxed text-slate-500">
                            This route is intended for terrain analysis and
                            research demonstration. It has not been validated
                            for operational rover navigation or mission safety.
                        </p>
                    </div>
                </div>
            </section>
        </div>
    )
}
