import { useState, useEffect, useCallback } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, BarChart, Bar, Cell
} from 'recharts'

const API = '/api'

const NIVEL_COLOR = { Bajo: '#00c896', Medio: '#ffc857', Alto: '#ff5757' }

const CAMPOS = [
  { key: 'leche_kg_dia',        label: 'Leche kg/día',       default: 25,   step: 0.1 },
  { key: 'fcr',                 label: 'FCR',                 default: 1.2,  step: 0.01 },
  { key: 'temp_humedad_idx',    label: 'Temp-Humedad (THI)',  default: 72,   step: 0.1 },
  { key: 'peso_kg',             label: 'Peso kg',             default: 550,  step: 1 },
  { key: 'edad_meses',          label: 'Edad (meses)',        default: 36,   step: 1 },
  { key: 'fibra_pct',           label: 'Fibra %',             default: 18,   step: 0.1 },
  { key: 'proteina_dieta_pct',  label: 'Proteína dieta %',   default: 16.5, step: 0.1 },
  { key: 'consumo_ms_kg',       label: 'Consumo MS kg',       default: 20,   step: 0.1 },
]

const FEAT_REG = [
  'edad_meses','ratio_proteina_energia','numero_lactancia','leche_por_lactancia',
  'omega3_por_leche','antioxidantes_ppm','tiene_taninos','tiene_algas','combo_anti_metano',
  'sistema_prod_ord','leche_kg_dia','proteina_dieta_pct','fibra_pct','consumo_ms_kg',
  'estres_termico','edad_est_ord','fcr_bin_ord','humedad_pct','peso_kg','fcr','thi_bin_ord',
  'temp_humedad_idx','thi_stress_load','ratio_fibra_proteina','mes_sin','indice_thi',
  'omega3_mg_l','mes_cos',
]

function buildFeatures(vals) {
  const base = {}
  FEAT_REG.forEach(f => { base[f] = 0 })
  CAMPOS.forEach(c => { base[c.key] = parseFloat(vals[c.key]) || 0 })
  return base
}

