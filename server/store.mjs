import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_DB_PATH = path.join(__dirname, 'data', 'db.json');

export function defaultCharactersProgress() {
  return {
    goku: { xp: 0, level: 1, unlockedPhase: 1, wins: 0, matches: 0 },
    luffy: { xp: 0, level: 1, unlockedPhase: 1, wins: 0, matches: 0 },
    sukuna: { xp: 0, level: 1, unlockedPhase: 1, wins: 0, matches: 0 },
    naruto: { xp: 0, level: 1, unlockedPhase: 1, wins: 0, matches: 0 },
    inuyasha: { xp: 0, level: 1, unlockedPhase: 1, wins: 0, matches: 0 },
  };
}

function normalizeCharEntry(raw) {
  const level = Math.max(1, Math.floor(Number(raw?.level) || 1));
  const xp = Math.max(0, Math.floor(Number(raw?.xp) || 0));
  const unlockedPhase = Math.max(1, Math.min(4, Math.floor(Number(raw?.unlockedPhase) || 1)));
  const wins = Math.max(0, Math.floor(Number(raw?.wins) || 0));
  const matches = Math.max(wins, Math.floor(Number(raw?.matches) || 0));
  return { xp, level, unlockedPhase, wins, matches };
}

export function mergeCharactersProgress(existing, incoming) {
  const base = defaultCharactersProgress();
  const result = {};
  const allKeys = new Set([
    ...Object.keys(base),
    ...Object.keys(existing || {}),
    ...Object.keys(incoming || {}),
  ]);

  for (const key of allKeys) {
    const a = normalizeCharEntry((existing && existing[key]) || base[key]);
    const b = normalizeCharEntry((incoming && incoming[key]) || base[key]);

    let level = Math.max(a.level, b.level);
    let xp = 0;
    if (a.level > b.level) {
      xp = a.xp;
    } else if (b.level > a.level) {
      xp = b.xp;
    } else {
      xp = Math.max(a.xp, b.xp);
    }

    result[key] = {
      level,
      xp,
      unlockedPhase: Math.max(a.unlockedPhase, b.unlockedPhase),
      wins: Math.max(a.wins, b.wins),
      matches: Math.max(a.matches, b.matches),
    };
  }
  return result;
}

export function hashPassword(password, salt) {
  return crypto.scryptSync(String(password), String(salt), 64).toString('hex');
}

