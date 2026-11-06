
import {
  Mountain,
  Activity,
  Layers3,
  Database,
  AlertTriangle,
  TrendingUp,
  Gauge,
  Map,
  Info,
} from 'lucide-react'

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

const terrain = [
  {
    name: 'Gentle',
    range: '0°–5°',
    cost: 1,
    percentage: 53.77,
    area: 4850.43,
    colour: '#163F35',
    description: 'Relatively low-gradient surfaces',
  },
  {
    name: 'Moderate',
    range: '5°–15°',
    cost: 2,
    percentage: 38.06,
    area: 3433.41,
    colour: '#6B8E45',
    description: 'Moderate surface inclination',
  },
  {
    name: 'Steep',
    range: '15°–25°',
    cost: 5,
    percentage: 6.07,
    area: 547.10,
    colour: '#D5B84A',
    description: 'Increased terrain difficulty',
  },
  {
    name: 'Very Steep',
    range: '25°–35°',
    cost: 10,
    percentage: 1.11,
    area: 100.38,
    colour: '#D9823B',
    description: 'High-gradient terrain',
  },
  {
    name: 'Extremely Steep',
    range: '35°+',
    cost: 100,
    percentage: 0.99,
    area: 88.91,
    colour: '#B9433F',
    description: 'Very high-gradient terrain',
  },
]

const totalPixels = 22564575
const slopePixels = 22550602

const formatNumber = (value: number) =>
  value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

function MetricCard({
  label,
  value,
  unit,
  icon: Icon,
  accent,
}: {
  label: string
  value: string
  unit: string
  icon: typeof Mountain
  accent: string
}) {
  return (
    <div className="min-w-0 rounded-xl border border-white/10 bg-[#080D18] p-4 transition-colors hover:border-cyan-500/30">
      <div className="flex items-center gap-2">
        <Icon size={16} className={accent} />
        <span className="text-[10px] tracking-widest text-slate-500">
          {label}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-baseline gap-2">
        <p className="text-2xl font-semibold tracking-tight text-white">
          {value}
        </p>

        <span className="text-xs text-slate-500">
          {unit}
        </span>
      </div>
    </div>
  )
}

function StatisticRow({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/5 py-3 last:border-0">
      <span className="text-xs text-slate-400">
        {label}
      </span>

      <span className="text-sm font-mono text-white text-right">
        {value}
      </span>
    </div>
  )
}

