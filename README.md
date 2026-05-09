# ML Nutraceuticos Ganado Lechero

Repositorio reducido para trabajar el EDA de los archivos crudos en `data/raw`.

## Estructura útil

```text
data/raw/        # archivos originales .xlsx
data/raw/csv/    # archivos convertidos a .csv
data/processed/  # salidas limpias o transformadas
notebooks/       # exploración
src/             # utilidades pequeñas de soporte
```

## Convertir Excel a CSV

```bash
make convert-raw
```

El conversor usa `LibreOffice` (`soffice`) y deja los CSV en UTF-8.

## EDA inicial

Hay un notebook base en `notebooks/01_eda_raw_data.ipynb` para:

- detectar la fila de encabezado real en cada CSV
- resumir nulos y valores `nd`
- revisar un ejemplo cargado como tabla
- obtener un `describe()` rápido sobre columnas `ppm`
