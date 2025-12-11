import { Injectable, Logger } from '@nestjs/common';

export enum AuditAction {
  USER_REGISTERED = 'USER_REGISTERED',
  USER_LOGIN = 'USER_LOGIN',
  USER_LOGOUT = 'USER_LOGOUT',
  USER_UPDATED = 'USER_UPDATED',
  USER_DELETED = 'USER_DELETED',
  TRANSACTION_CREATED = 'TRANSACTION_CREATED',
  TRANSACTION_UPDATED = 'TRANSACTION_UPDATED',
  WALLET_CREATED = 'WALLET_CREATED',
  WALLET_BALANCE_UPDATED = 'WALLET_BALANCE_UPDATED',
  WALLET_STATUS_CHANGED = 'WALLET_STATUS_CHANGED',
  FIREBLOCKS_VAULT_CREATED = 'FIREBLOCKS_VAULT_CREATED',
  FIREBLOCKS_TRANSACTION_CREATED = 'FIREBLOCKS_TRANSACTION_CREATED',
  BROKER_ORDER_EXECUTED = 'BROKER_ORDER_EXECUTED',
  UNAUTHORIZED_ACCESS_ATTEMPT = 'UNAUTHORIZED_ACCESS_ATTEMPT',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
}

export interface AuditLogEntry {
  timestamp: Date;
  action: AuditAction;
  userId?: number;
  userEmail?: string;
  resourceId?: string | number;
  resourceType?: string;
  details?: any;
  ipAddress?: string;
  userAgent?: string;
  status: 'SUCCESS' | 'FAILURE' | 'PENDING';
  errorMessage?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger('AuditTrail');

  /**
   * Log an audit event
   */
  log(entry: Partial<AuditLogEntry> & { action: AuditAction }) {
    const auditEntry: AuditLogEntry = {
      timestamp: new Date(),
      status: 'SUCCESS',
      ...entry,
    };

    // In production, this should write to a separate audit log database/file
    this.logger.log(JSON.stringify(auditEntry, null, 2));

    // TODO: Implement persistent storage for audit logs
    // - Write to dedicated audit database
    // - Send to log aggregation service (e.g., ELK, Datadog)
    // - Write to immutable storage for compliance
  }

  /**
   * Log successful action
   */
  logSuccess(
    action: AuditAction,
    userId?: number,
    details?: any,
    resourceId?: string | number,
  ) {
    this.log({
      action,
      userId,
      details,
      resourceId,
      status: 'SUCCESS',
    });
  }

  /**
   * Log failed action
   */
  logFailure(
    action: AuditAction,
    userId?: number,
    errorMessage?: string,
    details?: any,
  ) {
    this.log({
      action,
      userId,
      errorMessage,
      details,
      status: 'FAILURE',
    });
  }

  /**
   * Log security event
   */
  logSecurityEvent(
    action: AuditAction,
    details: any,
    ipAddress?: string,
    userAgent?: string,
  ) {
    this.log({
      action,
      details,
      ipAddress,
      userAgent,
      status: 'FAILURE',
    });
  }

  /**
   * Log critical financial transaction
   */
  logFinancialTransaction(
    action: AuditAction,
    userId: number,
    transactionId: string | number,
    amount: number,
    currency: string,
    additionalDetails?: any,
  ) {
    this.log({
      action,
      userId,
      resourceId: transactionId,
      resourceType: 'TRANSACTION',
      details: {
        amount,
        currency,
        ...additionalDetails,
      },
      status: 'SUCCESS',
    });
  }
}
