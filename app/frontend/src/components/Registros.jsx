import { useState, useEffect, useCallback } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, BarChart, Bar, Cell
} from 'recharts'

const API = '/api'

const NIVEL_COLOR = { Bajo: '#00c896', Medio: '#ffc857', Alto: '#ff5757' }

// ── Sección 1: Parámetros productivos y ambientales ──────────────────────────
const CAMPOS_PROD = [
  { key: 'leche_kg_dia',        label: 'Leche kg/día',          default: 25,   step: 0.1 },
  { key: 'consumo_ms_kg',       label: 'Consumo MS kg',          default: 20,   step: 0.1 },
  { key: 'fcr',                 label: 'FCR',                    default: 1.2,  step: 0.01 },
  { key: 'peso_kg',             label: 'Peso kg',                default: 550,  step: 1 },
  { key: 'edad_meses',          label: 'Edad (meses)',           default: 36,   step: 1 },
  { key: 'numero_lactancia',    label: 'N° lactancia',           default: 2,    step: 1 },
  { key: 'temp_humedad_idx',    label: 'THI (índice termohum)',  default: 72,   step: 0.1 },
  { key: 'humedad_pct',         label: 'Humedad %',              default: 65,   step: 1 },
]

// ── Sección 2: Composición de la dieta ───────────────────────────────────────
const CAMPOS_DIETA = [
  { key: 'fibra_pct',           label: 'Fibra %',                default: 18,   step: 0.1 },
  { key: 'proteina_dieta_pct',  label: 'Proteína dieta %',      default: 16.5, step: 0.1 },
  { key: 'energia_mcal_kg',     label: 'Energía MCal/kg MS',     default: 3.8,  step: 0.01 },
]

// ── Sección 3: Nutraceuticos ──────────────────────────────────────────────────
const CAMPOS_NUTRI = [
  { key: 'omega3_mg_l',         label: 'Omega-3 mg/L',           default: 0,    step: 1 },
  { key: 'antioxidantes_ppm',   label: 'Antioxidantes ppm',      default: 0,    step: 1 },
]

// Todos los campos numéricos (para inicializar el form state y armar el payload)
const CAMPOS = [...CAMPOS_PROD, ...CAMPOS_DIETA, ...CAMPOS_NUTRI]

/**
 * Ingeniería de variables — replica el pipeline del notebook E2/E3
 * a partir de los valores raw del formulario.
 * Genera los 28 features que espera el modelo MLP.
 */
function buildFeatures(vals, fecha) {
  // ── Raw inputs del formulario ─────────────────────────────────────────────
  const leche    = parseFloat(vals.leche_kg_dia)        || 25
  const consumo  = parseFloat(vals.consumo_ms_kg)       || 20
  const fcr      = parseFloat(vals.fcr)                 || 1.2
  const thi      = parseFloat(vals.temp_humedad_idx)    || 72
  const humedad  = parseFloat(vals.humedad_pct)         || 65
  const peso     = parseFloat(vals.peso_kg)             || 550
  const edad     = parseFloat(vals.edad_meses)          || 36
  const nLact    = Math.max(1, parseFloat(vals.numero_lactancia)    || 2)
  const fibra    = parseFloat(vals.fibra_pct)           || 18
  const proteina = parseFloat(vals.proteina_dieta_pct)  || 16.5
  // Nuevos campos (antes hardcodeados)
  const energia  = parseFloat(vals.energia_mcal_kg)     || 3.8
  const omega3   = parseFloat(vals.omega3_mg_l)         || 0
  const antiox   = parseFloat(vals.antioxidantes_ppm)   || 0
  const taninos  = Number(vals.tiene_taninos)           || 0  // 0 o 1
  const algas    = Number(vals.tiene_algas)             || 0  // 0 o 1
  const sistProd = Number(vals.sistema_produccion)              // 0=Ext, 1=Semi, 2=Int

  // ── Features derivadas (igual que notebook E2 feature engineering) ────────
  const estres         = thi >= 72 ? 1 : 0
  const thi_bin        = thi >= 72 ? 1 : 0
  const thi_stress     = thi * estres
  // Ordinal de edad: 0=cría(≤24m), 1=novilla(≤48m), 2=adulta(≤72m), 3=madura(>72m)
  const edad_ord       = edad <= 24 ? 0 : edad <= 48 ? 1 : edad <= 72 ? 2 : 3
  // Ordinal de FCR por cuartiles aproximados del dataset
  const fcr_bin        = fcr < 0.85 ? 0 : fcr < 1.05 ? 1 : fcr < 1.30 ? 2 : 3
  const ratio_fib_prot = proteina > 0 ? fibra / proteina : 1.1
  const ratio_prot_ene = energia  > 0 ? proteina / energia : 4.34
  const leche_lact     = leche * nLact   // proxy de producción total por lactancia
  const omega3_leche   = leche  > 0 ? omega3 / leche : 0
  const combo_anti     = taninos + algas  // 0, 1 ó 2

  // Ciclicidad temporal: extraer mes de la fecha del registro
  const d   = fecha ? new Date(fecha) : new Date()
  const mes = d.getMonth() + 1  // 1–12
  const mes_sin = parseFloat(Math.sin(2 * Math.PI * mes / 12).toFixed(6))
  const mes_cos = parseFloat(Math.cos(2 * Math.PI * mes / 12).toFixed(6))

  return {
    // ── Básicas ──
    edad_meses:             edad,
    leche_kg_dia:           leche,
    peso_kg:                peso,
    consumo_ms_kg:          consumo,
    fibra_pct:              fibra,
    proteina_dieta_pct:     proteina,
    humedad_pct:            humedad,
    fcr:                    fcr,
    // ── Derivadas de THI ──
    temp_humedad_idx:       thi,
    indice_thi:             thi,
    estres_termico:         estres,
    thi_bin_ord:            thi_bin,
    thi_stress_load:        thi_stress,
    // ── Derivadas de lactancia / producción ──
    numero_lactancia:       nLact,
    leche_por_lactancia:    leche_lact,
    // ── Ratios y ordinales ──
    ratio_proteina_energia: ratio_prot_ene,
    ratio_fibra_proteina:   ratio_fib_prot,
    edad_est_ord:           edad_ord,
    fcr_bin_ord:            fcr_bin,
    sistema_prod_ord:       sistProd,
    // ── Ciclicidad temporal ──
    mes_sin,
    mes_cos,
    // ── Nutraceuticos ──
    omega3_mg_l:            omega3,
    omega3_por_leche:       omega3_leche,
    antioxidantes_ppm:      antiox,
    tiene_taninos:          taninos,
    tiene_algas:            algas,
    combo_anti_metano:      combo_anti,
  }
}

