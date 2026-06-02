import { useEffect, useState } from 'react'
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, BarChart, Bar, Cell,
} from 'recharts'

const API = '/api'

const SEVERITY_STYLE = {
  Bajo:     { bg: 'rgba(0,200,150,0.15)',  color: '#00c896', badgeClass: 'badge-green'  },
  Moderado: { bg: 'rgba(255,200,87,0.15)', color: '#ffc857', badgeClass: 'badge-yellow' },
  Alto:     { bg: 'rgba(255,140,40,0.15)', color: '#ff8c28', badgeClass: 'badge-yellow' },
  Crítico:  { bg: 'rgba(255,87,87,0.15)',  color: '#ff5757', badgeClass: 'badge-red'    },
}

function SeverityBadge({ severity }) {
  const cfg = SEVERITY_STYLE[severity] || SEVERITY_STYLE['Moderado']
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '3px 12px',
        borderRadius: 20,
        fontSize: 12,
        fontWeight: 700,
        background: cfg.bg,
        color: cfg.color,
        border: `1px solid ${cfg.color}55`,
        letterSpacing: '0.03em',
      }}
    >
      {severity}
    </span>
  )
}

function driftPctColor(pct) {
  if (pct < 10)  return '#00c896'
  if (pct <= 25) return '#ffc857'
  return '#ff5757'
}

function fmt3(v) {
  return typeof v === 'number' ? v.toFixed(3) : '—'
}

function fmt4(v) {
  return typeof v === 'number' ? v.toFixed(4) : '—'
}

/* ── KS visual bar for a single feature ── */
function FeatureBar({ row }) {
  const MAX_KS = 0.5
  const pct = Math.min(100, ((row.ks_stat || 0) / MAX_KS) * 100)
  const barColor = row.drifted ? '#ff5757' : '#00c896'

  return (
    <div
      style={{
        padding: '10px 16px',
        borderRadius: 8,
        background: row.drifted ? 'rgba(255,87,87,0.06)' : 'transparent',
        border: `1px solid ${row.drifted ? 'rgba(255,87,87,0.2)' : 'rgba(255,255,255,0.05)'}`,
        marginBottom: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ color: row.drifted ? '#ff5757' : 'var(--text-1)', fontWeight: row.drifted ? 700 : 500, fontSize: 13 }}>
          {row.feature}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: 'var(--text-3)', fontSize: 12 }}>
            {fmt3(row.ref_mean)} &rarr; {fmt3(row.new_mean)}
          </span>
          {row.drifted ? (
            <span style={{
              padding: '2px 8px',
              borderRadius: 10,
              fontSize: 11,
              fontWeight: 700,
              background: 'rgba(255,87,87,0.2)',
              color: '#ff5757',
            }}>
              DRIFT
            </span>
          ) : (
            <span style={{
              padding: '2px 8px',
              borderRadius: 10,
              fontSize: 11,
              fontWeight: 600,
              background: 'rgba(0,200,150,0.15)',
              color: '#00c896',
            }}>
              OK
            </span>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div style={{
        height: 6,
        borderRadius: 3,
        background: 'rgba(255,255,255,0.07)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute',
          left: 0, top: 0, bottom: 0,
          width: `${pct}%`,
          borderRadius: 3,
          background: barColor,
          transition: 'width 0.4s ease',
        }} />
      </div>
      <div style={{ marginTop: 4, color: 'var(--text-3)', fontSize: 11 }}>
        KS = {fmt4(row.ks_stat)} &nbsp;/&nbsp; máx 0.5
      </div>
    </div>
  )
}

const NIVEL_COLORS = { Bajo: '#00c896', Medio: '#ffc857', Alto: '#ff5757' }

