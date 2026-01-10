const nodemailer = require('nodemailer');

class EmailService {
    constructor() {
        this.transporter = null;
        this.init();
    }

    init() {
        // Try to identify if we have credentials
        if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
            this.transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST,
                port: process.env.SMTP_PORT || 587,
                secure: process.env.SMTP_SECURE === 'true',
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS
                }
            });
            console.log('EmailService: SMTP Transporter initialized');
        } else {
            console.warn('EmailService: No SMTP credentials found (SMTP_HOST, SMTP_USER, SMTP_PASS). Emails will be logged to console only.');
        }
    }

    async sendEmail({ to, subject, html, text }) {
        if (!this.transporter) {
            console.log('--- MOCK EMAIL SEND ---');
            console.log(`To: ${to}`);
            console.log(`Subject: ${subject}`);
            console.log(`HTML: ${html}`);
            console.log('-----------------------');
            return true;
        }

        try {
            const info = await this.transporter.sendMail({
                from: process.env.SMTP_FROM || '"Versa Manager" <noreply@versamanager.com>',
                to,
                subject,
                text: text || html.replace(/<[^>]*>?/gm, ''), // Fallback text
                html
            });
            console.log('Email sent: %s', info.messageId);
            return true;
        } catch (error) {
            console.error('Error sending email:', error);
            // Don't throw error to avoid breaking the flow, just log it
            return false;
        }
    }

    async sendWelcomeEmail(to, name, limitDays) {
        return this.sendEmail({
            to,
            subject: 'Bienvenido a Versa Manager - Tu Prueba Gratuita',
            html: `
                <div style="font-family: Arial, sans-serif; color: #333;">
                    <h1 style="color: #FF5F00;">¡Bienvenido a Versa Manager!</h1>
                    <p>Hola ${name},</p>
                    <p>Gracias por registrarte para tu prueba gratuita de ${limitDays} días.</p>
                    <p>Estamos emocionados de ayudarte a llevar tu taller al siguiente nivel.</p>
                    <p>Si tienes alguna pregunta, no dudes en contactarnos.</p>
                    <br>
                    <p>Saludos,</p>
                    <p>El equipo de Versa Manager</p>
                </div>
            `
        });
    }

    async sendTempPasswordEmail(to, tempPassword) {
        return this.sendEmail({
            to,
            subject: 'Tu Contraseña Temporal - Versa Manager',
            html: `
                <div style="font-family: Arial, sans-serif; color: #333;">
                    <h2 style="color: #FF5F00;">Acceso a Versa Manager</h2>
                    <p>Se ha generado una contraseña temporal para tu cuenta.</p>
                    <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
                        <p style="margin: 0; font-size: 14px; color: #666;">Tu contraseña es:</p>
                        <p style="margin: 5px 0 0; font-size: 24px; font-weight: bold; letter-spacing: 2px;">${tempPassword}</p>
                    </div>
                    <p>Por favor, inicia sesión y cambia esta contraseña lo antes posible en la sección de Configuración.</p>
                    <br>
                    <a href="${process.env.APP_URL || 'http://localhost:5173'}/login.html" style="background: #FF5F00; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Iniciar Sesión</a>
                </div>
            `
        });
    }
}

module.exports = new EmailService();
