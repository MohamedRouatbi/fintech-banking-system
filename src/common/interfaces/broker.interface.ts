export enum BrokerType {
  BINANCE = 'BINANCE',
  BYBIT = 'BYBIT',
  COINBASE = 'COINBASE',
  KRAKEN = 'KRAKEN',
}

export enum OrderType {
  MARKET = 'MARKET',
  LIMIT = 'LIMIT',
  STOP_LOSS = 'STOP_LOSS',
  STOP_LOSS_LIMIT = 'STOP_LOSS_LIMIT',
  TAKE_PROFIT = 'TAKE_PROFIT',
  TAKE_PROFIT_LIMIT = 'TAKE_PROFIT_LIMIT',
}

export enum OrderSide {
  BUY = 'BUY',
  SELL = 'SELL',
}

export enum OrderStatus {
  NEW = 'NEW',
  PARTIALLY_FILLED = 'PARTIALLY_FILLED',
  FILLED = 'FILLED',
  CANCELED = 'CANCELED',
  PENDING_CANCEL = 'PENDING_CANCEL',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
}

export enum TimeInForce {
  GTC = 'GTC', // Good Till Cancel
  IOC = 'IOC', // Immediate or Cancel
  FOK = 'FOK', // Fill or Kill
}

export interface BrokerCredentials {
  apiKey: string;
  secretKey: string;
  passphrase?: string; // For some exchanges like Coinbase
  testnet?: boolean;
}

export interface OrderRequest {
  symbol: string;
  side: OrderSide;
  type: OrderType;
  quantity: number;
  price?: number;
  timeInForce?: TimeInForce;
  clientOrderId?: string;
}

export interface Order {
  orderId: string;
  clientOrderId?: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  status: OrderStatus;
  quantity: number;
  executedQuantity: number;
  price?: number;
  averagePrice?: number;
  timeInForce?: TimeInForce;
  commission?: number;
  commissionAsset?: string;
  timestamp: number;
  updateTime?: number;
}

export interface Balance {
  asset: string;
  free: number;
  locked: number;
  total: number;
}

export interface Trade {
  id: string;
  orderId: string;
  symbol: string;
  side: OrderSide;
  price: number;
  quantity: number;
  commission: number;
  commissionAsset: string;
  timestamp: number;
  isBuyer: boolean;
  isMaker: boolean;
}

export interface BrokerConfig {
  type: BrokerType;
  credentials: BrokerCredentials;
  baseUrl?: string;
  wsUrl?: string;
  rateLimits?: {
    requestsPerSecond: number;
    requestsPerMinute: number;
  };
}

export interface IBrokerAdapter {
  /**
   * Initialize broker connection
   */
  initialize(): Promise<void>;

  /**
   * Place a new order
   */
  placeOrder(request: OrderRequest): Promise<Order>;

  /**
   * Cancel an existing order
   */
  cancelOrder(symbol: string, orderId: string): Promise<Order>;

  /**
   * Get order status
   */
  getOrder(symbol: string, orderId: string): Promise<Order>;

  /**
   * Get all open orders
   */
  getOpenOrders(symbol?: string): Promise<Order[]>;

  /**
   * Get account balances
   */
  getBalances(): Promise<Balance[]>;

  /**
   * Get trading history
   */
  getTrades(symbol: string, limit?: number): Promise<Trade[]>;

  /**
   * Get current price for a symbol
   */
  getPrice(symbol: string): Promise<number>;

  /**
   * Test connection
   */
  testConnection(): Promise<boolean>;
}
