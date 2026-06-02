import { useState, useRef } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'

const API = '/api'

// Full feature list (FEAT_REG order)
const FEAT_REG = [
  'edad_meses','ratio_proteina_energia','numero_lactancia','leche_por_lactancia',
  'omega3_por_leche','antioxidantes_ppm','tiene_taninos','tiene_algas',
  'combo_anti_metano','sistema_prod_ord','leche_kg_dia','proteina_dieta_pct',
  'fibra_pct','consumo_ms_kg','estres_termico','edad_est_ord','fcr_bin_ord',
  'humedad_pct','peso_kg','fcr','thi_bin_ord','temp_humedad_idx','thi_stress_load',
  'ratio_fibra_proteina','mes_sin','indice_thi','omega3_mg_l','mes_cos',
]

// Key inputs shown in the manual form (8 fields)
const KEY_INPUTS = [
  { key: 'leche_kg_dia',        label: 'Leche (kg/día)',            step: 0.1 },
  { key: 'fcr',                  label: 'FCR',                      step: 0.01 },
  { key: 'temp_humedad_idx',     label: 'Índice temp-humedad (THI)', step: 0.1 },
  { key: 'peso_kg',              label: 'Peso vivo (kg)',            step: 1   },
  { key: 'edad_meses',           label: 'Edad (meses)',              step: 1   },
  { key: 'fibra_pct',            label: 'Fibra dieta (%)',           step: 0.1 },
  { key: 'proteina_dieta_pct',   label: 'Proteína dieta (%)',        step: 0.1 },
  { key: 'consumo_ms_kg',        label: 'Consumo MS (kg/día)',       step: 0.1 },
]

// Default values — key inputs get specified defaults, rest default to 0
const buildDefaults = () => {
  const base = {}
  FEAT_REG.forEach(f => { base[f] = 0 })
  return {
    ...base,
    leche_kg_dia:       25,
    fcr:                1.2,
    temp_humedad_idx:   72,
    peso_kg:            550,
    edad_meses:         36,
    fibra_pct:          18,
    proteina_dieta_pct: 16.5,
    consumo_ms_kg:      20,
  }
}

const COLORS_NIVEL = { Bajo: '#00c896', Medio: '#ffc857', Alto: '#ff5757' }

function nivelClass(nivel) {
  if (nivel === 'Alto')  return 'nivel-alto'
  if (nivel === 'Medio') return 'nivel-medio'
  return 'nivel-bajo'
}

function NivelBadge({ nivel }) {
  return <span className={`result-nivel ${nivelClass(nivel)}`}>{nivel}</span>
}

function badgeClass(nivel) {
  if (nivel === 'Alto')  return 'badge-red'
  if (nivel === 'Medio') return 'badge-yellow'
  return 'badge-green'
}

