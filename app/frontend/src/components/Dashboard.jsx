import { useEffect, useState } from 'react'
import { useSort, SortTh } from '../hooks/useSort'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, PieChart, Pie, Cell, Legend,
} from 'recharts'

const API = '/api'

const COLORS_NIVEL = {
  Bajo:  '#00c896',
  Medio: '#ffc857',
  Alto:  '#ff5757',
}

const TOOLTIP_STYLE = {
  contentStyle: {
    background: '#1a1d27',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8,
    fontSize: 12,
    color: '#eef0f7',
  },
  labelStyle: { color: '#eef0f7' },
  itemStyle:  { color: '#c8cdd8' },
}

function metanoColor(val) {
  if (val == null) return 'var(--text-1)'
  if (val < 18)   return '#00c896'
  if (val <= 25)  return '#ffc857'
  return '#ff5757'
}

function metanoClass(val) {
  if (val == null) return ''
  if (val < 18)   return 'kpi-accent'
  if (val <= 25)  return 'kpi-warn'
  return 'kpi-danger'
}

export default function Dashboard() {
  const [hatoStats, setHatoStats]   = useState(null)
  const [modelInfo, setModelInfo]   = useState(null)
  const [loading,   setLoading]     = useState(true)
  const [error,     setError]       = useState(null)

  useEffect(() => {
    Promise.all([
      fetch(`${API}/hato/stats`).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() }),
      fetch(`${API}/model-info`).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() }),
    ])
      .then(([hs, mi]) => { setHatoStats(hs); setModelInfo(mi) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  // ── Hooks SIEMPRE antes de cualquier early return (React Rules of Hooks) ──
  const razas      = hatoStats?.razas    || []
  const alertasRaw = hatoStats?.alertas  || []
  const { sorted: razasSorted, sortKey: razaKey, sortDir: razaDir, toggleSort: razaSort } =
    useSort(razas, 'alertas', 'desc')
  const { sorted: alertas, sortKey: altKey, sortDir: altDir, toggleSort: altSort } =
    useSort(alertasRaw, 'intensidad_metano', 'desc')

  if (loading) return (
    <div className="loading">
      <div className="spinner" />
      <span>Cargando datos del hato…</span>
    </div>
  )
  if (error) return (
    <div className="error-box">
      Error al conectar con la API: {error}
      <br />Verifica que el servidor esté corriendo en el puerto 3001.
    </div>
  )

  const g         = hatoStats?.global    || {}
  const niveles   = hatoStats?.niveles   || []
  const tendencia = hatoStats?.tendencia || []

  const nivelPie = niveles.map(d => ({
    name:  d.nivel_emision,
    value: d.n,
  }))

  const metanoMedio = typeof g.metano_medio === 'number' ? g.metano_medio : null

  const periodoLabel = (() => {
    if (g.fecha_inicio && g.fecha_fin) {
      const fmt = iso => {
        const d = new Date(iso)
        return d.toLocaleDateString('es-MX', { month: 'short', year: 'numeric' })
      }
      return `${fmt(g.fecha_inicio)} → ${fmt(g.fecha_fin)}`
    }
    return 'ene 2024 → dic 2025'
  })()

  return (
    <div>
      {/* ── Page header ── */}
      <div className="page-header">
        <h1>
          Resumen del Hato
          {modelInfo?.avance && (
            <span className="badge badge-green" style={{ marginLeft: 10 }}>
              Modelo {modelInfo.avance}
            </span>
          )}
        </h1>
        <p>
          {(g.n_historico || 73000).toLocaleString()} visitas &middot;&nbsp;
          {g.vacas || 100} vacas &middot;&nbsp;
          {g.razas || 3} razas &middot;&nbsp;
          24 meses
        </p>
      </div>

      {/* ── Section 1: KPI cards ── */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <span className="kpi-label">Total registros</span>
          <span className="kpi-value kpi-accent">
            {(g.total || g.n_historico || 0).toLocaleString()}
          </span>
          <span className="kpi-sub">
            {g.n_nuevos ? `+${g.n_nuevos} nuevos` : 'histórico completo'}
          </span>
        </div>

        <div className="kpi-card">
          <span className="kpi-label">Vacas únicas</span>
          <span className="kpi-value">{g.vacas || '—'}</span>
          <span className="kpi-sub">{g.razas || 3} razas registradas</span>
        </div>

        <div className="kpi-card">
          <span className="kpi-label">Metano medio</span>
          <span className={`kpi-value ${metanoClass(metanoMedio)}`}>
            {metanoMedio != null ? metanoMedio.toFixed(2) : '—'}
          </span>
          <span className="kpi-sub">g CH₄/kg leche</span>
        </div>

        <div className="kpi-card">
          <span className="kpi-label">Leche media</span>
          <span className="kpi-value">
            {typeof g.leche_media === 'number' ? g.leche_media.toFixed(1) : '—'}
          </span>
          <span className="kpi-sub">kg/día por vaca</span>
        </div>

        <div className="kpi-card">
          <span className="kpi-label">Alertas totales</span>
          <span className={`kpi-value ${g.alertas > 0 ? 'kpi-danger' : 'kpi-accent'}`}>
            {g.alertas ?? '—'}
          </span>
          <span className="kpi-sub">emisión alta detectada</span>
        </div>

        <div className="kpi-card">
          <span className="kpi-label">Período</span>
          <span className="kpi-value" style={{ fontSize: 16, marginTop: 6 }}>
            {periodoLabel}
          </span>
          <span className="kpi-sub">ventana de análisis</span>
        </div>
      </div>

      {/* ── Section 2: Charts row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 24 }}>

        {/* Left: Line chart — Tendencia metano */}
        <div className="chart-card" style={{ gridColumn: '1 / 2' }}>
          <h3 className="card-title">Tendencia de Metano — 24 meses</h3>
          {tendencia.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={tendencia} margin={{ top: 10, right: 20, bottom: 10, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis
                  dataKey="mes_año"
                  tick={{ fill: '#8890a8', fontSize: 10 }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fill: '#8890a8', fontSize: 11 }}
                  domain={['auto', 'auto']}
                />
                <Tooltip
                  {...TOOLTIP_STYLE}
                  formatter={(val, name) => [
                    typeof val === 'number' ? val.toFixed(2) : val,
                    name === 'metano_medio' ? 'Metano medio' : name,
                  ]}
                  cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }}
                />
                <ReferenceLine
                  y={18}
                  stroke="#ffc857"
                  strokeDasharray="4 3"
                  label={{ value: '18 warn', fill: '#ffc857', fontSize: 10, position: 'insideTopRight' }}
                />
                <ReferenceLine
                  y={25}
                  stroke="#ff5757"
                  strokeDasharray="4 3"
                  label={{ value: '25 crítico', fill: '#ff5757', fontSize: 10, position: 'insideTopRight' }}
                />
                <Line
                  type="monotone"
                  dataKey="metano_medio"
                  stroke="#00c896"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#00c896' }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="loading" style={{ height: 240 }}>Sin datos de tendencia</div>
          )}
        </div>

        {/* Right: Pie + Razas table */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Donut pie */}
          <div className="chart-card">
            <h3 className="card-title">Distribución Emisiones</h3>
            {nivelPie.some(d => d.value > 0) ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={nivelPie}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    dataKey="value"
                    paddingAngle={3}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {nivelPie.map(entry => (
                      <Cell key={entry.name} fill={COLORS_NIVEL[entry.name] || '#8890a8'} />
                    ))}
                  </Pie>
                  <Tooltip
                    {...TOOLTIP_STYLE}
                    formatter={val => [val.toLocaleString(), 'Registros']}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, color: '#8890a8' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="loading" style={{ height: 180 }}>Sin datos</div>
            )}
          </div>

          {/* Razas mini-table */}
          {razas.length > 0 && (
            <div className="card">
              <div className="card-title">Estadísticas por Raza</div>
              <div className="data-table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <SortTh colKey="raza"         label="Raza"     sortKey={razaKey} sortDir={razaDir} onSort={razaSort} />
                      <SortTh colKey="n"            label="N"        sortKey={razaKey} sortDir={razaDir} onSort={razaSort} align="right" />
                      <SortTh colKey="metano_medio" label="CH₄ med"  sortKey={razaKey} sortDir={razaDir} onSort={razaSort} align="right" />
                      <SortTh colKey="alertas"      label="Alertas"  sortKey={razaKey} sortDir={razaDir} onSort={razaSort} align="right" />
                    </tr>
                  </thead>
                  <tbody>
                    {razasSorted.map(r => (
                      <tr key={r.raza}>
                        <td style={{ color: 'var(--text-1)', fontWeight: 500 }}>{r.raza}</td>
                        <td style={{ textAlign: 'right', color: 'var(--text-2)' }}>
                          {(r.n || 0).toLocaleString()}
                        </td>
                        <td style={{ textAlign: 'right', color: metanoColor(r.metano_medio), fontWeight: 600 }}>
                          {typeof r.metano_medio === 'number' ? r.metano_medio.toFixed(2) : '—'}
                        </td>
                        <td style={{ textAlign: 'right', color: r.alertas > 0 ? '#ff5757' : 'var(--text-3)' }}>
                          {r.alertas ?? 0}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Section 3: Alertas recientes ── */}
      <div className="card" style={{ marginTop: 24 }}>
        <div className="card-title">
          Alertas recientes
          {alertas.length > 0 && (
            <span style={{ marginLeft: 10, fontSize: 12, color: '#ff5757', fontWeight: 500 }}>
              {alertas.length} {alertas.length === 1 ? 'vaca con emisión alta' : 'vacas con emisión alta'}
            </span>
          )}
        </div>

        {alertas.length === 0 ? (
          <div style={{ color: 'var(--text-3)', padding: '24px 0', textAlign: 'center', fontSize: 14 }}>
            No hay alertas activas. El hato está dentro de los rangos normales.
          </div>
        ) : (
          <div className="data-table-wrapper" style={{ maxHeight: 420, overflowY: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <SortTh colKey="id_vaca"            label="Vaca"         sortKey={altKey} sortDir={altDir} onSort={altSort} />
                  <th>Nombre</th>
                  <SortTh colKey="raza"               label="Raza"         sortKey={altKey} sortDir={altDir} onSort={altSort} />
                  <SortTh colKey="fecha"              label="Fecha"        sortKey={altKey} sortDir={altDir} onSort={altSort} />
                  <SortTh colKey="intensidad_metano"  label="CH₄ (g/kg)"   sortKey={altKey} sortDir={altDir} onSort={altSort} align="right" />
                  <SortTh colKey="leche_kg_dia"       label="Leche kg/día" sortKey={altKey} sortDir={altDir} onSort={altSort} align="right" />
                </tr>
              </thead>
              <tbody>
                {alertas.map((a, i) => {
                  const isAlto = (a.intensidad_metano ?? 0) > 25
                  return (
                    <tr
                      key={a.id_vaca ?? i}
                      style={{
                        background: isAlto ? 'rgba(255,87,87,0.08)' : 'transparent',
                      }}
                    >
                      <td style={{ color: isAlto ? '#ff5757' : 'var(--text-1)', fontWeight: 600 }}>
                        {a.id_vaca ?? '—'}
                      </td>
                      <td style={{ color: 'var(--text-1)' }}>{a.nombre_vaca ?? '—'}</td>
                      <td style={{ color: 'var(--text-2)' }}>{a.raza ?? '—'}</td>
                      <td style={{ color: 'var(--text-2)', fontSize: 12 }}>
                        {a.fecha
                          ? new Date(a.fecha).toLocaleDateString('es-MX', {
                              day: '2-digit', month: 'short', year: 'numeric',
                            })
                          : '—'}
                      </td>
                      <td style={{ textAlign: 'right', color: metanoColor(a.intensidad_metano), fontWeight: 700 }}>
                        {typeof a.intensidad_metano === 'number' ? a.intensidad_metano.toFixed(2) : '—'}
                      </td>
                      <td style={{ textAlign: 'right', color: 'var(--text-2)' }}>
                        {typeof a.leche_kg_dia === 'number' ? a.leche_kg_dia.toFixed(1) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
