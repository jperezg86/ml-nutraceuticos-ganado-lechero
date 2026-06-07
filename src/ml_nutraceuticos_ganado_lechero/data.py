from __future__ import annotations

import sqlite3
from pathlib import Path

import pandas as pd


RAW_TRAINING_QUERY = """
    SELECT
        leche_kg_dia, consumo_ms_kg, edad_meses, numero_lactancia,
        peso_kg, fibra_pct, proteina_dieta_pct, energia_mcal_kg,
        humedad_pct, indice_thi, estres_termico, mes,
        sistema_produccion, intensidad_metano
    FROM registros
    WHERE intensidad_metano IS NOT NULL
      AND intensidad_metano > 0
      AND fuente = 'importacion'
"""


def load_raw_training_data(db_path: Path) -> pd.DataFrame:
    """Carga los registros históricos importados desde SQLite."""
    if not db_path.exists():
        raise FileNotFoundError(f'No existe la base SQLite: {db_path}')

    conn = sqlite3.connect(db_path)
    try:
        return pd.read_sql_query(RAW_TRAINING_QUERY, conn)
    finally:
        conn.close()
