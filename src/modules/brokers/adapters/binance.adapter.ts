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
 * Binance Exchange Adapter
 * Implements Binance API integration with HMAC SHA256 signing
 */
@Injectable()
export class BinanceAdapter implements IBrokerAdapter {
  private readonly logger = new Logger(BinanceAdapter.name);
  private httpClient: AxiosInstance;
  private credentials: BrokerCredentials;
  private rateLimiter: RateLimiter;
  private retryConfig: RetryConfig;

  private readonly BASE_URL = 'https://api.binance.com';
  private readonly TESTNET_URL = 'https://testnet.binance.vision';

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
      headers: {
        'X-MBX-APIKEY': credentials.apiKey,
      },
    });
  }

  async initialize(): Promise<void> {
    try {
      await this.testConnection();
      this.logger.log('Binance adapter initialized successfully');
    } catch (error) {
      this.logger.error(`Failed to initialize Binance adapter: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate signature for Binance API requests
   */
  private generateSignature(queryString: string): string {
    return CryptoUtil.hmacSha256(queryString, this.credentials.secretKey);
  }

  /**
   * Make signed request to Binance API
   */
  private async signedRequest<T>(
    method: 'GET' | 'POST' | 'DELETE',
    endpoint: string,
    params: Record<string, any> = {},
  ): Promise<T> {
    // Check rate limit
    const rateLimitCheck = await this.rateLimiter.checkRateLimit('binance', {
      requestsPerSecond: 10,
      requestsPerMinute: 1200,
    });

    if (!rateLimitCheck.allowed) {
      throw new BadRequestException(
        `Rate limit exceeded. Retry after ${rateLimitCheck.retryAfter}ms`,
      );
    }

    return RetryUtil.executeWithRetry(
      async () => {
        // Add timestamp
        const timestamp = CryptoUtil.getTimestamp();
        const paramsWithTimestamp = { ...params, timestamp };

        // Build query string
        const queryString = CryptoUtil.buildQueryString(paramsWithTimestamp);

        // Generate signature
        const signature = this.generateSignature(queryString);

        // Make request
        const config: any = {
          method,
          url: endpoint,
        };

        if (method === 'GET' || method === 'DELETE') {
          config.params = { ...paramsWithTimestamp, signature };
        } else {
          config.data = { ...paramsWithTimestamp, signature };
        }

        const response = await this.httpClient.request(config);
        return response.data;
      },
      this.retryConfig,
      `Binance ${method} ${endpoint}`,
    );
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.httpClient.get('/api/v3/ping');
      return true;
    } catch (error) {
      this.logger.error(`Binance connection test failed: ${error.message}`);
      return false;
    }
  }

  async placeOrder(request: OrderRequest): Promise<Order> {
    this.logger.log(`Placing ${request.side} order for ${request.symbol}`);

    const params: any = {
      symbol: request.symbol,
      side: request.side,
      type: request.type,
      quantity: request.quantity,
    };

    if (request.price) {
      params.price = request.price;
    }

    if (request.timeInForce) {
      params.timeInForce = request.timeInForce;
    }

    if (request.clientOrderId) {
      params.newClientOrderId = request.clientOrderId;
    }

    const response = await this.signedRequest<any>('POST', '/api/v3/order', params);

    return this.mapBinanceOrderToOrder(response);
  }

  async cancelOrder(symbol: string, orderId: string): Promise<Order> {
    this.logger.log(`Canceling order ${orderId} for ${symbol}`);

    const response = await this.signedRequest<any>('DELETE', '/api/v3/order', {
      symbol,
      orderId,
    });

    return this.mapBinanceOrderToOrder(response);
  }

  async getOrder(symbol: string, orderId: string): Promise<Order> {
    const response = await this.signedRequest<any>('GET', '/api/v3/order', {
      symbol,
      orderId,
    });

    return this.mapBinanceOrderToOrder(response);
  }

  async getOpenOrders(symbol?: string): Promise<Order[]> {
    const params = symbol ? { symbol } : {};
    const response = await this.signedRequest<any[]>('GET', '/api/v3/openOrders', params);

    return response.map((order) => this.mapBinanceOrderToOrder(order));
  }

  async getBalances(): Promise<Balance[]> {
    const response = await this.signedRequest<any>('GET', '/api/v3/account', {});

    return response.balances
      .filter((balance: any) => parseFloat(balance.free) > 0 || parseFloat(balance.locked) > 0)
      .map((balance: any) => ({
        asset: balance.asset,
        free: parseFloat(balance.free),
        locked: parseFloat(balance.locked),
        total: parseFloat(balance.free) + parseFloat(balance.locked),
      }));
  }

  async getTrades(symbol: string, limit: number = 100): Promise<Trade[]> {
    const response = await this.signedRequest<any[]>('GET', '/api/v3/myTrades', {
      symbol,
      limit,
    });

    return response.map((trade) => ({
      id: trade.id.toString(),
      orderId: trade.orderId.toString(),
      symbol: trade.symbol,
      side: trade.isBuyer ? OrderSide.BUY : OrderSide.SELL,
      price: parseFloat(trade.price),
      quantity: parseFloat(trade.qty),
      commission: parseFloat(trade.commission),
      commissionAsset: trade.commissionAsset,
      timestamp: trade.time,
      isBuyer: trade.isBuyer,
      isMaker: trade.isMaker,
    }));
  }

  async getPrice(symbol: string): Promise<number> {
    try {
      const response = await this.httpClient.get('/api/v3/ticker/price', {
        params: { symbol },
      });
      return parseFloat(response.data.price);
    } catch (error) {
      throw new BadRequestException(`Failed to get price for ${symbol}: ${error.message}`);
    }
  }

  /**
   * Map Binance order response to standard Order interface
   */
  private mapBinanceOrderToOrder(binanceOrder: any): Order {
    return {
      orderId: binanceOrder.orderId.toString(),
      clientOrderId: binanceOrder.clientOrderId,
      symbol: binanceOrder.symbol,
      side: binanceOrder.side as OrderSide,
      type: binanceOrder.type as OrderType,
      status: this.mapBinanceStatus(binanceOrder.status),
      quantity: parseFloat(binanceOrder.origQty),
      executedQuantity: parseFloat(binanceOrder.executedQty),
      price: binanceOrder.price ? parseFloat(binanceOrder.price) : undefined,
      averagePrice: binanceOrder.avgPrice ? parseFloat(binanceOrder.avgPrice) : undefined,
      timeInForce: binanceOrder.timeInForce,
      timestamp: binanceOrder.transactTime || binanceOrder.time,
      updateTime: binanceOrder.updateTime,
    };
  }

  /**
   * Map Binance order status to standard OrderStatus
   */
  private mapBinanceStatus(binanceStatus: string): OrderStatus {
    const statusMap: Record<string, OrderStatus> = {
      'NEW': OrderStatus.NEW,
      'PARTIALLY_FILLED': OrderStatus.PARTIALLY_FILLED,
      'FILLED': OrderStatus.FILLED,
      'CANCELED': OrderStatus.CANCELED,
      'PENDING_CANCEL': OrderStatus.PENDING_CANCEL,
      'REJECTED': OrderStatus.REJECTED,
      'EXPIRED': OrderStatus.EXPIRED,
    };

    return statusMap[binanceStatus] || OrderStatus.REJECTED;
  }
}
