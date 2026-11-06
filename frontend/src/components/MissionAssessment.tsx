
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
    Target,
    Gauge,
    Loader2,
    RefreshCw,
} from 'lucide-react'

const API_URL = 'http://127.0.0.1:8000/api/terrain/analysis'

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
        <div className="min-w-0 w-full rounded-xl border border-white/10 bg-[#101C2D] p-5">
            <div className="flex items-center justify-between">
                <p className="text-[10px] tracking-widest text-slate-500">
                    {title}
                </p>
                <Icon size={17} className="text-cyan-400" />
            </div>

            <div className="mt-4 flex items-baseline gap-2">
                <span className="text-3xl font-semibold text-white">
                    {value}
                </span>
                <span className="text-xs text-slate-400">{unit}</span>
            </div>

            <p className="mt-2 text-xs text-slate-500">
                {description}
            </p>
        </div>
    )
}

export default function MissionAssessment() {
    const [analysis, setAnalysis] = useState<TerrainAnalysis | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    async function fetchAnalysis(signal?: AbortSignal) {
        try {
            setLoading(true)
            setError(null)

            const response = await fetch(API_URL, { signal })

            if (!response.ok) {
                throw new Error(`Backend returned status ${response.status}`)
            }

            const result: TerrainAnalysis = await response.json()

            setAnalysis(result)
        } catch (err) {
            if (err instanceof Error && err.name === 'AbortError') return

            setError(
                err instanceof Error
                    ? err.message
                    : 'Unable to load terrain analysis.',
            )
        } finally {
            if (!signal?.aborted) {
                setLoading(false)
            }
        }
    }

    useEffect(() => {
        const controller = new AbortController()

        fetchAnalysis(controller.signal)

        return () => controller.abort()
    }, [])

    if (loading) {
        return (
            <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 rounded-2xl border border-white/10 bg-[#0D1727]">
                <Loader2 size={32} className="animate-spin text-cyan-400" />
                <p className="text-sm text-slate-300">
                    Analysing regional terrain data...
                </p>
                <p className="text-xs text-slate-500">
                    Retrieving elevation, slope and traversability statistics
                </p>
            </div>
        )
    }

    if (error || !analysis) {
        return (
            <div className="flex min-h-[350px] flex-col items-center justify-center gap-4 rounded-2xl border border-red-500/20 bg-[#0D1727] p-6 text-center">
                <AlertTriangle size={32} className="text-red-400" />

                <h3 className="text-lg font-semibold text-white">
                    Terrain analysis unavailable
                </h3>

                <p className="max-w-md text-sm text-slate-400">
                    {error || 'No analysis data was received from the backend.'}
                </p>

                <button
                    onClick={() => fetchAnalysis()}
                    className="flex items-center gap-2 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-300 transition hover:bg-cyan-500/20"
                >
                    <RefreshCw size={15} />
                    Retry analysis
                </button>

                <p className="text-xs text-slate-500">
                    Make sure the FastAPI backend is running on port 8000.
                </p>
            </div>
        )
    }

    const terrainRisks = terrainStyles.map((style, index) => {
        const terrain = analysis.terrain_distribution.find(
            (item, itemIndex) =>
                getTerrainIndex(item.terrain_class, itemIndex) === index,
        )

        return {
            ...style,
            percentage: terrain?.percentage ?? 0,
        }
    })

    const gentleModerate =
        terrainRisks[0].percentage + terrainRisks[1].percentage

    const steepCoverage = terrainRisks
        .slice(2)
        .reduce((total, terrain) => total + terrain.percentage, 0)

    const meanSlope = analysis.slope.mean_degrees
    const maximumSlope = analysis.slope.maximum_degrees

    return (
        <div className="w-full min-w-0 max-w-full space-y-6 overflow-x-clip">

            {/* ASSESSMENT HEADER */}
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
                            An initial assessment of regional terrain conditions
                            using elevation and slope-derived traversability data.
                            Statistics are retrieved directly from the terrain analysis
                            backend.
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

            {/* KEY METRICS */}
            <section>
                <div className="mb-4 flex items-center gap-2">
                    <Target size={16} className="text-orange-400" />
                    <h3 className="text-sm font-semibold text-white">
                        Mission Indicators
                    </h3>
                </div>

                <div
                    className="grid w-full min-w-0 gap-4"
                    style={{
                        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))',
                    }}
                >
                    <MetricCard
                        title="LOW-SLOPE COVERAGE"
                        value={gentleModerate.toFixed(2)}
                        unit="%"
                        description="Gentle and moderate terrain combined"
                        icon={Mountain}
                    />

                    <MetricCard
                        title="MEAN SLOPE"
                        value={meanSlope.toFixed(2)}
                        unit="degrees"
                        description="Average regional slope"
                        icon={Gauge}
                    />

                    <MetricCard
                        title="EXPERIMENTAL ROUTE"
                        value="158.13"
                        unit="km"
                        description="Slope-based A* route"
                        icon={Route}
                    />

                    <MetricCard
                        title="ROUTE WAYPOINTS"
                        value="340"
                        unit="points"
                        description="Points in the generated route"
                        icon={Activity}
                    />
                </div>
            </section>

            {/* TERRAIN RISK DISTRIBUTION */}
            <section className="rounded-2xl border border-white/10 bg-[#0D1727] p-6">
                <div className="flex items-center gap-2">
                    <ShieldAlert size={17} className="text-orange-400" />
                    <h3 className="text-sm font-semibold text-white">
                        Terrain Risk Distribution
                    </h3>
                </div>

                <p className="mt-2 text-xs text-slate-500">
                    Regional surface distribution classified by slope angle.
                    Values are retrieved from the backend analysis.
                </p>

                <div className="mt-6 min-w-0 space-y-6">
                    {terrainRisks.map((terrain) => (
                        <div key={terrain.name} className="min-w-0">
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
            </section>

            {/* MISSION OBSERVATIONS */}
            <section
                className="grid min-w-0 gap-5"
                style={{
                    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
                }}
            >
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
                                {gentleModerate.toFixed(2)}% of the analysed terrain
                                falls within the gentle and moderate slope categories.
                            </p>
                        </div>

                        <div>
                            <p className="text-sm text-emerald-300">
                                Terrain data available
                            </p>
                            <p className="mt-1 text-xs leading-5 text-slate-400">
                                The regional analysis uses {analysis.elevation.valid_pixels.toLocaleString()}
                                {' '}valid elevation pixels to evaluate the terrain.
                            </p>
                        </div>

                        <div>
                            <p className="text-sm text-emerald-300">
                                Experimental route generated
                            </p>
                            <p className="mt-1 text-xs leading-5 text-slate-400">
                                An A* path has been generated using
                                slope-derived terrain costs.
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
                                {steepCoverage.toFixed(2)}% of the analysed terrain
                                exceeds 15° slope and requires closer investigation.
                            </p>
                        </div>

                        <div>
                            <p className="text-sm text-orange-300">
                                Extreme local slopes
                            </p>
                            <p className="mt-1 text-xs leading-5 text-slate-400">
                                The maximum recorded slope is {maximumSlope.toFixed(2)}°.
                                Local terrain hazards require further evaluation.
                            </p>
                        </div>

                        <div>
                            <p className="text-sm text-orange-300">
                                Route validation pending
                            </p>
                            <p className="mt-1 text-xs leading-5 text-slate-400">
                                The generated route has not been validated
                                against rover engineering or operational constraints.
                            </p>
                        </div>
                    </div>
                </div>
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
                        <div key={recommendation} className="flex items-start gap-3">
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
                    {analysis.model_note}
                    {' '}This assessment is a research prototype based on
                    available elevation and slope-derived terrain data.
                    Terrain classifications and traversability costs are
                    provisional parameters, not validated rover safety limits.
                    The results do not account for all hazards, such as loose
                    material, rocks, subsurface conditions, or rover mobility
                    constraints. This report should not be interpreted as
                    an operational mission clearance.
                </p>

                <div className="mt-4 border-t border-white/5 pt-3">
                    <p className="text-[10px] tracking-wider text-slate-500">
                        DATA BASIS
                    </p>

                    <p className="mt-2 text-xs text-slate-400">
                        {analysis.dataset.elevation_source}
                        {' '}· {analysis.dataset.pixel_width_m} m × {analysis.dataset.pixel_height_m} m
                        {' '}source pixels
                        {' '}· Derived slope and traversability layers
                    </p>

                    <p className="mt-2 text-[10px] text-slate-500">
                        Analysis scope: {analysis.analysis_scope}
                    </p>
                </div>
            </section>

        </div>
    )
}