export function verifyPassword(password, salt, expectedHash) {
  const actualBuf = Buffer.from(hashPassword(password, salt), 'hex');
  const expectedBuf = Buffer.from(String(expectedHash), 'hex');
  if (actualBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(actualBuf, expectedBuf);
}

export class GameStore {
  constructor(dbPath = process.env.AK_DB_PATH || DEFAULT_DB_PATH) {
    this.dbPath = dbPath;
    this.writeQueue = Promise.resolve();
    this.state = this.loadSync();
  }

  loadSync() {
    const dir = path.dirname(this.dbPath);
    fs.mkdirSync(dir, { recursive: true });

    if (fs.existsSync(this.dbPath)) {
      try {
        const raw = fs.readFileSync(this.dbPath, 'utf8');
        const parsed = JSON.parse(raw);
        const state = {
          version: 1,
          authSecret:
            typeof parsed.authSecret === 'string' && parsed.authSecret.length >= 16
              ? parsed.authSecret
              : process.env.AK_AUTH_SECRET || crypto.randomBytes(32).toString('hex'),
          users: Array.isArray(parsed.users) ? parsed.users : [],
          friendships: Array.isArray(parsed.friendships) ? parsed.friendships : [],
        };
        return state;
      } catch {
        // Falls back to empty store if file was corrupted
      }
    }

    const initial = {
      version: 1,
      authSecret: process.env.AK_AUTH_SECRET || crypto.randomBytes(32).toString('hex'),
      users: [],
      friendships: [],
    };
    this.writeAtomicSync(initial);
    return initial;
  }

  writeAtomicSync(data) {
    const dir = path.dirname(this.dbPath);
    fs.mkdirSync(dir, { recursive: true });
    const tmpPath = `${this.dbPath}.${process.pid}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmpPath, this.dbPath);
  }

  persist() {
    const snapshot = JSON.stringify(this.state, null, 2);
    this.writeQueue = this.writeQueue
      .then(async () => {
        const dir = path.dirname(this.dbPath);
        await fsp.mkdir(dir, { recursive: true });
        const tmpPath = `${this.dbPath}.${process.pid}.${Date.now()}.${Math.random()
          .toString(36)
          .slice(2, 7)}.tmp`;
        await fsp.writeFile(tmpPath, snapshot, 'utf8');
        await fsp.rename(tmpPath, this.dbPath);
      })
      .catch((err) => {
        console.error('[GameStore persist error]', err);
      });
    return this.writeQueue;
  }

  createToken(userId) {
    const payload = {
      sub: userId,
      iat: Date.now(),
      exp: Date.now() + 1000 * 60 * 60 * 24 * 30, // 30 days
    };
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = crypto
      .createHmac('sha256', this.state.authSecret)
      .update(encodedPayload)
      .digest('base64url');
    return `${encodedPayload}.${sig}`;
  }

  verifyToken(token) {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [encodedPayload, sig] = parts;
    if (!encodedPayload || !sig) return null;

    const expectedSig = crypto
      .createHmac('sha256', this.state.authSecret)
      .update(encodedPayload)
      .digest('base64url');

    const sigBuf = Buffer.from(sig);
    const expBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }

    try {
      const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
      if (!payload || typeof payload.sub !== 'string') return null;
      if (typeof payload.exp === 'number' && payload.exp < Date.now()) return null;
      return payload;
    } catch {
      return null;
    }
  }

  generateFriendCode(username) {
    const cleaned = String(username || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');
    const prefix = (cleaned.slice(0, 6) || 'HERO').padEnd(3, 'X');

    for (let i = 0; i < 40; i++) {
      const digits = String(crypto.randomInt(1000, 10000));
      const candidate = `${prefix}#${digits}`;
      const exists = this.state.users.some(
        (u) => u.friendCode.toUpperCase() === candidate.toUpperCase()
      );
      if (!exists) return candidate;
    }
    const fallbackSuffix = crypto.randomBytes(2).toString('hex').toUpperCase();
    return `${prefix}#${fallbackSuffix}`;
  }

  sanitizeUser(user) {
    if (!user) return null;
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      friendCode: user.friendCode,
      createdAt: user.createdAt,
      characters: mergeCharactersProgress(user.characters, null),
    };
  }

  findUserById(id) {
    return this.state.users.find((u) => u.id === id) || null;
  }

  findUserByEmail(email) {
    const norm = String(email || '').trim().toLowerCase();
    return this.state.users.find((u) => u.email.toLowerCase() === norm) || null;
  }

  findUserByUsername(username) {
    const norm = String(username || '').trim().toLowerCase();
    return this.state.users.find((u) => u.username.toLowerCase() === norm) || null;
  }

  findUserByFriendCode(friendCode) {
    const norm = String(friendCode || '').trim().toUpperCase();
    return this.state.users.find((u) => u.friendCode.toUpperCase() === norm) || null;
  }

  findUserByIdentifier(identifier) {
    const raw = String(identifier || '').trim();
    if (!raw) return null;
    return (
      this.findUserByEmail(raw) ||
      this.findUserByUsername(raw) ||
      this.findUserByFriendCode(raw)
    );
  }

  createUser({ username, email, password, characters }) {
    const cleanUsername = String(username || '').trim();
    const cleanEmail = String(email || '').trim().toLowerCase();
    const salt = crypto.randomBytes(16).toString('hex');
    const user = {
      id: crypto.randomUUID(),
      username: cleanUsername,
      email: cleanEmail,
      passwordHash: hashPassword(password, salt),
      salt,
      friendCode: this.generateFriendCode(cleanUsername),
      createdAt: new Date().toISOString(),
      characters: mergeCharactersProgress(defaultCharactersProgress(), characters),
    };
    this.state.users.push(user);
    void this.persist();
    return user;
  }

  updateUserCharacters(userId, incomingChars) {
    const user = this.findUserById(userId);
    if (!user) return null;
    user.characters = mergeCharactersProgress(user.characters, incomingChars);
    void this.persist();
    return user.characters;
  }

  getFriendshipsForUser(userId) {
    return this.state.friendships.filter(
      (f) => f.fromUserId === userId || f.toUserId === userId
    );
  }

  findFriendshipBetween(userAId, userBId) {
    return (
      this.state.friendships.find(
        (f) =>
          (f.fromUserId === userAId && f.toUserId === userBId) ||
          (f.fromUserId === userBId && f.toUserId === userAId)
      ) || null
    );
  }

  createFriendship(fromUserId, toUserId, status = 'pending') {
    const entry = {
      id: crypto.randomUUID(),
      fromUserId,
      toUserId,
      status,
      createdAt: new Date().toISOString(),
    };
    this.state.friendships.push(entry);
    void this.persist();
    return entry;
  }

  acceptFriendship(friendshipId) {
    const entry = this.state.friendships.find((f) => f.id === friendshipId);
    if (!entry) return null;
    entry.status = 'accepted';
    void this.persist();
    return entry;
  }

  deleteFriendship(friendshipId) {
    const idx = this.state.friendships.findIndex((f) => f.id === friendshipId);
    if (idx === -1) return false;
    this.state.friendships.splice(idx, 1);
    void this.persist();
    return true;
  }

  deleteFriendshipBetween(userAId, userBId) {
    const before = this.state.friendships.length;
    this.state.friendships = this.state.friendships.filter(
      (f) =>
        !(
          (f.fromUserId === userAId && f.toUserId === userBId) ||
          (f.fromUserId === userBId && f.toUserId === userAId)
        )
    );
    if (this.state.friendships.length !== before) {
      void this.persist();
      return true;
    }
    return false;
  }
}