function ComparacionView() {
  const [cmp,     setCmp]     = useState(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)

  function loadCmp() {
    setLoading(true)
    setError(null)
    fetch(`${API}/comparacion`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(d => setCmp(d))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }

  if (!cmp) return (
    <div className="card" style={{ marginTop: 0 }}>
      <div className="card-title">Predicción vs Valor Real</div>
      <p style={{ color: 'var(--text-2)', fontSize: 14, lineHeight: 1.7, marginBottom: 20 }}>
        Compara las predicciones del modelo MLP contra los valores reales de intensidad de metano medidos en el dataset histórico.
        Muestra el ajuste del modelo sobre una muestra aleatoria.
      </p>
      {error && <div className="error-box" style={{ marginBottom: 16 }}>Error: {error}</div>}
      <button className="btn btn-primary" onClick={loadCmp} disabled={loading}>
        {loading ? '⏳ Calculando…' : '🔬 Cargar comparación'}
      </button>
    </div>
  )

  if (!cmp.ready) return (
    <div className="card" style={{ marginTop: 0 }}>
      <div className="card-title">Predicción vs Valor Real</div>
      <div className="error-box" style={{ marginBottom: 16 }}>{cmp.message}</div>
      <button className="btn btn-ghost" onClick={loadCmp} style={{ fontSize: 12 }}>
        🔄 Reintentar
      </button>
    </div>
  )

  const { data, stats } = cmp

  // Agrupar por nivel para colorear en scatter
  const byNivel = ['Bajo', 'Medio', 'Alto'].map(n => ({
    nivel:  n,
    points: data.filter(d => (d.nivel_real || d.nivel_pred) === n),
  })).filter(g => g.points.length > 0)

  // Histograma de residuos (buckets de 0.5)
  const BUCKET = 0.5
  const residuos = data.map(d => d.residuo)
  const rMin = Math.floor(Math.min(...residuos))
  const rMax = Math.ceil(Math.max(...residuos))
  const buckets = {}
  for (let b = rMin; b <= rMax; b += BUCKET) {
    const key = parseFloat(b.toFixed(1))
    buckets[key] = 0
  }
  residuos.forEach(r => {
    const b = parseFloat((Math.floor(r / BUCKET) * BUCKET).toFixed(1))
    if (buckets[b] !== undefined) buckets[b]++
  })
  const histData = Object.entries(buckets).map(([x, n]) => ({ x: parseFloat(x), n }))

  // Rango para la línea de referencia perfecta (y = x)
  const allVals  = data.flatMap(d => [d.real, d.predicho])
  const axisMin  = Math.floor(Math.min(...allVals))
  const axisMax  = Math.ceil(Math.max(...allVals))

  const tooltipCfg = {
    contentStyle: { background: '#1a1d27', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12, color: '#eef0f7' },
    labelStyle:   { color: '#eef0f7' },
    itemStyle:    { color: '#c8cdd8' },
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* KPIs */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
        <div className="kpi-card">
          <span className="kpi-label">Muestra</span>
          <span className="kpi-value kpi-accent">{stats.n}</span>
          <span className="kpi-sub">registros comparados</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">RMSE</span>
          <span className="kpi-value">{stats.rmse}</span>
          <span className="kpi-sub">g CH₄/kg leche</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">MAE</span>
          <span className="kpi-value">{stats.mae}</span>
          <span className="kpi-sub">error absoluto medio</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">R²</span>
          <span className="kpi-value kpi-accent">{stats.r2}</span>
          <span className="kpi-sub">varianza explicada</span>
        </div>
        <div className="kpi-card" style={{ gridColumn: 'span 1' }}>
          <button
            className="btn btn-ghost"
            onClick={loadCmp}
            style={{ fontSize: 12, marginTop: 8 }}
          >
            🔄 Nueva muestra
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Scatter: real vs predicho */}
        <div className="card">
          <div className="card-title">Real vs Predicho</div>
          <div style={{ color: 'var(--text-3)', fontSize: 12, marginBottom: 8 }}>
            Los puntos sobre la línea diagonal indican predicción perfecta
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart margin={{ top: 8, right: 16, bottom: 20, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis
                dataKey="real"
                name="Real"
                type="number"
                domain={[axisMin, axisMax]}
                tick={{ fill: '#545e78', fontSize: 11 }}
                label={{ value: 'Real (g CH₄/kg)', position: 'insideBottom', offset: -12, fill: '#8890a8', fontSize: 12 }}
              />
              <YAxis
                dataKey="predicho"
                name="Predicho"
                type="number"
                domain={[axisMin, axisMax]}
                tick={{ fill: '#545e78', fontSize: 11 }}
                label={{ value: 'Predicho', angle: -90, position: 'insideLeft', offset: 14, fill: '#8890a8', fontSize: 12 }}
              />
              {/* Línea perfecta y = x */}
              <ReferenceLine
                segment={[{ x: axisMin, y: axisMin }, { x: axisMax, y: axisMax }]}
                stroke="rgba(255,255,255,0.25)"
                strokeDasharray="4 3"
              />
              <Tooltip
                {...tooltipCfg}
                formatter={(v, name) => [typeof v === 'number' ? v.toFixed(2) : v, name]}
              />
              {byNivel.length > 0
                ? byNivel.map(g => (
                    <Scatter
                      key={g.nivel}
                      name={g.nivel}
                      data={g.points}
                      fill={NIVEL_COLORS[g.nivel] || '#8890a8'}
                      opacity={0.6}
                      r={3}
                    />
                  ))
                : (
                  <Scatter
                    name="Todos"
                    data={data}
                    fill="#4b9dff"
                    opacity={0.5}
                    r={3}
                  />
                )
              }
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        {/* Histograma de residuos */}
        <div className="card">
          <div className="card-title">Distribución de Residuos</div>
          <div style={{ color: 'var(--text-3)', fontSize: 12, marginBottom: 8 }}>
            residuo = real − predicho · centrado en 0 = sin sesgo
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={histData} margin={{ top: 8, right: 16, bottom: 20, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis
                dataKey="x"
                tick={{ fill: '#545e78', fontSize: 10 }}
                label={{ value: 'Residuo', position: 'insideBottom', offset: -12, fill: '#8890a8', fontSize: 12 }}
              />
              <YAxis tick={{ fill: '#545e78', fontSize: 11 }} />
              <Tooltip
                {...tooltipCfg}
                formatter={(v, name) => [v, 'Frecuencia']}
              />
              <ReferenceLine x={0} stroke="rgba(255,255,255,0.3)" strokeDasharray="3 3" />
              <Bar dataKey="n" radius={[3, 3, 0, 0]}>
                {histData.map(entry => (
                  <Cell
                    key={entry.x}
                    fill={Math.abs(entry.x) < 1 ? '#00c896' : Math.abs(entry.x) < 2 ? '#ffc857' : '#ff5757'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

export default function Monitor() {
  const [activeTab, setActiveTab]     = useState('drift')
  const [driftData, setDriftData]     = useState(null)
  const [historial, setHistorial]     = useState([])
  const [loading,   setLoading]       = useState(true)
  const [error,     setError]         = useState(null)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetch(`${API}/drift/db`).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() }),
      fetch(`${API}/drift/historial`).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() }),
    ])
      .then(([dd, hist]) => {
        setDriftData(dd)
        setHistorial(hist?.historial || [])
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="loading">
      <div className="spinner" />
      <span>Analizando distribuciones…</span>
    </div>
  )

  if (error) return (
    <div className="error-box">
      Error al conectar con la API: {error}
      <br />Verifica que el servidor esté corriendo en el puerto 3001.
    </div>
  )

  const details = driftData?.details || []

  // ── Tabs ──
  const TABS = [
    { id: 'drift',   label: '📡 Monitor de Drift' },
    { id: 'modelo',  label: '🔬 Predicción vs Real' },
  ]

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <h1>Monitor</h1>
        <p>
          Detecta distributional shift y evalúa el ajuste del modelo contra valores reales
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 24, borderBottom: '1px solid var(--border)' }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className="predictor-tab"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '10px 20px',
              fontSize: 13,
              fontWeight: activeTab === t.id ? 700 : 400,
              color: activeTab === t.id ? 'var(--accent)' : 'var(--text-2)',
              borderBottom: activeTab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
              marginBottom: -1,
              fontFamily: 'var(--font)',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: DRIFT ──────────────────────────────────────────────────── */}
      {activeTab === 'drift' && (
        <div>
          {!driftData?.ready ? (
            <div className="card" style={{ borderLeft: '3px solid #4b9dff' }}>
              <div className="card-title" style={{ color: '#4b9dff' }}>Monitor no disponible aún</div>
              <p style={{ color: 'var(--text-2)', fontSize: 14, lineHeight: 1.7, margin: '8px 0 0' }}>
                {driftData?.message ||
                  `Para activar el monitor de drift, registra al menos 5 nuevas visitas. Tienes ${driftData?.n_nuevos ?? 0} registros nuevos.`}
              </p>
              <div style={{ marginTop: 16, display: 'flex', gap: 24 }}>
                <div>
                  <div className="kpi-label">Registros nuevos</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: driftData?.n_nuevos >= 5 ? '#00c896' : '#ff5757' }}>
                    {driftData?.n_nuevos ?? 0}
                  </div>
                  <div className="kpi-sub">mínimo requerido: 5</div>
                </div>
                <div>
                  <div className="kpi-label">Registros históricos</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-1)' }}>
                    {driftData?.n_historicos ?? 0}
                  </div>
                  <div className="kpi-sub">referencia del modelo</div>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* KPI cards */}
              <div className="kpi-grid" style={{ marginBottom: 24 }}>
                <div className="kpi-card">
                  <span className="kpi-label">Registros nuevos</span>
                  <span className="kpi-value kpi-accent">{(driftData.n_nuevos || 0).toLocaleString()}</span>
                  <span className="kpi-sub">vs {(driftData.n_historicos || 0).toLocaleString()} históricos</span>
                </div>
                <div className="kpi-card">
                  <span className="kpi-label">Features analizadas</span>
                  <span className="kpi-value">{driftData.features_analizadas ?? '—'}</span>
                  <span className="kpi-sub">variables testeadas</span>
                </div>
                <div className="kpi-card">
                  <span className="kpi-label">Features con drift</span>
                  <span className="kpi-value" style={{ color: driftData.features_con_drift > 0 ? '#ff5757' : '#00c896' }}>
                    {driftData.features_con_drift ?? 0}
                  </span>
                  <span className="kpi-sub">de {driftData.features_analizadas ?? '—'} features</span>
                </div>
                <div className="kpi-card">
                  <span className="kpi-label">Drift %</span>
                  <span className="kpi-value" style={{ color: driftPctColor(driftData.drift_pct ?? 0) }}>
                    {typeof driftData.drift_pct === 'number' ? driftData.drift_pct.toFixed(1) : '—'}%
                  </span>
                  <span className="kpi-sub">features afectadas</span>
                </div>
                <div className="kpi-card">
                  <span className="kpi-label">Severidad</span>
                  <div style={{ marginTop: 8, marginBottom: 4 }}>
                    <SeverityBadge severity={driftData.severity} />
                  </div>
                  <span className="kpi-sub">nivel de alerta global</span>
                </div>
              </div>

              {/* Feature bars */}
              {details.length > 0 && (
                <div className="card" style={{ marginBottom: 24 }}>
                  <div className="card-title">
                    Detalle por feature
                    {driftData.features_con_drift > 0 && (
                      <span style={{ marginLeft: 10, fontSize: 12, color: '#ff5757', fontWeight: 500 }}>
                        {driftData.features_con_drift} con drift detectado
                      </span>
                    )}
                  </div>
                  <div style={{ marginTop: 12 }}>
                    {[...details]
                      .sort((a, b) => (b.drifted ? 1 : 0) - (a.drifted ? 1 : 0) || b.ks_stat - a.ks_stat)
                      .map(row => <FeatureBar key={row.feature} row={row} />)
                    }
                  </div>
                </div>
              )}
            </>
          )}

          {historial.length > 0 && <HistorialTable rows={historial} />}
        </div>
      )}

      {/* ── TAB: COMPARACIÓN ─────────────────────────────────────────────── */}
      {activeTab === 'modelo' && (
        loading ? (
          <div className="loading"><div className="spinner" /><span>Cargando…</span></div>
        ) : (
          <ComparacionView />
        )
      )}
    </div>
  )
}

