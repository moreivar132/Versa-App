const csv = require('csv-parser');
const { Readable } = require('stream');
const crypto = require('crypto');

class CaixaCsvParser {
    constructor() {
        this.delimiter = ';';
        this.dateFormat = 'DD/MM/YYYY'; // Just for ref, parsing is manual
    }

    /**
     * Parsea un buffer o stream
     * @param {Buffer} buffer 
     * @returns {Promise<Array>} rows staging
     */
    async parse(buffer) {
        const rows = [];
        const self = this;
        let rowNumber = 0;

        // Convert buffer to stream
        const stream = Readable.from(buffer.toString('utf-8'));

        return new Promise((resolve, reject) => {
            stream
                .pipe(csv({ separator: ';' }))
                .on('data', (data) => {
                    rowNumber++;
                    try {
                        const parsedRow = self.transformRow(data, rowNumber);
                        rows.push(parsedRow);
                    } catch (error) {
                        rows.push({
                            row_number: rowNumber,
                            status: 'error',
                            errors: [error.message],
                            raw: data
                        });
                    }
                })
                .on('end', () => resolve(rows))
                .on('error', (err) => reject(err));
        });
    }

    transformRow(data, rowNumber) {
        // Expected: Concepto;Fecha;Importe;Saldo
        // Data keys might be 'Concepto', 'Fecha', 'Importe', 'Saldo' depending on CSV header

        const rawDate = data['Fecha'];
        const rawAmount = data['Importe'];
        const rawBalance = data['Saldo'];
        const description = data['Concepto'];

        const errors = [];

        if (!rawDate) errors.push('Fecha vacía');
        if (!rawAmount) errors.push('Importe vacío');

        // Parse Date: dd/mm/yyyy
        let booking_date = null;
        if (rawDate) {
            const [day, month, year] = rawDate.split('/');
            if (day && month && year) {
                booking_date = `${year}-${month}-${day}`; // ISO format YYYY-MM-DD
            } else {
                errors.push('Formato de fecha inválido');
            }
        }

        // Parse Amount: "-2,65EUR" or "4.635,05" -> Remove EUR, swap . and ,
        const parseEuropeanAmount = (str) => {
            if (!str) return null;
            let clean = str.replace('EUR', '').trim();
            // Remove thousands separator (.) and replace decimal (,) with (.)
            clean = clean.replace(/\./g, '').replace(',', '.');
            const num = parseFloat(clean);
            return isNaN(num) ? null : num;
        };

        const amount = parseEuropeanAmount(rawAmount);
        if (amount === null) errors.push('Importe inválido');

        const balance = parseEuropeanAmount(rawBalance);

        // Generate Hash for dedupe later (external_id generation happens in Service or here?)
        // Better here to have a "fingerprint"

        return {
            row_number: rowNumber,
            status: errors.length > 0 ? 'error' : 'ok',
            errors: errors.length > 0 ? errors : null,
            parsed: {
                booking_date,
                amount,
                balance,
                description,
                currency: 'EUR',
                source_raw: data
            },
            raw: data // Keep original json
        };
    }
}

module.exports = CaixaCsvParser;
