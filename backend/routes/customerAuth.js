/**
 * VERSA - PASO 5: Portal Cliente
 * Rutas de autenticación para clientes finales
 * Montaje: /api/cliente/auth
 */

const express = require('express');
const router = express.Router();
const customerAuthService = require('../services/customerAuthService');

/**
 * POST /api/cliente/auth/register
 * Registrar nuevo cliente
 */
router.post('/register', async (req, res) => {
    try {
        const { nombre, email, telefono, password, confirmPassword } = req.body;

        // Validaciones
        if (!nombre || !email || !password) {
            return res.status(400).json({
                ok: false,
                error: 'Nombre, email y contraseña son requeridos'
            });
        }

        // Validar email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                ok: false,
                error: 'Email inválido'
            });
        }

        // Validar confirmación de password
        if (confirmPassword && password !== confirmPassword) {
            return res.status(400).json({
                ok: false,
                error: 'Las contraseñas no coinciden'
            });
        }

        const result = await customerAuthService.register({
            nombre: nombre.trim(),
            email: email.toLowerCase().trim(),
            telefono: telefono?.trim() || null,
            password
        });

        res.status(201).json({
            ok: true,
            ...result
        });

    } catch (error) {
        console.error('Error en registro cliente:', error);

        if (error.status) {
            return res.status(error.status).json({
                ok: false,
                error: error.message
            });
        }

        // Error de constraint unique
        if (error.code === '23505') {
            return res.status(409).json({
                ok: false,
                error: 'Ya existe una cuenta con este email o teléfono'
            });
        }

        res.status(500).json({
            ok: false,
            error: 'Error al registrar usuario'
        });
    }
});

/**
 * POST /api/cliente/auth/login
 * Login de cliente
 */
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                ok: false,
                error: 'Email y contraseña son requeridos'
            });
        }

        const result = await customerAuthService.login(
            email.toLowerCase().trim(),
            password
        );

        res.json({
            ok: true,
            ...result
        });

    } catch (error) {
        console.error('Error en login cliente:', error);

        if (error.status) {
            return res.status(error.status).json({
                ok: false,
                error: error.message
            });
        }

        res.status(500).json({
            ok: false,
            error: 'Error al iniciar sesión'
        });
    }
});

/**
 * POST /api/cliente/auth/forgot
 * Solicitar reset de contraseña
 */
router.post('/forgot', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                ok: false,
                error: 'Email es requerido'
            });
        }

        const result = await customerAuthService.forgotPassword(
            email.toLowerCase().trim()
        );

        res.json({
            ok: true,
            ...result
        });

    } catch (error) {
        console.error('Error en forgot password:', error);
        res.status(500).json({
            ok: false,
            error: 'Error al procesar solicitud'
        });
    }
});

/**
 * POST /api/cliente/auth/reset
 * Reset de contraseña con token
 */
router.post('/reset', async (req, res) => {
    try {
        const { token, password, confirmPassword } = req.body;

        if (!token || !password) {
            return res.status(400).json({
                ok: false,
                error: 'Token y nueva contraseña son requeridos'
            });
        }

        if (confirmPassword && password !== confirmPassword) {
            return res.status(400).json({
                ok: false,
                error: 'Las contraseñas no coinciden'
            });
        }

        const result = await customerAuthService.resetPassword(token, password);

        res.json({
            ok: true,
            ...result
        });

    } catch (error) {
        console.error('Error en reset password:', error);

        if (error.status) {
            return res.status(error.status).json({
                ok: false,
                error: error.message
            });
        }

        res.status(500).json({
            ok: false,
            error: 'Error al restablecer contraseña'
        });
    }
});

module.exports = router;
