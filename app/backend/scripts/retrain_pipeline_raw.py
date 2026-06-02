#!/usr/bin/env python3
"""
Reentrenar el pipeline MLP usando datos RAW del SQLite.
El pipeline guardado por el notebook E4 fue entrenado con datos ya z-scored,
por lo que no puede recibir valores crudos directamente.

Este script:
1. Carga los 73K registros raw del SQLite
2. Computa los 28 features de ingeniería desde valores crudos
3. Entrena Pipeline(StandardScaler → MLP) con datos sin escalar
4. Guarda pipeline_mlp_app.pkl — usado por predict.py para inputs manuales
"""
import sys, json, warnings, sqlite3
import numpy as np, pandas as pd
from pathlib import Path
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.neural_network import MLPRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error, r2_score
import joblib

warnings.filterwarnings('ignore')

REPO = Path(__file__).resolve().parents[3]
DB   = REPO / 'app' / 'db' / 'metano.db'
OUT  = REPO / 'data' / 'processed' / 'e4_outputs' / 'pipeline_mlp_app.pkl'

print(f"Cargando datos desde {DB}...")
conn = sqlite3.connect(DB)
df = pd.read_sql_query("""
    SELECT
        leche_kg_dia, consumo_ms_kg, edad_meses, numero_lactancia,
        peso_kg, fibra_pct, proteina_dieta_pct, energia_mcal_kg,
        humedad_pct, indice_thi, estres_termico, mes,
        sistema_produccion, intensidad_metano
    FROM registros
    WHERE intensidad_metano IS NOT NULL
      AND intensidad_metano > 0
      AND fuente = 'importacion'
""", conn)
conn.close()

print(f"Registros cargados: {len(df)}")

# ── Feature engineering (mismo que buildFeatures en JS) ─────────────────────

# FCR = Feed Conversion Ratio = consumo MS / leche
df['fcr'] = (df['consumo_ms_kg'] / df['leche_kg_dia'].replace(0, np.nan)).fillna(1.2)

# THI (ya en la DB como indice_thi)
df['temp_humedad_idx'] = df['indice_thi']

# Estres térmico (ya en DB, pero recalculamos por consistencia)
df['estres_termico_calc'] = (df['indice_thi'] >= 72).astype(int)

# THI bins
df['thi_bin_ord']     = (df['indice_thi'] >= 72).astype(int)
df['thi_stress_load'] = df['indice_thi'] * df['thi_bin_ord']

# Edad ordinal: 0=cría(≤24m), 1=novilla(≤48m), 2=adulta(≤72m), 3=madura(>72m)
df['edad_est_ord'] = pd.cut(df['edad_meses'],
    bins=[-np.inf, 24, 48, 72, np.inf],
    labels=[0, 1, 2, 3]).astype(int)

# FCR bins (cuartiles del dataset)
fcr_q = df['fcr'].quantile([0.25, 0.50, 0.75]).values
df['fcr_bin_ord'] = pd.cut(df['fcr'],
    bins=[-np.inf, fcr_q[0], fcr_q[1], fcr_q[2], np.inf],
    labels=[0, 1, 2, 3]).astype(int)

# Ratios dieta
df['ratio_fibra_proteina']   = df['fibra_pct'] / df['proteina_dieta_pct'].replace(0, np.nan).fillna(16.5)
df['ratio_proteina_energia'] = df['proteina_dieta_pct'] / df['energia_mcal_kg'].replace(0, np.nan).fillna(3.8)

# Lactancia productiva
df['leche_por_lactancia'] = df['leche_kg_dia'] * df['numero_lactancia'].clip(lower=1)

# Ciclicidad temporal
df['mes_sin'] = np.sin(2 * np.pi * df['mes'] / 12)
df['mes_cos'] = np.cos(2 * np.pi * df['mes'] / 12)

# Sistema de producción ordinal (0=Ext, 1=Semi, 2=Int)
SISTEMA_MAP = {'extensivo': 0, 'semi-intensivo': 1, 'intensivo': 2}
df['sistema_prod_ord'] = df['sistema_produccion'].str.lower().map(SISTEMA_MAP).fillna(1).astype(int)

# Nutraceuticos — no están en la DB de importación (default = 0)
df['omega3_mg_l']       = 0.0
df['antioxidantes_ppm'] = 0.0
df['tiene_taninos']     = 0
df['tiene_algas']       = 0
df['combo_anti_metano'] = 0
df['omega3_por_leche']  = 0.0

# indice_thi = temp_humedad_idx (alias)
df['indice_thi_feat'] = df['indice_thi']

