
import {
  Activity,
  AlertTriangle,
  Crosshair,
  Database,
  Gauge,
  Info,
  Layers3,
  Map,
  Mountain,
  TrendingUp,
} from 'lucide-react'

import type { TerrainResponse } from '../services/terrainService'

type RegionalTerrainAnalysisProps = {
  coordinates: [number, number] | null
  result: TerrainResponse | null
  loading: boolean
  error: string | null
}

const elevation = {
  min: -3504.65,
  max: -475.84,
  mean: -2316.08,
  standardDeviation: 403.93,
}

const slope = {
  min: 0,
  max: 88.07,
  mean: 6.59,
  standardDeviation: 7.08,
}

const totalPixels = 22564575
const slopePixels = 22550602

const terrainClasses = [
  {
    name: 'Very Low',
    description: 'Relatively smooth terrain',
    percentage: 53.77,
    area: 4850.43,
    color: 'bg-emerald-400',
  },
  {
    name: 'Low',
    description: 'Generally traversable terrain',
    percentage: 38.06,
    area: 3433.41,
    color: 'bg-lime-400',
  },
  {
    name: 'Moderate',
    description: 'Terrain requiring caution',
    percentage: 6.07,
    area: 547.10,
    color: 'bg-yellow-400',
  },
  {
    name: 'High',
    description: 'Difficult terrain',
    percentage: 1.11,
    area: 100.38,
    color: 'bg-orange-400',
  },
  {
    name: 'Very High',
    description: 'Potentially challenging terrain',
    percentage: 0.99,
    area: 88.91,
    color: 'bg-red-400',
  },
]

function StatCard({
  label,
  value,
  unit,
  icon: Icon,
}: {
  label: string
  value: string
  unit: string
  icon: typeof Mountain
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-slate-400">{label}</p>
        <Icon size={18} className="text-cyan-400" />
      </div>

      <p className="text-2xl font-semibold tracking-tight text-white">
        {value}
      </p>

      <p className="mt-1 text-xs text-slate-500">{unit}</p>
    </div>
  )
}

function MetricRow({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/[0.06] py-3 last:border-0">
      <span className="text-sm text-slate-400">{label}</span>
      <span className="text-sm font-medium text-slate-200">{value}</span>
    </div>
  )
}

