"""
Dashboard de Monitoreo — Predicción de Metano en Ganado Lechero
Equipo 48 · Tec de Monterrey · T2026 Spring
Ejecutar: streamlit run app/app.py
"""

import streamlit as st
import pandas as pd
import numpy as np
import plotly.express as px
import plotly.graph_objects as go
from plotly.subplots import make_subplots
from pathlib import Path
import joblib, json, io, warnings
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
from scipy import stats

warnings.filterwarnings("ignore")

# ── Configuración de página ───────────────────────────────────────────────────
st.set_page_config(
    page_title="MetanoVacas — Dashboard",
    page_icon="🐄",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ── Constantes ────────────────────────────────────────────────────────────────
FEAT_REG = [
    "edad_meses", "ratio_proteina_energia", "numero_lactancia",
    "leche_por_lactancia", "omega3_por_leche", "antioxidantes_ppm",
    "tiene_taninos", "tiene_algas", "combo_anti_metano", "sistema_prod_ord",
    "leche_kg_dia", "proteina_dieta_pct", "fibra_pct", "consumo_ms_kg",
    "estres_termico", "edad_est_ord", "fcr_bin_ord", "humedad_pct", "peso_kg",
    "fcr", "thi_bin_ord", "temp_humedad_idx", "thi_stress_load",
    "ratio_fibra_proteina", "mes_sin", "indice_thi", "omega3_mg_l", "mes_cos",
]

RMSE_BL5  = 0.7268   # baseline E3
RMSE_MLP  = 0.6555   # mejor individual E4

PALETTE = {
    "primary"  : "#1A233A",
    "accent"   : "#008B8B",
    "green"    : "#27AE60",
    "orange"   : "#E67E22",
    "red"      : "#C0392B",
    "blue"     : "#2980B9",
    "purple"   : "#8E44AD",
    "lgray"    : "#F4F6F9",
}

# ── Rutas ─────────────────────────────────────────────────────────────────────
@st.cache_resource
def find_repo_root():
    p = Path(__file__).resolve().parent
    while p != p.parent:
        if (p / "data").exists():
            return p
        p = p.parent
    return Path(".")

REPO = find_repo_root()
ARTS_E3 = REPO / "data/processed/baseline_outputs"
ARTS_E5 = REPO / "data/processed/e5_outputs"
PROC    = REPO / "data/processed/dataset_vacas_24m_feature_engineering.csv"
RAW     = REPO / "data/raw/csv/dataset_vacas_24m_v2.csv"

# ── Carga de recursos ─────────────────────────────────────────────────────────
@st.cache_resource
def load_pipeline():
    # Preferir pipeline E5, fallback a E3
    for path in [ARTS_E5 / "pipeline_final_e5.pkl", ARTS_E3 / "pipeline_ridge_e3.pkl"]:
        if path.exists():
            return joblib.load(path), path.stem
    return None, None

@st.cache_data
def load_data():
    if not PROC.exists():
        return None, None
    df = pd.read_csv(PROC)
    if "id_vaca" not in df.columns and RAW.exists():
        df["id_vaca"] = pd.read_csv(RAW, usecols=["id_vaca"])["id_vaca"].values
    train_idx = np.load(ARTS_E3 / "train_idx_e3.npy") if (ARTS_E3 / "train_idx_e3.npy").exists() else None
    test_idx  = np.load(ARTS_E3 / "test_idx_e3.npy")  if (ARTS_E3 / "test_idx_e3.npy").exists() else None
    return df, (train_idx, test_idx)

@st.cache_data
def load_meta():
    for path in [ARTS_E5 / "e5_artifacts_meta.json", ARTS_E3 / "e3_artifacts_meta.json"]:
        if path.exists():
            with open(path) as f:
                return json.load(f)
    return {}

# ── CSS personalizado ─────────────────────────────────────────────────────────
st.markdown("""
<style>
    .metric-card {
        background: #F4F6F9; border-radius: 12px; padding: 18px 22px;
        border-left: 5px solid #008B8B; margin-bottom: 10px;
    }
    .metric-val { font-size: 2rem; font-weight: 700; color: #1A233A; }
    .metric-lbl { font-size: 0.85rem; color: #666; margin-top: 4px; }
    .status-ok  { color: #27AE60; font-weight: 700; }
    .status-warn{ color: #E67E22; font-weight: 700; }
    .status-bad { color: #C0392B; font-weight: 700; }
    .section-hdr{ background:#1A233A; color:white; padding:10px 18px;
                  border-radius:8px; margin:20px 0 12px 0; font-weight:600; }
</style>
""", unsafe_allow_html=True)

# ── Sidebar ───────────────────────────────────────────────────────────────────
with st.sidebar:
    st.markdown("## 🐄 MetanoVacas")
    st.markdown("**Dashboard de Monitoreo**")
    st.markdown("Equipo 48 · Tec de Monterrey")
    st.divider()

    pagina = st.radio("Navegación", [
        "🏠  Inicio",
        "🔮  Predictor",
        "📊  Explorador",
        "🔍  Monitor de Drift",
        "📈  Modelo & Residuos",
    ])

    st.divider()
    pipe, pipe_name = load_pipeline()
    meta = load_meta()

    if pipe:
        st.success(f"✅ Pipeline cargado\n`{pipe_name}`")
    else:
        st.error("❌ Pipeline no encontrado\nEjecuta E3 o E5 primero")

    if meta:
        rmse_ref = meta.get("rmse_e5_final", meta.get("rmse_e3_ridge", "—"))
        st.metric("RMSE modelo", f"{rmse_ref:.4f}" if isinstance(rmse_ref, float) else rmse_ref)
        st.metric("R²",          f"{meta.get('r2_e5_final', meta.get('r2_e3_ridge','—')):.4f}"
                                  if isinstance(meta.get('r2_e5_final', meta.get('r2_e3_ridge')), float) else "—")

# ── Carga global de datos ─────────────────────────────────────────────────────
df_full, splits = load_data()

if df_full is not None and splits[0] is not None:
    train_idx, test_idx = splits
    df_train = df_full.iloc[train_idx].copy()
    df_test  = df_full.iloc[test_idx].copy()
    X_te = df_test[FEAT_REG].values
    y_te = df_test["intensidad_metano"].values
    y_pred_base = pipe.predict(X_te) if pipe else None
else:
    df_train = df_test = X_te = y_te = y_pred_base = None

# ════════════════════════════════════════════════════════════════════════════════
# PÁGINA 1 — INICIO
# ════════════════════════════════════════════════════════════════════════════════
if pagina == "🏠  Inicio":
    st.markdown("# 🐄 Dashboard — Predicción de Emisiones de Metano")
    st.markdown("**Ganado Lechero · CRISP-ML(Q) · Tec de Monterrey T2026**")
    st.divider()

    # KPIs
    c1, c2, c3, c4, c5 = st.columns(5)
    kpis = [
        ("73,000", "Registros totales", "green"),
        ("119", "Vacas únicas", "blue"),
        ("32", "Variables", "purple"),
        (f"{RMSE_MLP:.4f}", "RMSE final (MLP)", "accent"),
        ("94%", "Score A3 Baseline", "orange"),
    ]
    for col, (val, lbl, clr) in zip([c1,c2,c3,c4,c5], kpis):
        with col:
            st.markdown(f"""
            <div class="metric-card" style="border-color:{PALETTE[clr]}">
                <div class="metric-val" style="color:{PALETTE[clr]}">{val}</div>
                <div class="metric-lbl">{lbl}</div>
            </div>""", unsafe_allow_html=True)

    st.divider()

    # Progreso del proyecto
    col_prog, col_info = st.columns([3, 2])
    with col_prog:
        st.markdown('<div class="section-hdr">📚 Progreso del proyecto</div>', unsafe_allow_html=True)
        avances = {
            "A0 · Propuesta y convenios": (100, "#AAAAAA"),
            "A1 · Análisis exploratorio": (80,  PALETTE["blue"]),
            "A2 · Ingeniería de características": (97, PALETTE["accent"]),
            "A3 · Baseline Modeling": (94, PALETTE["green"]),
            "A4 · Modelos Alternativos": (90, PALETTE["orange"]),
            "A5 · Ensambles": (0,  PALETTE["purple"]),
        }
        for nombre, (pct, color) in avances.items():
            lbl = f"{pct}%" if pct > 0 else "En progreso"
            st.markdown(f"**{nombre}** — {lbl}")
            st.progress(pct / 100)

    with col_info:
        st.markdown('<div class="section-hdr">🏆 Comparativa de modelos</div>', unsafe_allow_html=True)
        modelos_df = pd.DataFrame([
            {"Modelo": "Ridge (E3-BL5)",   "RMSE": 0.7268, "R²": 0.9688, "Etapa": "E3"},
            {"Modelo": "ElasticNet",        "RMSE": 0.8395, "R²": 0.9584, "Etapa": "E4"},
            {"Modelo": "BayesianRidge",     "RMSE": 0.7268, "R²": 0.9688, "Etapa": "E4"},
            {"Modelo": "SVR-RBF",           "RMSE": 1.0909, "R²": 0.9297, "Etapa": "E4"},
            {"Modelo": "MLP ★",            "RMSE": 0.6555, "R²": 0.9746, "Etapa": "E4"},
            {"Modelo": "XGBoost",           "RMSE": 1.1858, "R²": 0.9170, "Etapa": "E4"},
        ]).sort_values("RMSE")
        st.dataframe(modelos_df, use_container_width=True, hide_index=True,
                     column_config={"RMSE": st.column_config.NumberColumn(format="%.4f"),
                                    "R²":   st.column_config.NumberColumn(format="%.4f")})

    # Distribución del target
    if df_full is not None:
        st.divider()
        st.markdown('<div class="section-hdr">📊 Distribución de intensidad_metano</div>',
                    unsafe_allow_html=True)
        fig = px.histogram(df_full, x="intensidad_metano", nbins=80, marginal="box",
                           color_discrete_sequence=[PALETTE["accent"]],
                           labels={"intensidad_metano": "g CH₄/kg leche"},
                           title="Distribución del target (73,000 registros)")
        fig.update_layout(height=350, margin=dict(t=40, b=20))
        st.plotly_chart(fig, use_container_width=True)

# ════════════════════════════════════════════════════════════════════════════════
# PÁGINA 2 — PREDICTOR
# ════════════════════════════════════════════════════════════════════════════════
elif pagina == "🔮  Predictor":
    st.markdown("# 🔮 Predictor de Emisiones")
    st.markdown("Sube un CSV con nuevas visitas y obtén las predicciones al instante.")
    st.divider()

    if not pipe:
        st.error("Pipeline no cargado. Ejecuta E3 primero (Restart & Run All en el notebook).")
        st.stop()

    # Plantilla descargable
    col_tmpl, col_up = st.columns([1, 2])
    with col_tmpl:
        st.markdown("### 1️⃣  Descarga la plantilla")
        template_df = pd.DataFrame({f: [0.0] * 3 for f in FEAT_REG})
        csv_tmpl = template_df.to_csv(index=False)
        st.download_button("📥 Descargar plantilla CSV", csv_tmpl, "plantilla_prediccion.csv",
                           "text/csv", use_container_width=True)
        st.caption("Rellena con los valores reales de las vacas y sube el archivo.")

    with col_up:
        st.markdown("### 2️⃣  Sube tu CSV con datos nuevos")
        uploaded = st.file_uploader("Arrastra o selecciona el archivo", type=["csv"],
                                    label_visibility="collapsed")

    if uploaded:
        try:
            df_new = pd.read_csv(uploaded)
            missing = [f for f in FEAT_REG if f not in df_new.columns]
            if missing:
                st.error(f"Columnas faltantes: {missing}")
                st.stop()

            X_new     = df_new[FEAT_REG].values
            y_pred_new = pipe.predict(X_new)
            df_new["intensidad_metano_pred"] = y_pred_new.round(4)
            df_new["alerta_alta"] = y_pred_new > df_full["intensidad_metano"].quantile(0.9) \
                                    if df_full is not None else False

            st.success(f"✅ {len(df_new):,} predicciones generadas")
            st.divider()

            col_m1, col_m2, col_m3 = st.columns(3)
            col_m1.metric("Predicción promedio", f"{y_pred_new.mean():.3f} g CH₄/kg leche")
            col_m2.metric("Máximo", f"{y_pred_new.max():.3f}")
            col_m3.metric("Vacas en alerta (Q90)", int(df_new["alerta_alta"].sum()))

            # Tabla de resultados
            st.markdown("### Resultados")
            st.dataframe(df_new[["intensidad_metano_pred", "alerta_alta"] + FEAT_REG[:6]],
                         use_container_width=True, height=280)

            # Gráfico distribución predicciones
            fig = px.histogram(y_pred_new, nbins=50,
                               color_discrete_sequence=[PALETTE["green"]],
                               labels={"value": "g CH₄/kg leche predichos"},
                               title="Distribución de predicciones nuevas")
            fig.add_vline(x=RMSE_BL5, line_dash="dash", line_color=PALETTE["orange"],
                          annotation_text=f"Media baseline={df_full['intensidad_metano'].mean():.2f}" \
                          if df_full is not None else "")
            fig.update_layout(height=300, margin=dict(t=40, b=20), showlegend=False)
            st.plotly_chart(fig, use_container_width=True)

            # Descarga
            csv_out = df_new.to_csv(index=False)
            st.download_button("📥 Descargar resultados CSV", csv_out,
                               "predicciones.csv", "text/csv", use_container_width=True)
        except Exception as e:
            st.error(f"Error procesando el archivo: {e}")

    else:
        # Modo demo: predicción interactiva manual
        st.divider()
        st.markdown("### O usa el modo interactivo (vaca individual)")
        with st.expander("🐄 Predicción manual — ajusta los valores", expanded=False):
            c1, c2, c3 = st.columns(3)
            vals = {}
            feat_defaults = {
                "leche_kg_dia": 25.0, "fcr": 1.2, "temp_humedad_idx": 72.0,
                "peso_kg": 550.0, "edad_meses": 36.0, "fibra_pct": 18.0,
                "proteina_dieta_pct": 16.5, "consumo_ms_kg": 20.0,
            }
            key_feats = list(feat_defaults.keys())
            other_feats = [f for f in FEAT_REG if f not in key_feats]

            for i, feat in enumerate(key_feats):
                col = [c1, c2, c3][i % 3]
                vals[feat] = col.number_input(feat, value=feat_defaults[feat],
                                              format="%.3f", key=f"inp_{feat}")
            for feat in other_feats:
                vals[feat] = 0.0

            if st.button("🔮 Predecir esta vaca", use_container_width=True):
                X_single = np.array([[vals[f] for f in FEAT_REG]])
                pred = pipe.predict(X_single)[0]
                color = "green" if pred < RMSE_BL5 * 1.2 else "orange"
                st.markdown(f"""
                <div class="metric-card" style="border-color:{PALETTE[color]}">
                    <div class="metric-val" style="color:{PALETTE[color]}">{pred:.3f}</div>
                    <div class="metric-lbl">g CH₄ / kg leche predichos</div>
                </div>""", unsafe_allow_html=True)
                if pred > df_full["intensidad_metano"].quantile(0.9) if df_full is not None else 20:
                    st.warning("⚠️ Esta vaca supera el percentil 90 — revisar dieta y condición corporal")

# ════════════════════════════════════════════════════════════════════════════════
# PÁGINA 3 — EXPLORADOR
# ════════════════════════════════════════════════════════════════════════════════
elif pagina == "📊  Explorador":
    st.markdown("# 📊 Explorador de Datos")
    st.divider()

    if df_full is None:
        st.error("Dataset no encontrado.")
        st.stop()

    tab1, tab2, tab3 = st.tabs(["Distribuciones", "Correlaciones", "Por raza"])

    with tab1:
        feat_sel = st.selectbox("Selecciona feature", FEAT_REG + ["intensidad_metano"])
        col_h, col_s = st.columns(2)
        with col_h:
            fig = px.histogram(df_full, x=feat_sel, nbins=60, marginal="violin",
                               color_discrete_sequence=[PALETTE["blue"]],
                               title=f"Distribución de {feat_sel}")
            fig.update_layout(height=380, margin=dict(t=40, b=10))
            st.plotly_chart(fig, use_container_width=True)
        with col_s:
            if "id_vaca" in df_full.columns:
                fig2 = px.scatter(df_full.sample(3000, random_state=42),
                                  x=feat_sel, y="intensidad_metano",
                                  opacity=0.4, color_discrete_sequence=[PALETTE["accent"]],
                                  labels={"intensidad_metano": "g CH₄/kg leche"},
                                  title=f"{feat_sel} vs metano (muestra 3k)")
                fig2.update_traces(marker_size=3)
                fig2.update_layout(height=380, margin=dict(t=40, b=10))
                st.plotly_chart(fig2, use_container_width=True)

        # Estadísticas
        st.markdown("**Estadísticas descriptivas**")
        st.dataframe(df_full[FEAT_REG + ["intensidad_metano"]].describe().round(3),
                     use_container_width=True)

    with tab2:
        top_n = st.slider("Top N features para correlación", 8, 28, 12)
        corr_cols = FEAT_REG[:top_n] + ["intensidad_metano"]
        corr = df_full[corr_cols].corr()
        fig = px.imshow(corr, color_continuous_scale="RdBu_r", zmin=-1, zmax=1,
                        title=f"Matriz de correlación (top {top_n} features + target)",
                        aspect="auto")
        fig.update_layout(height=550, margin=dict(t=50, b=10))
        st.plotly_chart(fig, use_container_width=True)

        # Top correlaciones con target
        st.markdown("**Top correlaciones con intensidad_metano**")
        corr_target = corr["intensidad_metano"].drop("intensidad_metano").abs().sort_values(ascending=False)
        fig2 = px.bar(x=corr_target.values, y=corr_target.index, orientation="h",
                      color=corr_target.values, color_continuous_scale="Teal",
                      labels={"x": "|Correlación|", "y": "Feature"},
                      title="Correlación absoluta con el target")
        fig2.update_layout(height=400, margin=dict(t=40, b=10), yaxis={"autorange": "reversed"})
        st.plotly_chart(fig2, use_container_width=True)

    with tab3:
        if "raza" in df_full.columns:
            feat_raza = st.selectbox("Feature por raza", ["intensidad_metano"] + FEAT_REG[:8], key="raza_feat")
            fig = px.box(df_full, x="raza", y=feat_raza, color="raza",
                         color_discrete_sequence=[PALETTE["blue"], PALETTE["green"], PALETTE["orange"]],
                         title=f"{feat_raza} por raza")
            fig.update_layout(height=420, margin=dict(t=40, b=10))
            st.plotly_chart(fig, use_container_width=True)
        else:
            st.info("Columna 'raza' no disponible en el dataset procesado.")

# ════════════════════════════════════════════════════════════════════════════════
# PÁGINA 4 — MONITOR DE DRIFT
# ════════════════════════════════════════════════════════════════════════════════
elif pagina == "🔍  Monitor de Drift":
    st.markdown("# 🔍 Monitor de Drift")
    st.markdown("Detecta si nuevos datos se alejan de la distribución de entrenamiento.")
    st.divider()

    if df_full is None or df_train is None:
        st.error("Dataset no encontrado.")
        st.stop()

    st.markdown("### Sube datos nuevos para analizar drift")
    uploaded_drift = st.file_uploader("CSV con nuevos datos (mismas columnas)", type=["csv"],
                                       key="drift_upload")

    # Si no hay upload, comparar train vs test como demo
    if not uploaded_drift:
        st.info("📌 Sin archivo: mostrando análisis de drift Train (2024) vs Test (2025) del proyecto")
        df_new_drift = df_test.copy()
        drift_label = "Test E3 (2025)"
    else:
        df_new_drift = pd.read_csv(uploaded_drift)
        drift_label = "Datos nuevos"

    # KS test para cada feature
    st.markdown(f"### Prueba KS: Entrenamiento vs {drift_label}")
    ks_results = []
    common_feats = [f for f in FEAT_REG if f in df_new_drift.columns and f in df_train.columns]
    for feat in common_feats:
        ks_stat, p_val = stats.ks_2samp(df_train[feat].dropna(), df_new_drift[feat].dropna())
        ks_results.append({"Feature": feat, "KS stat": round(ks_stat, 4),
                           "p-value": round(p_val, 6), "Drift": p_val < 0.05})

    df_ks = pd.DataFrame(ks_results).sort_values("KS stat", ascending=False)
    n_drift = df_ks["Drift"].sum()

    col_d1, col_d2, col_d3 = st.columns(3)
    col_d1.metric("Features con drift (p<0.05)", f"{n_drift}/{len(df_ks)}")
    col_d2.metric("KS máximo", f"{df_ks['KS stat'].max():.4f}")
    target_ks, target_p = stats.ks_2samp(
        df_train["intensidad_metano"].dropna(),
        df_new_drift["intensidad_metano"].dropna()
    ) if "intensidad_metano" in df_new_drift.columns else (0, 1)
    status_emoji = "⚠️" if target_p < 0.05 else "✅"
    col_d3.metric(f"{status_emoji} Drift en target (KS p)", f"{target_p:.2e}")

    st.divider()
    col_bar, col_tbl = st.columns([3, 2])

    with col_bar:
        colors_drift = [PALETTE["red"] if d else PALETTE["green"] for d in df_ks["Drift"]]
        fig = go.Figure(go.Bar(
            x=df_ks["KS stat"], y=df_ks["Feature"],
            orientation="h", marker_color=colors_drift,
        ))
        fig.add_vline(x=0.1, line_dash="dash", line_color="orange",
                      annotation_text="umbral referencia 0.10")
        fig.update_layout(
            title=f"KS statistic por feature — {drift_label} vs Train",
            height=600, yaxis={"autorange": "reversed"},
            margin=dict(t=40, b=10),
            xaxis_title="KS statistic (mayor = más drift)",
        )
        st.plotly_chart(fig, use_container_width=True)

    with col_tbl:
        st.markdown("**Tabla KS completa**")
        st.dataframe(
            df_ks.style.apply(
                lambda r: ["background-color: #FFE8E8" if r["Drift"] else "" for _ in r],
                axis=1,
            ),
            use_container_width=True, height=580,
        )

    # Distribución comparada para feature seleccionada
    st.divider()
    feat_drift = st.selectbox("Ver distribución comparada:", common_feats)
    fig2 = go.Figure()
    fig2.add_trace(go.Histogram(x=df_train[feat_drift], name="Train (2024)",
                                nbinsx=50, opacity=0.6,
                                marker_color=PALETTE["blue"], histnorm="probability density"))
    fig2.add_trace(go.Histogram(x=df_new_drift[feat_drift], name=drift_label,
                                nbinsx=50, opacity=0.6,
                                marker_color=PALETTE["orange"], histnorm="probability density"))
    ks_row = df_ks[df_ks["Feature"] == feat_drift].iloc[0]
    fig2.update_layout(
        barmode="overlay",
        title=f"{feat_drift} — KS={ks_row['KS stat']:.4f}  p={ks_row['p-value']:.4e}  "
              f"{'⚠️ Drift detectado' if ks_row['Drift'] else '✅ Sin drift'}",
        height=380, margin=dict(t=50, b=10),
        xaxis_title=feat_drift, yaxis_title="Densidad",
    )
    st.plotly_chart(fig2, use_container_width=True)

# ════════════════════════════════════════════════════════════════════════════════
# PÁGINA 5 — MODELO & RESIDUOS
# ════════════════════════════════════════════════════════════════════════════════
elif pagina == "📈  Modelo & Residuos":
    st.markdown("# 📈 Modelo & Análisis de Residuos")
    st.divider()

    if pipe is None or y_pred_base is None:
        st.error("Pipeline o datos de prueba no disponibles.")
        st.stop()

    residuals = y_te - y_pred_base
    rmse = np.sqrt(mean_squared_error(y_te, y_pred_base))
    mae  = mean_absolute_error(y_te, y_pred_base)
    r2   = r2_score(y_te, y_pred_base)

    # Métricas
    c1, c2, c3, c4 = st.columns(4)
    c1.metric("RMSE",  f"{rmse:.4f}", f"{(RMSE_BL5-rmse)/RMSE_BL5*100:+.1f}% vs BL5")
    c2.metric("MAE",   f"{mae:.4f}")
    c3.metric("R²",    f"{r2:.4f}")
    c4.metric("Residuo medio", f"{residuals.mean():.4f}", "≈0 es ideal")

    st.divider()
    tab_r1, tab_r2, tab_r3 = st.tabs(["Residuos", "Predichos vs Reales", "Importancia de features"])

    with tab_r1:
        col_r1, col_r2 = st.columns(2)
        with col_r1:
            fig = px.scatter(x=y_pred_base, y=residuals,
                             opacity=0.3, color_discrete_sequence=[PALETTE["blue"]],
                             labels={"x": "Predicción", "y": "Residuo"},
                             title="Residuos vs Predichos")
            fig.add_hline(y=0, line_color="red", line_dash="dash")
            fig.add_hline(y= 2*residuals.std(), line_color="orange", line_dash="dot")
            fig.add_hline(y=-2*residuals.std(), line_color="orange", line_dash="dot")
            fig.update_traces(marker_size=2)
            fig.update_layout(height=380, margin=dict(t=40, b=10))
            st.plotly_chart(fig, use_container_width=True)
        with col_r2:
            fig2 = px.histogram(residuals, nbins=80, marginal="violin",
                                color_discrete_sequence=[PALETTE["purple"]],
                                labels={"value": "Residuo (g CH₄/kg leche)"},
                                title=f"Distribución de residuos  σ={residuals.std():.4f}")
            fig2.add_vline(x=0, line_color="red", line_dash="dash")
            fig2.update_layout(height=380, margin=dict(t=40, b=10), showlegend=False)
            st.plotly_chart(fig2, use_container_width=True)

        # QQ plot
        qq_theor, qq_sample = stats.probplot(residuals, dist="norm")[0]
        fig3 = go.Figure()
        fig3.add_trace(go.Scatter(x=qq_theor, y=qq_sample, mode="markers",
                                  marker=dict(size=3, opacity=0.5, color=PALETTE["blue"])))
        lim = max(abs(qq_theor).max(), abs(qq_sample).max())
        fig3.add_trace(go.Scatter(x=[-lim, lim], y=[-lim, lim],
                                  mode="lines", line=dict(color="red", dash="dash")))
        fig3.update_layout(title="Q-Q Plot de residuos (normalidad)",
                           xaxis_title="Cuantiles teóricos", yaxis_title="Cuantiles residuos",
                           height=380, showlegend=False, margin=dict(t=40, b=10))
        st.plotly_chart(fig3, use_container_width=True)

    with tab_r2:
        sample_n = min(5000, len(y_te))
        idx_s = np.random.choice(len(y_te), sample_n, replace=False)
        fig = go.Figure()
        fig.add_trace(go.Scatter(x=y_te[idx_s], y=y_pred_base[idx_s], mode="markers",
                                 marker=dict(size=3, opacity=0.4, color=PALETTE["green"]),
                                 name="Predicciones"))
        mn, mx = min(y_te.min(), y_pred_base.min()), max(y_te.max(), y_pred_base.max())
        fig.add_trace(go.Scatter(x=[mn, mx], y=[mn, mx], mode="lines",
                                 line=dict(color="red", dash="dash"), name="Línea perfecta"))
        fig.update_layout(title=f"Predichos vs Reales (muestra {sample_n:,})  R²={r2:.4f}",
                          xaxis_title="Valor real (g CH₄/kg leche)",
                          yaxis_title="Predicción (g CH₄/kg leche)",
                          height=480, margin=dict(t=40, b=10))
        st.plotly_chart(fig, use_container_width=True)

    with tab_r3:
        # Si el pipeline tiene un RF o árbol, mostrar feature importance
        # Si no, mostrar correlación con target como proxy
        has_rf = hasattr(pipe, "named_steps") and hasattr(
            list(pipe.named_steps.values())[-1], "feature_importances_"
        )
        if has_rf:
            model_step = list(pipe.named_steps.values())[-1]
            fi = pd.Series(model_step.feature_importances_, index=FEAT_REG).sort_values()
            title = "Importancia de features (modelo final)"
        else:
            fi = df_full[FEAT_REG].corrwith(df_full["intensidad_metano"]).abs().sort_values() \
                 if df_full is not None else pd.Series(dtype=float)
            title = "Correlación |r| con intensidad_metano (proxy de importancia)"

        if len(fi) > 0:
            fig = go.Figure(go.Bar(
                x=fi.values, y=fi.index, orientation="h",
                marker_color=PALETTE["accent"],
            ))
            fig.update_layout(title=title, height=600,
                              xaxis_title="Importancia / |Correlación|",
                              yaxis={"autorange": "reversed"},
                              margin=dict(t=40, b=10))
            st.plotly_chart(fig, use_container_width=True)

        # Error por raza
        if df_test is not None and "raza" in df_test.columns:
            st.divider()
            st.markdown("**RMSE por raza**")
            raza_rmse = {}
            for raza in df_test["raza"].unique():
                mask = df_test["raza"] == raza
                if mask.sum() > 10:
                    raza_rmse[raza] = np.sqrt(mean_squared_error(y_te[mask], y_pred_base[mask]))
            if raza_rmse:
                fig2 = px.bar(x=list(raza_rmse.keys()), y=list(raza_rmse.values()),
                              color=list(raza_rmse.values()),
                              color_continuous_scale="RdYlGn_r",
                              labels={"x": "Raza", "y": "RMSE"},
                              title="RMSE por raza — equidad del modelo")
                fig2.add_hline(y=rmse, line_dash="dash", line_color="gray",
                               annotation_text=f"RMSE global={rmse:.4f}")
                fig2.update_layout(height=350, margin=dict(t=40, b=10), showlegend=False)
                st.plotly_chart(fig2, use_container_width=True)
