# Make.com Blueprint - Fixes Requeridos

## Problema Actual

El webhook response de Make tiene 2 errores críticos que causan que los datos NO se guarden:

### 1. Campo `status` Vacío
**Error:** La lógica if/else anidada devuelve string vacío
```javascript
// ❌ INCORRECTO (Módulo 39, línea "status"):
"status": "{{if(13.validacion.check_total = true; if(13.validacion.check_iva = true; \"extracted\"; \"needs_review\"); \"needs_review\")}}"
```

**Resultado:** `"status": ""`  ← String vacío

### 2. Campo `lineas` como String
**Error:** Las comillas alrededor de `{{toJSON()}}` lo convierten en string
```javascript
// ❌ INCORRECTO:
"lineas": "{{toJSON(13.lineas)}}"
```

**Resultado:** `"lineas": "{\"descripcion\":...}"` ← String, no array

---

## ✅ SOLUCIONES

### Fix 1: Status Logic
Buscar en módulo **39 (WebhookRespond)** el campo `status` y reemplazar con:

```javascript
"status": "{{if(and(13.validacion.check_total; 13.validacion.check_iva); \"extracted\"; \"needs_review\")}}"
```

**Explicación:**
- Usa `and()` en vez de if anidado
- Devuelve "extracted" si AMBOS checks son true
- Devuelve "needs_review" en cualquier otro caso

### Fix 2: Lineas como Array
Buscar el campo `"lineas":` y reemplazar con (SIN comillas alrededor):

```javascript
"lineas": {{toJSON(13.lineas)}}
```

**Explicación:**
- Sin comillas externas → Make inserta el JSON directamente como objeto
- Con comillas → Make lo convierte a string

---

## Verificación

Después de aplicar los cambios, el webhook debe devolver:

```json
{
  "status": "extracted",  // ✅ NO vacío
  "extracted": {
    "lineas": [            // ✅ Array, no string
      {
        "descripcion": "...",
        "cantidad": 1,
        "precio_unitario": 81
      }
    ]
  }
}
```

---

## Opcional: Mejorar Validación

Si quieres usar el campo `validation.check_total` correctamente, también verifica que en **módulo 13 (ParseJSON)** los checks vienen como boolean:

```javascript
// En el prompt del módulo 12 (OpenAI), asegurar que dice:
"check_total": true,    // boolean, no "true"
"check_iva": true       // boolean, no "true"
```

---

## Nota Técnica

El backend ahora es **resiliente** a estos errores:
- ✅ Detecta status vacío y lo auto-determina
- ✅ Parsea `lineas` si viene como string
- ✅ Convierte números string → number

Pero es mejor corregir Make para evitar procesamiento innecesario.