export default function RegionalTerrainAnalysis({
  coordinates,
  result,
  loading,
  error,
}: RegionalTerrainAnalysisProps) {
  const latitude = coordinates?.[0]
  const longitude = coordinates?.[1]

  return (
    <div className="space-y-6 text-white">

      {/* PAGE HEADER */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <div className="rounded-lg border border-cyan-400/20 bg-cyan-400/10 p-2">
              <Mountain size={20} className="text-cyan-400" />
            </div>

            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">
              ASTRAL / Terrain Intelligence
            </span>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Terrain Analysis
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Analyse elevation, surface slope and terrain traversability
            across the Jezero Crater study region on Mars.
          </p>
        </div>

        <div className="flex w-fit items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-2">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          <span className="text-xs font-medium text-emerald-300">
            Dataset validated
          </span>
        </div>
      </div>

      {/* SELECTED LOCATION ANALYSIS */}
      <section className="overflow-hidden rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-cyan-950/40 via-slate-900/80 to-slate-950">
        <div className="flex flex-col gap-3 border-b border-white/10 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 p-2.5">
              <Crosshair size={20} className="text-cyan-300" />
            </div>

            <div>
              <h2 className="font-semibold text-white">
                Selected Location Analysis
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                Point-specific terrain readings from the selected map location
              </p>
            </div>
          </div>

          {coordinates && (
            <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-300">
              {Math.abs(latitude!).toFixed(5)}°
              {latitude! >= 0 ? ' N' : ' S'}
              {' / '}
              {Math.abs(longitude!).toFixed(5)}°
              {longitude! >= 0 ? ' E' : ' W'}
            </div>
          )}
        </div>

        <div className="p-5">
          {!coordinates ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Map size={30} className="mb-3 text-slate-500" />

              <p className="font-medium text-slate-300">
                No location selected
              </p>

              <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
                Open Mars Explorer and click a location on the map or enter
                coordinates. Its terrain readings will appear here.
              </p>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center gap-3 py-10">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-cyan-400/30 border-t-cyan-400" />
              <p className="text-sm text-slate-300">
                Analysing selected terrain location...
              </p>
            </div>
          ) : error ? (
            <div className="flex items-start gap-3 rounded-xl border border-red-400/20 bg-red-400/5 p-4">
              <AlertTriangle
                size={20}
                className="mt-0.5 shrink-0 text-red-400"
              />

              <div>
                <p className="text-sm font-medium text-red-300">
                  Terrain analysis failed
                </p>
                <p className="mt-1 text-sm text-red-200/70">{error}</p>
              </div>
            </div>
          ) : result ? (
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <StatCard
                  label="Elevation"
                  value={`${Number(result.elevation_m).toFixed(2)}`}
                  unit="Metres"
                  icon={Mountain}
                />

                <StatCard
                  label="Surface Slope"
                  value={`${Number(result.slope_degrees).toFixed(2)}°`}
                  unit="Degrees"
                  icon={Activity}
                />

                <StatCard
                  label="Traversability Cost"
                  value={Number(result.traversability_cost).toFixed(2)}
                  unit="Model-derived terrain cost"
                  icon={Gauge}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Terrain classification
                  </p>

                  <p className="text-xl font-semibold text-cyan-300">
                    {String(result.terrain_class)}
                  </p>

                  <div className="mt-4 border-t border-white/10 pt-3">
                    <p className="mb-1 text-xs text-slate-500">
                      Difficulty assessment
                    </p>
                    <p className="text-sm font-medium text-slate-200">
                      {String(result.difficulty)}
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Terrain interpretation
                  </p>

                  <p className="text-sm leading-6 text-slate-300">
                    {String(result.interpretation)}
                  </p>
                </div>
              </div>

              {result.model_note && (
                <div className="flex items-start gap-3 rounded-xl border border-amber-400/20 bg-amber-400/5 p-4">
                  <Info
                    size={18}
                    className="mt-0.5 shrink-0 text-amber-300"
                  />

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-amber-300">
                      Model note
                    </p>
                    <p className="mt-1 text-sm leading-6 text-slate-300">
                      {String(result.model_note)}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="py-8 text-center text-sm text-slate-400">
              The selected location has not returned a terrain result yet.
            </div>
          )}
        </div>
      </section>

      {/* REGIONAL SUMMARY */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg border border-violet-400/20 bg-violet-400/10 p-2">
            <Layers3 size={19} className="text-violet-300" />
          </div>

          <div>
            <h2 className="font-semibold text-white">Regional Summary</h2>
            <p className="text-xs text-slate-500">
              Statistics calculated across the study region
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Mean Elevation"
            value={elevation.mean.toFixed(2)}
            unit="Metres"
            icon={Mountain}
          />

          <StatCard
            label="Mean Slope"
            value={`${slope.mean.toFixed(2)}°`}
            unit="Degrees"
            icon={Activity}
          />

          <StatCard
            label="Elevation Range"
            value={`${(elevation.max - elevation.min).toFixed(0)}`}
            unit="Metres"
            icon={TrendingUp}
          />

          <StatCard
            label="Mean Terrain Slope"
            value={`${slope.mean.toFixed(2)}°`}
            unit="Regional average"
            icon={Gauge}
          />
        </div>
      </section>

      {/* ELEVATION STATISTICS */}
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="mb-4 flex items-center gap-3">
          <Mountain size={19} className="text-cyan-400" />
          <div>
            <h2 className="font-semibold">Elevation Statistics</h2>
            <p className="text-xs text-slate-500">
              Regional elevation distribution
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricRow
            label="Minimum"
            value={`${elevation.min.toFixed(2)} m`}
          />
          <MetricRow
            label="Maximum"
            value={`${elevation.max.toFixed(2)} m`}
          />
          <MetricRow
            label="Mean"
            value={`${elevation.mean.toFixed(2)} m`}
          />
          <MetricRow
            label="Standard deviation"
            value={`${elevation.standardDeviation.toFixed(2)} m`}
          />
        </div>
      </section>

      {/* SLOPE STATISTICS */}
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="mb-4 flex items-center gap-3">
          <Activity size={19} className="text-emerald-400" />
          <div>
            <h2 className="font-semibold">Slope Statistics</h2>
            <p className="text-xs text-slate-500">
              Regional surface inclination
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricRow label="Minimum" value={`${slope.min.toFixed(2)}°`} />
          <MetricRow label="Maximum" value={`${slope.max.toFixed(2)}°`} />
          <MetricRow label="Mean" value={`${slope.mean.toFixed(2)}°`} />
          <MetricRow
            label="Standard deviation"
            value={`${slope.standardDeviation.toFixed(2)}°`}
          />
        </div>
      </section>

      {/* TERRAIN DISTRIBUTION */}
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Layers3 size={19} className="text-cyan-400" />
            <div>
              <h2 className="font-semibold">Terrain Class Distribution</h2>
              <p className="text-xs text-slate-500">
                Regional area grouped by traversability class
              </p>
            </div>
          </div>

          <span className="text-xs text-slate-500">
            Total: 100% (approx.)
          </span>
        </div>

        <div className="space-y-5">
          {terrainClasses.map((terrain) => (
            <div key={terrain.name}>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-slate-200">
                    {terrain.name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {terrain.description}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-sm font-semibold text-white">
                    {terrain.percentage.toFixed(2)}%
                  </p>
                  <p className="text-xs text-slate-500">
                    {terrain.area.toFixed(2)} km²
                  </p>
                </div>
              </div>

              <div className="h-3 overflow-hidden rounded-full bg-white/10">
                <div
                  className={`h-full min-w-[14px] rounded-full ${terrain.color}`}
                  style={{ width: `${terrain.percentage}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* DATASET INFORMATION */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="mb-4 flex items-center gap-3">
            <Database size={19} className="text-cyan-400" />
            <h2 className="font-semibold">Dataset Information</h2>
          </div>

          <MetricRow label="Study region" value="Jezero Crater, Mars" />
          <MetricRow
            label="Elevation pixels"
            value={totalPixels.toLocaleString()}
          />
          <MetricRow
            label="Slope pixels"
            value={slopePixels.toLocaleString()}
          />
          <MetricRow label="DEM resolution" value="20 metres" />
          <MetricRow label="Elevation coverage" value="99.94%" />
          <MetricRow label="Slope coverage" value="99.88%" />
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="mb-4 flex items-center gap-3">
            <Info size={19} className="text-amber-300" />
            <h2 className="font-semibold">Methodology & Limitations</h2>
          </div>

          <ul className="space-y-3 text-sm leading-6 text-slate-400">
            <li>
              • Elevation and slope statistics describe the processed
              regional raster datasets.
            </li>
            <li>
              • Traversability classes are derived from terrain-related
              cost values in the processed dataset.
            </li>
            <li>
              • Selected-location readings are retrieved separately from
              the terrain API.
            </li>
            <li>
              • Terrain cost is a model-derived indicator, not a direct
              measurement of rover mobility or safety.
            </li>
            <li>
              • Actual rover navigation requires additional validation,
              including vehicle constraints and environmental hazards.
            </li>
          </ul>
        </div>
      </section>

      {/* FOOTER */}
      <div className="flex flex-col gap-2 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-slate-500">
          ASTRAL · Mars Terrain Intelligence
        </p>

        <p className="text-xs text-slate-500">
          Regional statistics remain fixed; selected-location readings update
          when a new map coordinate is inspected.
        </p>
      </div>
    </div>
  )
}
