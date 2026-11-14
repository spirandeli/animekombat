import crypto from 'node:crypto';
import { WebSocketServer } from 'ws';
import { GameStore, verifyPassword } from './store.mjs';

const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateRoomCode(existingRooms) {
  for (let attempt = 0; attempt < 50; attempt++) {
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += ROOM_CODE_ALPHABET[crypto.randomInt(0, ROOM_CODE_ALPHABET.length)];
    }
    if (!existingRooms.has(code)) return code;
  }
  return crypto.randomBytes(3).toString('hex').toUpperCase();
}

function difficultyLabel(diff) {
  if (diff === 'easy') return 'Fácil';
  if (diff === 'master') return 'Mestre';
  return 'Médio';
}

function sendJson(res, statusCode, data) {
  if (res.writableEnded) return;
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}

function readJsonBody(req, maxBytes = 256 * 1024) {
  return new Promise((resolve, reject) => {
    if (req.body && typeof req.body === 'object') {
      resolve(req.body);
      return;
    }
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error('PAYLOAD_TOO_LARGE'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error('INVALID_JSON'));
      }
    });
    req.on('error', (err) => reject(err));
  });
}

function clampPhase(phase) {
  const n = Math.floor(Number(phase) || 1);
  return Math.max(1, Math.min(4, n));
}

function clampLevel(level) {
  const n = Math.floor(Number(level) || 1);
  return Math.max(1, Math.min(999, n));
}

