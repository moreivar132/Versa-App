const CaixaCsvParser = require('./caixaCsvParser');
const JasperXlsParser = require('./jasperXlsParser');

class ParserFactory {
    static getParser(format) {
        switch (format) {
            case 'caixa_csv_v1':
                return new CaixaCsvParser();
            case 'jasper_xls_v1':
                return new JasperXlsParser();
            default:
                throw new Error(`Formato no soportado: ${format}`);
        }
    }

    static detectFormat(headers, firstRows = []) {
        // 1. Caixa CSV (headers joined by delimiter)
        const headerString = Array.isArray(headers) ? headers.join(';') : headers;
        if (headerString.includes('Concepto;Fecha;Importe;Saldo')) {
            return 'caixa_csv_v1';
        }

        // 2. Jasper XLS (look for 'F. VALOR' in any cell of first rows)
        // firstRows is array of arrays or objects
        for (const row of firstRows) {
            const values = Object.values(row).map(v => String(v).toUpperCase().trim());
            if (values.includes('F. VALOR')) {
                return 'jasper_xls_v1';
            }
        }

        return 'unknown';
    }
}

module.exports = ParserFactory;
