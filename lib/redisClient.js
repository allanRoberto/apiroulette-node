// src/lib/redisClient.js
import { createClient } from 'redis';

const redisClient = createClient({ url: process.env.REDIS_URL });

redisClient.on('error', err => console.error('Redis Client Error', err));

// Conecta uma única vez no startup
redisClient.connect()
  .then(() => console.log('Redis conectado'))
  .catch(console.error);

export default redisClient;
