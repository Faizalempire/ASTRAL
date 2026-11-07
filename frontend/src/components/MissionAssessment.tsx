
import { useEffect, useState } from 'react'
import type { ElementType } from 'react'

import {
    ClipboardCheck,
    Mountain,
    ShieldAlert,
    Route,
    Activity,
    CheckCircle2,
    AlertTriangle,
    Info,
    Gauge,
    Loader2,
    RefreshCw,
    MapPin,
    Compass,
    TrendingUp,
} from 'lucide-react'

import type { TerrainResponse } from '../services/terrainService'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'

const REGIONAL_API_URL = `${API_BASE_URL}/api/terrain/analysis`
const ROUTE_API_URL = `${API_BASE_URL}/api/route/astar`

interface TerrainClass {
    terrain_class: string
    slope_range: string
    traversability_cost: number
    pixel_count: number
    percentage: number
    area_km2: number
}

interface TerrainAnalysis {
    region: string
    analysis_scope: string
    dataset: {
        elevation_source: string
        slope_source: string
        traversability_source: string
        pixel_width_m: number
        pixel_height_m: number
        pixel_area_km2: number
    }
    elevation: {
        minimum_m: number
        maximum_m: number
        mean_m: number
        standard_deviation_m: number
        valid_pixels: number
    }
    slope: {
        minimum_degrees: number
        maximum_degrees: number
        mean_degrees: number
        standard_deviation_degrees: number
        valid_pixels: number
    }
    terrain_distribution: TerrainClass[]
    traversability_distribution: {
        cost: number
        pixel_count: number
        percentage: number
    }[]
    model_note: string
}

interface RouteAnalysis {
    region: string
    algorithm: string
    route_type: string
    total_distance_metres: number
    total_distance_km: number
    total_cumulative_cost: number
    average_terrain_cost: number
    point_count: number
    start_coordinates: number[]
    destination_coordinates: number[]
    model_note: string
}

interface MissionAssessmentProps {
    result: TerrainResponse | null
    loading: boolean
    error: string | null
}

const terrainStyles = [
    {
        name: 'Gentle terrain',
        range: '0–5°',
        level: 'Low',
        colour: 'bg-emerald-500',
    },
    {
        name: 'Moderate terrain',
        range: '5–15°',
        level: 'Moderate',
        colour: 'bg-lime-500',
    },
    {
        name: 'Steep terrain',
        range: '15–25°',
        level: 'Elevated',
        colour: 'bg-yellow-500',
    },
    {
        name: 'Very steep terrain',
        range: '25–35°',
        level: 'High',
        colour: 'bg-orange-500',
    },
    {
        name: 'Extremely steep',
        range: '35°+',
        level: 'Very high',
        colour: 'bg-red-500',
    },
]

function getTerrainIndex(className: string, index: number) {
    const name = className.toLowerCase()

    if (name.includes('extreme')) return 4
    if (name.includes('very')) return 3
    if (name.includes('moderate')) return 1
    if (name.includes('gentle')) return 0
    if (name.includes('steep')) return 2

    return index
}

function MetricCard({
    title,
    value,
    unit,
    description,
    icon: Icon,
}: {
    title: string
    value: string
    unit: string
    description: string
    icon: ElementType
}) {
    return (
        <div className="w-full min-w-0 rounded-xl border border-white/10 bg-[#101C2D] p-5">
            <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] tracking-widest text-slate-500">
                    {title}
                </p>
                <Icon size={17} className="shrink-0 text-cyan-400" />
            </div>

            <div className="mt-4 flex flex-wrap items-baseline gap-2">
                <span className="text-3xl font-semibold text-white">
                    {value}
                </span>
                <span className="text-xs text-slate-400">{unit}</span>
            </div>

            <p className="mt-2 text-xs leading-5 text-slate-500">
                {description}
            </p>
        </div>
    )
}

