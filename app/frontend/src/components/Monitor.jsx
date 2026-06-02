import { useEffect, useState } from 'react'

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

export default function Monitor() {
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

  /* ── Not enough new records ── */
  if (!driftData?.ready) {
    return (
      <div>
        <div className="page-header">
          <h1>Monitor de Drift</h1>
          <p>
            Detecta distributional shift entre nuevos datos y el dataset de referencia ·
            Test KS por feature con &alpha;&nbsp;=&nbsp;0.05
          </p>
        </div>

        <div className="card" style={{ borderLeft: '3px solid #4b9dff', marginTop: 8 }}>
          <div className="card-title" style={{ color: '#4b9dff' }}>Monitor no disponible aún</div>
          <p style={{ color: 'var(--text-2)', fontSize: 14, lineHeight: 1.7, margin: '8px 0 0' }}>
            {driftData?.message ||
              `Para activar el monitor de drift, registra al menos 5 nuevas visitas en la sección Base de Datos. Actualmente tienes ${driftData?.n_nuevos ?? 0} registros nuevos vs ${driftData?.n_historicos ?? 0} históricos.`}
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

        {historial.length > 0 && <HistorialTable rows={historial} />}
      </div>
    )
  }

  /* ── Ready: full analysis view ── */
  const details = driftData.details || []

  return (
    <div>
      {/* ── Page header ── */}
      <div className="page-header">
        <h1>Monitor de Drift</h1>
        <p>
          Detecta distributional shift entre nuevos datos y el dataset de referencia ·
          Test KS por feature con &alpha;&nbsp;=&nbsp;0.05
        </p>
      </div>

      {/* ── Summary KPI cards ── */}
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
          <span
            className="kpi-value"
            style={{ color: driftData.features_con_drift > 0 ? '#ff5757' : '#00c896' }}
          >
            {driftData.features_con_drift ?? 0}
          </span>
          <span className="kpi-sub">de {driftData.features_analizadas ?? '—'} features</span>
        </div>

        <div className="kpi-card">
          <span className="kpi-label">Drift %</span>
          <span
            className="kpi-value"
            style={{ color: driftPctColor(driftData.drift_pct ?? 0) }}
          >
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

      {/* ── Visual drift bars ── */}
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
            {/* Drifted first, then OK */}
            {[...details]
              .sort((a, b) => (b.drifted ? 1 : 0) - (a.drifted ? 1 : 0) || b.ks_stat - a.ks_stat)
              .map(row => (
                <FeatureBar key={row.feature} row={row} />
              ))}
          </div>
        </div>
      )}

      {/* ── Historial ── */}
      {historial.length > 0 && <HistorialTable rows={historial} />}
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
