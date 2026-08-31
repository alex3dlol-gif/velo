import { useMemo } from 'react'

/* ------------------------------------------------------------------ *
 * Flat-top hexagon "fog of war" map.
 * Deterministic layout so revealed cells + track stay stable on rerender.
 * ------------------------------------------------------------------ */

type HexMapProps = {
  /** 0..1 fraction of the local field that is revealed */
  revealed: number
  /** draw the live terracotta track + moving marker */
  live?: boolean
  /** progress of the live track head, 0..1 */
  trackHead?: number
  cols?: number
  rows?: number
  className?: string
}

// cheap deterministic hash -> 0..1
function rnd(n: number) {
  const x = Math.sin(n * 127.1 + 43.7) * 43758.5453
  return x - Math.floor(x)
}

export default function HexMap({
  revealed,
  live = false,
  trackHead = 1,
  cols = 9,
  rows = 14,
  className,
}: HexMapProps) {
  const R = 26 // hex radius
  const w = 1.5 * R // horizontal step (flat-top)
  const h = Math.sqrt(3) * R // vertical step
  const width = cols * w + R
  const height = rows * h + h

  const hexes = useMemo(() => {
    const list: {
      key: string
      cx: number
      cy: number
      pts: string
      score: number
    }[] = []
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        const cx = R + c * w
        const cy = h / 2 + r * h + (c % 2 ? h / 2 : 0)
        const pts = Array.from({ length: 6 }, (_, i) => {
          const a = (Math.PI / 180) * (60 * i)
          return `${(cx + R * Math.cos(a)).toFixed(1)},${(cy + R * Math.sin(a)).toFixed(1)}`
        }).join(' ')
        list.push({ key: `${c}-${r}`, cx, cy, pts, score: rnd(c * 31.3 + r * 7.7) })
      }
    }
    return list
  }, [cols, rows, R, w, h])

  // A meandering path used both to bias which cells are revealed and to draw the track.
  const path = useMemo(() => {
    const pts: { x: number; y: number }[] = []
    const steps = 42
    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      const y = h + t * (height - 2 * h)
      const x =
        width * 0.5 +
        Math.sin(t * Math.PI * 3.1) * width * 0.28 +
        Math.sin(t * Math.PI * 7.3) * width * 0.08
      pts.push({ x, y })
    }
    return pts
  }, [width, height, h])

  const trackD = useMemo(() => {
    return path.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
  }, [path])

  // Determine revealed cells: those near the path, up to `revealed` fraction.
  const openSet = useMemo(() => {
    const withDist = hexes.map((hx) => {
      let min = Infinity
      for (const p of path) {
        const d = (p.x - hx.cx) ** 2 + (p.y - hx.cy) ** 2
        if (d < min) min = d
      }
      return { key: hx.key, dist: min, jitter: hx.score }
    })
    // rank by distance-to-path with a little jitter so edges look organic
    withDist.sort((a, b) => a.dist + a.jitter * 900 - (b.dist + b.jitter * 900))
    const count = Math.floor(withDist.length * revealed)
    return new Set(withDist.slice(0, count).map((d) => d.key))
  }, [hexes, path, revealed])

  const headPt = path[Math.max(0, Math.min(path.length - 1, Math.floor(trackHead * (path.length - 1))))]
  const dashTotal = 2600

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      preserveAspectRatio="xMidYMid slice"
      style={{ background: 'var(--map-bg)', display: 'block' }}
    >
      {/* faux street + block texture under the fog */}
      <g stroke="var(--road)" strokeWidth="7" strokeLinecap="round" opacity="0.9">
        <line x1={width * 0.12} y1="0" x2={width * 0.2} y2={height} />
        <line x1={width * 0.55} y1="0" x2={width * 0.62} y2={height} />
        <line x1={width * 0.86} y1="0" x2={width * 0.8} y2={height} />
        <line x1="0" y1={height * 0.24} x2={width} y2={height * 0.2} />
        <line x1="0" y1={height * 0.58} x2={width} y2={height * 0.64} />
        <line x1="0" y1={height * 0.85} x2={width} y2={height * 0.82} />
      </g>
      <g fill="var(--green)" opacity="0.8">
        <circle cx={width * 0.3} cy={height * 0.4} r={R * 1.6} />
        <rect x={width * 0.62} y={height * 0.7} width={R * 3} height={R * 2.4} rx="6" />
      </g>
      <rect x={width * 0.7} y={height * 0.12} width={R * 2.8} height={R * 3} fill="var(--water)" rx="4" opacity="0.7" />

      {/* hex cells */}
      <g strokeWidth="1">
        {hexes.map((hx) => {
          const open = openSet.has(hx.key)
          return (
            <polygon
              key={hx.key}
              points={hx.pts}
              fill={open ? 'var(--hex-open)' : 'var(--hex-fog)'}
              stroke={open ? 'var(--hex-open-line)' : 'var(--hex-fog-line)'}
              fillOpacity={open ? 0.32 : 0.94}
            />
          )
        })}
      </g>

      {/* live track */}
      {live && (
        <>
          <path
            d={trackD}
            fill="none"
            stroke="var(--terracotta)"
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.25"
          />
          <path
            d={trackD}
            fill="none"
            stroke="var(--terracotta)"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={dashTotal}
            strokeDashoffset={dashTotal * (1 - trackHead)}
          />
          {headPt && (
            <>
              <circle cx={headPt.x} cy={headPt.y} r="14" fill="var(--terracotta)" opacity="0.28" className="gps-pulse" />
              <circle cx={headPt.x} cy={headPt.y} r="7" fill="var(--terracotta)" stroke="var(--surface)" strokeWidth="2.5" />
            </>
          )}
        </>
      )}
    </svg>
  )
}
