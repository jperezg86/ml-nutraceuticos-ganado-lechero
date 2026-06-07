from __future__ import annotations

from pathlib import Path

import pandas as pd
from sklearn.model_selection import GroupShuffleSplit

from .features import FEAT_REG, build_features


DEFAULT_RAW_CSV = Path('data/raw/csv/dataset_vacas_24m_v2.csv')


def load_raw_csv(path: Path = DEFAULT_RAW_CSV) -> pd.DataFrame:
    if not path.exists():
        raise FileNotFoundError(f'No se encontró el dataset raw: {path}')
    return pd.read_csv(path)


def split_by_group(
    df: pd.DataFrame,
    *,
    group_col: str = 'id_vaca',
    test_size: float = 0.2,
    random_state: int = 42,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    if group_col not in df.columns:
        raise KeyError(f'La columna de grupos no existe: {group_col}')

    splitter = GroupShuffleSplit(n_splits=1, test_size=test_size, random_state=random_state)
    train_idx, test_idx = next(splitter.split(df, groups=df[group_col]))
    return df.iloc[train_idx].copy(), df.iloc[test_idx].copy()


def build_xy_from_raw_df(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame, pd.Series]:
    features = build_features(df)
    X = features[FEAT_REG].fillna(0)
    y = features['intensidad_metano']
    return features, X, y