export function attachGameServer(middlewares, httpServer, options = {}) {
  const store = options.store ?? new GameStore(options.dbPath);
  const wss = new WebSocketServer({ noServer: true });

  /** @type {Map<string, any>} */
  const rooms = new Map();

  /** @type {Map<string, Set<any>>} userId -> Set<clientCtx> */
  const userSockets = new Map();

  /** @type {Set<any>} */
  const allClients = new Set();

  function addClientSocket(ctx) {
    allClients.add(ctx);
    let set = userSockets.get(ctx.userId);
    if (!set) {
      set = new Set();
      userSockets.set(ctx.userId, set);
    }
    set.add(ctx);
  }

  function removeClientSocket(ctx) {
    allClients.delete(ctx);
    const set = userSockets.get(ctx.userId);
    if (set) {
      set.delete(ctx);
      if (set.size === 0) {
        userSockets.delete(ctx.userId);
      }
    }
  }

  function sendWs(ws, payload) {
    if (!ws || ws.readyState !== 1) return;
    ws.send(JSON.stringify(payload));
  }

  function sendToUser(userId, payload) {
    const set = userSockets.get(userId);
    if (!set) return false;
    let delivered = false;
    for (const ctx of set) {
      if (ctx.ws.readyState === 1) {
        sendWs(ctx.ws, payload);
        delivered = true;
      }
    }
    return delivered;
  }

  function getUserPresence(userId) {
    const set = userSockets.get(userId);
    if (!set || set.size === 0) {
      return { status: 'offline', roomCode: null };
    }
    for (const ctx of set) {
      if (ctx.roomCode) {
        const room = rooms.get(ctx.roomCode);
        if (room) {
          return {
            status: room.status === 'fighting' ? 'fighting' : 'in_room',
            roomCode: room.code,
          };
        }
      }
    }
    return { status: 'online', roomCode: null };
  }

  function notifyFriendsOfUser(userId) {
    if (!userId || String(userId).startsWith('guest:')) return;
    const friendships = store.getFriendshipsForUser(userId);
    for (const f of friendships) {
      if (f.status !== 'accepted') continue;
      const otherId = f.fromUserId === userId ? f.toUserId : f.fromUserId;
      sendToUser(otherId, { type: 'friends:updated' });
    }
  }

  const ALL_SLOTS = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];
  const DEFAULT_BOT_CHARS = ['luffy', 'sukuna', 'goku', 'naruto', 'inuyasha', 'zoro', 'seiya', 'sasuke', 'chopper'];
  const VALID_ARENA_THEMES = new Set([
    'random',
    'brasilia',
    'pelourinho',
    'rio-de-janeiro',
    'shrine',
    'volcano',
    'cyber_ruins',
    'void_horizon',
    'sunset_harbor',
  ]);

  function teamForSlot(slotId) {
    return slotId === 'p1' || slotId === 'p3' || slotId === 'p5' ? 1 : 2;
  }

  function randomMapSeed() {
    return (Math.floor(Math.random() * 0x7fffffff) >>> 0) || 1337;
  }

  function normalizeThemeId(theme) {
    const t = typeof theme === 'string' ? theme : 'random';
    return VALID_ARENA_THEMES.has(t) ? t : 'random';
  }

  function clampTeamSize(roomMode, size) {
    if (roomMode !== 'rumble') return 1;
    const n = Number(size) || 3;
    return Math.max(2, Math.min(3, Math.floor(n)));
  }

  function getActiveSlotIds(room) {
    const size = clampTeamSize(room.roomMode, room.teamSize);
    return ALL_SLOTS.slice(0, size * 2);
  }

  function getRoomHumanUserIds(room) {
    const ids = new Set();
    for (const slotId of ALL_SLOTS) {
      const s = room.slots?.[slotId];
      if (s && s.slotMode === 'human' && s.userId && !s.isBot) {
        ids.add(s.userId);
      }
    }
    return [...ids];
  }

  function findUserSlotKey(room, userId) {
    if (!userId || !room?.slots) return null;
    for (const slotId of ALL_SLOTS) {
      const s = room.slots[slotId];
      if (s && s.slotMode === 'human' && !s.isBot && s.userId === userId) {
        return slotId;
      }
    }
    return null;
  }

  function syncLegacySlots(room) {
    room.p1 = { ...room.slots.p1 };
    room.p2 = { ...room.slots.p2 };
    room.p2Mode = room.slots.p2.slotMode === 'bot' ? 'bot' : 'human';
  }

  function serializeRoom(room) {
    syncLegacySlots(room);
    const slots = {};
    for (const slotId of ALL_SLOTS) {
      slots[slotId] = { ...room.slots[slotId] };
    }
    return {
      code: room.code,
      isPublic: Boolean(room.isPublic),
      hostId: room.hostId,
      roomMode: room.roomMode === 'rumble' ? 'rumble' : '1v1',
      teamSize: clampTeamSize(room.roomMode, room.teamSize),
      mapSeed: Number(room.mapSeed) || 1337,
      mapTheme: normalizeThemeId(room.mapTheme),
      p2Mode: room.p2Mode,
      botDifficulty: room.botDifficulty,
      status: room.status,
      p1: { ...room.slots.p1 },
      p2: { ...room.slots.p2 },
      slots,
      createdAt: room.createdAt,
    };
  }

  function broadcastRoomState(room) {
    const payload = { type: 'room:state', room: serializeRoom(room) };
    for (const userId of getRoomHumanUserIds(room)) {
      sendToUser(userId, payload);
    }
  }

  function broadcastRoomsList() {
    for (const ctx of allClients) {
      if (!ctx.roomCode && ctx.ws.readyState === 1) {
        sendWs(ctx.ws, {
          type: 'rooms:list',
          rooms: getJoinableRoomsForUser(ctx.userId),
        });
      }
    }
  }

  function getJoinableRoomsForUser(userId) {
    const friendIds = new Set();
    if (userId && !String(userId).startsWith('guest:')) {
      for (const f of store.getFriendshipsForUser(userId)) {
        if (f.status === 'accepted') {
          friendIds.add(f.fromUserId === userId ? f.toUserId : f.fromUserId);
        }
      }
    }

    const list = [];
    for (const room of rooms.values()) {
      if (room.status !== 'lobby') continue;
      const isFriendHost = friendIds.has(room.hostId);
      const activeIds = getActiveSlotIds(room);
      let humanCount = 0;
      let botCount = 0;
      let openHumanSlots = 0;

      for (const slotId of activeIds) {
        const s = room.slots[slotId];
        if (!s) continue;
        if (s.slotMode === 'human' && s.userId && !s.isBot) {
          humanCount += 1;
        } else if (s.slotMode === 'bot') {
          botCount += 1;
        } else if (s.slotMode === 'human' && !s.userId) {
          openHumanSlots += 1;
        }
      }

      const maxPlayers = activeIds.length;
      const occupiedCount = humanCount + botCount;
      const hasFreeSlot = openHumanSlots > 0;

      if (!room.isPublic && !isFriendHost) continue;
      if (!hasFreeSlot && !isFriendHost) continue;

      const hostSlot = room.slots[findUserSlotKey(room, room.hostId) || 'p1'];

      list.push({
        code: room.code,
        hostName: hostSlot.username,
        hostFriendCode: hostSlot.friendCode,
        isFriend: isFriendHost,
        roomMode: room.roomMode === 'rumble' ? 'rumble' : '1v1',
        teamSize: clampTeamSize(room.roomMode, room.teamSize),
        mapTheme: normalizeThemeId(room.mapTheme),
        occupiedCount,
        humanCount,
        botCount,
        maxPlayers,
        openHumanSlots,
        p2Mode: room.p2Mode,
        hasFreeSlot,
        p1CharId: hostSlot.charId,
        p1Phase: hostSlot.startPhase,
        isPublic: Boolean(room.isPublic),
      });
    }
    return list;
  }

  function buildBotSlot(slotId, difficulty, charId, startPhase = 1, level = 1) {
    const idx = Math.max(0, ALL_SLOTS.indexOf(slotId));
    const fallbackChar = DEFAULT_BOT_CHARS[idx % DEFAULT_BOT_CHARS.length];
    return {
      slot: slotId,
      team: teamForSlot(slotId),
      slotMode: 'bot',
      userId: 'bot',
      username: `BOT ${slotId.toUpperCase()} (${difficultyLabel(difficulty)})`,
      friendCode: null,
      isGuest: false,
      isBot: true,
      charId: charId || fallbackChar,
      startPhase: clampPhase(startPhase),
      level: clampLevel(level),
      ready: true,
    };
  }

  function buildEmptyHumanSlot(slotId, charId) {
    const idx = Math.max(0, ALL_SLOTS.indexOf(slotId));
    const fallbackChar = DEFAULT_BOT_CHARS[idx % DEFAULT_BOT_CHARS.length];
    return {
      slot: slotId,
      team: teamForSlot(slotId),
      slotMode: 'human',
      userId: null,
      username: 'Vaga Aberta...',
      friendCode: null,
      isGuest: false,
      isBot: false,
      charId: charId || fallbackChar,
      startPhase: 1,
      level: 1,
      ready: false,
    };
  }

  function buildClosedSlot(slotId) {
    return {
      slot: slotId,
      team: teamForSlot(slotId),
      slotMode: 'closed',
      userId: null,
      username: 'Fechado',
      friendCode: null,
      isGuest: false,
      isBot: false,
      charId: 'luffy',
      startPhase: 1,
      level: 1,
      ready: true,
    };
  }

  function buildUserSlot(slotId, ctx, ready = false) {
    return {
      slot: slotId,
      team: teamForSlot(slotId),
      slotMode: 'human',
      userId: ctx.userId,
      username: ctx.username,
      friendCode: ctx.friendCode || null,
      isGuest: Boolean(ctx.isGuest),
      isBot: false,
      charId: ctx.charId || 'luffy',
      startPhase: clampPhase(ctx.startPhase || 1),
      level: clampLevel(ctx.level || 1),
      ready: Boolean(ready),
    };
  }

  function leaveCurrentRoom(ctx, silentToSelf = false) {
    if (!ctx.roomCode) return;
    const roomCode = ctx.roomCode;
    ctx.roomCode = null;
    const room = rooms.get(roomCode);
    if (!room) {
      notifyFriendsOfUser(ctx.userId);
      return;
    }

    const wasFighting = room.status === 'fighting';
    const slotKey = findUserSlotKey(room, ctx.userId);
    const leavingUsername = slotKey ? room.slots[slotKey].username : ctx.username;
    const wasHost =
      room.hostId === ctx.userId || (room.roomMode !== 'rumble' && slotKey === 'p1');

    if (slotKey) {
      room.slots[slotKey] = buildEmptyHumanSlot(slotKey, room.slots[slotKey]?.charId);
    }

    const remainingHumans = [];
    for (const sid of ALL_SLOTS) {
      const s = room.slots[sid];
      if (s && s.slotMode === 'human' && s.userId && !s.isBot) {
        remainingHumans.push(sid);
      }
    }

    if (remainingHumans.length === 0) {
      rooms.delete(roomCode);
    } else if (room.roomMode !== 'rumble') {
      // 1v1 classic: promote remaining player to p1 and return to lobby
      const survivorKey = remainingHumans[0];
      if (survivorKey !== 'p1') {
        room.slots.p1 = {
          ...room.slots[survivorKey],
          slot: 'p1',
          team: 1,
          ready: true,
        };
        room.slots[survivorKey] = buildEmptyHumanSlot(survivorKey);
      } else {
        room.slots.p1.ready = true;
      }
      room.hostId = room.slots.p1.userId;
      room.status = 'lobby';
      syncLegacySlots(room);
      if (wasFighting) {
        sendToUser(room.hostId, {
          type: 'match:opponent_left',
          message: wasHost
            ? 'O anfitrião saiu da partida. Você agora é o líder da sala.'
            : 'Seu oponente saiu da batalha.',
        });
      }
      broadcastRoomState(room);
    } else {
      // Rumble mode
      if (wasHost) {
        const nextHostKey = remainingHumans[0];
        room.hostId = room.slots[nextHostKey].userId;
        room.slots[nextHostKey].ready = true;
      }
      syncLegacySlots(room);

      if (wasFighting) {
        const activeIds = getActiveSlotIds(room);
        const hasTeam1 = activeIds.some((sid) => {
          const s = room.slots[sid];
          return s.team === 1 && ((s.slotMode === 'human' && Boolean(s.userId)) || s.slotMode === 'bot');
        });
        const hasTeam2 = activeIds.some((sid) => {
          const s = room.slots[sid];
          return s.team === 2 && ((s.slotMode === 'human' && Boolean(s.userId)) || s.slotMode === 'bot');
        });

        if (wasHost || !hasTeam1 || !hasTeam2) {
          room.status = 'lobby';
          for (const uid of getRoomHumanUserIds(room)) {
            sendToUser(uid, {
              type: 'match:opponent_left',
              message: wasHost
                ? 'O anfitrião saiu da partida. Você voltou para o lobby.'
                : 'Um dos times ficou sem lutadores ativos. Retornando ao lobby.',
            });
          }
          broadcastRoomState(room);
        } else {
          for (const uid of getRoomHumanUserIds(room)) {
            sendToUser(uid, {
              type: 'match:player_left',
              slot: slotKey,
              username: leavingUsername,
            });
          }
          broadcastRoomState(room);
        }
      } else {
        broadcastRoomState(room);
      }
    }

    if (!silentToSelf) {
      sendWs(ctx.ws, { type: 'room:left', code: roomCode });
    }
    notifyFriendsOfUser(ctx.userId);
    broadcastRoomsList();
  }

  function buildFriendsOverview(userId) {
    const friendships = store.getFriendshipsForUser(userId);
    const friends = [];
    const incomingRequests = [];
    const outgoingRequests = [];

    for (const f of friendships) {
      if (f.status === 'accepted') {
        const otherId = f.fromUserId === userId ? f.toUserId : f.fromUserId;
        const other = store.findUserById(otherId);
        if (!other) continue;
        friends.push({
          friendshipId: f.id,
          userId: other.id,
          username: other.username,
          friendCode: other.friendCode,
          presence: getUserPresence(other.id),
        });
      } else if (f.status === 'pending') {
        if (f.toUserId === userId) {
          const fromUser = store.findUserById(f.fromUserId);
          if (!fromUser) continue;
          incomingRequests.push({
            friendshipId: f.id,
            createdAt: f.createdAt,
            fromUser: {
              id: fromUser.id,
              username: fromUser.username,
              friendCode: fromUser.friendCode,
            },
          });
        } else if (f.fromUserId === userId) {
          const toUser = store.findUserById(f.toUserId);
          if (!toUser) continue;
          outgoingRequests.push({
            friendshipId: f.id,
            createdAt: f.createdAt,
            toUser: {
              id: toUser.id,
              username: toUser.username,
              friendCode: toUser.friendCode,
            },
          });
        }
      }
    }

    const order = { fighting: 0, in_room: 1, online: 2, offline: 3 };
    friends.sort((a, b) => (order[a.presence.status] ?? 3) - (order[b.presence.status] ?? 3));

    return { friends, incomingRequests, outgoingRequests };
  }

  function authenticateReq(req) {
    const header = req.headers.authorization || '';
    const match = /^Bearer\s+(.+)$/i.exec(header);
    if (!match) return null;
    const payload = store.verifyToken(match[1].trim());
    if (!payload) return null;
    return store.findUserById(payload.sub);
  }

  // ==========================================================
  // HTTP REST API (/api/*)
  // ==========================================================
  const apiMiddleware = async (req, res, next) => {
    const url = new URL(req.url || '/', 'http://localhost');
    const pathname = url.pathname;
    if (!pathname.startsWith('/api/')) {
      if (typeof next === 'function') next();
      return;
    }

    const method = (req.method || 'GET').toUpperCase();
    if (method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    try {
      // POST /api/auth/register
      if (method === 'POST' && pathname === '/api/auth/register') {
        const body = await readJsonBody(req);
        const username = String(body.username || '').trim();
        const email = String(body.email || '').trim().toLowerCase();
        const password = String(body.password || '');

        if (username.length < 2 || username.length > 20 || username.includes('#')) {
          sendJson(res, 400, {
            error: 'O nome de usuário deve ter entre 2 e 20 caracteres (sem "#").',
          });
          return;
        }
        if (!email.includes('@') || !email.includes('.') || email.length < 5) {
          sendJson(res, 400, { error: 'Informe um e-mail válido.' });
          return;
        }
        if (password.length < 4 || password.length > 128) {
          sendJson(res, 400, { error: 'A senha deve ter pelo menos 4 caracteres.' });
          return;
        }
        if (store.findUserByUsername(username)) {
          sendJson(res, 409, { error: 'Este nome de usuário já está em uso.' });
          return;
        }
        if (store.findUserByEmail(email)) {
          sendJson(res, 409, { error: 'Este e-mail já está cadastrado.' });
          return;
        }

        const user = store.createUser({
          username,
          email,
          password,
          characters: body.characters,
        });
        const token = store.createToken(user.id);
        sendJson(res, 201, { token, user: store.sanitizeUser(user) });
        return;
      }

      // POST /api/auth/login
      if (method === 'POST' && pathname === '/api/auth/login') {
        const body = await readJsonBody(req);
        const identifier = String(body.identifier || body.email || body.username || '').trim();
        const password = String(body.password || '');

        if (!identifier || !password) {
          sendJson(res, 400, { error: 'Informe usuário/e-mail e senha.' });
          return;
        }

        const user = store.findUserByIdentifier(identifier);
        if (!user || !verifyPassword(password, user.salt, user.passwordHash)) {
          sendJson(res, 401, { error: 'Usuário, e-mail ou senha incorretos.' });
          return;
        }

        const token = store.createToken(user.id);
        sendJson(res, 200, { token, user: store.sanitizeUser(user) });
        return;
      }

      // GET /api/auth/me
      if (method === 'GET' && pathname === '/api/auth/me') {
        const user = authenticateReq(req);
        if (!user) {
          sendJson(res, 401, { error: 'Sessão expirada ou inválida.' });
          return;
        }
        sendJson(res, 200, { user: store.sanitizeUser(user) });
        return;
      }

      // POST /api/profile/sync
      if (method === 'POST' && pathname === '/api/profile/sync') {
        const user = authenticateReq(req);
        if (!user) {
          sendJson(res, 401, { error: 'Autenticação necessária.' });
          return;
        }
        const body = await readJsonBody(req);
        const merged = store.updateUserCharacters(user.id, body.characters || {});
        sendJson(res, 200, { characters: merged });
        return;
      }

      // GET /api/friends
      if (method === 'GET' && pathname === '/api/friends') {
        const user = authenticateReq(req);
        if (!user) {
          sendJson(res, 401, { error: 'Entre na sua conta para ver amigos.' });
          return;
        }
        sendJson(res, 200, buildFriendsOverview(user.id));
        return;
      }

      // POST /api/friends/request
      if (method === 'POST' && pathname === '/api/friends/request') {
        const user = authenticateReq(req);
        if (!user) {
          sendJson(res, 401, { error: 'Entre na sua conta para adicionar amigos.' });
          return;
        }
        const body = await readJsonBody(req);
        const query = String(body.query || body.friendCode || body.username || '').trim();
        if (!query) {
          sendJson(res, 400, { error: 'Digite a Tag (ex: GOKU#1234) ou nome de usuário.' });
          return;
        }

        const target =
          store.findUserByFriendCode(query) || store.findUserByUsername(query);
        if (!target) {
          sendJson(res, 404, {
            error: 'Jogador não encontrado. Confira a Tag (NICK#1234) ou o nome.',
          });
          return;
        }
        if (target.id === user.id) {
          sendJson(res, 400, { error: 'Você não pode adicionar a si mesmo.' });
          return;
        }

        const existing = store.findFriendshipBetween(user.id, target.id);
        if (existing) {
          if (existing.status === 'accepted') {
            sendJson(res, 409, { error: `${target.username} já está na sua lista de amigos.` });
            return;
          }
          if (existing.fromUserId === user.id) {
            sendJson(res, 409, { error: 'Solicitação já enviada. Aguardando resposta.' });
            return;
          }
          // Existing incoming request from target -> auto-accept!
          store.acceptFriendship(existing.id);
          sendToUser(target.id, { type: 'friends:updated' });
          sendToUser(user.id, { type: 'friends:updated' });
          sendJson(res, 200, {
            status: 'accepted',
            friendshipId: existing.id,
            message: `${target.username} também havia te convidado — vocês agora são amigos!`,
          });
          return;
        }

        const created = store.createFriendship(user.id, target.id, 'pending');
        sendToUser(target.id, {
          type: 'friends:updated',
          requestFrom: {
            id: user.id,
            username: user.username,
            friendCode: user.friendCode,
          },
        });
        sendJson(res, 201, {
          status: 'pending',
          friendshipId: created.id,
          target: {
            id: target.id,
            username: target.username,
            friendCode: target.friendCode,
          },
        });
        return;
      }

      // POST /api/friends/respond
      if (method === 'POST' && pathname === '/api/friends/respond') {
        const user = authenticateReq(req);
        if (!user) {
          sendJson(res, 401, { error: 'Autenticação necessária.' });
          return;
        }
        const body = await readJsonBody(req);
        const friendshipId = String(body.friendshipId || '');
        const accept = Boolean(body.accept);

        const entry = store.state.friendships.find((f) => f.id === friendshipId);
        if (!entry || entry.toUserId !== user.id || entry.status !== 'pending') {
          sendJson(res, 404, { error: 'Solicitação de amizade não encontrada.' });
          return;
        }

        if (accept) {
          store.acceptFriendship(friendshipId);
        } else {
          store.deleteFriendship(friendshipId);
        }

        sendToUser(entry.fromUserId, { type: 'friends:updated' });
        sendToUser(entry.toUserId, { type: 'friends:updated' });
        sendJson(res, 200, { ok: true, accepted: accept });
        return;
      }

      // DELETE /api/friends/:id
      if (method === 'DELETE' && pathname.startsWith('/api/friends/')) {
        const user = authenticateReq(req);
        if (!user) {
          sendJson(res, 401, { error: 'Autenticação necessária.' });
          return;
        }
        const targetParam = decodeURIComponent(pathname.slice('/api/friends/'.length));
        const byId = store.state.friendships.find(
          (f) => f.id === targetParam && (f.fromUserId === user.id || f.toUserId === user.id)
        );
        let removedOtherId = null;
        if (byId) {
          removedOtherId = byId.fromUserId === user.id ? byId.toUserId : byId.fromUserId;
          store.deleteFriendship(byId.id);
        } else {
          const between = store.findFriendshipBetween(user.id, targetParam);
          if (between) {
            removedOtherId = targetParam;
            store.deleteFriendship(between.id);
          }
        }
        if (!removedOtherId) {
          sendJson(res, 404, { error: 'Amizade não encontrada.' });
          return;
        }
        sendToUser(removedOtherId, { type: 'friends:updated' });
        sendToUser(user.id, { type: 'friends:updated' });
        sendJson(res, 200, { ok: true });
        return;
      }

      // GET /api/rooms
      if (method === 'GET' && pathname === '/api/rooms') {
        const user = authenticateReq(req);
        sendJson(res, 200, {
          rooms: getJoinableRoomsForUser(user ? user.id : null),
        });
        return;
      }

      sendJson(res, 404, { error: 'Rota da API não encontrada.' });
    } catch (err) {
      if (err && err.message === 'PAYLOAD_TOO_LARGE') {
        sendJson(res, 413, { error: 'Corpo da requisição excede o limite.' });
        return;
      }
      if (err && err.message === 'INVALID_JSON') {
        sendJson(res, 400, { error: 'JSON inválido.' });
        return;
      }
      console.error('[AnimeKombat API Error]', err);
      sendJson(res, 500, { error: 'Erro interno do servidor.' });
    }
  };

  if (middlewares && typeof middlewares.use === 'function') {
    middlewares.use(apiMiddleware);
  }

  // ==========================================================
  // WEBSOCKET SERVER (/ws)
  // ==========================================================
  function resolveIdentityFromToken(token, guestName) {
    if (token) {
      const payload = store.verifyToken(token);
      if (payload) {
        const user = store.findUserById(payload.sub);
        if (user) {
          return {
            userId: user.id,
            username: user.username,
            friendCode: user.friendCode,
            isGuest: false,
          };
        }
      }
    }
    const cleanGuest = String(guestName || 'Convidado')
      .trim()
      .slice(0, 18) || 'Convidado';
    return {
      userId: `guest:${crypto.randomUUID()}`,
      username: cleanGuest,
      friendCode: null,
      isGuest: true,
    };
  }

  wss.on('connection', (ws, req) => {
    const reqUrl = new URL(req.url || '/ws', 'http://localhost');
    const token = reqUrl.searchParams.get('token') || '';
    const guestName = reqUrl.searchParams.get('guestName') || '';
    const ident = resolveIdentityFromToken(token, guestName);

    const ctx = {
      ws,
      userId: ident.userId,
      username: ident.username,
      friendCode: ident.friendCode,
      isGuest: ident.isGuest,
      roomCode: null,
      lastPong: Date.now(),
    };

    addClientSocket(ctx);
    notifyFriendsOfUser(ctx.userId);

    sendWs(ws, {
      type: 'ws:ready',
      userId: ctx.userId,
      username: ctx.username,
      friendCode: ctx.friendCode,
      isGuest: ctx.isGuest,
      rooms: getJoinableRoomsForUser(ctx.userId),
    });

    ws.on('message', (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString('utf8'));
      } catch {
        return;
      }
      if (!msg || typeof msg.type !== 'string') return;

      switch (msg.type) {
        case 'ping': {
          ctx.lastPong = Date.now();
          sendWs(ws, { type: 'pong', ts: msg.ts ?? Date.now() });
          break;
        }

        case 'auth': {
          const nextIdent = resolveIdentityFromToken(
            typeof msg.token === 'string' ? msg.token : '',
            typeof msg.guestName === 'string' ? msg.guestName : ''
          );
          if (nextIdent.userId !== ctx.userId) {
            const oldId = ctx.userId;
            leaveCurrentRoom(ctx, true);
            removeClientSocket(ctx);
            ctx.userId = nextIdent.userId;
            ctx.username = nextIdent.username;
            ctx.friendCode = nextIdent.friendCode;
            ctx.isGuest = nextIdent.isGuest;
            addClientSocket(ctx);
            notifyFriendsOfUser(oldId);
            notifyFriendsOfUser(ctx.userId);
          }
          sendWs(ws, {
            type: 'ws:ready',
            userId: ctx.userId,
            username: ctx.username,
            friendCode: ctx.friendCode,
            isGuest: ctx.isGuest,
            rooms: getJoinableRoomsForUser(ctx.userId),
          });
          break;
        }

        case 'room:list': {
          sendWs(ws, {
            type: 'rooms:list',
            rooms: getJoinableRoomsForUser(ctx.userId),
          });
          break;
        }

        case 'room:create': {
          leaveCurrentRoom(ctx, true);
          const code = generateRoomCode(rooms);
          const roomMode = msg.roomMode === 'rumble' ? 'rumble' : '1v1';
          const teamSize = clampTeamSize(roomMode, msg.teamSize ?? (roomMode === 'rumble' ? 3 : 1));
          const p2Mode = msg.p2Mode === 'bot' ? 'bot' : 'human';
          const botDifficulty = ['easy', 'medium', 'master'].includes(msg.botDifficulty)
            ? msg.botDifficulty
            : 'medium';
          const isPublic = msg.isPublic !== false;
          const mapSeed = msg.mapSeed ? (Number(msg.mapSeed) >>> 0) || randomMapSeed() : randomMapSeed();
          const mapTheme = normalizeThemeId(msg.mapTheme);
          const p1CharId = String(msg.charId || 'goku');
          const p1StartPhase = clampPhase(msg.startPhase || 1);
          const p1Level = clampLevel(msg.level || 1);
          const botCharId = String(msg.botCharId || (p1CharId === 'luffy' ? 'goku' : 'luffy'));
          const fillBots = Boolean(msg.fillBots);

          const slots = {};
          slots.p1 = buildUserSlot(
            'p1',
            { ...ctx, charId: p1CharId, startPhase: p1StartPhase, level: p1Level },
            true
          );

          for (const sid of ALL_SLOTS.slice(1)) {
            if (roomMode === 'rumble') {
              if (fillBots || (sid === 'p2' && p2Mode === 'bot')) {
                slots[sid] = buildBotSlot(
                  sid,
                  botDifficulty,
                  sid === 'p2' && p2Mode === 'bot' ? botCharId : undefined,
                  p1StartPhase,
                  p1Level
                );
              } else {
                slots[sid] = buildEmptyHumanSlot(sid);
              }
            } else {
              slots[sid] =
                sid === 'p2' && p2Mode === 'bot'
                  ? buildBotSlot('p2', botDifficulty, botCharId, p1StartPhase, p1Level)
                  : buildEmptyHumanSlot(sid);
            }
          }

          const room = {
            code,
            isPublic,
            hostId: ctx.userId,
            roomMode,
            teamSize,
            mapSeed,
            mapTheme,
            p2Mode: slots.p2.slotMode === 'bot' ? 'bot' : 'human',
            botDifficulty,
            status: 'lobby',
            slots,
            p1: { ...slots.p1 },
            p2: { ...slots.p2 },
            createdAt: Date.now(),
          };

          rooms.set(code, room);
          ctx.roomCode = code;
          broadcastRoomState(room);
          notifyFriendsOfUser(ctx.userId);
          broadcastRoomsList();
          break;
        }

        case 'room:join': {
          const code = String(msg.code || '').trim().toUpperCase();
          const room = rooms.get(code);
          if (!room) {
            sendWs(ws, {
              type: 'room:error',
              message: `Sala #${code || '???'} não encontrada ou já encerrada.`,
            });
            return;
          }

          const existingSlot = findUserSlotKey(room, ctx.userId);
          if (existingSlot) {
            ctx.roomCode = room.code;
            sendWs(ws, { type: 'room:state', room: serializeRoom(room) });
            return;
          }

          if (room.status === 'fighting') {
            sendWs(ws, {
              type: 'room:error',
              message: 'Esta sala já está no meio de uma luta.',
            });
            return;
          }

          const activeIds = getActiveSlotIds(room);
          const openSlots = activeIds.filter((sid) => {
            const s = room.slots[sid];
            return s && s.slotMode === 'human' && !s.userId;
          });

          if (openSlots.length === 0) {
            sendWs(ws, {
              type: 'room:error',
              message: `Esta sala já está cheia (${activeIds.length}/${activeIds.length} vagas).`,
            });
            return;
          }

          // Pick an open slot balancing active fighters across Team 1 & Team 2
          const teamCount = { 1: 0, 2: 0 };
          for (const sid of activeIds) {
            const s = room.slots[sid];
            if (s && ((s.slotMode === 'human' && s.userId) || s.slotMode === 'bot')) {
              teamCount[s.team] += 1;
            }
          }
          const preferredTeam = teamCount[2] < teamCount[1] ? 2 : 1;
          const chosenSlot =
            openSlots.find((sid) => room.slots[sid].team === preferredTeam) || openSlots[0];

          leaveCurrentRoom(ctx, true);

          room.slots[chosenSlot] = buildUserSlot(
            chosenSlot,
            {
              ...ctx,
              charId: String(msg.charId || 'luffy'),
              startPhase: msg.startPhase || 1,
              level: msg.level || 1,
            },
            false
          );
          ctx.roomCode = room.code;
          syncLegacySlots(room);

          broadcastRoomState(room);
          notifyFriendsOfUser(ctx.userId);
          notifyFriendsOfUser(room.hostId);
          broadcastRoomsList();
          break;
        }

        case 'room:leave': {
          leaveCurrentRoom(ctx, false);
          break;
        }

        case 'room:config': {
          if (!ctx.roomCode) return;
          const room = rooms.get(ctx.roomCode);
          if (!room || room.hostId !== ctx.userId || room.status !== 'lobby') return;

          const kickUserInSlot = (slotId, message) => {
            const slot = room.slots[slotId];
            if (!slot || slot.slotMode !== 'human' || !slot.userId || slot.isBot) return;
            const kickedUserId = slot.userId;
            const kickedSet = userSockets.get(kickedUserId);
            if (kickedSet) {
              for (const kCtx of kickedSet) {
                if (kCtx.roomCode === room.code) kCtx.roomCode = null;
              }
            }
            sendToUser(kickedUserId, {
              type: 'room:kicked',
              code: room.code,
              message,
            });
            notifyFriendsOfUser(kickedUserId);
          };

          const hostSlotKey = findUserSlotKey(room, room.hostId) || 'p1';
          const hostLevel = room.slots[hostSlotKey]?.level || 1;
          const hostPhase = room.slots[hostSlotKey]?.startPhase || 1;

          if (typeof msg.isPublic === 'boolean') {
            room.isPublic = msg.isPublic;
          }
          if (['easy', 'medium', 'master'].includes(msg.botDifficulty)) {
            room.botDifficulty = msg.botDifficulty;
          }
          if (msg.mapTheme !== undefined) {
            room.mapTheme = normalizeThemeId(msg.mapTheme);
          }
          if (msg.rerollSeed) {
            room.mapSeed = randomMapSeed();
          }

          if (msg.roomMode === '1v1' || msg.roomMode === 'rumble') {
            if (msg.roomMode !== room.roomMode) {
              room.roomMode = msg.roomMode;
              if (room.roomMode === '1v1') {
                room.teamSize = 1;
                // Keep host in p1 and at most 1 other human in p2
                const humanEntries = ALL_SLOTS
                  .map((sid) => room.slots[sid])
                  .filter((s) => s.slotMode === 'human' && s.userId && !s.isBot);
                const hostEntry = humanEntries.find((s) => s.userId === room.hostId) || room.slots[hostSlotKey];
                const others = humanEntries.filter((s) => s.userId !== room.hostId);
                for (let i = 1; i < others.length; i += 1) {
                  kickUserInSlot(others[i].slot, 'A sala mudou para o modo 1v1 Clássico.');
                }
                room.slots.p1 = { ...hostEntry, slot: 'p1', team: 1, ready: true };
                if (others[0]) {
                  room.slots.p2 = { ...others[0], slot: 'p2', team: 2 };
                } else if (room.slots.p2.slotMode === 'bot') {
                  room.slots.p2 = buildBotSlot('p2', room.botDifficulty, room.slots.p2.charId, room.slots.p2.startPhase, hostLevel);
                } else {
                  room.slots.p2 = buildEmptyHumanSlot('p2');
                }
                for (const extraSid of ALL_SLOTS.slice(2)) {
                  room.slots[extraSid] = buildEmptyHumanSlot(extraSid);
                }
              } else {
                room.teamSize = clampTeamSize('rumble', msg.teamSize ?? 3);
                if (!room.mapSeed) room.mapSeed = randomMapSeed();
              }
            }
          }

          if (msg.teamSize !== undefined && room.roomMode === 'rumble') {
            const newSize = clampTeamSize('rumble', msg.teamSize);
            if (newSize !== room.teamSize) {
              const nextActive = ALL_SLOTS.slice(0, newSize * 2);
              const removedIds = ALL_SLOTS.slice(newSize * 2);
              for (const remSid of removedIds) {
                const remSlot = room.slots[remSid];
                if (remSlot.slotMode === 'human' && remSlot.userId && !remSlot.isBot) {
                  const freeActive = nextActive.find((sid) => {
                    const s = room.slots[sid];
                    return s.slotMode === 'human' && !s.userId;
                  }) || (remSlot.userId === room.hostId ? 'p1' : null);

                  if (freeActive) {
                    if (room.slots[freeActive].slotMode === 'human' && room.slots[freeActive].userId) {
                      kickUserInSlot(freeActive, 'A sala foi reduzida para 2v2.');
                    }
                    room.slots[freeActive] = {
                      ...remSlot,
                      slot: freeActive,
                      team: teamForSlot(freeActive),
                    };
                  } else {
                    kickUserInSlot(remSid, 'A sala foi reduzida para 2v2.');
                  }
                }
                room.slots[remSid] = buildEmptyHumanSlot(remSid);
              }
              room.teamSize = newSize;
            }
          }

          if (msg.fillBots) {
            for (const sid of getActiveSlotIds(room)) {
              const s = room.slots[sid];
              if ((s.slotMode === 'human' && !s.userId) || s.slotMode === 'closed') {
                room.slots[sid] = buildBotSlot(sid, room.botDifficulty, undefined, hostPhase, hostLevel);
              }
            }
          } else if (msg.openAllHuman) {
            const currentHostSlot = findUserSlotKey(room, room.hostId) || 'p1';
            for (const sid of getActiveSlotIds(room)) {
              if (sid === currentHostSlot) continue;
              const s = room.slots[sid];
              if (s.slotMode === 'bot' || s.slotMode === 'closed') {
                room.slots[sid] = buildEmptyHumanSlot(sid, s.charId);
              }
            }
          }

          if (msg.targetSlot && ALL_SLOTS.includes(msg.targetSlot)) {
            const ts = msg.targetSlot;
            const cur = room.slots[ts];
            if (cur.userId !== room.hostId) {
              if (msg.slotMode === 'bot') {
                kickUserInSlot(ts, 'O anfitrião substituiu sua vaga por um Bot.');
                room.slots[ts] = buildBotSlot(
                  ts,
                  room.botDifficulty,
                  String(msg.botCharId || cur.charId),
                  msg.botStartPhase ?? cur.startPhase,
                  hostLevel
                );
              } else if (msg.slotMode === 'human') {
                if (cur.slotMode !== 'human') {
                  room.slots[ts] = buildEmptyHumanSlot(ts, cur.charId);
                }
              } else if (msg.slotMode === 'closed' && room.roomMode === 'rumble') {
                kickUserInSlot(ts, 'O anfitrião fechou esta vaga.');
                room.slots[ts] = buildClosedSlot(ts);
              }
            }
          } else if (msg.p2Mode === 'bot') {
            if (room.slots.p2.userId !== room.hostId) {
              kickUserInSlot('p2', 'O anfitrião mudou a vaga para Bot.');
              const prevChar = room.slots.p2.isBot ? room.slots.p2.charId : 'luffy';
              const prevPhase = room.slots.p2.isBot ? room.slots.p2.startPhase : hostPhase;
              room.slots.p2 = buildBotSlot(
                'p2',
                room.botDifficulty,
                String(msg.botCharId || prevChar),
                msg.botStartPhase ?? prevPhase,
                hostLevel
              );
            }
          } else if (msg.p2Mode === 'human') {
            if (room.slots.p2.isBot || room.slots.p2.slotMode === 'closed') {
              room.slots.p2 = buildEmptyHumanSlot('p2');
            }
          } else if (room.slots.p2.isBot && (msg.botCharId || msg.botStartPhase !== undefined)) {
            room.slots.p2 = buildBotSlot(
              'p2',
              room.botDifficulty,
              String(msg.botCharId || room.slots.p2.charId),
              msg.botStartPhase ?? room.slots.p2.startPhase,
              hostLevel
            );
          }

          // Refresh difficulty labels on all active bot slots
          for (const sid of ALL_SLOTS) {
            const s = room.slots[sid];
            if (s.slotMode === 'bot' && s.isBot) {
              s.username = `BOT ${sid.toUpperCase()} (${difficultyLabel(room.botDifficulty)})`;
            }
          }

          syncLegacySlots(room);
          broadcastRoomState(room);
          broadcastRoomsList();
          break;
        }

        case 'room:select': {
          if (!ctx.roomCode) return;
          const room = rooms.get(ctx.roomCode);
          if (!room || room.status !== 'lobby') return;

          const mySlotKey = findUserSlotKey(room, ctx.userId);

          if (msg.switchTeam && room.roomMode === 'rumble' && mySlotKey) {
            const mySlot = room.slots[mySlotKey];
            const targetTeam = mySlot.team === 1 ? 2 : 1;
            const activeIds = getActiveSlotIds(room).filter((sid) => room.slots[sid].team === targetTeam);
            const destKey =
              activeIds.find((sid) => room.slots[sid].slotMode === 'human' && !room.slots[sid].userId) ||
              activeIds.find((sid) => room.slots[sid].slotMode === 'bot' || room.slots[sid].slotMode === 'closed');

            if (!destKey) {
              sendWs(ws, {
                type: 'room:error',
                message: 'O outro time já está totalmente ocupado por jogadores!',
              });
              return;
            }

            const destSlot = room.slots[destKey];
            room.slots[destKey] = {
              ...mySlot,
              slot: destKey,
              team: teamForSlot(destKey),
            };
            if (destSlot.slotMode === 'bot') {
              room.slots[mySlotKey] = buildBotSlot(
                mySlotKey,
                room.botDifficulty,
                destSlot.charId,
                destSlot.startPhase,
                destSlot.level
              );
            } else if (destSlot.slotMode === 'closed') {
              room.slots[mySlotKey] = buildClosedSlot(mySlotKey);
            } else {
              room.slots[mySlotKey] = buildEmptyHumanSlot(mySlotKey);
            }

            syncLegacySlots(room);
            broadcastRoomState(room);
            broadcastRoomsList();
            return;
          }

          let slot = null;
          if (
            msg.targetSlot &&
            ALL_SLOTS.includes(msg.targetSlot) &&
            room.hostId === ctx.userId &&
            room.slots[msg.targetSlot]?.slotMode === 'bot'
          ) {
            slot = room.slots[msg.targetSlot];
          } else if (mySlotKey) {
            slot = room.slots[mySlotKey];
          }
          if (!slot) return;

          if (typeof msg.charId === 'string' && msg.charId.trim()) {
            slot.charId = msg.charId.trim();
          }
          if (msg.startPhase !== undefined) {
            slot.startPhase = clampPhase(msg.startPhase);
          }
          if (msg.level !== undefined) {
            slot.level = clampLevel(msg.level);
          }
          if (typeof msg.ready === 'boolean' && slot.userId !== room.hostId && !slot.isBot) {
            slot.ready = msg.ready;
          }

          syncLegacySlots(room);
          broadcastRoomState(room);
          break;
        }

        case 'room:invite': {
          if (!ctx.roomCode) {
            sendWs(ws, {
              type: 'room:error',
              message: 'Crie ou entre em uma sala antes de convidar um amigo.',
            });
            return;
          }
          const room = rooms.get(ctx.roomCode);
          if (!room || room.status !== 'lobby') return;

          const toUserId = String(msg.toUserId || '');
          if (!toUserId || toUserId === ctx.userId) return;

          const delivered = sendToUser(toUserId, {
            type: 'room:invited',
            invite: {
              roomCode: room.code,
              fromUser: {
                id: ctx.userId,
                username: ctx.username,
                friendCode: ctx.friendCode,
              },
              timestamp: Date.now(),
            },
          });

          if (!delivered) {
            sendWs(ws, {
              type: 'room:error',
              message: 'Seu amigo não está conectado no momento.',
            });
            return;
          }

          sendWs(ws, {
            type: 'room:invite_sent',
            toUserId,
            roomCode: room.code,
          });
          break;
        }

        case 'room:start': {
          if (!ctx.roomCode) return;
          const room = rooms.get(ctx.roomCode);
          if (!room || room.hostId !== ctx.userId || room.status !== 'lobby') return;

          const activeIds = getActiveSlotIds(room);

          if (room.roomMode !== 'rumble') {
            if (room.slots.p2.slotMode === 'human') {
              if (!room.slots.p2.userId) {
                sendWs(ws, {
                  type: 'room:error',
                  message: 'Aguarde um amigo entrar na sala ou troque o P2 para Bot.',
                });
                return;
              }
              if (!room.slots.p2.ready) {
                sendWs(ws, {
                  type: 'room:error',
                  message: 'Aguarde seu amigo clicar em "Pronto!" para iniciar.',
                });
                return;
              }
            }
          } else {
            for (const sid of activeIds) {
              const s = room.slots[sid];
              if (s.slotMode === 'human' && s.userId && s.userId !== room.hostId && !s.ready) {
                sendWs(ws, {
                  type: 'room:error',
                  message: `Aguarde ${s.username} clicar em "Pronto!" para iniciar.`,
                });
                return;
              }
            }
          }

          const participants = [];
          let team1Active = 0;
          let team2Active = 0;
          for (const sid of activeIds) {
            const s = room.slots[sid];
            if (!s || s.slotMode === 'closed') continue;
            if (s.slotMode === 'human' && !s.userId) continue;
            const phase =
              s.isBot && room.botDifficulty === 'master'
                ? Math.min(4, s.startPhase)
                : s.startPhase;
            participants.push({
              slot: sid,
              team: s.team,
              userId: s.userId,
              displayName: s.username,
              charId: s.charId,
              startPhase: phase,
              level: s.level,
              isBot: Boolean(s.isBot),
            });
            if (s.team === 1) team1Active += 1;
            else team2Active += 1;
          }

          if (team1Active === 0 || team2Active === 0) {
            sendWs(ws, {
              type: 'room:error',
              message: 'Os dois times precisam ter pelo menos 1 lutador ativo (jogador ou bot)!',
            });
            return;
          }

          room.status = 'fighting';
          syncLegacySlots(room);

          const humanIds = getRoomHumanUserIds(room);
          const mode =
            room.roomMode === 'rumble'
              ? humanIds.length > 1
                ? 'online'
                : 'room-bot'
              : room.p2Mode === 'bot'
                ? 'room-bot'
                : 'online';

          const p1Legacy = participants.find((p) => p.team === 1) || participants[0];
          const p2Legacy = participants.find((p) => p.team === 2) || participants[1] || p1Legacy;
          const hostSlot = findUserSlotKey(room, room.hostId) || 'p1';

          const baseConfig = {
            p1CharId: p1Legacy.charId,
            p2CharId: p2Legacy.charId,
            p1StartPhase: p1Legacy.startPhase,
            p2StartPhase: p2Legacy.startPhase,
            p1Level: p1Legacy.level,
            p2Level: p2Legacy.level,
            p1DisplayName: p1Legacy.displayName,
            p2DisplayName: p2Legacy.displayName,
            difficulty: room.botDifficulty,
            mode,
            roomMode: room.roomMode,
            teamSize: room.teamSize,
            mapSeed: room.mapSeed,
            mapTheme: room.mapTheme,
            roomCode: room.code,
            hostSlot,
            participants,
          };

          for (const sid of activeIds) {
            const s = room.slots[sid];
            if (s.slotMode === 'human' && s.userId && !s.isBot) {
              sendToUser(s.userId, {
                type: 'match:start',
                matchConfig: { ...baseConfig, localSlot: sid },
              });
              notifyFriendsOfUser(s.userId);
            }
          }

          broadcastRoomState(room);
          broadcastRoomsList();
          break;
        }

        case 'match:sync': {
          if (!ctx.roomCode) return;
          const room = rooms.get(ctx.roomCode);
          if (!room || room.status !== 'fighting') return;
          for (const uid of getRoomHumanUserIds(room)) {
            if (uid === ctx.userId) continue;
            sendToUser(uid, {
              type: 'match:sync',
              payload: msg.payload,
            });
          }
          break;
        }

        case 'match:event': {
          if (!ctx.roomCode) return;
          const room = rooms.get(ctx.roomCode);
          if (!room) return;
          for (const uid of getRoomHumanUserIds(room)) {
            if (uid === ctx.userId) continue;
            sendToUser(uid, {
              type: 'match:event',
              payload: msg.payload,
            });
          }
          break;
        }

        case 'match:end':
        case 'room:return_lobby': {
          if (!ctx.roomCode) return;
          const room = rooms.get(ctx.roomCode);
          if (!room) return;
          const changed = room.status !== 'lobby';
          room.status = 'lobby';
          if (msg.type === 'match:end') {
            for (const sid of ALL_SLOTS) {
              const s = room.slots[sid];
              if (s.slotMode === 'human' && s.userId && !s.isBot && s.userId !== room.hostId) {
                s.ready = false;
              }
            }
          }
          if (changed) {
            for (const uid of getRoomHumanUserIds(room)) {
              notifyFriendsOfUser(uid);
            }
            broadcastRoomState(room);
            broadcastRoomsList();
          } else if (msg.type === 'room:return_lobby') {
            sendWs(ws, { type: 'room:state', room: serializeRoom(room) });
          }
          break;
        }
      }
    });

    ws.on('close', () => {
      leaveCurrentRoom(ctx, true);
      removeClientSocket(ctx);
      notifyFriendsOfUser(ctx.userId);
    });
  });

  const upgradeHandler = (req, socket, head) => {
    try {
      const reqUrl = new URL(req.url || '/', 'http://localhost');
      if (reqUrl.pathname !== '/ws') return;
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
      });
    } catch {
      socket.destroy();
    }
  };

  if (httpServer && typeof httpServer.on === 'function') {
    httpServer.on('upgrade', upgradeHandler);
  }

  return {
    store,
    wss,
    rooms,
    apiMiddleware,
    close: async () => {
      if (httpServer && typeof httpServer.off === 'function') {
        httpServer.off('upgrade', upgradeHandler);
      }
      for (const client of wss.clients) {
        client.terminate();
      }
      await new Promise((resolve) => wss.close(() => resolve()));
    },
  };
}