/* ── Shared historial table ── */
function HistorialTable({ rows }) {
  return (
    <div className="card">
      <div className="card-title">Historial de análisis</div>
      <div className="data-table-wrapper" style={{ maxHeight: 360, overflowY: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Fuente</th>
              <th style={{ textAlign: 'right' }}>N nuevos</th>
              <th style={{ textAlign: 'right' }}>N históricos</th>
              <th style={{ textAlign: 'right' }}>% Drift</th>
              <th>Severidad</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.id ?? i}>
                <td style={{ color: 'var(--text-2)', fontSize: 12 }}>
                  {row.creado_en
                    ? new Date(row.creado_en).toLocaleDateString('es-MX', {
                        day: '2-digit', month: 'short', year: 'numeric',
                      })
                    : '—'}
                </td>
                <td style={{ color: 'var(--text-1)' }}>{row.nombre_fuente ?? 'DB'}</td>
                <td style={{ textAlign: 'right', color: 'var(--text-2)' }}>
                  {(row.n_nuevos || 0).toLocaleString()}
                </td>
                <td style={{ textAlign: 'right', color: 'var(--text-2)' }}>
                  {(row.n_historicos || 0).toLocaleString()}
                </td>
                <td style={{
                  textAlign: 'right',
                  color: driftPctColor(row.drift_pct ?? 0),
                  fontWeight: 600,
                }}>
                  {typeof row.drift_pct === 'number' ? row.drift_pct.toFixed(1) : '—'}%
                </td>
                <td>
                  {row.severidad ? <SeverityBadge severity={row.severidad} /> : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
