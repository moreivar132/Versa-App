/**
 * VERSA - PASO 5: Portal Cliente
 * Servicio de autenticación para clientes finales
 */

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const customerRepo = require('../repositories/customerRepository');
const { generateCustomerToken } = require('../middleware/customerAuth');
const emailAutomationService = require('./emailAutomationService');
const { APP_URL } = require('../config/urls');

class CustomerAuthService {

    /**
     * Registrar nuevo cliente
     */
    async register(data) {
        const { nombre, email, telefono, password } = data;

        // Validar password
        if (!password || password.length < 8) {
            throw { status: 400, message: 'La contraseña debe tener al menos 8 caracteres' };
        }

        // Verificar si ya existe auth con ese email
        const existingAuth = await customerRepo.findAuthByEmail(email);
        if (existingAuth) {
            throw { status: 409, message: 'Ya existe una cuenta con este email' };
        }

        // Buscar si existe clientefinal con ese email o teléfono
        let existingCliente = await customerRepo.findClienteByEmail(email);

        if (!existingCliente && telefono) {
            existingCliente = await customerRepo.findClienteByTelefono(telefono);
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        let customer;

        if (existingCliente) {
            // Vincular auth a cliente existente
            const existingAuthForCliente = await customerRepo.findAuthByClienteId(existingCliente.id);
            if (existingAuthForCliente) {
                throw { status: 409, message: 'Este cliente ya tiene una cuenta registrada' };
            }

            const auth = await customerRepo.createAuthForCliente(existingCliente.id, {
                email,
                telefono,
                password_hash: passwordHash
            });

            customer = {
                id: auth.id,
                id_cliente: existingCliente.id,
                email: auth.email,
                nombre: existingCliente.nombre
            };
        } else {
            // Crear nuevo cliente y auth
            const { cliente, auth } = await customerRepo.createClienteWithAuth(
                {
                    nombre,
                    email,
                    telefono,
                    id_tenant: 1 // Default tenant, puede ajustarse según lógica de negocio
                },
                {
                    email,
                    telefono,
                    password_hash: passwordHash
                }
            );

            customer = {
                id: auth.id,
                id_cliente: cliente.id,
                email: auth.email,
                nombre: cliente.nombre
            };
        }

        // Generar token
        const token = generateCustomerToken(customer);

        // Disparar email de bienvenida (async, no bloquea)
        this.sendWelcomeEmail(customer.id_cliente, customer.nombre, data.email, 1);

        return {
            token,
            customer: {
                id: customer.id_cliente,
                nombre: customer.nombre,
                email: customer.email,
                telefono: data.telefono || null
            }
        };
    }

    /**
     * Enviar email de bienvenida (no bloquea registro)
     */
    async sendWelcomeEmail(id_cliente, nombre, email, id_tenant) {
        try {
            await emailAutomationService.triggerEvent({
                id_tenant: id_tenant || 1,
                event_code: 'CLIENT_REGISTERED',
                id_cliente,
                to_email: email,
                variables: {
                    nombre: nombre || 'Cliente',
                    portal_url: `${APP_URL}/cliente-dashboard.html`,
                    soporte_email: 'soporte@goversa.es',
                    whatsapp: '+34 XXX XXX XXX'
                }
            });
        } catch (error) {
            // Log error pero no fallar el registro
            console.error('[CustomerAuth] Error enviando welcome email:', error);
        }
    }

    /**
     * Login de cliente
     */
    async login(email, password) {
        // Buscar auth
        const auth = await customerRepo.findAuthByEmail(email);

        if (!auth) {
            throw { status: 401, message: 'Credenciales incorrectas' };
        }

        // Verificar password
        const validPassword = await bcrypt.compare(password, auth.password_hash);

        if (!validPassword) {
            throw { status: 401, message: 'Credenciales incorrectas' };
        }

        // Actualizar último login
        await customerRepo.updateLastLogin(auth.id);

        // Generar token
        const customer = {
            id: auth.id,
            id_cliente: auth.id_cliente,
            email: auth.email,
            nombre: auth.nombre
        };

        const token = generateCustomerToken(customer);

        return {
            token,
            customer: {
                id: auth.id_cliente,
                nombre: auth.nombre,
                email: auth.email,
                telefono: auth.cliente_telefono || auth.telefono
            }
        };
    }

    /**
     * Solicitar reset de password
     */
    async forgotPassword(email) {
        const auth = await customerRepo.findAuthByEmail(email);

        if (!auth) {
            // No revelar si el email existe o no (seguridad)
            return { message: 'Si el email existe, recibirás instrucciones para restablecer tu contraseña' };
        }

        // Generar token de reset
        const resetToken = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

        await customerRepo.saveResetToken(auth.id, resetToken, expiresAt);

        // Disparar email de reset (async, no bloquea)
        this.sendPasswordResetEmail(auth.id_cliente, auth.nombre, email, resetToken, 1);

        console.log(`[DEV] Reset token for ${email}: ${resetToken}`);

        return {
            message: 'Si el email existe, recibirás instrucciones para restablecer tu contraseña',
            // Solo para desarrollo:
            dev_token: process.env.NODE_ENV !== 'production' ? resetToken : undefined
        };
    }

    /**
     * Enviar email de reset de password (no bloquea)
     */
    async sendPasswordResetEmail(id_cliente, nombre, email, resetToken, id_tenant) {
        try {
            const reset_url = `${APP_URL}/cliente-reset.html?token=${resetToken}`;

            await emailAutomationService.triggerEvent({
                id_tenant: id_tenant || 1,
                event_code: 'PASSWORD_RESET_REQUESTED',
                id_cliente,
                to_email: email,
                variables: {
                    nombre: nombre || 'Cliente',
                    reset_url,
                    exp_minutes: '60',
                    reset_token: resetToken  // Para idempotencia
                }
            });
        } catch (error) {
            // Log error pero no fallar el proceso
            console.error('[CustomerAuth] Error enviando reset email:', error);
        }
    }

    /**
     * Reset de password con token
     */
    async resetPassword(token, newPassword) {
        if (!newPassword || newPassword.length < 8) {
            throw { status: 400, message: 'La contraseña debe tener al menos 8 caracteres' };
        }

        const auth = await customerRepo.findByResetToken(token);

        if (!auth) {
            throw { status: 400, message: 'Token inválido o expirado' };
        }

        // Hash nueva password
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(newPassword, salt);

        await customerRepo.updatePassword(auth.id, passwordHash);

        return { message: 'Contraseña actualizada exitosamente' };
    }

    /**
     * Verificar token y obtener info del cliente
     */
    async getMe(idCliente) {
        const profile = await customerRepo.getClienteProfile(idCliente);

        if (!profile) {
            throw { status: 404, message: 'Perfil no encontrado' };
        }

        return {
            id: profile.id,
            nombre: profile.nombre,
            email: profile.auth_email || profile.email,
            telefono: profile.telefono,
            direccion: profile.direccion,
            email_verified: profile.email_verified,
            last_login: profile.last_login_at
        };
    }

    /**
     * Actualizar perfil del cliente
     */
    async updateMe(idCliente, data) {
        const updated = await customerRepo.updateClienteProfile(idCliente, data);

        return {
            id: updated.id,
            nombre: updated.nombre,
            telefono: updated.telefono,
            direccion: updated.direccion
        };
    }
}

module.exports = new CustomerAuthService();
