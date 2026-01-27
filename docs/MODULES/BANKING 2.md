# Módulo de Importación Bancaria (Banking)

## Descripción
El módulo de Banking permite la importación manual de extractos bancarios en formatos CSV y Excel (XLS/XLSX) para su posterior conciliación en el sistema Versa. Este módulo actúa como un puente entre los archivos crudos de los bancos y las tablas transaccionales del núcleo contable.

## Estructura del Módulo
El módulo sigue la arquitectura modular V2:
- `backend/modules/banking/controllers/`: Manejo de peticiones HTTP.
- `backend/modules/banking/services/`: Lógica de negocio y orquestación.
- `backend/modules/banking/parsers/`: Factoría y estrategias de parseo específicas por banco/formato.
- `backend/modules/banking/routes/`: Definición de los endpoints del módulo.

## Flujo de Importación
El proceso se divide en tres etapas para garantizar la integridad y permitir la revisión del usuario:

1. **Subida (Upload)**: El archivo se sube al servidor, se valida su integridad (hash SHA256 para evitar duplicados) y se registra en la tabla `bank_import` con estado `uploaded`.
2. **Parseo (Parse)**: Se extraen las filas del archivo usando el parser adecuado. Las filas se guardan en la tabla staging `bank_import_row` con estado `parsed` o `error`. El sistema detecta automáticamente el formato (ej. Jasper XLS, Caixa CSV).
3. **Confirmación (Commit)**: El usuario revisa los datos y selecciona la cuenta bancaria de destino. El sistema inserta las transacciones válidas en la tabla definitiva `bank_transaction`, evitando duplicados mediante una clave de idempotencia generada a partir de los datos de la transacción.

## API Endpoints (Base: `/api/banking`)

| Método | Endpoint | Descripción |
| :--- | :--- | :--- |
| `POST` | `/imports` | Sube un archivo bancario. Requiere multipart/form-data. |
| `POST` | `/imports/:id/parse` | Ejecuta el parseo del archivo previamente subido. |
| `POST` | `/imports/:id/commit` | Mueve las filas de staging a la tabla final de transacciones. |
| `GET` | `/imports` | Obtiene el historial de importaciones realizadas. |

## Modelo de Datos

### `bank_import`
Registra la cabecera de la importación.
- `status`: `uploaded`, `parsed`, `committed`, `failed`.
- `file_sha256`: Hash para evitar importar el mismo archivo varias veces.
- `detected_format`: El parser identificado (ej. `jasper_xls_v1`).

### `bank_import_row`
Tabla staging donde se almacenan los datos parseados antes de ser definitivos.
- `parsed`: Campo JSONB con la información estandarizada (fecha, concepto, importe, saldo).
- `raw`: Campo JSONB con la fila original sin procesar.

### `bank_transaction`
Tabla destino final (compartida con Open Banking). Las importaciones manuales usan `source = 'manual_import'`.

## Parsers Soportados
- **Jasper XLS**: Auditoría de extractos en formato Excel.
- **Caixa CSV**: Formato estándar de extractos CSV de CaixaBank.
- **Genérico (Próximamente)**: Soporte para mapeo manual de columnas.

## Uso del Idempotencia
Para evitar duplicados en `bank_transaction`, se genera un `provider_transaction_id` como un hash SHA256 de:
`tenant_id | bank_account_id | booking_date | amount | description | balance`

Esto permite re-importar archivos sin duplicar movimientos si estos no han cambiado.
