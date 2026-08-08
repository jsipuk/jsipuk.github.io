import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { runInspection } from './server/inspect.js';
import { readVault, writeVault } from './server/vault.js';

/* Ten downscaled photos base64'd still make a fat body. 64MB is generous
   headroom over the ~8-10MB a full ten-slot inspection actually sends. */
const MAX_BODY = 64 * 1024 * 1024;

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new Error('Request body too large.'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {});
      } catch {
        reject(new Error('Request body was not valid JSON.'));
      }
    });
    req.on('error', reject);
  });
}

function send(res, status, payload) {
  const body = JSON.stringify(payload);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(body);
}

/* Dev-server plugin. Both endpoints live in the Vite process — no second
   Express server to start, stop or forget about. */
function gradebenchApi(env) {
  const handle = (fn) => async (req, res) => {
    try {
      await fn(req, res);
    } catch (e) {
      send(res, 500, { error: e.message || 'Unknown server error.' });
    }
  };

  return {
    name: 'gradebench-api',
    configureServer(server) {
      server.middlewares.use(
        '/api/inspect',
        handle(async (req, res) => {
          const model = env.GRADEBENCH_MODEL || 'claude-opus-5';

          // GET tells the client which model it is about to spend money on,
          // so the cost estimate on screen matches what actually runs.
          if (req.method === 'GET') return send(res, 200, { model });
          if (req.method !== 'POST') return send(res, 405, { error: 'GET or POST only.' });

          const apiKey = env.ANTHROPIC_API_KEY;
          if (!apiKey) {
            return send(res, 500, {
              error:
                'ANTHROPIC_API_KEY is not set. Copy .env.example to .env and add your key, then restart the dev server.',
            });
          }

          const body = await readBody(req);
          const result = await runInspection({
            images: body.images,
            sides: body.sides,
            apiKey,
            model,
          });
          send(res, 200, result);
        }),
      );

      server.middlewares.use(
        '/api/vault',
        handle(async (req, res) => {
          if (req.method === 'GET') return send(res, 200, { entries: await readVault() });
          if (req.method === 'POST') {
            const body = await readBody(req);
            const entries = await writeVault(body.entries);
            return send(res, 200, { entries });
          }
          send(res, 405, { error: 'GET or POST only.' });
        }),
      );
    },
  };
}

export default defineConfig(({ mode }) => {
  /* Empty prefix loads every variable in .env into the *config* process only.
     Nothing here is passed to `define`, so none of it reaches the bundle. */
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), gradebenchApi(env)],
    server: { port: 5173 },
  };
});
