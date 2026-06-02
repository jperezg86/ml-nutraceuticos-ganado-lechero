# 🐄 MetanoML — Predicción de Emisiones de Metano en Ganado Lechero

**Equipo 48 · Tec de Monterrey · T2026 Spring**

Sistema completo de Machine Learning para predecir la intensidad de metano entérico
(g CH₄/kg leche) en ganado lechero, desarrollado bajo la metodología **CRISP-ML(Q)**.
Incluye un dashboard local con React + Node.js conectado a una base de datos SQLite.

---

## 📊 Resultados del modelo

| Etapa | Modelo | RMSE | R² |
|-------|--------|------|----|
| E3 Baseline | Ridge | 0.7268 | 0.9688 |
| **E4 ★ Activo** | **MLP (256/128/64)** | **0.711** | **0.967** |
| E5 Ensambles | Stacking / VotingRegressor | En curso | En curso |

- **100 vacas únicas** · 3 razas (Holstein, Jersey, Pardo Suizo)
- **73,000 visitas** · 24 meses (ene 2024 – dic 2025)
- **28 features** de producción, alimentación, ambiente, manejo y nutraceuticos
- Split sin data leakage: `GroupShuffleSplit` por `id_vaca` (80/20)
- Pipeline: `StandardScaler → MLPRegressor` entrenado con datos raw del SQLite

---

## 🖥️ Dashboard — 4 pantallas

| Pantalla | Descripción |
|----------|-------------|
| **Resumen del Hato** | KPIs generales, alertas activas, tendencia de metano 24 meses, distribución por raza |
| **Registrar Visita** | Formulario de 16 campos con 3 secciones · predicción automática · historial · deep-link a perfil de vaca |
| **Explorar Hato** | Buscar vaca por ID · perfil con gráfica temporal · cruce de variables (scatter / histograma / por raza) |
| **Estado del Modelo** | Drift detection (KS test) · scatter real vs predicho · histograma de residuos · RMSE/R² en vivo |

---

## 🗂 Estructura del proyecto

```
ml-nutraceuticos-ganado-lechero/
│
├── notebooks/
│   ├── 01_eda_raw_data.ipynb               # A1 · Análisis exploratorio
│   ├── Ingenieria_caracteristicas.ipynb    # A2 · Feature engineering (28 features)
│   ├── Baseline_Metano_Vacas_v3.ipynb      # A3 · Baseline Ridge (RMSE 0.7268)
│   ├── Modelos_Alternativos_E4.ipynb       # A4 · MLP ★ + otros (SVR comentado)
│   └── Ensambles_E5.ipynb                  # A5 · Stacking / VotingRegressor
│
├── data/
│   ├── raw/csv/
│   │   └── dataset_vacas_24m_v2.csv        # Dataset principal (73K filas)
│   └── processed/
│       ├── dataset_vacas_24m_feature_engineering.csv  # Features ya calculadas
│       ├── baseline_outputs/
│       │   └── pipeline_ridge_e3.pkl       # Baseline Ridge
│       └── e4_outputs/
│           ├── pipeline_mlp_app.pkl        # ← MODELO ACTIVO (raw inputs ✓)
│           ├── pipeline_mlp_e4.pkl         # Legacy (entrenado con z-scored)
│           └── e4_artifacts_meta.json
│
├── app/                                    # Dashboard local
│   ├── backend/                            # API Express (puerto 3001)
│   │   ├── server.js                       # Endpoints REST
│   │   ├── database.js                     # SQLite · better-sqlite3 · WAL mode
│   │   └── scripts/
│   │       ├── predict.py                  # Motor de predicción (manual + CSV)
│   │       ├── model_info.py               # Info del pipeline activo
│   │       ├── drift_check.py              # KS test sobre DB
│   │       ├── compare_model.py            # Scatter real vs predicho
│   │       ├── import_data.py              # Importar CSV → SQLite
│   │       └── retrain_pipeline_raw.py     # Re-entrena con datos raw del SQLite
│   ├── frontend/                           # React + Vite (puerto 3000)
│   │   └── src/components/
│   │       ├── Dashboard.jsx               # Resumen del hato
│   │       ├── Registros.jsx               # Registrar visita + historial
│   │       ├── Explorer.jsx                # Explorador del hato
│   │       └── Monitor.jsx                 # Estado del modelo
│   └── db/                                 # SQLite — NO va a git
│
├── README.md
├── Makefile
└── pyproject.toml
```

---

## 🚀 Arrancar el dashboard

### Requisitos

- Python 3.10+ con `scikit-learn joblib pandas numpy scipy`
- Node.js 18+

### Primera vez

```bash
cd app/backend  && npm install
cd ../frontend  && npm install
```

### Arranque (cada sesión)

```bash
# Terminal 1 — API backend
cd app/backend && node server.js

# Terminal 2 — Frontend
cd app/frontend && npm run dev
```

