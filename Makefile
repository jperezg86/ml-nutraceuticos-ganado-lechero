PYTHON ?= python3

.PHONY: convert-raw

convert-raw:
	PYTHONPATH=src $(PYTHON) -m ml_nutraceuticos_ganado_lechero.convert_raw_data
