const express = require('express');
const router = express.Router();
const verifyJWT = require('../middleware/auth');
const vehiculoModel = require('../models/vehiculoModel');

router.use(verifyJWT);

// Get all vehicles
router.get('/', async (req, res) => {
    try {
        const vehiculos = await vehiculoModel.getAllVehiculos();
        res.json(vehiculos);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener vehículos' });
    }
});

// Get vehicle by ID
router.get('/:id', async (req, res) => {
    try {
        const vehiculo = await vehiculoModel.getVehiculoById(req.params.id);
        if (!vehiculo) return res.status(404).json({ error: 'Vehículo no encontrado' });
        res.json(vehiculo);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener vehículo' });
    }
});

// Create vehicle
router.post('/', async (req, res) => {
    try {
        const { id_cliente, id_sucursal, matricula, marca, modelo, year, serial, seguro, color, cc } = req.body;

        if (!id_cliente || !id_sucursal) {
            return res.status(400).json({ error: 'Cliente y Sucursal son obligatorios' });
        }

        const newVehiculo = await vehiculoModel.createVehiculo({
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
            created_by: req.user.id
        });
        res.status(201).json(newVehiculo);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al crear vehículo' });
    }
});

// Update vehicle
router.put('/:id', async (req, res) => {
    try {
        const updatedVehiculo = await vehiculoModel.updateVehiculo(req.params.id, {
            ...req.body,
            updated_by: req.user.id
        });
        if (!updatedVehiculo) return res.status(404).json({ error: 'Vehículo no encontrado' });
        res.json(updatedVehiculo);
    } catch (error) {
        res.status(500).json({ error: 'Error al actualizar vehículo' });
    }
});

// Delete vehicle
router.delete('/:id', async (req, res) => {
    try {
        await vehiculoModel.deleteVehiculo(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar vehículo' });
    }
});

module.exports = router;
