const pool = require('../db');

const getAllVehiculos = async () => {
    const result = await pool.query(`
        SELECT v.*, c.nombre as nombre_cliente, s.nombre as nombre_sucursal 
        FROM vehiculo v
        LEFT JOIN clientefinal c ON v.id_cliente = c.id
        LEFT JOIN sucursal s ON v.id_sucursal = s.id
        ORDER BY v.created_at DESC
    `);
    return result.rows;
};

const getVehiculoById = async (id) => {
    const result = await pool.query('SELECT * FROM vehiculo WHERE id = $1', [id]);
    return result.rows[0];
};

const createVehiculo = async (data) => {
    const {
        id_cliente,
        id_sucursal,
        matricula,
        marca,
        modelo,
        year,
        serial,
        seguro,
        color,
        cc,
        created_by
    } = data;

    const result = await pool.query(
        `INSERT INTO vehiculo (
            id_cliente, id_sucursal, matricula, marca, modelo, "year", 
            "Serial", "Seguro", "Color", "CC", created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
        [id_cliente, id_sucursal, matricula, marca, modelo, year, serial, seguro, color, cc, created_by]
    );
    return result.rows[0];
};

const updateVehiculo = async (id, data) => {
    const {
        id_cliente,
        id_sucursal,
        matricula,
        marca,
        modelo,
        year,
        serial,
        seguro,
        color,
        cc,
        updated_by
    } = data;

    const result = await pool.query(
        `UPDATE vehiculo SET 
            id_cliente = $1, 
            id_sucursal = $2, 
            matricula = $3, 
            marca = $4, 
            modelo = $5, 
            "year" = $6, 
            "Serial" = $7, 
            "Seguro" = $8, 
            "Color" = $9, 
            "CC" = $10, 
            updated_by = $11,
            updated_at = NOW()
        WHERE id = $12 RETURNING *`,
        [id_cliente, id_sucursal, matricula, marca, modelo, year, serial, seguro, color, cc, updated_by, id]
    );
    return result.rows[0];
};

const deleteVehiculo = async (id) => {
    await pool.query('DELETE FROM vehiculo WHERE id = $1', [id]);
};

const getVehiculosByCliente = async (clienteId) => {
    const result = await pool.query('SELECT * FROM vehiculo WHERE id_cliente = $1', [clienteId]);
    return result.rows;
};

module.exports = {
    getAllVehiculos,
    getVehiculoById,
    createVehiculo,
    updateVehiculo,
    deleteVehiculo,
    getVehiculosByCliente
};
