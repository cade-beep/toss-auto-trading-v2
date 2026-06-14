import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { TradingService } from './interface';
import { OrderRequest, OrderResponse, Position, AccountBalance, OrderV2, OrderSide, OrderType, OrderStatusV2 } from '../../types/trading';
import { RateLimiter, rateLimiter as defaultRateLimiter } from './rate-limiter';
import { CircuitBreaker, circuitBreaker as defaultCircuitBreaker } from './circuit-breaker';
import { RiskEngine } from '../risk/risk-engine';
import { TradeIntent } from '../../types/strategy';

export class TossTradingService implements TradingService {
  private supabase: SupabaseClient;
  private riskEngine: RiskEngine;
  private rateLimiter: RateLimiter;
  private circuitBreaker: CircuitBreaker;

  constructor(
    supabase: SupabaseClient,
    riskEngine?: RiskEngine,
    rateLimiter?: RateLimiter,
    circuitBreaker?: CircuitBreaker
  ) {
    this.supabase = supabase;
    this.riskEngine = riskEngine || new RiskEngine(supabase);
    this.rateLimiter = rateLimiter || defaultRateLimiter;
    this.circuitBreaker = circuitBreaker || defaultCircuitBreaker;
  }

  private async getAuthToken(): Promise<string> {
    const { data: { session }, error } = await this.supabase.auth.getSession();
    if (error || !session) {
      throw new Error('Unauthorized: Session not found.');
    }
    return session.access_token;
  }

