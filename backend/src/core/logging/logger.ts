import { getContext } from '../http/middlewares/tenant-context';

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

const log = (level: LogLevel, message: string, meta?: any) => {
    const ctx = getContext();
    const timestamp = new Date().toISOString();

    const logEntry = {
        timestamp,
        level: level.toUpperCase(),
        requestId: ctx.requestId,
        tenantId: ctx.tenantId,
        userId: ctx.user?.id,
        message,
        ...meta
    };

    // En producción se podría enviar a Datadog, CloudWatch, etc.
    console.log(JSON.stringify(logEntry));
};

export const logger = {
    info: (msg: string, meta?: any) => log('info', msg, meta),
    warn: (msg: string, meta?: any) => log('warn', msg, meta),
    error: (msg: string, meta?: any) => log('error', msg, meta),
    debug: (msg: string, meta?: any) => log('debug', msg, meta),
};