export default function RegionalTerrainAnalysis() {
  return (
    <div className="space-y-5">

      {/* REGIONAL SUMMARY */}
      <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#0D1727] p-5 md:p-6">

        <div className="flex flex-wrap items-start justify-between gap-4">

          <div>
            <div className="flex items-center gap-2">
              <Map size={15} className="text-cyan-400" />

              <p className="text-[10px] tracking-[0.18em] text-cyan-400">
                REGIONAL TERRAIN INTELLIGENCE
              </p>
            </div>

            <h3 className="mt-3 text-lg md:text-xl font-semibold text-white">
              Jezero Crater — Surface Assessment
            </h3>

            <p className="mt-2 text-sm text-slate-400">
              Statistical analysis of the available USGS CTX DEM coverage.
            </p>
          </div>

          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-[10px] text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            ANALYSIS AVAILABLE
          </span>

        </div>

        {/* KEY METRICS */}
        <div
          className="mt-6 grid gap-3"
          style={{
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          }}
        >
          <MetricCard
            label="MEAN ELEVATION"
            value={formatNumber(elevation.mean)}
            unit="m"
            icon={Mountain}
            accent="text-orange-400"
          />

          <MetricCard
            label="MEAN SLOPE"
            value={slope.mean.toFixed(2)}
            unit="degrees"
            icon={Activity}
            accent="text-cyan-400"
          />

          <MetricCard
            label="MAXIMUM SLOPE"
            value={slope.max.toFixed(2)}
            unit="degrees"
            icon={AlertTriangle}
            accent="text-orange-400"
          />
        </div>

        <p className="mt-4 text-[10px] text-slate-500">
          Regional measurements are calculated from valid raster pixels.
        </p>

      </section>

      {/* ELEVATION AND SLOPE STATISTICS */}
      <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">

        {/* ELEVATION */}
        <div className="rounded-2xl border border-white/10 bg-[#0D1727] p-5">

          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-500/10">
              <Mountain size={17} className="text-orange-400" />
            </div>

            <div>
              <h3 className="text-sm font-semibold text-white">
                Elevation Statistics
              </h3>

              <p className="text-[10px] text-slate-500 mt-1">
                Vertical surface measurements
              </p>
            </div>
          </div>

          <div className="mt-5">
            <StatisticRow
              label="Minimum elevation"
              value={`${formatNumber(elevation.min)} m`}
            />

            <StatisticRow
              label="Maximum elevation"
              value={`${formatNumber(elevation.max)} m`}
            />

            <StatisticRow
              label="Mean elevation"
              value={`${formatNumber(elevation.mean)} m`}
            />

            <StatisticRow
              label="Standard deviation"
              value={`${formatNumber(elevation.standardDeviation)} m`}
            />
          </div>

        </div>

        {/* SLOPE */}
        <div className="rounded-2xl border border-white/10 bg-[#0D1727] p-5">

          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/10">
              <Activity size={17} className="text-cyan-400" />
            </div>

            <div>
              <h3 className="text-sm font-semibold text-white">
                Slope Statistics
              </h3>

              <p className="text-[10px] text-slate-500 mt-1">
                Surface inclination measurements
              </p>
            </div>
          </div>

          <div className="mt-5">
            <StatisticRow
              label="Minimum slope"
              value={`${slope.min.toFixed(2)}°`}
            />

            <StatisticRow
              label="Maximum slope"
              value={`${slope.max.toFixed(2)}°`}
            />

            <StatisticRow
              label="Mean slope"
              value={`${slope.mean.toFixed(2)}°`}
            />

            <StatisticRow
              label="Standard deviation"
              value={`${slope.standardDeviation.toFixed(2)}°`}
            />
          </div>

        </div>

      </section>

      {/* TERRAIN DISTRIBUTION */}
      <section className="rounded-2xl border border-white/10 bg-[#0D1727] p-5 md:p-6">

        <div className="flex flex-wrap items-center justify-between gap-3">

          <div className="flex items-center gap-3">

            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-500/10">
              <Layers3 size={17} className="text-orange-400" />
            </div>

            <div>
              <h3 className="text-sm font-semibold text-white">
                Terrain Difficulty Distribution
              </h3>

              <p className="text-[10px] text-slate-500 mt-1">
                Slope-based classification of the available region
              </p>
            </div>

          </div>

          <span className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-[9px] tracking-wider text-slate-400">
            5 TERRAIN CLASSES
          </span>

        </div>

        <p className="mt-5 text-xs text-slate-500">
          Percentage of valid slope pixels belonging to each provisional terrain class.
        </p>

        <div className="mt-7 space-y-7">

          {terrain.map((item) => (
            <div key={item.name}>

              {/* CLASS HEADER */}
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">

                <div className="flex flex-wrap items-center gap-2">

                  <span
                    className="h-3 w-3 shrink-0 rounded-sm"
                    style={{ backgroundColor: item.colour }}
                  />

                  <span className="text-sm font-medium text-slate-200">
                    {item.name}
                  </span>

                  <span className="text-[10px] text-slate-500">
                    {item.range}
                  </span>

                </div>

                <span className="font-mono text-sm font-semibold text-white">
                  {item.percentage.toFixed(2)}%
                </span>

              </div>

              {/* DISTRIBUTION BAR */}
              <div className="h-3 w-full overflow-hidden rounded-full bg-white/[0.06]">

                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${item.percentage}%`,
                    minWidth: '14px',
                    backgroundColor: item.colour,
                    boxShadow: `0 0 12px ${item.colour}55`,
                  }}
                />

              </div>

              {/* CLASS DETAILS */}
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">

                  <span className="text-[10px] text-slate-400">
                    {item.area.toLocaleString('en-US')} km²
                  </span>

                  <span className="text-[10px] text-slate-600">
                    {item.description}
                  </span>

                </div>

                <span className="text-[10px] text-slate-500">
                  Traversal cost: {item.cost}
                </span>

              </div>

            </div>
          ))}

        </div>

        {/* TERRAIN SUMMARY */}
        <div className="mt-8 grid grid-cols-1 gap-3 border-t border-white/10 pt-6 sm:grid-cols-2">

          <div className="rounded-xl border border-emerald-500/10 bg-emerald-500/[0.04] p-4">

            <div className="flex items-center gap-2">
              <TrendingUp size={15} className="text-emerald-400" />

              <p className="text-[10px] tracking-widest text-slate-400">
                GENTLE + MODERATE
              </p>
            </div>

            <p className="mt-3 text-3xl font-semibold text-emerald-400">
              91.83%
            </p>

            <p className="mt-2 text-[10px] text-slate-500">
              Combined share of lower-slope terrain
            </p>

          </div>

          <div className="rounded-xl border border-orange-500/10 bg-orange-500/[0.04] p-4">

            <div className="flex items-center gap-2">
              <Gauge size={15} className="text-orange-400" />

              <p className="text-[10px] tracking-widest text-slate-400">
                STEEPER CLASSES
              </p>
            </div>

            <p className="mt-3 text-3xl font-semibold text-orange-400">
              8.17%
            </p>

            <p className="mt-2 text-[10px] text-slate-500">
              Combined share of slopes above 15°
            </p>

          </div>

        </div>

      </section>

      {/* DATASET AND METHODOLOGY */}
      <section className="rounded-2xl border border-white/10 bg-[#0D1727] p-5 md:p-6">

        <div className="flex items-center gap-3">

          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/10">
            <Database size={17} className="text-cyan-400" />
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white">
              Dataset & Methodology
            </h3>

            <p className="text-[10px] text-slate-500 mt-1">
              Source data and processing information
            </p>
          </div>

        </div>

        {/* DATASET DETAILS */}
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">

          <div className="rounded-lg border border-white/5 bg-[#080D18] p-4">

            <p className="text-[9px] tracking-widest text-slate-500">
              ELEVATION SOURCE
            </p>

            <p className="mt-2 break-all text-xs text-slate-200">
              M20_JezeroCrater_CTXDEM_20m.tif
            </p>

          </div>

          <div className="rounded-lg border border-white/5 bg-[#080D18] p-4">

            <p className="text-[9px] tracking-widest text-slate-500">
              SLOPE SOURCE
            </p>

            <p className="mt-2 break-all text-xs text-slate-200">
              jezero_slope.tif
            </p>

          </div>

          <div className="rounded-lg border border-white/5 bg-[#080D18] p-4">

            <p className="text-[9px] tracking-widest text-slate-500">
              TRAVERSABILITY SOURCE
            </p>

            <p className="mt-2 break-all text-xs text-slate-200">
              jezero_traversability.tif
            </p>

          </div>

          <div className="rounded-lg border border-white/5 bg-[#080D18] p-4">

            <p className="text-[9px] tracking-widest text-slate-500">
              ORIGINAL PIXEL RESOLUTION
            </p>

            <p className="mt-2 text-xs text-slate-200">
              20 m × 20 m
            </p>

          </div>

        </div>

        {/* PIXEL COUNTS */}
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">

          <div className="rounded-lg border border-white/5 bg-[#080D18] p-4">

            <p className="text-[9px] tracking-widest text-slate-500">
              VALID ELEVATION PIXELS
            </p>

            <p className="mt-2 text-xl font-semibold font-mono text-white">
              {totalPixels.toLocaleString('en-US')}
            </p>

          </div>

          <div className="rounded-lg border border-white/5 bg-[#080D18] p-4">

            <p className="text-[9px] tracking-widest text-slate-500">
              VALID SLOPE PIXELS
            </p>

            <p className="mt-2 text-xl font-semibold font-mono text-white">
              {slopePixels.toLocaleString('en-US')}
            </p>

          </div>

        </div>

        {/* SCIENTIFIC LIMITATIONS */}
        <div className="mt-5 rounded-xl border border-orange-500/20 bg-orange-500/[0.04] p-4">

          <div className="flex items-center gap-2">

            <AlertTriangle size={15} className="text-orange-400" />

            <p className="text-[10px] tracking-widest text-orange-400">
              SCIENTIFIC LIMITATIONS
            </p>

          </div>

          <p className="mt-3 text-xs leading-6 text-slate-300">
            Terrain classes and traversal costs are provisional research
            parameters, not validated rover safety limits. Statistics
            describe the available DEM coverage, not the entire Jezero
            Crater. Slope is derived from the elevation model and depends
            on its resolution and processing method.
          </p>

        </div>

        {/* METHODOLOGY NOTE */}
        <div className="mt-4 flex items-start gap-2">

          <Info size={14} className="mt-0.5 shrink-0 text-cyan-500" />

          <p className="text-[10px] leading-5 text-slate-500">
            The minimum visible width of small distribution bars is a
            display adjustment only. The percentage labels represent
            the actual calculated values.
          </p>

        </div>

      </section>

    </div>
  )
}
