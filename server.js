// server.js — Node.js прокси для Anthropic API
// Запуск: node server.js
// Требования: Node.js 18+

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

// ── КОНФИГ ──────────────────────────────────────────
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.ANTHROPIC_API_KEY || 'ВСТАВЬ_СВОЙ_КЛЮЧ_СЮДА';
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'https://твой-домен.ru',   // ← замени на свой домен
];
// ────────────────────────────────────────────────────

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

const server = http.createServer((req, res) => {
  const origin = req.headers.origin || '';

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders(origin));
    res.end();
    return;
  }

  // Serve index.html
  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    const filePath = path.join(__dirname, 'index.html');
    if (fs.existsSync(filePath)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      fs.createReadStream(filePath).pipe(res);
    } else {
      res.writeHead(404); res.end('index.html not found');
    }
    return;
  }

  // Proxy endpoint
  if (req.method === 'POST' && req.url === '/api/ask') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      let parsed;
      try { parsed = JSON.parse(body); } catch (e) {
        res.writeHead(400, corsHeaders(origin));
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
        return;
      }

      const payload = JSON.stringify({
        model: parsed.model || 'claude-haiku-3-5-20241022',
        max_tokens: Math.min(parsed.max_tokens || 1500, 2000),
        messages: parsed.messages,
      });

      const options = {
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY,
          'anthropic-version': '2023-06-01',
          'Content-Length': Buffer.byteLength(payload),
        },
      };

      const proxyReq = https.request(options, (proxyRes) => {
        let data = '';
        proxyRes.on('data', chunk => { data += chunk; });
        proxyRes.on('end', () => {
          res.writeHead(proxyRes.statusCode, {
            'Content-Type': 'application/json',
            ...corsHeaders(origin),
          });
          res.end(data);
        });
      });

      proxyReq.on('error', (err) => {
        console.error('Proxy error:', err.message);
        res.writeHead(502, corsHeaders(origin));
        res.end(JSON.stringify({ error: 'API unavailable' }));
      });

      proxyReq.write(payload);
      proxyReq.end();
    });
    return;
  }

  res.writeHead(404); res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`SkillTrainer server running on http://localhost:${PORT}`);
  console.log(`API Key: ${API_KEY.slice(0, 12)}...`);
});
