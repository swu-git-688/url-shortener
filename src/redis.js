const Redis = require('ioredis');

const client = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: 6379,
});

const DEFAULT_TTL = 604800; // 7 days
const CODES_SET = '__codes__';

const redis = {
  async set(code, url, ttlSeconds = DEFAULT_TTL) {
    const entry = JSON.stringify({ url, createdAt: new Date().toISOString() });
    await client.set(code, entry, 'EX', ttlSeconds);
    await client.sadd(CODES_SET, code);
    return true;
  },

  async get(code) {
    const raw = await client.get(code);
    if (!raw) return null;
    try { return JSON.parse(raw).url; } catch { return raw; }
  },

  async incrementClick(code) {
    const raw = await client.get(code);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      parsed.clicks = (parsed.clicks || 0) + 1;
      const ttl = await client.ttl(code);
      if (ttl > 0) {
        await client.set(code, JSON.stringify(parsed), 'EX', ttl);
      } else {
        await client.set(code, JSON.stringify(parsed));
      }
    } catch { /* ignore */ }
  },

  async list() {
    const codes = await client.smembers(CODES_SET);
    if (!codes.length) return [];

    const entries = await Promise.all(codes.map(async (code) => {
      const raw = await client.get(code);
      if (!raw) {
        await client.srem(CODES_SET, code); // clean up expired
        return null;
      }
      try {
        const { url, createdAt, clicks } = JSON.parse(raw);
        return { code, url, createdAt, clicks: clicks || 0 };
      } catch {
        return { code, url: raw, createdAt: null, clicks: 0 };
      }
    }));

    return entries
      .filter(Boolean)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  async del(code) {
    const result = await client.del(code);
    await client.srem(CODES_SET, code);
    return result;
  },
};

module.exports = redis;
