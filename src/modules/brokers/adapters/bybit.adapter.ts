import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import {
  IBrokerAdapter,
  BrokerCredentials,
  OrderRequest,
  Order,
  Balance,
  Trade,
  OrderStatus,
  OrderSide,
  OrderType,
} from '../../../common/interfaces/broker.interface';
import { CryptoUtil } from '../../../common/utils/crypto.util';
import { RateLimiter } from '../../../common/utils/rate-limiter.util';
import { RetryUtil, RetryConfig } from '../../../common/utils/retry.util';

/**
 * Bybit Exchange Adapter
 * Implements Bybit API integration with HMAC SHA256 signing
 */
@Injectable()
export class BybitAdapter implements IBrokerAdapter {
  private readonly logger = new Logger(BybitAdapter.name);
  private httpClient: AxiosInstance;
  private credentials: BrokerCredentials;
  private rateLimiter: RateLimiter;
  private retryConfig: RetryConfig;

  private readonly BASE_URL = 'https://api.bybit.com';
  private readonly TESTNET_URL = 'https://api-testnet.bybit.com';

  constructor(
    credentials: BrokerCredentials,
    rateLimiter: RateLimiter,
  ) {
    this.credentials = credentials;
    this.rateLimiter = rateLimiter;
    this.retryConfig = RetryUtil.defaultConfig();

    const baseURL = credentials.testnet ? this.TESTNET_URL : this.BASE_URL;

    this.httpClient = axios.create({
      baseURL,
      timeout: 10000,
    });
  }

