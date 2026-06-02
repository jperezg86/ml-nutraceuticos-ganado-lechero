# 🐄 Predicción de Emisiones de Metano — Ganado Lechero

**Equipo 48 · Tec de Monterrey · T2026 Spring**

Proyecto de ML bajo la metodología **CRISP-ML(Q)** para predecir la intensidad de metano entérico (g CH₄/kg leche) en ganado lechero, a partir de datos de producción, alimentación y condiciones ambientales.

---

## 📊 Resultados

| Etapa | Modelo | RMSE | R² | Score |
|-------|--------|------|-----|-------|
| E3 Baseline | Ridge | 0.7268 | 0.9688 | 94/100 |
| E4 Alternativos | **MLP ★** | **0.7168** | **0.9697** | En curso |
| E5 Ensambles | Stacking / VotingRegressor | TBD | TBD | En curso |

- **100 vacas únicas** · 3 razas (Holstein, Jersey, Pardo Suizo) · **73,000 visitas** · 24 meses (2024–2025)
- **28 features** de producción, alimentación, ambiente y manejo
- Split sin data leakage: `GroupShuffleSplit` por `id_vaca` (80/20)

---

## 🗂 Estructura del proyecto

```
ml-nutraceuticos-ganado-lechero/
│
├── notebooks/
│   ├── 01_eda_raw_data.ipynb             # A1 · Análisis exploratorio
│   ├── Ingenieria_caracteristicas.ipynb  # A2 · Feature engineering
│   ├── Baseline_Metano_Vacas_v3.ipynb    # A3 · Baseline (Ridge + LR)
│   ├── Modelos_Alternativos_E4.ipynb     # A4 · 6 modelos alternativos
│   └── Ensambles_E5.ipynb                # A5 · Ensambles + modelo final
│
├── data/
│   ├── raw/csv/
│   │   └── dataset_vacas_24m_v2.csv      # Dataset principal (73K filas)
│   └── processed/
│       ├── dataset_vacas_24m_feature_engineering.csv
│       ├── baseline_outputs/             # Artefactos E3
│       │   ├── pipeline_ridge_e3.pkl
│       │   ├── train_idx_e3.npy
│       │   ├── test_idx_e3.npy
│       │   └── e3_artifacts_meta.json
│       └── e4_outputs/                   # Artefactos E4
│           ├── pipeline_mlp_e4.pkl       # ← modelo activo en el dashboard
│           └── e4_artifacts_meta.json
│
├── app/                                  # Dashboard local (React + Node.js)
│   ├── backend/                          # API Express (puerto 3001)
│   │   ├── server.js
│   │   ├── database.js                   # SQLite (better-sqlite3)
│   │   └── scripts/                      # Scripts Python de inferencia
│   │       ├── predict.py
│   │       ├── model_info.py
│   │       ├── training_stats.py
│   │       ├── drift_check.py
│   │       └── import_data.py
│   ├── frontend/                         # React + Vite (puerto 3000)
│   │   └── src/components/
│   │       ├── Dashboard.jsx             # Resumen del hato
│   │       ├── Registros.jsx             # Alta de visitas + historial
│   │       ├── Explorer.jsx              # Explorador interactivo
│   │       ├── Monitor.jsx               # Monitor de drift
│   │       └── Predictor.jsx             # Predicción manual o CSV
│   └── db/                               # SQLite — NO va a git
│
├── src/                                  # Utilidades Python
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
# Instalar dependencias Node
cd app/backend  && npm install
cd ../frontend  && npm install
```

### Arranque normal (cada vez)

```bash
# Terminal 1 — API backend
cd app/backend && node server.js

# Terminal 2 — Frontend React
cd app/frontend && npm run dev
```

Abrir → **http://localhost:3000**

### Importar datos históricos (solo la primera vez)

```bash
curl -X POST http://localhost:3001/api/import
```

Importa los 73,000 registros al SQLite local en ~5 segundos.

---

## 📓 Ejecutar notebooks

Orden obligatorio:

```bash
pip install scikit-learn xgboost joblib pandas numpy scipy matplotlib seaborn jupyter

# 1. Baseline_Metano_Vacas_v3.ipynb   → genera pipeline_ridge_e3.pkl
# 2. Modelos_Alternativos_E4.ipynb    → usa artefactos de E3
# 3. Ensambles_E5.ipynb               → usa artefactos de E3 + E4
```

> ⚠️ El SVR en E4 está comentado — tarda >10 min en 58K filas.
> El MLP ya está pre-entrenado en `data/processed/e4_outputs/`.

---

## 🔌 API — Endpoints principales

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/health` | Estado del servidor y DB |
| GET | `/api/model-info` | Modelo activo, RMSE, R² |
| POST | `/api/predict/manual` | Predicción con JSON de features |
| POST | `/api/predict/csv` | Predicción sobre archivo CSV |
| POST | `/api/import` | Importar dataset histórico a SQLite |
| GET | `/api/hato/stats` | Resumen del hato (tendencia, alertas) |
| GET | `/api/hato/vacas` | Lista de vacas con métricas |
| GET | `/api/hato/vaca/:id` | Historial de una vaca |
| GET | `/api/hato/scatter?x=leche_kg_dia&y=intensidad_metano` | Scatter interactivo |
| GET | `/api/registros` | Últimos 200 registros |
| POST | `/api/registros` | Nuevo registro + predicción automática |
| DELETE | `/api/registros/:id` | Eliminar registro |
| GET | `/api/drift/db` | Drift: histórico vs registros nuevos |

---

## 🧠 Metodología CRISP-ML(Q)

| Avance | Etapa | Score |
|--------|-------|-------|
| A0 | Propuesta y convenios | ✅ |
| A1 | Análisis exploratorio (EDA) | 80/100 |
| A2 | Ingeniería de características | 97/100 |
| A3 | Baseline Modeling | 94/100 |
| A4 | Modelos Alternativos | En curso |
| A5 | Ensambles | En curso |

### Decisiones de diseño clave

- **Sin data leakage** — split por `id_vaca` con `GroupShuffleSplit`
- **Eval set congelado** — mismos índices en E3, E4 y E5 para comparación válida
- **Pipeline sklearn** — `StandardScaler → Modelo` exportado como `.pkl`
- **Drift KS** — prueba Kolmogorov-Smirnov 2024 vs 2025, p≈0 confirma shift temporal

---

## 🗄️ Base de datos SQLite

`app/db/metano.db` no va a git — se genera localmente. Contiene:

| Tabla | Contenido |
|-------|-----------|
| `registros` | Visitas de vacas (históricas + nuevas entradas manuales) |
| `predicciones` | Historial de predicciones ML |
| `drift_runs` | Resultados de análisis de drift |

Backup: copiar `app/db/metano.db`.
Reset: borrar el archivo y re-importar con `POST /api/import`.
