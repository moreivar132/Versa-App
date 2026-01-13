# Legacy SQL Migrations

Este directorio contiene los scripts de migración que existían ANTES de adoptar Knex.

**⚠️ NO EJECUTAR ESTOS SCRIPTS DIRECTAMENTE EN PRODUCCIÓN**

Estos scripts son referencia histórica. Para nuevas instalaciones de base de datos,
ejecutar en orden cronológico. Para DBs existentes, usar `npm run migrate:latest`.

## Orden de Ejecución (para DB nueva)

Los scripts deben ejecutarse en el siguiente orden:

### Core Tables (Schema base)
1. `create_subscription_tables.sql` - Planes de suscripción
2. `create_whatsapp_timelines_tables.js` - Timelines WhatsApp
3. `create_facturacion_tables.sql` - Facturación
4. `create_cuentas_corrientes_tables.sql` - Cuentas corrientes
5. `create_caja_chica_tables.js` - Caja chica
6. `create_orden_config_tables.sql` - Config de órdenes
7. `create_ventas_tables.sql` - Ventas

### Marketplace & Portal
8. `create_marketplace_tables.sql` - Marketplace
9. `populate_marketplace_servicios.sql` - Datos iniciales marketplace
10. `create_clientefinal_auth.sql` - Auth de clientes
11. `create_clientefinal_credito_mov.sql` - Movimientos de crédito
12. `create_cliente_notificaciones.sql` - Notificaciones
13. `create_marketplace_reserva_pago.sql` - Pagos marketplace
14. `update_marketplace_review_fotos.sql` - Fotos reviews

### Email & Marketing
15. `create_email_template.sql` - Templates email
16. `create_email_config.sql` - Config email
17. `create_email_queue.sql` - Cola de emails
18. `create_email_event_log.sql` - Log de eventos
19. `create_email_automation.sql` - Automatizaciones
20. `create_email_campaign.sql` - Campañas
21. `enhance_email_templates.sql` - Mejoras templates

### RBAC & Billing
22. `create_rbac_tables.sql` - Tablas RBAC
23. `create_billing_enhancements.sql` - Mejoras billing
24. `add_stripe_customer_to_client.sql` - Stripe customer

### Income & Dashboard
25. `create_income_event_table.sql` - Eventos de ingreso
26. `create_user_dashboard_prefs.sql` - Prefs dashboard

### Fidelización & Banking
27. `create_fidelizacion_tables.sql` - Fidelización
28. `create_open_banking_tables.sql` - Open Banking

### Contabilidad
29. `create_contable_v2_tables.sql` - Contabilidad V2
30. `create_contabilidad_v3.sql` - Contabilidad V3

### Fixes & Enhancements
31. `add_config_to_estadoorden.sql` - Config estado orden
32. `add_sucursal_contact_info.sql` - Info contacto sucursal
33. `add_sucursal_permissions.sql` - Permisos sucursal
34. `fix_admin_permissions_all.sql` - Fix permisos admin
35. `increase_sucursal_columns.sql` - Expandir columnas

### Seeds (Datos iniciales)
36. `populate_planes_suscripcion.js` - Planes
37. `seed_rbac_permissions.js` - Permisos RBAC
38. `seed_rbac_roles.js` - Roles RBAC
39. `seed_billing_plans.js` - Planes billing
40. `seed_email_templates.js` - Templates email

### Security (RLS)
41. `enable_rls_phase1.sql` - Row Level Security (AHORA MIGRACIÓN KNEX)

## Scripts de Ejecución (runners)

Estos son scripts Node que ejecutan migraciones específicas:
- `ejecutar_migracion_billing.js`
- `ejecutar_migracion_rbac.js`
- `run_contable_v2_migration.js`
- `run_contabilidad_v3_migration.js`
- Etc.

## Política

A partir de 2026-01-13, TODOS los cambios de schema deben hacerse via Knex.
Estos scripts legacy se mantienen solo como referencia.
