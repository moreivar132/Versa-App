# SQL OUTSIDE KNEX — INVENTORY

**Fecha de auditoría:** 2026-01-22T18:21:00+01:00  
**Auditor:** Staff+ Backend Architect / Database Auditor  
**Alcance:** Solo identificación — sin modificaciones

---

## Resumen

- **Total de archivos `.sql` detectados fuera de Knex:** 84

> **Nota:** Knex ejecuta migraciones exclusivamente desde `backend/db/migrations/` y utiliza archivos `.js`.  
> Cualquier archivo `.sql` en `backend/` NO está gestionado por Knex.

---

## Listado completo (84 archivos)

### backend/archive/legacy-migrations/ (35 archivos)
1. `backend/archive/legacy-migrations/20260114_add_empresa_to_archivos.sql`
2. `backend/archive/legacy-migrations/20260114_finsaas_egresos_ocr.sql`
3. `backend/archive/legacy-migrations/20260115_copilot_contable.sql`
4. `backend/archive/legacy-migrations/20260115_marketplace_constraints_indexes.sql`
5. `backend/archive/legacy-migrations/20260116_vertical_access_control.sql`
6. `backend/archive/legacy-migrations/20260117_add_retenciones.sql`
7. `backend/archive/legacy-migrations/20260117_b2b_invite_flow.sql`
8. `backend/archive/legacy-migrations/20260117_deducible_validation.sql`
9. `backend/archive/legacy-migrations/20260117_dual_auth.sql`
10. `backend/archive/legacy-migrations/20260117_oauth_accounts.sql`
11. `backend/archive/legacy-migrations/20260117_unique_nif_contacto.sql`
12. `backend/archive/legacy-migrations/20260121_add_empresa_to_config.sql`
13. `backend/archive/legacy-migrations/add_config_to_estadoorden.sql`
14. `backend/archive/legacy-migrations/add_stripe_customer_to_client.sql`
15. `backend/archive/legacy-migrations/add_sucursal_contact_info.sql`
16. `backend/archive/legacy-migrations/add_sucursal_permissions.sql`
17. `backend/archive/legacy-migrations/create_accounting_empresa.sql`
18. `backend/archive/legacy-migrations/create_billing_enhancements.sql`
19. `backend/archive/legacy-migrations/create_cliente_notificaciones.sql`
20. `backend/archive/legacy-migrations/create_clientefinal_auth.sql`
21. `backend/archive/legacy-migrations/create_clientefinal_credito_mov.sql`
22. `backend/archive/legacy-migrations/create_contable_v2_tables.sql`
23. `backend/archive/legacy-migrations/create_email_campaign.sql`
24. `backend/archive/legacy-migrations/create_email_event_log.sql`
25. `backend/archive/legacy-migrations/create_income_event_table.sql`
26. `backend/archive/legacy-migrations/create_marketplace_reserva_pago.sql`
27. `backend/archive/legacy-migrations/create_orden_config_tables.sql`
28. `backend/archive/legacy-migrations/create_user_dashboard_prefs.sql`
29. `backend/archive/legacy-migrations/create_ventas_tables.sql`
30. `backend/archive/legacy-migrations/enable_rls_phase1.sql`
31. `backend/archive/legacy-migrations/enhance_email_templates.sql`
32. `backend/archive/legacy-migrations/fix_admin_permissions_all.sql`
33. `backend/archive/legacy-migrations/increase_sucursal_columns.sql`
34. `backend/archive/legacy-migrations/populate_marketplace_servicios.sql`
35. `backend/archive/legacy-migrations/update_marketplace_review_fotos.sql`

