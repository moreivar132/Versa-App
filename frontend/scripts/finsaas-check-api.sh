#!/usr/bin/env bash
set -euo pipefail

ROOT="src/verticals/finsaas"

echo "== FinSaaS Static Check: buscando rutas relativas /api y API_BASE =="

# 1) fetch('/api') o fetch("/api")
if grep -RIn --include="*.js" --include="*.html" "fetch(['\"]/api" "$ROOT"; then
  echo "FAIL: Encontradas llamadas fetch('/api...') en FinSaaS."
  exit 1
fi

# 2) axios('/api') (por si existe)
if grep -RIn --include="*.js" --include="*.html" "axios\..*(['\"]/api" "$ROOT"; then
  echo "FAIL: Encontradas llamadas axios.*('/api...') en FinSaaS."
  exit 1
fi

# 3) API_BASE hardcodeado vacío o sospechoso
if grep -RIn --include="*.js" --include="*.html" "const API_BASE\s*=\s*''" "$ROOT"; then
  echo "FAIL: Encontrado const API_BASE = '' en FinSaaS."
  exit 1
fi

echo "OK: FinSaaS no contiene rutas relativas /api ni API_BASE vacío."
