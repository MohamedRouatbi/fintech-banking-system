import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class AuditLogMiddleware implements NestMiddleware {
  private readonly logger = new Logger('AuditLog');

  use(req: Request, res: Response, next: NextFunction) {
    const { method, originalUrl, ip, headers } = req;
    const userAgent = headers['user-agent'] || '';
    const user = (req as any).user;

    const startTime = Date.now();

    res.on('finish', () => {
      const { statusCode } = res;
      const duration = Date.now() - startTime;

      const logData = {
        timestamp: new Date().toISOString(),
        method,
        url: originalUrl,
        statusCode,
        duration: `${duration}ms`,
        ip,
        userAgent,
        userId: user?.sub || 'anonymous',
        userEmail: user?.email || 'anonymous',
      };

      // Log based on status code
      if (statusCode >= 500) {
        this.logger.error(JSON.stringify(logData));
      } else if (statusCode >= 400) {
        this.logger.warn(JSON.stringify(logData));
      } else {
        this.logger.log(JSON.stringify(logData));
      }
    });

    next();
  }
}
