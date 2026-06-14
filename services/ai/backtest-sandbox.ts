import { SupabaseClient } from '@supabase/supabase-js';

export interface SandboxState {
  cash: number;
  lockedCash: number;
  positions: Map<string, { symbol: string; qty: number; avg_buy_price: number }>;
  orders: any[];
  dailySnapshots: Map<string, number>;
  riskProfile: any;
}

export function createBacktestSandboxDb(initialCapital: number, riskProfile?: any): SupabaseClient {
  const state: SandboxState = {
    cash: initialCapital,
    lockedCash: 0,
    positions: new Map(),
    orders: [],
    dailySnapshots: new Map(),
    riskProfile: riskProfile || {
      max_open_positions: 5,
      max_position_size_value: 100000000, // expanded limits to prevent backtest lockups unless intentionally testing it
      max_order_value: 50000000,
      max_symbol_exposure_pct: 100.00,
      max_portfolio_exposure_pct: 100.00,
      daily_loss_limit: 10000000,
      kill_switch_active: false,
      max_trades_per_minute: 100,
      min_ai_confidence: 0.00,
    }
  };

  const chain: any = {
    table: '',
    filters: {} as Record<string, any>,
    select: function() { return this; },
    eq: function(col: string, val: any) {
      this.filters[col] = val;
      return this;
    },
    gt: function(col: string, val: any) {
      this.filters[col + '_gt'] = val;
      return this;
    },
    in: function(col: string, val: any) {
      this.filters[col + '_in'] = val;
      return this;
    },
    order: function() { return this; },
    limit: function() { return this; },
    gte: function(col: string, val: any) {
      this.filters[col + '_gte'] = val;
      return this;
    },
    lte: function(col: string, val: any) {
      this.filters[col + '_lte'] = val;
      return this;
    },
    single: async function() {
      const res = await this.execute();
      return { data: res, error: res ? null : { code: 'PGRST116', message: 'Not found' } };
    },
    maybeSingle: async function() {
      const res = await this.execute();
      return { data: res, error: null };
    },
    then: function(onfulfilled?: (value: any) => any) {
      return this.execute().then((res: any) => {
        let countVal: number | null = null;
        if (this.table === 'orders') {
          const gtTime = this.filters['created_at_gt'];
          if (gtTime) {
            const count = state.orders.filter(o => o.created_at > gtTime).length;
            countVal = count;
          } else {
            countVal = state.orders.length;
          }
        }
        return onfulfilled?.({ count: countVal, data: res, error: null });
      });
    },
    insert: function(payload: any) {
      return {
        then: (onfulfilled?: (value: any) => any) => {
          const arr = Array.isArray(payload) ? payload : [payload];
          for (const item of arr) {
            if (this.table === 'orders') {
              if (item.side === 'BUY' && ['PENDING', 'SUBMITTED', 'PARTIALLY_FILLED'].includes(item.status)) {
                const orderValue = item.qty * item.price;
                if (state.cash - state.lockedCash < orderValue) {
                  return Promise.resolve(onfulfilled?.({
                    data: null,
                    error: { code: '23514', message: 'new row violates check constraint "chk_available_cash_positive"' }
                  }));
                }
                state.lockedCash += orderValue;
              }
              state.orders.push({
                ...item,
                created_at: item.created_at || new Date().toISOString()
              });
            } else if (this.table === 'daily_portfolio_snapshots') {
              state.dailySnapshots.set(item.snapshot_date, item.start_of_day_portfolio_value);
            }
          }
          return Promise.resolve(onfulfilled?.({ data: payload, error: null }));
        }
      };
    },
    execute: async function() {
      if (this.table === 'portfolio' || this.table === 'portfolio_state') {
        return { cash_balance: state.cash, locked_cash: state.lockedCash, user_id: 'backtest-trader-id' };
      }
      if (this.table === 'positions' || this.table === 'position_state') {
        const symbol = this.filters['symbol'];
        if (symbol) {
          const pos = state.positions.get(symbol);
          return pos ? { ...pos, id: `pos-${symbol}`, avg_buy_price: pos.avg_buy_price } : null;
        }
        return Array.from(state.positions.values()).map(p => ({
          ...p,
          id: `pos-${p.symbol}`,
          avg_buy_price: p.avg_buy_price
        }));
      }
      if (this.table === 'risk_profiles') {
        return state.riskProfile;
      }
      if (this.table === 'daily_portfolio_snapshots') {
        const date = this.filters['snapshot_date'];
        if (date) {
          const val = state.dailySnapshots.get(date);
          return val ? { start_of_day_portfolio_value: val } : null;
        }
        return Array.from(state.dailySnapshots.entries()).map(([k, v]) => ({
          snapshot_date: k,
          start_of_day_portfolio_value: v
        }));
      }
      if (this.table === 'orders') {
        const clientOrderId = this.filters['client_order_id'];
        if (clientOrderId) {
          return state.orders.find(o => o.client_order_id === clientOrderId) || null;
        }
        return state.orders;
      }
      return null;
    }
  };

  const mock = {
    auth: {
      getUser: async () => ({ data: { user: { id: 'backtest-trader-id', email: 'backtester@toss.im' } }, error: null }),
      getSession: async () => ({ data: { session: { access_token: 'sandbox-token' } }, error: null })
    },
    from: (table: string) => {
      chain.table = table;
      chain.filters = {};
      return chain;
    },
    rpc: async (name: string, args: any) => {
      if (name === 'update_order_status_v2') {
        const ord = state.orders.find(o => o.client_order_id === args.p_client_order_id);
        if (ord) {
          const oldStatus = ord.status;
          ord.status = args.p_status;
          if (args.p_error_message) {
            ord.error_message = args.p_error_message;
          }
          if (ord.side === 'BUY' && ['PENDING', 'SUBMITTED', 'CANCELLING', 'PARTIALLY_FILLED'].includes(oldStatus)) {
            if (['CANCELLED', 'REJECTED'].includes(args.p_status)) {
              const remainingValue = (ord.qty - (ord.filled_qty || 0)) * ord.price;
              state.lockedCash = Math.max(0, state.lockedCash - remainingValue);
            }
          }
        }
        return { data: { success: true }, error: null };
      }
      if (name === 'execute_trade_v2') {
        const ord = state.orders.find(o => o.client_order_id === args.p_client_order_id);
        if (!ord) {
          return { data: { success: false }, error: { message: 'Order not found' } };
        }

        const oldStatus = ord.status;
        const eventType = args.p_event_type || (args.p_fill_qty >= ord.qty ? 'FULL_FILL' : 'PARTIAL_FILL');

        if (['FILLED', 'CANCELLED', 'REJECTED'].includes(ord.status)) {
          return { data: { success: false }, error: { message: 'Cannot update order in terminal state' } };
        }

        if (eventType === 'CANCEL' || eventType === 'REJECT') {
          if (ord.side === 'BUY' && ['PENDING', 'SUBMITTED', 'CANCELLING', 'PARTIALLY_FILLED'].includes(oldStatus)) {
            const remainingValue = (ord.qty - (ord.filled_qty || 0)) * ord.price;
            state.lockedCash = Math.max(0, state.lockedCash - remainingValue);
          }
          ord.status = eventType === 'CANCEL' ? 'CANCELLED' : 'REJECTED';
          return { data: { success: true }, error: null };
        }

        if (eventType === 'ACK') {
          ord.status = 'SUBMITTED';
          return { data: { success: true }, error: null };
        }

        const fillQty = args.p_fill_qty;
        const fillPrice = args.p_fill_price;
        const tradeCost = fillQty * fillPrice;

        if (ord.side === 'BUY') {
          if (state.cash < tradeCost) {
            return { data: { success: false }, error: { message: 'Insufficient cash balance' } };
          }
          const reservedCost = fillQty * ord.price;
          state.lockedCash = Math.max(0, state.lockedCash - reservedCost);
          state.cash -= tradeCost;

          const existing = state.positions.get(ord.symbol);
          if (existing) {
            const newQty = existing.qty + fillQty;
            const newAvg = Math.round((existing.qty * existing.avg_buy_price + tradeCost) / newQty);
            state.positions.set(ord.symbol, { symbol: ord.symbol, qty: newQty, avg_buy_price: newAvg });
          } else {
            state.positions.set(ord.symbol, { symbol: ord.symbol, qty: fillQty, avg_buy_price: fillPrice });
          }
        } else {
          state.cash += tradeCost;
          const existing = state.positions.get(ord.symbol);
          if (existing) {
            const newQty = existing.qty - fillQty;
            if (newQty > 0) {
              state.positions.set(ord.symbol, { symbol: ord.symbol, qty: newQty, avg_buy_price: existing.avg_buy_price });
            } else {
              state.positions.delete(ord.symbol);
            }
          }
        }

        ord.filled_qty = (ord.filled_qty || 0) + fillQty;
        ord.avg_fill_price = fillPrice;
        ord.status = ord.filled_qty >= ord.qty ? 'FILLED' : 'PARTIALLY_FILLED';
        ord.broker_order_id = `BRK-${args.p_execution_id}`;

        return { data: { success: true }, error: null };
      }
      if (name === 'cancel_trade_v2') {
        const ord = state.orders.find(o => o.client_order_id === args.p_client_order_id);
        if (ord) {
          const oldStatus = ord.status;
          ord.status = 'CANCELLED';
          if (ord.side === 'BUY' && ['PENDING', 'SUBMITTED', 'CANCELLING', 'PARTIALLY_FILLED'].includes(oldStatus)) {
            const remainingValue = (ord.qty - (ord.filled_qty || 0)) * ord.price;
            state.lockedCash = Math.max(0, state.lockedCash - remainingValue);
          }
          return { data: { success: true }, error: null };
        }
        return { data: { success: false }, error: { message: 'Order not found' } };
      }
      return { data: null, error: { message: `RPC ${name} not mocked` } };
    }
  };

  return mock as unknown as SupabaseClient;
}