function SectionHeading({
    icon: Icon,
    title,
    description,
}: {
    icon: ElementType
    title: string
    description?: string
}) {
    return (
        <div className="mb-4">
            <div className="flex items-center gap-2">
                <Icon size={17} className="text-orange-400" />
                <h3 className="text-sm font-semibold text-white">{title}</h3>
            </div>

            {description && (
                <p className="mt-2 text-xs leading-5 text-slate-500">
                    {description}
                </p>
            )}
        </div>
    )
}

export default function MissionAssessment({
    result,
    loading: locationLoading,
    error: locationError,
}: MissionAssessmentProps) {
    const [analysis, setAnalysis] = useState<TerrainAnalysis | null>(null)
    const [regionalLoading, setRegionalLoading] = useState(true)
    const [regionalError, setRegionalError] = useState<string | null>(null)

    const [route, setRoute] = useState<RouteAnalysis | null>(null)
    const [routeLoading, setRouteLoading] = useState(true)
    const [routeError, setRouteError] = useState<string | null>(null)

    async function fetchRegionalAnalysis(signal?: AbortSignal) {
        try {
            setRegionalLoading(true)
            setRegionalError(null)

            const response = await fetch(REGIONAL_API_URL, { signal })

            if (!response.ok) {
                throw new Error(`Regional API returned status ${response.status}`)
            }

            const data: TerrainAnalysis = await response.json()
            setAnalysis(data)
        } catch (err) {
            if (err instanceof Error && err.name === 'AbortError') return

            setRegionalError(
                err instanceof Error
                    ? err.message
                    : 'Unable to load regional terrain analysis.',
            )
        } finally {
            if (!signal?.aborted) {
                setRegionalLoading(false)
            }
        }
    }

    async function fetchRouteAnalysis(signal?: AbortSignal) {
        try {
            setRouteLoading(true)
            setRouteError(null)

            const response = await fetch(ROUTE_API_URL, { signal })

            if (!response.ok) {
                throw new Error(`Route API returned status ${response.status}`)
            }

            const data: RouteAnalysis = await response.json()
            setRoute(data)
        } catch (err) {
            if (err instanceof Error && err.name === 'AbortError') return

            setRouteError(
                err instanceof Error
                    ? err.message
                    : 'Unable to load A* route statistics.',
            )
        } finally {
            if (!signal?.aborted) {
                setRouteLoading(false)
            }
        }
    }

    useEffect(() => {
        const controller = new AbortController()

        fetchRegionalAnalysis(controller.signal)
        fetchRouteAnalysis(controller.signal)

        return () => controller.abort()
    }, [])

    const terrainRisks = analysis
        ? terrainStyles.map((style, index) => {
            const terrain = analysis.terrain_distribution.find(
                (item, itemIndex) =>
                    getTerrainIndex(item.terrain_class, itemIndex) === index,
            )

            return {
                ...style,
                percentage: terrain?.percentage ?? 0,
            }
        })
        : []

    const gentleModerate =
        terrainRisks.length > 0
            ? terrainRisks[0].percentage + terrainRisks[1].percentage
            : 0

    const steepCoverage = terrainRisks
        .slice(2)
        .reduce((total, terrain) => total + terrain.percentage, 0)

    const locationAvailable = result !== null
    const routeAvailable = route !== null

    return (
        <div className="w-full min-w-0 max-w-full space-y-6 overflow-x-clip">

            {/* HEADER */}
            <section className="rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/[0.08] to-[#0D1727] p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 text-cyan-400">
                            <ClipboardCheck size={17} />
                            <p className="text-[10px] tracking-[0.2em]">
                                PRELIMINARY MISSION REVIEW
                            </p>
                        </div>

                        <h3 className="mt-4 text-2xl font-semibold text-white">
                            Jezero Crater Assessment
                        </h3>

                        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                            A combined assessment of regional terrain conditions,
                            individual locations and the experimental A* route,
                            using data retrieved from the ASTRAL backend.
                        </p>
                    </div>

                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3">
                        <div className="flex items-center gap-2">
                            <Activity size={15} className="text-emerald-400" />
                            <span className="text-[10px] tracking-wider text-emerald-400">
                                RESEARCH STATUS
                            </span>
                        </div>
                        <p className="mt-2 text-sm font-semibold text-white">
                            Preliminary
                        </p>
                    </div>
                </div>
            </section>

            {/* REGIONAL ASSESSMENT */}
            <section className="space-y-5">
                <SectionHeading
                    icon={Mountain}
                    title="01 · Regional Assessment"
                    description="Terrain statistics across the available Jezero Crater DEM coverage."
                />

                {regionalLoading && (
                    <div className="flex min-h-[180px] flex-col items-center justify-center gap-3 rounded-xl border border-white/10 bg-[#0D1727]">
                        <Loader2 size={26} className="animate-spin text-cyan-400" />
                        <p className="text-sm text-slate-400">
                            Loading regional terrain statistics...
                        </p>
                    </div>
                )}

                {regionalError && (
                    <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5">
                        <div className="flex items-center gap-2 text-red-400">
                            <AlertTriangle size={17} />
                            <p className="text-sm font-medium">
                                Regional analysis unavailable
                            </p>
                        </div>

                        <p className="mt-2 text-xs text-slate-400">
                            {regionalError}
                        </p>

                        <button
                            onClick={() => fetchRegionalAnalysis()}
                            className="mt-4 flex items-center gap-2 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-300 transition hover:bg-cyan-500/20"
                        >
                            <RefreshCw size={14} />
                            Retry regional analysis
                        </button>
                    </div>
                )}

                {analysis && !regionalLoading && (
                    <>
                        <div className="grid w-full min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                            <MetricCard
                                title="LOW-SLOPE COVERAGE"
                                value={gentleModerate.toFixed(2)}
                                unit="%"
                                description="Gentle and moderate terrain combined"
                                icon={Mountain}
                            />

                            <MetricCard
                                title="MEAN REGIONAL SLOPE"
                                value={analysis.slope.mean_degrees.toFixed(2)}
                                unit="degrees"
                                description="Average slope across valid DEM pixels"
                                icon={Gauge}
                            />

                            <MetricCard
                                title="REGIONAL ELEVATION"
                                value={analysis.elevation.mean_m.toFixed(0)}
                                unit="m"
                                description="Mean elevation across valid pixels"
                                icon={TrendingUp}
                            />

                            <MetricCard
                                title="VALID ELEVATION PIXELS"
                                value={analysis.elevation.valid_pixels.toLocaleString()}
                                unit="pixels"
                                description="Pixels included in the elevation analysis"
                                icon={Activity}
                            />
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-[#0D1727] p-6">
                            <div className="flex items-center gap-2">
                                <ShieldAlert size={17} className="text-orange-400" />
                                <h3 className="text-sm font-semibold text-white">
                                    Terrain Risk Distribution
                                </h3>
                            </div>

                            <p className="mt-2 text-xs text-slate-500">
                                Regional surface distribution classified by slope angle.
                            </p>

                            <div className="mt-6 space-y-6">
                                {terrainRisks.map((terrain) => (
                                    <div key={terrain.name}>
                                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                                            <div>
                                                <p className="text-sm text-slate-200">
                                                    {terrain.name}
                                                </p>
                                                <p className="text-[10px] text-slate-500">
                                                    {terrain.range}
                                                </p>
                                            </div>

                                            <div className="text-right">
                                                <p className="text-sm font-semibold text-white">
                                                    {terrain.percentage.toFixed(2)}%
                                                </p>
                                                <p className="text-[10px] text-slate-500">
                                                    {terrain.level} concern
                                                </p>
                                            </div>
                                        </div>

                                        <div className="h-2 overflow-hidden rounded-full bg-white/5">
                                            <div
                                                className={`h-full rounded-full ${terrain.colour}`}
                                                style={{
                                                    width: `${Math.min(100, Math.max(0, terrain.percentage))}%`,
                                                }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="grid min-w-0 grid-cols-1 gap-5 lg:grid-cols-2">
                            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-6">
                                <div className="flex items-center gap-2">
                                    <CheckCircle2 size={17} className="text-emerald-400" />
                                    <h3 className="text-sm font-semibold text-white">
                                        Positive Indicators
                                    </h3>
                                </div>

                                <div className="mt-5 space-y-4">
                                    <div>
                                        <p className="text-sm text-emerald-300">
                                            Predominantly lower slopes
                                        </p>
                                        <p className="mt-1 text-xs leading-5 text-slate-400">
                                            {gentleModerate.toFixed(2)}% of the analysed
                                            terrain falls within the gentle and moderate
                                            slope categories.
                                        </p>
                                    </div>

                                    <div>
                                        <p className="text-sm text-emerald-300">
                                            Terrain data available
                                        </p>
                                        <p className="mt-1 text-xs leading-5 text-slate-400">
                                            The regional analysis uses{' '}
                                            {analysis.elevation.valid_pixels.toLocaleString()}{' '}
                                            valid elevation pixels.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-2xl border border-orange-500/20 bg-orange-500/[0.04] p-6">
                                <div className="flex items-center gap-2">
                                    <AlertTriangle size={17} className="text-orange-400" />
                                    <h3 className="text-sm font-semibold text-white">
                                        Potential Concerns
                                    </h3>
                                </div>

                                <div className="mt-5 space-y-4">
                                    <div>
                                        <p className="text-sm text-orange-300">
                                            Steep surface sections
                                        </p>
                                        <p className="mt-1 text-xs leading-5 text-slate-400">
                                            {steepCoverage.toFixed(2)}% of the analysed
                                            terrain is classified above 15° slope.
                                        </p>
                                    </div>

                                    <div>
                                        <p className="text-sm text-orange-300">
                                            Extreme local slopes
                                        </p>
                                        <p className="mt-1 text-xs leading-5 text-slate-400">
                                            The maximum recorded regional slope is{' '}
                                            {analysis.slope.maximum_degrees.toFixed(2)}°.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </section>

            {/* LOCATION ASSESSMENT */}
            <section className="space-y-4">
                <SectionHeading
                    icon={MapPin}
                    title="02 · Location Assessment"
                    description="Terrain conditions at the most recently analysed coordinates in Mars Explorer or Science Explorer."
                />

                {locationLoading && (
                    <div className="flex min-h-[130px] items-center justify-center gap-3 rounded-xl border border-white/10 bg-[#0D1727] p-5">
                        <Loader2 size={21} className="animate-spin text-cyan-400" />
                        <p className="text-sm text-slate-400">
                            Analysing selected location...
                        </p>
                    </div>
                )}

                {!locationLoading && locationError && (
                    <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5">
                        <p className="text-sm font-medium text-red-400">
                            Location analysis failed
                        </p>
                        <p className="mt-2 text-xs text-slate-400">
                            {locationError}
                        </p>
                    </div>
                )}

                {!locationLoading && !locationError && !locationAvailable && (
                    <div className="rounded-xl border border-white/10 bg-[#0D1727] p-6">
                        <div className="flex items-center gap-3">
                            <MapPin size={20} className="text-cyan-400" />
                            <div>
                                <p className="text-sm font-medium text-white">
                                    No location analysed yet
                                </p>
                                <p className="mt-1 text-xs leading-5 text-slate-500">
                                    Select a point in Mars Explorer or enter coordinates
                                    in Science Explorer and run the terrain analysis.
                                    Its results will appear here.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {!locationLoading && locationAvailable && result && (
                    <>
                        <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/[0.04] p-5">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                    <MapPin size={16} className="text-cyan-400" />
                                    <p className="text-xs font-semibold tracking-wider text-cyan-300">
                                        LAST ANALYSED LOCATION
                                    </p>
                                </div>

                                <span className="rounded-md border border-white/10 bg-white/5 px-3 py-1 text-[10px] text-slate-300">
                                    Jezero Crater · Mars
                                </span>
                            </div>

                            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div>
                                    <p className="text-[10px] tracking-wider text-slate-500">
                                        LATITUDE
                                    </p>
                                    <p className="mt-1 text-lg font-semibold text-white">
                                        {result.location.latitude.toFixed(6)}°
                                    </p>
                                </div>

                                <div>
                                    <p className="text-[10px] tracking-wider text-slate-500">
                                        LONGITUDE
                                    </p>
                                    <p className="mt-1 text-lg font-semibold text-white">
                                        {result.location.longitude.toFixed(6)}°
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                            <MetricCard
                                title="LOCAL ELEVATION"
                                value={result.elevation_m.toFixed(2)}
                                unit="m"
                                description="Elevation at the selected coordinate"
                                icon={Mountain}
                            />

                            <MetricCard
                                title="LOCAL SLOPE"
                                value={result.slope_degrees.toFixed(2)}
                                unit="degrees"
                                description="Slope angle at the selected coordinate"
                                icon={Gauge}
                            />

                            <MetricCard
                                title="TERRAIN CLASS"
                                value={result.terrain_class}
                                unit=""
                                description={result.difficulty}
                                icon={Compass}
                            />

                            <MetricCard
                                title="TRAVERSABILITY COST"
                                value={result.traversability_cost.toFixed(2)}
                                unit="cost"
                                description="Provisional terrain cost"
                                icon={Activity}
                            />
                        </div>

                        <div className="rounded-xl border border-white/10 bg-[#0D1727] p-5">
                            <p className="text-xs font-semibold tracking-wider text-slate-300">
                                LOCATION INTERPRETATION
                            </p>
                            <p className="mt-3 text-sm leading-6 text-slate-400">
                                {result.interpretation}
                            </p>
                            <p className="mt-3 border-t border-white/5 pt-3 text-xs leading-5 text-slate-500">
                                {result.model_note}
                            </p>
                        </div>
                    </>
                )}
            </section>

            {/* ROUTE ASSESSMENT */}
            <section className="space-y-4">
                <SectionHeading
                    icon={Route}
                    title="03 · Route Assessment"
                    description="Statistics from the precomputed experimental A* route returned by the backend."
                />

                {routeLoading && (
                    <div className="flex min-h-[130px] items-center justify-center gap-3 rounded-xl border border-white/10 bg-[#0D1727] p-5">
                        <Loader2 size={21} className="animate-spin text-cyan-400" />
                        <p className="text-sm text-slate-400">
                            Loading A* route statistics...
                        </p>
                    </div>
                )}

                {routeError && (
                    <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5">
                        <p className="text-sm font-medium text-red-400">
                            Route assessment unavailable
                        </p>
                        <p className="mt-2 text-xs text-slate-400">
                            {routeError}
                        </p>

                        <button
                            onClick={() => fetchRouteAnalysis()}
                            className="mt-4 flex items-center gap-2 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-300 transition hover:bg-cyan-500/20"
                        >
                            <RefreshCw size={14} />
                            Retry route analysis
                        </button>
                    </div>
                )}

                {!routeLoading && routeAvailable && route && (
                    <>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                            <MetricCard
                                title="ROUTE DISTANCE"
                                value={route.total_distance_km.toFixed(2)}
                                unit="km"
                                description="Total A* route distance"
                                icon={Route}
                            />

                            <MetricCard
                                title="ROUTE WAYPOINTS"
                                value={route.point_count.toLocaleString()}
                                unit="points"
                                description="Coordinates in the generated route"
                                icon={MapPin}
                            />

                            <MetricCard
                                title="CUMULATIVE TERRAIN COST"
                                value={route.total_cumulative_cost.toLocaleString(undefined, {
                                    maximumFractionDigits: 2,
                                })}
                                unit="cost"
                                description="Accumulated route terrain cost"
                                icon={Activity}
                            />

                            <MetricCard
                                title="AVERAGE TERRAIN COST"
                                value={route.average_terrain_cost.toFixed(2)}
                                unit="cost"
                                description="Mean terrain cost along route samples"
                                icon={Gauge}
                            />
                        </div>

                        <div className="rounded-xl border border-white/10 bg-[#0D1727] p-5">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <p className="text-xs font-semibold tracking-wider text-slate-300">
                                        ROUTE CONFIGURATION
                                    </p>
                                    <p className="mt-1 text-xs text-slate-500">
                                        {route.route_type}
                                    </p>
                                </div>

                                <span className="rounded-md border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-300">
                                    {route.algorithm} algorithm
                                </span>
                            </div>

                            <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
                                <div>
                                    <p className="text-[10px] tracking-wider text-slate-500">
                                        START COORDINATES
                                    </p>
                                    <p className="mt-2 text-sm text-white">
                                        {route.start_coordinates[1]?.toFixed(6)}° N,{' '}
                                        {route.start_coordinates[0]?.toFixed(6)}° E
                                    </p>
                                </div>

                                <div>
                                    <p className="text-[10px] tracking-wider text-slate-500">
                                        DESTINATION COORDINATES
                                    </p>
                                    <p className="mt-2 text-sm text-white">
                                        {route.destination_coordinates[1]?.toFixed(6)}° N,{' '}
                                        {route.destination_coordinates[0]?.toFixed(6)}° E
                                    </p>
                                </div>
                            </div>

                            <p className="mt-5 border-t border-white/5 pt-4 text-xs leading-5 text-slate-500">
                                {route.model_note}
                            </p>
                        </div>
                    </>
                )}
            </section>

            {/* RECOMMENDATIONS */}
            <section className="rounded-2xl border border-white/10 bg-[#0D1727] p-6">
                <div className="flex items-center gap-2">
                    <ClipboardCheck size={17} className="text-cyan-400" />
                    <h3 className="text-sm font-semibold text-white">
                        Mission Planning Recommendations
                    </h3>
                </div>

                <div className="mt-5 space-y-4">
                    {[
                        'Prioritise lower-slope corridors during preliminary route selection.',
                        'Investigate steep and extremely steep regions before considering traversal.',
                        'Incorporate geological features and scientific targets into route planning.',
                        'Validate terrain costs and route safety against rover-specific constraints.',
                        'Account for terrain resolution and uncertainties in the source elevation data.',
                    ].map((recommendation, index) => (
                        <div
                            key={recommendation}
                            className="flex items-start gap-3"
                        >
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-cyan-500/20 bg-cyan-500/10 text-[10px] text-cyan-300">
                                {String(index + 1).padStart(2, '0')}
                            </span>

                            <p className="text-sm leading-6 text-slate-300">
                                {recommendation}
                            </p>
                        </div>
                    ))}
                </div>
            </section>

            {/* SCIENTIFIC LIMITATIONS */}
            <section className="rounded-xl border border-yellow-500/20 bg-yellow-500/[0.04] p-5">
                <div className="flex items-center gap-2">
                    <Info size={16} className="text-yellow-400" />
                    <h3 className="text-xs font-semibold tracking-wider text-yellow-300">
                        SCIENTIFIC LIMITATIONS
                    </h3>
                </div>

                <p className="mt-3 text-xs leading-6 text-slate-400">
                    {analysis?.model_note ?? 'Regional terrain model information is currently unavailable.'}
                    {' '}This assessment is a research prototype based on available
                    elevation and slope-derived terrain data. Terrain classifications
                    and traversability costs are provisional parameters, not validated
                    rover safety limits. The results do not account for all hazards,
                    such as loose material, rocks, subsurface conditions or rover
                    mobility constraints. This report should not be interpreted as
                    operational mission clearance.
                </p>

                {analysis && (
                    <div className="mt-4 border-t border-white/5 pt-3">
                        <p className="text-[10px] tracking-wider text-slate-500">
                            DATA BASIS
                        </p>

                        <p className="mt-2 text-xs leading-5 text-slate-400">
                            {analysis.dataset.elevation_source}
                            {' · '}
                            {analysis.dataset.pixel_width_m} m ×{' '}
                            {analysis.dataset.pixel_height_m} m source pixels
                            {' · '}Derived slope and traversability layers
                        </p>

                        <p className="mt-2 text-[10px] text-slate-500">
                            Analysis scope: {analysis.analysis_scope}
                        </p>
                    </div>
                )}
            </section>
        </div>
    )
}
