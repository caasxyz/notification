import { createHmacSignature, verifyHmacSignature } from '../src';
import { createServer } from 'http';

// Example webhook endpoint that validates incoming notifications
const WEBHOOK_SECRET = 'your-webhook-secret';

const server = createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/webhook') {
    let body = '';
    
    // Collect request body
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        // Extract headers
        const signature = req.headers['x-signature'] as string;
        const timestamp = req.headers['x-timestamp'] as string;
        const nonce = req.headers['x-nonce'] as string;
        
        if (!signature || !timestamp || !nonce) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing required headers' }));
          return;
        }
        
        // Verify signature
        const isValid = verifyHmacSignature(
          signature,
          timestamp,
          nonce,
          body,
          WEBHOOK_SECRET,
          300 // 5 minutes max age
        );
        
        if (!isValid) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid signature' }));
          return;
        }
        
        // Process the webhook
        const data = JSON.parse(body);
        console.log('Valid webhook received:', data);
        
        // Your webhook processing logic here
        // ...
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        
      } catch (error) {
        console.error('Webhook processing error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal server error' }));
      }
    });
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

// Example of creating a signed request (for testing)
function createSignedRequest(data: any) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = Math.random().toString(36).substring(7);
  const body = JSON.stringify(data);
  
  const signature = createHmacSignature(
    timestamp,
    nonce,
    body,
    WEBHOOK_SECRET
  );
  
  return {
    headers: {
      'Content-Type': 'application/json',
      'X-Signature': signature,
      'X-Timestamp': timestamp,
      'X-Nonce': nonce,
    },
    body,
  };
}

// Start server
const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Webhook server listening on port ${PORT}`);
  
  // Example signed request
  const testData = {
    type: 'notification',
    user_id: 'user123',
    channel: 'webhook',
    content: 'Test notification',
  };
  
  const signedRequest = createSignedRequest(testData);
  console.log('Example signed request:', signedRequest);
});