  async initialize(): Promise<void> {
    try {
      await this.testConnection();
      this.logger.log('Bybit adapter initialized successfully');
    } catch (error) {
      this.logger.error(`Failed to initialize Bybit adapter: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate signature for Bybit API requests
   */
  private generateSignature(params: Record<string, any>): string {
    const timestamp = CryptoUtil.getTimestamp();
    const sortedParams = Object.keys(params)
      .sort()
      .reduce((acc, key) => {
        acc[key] = params[key];
        return acc;
      }, {} as Record<string, any>);

    sortedParams.api_key = this.credentials.apiKey;
    sortedParams.timestamp = timestamp;

    const paramString = CryptoUtil.buildQueryString(sortedParams);
    return CryptoUtil.hmacSha256(paramString, this.credentials.secretKey);
  }

  /**
   * Make signed request to Bybit API
   */
  private async signedRequest<T>(
    method: 'GET' | 'POST',
    endpoint: string,
    params: Record<string, any> = {},
  ): Promise<T> {
    // Check rate limit
    const rateLimitCheck = await this.rateLimiter.checkRateLimit('bybit', {
      requestsPerSecond: 10,
      requestsPerMinute: 600,
    });

    if (!rateLimitCheck.allowed) {
      throw new BadRequestException(
        `Rate limit exceeded. Retry after ${rateLimitCheck.retryAfter}ms`,
      );
    }

    return RetryUtil.executeWithRetry(
      async () => {
        const timestamp = CryptoUtil.getTimestamp();
        const paramsWithAuth = {
          ...params,
          api_key: this.credentials.apiKey,
          timestamp,
        };

        // Generate signature
        const signature = this.generateSignature(params);
        paramsWithAuth.sign = signature;

        // Make request
        const config: any = {
          method,
          url: endpoint,
          headers: {
            'Content-Type': 'application/json',
          },
        };

        if (method === 'GET') {
          config.params = paramsWithAuth;
        } else {
          config.data = paramsWithAuth;
        }

        const response = await this.httpClient.request(config);

        if (response.data.ret_code !== 0) {
          throw new BadRequestException(
            `Bybit API error: ${response.data.ret_msg}`,
          );
        }

        return response.data.result;
      },
      this.retryConfig,
      `Bybit ${method} ${endpoint}`,
    );
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.httpClient.get('/v2/public/time');
      return true;
    } catch (error) {
      this.logger.error(`Bybit connection test failed: ${error.message}`);
      return false;
    }
  }

  async placeOrder(request: OrderRequest): Promise<Order> {
    this.logger.log(`Placing ${request.side} order for ${request.symbol}`);

    const params: any = {
      symbol: request.symbol,
      side: request.side,
      order_type: this.mapOrderType(request.type),
      qty: request.quantity,
      time_in_force: request.timeInForce || 'GoodTillCancel',
    };

    if (request.price) {
      params.price = request.price;
    }

    if (request.clientOrderId) {
      params.order_link_id = request.clientOrderId;
    }

    const response = await this.signedRequest<any>(
      'POST',
      '/v2/private/order/create',
      params,
    );

    return this.mapBybitOrderToOrder(response);
  }

  async cancelOrder(symbol: string, orderId: string): Promise<Order> {
    this.logger.log(`Canceling order ${orderId} for ${symbol}`);

    const response = await this.signedRequest<any>(
      'POST',
      '/v2/private/order/cancel',
      {
        symbol,
        order_id: orderId,
      },
    );

    return this.mapBybitOrderToOrder(response);
  }

  async getOrder(symbol: string, orderId: string): Promise<Order> {
    const response = await this.signedRequest<any>(
      'GET',
      '/v2/private/order',
      {
        symbol,
        order_id: orderId,
      },
    );

    return this.mapBybitOrderToOrder(response);
  }

  async getOpenOrders(symbol?: string): Promise<Order[]> {
    const params = symbol ? { symbol } : {};
    const response = await this.signedRequest<any>(
      'GET',
      '/v2/private/order/list',
      params,
    );

    return response.data.map((order: any) => this.mapBybitOrderToOrder(order));
  }

  async getBalances(): Promise<Balance[]> {
    const response = await this.signedRequest<any>(
      'GET',
      '/v2/private/wallet/balance',
      {},
    );

    const balances: Balance[] = [];

    for (const [asset, balance] of Object.entries(response)) {
      const balanceData = balance as any;
      balances.push({
        asset,
        free: parseFloat(balanceData.available_balance),
        locked: parseFloat(balanceData.used_margin || 0),
        total: parseFloat(balanceData.wallet_balance),
      });
    }

    return balances.filter((b) => b.total > 0);
  }

  async getTrades(symbol: string, limit: number = 100): Promise<Trade[]> {
    const response = await this.signedRequest<any>(
      'GET',
      '/v2/private/execution/list',
      {
        symbol,
        limit,
      },
    );

    return response.trade_list.map((trade: any) => ({
      id: trade.exec_id,
      orderId: trade.order_id,
      symbol: trade.symbol,
      side: trade.side === 'Buy' ? OrderSide.BUY : OrderSide.SELL,
      price: parseFloat(trade.price),
      quantity: parseFloat(trade.exec_qty),
      commission: parseFloat(trade.exec_fee),
      commissionAsset: trade.fee_currency || symbol.split('/')[1],
      timestamp: new Date(trade.trade_time).getTime(),
      isBuyer: trade.side === 'Buy',
      isMaker: trade.exec_type === 'Maker',
    }));
  }

  async getPrice(symbol: string): Promise<number> {
    try {
      const response = await this.httpClient.get('/v2/public/tickers', {
        params: { symbol },
      });

      if (response.data.ret_code !== 0) {
        throw new Error(response.data.ret_msg);
      }

      return parseFloat(response.data.result[0].last_price);
    } catch (error) {
      throw new BadRequestException(`Failed to get price for ${symbol}: ${error.message}`);
    }
  }

  /**
   * Map standard OrderType to Bybit order type
   */
  private mapOrderType(type: OrderType): string {
    const typeMap: Record<OrderType, string> = {
      [OrderType.MARKET]: 'Market',
      [OrderType.LIMIT]: 'Limit',
      [OrderType.STOP_LOSS]: 'StopLoss',
      [OrderType.STOP_LOSS_LIMIT]: 'StopLossLimit',
      [OrderType.TAKE_PROFIT]: 'TakeProfit',
      [OrderType.TAKE_PROFIT_LIMIT]: 'TakeProfitLimit',
    };

    return typeMap[type] || 'Limit';
  }

  /**
   * Map Bybit order response to standard Order interface
   */
  private mapBybitOrderToOrder(bybitOrder: any): Order {
    return {
      orderId: bybitOrder.order_id,
      clientOrderId: bybitOrder.order_link_id,
      symbol: bybitOrder.symbol,
      side: bybitOrder.side === 'Buy' ? OrderSide.BUY : OrderSide.SELL,
      type: this.reverseMapOrderType(bybitOrder.order_type),
      status: this.mapBybitStatus(bybitOrder.order_status),
      quantity: parseFloat(bybitOrder.qty),
      executedQuantity: parseFloat(bybitOrder.cum_exec_qty || 0),
      price: bybitOrder.price ? parseFloat(bybitOrder.price) : undefined,
      averagePrice: bybitOrder.cum_exec_value && bybitOrder.cum_exec_qty
        ? parseFloat(bybitOrder.cum_exec_value) / parseFloat(bybitOrder.cum_exec_qty)
        : undefined,
      timeInForce: bybitOrder.time_in_force,
      timestamp: new Date(bybitOrder.created_time).getTime(),
      updateTime: new Date(bybitOrder.updated_time).getTime(),
    };
  }

  /**
   * Reverse map Bybit order type to standard OrderType
   */
  private reverseMapOrderType(bybitType: string): OrderType {
    const typeMap: Record<string, OrderType> = {
      'Market': OrderType.MARKET,
      'Limit': OrderType.LIMIT,
      'StopLoss': OrderType.STOP_LOSS,
      'StopLossLimit': OrderType.STOP_LOSS_LIMIT,
      'TakeProfit': OrderType.TAKE_PROFIT,
      'TakeProfitLimit': OrderType.TAKE_PROFIT_LIMIT,
    };

    return typeMap[bybitType] || OrderType.LIMIT;
  }

  /**
   * Map Bybit order status to standard OrderStatus
   */
  private mapBybitStatus(bybitStatus: string): OrderStatus {
    const statusMap: Record<string, OrderStatus> = {
      'Created': OrderStatus.NEW,
      'New': OrderStatus.NEW,
      'PartiallyFilled': OrderStatus.PARTIALLY_FILLED,
      'Filled': OrderStatus.FILLED,
      'Cancelled': OrderStatus.CANCELED,
      'PendingCancel': OrderStatus.PENDING_CANCEL,
      'Rejected': OrderStatus.REJECTED,
      'Untriggered': OrderStatus.NEW,
      'Deactivated': OrderStatus.CANCELED,
      'Triggered': OrderStatus.NEW,
    };

    return statusMap[bybitStatus] || OrderStatus.REJECTED;
  }
}
