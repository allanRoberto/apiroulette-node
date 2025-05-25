// src/websocket.js
import { WebSocketServer } from 'ws';
import { parse } from 'url';
import redisClient from './lib/redisClient.js';


const clientsBySlug = new Map();
let wss;

/**
 * Inicializa o WebSocketServer na rota /ws/results/:slug
 */
export function setupWebsocket(server) {
  wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    const { pathname } = parse(req.url);
    const match = pathname?.match(/^\/ws\/results\/([^\/]+)$/);
    if (!match) {
      socket.destroy();
      return;
    }
    const slug = match[1];
    console.log(match[1])
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, slug);
    });
  });

  wss.on('connection', (ws, slug) => {
    if (!clientsBySlug.has(slug)) clientsBySlug.set(slug, new Set());
    clientsBySlug.get(slug).add(ws);
    ws.on('close', () => {
      const set = clientsBySlug.get(slug);
      set.delete(ws);
      if (set.size === 0) clientsBySlug.delete(slug);
    });
  });

  console.log('WebSocket pronto em /ws/results/:slug');
}

/**
 * Envia { number } para todos os WS conectados naquele slug
 */
export function broadcastResult(slug, number) {
  const set = clientsBySlug.get(slug);
  console.log(set)
  if (!set) return;
  for (const ws of set) {
    if (ws.readyState === WebSocketServer.OPEN) {
      ws.send(JSON.stringify({ number }));
    }
  }
}
