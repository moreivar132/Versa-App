const nodemailer = require('nodemailer');
const { Resend } = require('resend');

const isProd = process.env.NODE_ENV === 'production';

// Resend client (preferred)
let resendClient = null;

// SMTP transporter (fallback)
let smtpTransporter = null;

/**
 * Initialize Resend client if API key is available
 */
function getResendClient() {
    if (resendClient) return resendClient;

    if (process.env.RESEND_API_KEY) {
        resendClient = new Resend(process.env.RESEND_API_KEY);
        console.log('[EmailService] Resend client initialized ✅');
    }
    return resendClient;
}

/**
 * Initialize SMTP transporter (fallback)
 */
function getSmtpTransporter() {
    if (smtpTransporter) return smtpTransporter;

    if (process.env.EMAIL_PROVIDER === 'smtp' && process.env.SMTP_HOST) {
        const port = parseInt(process.env.SMTP_PORT || '587');
        smtpTransporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: port,
            secure: port === 465,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
            tls: { rejectUnauthorized: false },
            connectionTimeout: 10000,
            greetingTimeout: 5000,
            socketTimeout: 20000,
        });
    }
    return smtpTransporter;
}

/**
 * Verifies email service availability on startup.
 */
async function verifySmtp() {
    // Check Resend first
    const resend = getResendClient();
    if (resend) {
        console.log('[EmailService] Using Resend API ✅ (no SMTP verification needed)');
        return true;
    }

    // Fallback to SMTP
    const transport = getSmtpTransporter();
    if (!transport) {
        console.warn('[EmailService] No email provider configured.');
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
 * Uses Resend API if available, falls back to SMTP.
 */
async function sendLeadNotificationEmail({ subject, text, html, to }) {
    const notifyTo = to || process.env.LEADS_NOTIFY_TO || process.env.SMTP_USER || 'info@goversa.es';
    const fromAddress = process.env.LEADS_NOTIFY_FROM || 'Versa Leads <onboarding@resend.dev>';

    const prefix = isProd ? '🟠' : '[DEV] 🟠';
    const finalSubject = `${prefix} ${subject}`;

    console.log(`[EmailService] Sending email to: ${notifyTo} | Subject: ${finalSubject}`);

    // Try Resend first (preferred)
    const resend = getResendClient();
    if (resend) {
        try {
            const { data, error } = await resend.emails.send({
                from: fromAddress,
                to: [notifyTo],
                subject: finalSubject,
                text: text,
                html: html,
            });

            if (error) {
                console.error('[EmailService] Resend error:', error);
                return false;
            }

            console.log(`[EmailService] Email sent via Resend ✅ ID: ${data.id}`);
            return true;
        } catch (err) {
            console.error('[EmailService] Resend exception:', err.message);
            return false;
        }
    }

    // Fallback to SMTP
    const transport = getSmtpTransporter();
    if (!transport) {
        console.warn('[EmailService] No email provider available. Skipping.');
        return false;
    }

    try {
        const info = await transport.sendMail({
            from: fromAddress,
            to: notifyTo,
            replyTo: process.env.LEADS_NOTIFY_REPLY_TO,
            subject: finalSubject,
            text,
            html
        });
        console.log(`[EmailService] Email sent via SMTP ✅ MessageID: ${info.messageId}`);
        return true;
    } catch (error) {
        console.error('[EmailService] SMTP send FAILED:', error.message);
        return false;
    }
}

module.exports = {
    sendLeadNotificationEmail,
    verifySmtp
};
