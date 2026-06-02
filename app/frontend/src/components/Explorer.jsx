import { useEffect, useState, useCallback } from 'react'
import {
  LineChart, Line,
  BarChart, Bar,
  ScatterChart, Scatter,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts'

const API = '/api'

const TABS = ['Vacas', 'Tendencia del Hato', 'Cruce de Variables']

const RAZAS = ['Todas', 'Holstein', 'Jersey', 'Pardo Suizo']

const SCATTER_VARS = [
  { value: 'leche_kg_dia',        label: 'Leche (kg/día)' },
  { value: 'indice_thi',          label: 'Índice THI' },
  { value: 'peso_kg',             label: 'Peso (kg)' },
  { value: 'consumo_ms_kg',       label: 'Consumo MS (kg)' },
  { value: 'fibra_pct',           label: 'Fibra (%)' },
  { value: 'proteina_dieta_pct',  label: 'Proteína dieta (%)' },
  { value: 'temperatura_c',       label: 'Temperatura (°C)' },
  { value: 'humedad_pct',         label: 'Humedad (%)' },
  { value: 'intensidad_metano',   label: 'Intensidad metano' },
]

const NIVEL_COLORS = { Bajo: '#00c896', Medio: '#ffc857', Alto: '#ff5757' }
const PIE_COLORS   = ['#00c896', '#ffc857', '#ff5757']

// ── helpers ────────────────────────────────────────────────────────────────────

const fmt1  = v => (typeof v === 'number' ? v.toFixed(1) : '—')
const fmtN  = v => (typeof v === 'number' ? Math.round(v).toLocaleString() : '—')
const fmtDate = s => s ? s.slice(0, 10) : '—'

function metanoColor(v) {
  if (v == null) return 'var(--text-2)'
  if (v < 18)   return 'var(--accent)'
  if (v <= 25)  return 'var(--warn)'
  return 'var(--danger)'
}

// ── shared sub-components ──────────────────────────────────────────────────────

const tooltipStyle = {
  contentStyle: {
    background: '#1a1d27',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8,
    fontSize: 12,
    color: '#eef0f7',
  },
  labelStyle: { color: '#eef0f7' },
  itemStyle:   { color: '#c8cdd8' },
  cursor: { fill: 'rgba(0,200,150,0.06)' },
}

function Spinner() {
  return (
    <div className="loading">
      <div className="spinner" />
      <span>Cargando…</span>
    </div>
  )
}

function Select({ value, onChange, options, style }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        background: 'var(--bg-card-2)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '7px 12px',
        color: 'var(--text-1)',
        fontSize: 13,
        fontFamily: 'var(--font)',
        cursor: 'pointer',
        ...style,
      }}
    >
      {options.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}

function KpiCard({ label, value, sub, cls }) {
  return (
    <div className="kpi-card">
      <span className="kpi-label">{label}</span>
      <span className={`kpi-value ${cls || ''}`}>{value}</span>
      {sub && <span className="kpi-sub">{sub}</span>}
    </div>
  )
}

// ── Tab 1: Vacas ───────────────────────────────────────────────────────────────