// ─── Manual Predictor ─────────────────────────────────────────────────────────
function ManualPredictor() {
  const [features, setFeatures] = useState(buildDefaults)
  const [result,   setResult]   = useState(null)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(null)

  const handleChange = (key, val) => {
    setFeatures(prev => ({ ...prev, [key]: parseFloat(val) || 0 }))
  }

  const predict = async () => {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const r = await fetch(`${API}/predict/manual`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ features }),
      })
      const data = await r.json()
      if (!r.ok || data.error) throw new Error(data.error || `HTTP ${r.status}`)
      setResult(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const predColor = result
    ? result.prediction > 25 ? 'var(--danger)'
      : result.prediction > 18 ? 'var(--warn)'
      : 'var(--accent)'
    : 'var(--text-1)'

  return (
    <div>
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">Variables clave</div>
        <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16 }}>
          Ingresa los 8 parámetros principales. El resto de las variables del modelo
          se inicializarán en 0.
        </p>
        <div className="form-row">
          {KEY_INPUTS.map(({ key, label, step }) => (
            <div className="form-group" key={key}>
              <label>{label}</label>
              <input
                type="number"
                step={step}
                value={features[key]}
                onChange={e => handleChange(key, e.target.value)}
              />
            </div>
          ))}
        </div>
      </div>

      <button
        className="btn btn-primary"
        onClick={predict}
        disabled={loading}
        style={{ marginBottom: 16 }}
      >
        {loading
          ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Prediciendo…</>
          : '▶ Predecir emisión'}
      </button>

      {error && <div className="error-box">{error}</div>}

      {result && (
        <div className="result-box">
          <div className="result-main">
            <div className="result-value" style={{ color: predColor }}>
              {typeof result.prediction === 'number'
                ? result.prediction.toFixed(2)
                : result.prediction}
            </div>
            <div className="result-unit">g CH₄/kg leche</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <span style={{ fontSize: 12, color: 'var(--text-2)', marginRight: 8 }}>Nivel:</span>
              <NivelBadge nivel={result.nivel_emision} />
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
              Modelo: <strong style={{ color: 'var(--text-1)' }}>{result.model_used}</strong>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
              Umbral: Bajo ≤18 · Medio 18–25 · Alto &gt;25 g CH₄/kg
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── CSV Predictor ────────────────────────────────────────────────────────────
function CsvPredictor() {
  const [dragging, setDragging] = useState(false)
  const [file,     setFile]    = useState(null)
  const [result,   setResult]  = useState(null)
  const [loading,  setLoading] = useState(false)
  const [error,    setError]   = useState(null)
  const inputRef = useRef()

  const handleFile = f => {
    if (!f) return
    if (!f.name.toLowerCase().endsWith('.csv')) {
      setError('Solo se aceptan archivos .csv')
      return
    }
    setFile(f)
    setError(null)
    setResult(null)
  }

  const handleDrop = e => {
    e.preventDefault()
    setDragging(false)
    handleFile(e.dataTransfer.files[0])
  }

  const predict = async () => {
    if (!file) return
    setLoading(true)
    setError(null)
    setResult(null)
    const fd = new FormData()
    fd.append('file', file)
    try {
      const r = await fetch(`${API}/predict/csv`, { method: 'POST', body: fd })
      const data = await r.json()
      if (!r.ok || data.error) throw new Error(data.error || `HTTP ${r.status}`)
      setResult(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const downloadResults = () => {
    if (!result?.results?.length) return
    const header = Object.keys(result.results[0]).join(',')
    const rows   = result.results.map(row => Object.values(row).join(',')).join('\n')
    const blob   = new Blob([`${header}\n${rows}`], { type: 'text/csv' })
    const url    = URL.createObjectURL(blob)
    const a      = document.createElement('a')
    a.href       = url
    a.download   = 'resultados_metano.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const chartData = result
    ? [
        { name: 'Bajo',  value: result.stats?.bajo  ?? 0 },
        { name: 'Medio', value: result.stats?.medio ?? 0 },
        { name: 'Alto',  value: result.stats?.alto  ?? 0 },
      ]
    : []

  const kpis = result
    ? [
        { label: 'Filas procesadas', value: result.total_rows,              unit: ''         },
        { label: 'Media',            value: result.stats?.mean?.toFixed(2), unit: 'g CH₄/kg' },
        { label: 'Máximo',           value: result.stats?.max?.toFixed(2),  unit: 'g CH₄/kg' },
        { label: 'Mínimo',           value: result.stats?.min?.toFixed(2),  unit: 'g CH₄/kg' },
        { label: 'Alto',             value: result.stats?.alto,             unit: 'vacas'     },
        { label: 'Medio',            value: result.stats?.medio,            unit: 'vacas'     },
        { label: 'Bajo',             value: result.stats?.bajo,             unit: 'vacas'     },
        { label: 'Modelo',           value: result.model_used,              unit: ''         },
      ]
    : []

  return (
    <div>
      {/* Drop zone */}
      <div
        className={`dropzone${dragging ? ' drag-over' : ''}`}
        onClick={() => inputRef.current.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        style={{ marginBottom: 16 }}
      >
        <div className="dropzone-icon">📁</div>
        <p>{file ? `✓ ${file.name}` : 'Arrastra tu CSV aquí o haz clic para seleccionar'}</p>
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
          Columnas esperadas: las 28 features del modelo (FEAT_REG)
        </span>
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          style={{ display: 'none' }}
          onChange={e => handleFile(e.target.files[0])}
        />
      </div>

      {file && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <button className="btn btn-primary" onClick={predict} disabled={loading}>
            {loading
              ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Procesando…</>
              : `▶ Predecir ${file.name}`}
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => { setFile(null); setResult(null); setError(null) }}
          >
            Cambiar archivo
          </button>
        </div>
      )}

      {error  && <div className="error-box">{error}</div>}

      {result && (
        <div style={{ marginTop: 20 }}>
          <div className="success-box" style={{ marginBottom: 16 }}>
            Predicción completada — {result.total_rows} filas procesadas con el modelo {result.model_used}.
          </div>

          {/* KPI grid */}
          <div className="kpi-grid" style={{ marginBottom: 20 }}>
            {kpis.map(({ label, value, unit }) => (
              <div className="kpi-card" key={label}>
                <span className="kpi-label">{label}</span>
                <span className="kpi-value">{value ?? '—'}</span>
                {unit && <span className="kpi-sub">{unit}</span>}
              </div>
            ))}
          </div>

          {/* Breakdown badges */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
            <span className="badge-green">
              Bajo: {result.stats?.bajo ?? 0} vacas
            </span>
            <span className="badge-yellow">
              Medio: {result.stats?.medio ?? 0} vacas
            </span>
            <span className="badge-red">
              Alto: {result.stats?.alto ?? 0} vacas
            </span>
          </div>

          {/* Bar chart */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-title">Distribución por nivel de emisión</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top: 8, right: 20, bottom: 0, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" tick={{ fill: '#8890a8', fontSize: 12 }} />
                <YAxis tick={{ fill: '#8890a8', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    background: 'var(--bg-card)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  cursor={{ fill: 'rgba(0,200,150,0.07)' }}
                />
                <Bar dataKey="value" name="Vacas" radius={[4, 4, 0, 0]}>
                  {chartData.map(entry => (
                    <Cell key={entry.name} fill={COLORS_NIVEL[entry.name]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Results table */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>
                Resultados por fila
                {result.results?.length > 20 && ` (primeras 20 de ${result.results.length})`}
              </span>
              <button className="btn btn-ghost" onClick={downloadResults} style={{ fontSize: 12 }}>
                ⬇ Descargar CSV completo
              </button>
            </div>
            <div className="data-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    {result.results?.[0]?.id_vaca !== undefined && <th>ID Vaca</th>}
                    {result.results?.[0]?.fecha   !== undefined && <th>Fecha</th>}
                    {result.results?.[0]?.raza    !== undefined && <th>Raza</th>}
                    <th>Predicción (g CH₄/kg leche)</th>
                    <th>Nivel</th>
                  </tr>
                </thead>
                <tbody>
                  {(result.results || []).slice(0, 20).map((row, i) => (
                    <tr key={row.id ?? i}>
                      <td>{row.id ?? i + 1}</td>
                      {row.id_vaca !== undefined && <td>{row.id_vaca}</td>}
                      {row.fecha   !== undefined && <td>{row.fecha}</td>}
                      {row.raza    !== undefined && <td>{row.raza}</td>}
                      <td style={{ fontWeight: 600 }}>
                        {typeof row.prediccion === 'number'
                          ? row.prediccion.toFixed(2)
                          : row.prediccion}
                      </td>
                      <td>
                        <span className={badgeClass(row.nivel)}>
                          {row.nivel}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {result.missing_cols?.length > 0 && (
            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
              <span style={{ color: 'var(--warn)' }}>
                Columnas faltantes (rellenas con 0):
              </span>{' '}
              {result.missing_cols.slice(0, 10).join(', ')}
              {result.missing_cols.length > 10 && ` y ${result.missing_cols.length - 10} más`}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function Predictor() {
  const [tab, setTab] = useState('manual')

  return (
    <div>
      <div className="page-header">
        <h1>Predictor de Metano</h1>
        <p>Estima la intensidad de metano entérico (g CH₄/kg leche) para una vaca o un lote completo.</p>
      </div>

      <div className="predictor-tabs">
        <button
          className={`predictor-tab${tab === 'manual' ? ' active' : ''}`}
          onClick={() => setTab('manual')}
        >
          ✎ Ingreso manual
        </button>
        <button
          className={`predictor-tab${tab === 'csv' ? ' active' : ''}`}
          onClick={() => setTab('csv')}
        >
          📂 Subir CSV
        </button>
      </div>

      {tab === 'manual' ? <ManualPredictor /> : <CsvPredictor />}
    </div>
  )
}