// ── Componentes helper del formulario ────────────────────────────────────────

function SectionLabel({ children, style }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em',
      color: 'var(--text-3)', marginBottom: 10, ...style,
    }}>
      {children}
    </div>
  )
}

function ToggleChip({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
        border: `1px solid ${active ? '#00c896' : 'rgba(255,255,255,0.12)'}`,
        background: active ? 'rgba(0,200,150,0.15)' : 'var(--surface-2)',
        color: active ? '#00c896' : 'var(--text-2)',
        transition: 'all 0.15s',
      }}
    >
      {active ? '✓ ' : ''}{label}
    </button>
  )
}

function AutoCalcInfo({ form }) {
  const proteina = parseFloat(form.proteina_dieta_pct) || 16.5
  const energia  = parseFloat(form.energia_mcal_kg)    || 3.8
  const fibra    = parseFloat(form.fibra_pct)          || 18
  const leche    = parseFloat(form.leche_kg_dia)       || 25
  const omega3   = parseFloat(form.omega3_mg_l)        || 0
  const thi      = parseFloat(form.temp_humedad_idx)   || 72

  const ratioFibProt  = proteina > 0 ? (fibra / proteina).toFixed(3) : '—'
  const ratioProtEne  = energia  > 0 ? (proteina / energia).toFixed(3) : '—'
  const omega3Leche   = leche > 0 ? (omega3 / leche).toFixed(4) : '0.0000'
  const comboAnti     = (Number(form.tiene_taninos) + Number(form.tiene_algas))
  const estres        = thi >= 72 ? 'Sí' : 'No'

  return (
    <div style={{
      marginTop: 16, padding: '12px 16px', borderRadius: 8,
      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
    }}>
      <div style={{fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-3)', marginBottom: 8}}>
        ⚙️ Variables auto-calculadas para el modelo
      </div>
      <div style={{display: 'flex', flexWrap: 'wrap', gap: '6px 20px'}}>
        {[
          ['ratio_fibra_proteina',   ratioFibProt],
          ['ratio_proteina_energia', ratioProtEne],
          ['omega3_por_leche',       omega3Leche],
          ['combo_anti_metano',      comboAnti],
          ['estres_termico',         estres],
        ].map(([k, v]) => (
          <span key={k} style={{fontSize: 11, color: 'var(--text-3)'}}>
            <span style={{color: 'var(--text-2)', fontWeight: 600}}>{k}</span>
            {' = '}
            <span style={{color: '#ffc857'}}>{v}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

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
    const f = {
      id_vaca: '',
      fecha: new Date().toISOString().split('T')[0],
      notas: '',
      intensidad_metano_real: '',  // opcional — dato medido real
      // Campos especiales (no numéricos simples)
      sistema_produccion: 1,   // 0=Extensivo, 1=Semi-intensivo, 2=Intensivo
      tiene_taninos: 0,
      tiene_algas: 0,
    }
    CAMPOS.forEach(c => { f[c.key] = c.default })
    return f
  })

  // Estado para edición inline de metano real en el historial
  const [editingId, setEditingId]   = useState(null)
  const [editValor, setEditValor]   = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  async function handleSaveMetanoReal(id) {
    setSavingEdit(true)
    try {
      const res  = await fetch(`${API}/registros/${id}/metano-real`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intensidad_metano: parseFloat(editValor) }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setEditingId(null)
      fetchData()
    } catch(err) {
      alert('Error: ' + err.message)
    } finally {
      setSavingEdit(false)
    }
  }

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
      const features = buildFeatures(form, form.fecha)
      const payload = {
        id_vaca:  form.id_vaca || null,
        fecha:    form.fecha,
        notas:    form.notas,
        fuente:   'manual',
        features,
        // Dato real de laboratorio (opcional)
        intensidad_metano: form.intensidad_metano_real !== '' && form.intensidad_metano_real !== null
          ? parseFloat(form.intensidad_metano_real)
          : null,
        // Campos raw para guardar en la tabla registros
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
        <h1>Registrar Visita</h1>
        <p>Ingresa los datos de la visita, el sistema predice el nivel de metano y guarda todo automáticamente.</p>
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
          ['nuevo',     '✏️ Nueva visita'],
          ['historial', '📋 Mis registros'],
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
          <div className="card-title">Datos de la visita</div>
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

            {/* ── Sección 1: Producción y Animal ─────────────────────────── */}
            <SectionLabel>🐄 Producción y animal</SectionLabel>
            <div className="form-row">
              {CAMPOS_PROD.map(c => (
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
              {/* Sistema de producción (select) */}
              <div className="form-group">
                <label>Sistema de producción</label>
                <select
                  value={form.sistema_produccion}
                  onChange={e => handleField('sistema_produccion', parseInt(e.target.value))}
                  style={{
                    background:'var(--surface-2)', color:'var(--text-1)',
                    border:'1px solid rgba(255,255,255,0.1)', borderRadius:8,
                    padding:'8px 10px', fontSize:13, width:'100%',
                  }}
                >
                  <option value={0}>Extensivo</option>
                  <option value={1}>Semi-intensivo</option>
                  <option value={2}>Intensivo</option>
                </select>
              </div>
            </div>

            {/* ── Sección 2: Dieta ────────────────────────────────────────── */}
            <SectionLabel style={{marginTop:20}}>🌾 Composición de la dieta</SectionLabel>
            <div className="form-row">
              {CAMPOS_DIETA.map(c => (
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

            {/* ── Sección 3: Nutraceuticos ─────────────────────────────────── */}
            <SectionLabel style={{marginTop:20}}>💊 Nutraceuticos</SectionLabel>
            <div className="form-row" style={{alignItems:'flex-end'}}>
              {CAMPOS_NUTRI.map(c => (
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
              {/* Toggles: Taninos y Algas */}
              <div className="form-group">
                <label style={{marginBottom:10}}>Suplementos activos</label>
                <div style={{display:'flex', gap:10}}>
                  <ToggleChip
                    label="Taninos"
                    active={!!form.tiene_taninos}
                    onClick={() => handleField('tiene_taninos', form.tiene_taninos ? 0 : 1)}
                  />
                  <ToggleChip
                    label="Algas"
                    active={!!form.tiene_algas}
                    onClick={() => handleField('tiene_algas', form.tiene_algas ? 0 : 1)}
                  />
                </div>
              </div>
            </div>

            {/* Variables auto-calculadas (info) */}
            <AutoCalcInfo form={form} />

            {/* ── Dato real de laboratorio (opcional) ──────────────────────── */}
            <div style={{
              marginTop:16, padding:'14px 16px', borderRadius:8,
              background:'rgba(200,169,81,0.06)', border:'1px solid rgba(200,169,81,0.18)',
            }}>
              <div style={{fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'#c8a951', marginBottom:10}}>
                🧪 Dato real de laboratorio <span style={{fontWeight:400, textTransform:'none', letterSpacing:0, fontSize:11}}>(opcional)</span>
              </div>
              <div style={{display:'flex', alignItems:'flex-end', gap:20, flexWrap:'wrap'}}>
                <div className="form-group" style={{margin:0, minWidth:200, maxWidth:260}}>
                  <label style={{marginBottom:6}}>
                    Metano medido
                    <span style={{fontWeight:400, color:'var(--text-3)', marginLeft:6, fontSize:11}}>g CH₄/kg leche</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="ej. 21.3"
                    value={form.intensidad_metano_real}
                    onChange={e => handleField('intensidad_metano_real', e.target.value)}
                  />
                </div>
                <span style={{fontSize:12, color:'var(--text-3)', paddingBottom:8, maxWidth:360, lineHeight:1.5}}>
                  Si ya tienes el resultado del laboratorio, ingrésalo aquí para compararlo con la predicción del modelo.
                  También puedes agregarlo después desde el historial.
                </span>
              </div>
            </div>

            {/* Botón */}
            <div style={{display:'flex', alignItems:'center', gap:12, marginTop:20}}>
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
            <div className="data-table-wrapper" style={{maxHeight:520, overflowY:'auto'}}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>ID Vaca</th>
                    <th>Fecha</th>
                    <th>Leche kg/d</th>
                    <th>FCR</th>
                    <th>THI</th>
                    <th>Fuente</th>
                    <th title="Predicción del modelo MLP">Predicción ML</th>
                    <th title="Dato medido en laboratorio">Metano Real</th>
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
                      <td>{r.temp_humedad_idx}</td>
                      <td>
                        <span className={`badge badge-${r.fuente === 'manual' ? 'blue' : 'green'}`}>
                          {r.fuente}
                        </span>
                      </td>

                      {/* Predicción ML */}
                      <td>
                        {r.prediccion_ml != null ? (
                          <span style={{
                            fontWeight:600,
                            color: r.prediccion_ml > 25 ? '#ff5757' : r.prediccion_ml > 18 ? '#ffc857' : '#00c896',
                          }}>
                            {parseFloat(r.prediccion_ml).toFixed(2)}
                          </span>
                        ) : <span style={{color:'var(--text-3)'}}>—</span>}
                      </td>

                      {/* Metano Real — edición inline */}
                      <td>
                        {editingId === r.id ? (
                          <div style={{display:'flex', alignItems:'center', gap:4}}>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="g CH₄/kg"
                              value={editValor}
                              onChange={e => setEditValor(e.target.value)}
                              autoFocus
                              style={{
                                width:80, padding:'3px 6px', fontSize:12, borderRadius:5,
                                background:'var(--surface-2)', border:'1px solid rgba(200,169,81,0.4)',
                                color:'var(--text-1)',
                              }}
                              onKeyDown={e => {
                                if (e.key === 'Enter') handleSaveMetanoReal(r.id)
                                if (e.key === 'Escape') setEditingId(null)
                              }}
                            />
                            <button
                              onClick={() => handleSaveMetanoReal(r.id)}
                              disabled={savingEdit}
                              style={{background:'none', border:'none', cursor:'pointer', fontSize:14, color:'#00c896', padding:'2px 3px'}}
                              title="Guardar"
                            >✓</button>
                            <button
                              onClick={() => setEditingId(null)}
                              style={{background:'none', border:'none', cursor:'pointer', fontSize:14, color:'var(--text-3)', padding:'2px 3px'}}
                              title="Cancelar"
                            >✕</button>
                          </div>
                        ) : (
                          <div style={{display:'flex', alignItems:'center', gap:5}}>
                            {r.intensidad_metano != null ? (
                              <span style={{
                                fontWeight:600,
                                color: r.intensidad_metano > 25 ? '#ff5757' : r.intensidad_metano > 18 ? '#ffc857' : '#00c896',
                              }}>
                                {parseFloat(r.intensidad_metano).toFixed(2)}
                              </span>
                            ) : (
                              <span style={{color:'var(--text-3)', fontSize:12}}>—</span>
                            )}
                            <button
                              onClick={() => {
                                setEditingId(r.id)
                                setEditValor(r.intensidad_metano != null ? String(r.intensidad_metano) : '')
                              }}
                              style={{background:'none', border:'none', cursor:'pointer', color:'var(--text-3)', fontSize:12, padding:'2px 4px', opacity:0.7}}
                              title="Editar metano real"
                            >✏️</button>
                          </div>
                        )}
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
                    contentStyle={{background:'#1a1d27', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, fontSize:12, color:'#eef0f7'}}
                    itemStyle={{color:'#c8cdd8'}}
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
                    contentStyle={{background:'#1a1d27', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, fontSize:12, color:'#eef0f7'}}
                    itemStyle={{color:'#c8cdd8'}}
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
