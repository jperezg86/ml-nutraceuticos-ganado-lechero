from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import tempfile
from pathlib import Path


SUPPORTED_EXTENSIONS = (".xls", ".xlsx")
DEFAULT_INPUT_DIR = Path("data/raw")
DEFAULT_OUTPUT_DIR = DEFAULT_INPUT_DIR / "csv"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Convierte archivos Excel de data/raw a CSV en UTF-8."
    )
    parser.add_argument(
        "--input-dir",
        type=Path,
        default=DEFAULT_INPUT_DIR,
        help=f"Directorio con archivos Excel. Default: {DEFAULT_INPUT_DIR}",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=DEFAULT_OUTPUT_DIR,
        help=f"Directorio de salida para los CSV. Default: {DEFAULT_OUTPUT_DIR}",
    )
    return parser.parse_args()


def list_excel_files(input_dir: Path) -> list[Path]:
    return sorted(
        path
        for path in input_dir.iterdir()
        if path.is_file() and path.suffix.lower() in SUPPORTED_EXTENSIONS
    )


def build_isolated_env(tmp_dir: str) -> dict[str, str]:
    env = os.environ.copy()
    env["HOME"] = tmp_dir
    env["XDG_CONFIG_HOME"] = os.path.join(tmp_dir, ".config")
    env["XDG_CACHE_HOME"] = os.path.join(tmp_dir, ".cache")
    env["XDG_RUNTIME_DIR"] = tmp_dir
    return env


def convert_file(source_path: Path, output_dir: Path) -> Path:
    soffice_path = shutil.which("soffice")
    if soffice_path is None:
        raise RuntimeError(
            "No se encontró 'soffice'. Instala LibreOffice para convertir Excel a CSV."
        )

    output_dir.mkdir(parents=True, exist_ok=True)
    csv_path = output_dir / f"{source_path.stem}.csv"
    utf8_csv_path = output_dir / f"{source_path.stem}.utf8.csv"

    if csv_path.exists():
        csv_path.unlink()
    if utf8_csv_path.exists():
        utf8_csv_path.unlink()

    with tempfile.TemporaryDirectory(prefix="soffice-profile-") as tmp_dir:
        try:
            subprocess.run(
                [
                    soffice_path,
                    "--headless",
                    "--convert-to",
                    "csv",
                    "--outdir",
                    str(output_dir),
                    str(source_path),
                ],
                check=True,
                capture_output=True,
                text=True,
                env=build_isolated_env(tmp_dir),
            )
        except subprocess.CalledProcessError as exc:
            error_output = exc.stderr.strip() or exc.stdout.strip() or str(exc)
            raise RuntimeError(
                f"Falló la conversión de {source_path.name} con LibreOffice: {error_output}"
            ) from exc

    if not csv_path.exists():
        raise RuntimeError(f"No se generó el CSV esperado para {source_path.name}.")

    csv_text = csv_path.read_text(encoding="iso-8859-1")
    utf8_csv_path.write_text(csv_text, encoding="utf-8")
    csv_path.unlink()
    utf8_csv_path.replace(csv_path)
    return csv_path


def main() -> None:
    args = parse_args()
    input_dir = args.input_dir
    output_dir = args.output_dir

    if not input_dir.exists():
        raise FileNotFoundError(f"No existe el directorio de entrada: {input_dir}")

    excel_files = list_excel_files(input_dir)
    if not excel_files:
        print(f"No se encontraron archivos Excel en {input_dir}")
        return

    print(f"Convirtiendo {len(excel_files)} archivos desde {input_dir} hacia {output_dir}")
    for source_path in excel_files:
        csv_path = convert_file(source_path, output_dir)
        print(f"- {source_path.name} -> {csv_path}")


if __name__ == "__main__":
    main()
