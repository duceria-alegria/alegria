import { Logger } from '@vendure/core';
import type { EmailDetails, EmailTransportOptions } from '@vendure/email-plugin';
import { Resend } from 'resend';

const loggerCtx = 'ResendEmailSender';

/**
 * EmailSender de Vendure que envía todos los correos transaccionales
 * (confirmación de pedido, verificación de email, reset de password, etc.)
 * por la API de Resend.
 *
 * Se activa pasando una instancia a `EmailPlugin.init({ transport: { type: 'none' }, emailSender })`.
 * La API key se lee de `RESEND_API_KEY` o del argumento del constructor.
 */
export class ResendEmailSender {
    private resend: Resend;

    constructor(apiKey?: string) {
        const key = apiKey ?? process.env.RESEND_API_KEY;
        if (!key) {
            throw new Error(
                'ResendEmailSender: falta RESEND_API_KEY. Define RESEND_API_KEY en el entorno.',
            );
        }
        this.resend = new Resend(key);
    }

    async send(email: EmailDetails, _options: EmailTransportOptions): Promise<void> {
        const to = Array.isArray(email.recipient) ? email.recipient : [email.recipient];
        const cc = toArray(email.cc);
        const bcc = toArray(email.bcc);

        const { error } = await this.resend.emails.send({
            from: email.from,
            to,
            subject: email.subject,
            html: email.body,
            text: email.text,
            cc: cc.length > 0 ? cc : undefined,
            bcc: bcc.length > 0 ? bcc : undefined,
            replyTo: email.replyTo,
            attachments: (email.attachments ?? [])
                .filter(a => !!(a.filename && (a.content ?? a.path)))
                .map(a => ({
                    filename: a.filename as string,
                    content: a.content as any,
                    path: a.path as string | undefined,
                    contentType: (a as { contentType?: string }).contentType,
                })),
        });

        if (error) {
            Logger.error(`No se pudo enviar el correo "${email.subject}" a ${to.join(', ')}: ${error.message}`, loggerCtx);
            throw new Error(`Resend: ${error.message}`);
        }
    }
}

function toArray(value?: string | string[]): string[] {
    if (!value) {
        return [];
    }
    if (Array.isArray(value)) {
        return value.filter(Boolean);
    }
    return value
        .split(',')
        .map(v => v.trim())
        .filter(Boolean);
}
