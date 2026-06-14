/* eslint-disable */
import { SupabaseClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import crypto from 'crypto';

// Setup environment variables before importing the route module
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'mock-anon-key-12345';
process.env.TOSS_CREDENTIALS_ENCRYPTION_KEY = 'test-encryption-key-for-credentials-123';
process.env.TOSS_API_URL = 'http://mock-toss-api.com';
process.env.NEXT_PUBLIC_TRADING_MODE = 'LIVE';

// Setup global mock database state variables
let mockApiCredentialsResult: { data: any; error: any } = { data: null, error: null };
let mockAuthUserResult: { data: { user: any } | null; error: any } = {
  data: { user: { id: 'test-user-123', email: 'test@example.com' } },
  error: null
};

// Global spy to check if fetch was called (Toss API forwarding)
let fetchCallArgs: { url: string; options: any } | null = null;
const originalFetch = global.fetch;
global.fetch = async (url: any, options: any) => {
  const urlStr = url.toString();
  const parsedUrl = new URL(urlStr);
  if (parsedUrl.hostname === 'mock-toss-api.com') {
    if (parsedUrl.pathname === '/oauth2/token') {
      return {
        status: 200,
        ok: true,
        json: async () => ({
          access_token: 'mocked-oauth-token',
          token_type: 'Bearer',
          expires_in: 3600
        })
      } as any;
    }
    if (parsedUrl.pathname === '/api/v1/accounts') {
      return {
        status: 200,
        ok: true,
        json: async () => ({
          result: [
            { accountNo: 'brokerage-456', accountSeq: 888, accountType: 'BROKERAGE' }
          ]
        })
      } as any;
    }
    fetchCallArgs = { url: urlStr, options };
    return {
      status: 200,
      ok: true,
      json: async () => ({ success: true, message: 'Forwarded to Toss API successfully' })
    } as any;
  }
  if (urlStr.includes('/auth/v1/user')) {
    return {
      status: 200,
      ok: true,
      json: async () => ({
        user: { id: 'test-user-123', email: 'test@example.com' }
      })
    } as any;
  }
  return { ok: false } as any;
};

// Override SupabaseClient prototype methods for mocking
SupabaseClient.prototype.auth = {
  getUser: async (token?: string) => {
    return mockAuthUserResult;
  },
  getSession: async () => {
    return { data: { session: { access_token: 'mock-access-token' } }, error: null };
  }
} as any;

SupabaseClient.prototype.from = function (table: string) {
  return {
    select: (columns: string) => ({
      eq: (col: string, val: any) => ({
        single: async () => {
          if (table === 'api_credentials') {
            return mockApiCredentialsResult;
          }
          return { data: null, error: { message: 'Table not mocked' } };
        }
      })
    }),
    update: (updates: any) => {
      if (mockApiCredentialsResult.data) {
        Object.assign(mockApiCredentialsResult.data, updates);
      }
      return {
        eq: (col: string, val: any) => ({
          then: (onfulfilled: any) => Promise.resolve({ error: null }).then(onfulfilled)
        })
      };
    }
  } as any;
};

async function runTests() {
  console.log("=========================================");
  console.log("RUNNING PR-5C FAIL-CLOSED CREDENTIAL TESTS");
  console.log("=========================================");

  // Dynamically import the POST handler from route to test it
  const routeMod = await import('../../app/api/toss-proxy/route');
  const POST = routeMod.POST;
  const encryptSecret = routeMod.encryptSecret;

  const testUser = 'test-user-123';

  // Helper to create basic JSON POST request
  function createProxyRequest(payload: any = { method: 'POST', path: '/api/v1/orders', body: { orderId: 'test-1' } }) {
    return new NextRequest('http://localhost:3000/api/toss-proxy', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer mock-user-token',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
  }

  // --- Test A: Missing api_credentials row ---
  {
    console.log('\n[Test A] Missing api_credentials row...');
    mockApiCredentialsResult = {
      data: null,
      error: { code: 'PGRST116', message: 'No rows found' }
    };
    fetchCallArgs = null;

    const req = createProxyRequest();
    const res = await POST(req);
    const resBody = await res.json();

    console.log(`Status: ${res.status}`);
    console.log(`Body:`, resBody);

    const isRejectedCorrectly = res.status === 400 && 
      resBody.error.includes('ConfigurationError') &&
      resBody.error.includes('api_credentials record not found');
    
    const isMockBypassed = fetchCallArgs === null;

    if (isRejectedCorrectly && isMockBypassed) {
      console.log('Test A: ✅ PASS');
    } else {
      console.log('Test A: ❌ FAIL', { isRejectedCorrectly, isMockBypassed, fetchCallArgs });
      process.exit(1);
    }
  }

  // --- Test B: Missing encrypted_api_key ---
  {
    console.log('\n[Test B] Missing encrypted_api_key field...');
    mockApiCredentialsResult = {
      data: {
        user_id: testUser,
        encrypted_api_key: null,
        encrypted_secret_key: encryptSecret('my-secret-key'),
        is_simulation: false
      },
      error: null
    };
    fetchCallArgs = null;

    const req = createProxyRequest();
    const res = await POST(req);
    const resBody = await res.json();

    console.log(`Status: ${res.status}`);
    console.log(`Body:`, resBody);

    const isRejectedCorrectly = res.status === 400 && 
      resBody.error.includes('ConfigurationError') &&
      resBody.error.includes('Missing encrypted_api_key');

    if (isRejectedCorrectly) {
      console.log('Test B: ✅ PASS');
    } else {
      console.log('Test B: ❌ FAIL');
      process.exit(1);
    }
  }

  // --- Test C: Missing encrypted_secret_key ---
  {
    console.log('\n[Test C] Missing encrypted_secret_key field...');
    mockApiCredentialsResult = {
      data: {
        user_id: testUser,
        encrypted_api_key: encryptSecret('my-api-key'),
        encrypted_secret_key: '',
        is_simulation: false
      },
      error: null
    };
    fetchCallArgs = null;

    const req = createProxyRequest();
    const res = await POST(req);
    const resBody = await res.json();

    console.log(`Status: ${res.status}`);
    console.log(`Body:`, resBody);

    const isRejectedCorrectly = res.status === 400 && 
      resBody.error.includes('ConfigurationError') &&
      resBody.error.includes('Missing encrypted_secret_key');

    if (isRejectedCorrectly) {
      console.log('Test C: ✅ PASS');
    } else {
      console.log('Test C: ❌ FAIL');
      process.exit(1);
    }
  }

  // --- Test D: Valid credentials routing ---
  {
    console.log('\n[Test D] Valid credentials routing to Toss API...');
    const rawApiKey = 'my-real-toss-api-key-123';
    const rawSecretKey = 'my-real-toss-secret-key-123';
    mockApiCredentialsResult = {
      data: {
        user_id: testUser,
        encrypted_api_key: encryptSecret(rawApiKey),
        encrypted_secret_key: encryptSecret(rawSecretKey),
        is_simulation: false
      },
      error: null
    };
    fetchCallArgs = null;

    const req = createProxyRequest();
    const res = await POST(req);
    const resBody = await res.json();

    console.log(`Status: ${res.status}`);
    console.log(`Body:`, resBody);

    const isRoutedCorrectly = res.status === 200 && resBody.message.includes('Forwarded to Toss API');
    const headers = fetchCallArgs !== null ? (fetchCallArgs as any).options.headers : {};
    const isFetchCalledWithCredentials = fetchCallArgs !== null &&
      (headers['authorization'] === 'Bearer mocked-oauth-token' || headers['Authorization'] === 'Bearer mocked-oauth-token');

    if (isRoutedCorrectly && isFetchCalledWithCredentials) {
      console.log('Test D: ✅ PASS');
    } else {
      console.log('Test D: ❌ FAIL', { isRoutedCorrectly, isFetchCalledWithCredentials, fetchCallArgs });
      process.exit(1);
    }
  }

  // --- Test E: Decryption failure returns HTTP 500 ---
  {
    console.log('\n[Test E] Decryption integrity failure...');
    mockApiCredentialsResult = {
      data: {
        user_id: testUser,
        encrypted_api_key: 'invalid-encryption-format-without-colons',
        encrypted_secret_key: 'another-invalid-encryption-format',
        is_simulation: false
      },
      error: null
    };
    fetchCallArgs = null;

    // Temporarily overwrite master encryption key to a wrong key to force cipher decrypter to throw
    const originalKey = process.env.TOSS_CREDENTIALS_ENCRYPTION_KEY;
    process.env.TOSS_CREDENTIALS_ENCRYPTION_KEY = 'different-key-to-cause-hmac-mismatch';

    const req = createProxyRequest();
    const res = await POST(req);
    const resBody = await res.json();

    console.log(`Status: ${res.status}`);
    console.log(`Body:`, resBody);

    // Restore original key
    process.env.TOSS_CREDENTIALS_ENCRYPTION_KEY = originalKey;

    const isRejectedCorrectly = res.status === 500 && 
      resBody.error.includes('SystemError') &&
      resBody.error.includes('decrypt');

    if (isRejectedCorrectly) {
      console.log('Test E: ✅ PASS');
    } else {
      console.log('Test E: ❌ FAIL');
      process.exit(1);
    }
  }

  // Restore global state
  global.fetch = originalFetch;

  console.log("\n=========================================");
  console.log("PR-5C ALL VERIFICATION TESTS PASSED SUCCESSFULLY");
  console.log("=========================================");
  process.exit(0);
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