function TabVacas({ vacas, loadingVacas, initialVacaId, onVacaOpen }) {
  const [search, setSearch]       = useState('')
  const [razaFilter, setRazaFilter] = useState('Todas')
  const [selectedId, setSelectedId] = useState(null)
  const [perfil, setPerfil]       = useState(null)
  const [loadingPerfil, setLoadingPerfil] = useState(false)

  // Cuando llega un initialVacaId (deep-link desde Registros), lo abrimos automáticamente
  useEffect(() => {
    if (initialVacaId && !loadingVacas) {
      openVaca(initialVacaId)
      if (onVacaOpen) onVacaOpen()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialVacaId, loadingVacas])

  function openVaca(id) {
    setSelectedId(id)
    setPerfil(null)
    setLoadingPerfil(true)
    // Limpiar filtro de búsqueda para asegurarnos de que la vaca es visible
    setSearch(String(id))
    fetch(`${API}/hato/vaca/${encodeURIComponent(id)}`)
      .then(r => r.json())
      .then(d => setPerfil(d))
      .catch(() => setPerfil({ error: true }))
      .finally(() => setLoadingPerfil(false))
  }

  const handleRowClick = useCallback((id) => {
    if (selectedId === id) {
      setSelectedId(null)
      setPerfil(null)
      return
    }
    openVaca(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  const filtered = (vacas || []).filter(v => {
    const q = search.toLowerCase()
    const matchQ = !q
      || String(v.id_vaca).toLowerCase().includes(q)
      || (v.nombre_vaca || '').toLowerCase().includes(q)
    const matchR = razaFilter === 'Todas' || v.raza === razaFilter
    return matchQ && matchR
  })

  return (
    <div>
      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Buscar por ID o nombre…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            background: 'var(--bg-card-2)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '7px 14px',
            color: 'var(--text-1)',
            fontSize: 13,
            fontFamily: 'var(--font)',
            outline: 'none',
            width: 240,
          }}
        />
        <Select
          value={razaFilter}
          onChange={setRazaFilter}
          options={RAZAS.map(r => ({ value: r, label: r }))}
        />
        <span style={{ color: 'var(--text-3)', fontSize: 12, marginLeft: 4 }}>
          {filtered.length} / {(vacas || []).length} vacas
        </span>
      </div>

      {loadingVacas ? (
        <Spinner />
      ) : (
        <div className="card">
          <div className="data-table-wrapper" style={{ maxHeight: 520, overflowY: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Vaca</th>
                  <th>Raza</th>
                  <th style={{ textAlign: 'right' }}>Visitas</th>
                  <th style={{ textAlign: 'right' }}>Metano medio</th>
                  <th style={{ textAlign: 'right' }}>Leche kg/día</th>
                  <th>Última visita</th>
                  <th style={{ textAlign: 'center' }}>Alertas</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-3)', padding: 28 }}>
                      Sin resultados
                    </td>
                  </tr>
                ) : (
                  filtered.map(v => (
                    <>
                      <tr
                        key={v.id_vaca}
                        onClick={() => handleRowClick(v.id_vaca)}
                        style={{
                          cursor: 'pointer',
                          background: selectedId === v.id_vaca ? 'rgba(0,200,150,0.06)' : undefined,
                          borderLeft: selectedId === v.id_vaca ? '3px solid var(--accent)' : '3px solid transparent',
                          transition: 'background 0.15s',
                        }}
                      >
                        <td>
                          <span style={{ color: 'var(--text-1)', fontWeight: 600 }}>
                            {v.nombre_vaca || `#${v.id_vaca}`}
                          </span>
                          <span style={{ color: 'var(--text-3)', fontSize: 11, marginLeft: 6 }}>
                            #{v.id_vaca}
                          </span>
                        </td>
                        <td style={{ color: 'var(--text-2)' }}>{v.raza || '—'}</td>
                        <td style={{ textAlign: 'right', color: 'var(--text-2)' }}>{v.n_visitas ?? '—'}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600, color: metanoColor(v.metano_medio) }}>
                          {v.metano_medio != null ? fmt1(v.metano_medio) : '—'}
                        </td>
                        <td style={{ textAlign: 'right', color: 'var(--text-2)' }}>
                          {v.leche_media != null ? fmt1(v.leche_media) : '—'}
                        </td>
                        <td style={{ color: 'var(--text-3)', fontSize: 12 }}>{fmtDate(v.ultima_visita)}</td>
                        <td style={{ textAlign: 'center' }}>
                          {v.alertas > 0 ? (
                            <span className="badge-red" style={{ fontSize: 11 }}>
                              🚨 {v.alertas}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-3)', fontSize: 12 }}>—</span>
                          )}
                        </td>
                      </tr>
                      {selectedId === v.id_vaca && (
                        <tr key={`perfil-${v.id_vaca}`} style={{ background: 'var(--bg-card-2)' }}>
                          <td colSpan={7} style={{ padding: 0 }}>
                            <PerfilVaca
                              vaca={v}
                              perfil={perfil}
                              loading={loadingPerfil}
                            />
                          </td>
                        </tr>
                      )}
                    </>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function PerfilVaca({ vaca, perfil, loading }) {
  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <Spinner />
      </div>
    )
  }
  if (!perfil || perfil.error) {
    return (
      <div className="error-box" style={{ margin: 16 }}>
        No se pudo cargar el historial de esta vaca.
      </div>
    )
  }

  const hist = perfil.historial || []
  const sorted = [...hist].sort((a, b) => a.fecha > b.fecha ? 1 : -1)
  const last5  = [...sorted].slice(-5).reverse()

  return (
    <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ fontWeight: 700, color: 'var(--text-1)', fontSize: 15 }}>
        {vaca.nombre_vaca || `Vaca #${vaca.id_vaca}`}
        <span style={{ color: 'var(--text-3)', fontWeight: 400, fontSize: 12, marginLeft: 10 }}>
          {vaca.raza} · {sorted.length} registros
        </span>
      </div>

      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        {/* Metano chart */}
        <div style={{ flex: '1 1 300px' }}>
          <div style={{ color: 'var(--text-2)', fontSize: 12, marginBottom: 6 }}>
            Intensidad metano (g CH₄/kg leche)
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={sorted} margin={{ top: 4, right: 8, bottom: 4, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="fecha" tick={{ fill: '#545e78', fontSize: 10 }} tickFormatter={s => s ? s.slice(0, 7) : ''} />
              <YAxis tick={{ fill: '#545e78', fontSize: 10 }} />
              <Tooltip {...tooltipStyle} formatter={v => [fmt1(v), 'Metano']} />
              <Line type="monotone" dataKey="intensidad_metano" stroke="#ffc857" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Leche chart */}
        <div style={{ flex: '1 1 300px' }}>
          <div style={{ color: 'var(--text-2)', fontSize: 12, marginBottom: 6 }}>
            Producción de leche (kg/día)
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={sorted} margin={{ top: 4, right: 8, bottom: 4, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="fecha" tick={{ fill: '#545e78', fontSize: 10 }} tickFormatter={s => s ? s.slice(0, 7) : ''} />
              <YAxis tick={{ fill: '#545e78', fontSize: 10 }} />
              <Tooltip {...tooltipStyle} formatter={v => [fmt1(v), 'Leche kg/día']} />
              <Line type="monotone" dataKey="leche_kg_dia" stroke="#4b9dff" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Last 5 visits */}
      <div>
        <div style={{ color: 'var(--text-2)', fontSize: 12, marginBottom: 8 }}>Últimas 5 visitas</div>
        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th style={{ textAlign: 'right' }}>Metano</th>
                <th style={{ textAlign: 'right' }}>Leche kg/día</th>
                <th style={{ textAlign: 'right' }}>Peso kg</th>
                <th style={{ textAlign: 'right' }}>THI</th>
                <th>Nivel emisión</th>
                <th>Notas</th>
              </tr>
            </thead>
            <tbody>
              {last5.map((r, i) => (
                <tr key={i}>
                  <td style={{ color: 'var(--text-3)', fontSize: 12 }}>{fmtDate(r.fecha)}</td>
                  <td style={{ textAlign: 'right', color: metanoColor(r.intensidad_metano), fontWeight: 600 }}>
                    {r.intensidad_metano != null ? fmt1(r.intensidad_metano) : '—'}
                  </td>
                  <td style={{ textAlign: 'right', color: 'var(--text-2)' }}>
                    {r.leche_kg_dia != null ? fmt1(r.leche_kg_dia) : '—'}
                  </td>
                  <td style={{ textAlign: 'right', color: 'var(--text-2)' }}>
                    {r.peso_kg != null ? fmtN(r.peso_kg) : '—'}
                  </td>
                  <td style={{ textAlign: 'right', color: 'var(--text-2)' }}>
                    {r.indice_thi != null ? fmt1(r.indice_thi) : '—'}
                  </td>
                  <td>
                    {r.nivel_emision && (
                      <span style={{
                        fontSize: 11,
                        color: NIVEL_COLORS[r.nivel_emision] || 'var(--text-2)',
                        fontWeight: 600,
                      }}>
                        {r.nivel_emision}
                      </span>
                    )}
                  </td>
                  <td style={{ color: 'var(--text-3)', fontSize: 11, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.notas || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── Tab 2: Tendencia ──────────────────────────────────────────────────────────

function TabTendencia({ stats }) {
  if (!stats) return <Spinner />

  const tendencia = stats.tendencia || []
  const niveles   = stats.niveles   || []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* KPIs */}
      <div className="kpi-grid">
        <KpiCard
          label="Total registros"
          value={(stats.global?.total || 0).toLocaleString()}
          cls="kpi-accent"
        />
        <KpiCard
          label="Vacas activas"
          value={(stats.global?.vacas || 0).toLocaleString()}
        />
        <KpiCard
          label="Metano medio"
          value={stats.global?.metano_medio != null ? fmt1(stats.global.metano_medio) : '—'}
          sub="g CH₄/kg leche"
        />
        <KpiCard
          label="Leche media"
          value={stats.global?.leche_media != null ? fmt1(stats.global.leche_media) : '—'}
          sub="kg/día"
        />
        <KpiCard
          label="Alertas totales"
          value={(stats.global?.alertas || 0).toLocaleString()}
          cls="kpi-danger"
        />
        <KpiCard
          label="Razas"
          value={stats.global?.razas || '—'}
        />
      </div>

      {/* Metano trend */}
      <div className="card">
        <div className="card-title">Metano medio mensual (g CH₄/kg leche)</div>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={tendencia} margin={{ top: 8, right: 16, bottom: 8, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="mes_año" tick={{ fill: '#545e78', fontSize: 11 }} />
            <YAxis tick={{ fill: '#545e78', fontSize: 11 }} />
            <Tooltip {...tooltipStyle} formatter={v => [fmt1(v), 'Metano medio']} />
            <Line type="monotone" dataKey="metano_medio" stroke="#ffc857" strokeWidth={2.5} dot={{ r: 3, fill: '#ffc857' }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
        {/* Registros + alertas bar */}
        <div className="card" style={{ flex: '2 1 400px' }}>
          <div className="card-title">Registros y alertas por mes</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={tendencia} margin={{ top: 8, right: 16, bottom: 8, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="mes_año" tick={{ fill: '#545e78', fontSize: 11 }} />
              <YAxis tick={{ fill: '#545e78', fontSize: 11 }} />
              <Tooltip
                {...tooltipStyle}
                formatter={(v, name) => [
                  v.toLocaleString(),
                  name === 'n_registros' ? 'Registros' : 'Alertas',
                ]}
              />
              <Legend
                formatter={name => name === 'n_registros' ? 'Registros' : 'Alertas'}
                wrapperStyle={{ fontSize: 12, color: '#8890a8' }}
              />
              <Bar dataKey="n_registros" fill="#4b9dff" radius={[3, 3, 0, 0]} />
              <Bar dataKey="alertas_mes" fill="#ff5757" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Emission level donut */}
        <div className="card" style={{ flex: '1 1 220px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div className="card-title" style={{ alignSelf: 'flex-start' }}>Distribución de emisiones</div>
          {niveles.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={niveles}
                    dataKey="n"
                    nameKey="nivel_emision"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                  >
                    {niveles.map((entry, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={tooltipStyle.contentStyle}
                    formatter={(v, name) => [v.toLocaleString(), name]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
                {niveles.map((entry, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span style={{ color: 'var(--text-2)' }}>{entry.nivel_emision}</span>
                    <span style={{ color: 'var(--text-3)' }}>({entry.n?.toLocaleString()})</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{ color: 'var(--text-3)', fontSize: 13, marginTop: 24 }}>Sin datos</div>
          )}
        </div>
      </div>

      {/* Razas table */}
      {(stats.razas || []).length > 0 && (
        <div className="card">
          <div className="card-title">Resumen por raza</div>
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Raza</th>
                  <th style={{ textAlign: 'right' }}>Registros</th>
                  <th style={{ textAlign: 'right' }}>Metano medio</th>
                  <th style={{ textAlign: 'right' }}>Leche media</th>
                  <th style={{ textAlign: 'right' }}>Alertas</th>
                </tr>
              </thead>
              <tbody>
                {stats.razas.map(r => (
                  <tr key={r.raza}>
                    <td style={{ color: 'var(--text-1)', fontWeight: 600 }}>{r.raza}</td>
                    <td style={{ textAlign: 'right', color: 'var(--text-2)' }}>{(r.n || 0).toLocaleString()}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: metanoColor(r.metano_medio) }}>
                      {r.metano_medio != null ? fmt1(r.metano_medio) : '—'}
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--text-2)' }}>
                      {r.leche_media != null ? fmt1(r.leche_media) : '—'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {r.alertas > 0
                        ? <span className="badge-red" style={{ fontSize: 11 }}>🚨 {r.alertas}</span>
                        : <span style={{ color: 'var(--text-3)' }}>—</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Tab 3: Cruce de Variables con selector de tipo ───────────────────────────

const CHART_TYPES = [
  { id: 'scatter', label: '⬡ Dispersión' },
  { id: 'histo',   label: '▬ Distribución' },
  { id: 'barras',  label: '▨ Por Raza'    },
]

// Construye histograma de un array de valores numéricos
function buildHistogram(values, bins = 28) {
  const valid = values.filter(v => v != null && isFinite(v))
  if (!valid.length) return []
  const min = Math.min(...valid)
  const max = Math.max(...valid)
  const step = (max - min) / bins || 1
  const buckets = Array.from({ length: bins }, (_, i) => ({
    x: parseFloat((min + i * step).toFixed(2)),
    n: 0,
  }))
  valid.forEach(v => {
    const idx = Math.min(Math.floor((v - min) / step), bins - 1)
    buckets[idx].n++
  })
  return buckets
}

// Agrupa por raza y calcula promedio de la variable Y
function buildByRaza(data) {
  const groups = {}
  data.forEach(d => {
    const r = d.raza || 'Sin raza'
    if (!groups[r]) groups[r] = { raza: r, sum: 0, n: 0, alto: 0, bajo: 0 }
    groups[r].sum += d.y_col ?? 0
    groups[r].n++
    if (d.nivel_emision === 'Alto')  groups[r].alto++
    if (d.nivel_emision === 'Bajo')  groups[r].bajo++
  })
  return Object.values(groups)
    .map(g => ({ ...g, promedio: parseFloat((g.sum / g.n).toFixed(3)) }))
    .sort((a, b) => b.promedio - a.promedio)
}

function TabScatter() {
  const [chartType, setChartType] = useState('scatter')
  const [xVar,   setXVar]   = useState('leche_kg_dia')
  const [yVar,   setYVar]   = useState('intensidad_metano')
  const [raza,   setRaza]   = useState('Todas')
  const [data,   setData]   = useState([])
  const [loading, setLoading] = useState(false)
  const [error,  setError]  = useState(null)

  const fetchScatter = useCallback(() => {
    setLoading(true)
    setError(null)
    const razaParam = raza !== 'Todas' ? `&raza=${encodeURIComponent(raza)}` : ''
    // Para distribución solo necesitamos Y; para barras por raza, fetcheamos sin filtro de raza
    const xQ = chartType === 'histo' ? yVar : xVar
    fetch(`${API}/hato/scatter?x=${xQ}&y=${yVar}${razaParam}&limit=5000`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(d => setData(d.data || []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [xVar, yVar, raza, chartType])

  useEffect(() => { fetchScatter() }, [fetchScatter])

  const xLabel = SCATTER_VARS.find(v => v.value === xVar)?.label || xVar
  const yLabel = SCATTER_VARS.find(v => v.value === yVar)?.label || yVar

  // Datos derivados según tipo
  const byNivel   = ['Bajo', 'Medio', 'Alto'].map(n => ({
    nivel: n, points: data.filter(d => d.nivel_emision === n),
  })).filter(g => g.points.length > 0)

  const histData  = buildHistogram(data.map(d => d.y_col))
  const razaData  = buildByRaza(data)

  // Color para barras de histograma según posición del eje Y
  function histColor(x) {
    if (yVar === 'intensidad_metano') {
      if (x > 25) return '#ff5757'
      if (x > 18) return '#ffc857'
      return '#00c896'
    }
    return '#4b9dff'
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Selector de tipo de gráfica ── */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {CHART_TYPES.map(ct => (
          <button
            key={ct.id}
            onClick={() => setChartType(ct.id)}
            style={{
              padding: '7px 16px',
              borderRadius: 8,
              border: '1px solid',
              borderColor: chartType === ct.id ? 'var(--accent)' : 'var(--border)',
              background: chartType === ct.id ? 'rgba(0,200,150,0.12)' : 'var(--bg-card-2)',
              color: chartType === ct.id ? 'var(--accent)' : 'var(--text-2)',
              fontSize: 13,
              fontWeight: chartType === ct.id ? 700 : 400,
              cursor: 'pointer',
              fontFamily: 'var(--font)',
              transition: 'all 0.15s',
            }}
          >
            {ct.label}
          </button>
        ))}
        <span style={{ color: 'var(--text-3)', fontSize: 12, marginLeft: 4 }}>
          {data.length.toLocaleString()} puntos
        </span>
      </div>

      {/* ── Controles de variables ── */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        {chartType === 'scatter' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ color: 'var(--text-3)', fontSize: 11 }}>Eje X</label>
            <Select value={xVar} onChange={setXVar} options={SCATTER_VARS} />
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ color: 'var(--text-3)', fontSize: 11 }}>
            {chartType === 'scatter' ? 'Eje Y' : 'Variable'}
          </label>
          <Select value={yVar} onChange={setYVar} options={SCATTER_VARS} />
        </div>
        {chartType !== 'barras' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ color: 'var(--text-3)', fontSize: 11 }}>Raza</label>
            <Select
              value={raza}
              onChange={setRaza}
              options={RAZAS.map(r => ({ value: r, label: r }))}
            />
          </div>
        )}
      </div>

      {error && <div className="error-box">Error: {error}</div>}

      {/* ── Gráfica ── */}
      <div className="card">
        {/* Título dinámico */}
        <div className="card-title">
          {chartType === 'scatter' && (
            <>{yLabel} vs {xLabel}
              <span style={{ color: 'var(--text-3)', fontWeight: 400, fontSize: 12, marginLeft: 8 }}>
                · coloreado por nivel de emisión
              </span>
            </>
          )}
          {chartType === 'histo' && (
            <>Distribución — {yLabel}</>
          )}
          {chartType === 'barras' && (
            <>Promedio de {yLabel} por Raza</>
          )}
        </div>

        {loading ? (
          <div style={{ height: 380 }}><Spinner /></div>
        ) : (
          <>
            {/* ── Dispersión (Scatter) ── */}
            {chartType === 'scatter' && (
              <ResponsiveContainer width="100%" height={380}>
                <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis
                    dataKey="x_col" name={xLabel} type="number"
                    tick={{ fill: '#545e78', fontSize: 11 }}
                    label={{ value: xLabel, position: 'insideBottom', offset: -10, fill: '#8890a8', fontSize: 12 }}
                  />
                  <YAxis
                    dataKey="y_col" name={yLabel} type="number"
                    tick={{ fill: '#545e78', fontSize: 11 }}
                    label={{ value: yLabel, angle: -90, position: 'insideLeft', offset: 10, fill: '#8890a8', fontSize: 12 }}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle.contentStyle}
                    cursor={{ strokeDasharray: '3 3' }}
                    formatter={(v, name) => [fmt1(v), name]}
                  />
                  <Legend formatter={name => name} wrapperStyle={{ fontSize: 12, color: '#8890a8' }} />
                  {byNivel.map(g => (
                    <Scatter key={g.nivel} name={g.nivel} data={g.points}
                      fill={NIVEL_COLORS[g.nivel]} opacity={0.7} r={3} />
                  ))}
                </ScatterChart>
              </ResponsiveContainer>
            )}

            {/* ── Distribución (Histograma) ── */}
            {chartType === 'histo' && (
              <>
                <div style={{ color: 'var(--text-3)', fontSize: 12, marginBottom: 10 }}>
                  Frecuencia de valores · {data.length.toLocaleString()} registros
                  {raza !== 'Todas' && ` · ${raza}`}
                </div>
                <ResponsiveContainer width="100%" height={340}>
                  <BarChart data={histData} margin={{ top: 8, right: 16, bottom: 20, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis
                      dataKey="x"
                      tick={{ fill: '#545e78', fontSize: 10 }}
                      tickFormatter={v => fmt1(v)}
                      label={{ value: yLabel, position: 'insideBottom', offset: -12, fill: '#8890a8', fontSize: 12 }}
                    />
                    <YAxis tick={{ fill: '#545e78', fontSize: 11 }} />
                    <Tooltip
                      contentStyle={tooltipStyle.contentStyle}
                      formatter={(v, name) => [v.toLocaleString(), 'Frecuencia']}
                      labelFormatter={v => `${yLabel}: ~${fmt1(v)}`}
                    />
                    <Bar dataKey="n" radius={[3, 3, 0, 0]}>
                      {histData.map((entry, i) => (
                        <Cell key={i} fill={histColor(entry.x)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                {/* Estadísticas rápidas */}
                {data.length > 0 && (() => {
                  const vals = data.map(d => d.y_col).filter(v => v != null)
                  const mean = vals.reduce((s, v) => s + v, 0) / vals.length
                  const std  = Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length)
                  return (
                    <div style={{ display: 'flex', gap: 24, marginTop: 14, flexWrap: 'wrap' }}>
                      {[
                        ['Media',  fmt1(mean)],
                        ['Desv. est.', fmt1(std)],
                        ['Mín', fmt1(Math.min(...vals))],
                        ['Máx', fmt1(Math.max(...vals))],
                        ['N', vals.length.toLocaleString()],
                      ].map(([label, val]) => (
                        <div key={label}>
                          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{label}</div>
                          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-1)' }}>{val}</div>
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </>
            )}

            {/* ── Barras por raza ── */}
            {chartType === 'barras' && (
              <>
                <div style={{ color: 'var(--text-3)', fontSize: 12, marginBottom: 10 }}>
                  Promedio de {yLabel} por raza · {data.length.toLocaleString()} registros totales
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={razaData} margin={{ top: 8, right: 24, bottom: 8, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="raza" tick={{ fill: '#8890a8', fontSize: 12 }} />
                    <YAxis tick={{ fill: '#545e78', fontSize: 11 }}
                      label={{ value: yLabel, angle: -90, position: 'insideLeft', offset: 14, fill: '#8890a8', fontSize: 11 }}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle.contentStyle}
                      formatter={(v, name) => [
                        fmt1(v),
                        name === 'promedio' ? `Promedio ${yLabel}` : name,
                      ]}
                    />
                    <Bar dataKey="promedio" radius={[6, 6, 0, 0]}>
                      {razaData.map((entry, i) => (
                        <Cell
                          key={i}
                          fill={
                            yVar === 'intensidad_metano'
                              ? (entry.promedio > 25 ? '#ff5757' : entry.promedio > 18 ? '#ffc857' : '#00c896')
                              : ['#4b9dff', '#a78bfa', '#34d399', '#fb923c'][i % 4]
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>

                {/* Tabla resumen por raza */}
                <div className="data-table-wrapper" style={{ marginTop: 16 }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Raza</th>
                        <th style={{ textAlign: 'right' }}>N registros</th>
                        <th style={{ textAlign: 'right' }}>Promedio {yLabel}</th>
                        <th style={{ textAlign: 'right' }}>Alertas (Alto)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {razaData.map(r => (
                        <tr key={r.raza}>
                          <td style={{ fontWeight: 600, color: 'var(--text-1)' }}>{r.raza}</td>
                          <td style={{ textAlign: 'right', color: 'var(--text-2)' }}>
                            {r.n.toLocaleString()}
                          </td>
                          <td style={{
                            textAlign: 'right',
                            fontWeight: 600,
                            color: yVar === 'intensidad_metano'
                              ? (r.promedio > 25 ? '#ff5757' : r.promedio > 18 ? '#ffc857' : '#00c896')
                              : 'var(--text-1)',
                          }}>
                            {fmt1(r.promedio)}
                          </td>
                          <td style={{ textAlign: 'right', color: r.alto > 0 ? '#ff5757' : 'var(--text-3)' }}>
                            {r.alto > 0 ? `🚨 ${r.alto}` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ── Root component ─────────────────────────────────────────────────────────────

export default function Explorer({ initialVacaId = null, onVacaOpen }) {
  const [tab, setTab]           = useState(0)
  const [stats, setStats]       = useState(null)
  const [vacas, setVacas]       = useState(null)
  const [loadingStats, setLoadingStats] = useState(true)
  const [loadingVacas, setLoadingVacas] = useState(true)
  const [errorStats, setErrorStats]     = useState(null)

  // Si viene un deep-link, aseguramos que estamos en la tab de Vacas
  useEffect(() => {
    if (initialVacaId) setTab(0)
  }, [initialVacaId])

  useEffect(() => {
    fetch(`${API}/hato/stats`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(d => setStats(d))
      .catch(e => setErrorStats(e.message))
      .finally(() => setLoadingStats(false))

    fetch(`${API}/hato/vacas`)
      .then(r => r.json())
      .then(d => setVacas(d.vacas || []))
      .catch(() => setVacas([]))
      .finally(() => setLoadingVacas(false))
  }, [])

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <h1>
          Explorador del Hato
          {stats?.global && (
            <span className="badge-green" style={{ marginLeft: 12, fontSize: 13, fontWeight: 600 }}>
              {(stats.global.total || 0).toLocaleString()} registros
            </span>
          )}
        </h1>
        <p>
          Gestión y análisis de tu ganado lechero ·{' '}
          <strong style={{ color: 'var(--text-1)' }}>
            {stats?.global?.vacas
              ? `${stats.global.vacas.toLocaleString()} vacas`
              : loadingStats ? 'Cargando…' : '—'}
          </strong>
          {stats?.global?.fecha_inicio && (
            <span style={{ color: 'var(--text-3)', marginLeft: 8, fontSize: 12 }}>
              · {fmtDate(stats.global.fecha_inicio)} → {fmtDate(stats.global.fecha_fin)}
            </span>
          )}
        </p>
      </div>

      {errorStats && (
        <div className="error-box" style={{ marginBottom: 16 }}>
          Error al cargar estadísticas: {errorStats}
        </div>
      )}

      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: 2,
        marginBottom: 24,
        borderBottom: '1px solid var(--border)',
      }}>
        {TABS.map((label, i) => (
          <button
            key={label}
            onClick={() => setTab(i)}
            className="predictor-tab"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '10px 20px',
              fontSize: 13,
              fontWeight: tab === i ? 700 : 400,
              color: tab === i ? 'var(--accent)' : 'var(--text-2)',
              borderBottom: tab === i ? '2px solid var(--accent)' : '2px solid transparent',
              marginBottom: -1,
              transition: 'color 0.15s',
              fontFamily: 'var(--font)',
            }}
          >
            {label}
            {label === 'Vacas' && (vacas != null) && (
              <span style={{
                marginLeft: 6,
                fontSize: 11,
                color: tab === 0 ? 'var(--accent)' : 'var(--text-3)',
                background: 'var(--bg-card-2)',
                padding: '1px 6px',
                borderRadius: 10,
              }}>
                {vacas.length.toLocaleString()}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 0 && (
        <TabVacas
          vacas={vacas}
          loadingVacas={loadingVacas}
          initialVacaId={initialVacaId}
          onVacaOpen={onVacaOpen}
        />
      )}
      {tab === 1 && (
        loadingStats
          ? <Spinner />
          : <TabTendencia stats={stats} />
      )}
      {tab === 2 && (
        <TabScatter />
      )}
    </div>
  )
}
