const nodemailer = require('nodemailer');

const isProd = process.env.NODE_ENV === 'production';

let transporter = null;

function getTransporter() {
    if (transporter) return transporter;

    if (process.env.EMAIL_PROVIDER === 'smtp') {
        const port = parseInt(process.env.SMTP_PORT || '587');
        transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: port,
            secure: port === 465, // true for 465, false for other ports
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });
    } else {
        console.warn('[EmailService] Provider not configured or not SMTP. Email sending disabled.');
    }
    return transporter;
}

/**
 * Sends a notification email for a new lead.
 * @param {Object} params
 * @param {string} params.subject - Custom subject part (e.g. "Nuevo lead WhatsApp - +34...")
 * @param {string} params.text - Plain text body
 * @param {string} params.html - HTML body
 */
async function sendLeadNotificationEmail({ subject, text, html }) {
    const transport = getTransporter();
    if (!transport) {
        console.warn('[EmailService] No transporter available. Skipping email.');
        return false;
    }

    const notifyTo = process.env.LEADS_NOTIFY_TO;
    if (!notifyTo) {
        console.warn('[EmailService] LEADS_NOTIFY_TO not defined. Skipping email.');
        return false;
    }

    const prefix = isProd ? '🟠' : '[DEV] 🟠';
    const finalSubject = `${prefix} ${subject}`;

    const mailOptions = {
        from: process.env.LEADS_NOTIFY_FROM || '"Versa Leads" <noreply@versa-app.com>',
        to: notifyTo,
        replyTo: process.env.LEADS_NOTIFY_REPLY_TO,
        subject: finalSubject,
        text,
        html
    };

    try {
        const info = await transport.sendMail(mailOptions);
        console.log(`[EmailService] Email sent: ${info.messageId}`);
        return true;
    } catch (error) {
        console.error('[EmailService] Error sending email:', error);
        return false;
    }
}

module.exports = {
    sendLeadNotificationEmail
};