export default function Registros({ onGoToVaca }) {
  const [tab, setTab]         = useState('nuevo')
  const [registros, setReg]   = useState([])
  const [dbStats, setDbStats] = useState(null)
  const [predStats, setPredStats] = useState(null)
  const [trend, setTrend]     = useState([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSub]  = useState(false)
  const [msg, setMsg]         = useState(null)   // {type: 'ok'|'err', text, pred}

  const [form, setForm] = useState(() => {
    const f = { id_vaca: '', fecha: new Date().toISOString().split('T')[0], notas: '' }
    CAMPOS.forEach(c => { f[c.key] = c.default })
    return f
  })

  const fetchData = useCallback(() => {
    setLoading(true)
    Promise.all([
      fetch(`${API}/registros`).then(r => r.json()),
      fetch(`${API}/predicciones`).then(r => r.json()),
    ])
      .then(([regRes, predRes]) => {
        setReg(regRes.registros || [])
        setDbStats(regRes.stats)
        setPredStats(predRes.stats)
        setTrend((predRes.trend || []).slice().reverse())
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  function handleField(key, val) {
    setForm(f => ({ ...f, [key]: val }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSub(true)
    setMsg(null)
    try {
      const payload = {
        id_vaca:  form.id_vaca || null,
        fecha:    form.fecha,
        notas:    form.notas,
        fuente:   'manual',
        features: buildFeatures(form),
        ...CAMPOS.reduce((acc, c) => { acc[c.key] = parseFloat(form[c.key]) || 0; return acc }, {}),
      }
      const res  = await fetch(`${API}/registros`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setMsg({
        type:   'ok',
        text:   `Registro guardado (#${data.registro?.id})`,
        pred:   data.prediccion,
        vacaId: form.id_vaca || null,
      })
      fetchData()
    } catch (err) {
      setMsg({ type: 'err', text: err.message })
    } finally {
      setSub(false)
    }
  }

  async function handleDelete(id) {
    if (!confirm('¿Eliminar este registro?')) return
    await fetch(`${API}/registros/${id}`, { method: 'DELETE' })
    fetchData()
  }

  return (
    <div>
      <div className="page-header">
        <h1>Base de Datos
          <span className="badge badge-green" style={{marginLeft:10}}>
            SQLite local
          </span>
        </h1>
        <p>Registra visitas de vacas, obtén predicciones automáticas y sigue el historial.</p>
      </div>

      {/* Stats rápidos */}
      {dbStats && (
        <div className="kpi-grid" style={{gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', marginBottom:20}}>
          <div className="kpi-card">
            <span className="kpi-label">Registros totales</span>
            <span className="kpi-value kpi-accent">{dbStats.total ?? 0}</span>
            <span className="kpi-sub">en la base de datos</span>
          </div>
          <div className="kpi-card">
            <span className="kpi-label">Vacas únicas</span>
            <span className="kpi-value">{dbStats.vacas ?? 0}</span>
            <span className="kpi-sub">con ID registrado</span>
          </div>
          {predStats && (
            <>
              <div className="kpi-card">
                <span className="kpi-label">Predicciones totales</span>
                <span className="kpi-value kpi-info">{predStats.total ?? 0}</span>
                <span className="kpi-sub">guardadas en DB</span>
              </div>
              <div className="kpi-card">
                <span className="kpi-label">Predicción promedio</span>
                <span className="kpi-value">{predStats.media ?? '—'}</span>
                <span className="kpi-sub">g CH₄/kg leche</span>
              </div>
              <div className="kpi-card">
                <span className="kpi-label">Alertas (Alto)</span>
                <span className="kpi-value" style={{color: predStats.alto > 0 ? '#ff5757' : '#00c896'}}>
                  {predStats.alto ?? 0}
                </span>
                <span className="kpi-sub">emisión alta detectada</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Tabs */}
      <div style={{display:'flex', gap:4, marginBottom:20}}>
        {[
          ['nuevo',     '➕ Nuevo registro'],
          ['historial', '📋 Historial'],
          ['tendencia', '📈 Tendencia'],
        ].map(([id, label]) => (
          <button
            key={id}
            className={`predictor-tab${tab === id ? ' active' : ''}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── TAB: NUEVO REGISTRO ─────────────────────────────────────────────── */}
      {tab === 'nuevo' && (
        <div className="card">
          <div className="card-title">Ingresar nueva visita</div>
          <form onSubmit={handleSubmit}>

            {/* ID y fecha */}
            <div className="form-row" style={{gridTemplateColumns:'1fr 1fr 2fr', marginBottom:16}}>
              <div className="form-group">
                <label>ID Vaca</label>
                <input
                  placeholder="ej. V-042"
                  value={form.id_vaca}
                  onChange={e => handleField('id_vaca', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Fecha de visita</label>
                <input
                  type="date"
                  value={form.fecha}
                  onChange={e => handleField('fecha', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Notas (opcional)</label>
                <input
                  placeholder="Observaciones de la visita..."
                  value={form.notas}
                  onChange={e => handleField('notas', e.target.value)}
                />
              </div>
            </div>

            {/* Features principales */}
            <div style={{fontSize:11, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:10}}>
              Parámetros productivos
            </div>
            <div className="form-row">
              {CAMPOS.map(c => (
                <div className="form-group" key={c.key}>
                  <label>{c.label}</label>
                  <input
                    type="number"
                    step={c.step}
                    value={form[c.key]}
                    onChange={e => handleField(c.key, e.target.value)}
                  />
                </div>
              ))}
            </div>

            {/* Botón */}
            <div style={{display:'flex', alignItems:'center', gap:12, marginTop:6}}>
              <button className="btn btn-primary" type="submit" disabled={submitting}>
                {submitting ? '⏳ Guardando…' : '💾 Guardar y predecir'}
              </button>
              <span style={{fontSize:12, color:'var(--text-3)'}}>
                El sistema calculará la predicción automáticamente al guardar.
              </span>
            </div>

            {/* Resultado */}
            {msg && (
              <div style={{marginTop:20}}>
                {msg.type === 'err' ? (
                  <div className="error-box">❌ {msg.text}</div>
                ) : (
                  <div>
                    <div className="success-box">✅ {msg.text}</div>
                    {msg.pred && (
                      <div className="result-box" style={{marginTop:14}}>
                        <div className="result-main">
                          <div style={{fontSize:12, color:'var(--text-2)', marginBottom:4}}>Predicción generada</div>
                          <div
                            className="result-value"
                            style={{color: NIVEL_COLOR[msg.pred.nivel_emision] || '#eef0f7'}}
                          >
                            {msg.pred.prediction?.toFixed(3)}
                          </div>
                          <div className="result-unit">g CH₄/kg leche</div>
                        </div>
                        <div
                          className={`result-nivel nivel-${msg.pred.nivel_emision?.toLowerCase()}`}
                        >
                          Emisión {msg.pred.nivel_emision}
                        </div>
                        <div style={{fontSize:12, color:'var(--text-3)'}}>
                          Modelo: {msg.pred.model_used}
                        </div>
                      </div>
                    )}
                    {/* Acceso directo al perfil de la vaca */}
                    {msg.vacaId && onGoToVaca && (
                      <div style={{marginTop:14, display:'flex', alignItems:'center', gap:10}}>
                        <button
                          className="btn btn-ghost"
                          onClick={() => onGoToVaca(msg.vacaId)}
                          style={{fontSize:13}}
                        >
                          🐄 Ver perfil de {msg.vacaId}
                        </button>
                        <span style={{fontSize:12, color:'var(--text-3)'}}>
                          Ve al Explorador para ver el historial completo de esta vaca.
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </form>
        </div>
      )}

      {/* ── TAB: HISTORIAL ─────────────────────────────────────────────────── */}
      {tab === 'historial' && (
        <div className="card">
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16}}>
            <div className="card-title" style={{margin:0}}>Registros guardados ({registros.length})</div>
            <button className="btn btn-ghost" onClick={fetchData} style={{fontSize:12}}>
              🔄 Actualizar
            </button>
          </div>

          {loading ? (
            <div className="loading"><div className="spinner" /><span>Cargando…</span></div>
          ) : registros.length === 0 ? (
            <div style={{textAlign:'center', padding:'48px 0', color:'var(--text-3)'}}>
              <div style={{fontSize:32, marginBottom:10}}>📭</div>
              <p>Sin registros aún. Agrega el primero desde la pestaña "Nuevo registro".</p>
            </div>
          ) : (
            <div className="data-table-wrapper" style={{maxHeight:480, overflowY:'auto'}}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>ID Vaca</th>
                    <th>Fecha</th>
                    <th>Leche kg/d</th>
                    <th>FCR</th>
                    <th>Peso kg</th>
                    <th>THI</th>
                    <th>Fuente</th>
                    <th>Notas</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {registros.map(r => (
                    <tr key={r.id}>
                      <td style={{color:'var(--text-3)'}}>{r.id}</td>
                      <td style={{fontWeight:600, color:'var(--accent)'}}>{r.id_vaca || '—'}</td>
                      <td>{r.fecha}</td>
                      <td>{r.leche_kg_dia}</td>
                      <td>{r.fcr}</td>
                      <td>{r.peso_kg}</td>
                      <td>{r.temp_humedad_idx}</td>
                      <td>
                        <span className={`badge badge-${r.fuente === 'manual' ? 'blue' : 'green'}`}>
                          {r.fuente}
                        </span>
                      </td>
                      <td style={{color:'var(--text-3)', fontSize:12, maxWidth:140, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                        {r.notas || '—'}
                      </td>
                      <td>
                        <button
                          onClick={() => handleDelete(r.id)}
                          style={{background:'none', border:'none', cursor:'pointer', color:'var(--text-3)', fontSize:14, padding:'2px 6px'}}
                          title="Eliminar registro"
                        >
                          🗑
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: TENDENCIA ─────────────────────────────────────────────────── */}
      {tab === 'tendencia' && (
        <div style={{display:'flex', flexDirection:'column', gap:20}}>

          {/* Gráfica de tendencia */}
          <div className="chart-card">
            <h3>Predicción promedio por día</h3>
            {trend.length === 0 ? (
              <div style={{textAlign:'center', padding:'48px 0', color:'var(--text-3)'}}>
                <div style={{fontSize:28, marginBottom:8}}>📉</div>
                <p style={{fontSize:13}}>Sin predicciones guardadas aún.<br/>Registra vacas para ver la tendencia.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={trend} margin={{top:5, right:10, bottom:5, left:0}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="fecha" tick={{fill:'#8890a8', fontSize:10}} />
                  <YAxis tick={{fill:'#8890a8', fontSize:11}} domain={['auto','auto']} />
                  <Tooltip
                    contentStyle={{background:'#1a1d27', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, fontSize:12}}
                    formatter={(v) => [`${v} g CH₄/kg`, 'Media']}
                    labelStyle={{color:'#eef0f7'}}
                  />
                  <ReferenceLine y={16.5} stroke="#ffc857" strokeDasharray="4 4" label={{value:'Media histórica', fill:'#ffc857', fontSize:10}} />
                  <Line type="monotone" dataKey="media_dia" stroke="#00c896" strokeWidth={2} dot={{r:3, fill:'#00c896'}} activeDot={{r:5}} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Distribución de niveles en historial */}
          {predStats && predStats.total > 0 && (
            <div className="chart-card">
              <h3>Distribución de niveles de emisión (historial DB)</h3>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart
                  data={[
                    { nivel: 'Bajo',  count: predStats.bajo  || 0 },
                    { nivel: 'Medio', count: predStats.medio || 0 },
                    { nivel: 'Alto',  count: predStats.alto  || 0 },
                  ]}
                  margin={{top:5, right:10, bottom:5, left:0}}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="nivel" tick={{fill:'#8890a8', fontSize:12}} />
                  <YAxis tick={{fill:'#8890a8', fontSize:11}} />
                  <Tooltip
                    contentStyle={{background:'#1a1d27', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, fontSize:12}}
                    cursor={{fill:'rgba(255,255,255,0.04)'}}
                  />
                  <Bar dataKey="count" radius={[6,6,0,0]}>
                    {['Bajo','Medio','Alto'].map(n => (
                      <Cell key={n} fill={NIVEL_COLOR[n]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              {/* Info última predicción */}
              {predStats.ultima && (
                <div style={{marginTop:12, fontSize:12, color:'var(--text-3)', textAlign:'right'}}>
                  Última predicción: {predStats.ultima}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
