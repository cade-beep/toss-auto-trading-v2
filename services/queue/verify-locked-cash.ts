import { createBacktestSandboxDb } from '../ai/backtest-sandbox';

async function runTests() {
  console.log("=========================================");
  console.log("RUNNING LEDGER LOCKED_CASH SAFETY TESTS  ");
  console.log("=========================================");

  // 1. Initialize Mock DB with 10,000 cash
  const db = createBacktestSandboxDb(10000);

  // 2. Initial state verification
  {
    const { data: portfolio } = await db.from('portfolio_state').select('*').single();
    console.log(`[Test Init] Initial Cash: ${portfolio?.cash_balance}, Locked Cash: ${portfolio?.locked_cash}`);
    if (portfolio?.cash_balance !== 10000 || portfolio?.locked_cash !== 0) {
      console.error("❌ Init Test Failed");
      process.exit(1);
    }
  }

  // 3. Insert two buy orders (3,000 each)
  {
    console.log("\n[Test 1] Placing two BUY orders of 3,000 each...");
    const res1 = await db.from('orders').insert({
      client_order_id: 'ORD-LOCK-1',
      symbol: 'AAPL',
      side: 'BUY',
      qty: 10,
      price: 300,
      status: 'PENDING'
    });

    const res2 = await db.from('orders').insert({
      client_order_id: 'ORD-LOCK-2',
      symbol: 'MSFT',
      side: 'BUY',
      qty: 10,
      price: 300,
      status: 'PENDING'
    });

    const { data: portfolio } = await db.from('portfolio_state').select('*').single();
    console.log(`[Test 1 Result] Cash: ${portfolio?.cash_balance}, Locked Cash: ${portfolio?.locked_cash}, Available: ${portfolio!.cash_balance - portfolio!.locked_cash}`);
    
    if (portfolio?.locked_cash !== 6000 || (portfolio.cash_balance - portfolio.locked_cash) !== 4000) {
      console.error("❌ Test 1 Failed: locked_cash should be 6000 and available cash should be 4000");
      process.exit(1);
    }
    console.log("Test 1: ✅ PASS");
  }

  // 4. Try to place a third buy order (5,000 value) which exceeds available cash (4,000 available)
  {
    console.log("\n[Test 2] Attempting to place a third order of 5,000 (exceeds available cash)...");
    const res3 = await db.from('orders').insert({
      client_order_id: 'ORD-LOCK-3',
      symbol: 'GOOGL',
      side: 'BUY',
      qty: 10,
      price: 500,
      status: 'PENDING'
    });

    if (res3.error && res3.error.code === '23514') {
      console.log(`[Test 2 Result] Order rejected as expected. Error: ${res3.error.message}`);
      console.log("Test 2: ✅ PASS (Double-Spend Blocked)");
    } else {
      console.error("❌ Test 2 Failed: Expected order placement to fail due to check constraint.");
      process.exit(1);
    }
  }

  // 5. Fill the first order (3,000) and verify cash and locked cash decrement
  {
    console.log("\n[Test 3] Simulating execution of the first order (ORD-LOCK-1)...");
    const fillRes = await db.rpc('execute_trade_v2', {
      p_execution_id: 'EXEC-LOCK-1',
      p_client_order_id: 'ORD-LOCK-1',
      p_event_type: 'FULL_FILL',
      p_fill_qty: 10,
      p_fill_price: 300,
      p_sequence_number: 1,
      p_raw_payload: {}
    });

    if (fillRes.error) {
      console.error("❌ Test 3 Failed to execute trade:", fillRes.error.message);
      process.exit(1);
    }

    const { data: portfolio } = await db.from('portfolio_state').select('*').single();
    const { data: order } = await db.from('orders').select('*').eq('client_order_id', 'ORD-LOCK-1').single();
    
    console.log(`[Test 3 Result] Cash: ${portfolio?.cash_balance}, Locked Cash: ${portfolio?.locked_cash}, Order Status: ${order?.status}`);
    
    if (portfolio?.cash_balance !== 7000 || portfolio?.locked_cash !== 3000 || order?.status !== 'FILLED') {
      console.error("❌ Test 3 Failed: expected cash=7000, locked=3000, status=FILLED");
      process.exit(1);
    }
    console.log("Test 3: ✅ PASS");
  }

  // 6. Cancel the second order (3,000) and verify locked cash is fully released
  {
    console.log("\n[Test 4] Cancelling the second order (ORD-LOCK-2)...");
    const cancelRes = await db.rpc('execute_trade_v2', {
      p_execution_id: 'EXEC-LOCK-CAN-2',
      p_client_order_id: 'ORD-LOCK-2',
      p_event_type: 'CANCEL',
      p_fill_qty: 0,
      p_fill_price: 0,
      p_sequence_number: 1,
      p_raw_payload: {}
    });

    if (cancelRes.error) {
      console.error("❌ Test 4 Failed to cancel trade:", cancelRes.error.message);
      process.exit(1);
    }

    const { data: portfolio } = await db.from('portfolio_state').select('*').single();
    const { data: order } = await db.from('orders').select('*').eq('client_order_id', 'ORD-LOCK-2').single();

    console.log(`[Test 4 Result] Cash: ${portfolio?.cash_balance}, Locked Cash: ${portfolio?.locked_cash}, Order Status: ${order?.status}`);

    if (portfolio?.cash_balance !== 7000 || portfolio?.locked_cash !== 0 || order?.status !== 'CANCELLED') {
      console.error("❌ Test 4 Failed: expected cash=7000, locked=0, status=CANCELLED");
      process.exit(1);
    }
    console.log("Test 4: ✅ PASS");
  }

  // 7. Verify CANCELLING state holds reservation correctly
  {
    console.log("\n[Test 5] Placing BUY order of 2,000 and transitioning to CANCELLING...");
    await db.from('orders').insert({
      client_order_id: 'ORD-LOCK-5',
      symbol: 'GOOGL',
      side: 'BUY',
      qty: 10,
      price: 200,
      status: 'PENDING'
    });

    let { data: portfolio } = await db.from('portfolio_state').select('*').single();
    console.log(`[Test 5 - Pending] Locked Cash: ${portfolio?.locked_cash}`);
    if (portfolio?.locked_cash !== 2000) {
      console.error("❌ Test 5 Failed at PENDING: expected locked_cash = 2000");
      process.exit(1);
    }

    // Transition to CANCELLING (simulating user requesting cancel)
    await db.rpc('update_order_status_v2', {
      p_client_order_id: 'ORD-LOCK-5',
      p_status: 'CANCELLING'
    });

    ({ data: portfolio } = await db.from('portfolio_state').select('*').single());
    console.log(`[Test 5 - Cancelling] Locked Cash: ${portfolio?.locked_cash}`);
    if (portfolio?.locked_cash !== 2000) {
      console.error("❌ Test 5 Failed at CANCELLING: expected locked_cash to remain 2000");
      process.exit(1);
    }

    // Finally CANCEL (confirm cancel)
    await db.rpc('execute_trade_v2', {
      p_execution_id: 'EXEC-LOCK-CAN-5',
      p_client_order_id: 'ORD-LOCK-5',
      p_event_type: 'CANCEL',
      p_fill_qty: 0,
      p_fill_price: 0,
      p_sequence_number: 1,
      p_raw_payload: {}
    });

    ({ data: portfolio } = await db.from('portfolio_state').select('*').single());
    console.log(`[Test 5 - Cancelled] Locked Cash: ${portfolio?.locked_cash}`);
    if (portfolio?.locked_cash !== 0) {
      console.error("❌ Test 5 Failed at CANCELLED: expected locked_cash to reset to 0");
      process.exit(1);
    }
    console.log("Test 5: ✅ PASS");
  }

  // 8. Verify slippage handling (Fill price > Order price doesn't rollback but resolves smoothly)
  {
    console.log("\n[Test 6] Simulating BUY order of 2,000 (200 * 10) filled with 10% slippage (220 * 10 = 2,200)...");
    await db.from('orders').insert({
      client_order_id: 'ORD-LOCK-6',
      symbol: 'TSLA',
      side: 'BUY',
      qty: 10,
      price: 200,
      status: 'PENDING'
    });

    // Execute with higher price (220 instead of 200)
    const fillRes = await db.rpc('execute_trade_v2', {
      p_execution_id: 'EXEC-LOCK-SLIP-6',
      p_client_order_id: 'ORD-LOCK-6',
      p_event_type: 'FULL_FILL',
      p_fill_qty: 10,
      p_fill_price: 220,
      p_sequence_number: 1,
      p_raw_payload: {}
    });

    if (fillRes.error) {
      console.error("❌ Test 6 Failed to execute trade with slippage:", fillRes.error.message);
      process.exit(1);
    }

    const { data: portfolio } = await db.from('portfolio_state').select('*').single();
    const { data: order } = await db.from('orders').select('*').eq('client_order_id', 'ORD-LOCK-6').single();

    // Cash was 7,000. Under 2,200 slippage cost, cash should end up at 7000 - 2200 = 4800.
    // Locked cash should release the 2,000 reservation, ending up at 0.
    console.log(`[Test 6 Result] Cash: ${portfolio?.cash_balance}, Locked Cash: ${portfolio?.locked_cash}, Order Status: ${order?.status}`);

    if (portfolio?.cash_balance !== 4800 || portfolio?.locked_cash !== 0 || order?.status !== 'FILLED') {
      console.error("❌ Test 6 Failed: expected cash=4800, locked=0, status=FILLED");
      process.exit(1);
    }
    console.log("Test 6: ✅ PASS");
  }

  console.log("\n=========================================");
  console.log("ALL LOCKED_CASH SAFETY TESTS PASSED!     ");
  console.log("=========================================");
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
