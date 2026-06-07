from __future__ import annotations

import numpy as np
import pandas as pd


FEAT_REG = [
    'edad_meses',
    'ratio_proteina_energia',
    'numero_lactancia',
    'leche_por_lactancia',
    'omega3_por_leche',
    'antioxidantes_ppm',
    'tiene_taninos',
    'tiene_algas',
    'combo_anti_metano',
    'sistema_prod_ord',
    'leche_kg_dia',
    'proteina_dieta_pct',
    'fibra_pct',
    'consumo_ms_kg',
    'estres_termico',
    'edad_est_ord',
    'fcr_bin_ord',
    'humedad_pct',
    'peso_kg',
    'fcr',
    'thi_bin_ord',
    'temp_humedad_idx',
    'thi_stress_load',
    'ratio_fibra_proteina',
    'mes_sin',
    'indice_thi',
    'omega3_mg_l',
    'mes_cos',
]

SISTEMA_MAP = {'extensivo': 0, 'semi-intensivo': 1, 'intensivo': 2}


def build_features(df: pd.DataFrame) -> pd.DataFrame:
    """Construye las 28 features usadas por el pipeline E4 raw-aware."""
    out = df.copy()

    out['fcr'] = (out['consumo_ms_kg'] / out['leche_kg_dia'].replace(0, np.nan)).fillna(1.2)
    out['temp_humedad_idx'] = out['indice_thi']
    out['estres_termico_calc'] = (out['indice_thi'] >= 72).astype(int)
    out['thi_bin_ord'] = (out['indice_thi'] >= 72).astype(int)
    out['thi_stress_load'] = out['indice_thi'] * out['thi_bin_ord']

    out['edad_est_ord'] = pd.cut(
        out['edad_meses'],
        bins=[-np.inf, 24, 48, 72, np.inf],
        labels=[0, 1, 2, 3],
    ).astype(int)

    fcr_q = out['fcr'].quantile([0.25, 0.50, 0.75]).values
    out['fcr_bin_ord'] = pd.cut(
        out['fcr'],
        bins=[-np.inf, fcr_q[0], fcr_q[1], fcr_q[2], np.inf],
        labels=[0, 1, 2, 3],
    ).astype(int)

    out['ratio_fibra_proteina'] = out['fibra_pct'] / out['proteina_dieta_pct'].replace(0, np.nan).fillna(16.5)
    out['ratio_proteina_energia'] = out['proteina_dieta_pct'] / out['energia_mcal_kg'].replace(0, np.nan).fillna(3.8)
    out['leche_por_lactancia'] = out['leche_kg_dia'] * out['numero_lactancia'].clip(lower=1)
    out['mes_sin'] = np.sin(2 * np.pi * out['mes'] / 12)
    out['mes_cos'] = np.cos(2 * np.pi * out['mes'] / 12)
    out['sistema_prod_ord'] = out['sistema_produccion'].str.lower().map(SISTEMA_MAP).fillna(1).astype(int)

    out['omega3_mg_l'] = 0.0
    out['antioxidantes_ppm'] = 0.0
    out['tiene_taninos'] = 0
    out['tiene_algas'] = 0
    out['combo_anti_metano'] = 0
    out['omega3_por_leche'] = 0.0

    out['indice_thi_feat'] = out['indice_thi']
    out['indice_thi'] = out['temp_humedad_idx']

    if 'estres_termico_calc' in out.columns:
        out['estres_termico'] = out['estres_termico_calc']

    missing = [f for f in FEAT_REG if f not in out.columns]
    for feature in missing:
        out[feature] = 0.0

    return out


def select_training_matrix(df: pd.DataFrame) -> tuple[np.ndarray, np.ndarray]:
    """Devuelve X, y listos para entrenamiento."""
    features = build_features(df)
    return features[FEAT_REG].fillna(0).values, features['intensidad_metano'].values