  private async callProxy(method: 'GET' | 'POST' | 'DELETE', path: string, body?: any): Promise<any> {
    // 1. Enforce Circuit Breaker check
    await this.circuitBreaker.checkCall();

    try {
      // Determine base URL dynamically (assumes protocol and host inside request context, falls back to relative/local)
      let baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

      if (!baseUrl) {
        baseUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || '';
      }

      if (!baseUrl) {
        const isLiveMode = process.env.NEXT_PUBLIC_TRADING_MODE === 'LIVE' || process.env.TRADING_MODE === 'LIVE';
        if (isLiveMode) {
          throw new Error('ConfigurationError: APP_URL is required in LIVE mode but not defined.');
        }
        // Fallback for simulation / development
        baseUrl = 'http://127.0.0.1:3000';
      }

      const token = await this.getAuthToken();
      const { data: { user } } = await this.supabase.auth.getUser();
      const userId = user?.id || 'unknown';

      const response = await fetch(`${baseUrl}/api/toss-proxy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'x-worker-user-id': userId
        },
        body: JSON.stringify({ method, path, body })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Proxy returned HTTP ${response.status}`);
      }

      const data = await response.json();
      await this.circuitBreaker.recordSuccess();
      return data;
    } catch (err: any) {
      await this.circuitBreaker.recordFailure();
      throw err;
    }
  }

  async placeOrder(request: OrderRequest, clientOrderId?: string): Promise<OrderResponse> {
    const { data: { user } } = await this.supabase.auth.getUser();
    const userId = user?.id || 'unknown';

    // 2. Enforce Rate Limiter (e.g. Max 10 orders per 10 seconds)
    const isAllowed = await this.rateLimiter.isAllowed(`user:${userId}:place-order`, 10, 10);
    if (!isAllowed) {
      return { success: false, error: 'RateLimitExceededError: Order placement rate limit exceeded.' };
    }

    const cid = clientOrderId || `ORD-TOSS-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    // Get market price if missing or if it's a MARKET order
    let intentPrice = request.price;
    if (!intentPrice || request.type === 'MARKET') {
      intentPrice = await this.getMarketPrice(request.symbol);
    }

    const intent: TradeIntent = {
      symbol: request.symbol,
      side: request.side,
      type: request.type,
      qty: request.qty,
      price: intentPrice,
      clientOrderId: cid
    };

    // 1. Enforce Risk Engine Validation BEFORE order persistence or broker submission
    const validation = await this.riskEngine.validate(intent, userId);
    if (!validation.isValid) {
      // Persist directly to DB as REJECTED to maintain auditability of risk failures
      const { error: rejectInsertError } = await this.supabase
        .from('orders')
        .insert({
          client_order_id: cid,
          user_id: userId,
          symbol: request.symbol,
          side: request.side,
          type: request.type,
          qty: request.qty,
          price: intentPrice || 0,
          status: 'REJECTED',
          filled_qty: 0,
          avg_fill_price: 0,
          trading_mode: 'LIVE',
          last_sequence_number: 0,
          error_message: validation.rejectionReason || 'Rejected by Risk Engine'
        });

      if (rejectInsertError) {
        console.error(`[TossTradingService] Failed to insert rejected order: ${rejectInsertError.message}`);
      }

      return { success: false, error: validation.rejectionReason || 'Rejected by Risk Engine' };
    }

    // Persist initial order record in PENDING state (Broker Mapping constraint)
    const { error: insertError } = await this.supabase
      .from('orders')
      .insert({
        client_order_id: cid,
        user_id: userId,
        symbol: request.symbol,
        side: request.side,
        type: request.type,
        qty: request.qty,
        price: intentPrice || 0,
        status: 'PENDING',
        filled_qty: 0,
        avg_fill_price: 0,
        trading_mode: 'LIVE',
        last_sequence_number: 0
      });

    if (insertError) {
      return { success: false, error: `Failed to insert initial order: ${insertError.message}` };
    }

    try {
      const data = await this.callProxy('POST', '/api/v1/orders', {
        clientOrderId: cid,
        symbol: request.symbol,
        side: request.side,
        orderType: request.type,
        quantity: String(request.qty),
        price: request.type === 'LIMIT' && request.price !== undefined ? String(request.price) : undefined,
        timeInForce: 'DAY'
      });

      const brokerOrderId = data?.result?.orderId;
      if (brokerOrderId) {
        await this.supabase
          .from('orders')
          .update({
            broker_order_id: brokerOrderId,
            status: 'SUBMITTED',
            updated_at: new Date().toISOString()
          })
          .eq('client_order_id', cid);
      }

      return {
        success: true,
        order: {
          id: cid,
          symbol: request.symbol,
          side: request.side,
          type: request.type,
          qty: request.qty,
          price: request.price,
          status: 'SUBMITTED',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      };
    } catch (err: any) {
      // Mark as REJECTED in database to ensure auditability of network/broker failures
      await this.supabase.rpc('update_order_status_v2', {
        p_client_order_id: cid,
        p_status: 'REJECTED',
        p_error_message: err.message || 'Broker connection failed.'
      });

      return { success: false, error: err.message || 'Broker connection failed.' };
    }
  }

  async cancelOrder(clientOrderId: string): Promise<boolean> {
    const { data: { user } } = await this.supabase.auth.getUser();
    const userId = user?.id || 'unknown';

    // Rate limiting (Max 10 cancels per 10 seconds)
    const isAllowed = await this.rateLimiter.isAllowed(`user:${userId}:cancel-order`, 10, 10);
    if (!isAllowed) {
      console.warn('[TossTradingService] Cancel rate limit exceeded.');
      return false;
    }

    try {
      const { data: orderData, error: dbError } = await this.supabase
        .from('orders')
        .select('broker_order_id')
        .eq('client_order_id', clientOrderId)
        .single();

      if (dbError || !orderData || !orderData.broker_order_id) {
        console.error(`[TossTradingService] Cancel failed: broker_order_id not found for ${clientOrderId}`);
        return false;
      }

      const brokerOrderId = orderData.broker_order_id;
      await this.callProxy('DELETE', `/api/v1/orders/${brokerOrderId}`);
      return true;
    } catch (err: any) {
      console.error(`[TossTradingService] Cancel failed for ${clientOrderId}:`, err.message);
      return false;
    }
  }

  async getAccountBalance(): Promise<AccountBalance> {
    try {
      const data = await this.callProxy('GET', '/api/v1/buying-power?currency=KRW');
      const cash = Number(data?.result?.cashBuyingPower) || 0;
      return {
        cashBalance: cash,
        purchasingPower: cash,
        totalPortfolioValue: cash,
        unrealizedPnL: 0
      };
    } catch (err: any) {
      console.error('[TossTradingService] Failed to query account balance:', err.message);
      throw err;
    }
  }

  async getPositions(): Promise<Position[]> {
    try {
      const data = await this.callProxy('GET', '/api/v1/holdings');
      const items = data?.result?.items || [];
      return items.map((p: any, idx: number) => ({
        id: `pos-${idx}-${p.symbol}`,
        symbol: p.symbol,
        qty: Number(p.quantity) || 0,
        avgBuyPrice: Number(p.averagePurchasePrice) || 0,
        currentPrice: Number(p.averagePurchasePrice) || 0
      }));
    } catch (err: any) {
      console.error('[TossTradingService] Failed to query positions:', err.message);
      return [];
    }
  }

  async getMarketPrice(symbol: string): Promise<number> {
    try {
      const data = await this.callProxy('GET', '/api/v1/holdings');
      const items = data?.result?.items || [];
      const item = items.find((i: any) => i.symbol === symbol);
      if (item) {
        if (item.lastPrice) {
          const price = Number(item.lastPrice);
          if (price > 0) return price;
        }
        if (item.averagePurchasePrice) {
          const price = Number(item.averagePurchasePrice);
          if (price > 0) return price;
        }
      }
    } catch (err: any) {
      console.warn('[TossTradingService] Failed to check holdings price for %s, falling back to deterministic hash: %s', symbol, err instanceof Error ? err.message : String(err));
    }

    // Fallback: deterministic price hash
    let hash = 0;
    for (let i = 0; i < symbol.length; i++) {
      hash = (hash << 5) - hash + symbol.charCodeAt(i);
      hash |= 0;
    }
    const minPrice = 10000;
    const maxPrice = 150000;
    const price = minPrice + (Math.abs(hash) % (maxPrice - minPrice));
    return price;
  }

  async getOrder(clientOrderId: string): Promise<OrderV2 | null> {
    const { data, error } = await this.supabase
      .from('orders')
      .select('*')
      .eq('client_order_id', clientOrderId)
      .single();

    if (error || !data) return null;
    return data as OrderV2;
  }

  async fetchOrderFromBroker(clientOrderId: string): Promise<OrderV2 | null> {
    try {
      const { data: orderData, error: dbError } = await this.supabase
        .from('orders')
        .select('broker_order_id')
        .eq('client_order_id', clientOrderId)
        .single();

      if (dbError || !orderData || !orderData.broker_order_id) {
        console.error(`[TossTradingService] fetchOrderFromBroker failed: broker_order_id not found for ${clientOrderId}`);
        return null;
      }

      const brokerOrderId = orderData.broker_order_id;
      const data = await this.callProxy('GET', `/api/v1/orders/${brokerOrderId}`);
      if (!data) return null;
      if (data.error && data.error.includes('not found')) {
        return null;
      }

      const order = data.result;
      if (!order) return null;

      const mapBrokerStatusToV2 = (brokerStatus: string): OrderStatusV2 => {
        switch (brokerStatus) {
          case 'PENDING':
            return 'PENDING';
          case 'PENDING_CANCEL':
            return 'CANCELLING';
          case 'PARTIAL_FILLED':
            return 'PARTIALLY_FILLED';
          case 'FILLED':
            return 'FILLED';
          case 'CANCELED':
            return 'CANCELLED';
          case 'REJECTED':
            return 'REJECTED';
          default:
            return 'SUBMITTED';
        }
      };

      return {
        client_order_id: clientOrderId,
        broker_order_id: brokerOrderId,
        symbol: order.symbol,
        side: order.side as OrderSide,
        type: order.orderType as OrderType,
        qty: Number(order.quantity) || 0,
        price: Number(order.price) || 0,
        status: mapBrokerStatusToV2(order.status),
        filled_qty: Number(order.execution?.filledQuantity) || 0,
        avg_fill_price: Number(order.execution?.averageFilledPrice) || 0,
        trading_mode: 'LIVE',
        last_sequence_number: 0,
        created_at: order.orderedAt || new Date().toISOString(),
        updated_at: order.canceledAt || order.execution?.filledAt || new Date().toISOString()
      };
    } catch (err: any) {
      console.error(`[TossTradingService] Failed to fetch order ${clientOrderId} from broker:`, err.message);
      throw err;
    }
  }

  async cleanConnection() {
    await this.rateLimiter.close();
    await this.circuitBreaker.close();
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'mock-anon';
export const tossTradingService = new TossTradingService(createClient(url, key));
