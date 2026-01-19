#!/bin/bash
# Test OCR Callback - Simula exactamente lo que Make está enviando

INTAKE_ID="26"  # Cambiar por el ID real del intake
API_URL="http://localhost:3000/api/contabilidad/intakes/${INTAKE_ID}/ocr-result"

# Payload exacto de Make (del screenshot)
curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{
  "ok": true,
  "schema_version": "1.0",
  "trace_id": "0af6ee8a-b4c1-419b-bda9-dc92c77bba1f",
  "tenant_id": "1",
  "empresa_id": "30",
  "user_id": "",
  "intake_id": "ink_26",
  "idempotency_key": "db604407-33d0-457a-9990-f70512943d27",
  "status": "",
  "file_url": "https://drive.google.com/uc?id=1wD_e3MeEuX8niKcycZSQD5_3BREhLSs5&export=download",
  "extracted": {
    "proveedor": "GESTAYA GESTORIA ADMINISTRATIVA SLP",
    "cif_nif": "B16904526",
    "fecha_emision": "2025-10-31",
    "numero_factura": "F25/3982",
    "base_imponible": "131",
    "iva_porcentaje": "21",
    "iva_importe": "27.51",
    "total": "158.51",
    "moneda": "EUR",
    "concepto": "Servicios de gestoría; Nómina mensual",
    "lineas": "{\"descripcion\":\"Servicios de gestoría\",\"cantidad\":1,\"precio_unitario\":81,\"iva_porcentaje\":21,\"importe\":81}, {\"descripcion\":\"Nómina mensual\",\"cantidad\":5,\"precio_unitario\":10,\"iva_porcentaje\":21,\"importe\":50}"
  },
  "validation": {
    "total_esperado": "158.51",
    "iva_calculado": "27.51",
    "check_total": "true",
    "check_iva": "true",
    "motivos_fallo": ""
  },
  "meta": {
    "area": "",
    "metodo_pago": "",
    "naturaleza": "",
    "categoria": "",
    "enviado_en": ""
  },
  "warnings": []
}'

echo "\n\n=== Check logs for [OCR Callback] messages ==="