# ── Definir FEAT_REG (mismo orden que el pipeline original) ──────────────────
FEAT_REG = [
    'edad_meses', 'ratio_proteina_energia', 'numero_lactancia', 'leche_por_lactancia',
    'omega3_por_leche', 'antioxidantes_ppm', 'tiene_taninos', 'tiene_algas',
    'combo_anti_metano', 'sistema_prod_ord', 'leche_kg_dia', 'proteina_dieta_pct',
    'fibra_pct', 'consumo_ms_kg', 'estres_termico', 'edad_est_ord', 'fcr_bin_ord',
    'humedad_pct', 'peso_kg', 'fcr', 'thi_bin_ord', 'temp_humedad_idx',
    'thi_stress_load', 'ratio_fibra_proteina', 'mes_sin', 'indice_thi', 'omega3_mg_l', 'mes_cos',
]

# Renombrar columnas que no coinciden exactamente
df = df.rename(columns={
    'estres_termico': 'estres_termico_orig',
    'estres_termico_calc': 'estres_termico',
    'indice_thi': 'indice_thi_raw',
    'indice_thi_feat': 'indice_thi',
})
# Asegurar que indice_thi existe
df['indice_thi'] = df['temp_humedad_idx']

# Verificar que tenemos todas las features
missing = [f for f in FEAT_REG if f not in df.columns]
if missing:
    print(f"⚠️  Features faltantes: {missing}")
    for f in missing:
        df[f] = 0.0

X = df[FEAT_REG].fillna(0).values
y = df['intensidad_metano'].values

print(f"Shape X: {X.shape}, Shape y: {y.shape}")
print(f"Stats target: mean={y.mean():.2f}, std={y.std():.2f}, min={y.min():.2f}, max={y.max():.2f}")
print(f"FCR range: {X[:,FEAT_REG.index('fcr')].min():.3f} – {X[:,FEAT_REG.index('fcr')].max():.3f}")
print(f"edad_meses range: {X[:,0].min():.0f} – {X[:,0].max():.0f}")

# ── Split y entrenamiento ─────────────────────────────────────────────────────
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

pipeline = Pipeline([
    ('scaler', StandardScaler()),
    ('mlp', MLPRegressor(
        hidden_layer_sizes=(256, 128, 64),
        activation='relu',
        solver='adam',
        alpha=0.001,
        batch_size=512,
        max_iter=300,
        early_stopping=True,
        n_iter_no_change=15,
        random_state=42,
        verbose=False,
    ))
])

print("\nEntrenando pipeline con datos raw (esto tarda ~30-60s)...")
pipeline.fit(X_train, y_train)

y_pred = pipeline.predict(X_test)
rmse = np.sqrt(mean_squared_error(y_test, y_pred))
r2   = r2_score(y_test, y_pred)
print(f"\n✅ Resultados en test set:")
print(f"   RMSE = {rmse:.4f}")
print(f"   R²   = {r2:.4f}")

# ── Guardar pipeline ──────────────────────────────────────────────────────────
OUT.parent.mkdir(parents=True, exist_ok=True)
joblib.dump(pipeline, OUT)
print(f"\n✅ Pipeline guardado en: {OUT}")

# Quick sanity check — predecir con valores típicos del form
SAMPLE_DEFAULTS = {
    'leche_kg_dia': 25, 'consumo_ms_kg': 20, 'fcr': 1.2, 'temp_humedad_idx': 72,
    'humedad_pct': 65, 'peso_kg': 550, 'edad_meses': 36, 'numero_lactancia': 2,
    'fibra_pct': 18, 'proteina_dieta_pct': 16.5, 'energia_mcal_kg': 3.8,
    'omega3_mg_l': 0, 'antioxidantes_ppm': 0, 'tiene_taninos': 0, 'tiene_algas': 0,
    'sistema_prod_ord': 1, 'estres_termico': 0, 'thi_bin_ord': 0, 'thi_stress_load': 0,
    'edad_est_ord': 1, 'fcr_bin_ord': 2, 'ratio_fibra_proteina': 1.09,
    'ratio_proteina_energia': 4.34, 'leche_por_lactancia': 50, 'mes_sin': 0.5,
    'mes_cos': 0.866, 'indice_thi': 72, 'omega3_por_leche': 0, 'combo_anti_metano': 0,
}
row    = np.array([float(SAMPLE_DEFAULTS.get(f, 0)) for f in FEAT_REG]).reshape(1, -1)
sanity = float(pipeline.predict(row)[0])
print(f"\n🔬 Sanity check (valores default del form):")
print(f"   Predicción = {sanity:.3f} g CH₄/kg leche")
print(f"   Nivel = {'Alto' if sanity > 25 else ('Medio' if sanity > 18 else 'Bajo')}")
print(f"   {'✅ OK (dentro de rango real 8-40)' if 8 < sanity < 40 else '⚠️  FUERA DE RANGO — revisar features'}")