Abrir → **[http://localhost:3000](http://localhost:3000)**

### Importar datos históricos (solo la primera vez)

```bash
curl -X POST http://localhost:3001/api/import
```

Importa los 73,000 registros al SQLite local en ~5 segundos.

---

## 🧠 Feature engineering (28 features)

El formulario pide **16 valores raw**; el sistema calcula el resto automáticamente:

| Feature derivada | Cómo se calcula |
|-----------------|----------------|
| `estres_termico` | THI ≥ 72 → 1, si no → 0 |
| `thi_bin_ord` | Igual que `estres_termico` |
| `thi_stress_load` | THI × `estres_termico` |
| `edad_est_ord` | ≤24m=0, ≤48m=1, ≤72m=2, >72m=3 |
| `fcr_bin_ord` | Cuartiles: <0.85=0, <1.05=1, <1.30=2, ≥1.30=3 |
| `ratio_fibra_proteina` | fibra% / proteína% |
| `ratio_proteina_energia` | proteína% / energía MCal/kg |
| `leche_por_lactancia` | leche kg/día × N° lactancia |
| `omega3_por_leche` | omega3 mg/L ÷ leche kg/día |
| `combo_anti_metano` | tiene_taninos + tiene_algas |
| `mes_sin` / `mes_cos` | sin/cos del mes de la fecha (ciclicidad) |
| `indice_thi` | Alias de `temp_humedad_idx` |

---

## 📓 Ejecutar notebooks

Orden obligatorio:

```bash
pip install scikit-learn xgboost joblib pandas numpy scipy matplotlib seaborn jupyter

# 1. Baseline_Metano_Vacas_v3.ipynb   → genera pipeline_ridge_e3.pkl
# 2. Modelos_Alternativos_E4.ipynb    → genera pipeline_mlp_e4.pkl (SVR comentado)
# 3. Ensambles_E5.ipynb               → usa artefactos de E3 + E4
```

> ⚠️ El SVR en E4 está **comentado** — tarda >10 min en 58K filas.
> El MLP ya está pre-entrenado en `data/processed/e4_outputs/`.

### Re-entrenar el pipeline desde cero

```bash
# Entrena con los datos raw del SQLite (handles raw form inputs correctly)
python3 app/backend/scripts/retrain_pipeline_raw.py
```

---

## 🔌 API — Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/health` | Estado del servidor y DB |
| GET | `/api/model-info` | Modelo activo, RMSE, R² |
| POST | `/api/predict/manual` | Predicción con JSON de 28 features |
| POST | `/api/predict/csv` | Predicción sobre archivo CSV |
| POST | `/api/import` | Importar dataset histórico a SQLite |
| GET | `/api/hato/stats` | KPIs del hato (tendencia, alertas, razas) |
| GET | `/api/hato/vacas` | Lista de vacas con métricas |
| GET | `/api/hato/vaca/:id` | Historial completo de una vaca |
| GET | `/api/hato/scatter` | Datos para scatter interactivo |
| GET | `/api/registros` | Últimos 200 registros manuales |
| POST | `/api/registros` | Nuevo registro + predicción automática |
| DELETE | `/api/registros/:id` | Eliminar registro |
| GET | `/api/predicciones` | Stats + tendencia de predicciones |
| GET | `/api/drift/db` | Drift detection (KS test histórico vs nuevos) |
| GET | `/api/comparacion` | Scatter real vs predicho del dataset procesado |

---

## 🗄️ Base de datos SQLite

`app/db/metano.db` **no va a git** — se genera localmente.

| Tabla | Contenido |
|-------|-----------|
| `registros` | Visitas de vacas (73K históricas + entradas manuales) |
| `predicciones` | Historial de predicciones ML con nivel de emisión |
| `drift_runs` | Resultados de análisis de drift con severidad |

```bash
# Backup
cp app/db/metano.db app/db/metano.db.bak

# Reset completo
rm app/db/metano.db && curl -X POST http://localhost:3001/api/import
```

---

## 🚦 Niveles de emisión

| Nivel | CH₄ (g/kg leche) | Acción |
|-------|-----------------|--------|
| 🟢 **Bajo** | < 18 | Emisión óptima — mantener manejo |
| 🟡 **Medio** | 18 – 25 | Revisar dieta y THI |
| 🔴 **Alto** | > 25 | Intervención: ajustar fibra/proteína o añadir suplemento |

---

## 🧪 Metodología CRISP-ML(Q)

| Avance | Etapa | Estado |
|--------|-------|--------|
| A0 | Propuesta y convenios | ✅ |
| A1 | Análisis exploratorio (EDA) | ✅ 80/100 |
| A2 | Ingeniería de características | ✅ 97/100 |
| A3 | Baseline Modeling (Ridge) | ✅ 94/100 |
| A4 | Modelos Alternativos (MLP ★) | ✅ En revisión |
| A5 | Ensambles | 🔄 En curso |

### Decisiones de diseño

- **Sin data leakage** — split por `id_vaca` con `GroupShuffleSplit`
- **Eval set congelado** — mismos índices en E3/E4/E5 para comparación válida
- **Pipeline raw-aware** — `pipeline_mlp_app.pkl` entrenado con datos sin escalar del SQLite
- **Drift KS** — Kolmogorov-Smirnov 2024 vs 2025 confirma shift temporal
- **App local-first** — sin dependencia de nube, sin Streamlit, SQLite embebido
