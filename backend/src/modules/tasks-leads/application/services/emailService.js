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
 * Verifies SMTP connection on startup.
 */
async function verifySmtp() {
    const transport = getTransporter();
    if (!transport) {
        console.warn('[EmailService] Cannot verify: No transporter available.');
        return false;
    }
    try {
        await transport.verify();
        console.log('[EmailService] SMTP Connection Verified ✅');
        return true;
    } catch (error) {
        console.error('[EmailService] SMTP Connection Failed ❌', error);
        return false;
    }
}

/**
 * Sends a notification email for a new lead.
 * @param {Object} params
 * @param {string} params.subject - Custom subject part (e.g. "Nuevo lead WhatsApp - +34...")
 * @param {string} params.text - Plain text body
 * @param {string} params.html - HTML body
 * @param {string} [params.to] - Optional override for recipient
 */
async function sendLeadNotificationEmail({ subject, text, html, to }) {
    const transport = getTransporter();
    if (!transport) {
        console.warn('[EmailService] No transporter available. Skipping email.');
        return false;
    }

    const notifyTo = to || process.env.LEADS_NOTIFY_TO || process.env.SMTP_USER;
    if (!notifyTo) {
        console.warn('[EmailService] No recipient defined (LEADS_NOTIFY_TO). Skipping email.');
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

    console.log(`[EmailService] Attempting to send email to: ${notifyTo} | Subject: ${finalSubject}`);

    try {
        const info = await transport.sendMail(mailOptions);
        console.log(`[EmailService] Email sent OK. MessageID: ${info.messageId}`);
        return true;
    } catch (error) {
        console.error('[EmailService] Email send FAILED:', error);
        return false;
    }
}

module.exports = {
    sendLeadNotificationEmail,
    verifySmtp
};
