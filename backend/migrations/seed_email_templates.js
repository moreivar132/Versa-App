/**
 * VERSA - BLOQUE 7: Email Automations
 * Seed script para plantillas y automatizaciones de email
 * 
 * Uso: node migrations/seed_email_templates.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const pool = require('../db');

// =====================================================
// PLANTILLAS POR DEFECTO
// =====================================================

const TEMPLATES = [
    {
        code: 'WELCOME',
        name: 'Email de Bienvenida',
        subject: '¡Bienvenido a VERSA, {{nombre}}!',
        variables_json: ['nombre', 'portal_url', 'soporte_email', 'whatsapp'],
        html_body: `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bienvenido a VERSA</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0b0d11;">
    <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
            <td align="center" style="padding: 40px 0;">
                <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #111318; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.4);">
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #ff4400 0%, #ff6622 100%); padding: 40px 30px; text-align: center;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 800; letter-spacing: -1px;">VERSA</h1>
                            <p style="margin: 8px 0 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">Tu taller de confianza</p>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px 30px;">
                            <h2 style="margin: 0 0 20px 0; color: #ffffff; font-size: 24px; font-weight: 600;">
                                ¡Hola {{nombre}}! 👋
                            </h2>
                            <p style="margin: 0 0 20px 0; color: #9da6b9; font-size: 16px; line-height: 1.6;">
                                Gracias por registrarte en <strong style="color: #ff4400;">VERSA</strong>. Ahora puedes:
                            </p>
                            <ul style="margin: 0 0 30px 0; padding-left: 20px; color: #9da6b9; font-size: 15px; line-height: 2;">
                                <li>📅 Reservar citas online</li>
                                <li>🚗 Gestionar tus vehículos</li>
                                <li>📋 Ver el historial de servicios</li>
                                <li>💳 Pagar de forma segura</li>
                            </ul>
                            
                            <!-- CTA Button -->
                            <table role="presentation" style="width: 100%; border-collapse: collapse;">
                                <tr>
                                    <td align="center" style="padding: 20px 0;">
                                        <a href="{{portal_url}}" style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #ff4400 0%, #ff6622 100%); color: #ffffff; text-decoration: none; font-weight: 700; font-size: 16px; border-radius: 12px; box-shadow: 0 4px 16px rgba(255,68,0,0.4);">
                                            Ir al Portal
                                        </a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #0b0d11; padding: 30px; text-align: center; border-top: 1px solid #282e39;">
                            <p style="margin: 0 0 10px 0; color: #666; font-size: 13px;">
                                ¿Necesitas ayuda? Contáctanos
                            </p>
                            <p style="margin: 0; color: #9da6b9; font-size: 14px;">
                                {{soporte_email}} · {{whatsapp}}
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`,
        text_body: `
¡Bienvenido a VERSA, {{nombre}}!

Gracias por registrarte. Ahora puedes:
- Reservar citas online
- Gestionar tus vehículos
- Ver el historial de servicios
- Pagar de forma segura

Accede a tu portal: {{portal_url}}

¿Necesitas ayuda? Contáctanos: {{soporte_email}}
`
    },
    {
        code: 'PASSWORD_RESET',
        name: 'Recuperación de Contraseña',
        subject: 'Recupera tu contraseña, {{nombre}}',
        variables_json: ['nombre', 'reset_url', 'exp_minutes'],
        html_body: `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Recuperar Contraseña</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0b0d11;">
    <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
            <td align="center" style="padding: 40px 0;">
                <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #111318; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.4);">
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #ff4400 0%, #ff6622 100%); padding: 40px 30px; text-align: center;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 800; letter-spacing: -1px;">VERSA</h1>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px 30px;">
                            <h2 style="margin: 0 0 20px 0; color: #ffffff; font-size: 24px; font-weight: 600;">
                                Hola {{nombre}} 🔐
                            </h2>
                            <p style="margin: 0 0 20px 0; color: #9da6b9; font-size: 16px; line-height: 1.6;">
                                Hemos recibido una solicitud para restablecer tu contraseña. Haz clic en el botón de abajo para crear una nueva.
                            </p>
                            
                            <!-- CTA Button -->
                            <table role="presentation" style="width: 100%; border-collapse: collapse;">
                                <tr>
                                    <td align="center" style="padding: 30px 0;">
                                        <a href="{{reset_url}}" style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #ff4400 0%, #ff6622 100%); color: #ffffff; text-decoration: none; font-weight: 700; font-size: 16px; border-radius: 12px; box-shadow: 0 4px 16px rgba(255,68,0,0.4);">
                                            Restablecer Contraseña
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Warning -->
                            <div style="background-color: #1a1d24; border-left: 4px solid #ff4400; padding: 16px 20px; border-radius: 8px; margin-top: 20px;">
                                <p style="margin: 0; color: #9da6b9; font-size: 14px;">
                                    ⚠️ Este enlace expira en <strong style="color: #ff4400;">{{exp_minutes}} minutos</strong>.
                                </p>
                            </div>
                            
                            <p style="margin: 30px 0 0 0; color: #666; font-size: 13px; line-height: 1.6;">
                                Si no solicitaste restablecer tu contraseña, puedes ignorar este email. Tu cuenta está segura.
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #0b0d11; padding: 30px; text-align: center; border-top: 1px solid #282e39;">
                            <p style="margin: 0; color: #666; font-size: 12px;">
                                Este es un email automático. Por favor no respondas a este mensaje.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`,
        text_body: `
Hola {{nombre}},

Hemos recibido una solicitud para restablecer tu contraseña.

Haz clic aquí para crear una nueva: {{reset_url}}

⚠️ Este enlace expira en {{exp_minutes}} minutos.

Si no solicitaste restablecer tu contraseña, puedes ignorar este email.

- Equipo VERSA
`
    }
];

// =====================================================
// AUTOMATIZACIONES POR DEFECTO
// =====================================================

const AUTOMATIONS = [
    {
        event_code: 'CLIENT_REGISTERED',
        template_code: 'WELCOME',
        enabled: true,
        delay_seconds: 0
    },
    {
        event_code: 'PASSWORD_RESET_REQUESTED',
        template_code: 'PASSWORD_RESET',
        enabled: true,
        delay_seconds: 0
    }
];

// =====================================================
// SEED FUNCTION
// =====================================================

async function seedEmailTemplates() {
    console.log('='.repeat(60));
    console.log('VERSA - Seed Email Templates & Automations');
    console.log('='.repeat(60));

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Insertar plantillas globales (id_tenant = NULL)
        console.log('\n📄 Insertando plantillas globales...');

        for (const template of TEMPLATES) {
            const result = await client.query(`
                INSERT INTO email_template (id_tenant, code, name, subject, html_body, text_body, variables_json)
                VALUES (NULL, $1, $2, $3, $4, $5, $6)
                ON CONFLICT (id_tenant, code) 
                DO UPDATE SET 
                    name = EXCLUDED.name,
                    subject = EXCLUDED.subject,
                    html_body = EXCLUDED.html_body,
                    text_body = EXCLUDED.text_body,
                    variables_json = EXCLUDED.variables_json,
                    updated_at = NOW()
                RETURNING id, code
            `, [
                template.code,
                template.name,
                template.subject,
                template.html_body,
                template.text_body,
                JSON.stringify(template.variables_json)
            ]);

            console.log(`  ✅ ${template.code} (ID: ${result.rows[0].id})`);
        }

        // 2. Obtener todos los tenants existentes
        const tenantsResult = await client.query(`
            SELECT DISTINCT id FROM tenant WHERE id IS NOT NULL
            UNION
            SELECT 1 WHERE NOT EXISTS (SELECT 1 FROM tenant LIMIT 1)
        `);

        const tenantIds = tenantsResult.rows.map(r => r.id);
        console.log(`\n📄 Configurando automatizaciones para ${tenantIds.length} tenant(s)...`);

        // 3. Insertar automatizaciones para cada tenant
        for (const tenantId of tenantIds) {
            for (const automation of AUTOMATIONS) {
                await client.query(`
                    INSERT INTO email_automation (id_tenant, event_code, template_code, enabled, delay_seconds)
                    VALUES ($1, $2, $3, $4, $5)
                    ON CONFLICT (id_tenant, event_code) 
                    DO UPDATE SET 
                        template_code = EXCLUDED.template_code,
                        updated_at = NOW()
                `, [
                    tenantId,
                    automation.event_code,
                    automation.template_code,
                    automation.enabled,
                    automation.delay_seconds
                ]);
            }
            console.log(`  ✅ Tenant ${tenantId}: ${AUTOMATIONS.length} automatizaciones`);
        }

        await client.query('COMMIT');

        console.log('\n' + '='.repeat(60));
        console.log('✅ Seed completado exitosamente');
        console.log('='.repeat(60));

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('\n❌ Error en seed:', error.message);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

seedEmailTemplates().catch(err => {
    console.error('Error fatal:', err);
    process.exit(1);
});