### backend/legacy/sql-migrations/ (34 archivos)
36. `backend/legacy/sql-migrations/add_config_to_estadoorden.sql`
37. `backend/legacy/sql-migrations/add_stripe_customer_to_client.sql`
38. `backend/legacy/sql-migrations/add_sucursal_contact_info.sql`
39. `backend/legacy/sql-migrations/add_sucursal_permissions.sql`
40. `backend/legacy/sql-migrations/create_billing_enhancements.sql`
41. `backend/legacy/sql-migrations/create_cliente_notificaciones.sql`
42. `backend/legacy/sql-migrations/create_clientefinal_auth.sql`
43. `backend/legacy/sql-migrations/create_clientefinal_credito_mov.sql`
44. `backend/legacy/sql-migrations/create_contabilidad_v3.sql`
45. `backend/legacy/sql-migrations/create_contable_v2_tables.sql`
46. `backend/legacy/sql-migrations/create_cuentas_corrientes_tables.sql`
47. `backend/legacy/sql-migrations/create_email_automation.sql`
48. `backend/legacy/sql-migrations/create_email_campaign.sql`
49. `backend/legacy/sql-migrations/create_email_config.sql`
50. `backend/legacy/sql-migrations/create_email_event_log.sql`
51. `backend/legacy/sql-migrations/create_email_queue.sql`
52. `backend/legacy/sql-migrations/create_email_template.sql`
53. `backend/legacy/sql-migrations/create_facturacion_tables.sql`
54. `backend/legacy/sql-migrations/create_fidelizacion_tables.sql`
55. `backend/legacy/sql-migrations/create_income_event_table.sql`
56. `backend/legacy/sql-migrations/create_marketplace_reserva_pago.sql`
57. `backend/legacy/sql-migrations/create_marketplace_tables.sql`
58. `backend/legacy/sql-migrations/create_open_banking_tables.sql`
59. `backend/legacy/sql-migrations/create_orden_config_tables.sql`
60. `backend/legacy/sql-migrations/create_rbac_tables.sql`
61. `backend/legacy/sql-migrations/create_subscription_tables.sql`
62. `backend/legacy/sql-migrations/create_user_dashboard_prefs.sql`
63. `backend/legacy/sql-migrations/create_ventas_tables.sql`
64. `backend/legacy/sql-migrations/enable_rls_phase1.sql`
65. `backend/legacy/sql-migrations/enhance_email_templates.sql`
66. `backend/legacy/sql-migrations/fix_admin_permissions_all.sql`
67. `backend/legacy/sql-migrations/increase_sucursal_columns.sql`
68. `backend/legacy/sql-migrations/populate_marketplace_servicios.sql`
69. `backend/legacy/sql-migrations/update_marketplace_review_fotos.sql`

### backend/legacy/sql-migrations-archive/ (12 archivos)
70. `backend/legacy/sql-migrations-archive/create_contabilidad_v3.sql`
71. `backend/legacy/sql-migrations-archive/create_cuentas_corrientes_tables.sql`
72. `backend/legacy/sql-migrations-archive/create_email_automation.sql`
73. `backend/legacy/sql-migrations-archive/create_email_config.sql`
74. `backend/legacy/sql-migrations-archive/create_email_queue.sql`
75. `backend/legacy/sql-migrations-archive/create_email_template.sql`
76. `backend/legacy/sql-migrations-archive/create_facturacion_tables.sql`
77. `backend/legacy/sql-migrations-archive/create_fidelizacion_tables.sql`
78. `backend/legacy/sql-migrations-archive/create_marketplace_tables.sql`
79. `backend/legacy/sql-migrations-archive/create_open_banking_tables.sql`
80. `backend/legacy/sql-migrations-archive/create_rbac_tables.sql`
81. `backend/legacy/sql-migrations-archive/create_subscription_tables.sql`

### backend/scripts/ (2 archivos)
82. `backend/scripts/emergency/disable_rls.sql`
83. `backend/scripts/verificar.sql`

### backend/sql/marketplace/ (1 archivo)
84. `backend/sql/marketplace/marketplace_audit.sql`

---

## Distribución por carpetas

| Carpeta | Cantidad de .sql |
|---------|------------------|
| `backend/archive/legacy-migrations` | 35 |
| `backend/legacy/sql-migrations` | 34 |
| `backend/legacy/sql-migrations-archive` | 12 |
| `backend/scripts/emergency` | 1 |
| `backend/scripts` | 1 |
| `backend/sql/marketplace` | 1 |
| **TOTAL** | **84** |

---

## Evidencia de comandos ejecutados

### Conteo total
```powershell
Get-ChildItem -Path backend -Recurse -Filter "*.sql" | Measure-Object | Select-Object -ExpandProperty Count
# Output: 84
```

### Listado completo
```powershell
Get-ChildItem -Path backend -Recurse -Filter "*.sql" | Select-Object -ExpandProperty FullName | Sort-Object
# Output: 84 archivos listados arriba
```

### Distribución por carpetas
```powershell
Get-ChildItem -Path backend -Recurse -Filter "*.sql" | ForEach-Object { $_.DirectoryName } | Group-Object | Sort-Object Count -Descending
# Output: 6 carpetas con distribución mostrada arriba
```

---

## Estado

| Criterio | Resultado |
|----------|-----------|
| SQL fuera de Knex identificados | ✅ **SÍ** (84 archivos) |
| Información faltante | ❌ **NO** |
| Todos los .sql listados | ✅ **SÍ** |
| Acciones propuestas | ❌ **NO** (solo inventario) |
| Resultado reproducible | ✅ **SÍ** |

---

## Notas finales

- Este documento es **SOLO de inventario**.
- No se han realizado modificaciones, archivados ni migraciones.
- La carpeta `backend/db/migrations/` contiene únicamente archivos `.js` gestionados por Knex.
- Los 84 archivos `.sql` identificados están **fuera del control de Knex**.

---

*Generado automáticamente — 2026-01-22T18:21:00+01:00*
