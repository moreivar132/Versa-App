const xlsx = require('xlsx');

class JasperXlsParser {
    constructor() {
        // Headers we expect in row 0 of the sheet or after finding 'F. VALOR'
    }

    /**
     * Parsea un buffer XLS/XLSX
     * @param {Buffer} buffer 
     * @returns {Promise<Array>} rows staging
     */
    async parse(buffer) {
        // Read workbook
        const workbook = xlsx.read(buffer, { type: 'buffer' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        // Convert to JSON with array of arrays to find header row
        const rawData = xlsx.utils.sheet_to_json(worksheet, { header: 1, raw: false }); // raw: false -> strings

        const rows = [];
        let headerRowIndex = -1;
        let headers = [];

        // 1. Find Header Row
        for (let i = 0; i < rawData.length; i++) {
            const row = rawData[i];
            // Check if this row contains 'F. VALOR'
            const foundUpper = row.map(c => String(c).toUpperCase().trim());
            if (foundUpper.includes('F. VALOR')) {
                headerRowIndex = i;
                headers = foundUpper;
                break;
            }
        }

        if (headerRowIndex === -1) {
            throw new Error('No se encontró la cabecera "F. VALOR" en el archivo XLS.');
        }

        // 2. Parse Data Rows
        let rowNumber = 0; // Relative to parsed rows
        for (let i = headerRowIndex + 1; i < rawData.length; i++) {
            rowNumber++;
            const rowValues = rawData[i];

            // Skip empty rows
            if (!rowValues || rowValues.length === 0 || rowValues.every(c => !c)) continue;

            try {
                const parsedRow = this.transformRow(rowValues, headers, rowNumber, i + 1);
                rows.push(parsedRow);
            } catch (error) {
                rows.push({
                    row_number: rowNumber,
                    status: 'error',
                    errors: [error.message],
                    raw: rowValues
                });
            }
        }

        return rows;
    }

    transformRow(rowValues, headers, rowNumber, originalLine) {
        // Map headers to indices
        const getIdx = (name) => headers.indexOf(name);

        const idxDate = getIdx('F. VALOR');
        const idxDesc = getIdx('DESCRIPCIÓN');
        const idxCat = getIdx('CATEGORÍA');
        const idxSub = getIdx('SUBCATEGORÍA');
        const idxAmount = getIdx('IMPORTE (€)');
        const idxBalance = getIdx('SALDO (€)');

        const errors = [];

        // Helper to get value safetly
        const getVal = (idx) => (idx !== -1 && rowValues[idx]) ? String(rowValues[idx]).trim() : null;

        const rawDate = getVal(idxDate);
        const rawAmount = getVal(idxAmount);
        const rawBalance = getVal(idxBalance);
        const description = getVal(idxDesc);
        const category = getVal(idxCat);
        const subcategory = getVal(idxSub);

        if (!rawDate) errors.push('Fecha (F. VALOR) vacía');
        if (!rawAmount) errors.push('Importe (IMPORTE (€)) vacío');

        // Parse Date: dd/mm/yyyy often, or sometimes Excel serial if raw=true, but we used raw=false
        // Warning: XLXS date formats can be tricky. Assuming string "DD/MM/YYYY" or "DD-MMM-YY"
        // If it comes as "19/01/2026"
        let booking_date = null;
        if (rawDate) {
            // Simple regex for dd/mm/yyyy
            const parts = rawDate.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
            if (parts) {
                const [_, d, m, y] = parts;
                booking_date = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
            } else {
                errors.push(`Formato de fecha desconocido: ${rawDate}`);
            }
        }

        // Parse Amount: "1.200,00" or "-2,65"
        // remove points, replace comma
        const parseAmount = (str) => {
            if (!str) return null;
            let clean = str.replace(/\./g, '').replace(',', '.');
            const num = parseFloat(clean);
            return isNaN(num) ? null : num;
        };

        const amount = parseAmount(rawAmount);
        if (amount === null && rawAmount) errors.push(`Importe inválido: ${rawAmount}`);

        const balance = parseAmount(rawBalance);

        return {
            row_number: rowNumber,
            status: errors.length > 0 ? 'error' : 'ok',
            errors: errors.length > 0 ? errors : null,
            parsed: {
                booking_date,
                amount,
                balance,
                description,
                category,
                subcategory,
                currency: 'EUR',
                source_raw: { line: originalLine, data: rowValues }
            },
            raw: rowValues
        };
    }
}

module.exports = JasperXlsParser;
