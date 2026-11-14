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

  function serializeRoom(room) {
    return {
      code: room.code,
      isPublic: room.isPublic,
      hostId: room.hostId,
      p2Mode: room.p2Mode,
      botDifficulty: room.botDifficulty,
      status: room.status,
      p1: { ...room.p1 },
      p2: { ...room.p2 },
      createdAt: room.createdAt,
    };
  }

  function broadcastRoomState(room) {
    const payload = { type: 'room:state', room: serializeRoom(room) };
    if (room.p1.userId) sendToUser(room.p1.userId, payload);
    if (room.p2.userId && !room.p2.isBot) sendToUser(room.p2.userId, payload);
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
      const hasOpenHumanSlot = room.p2Mode === 'human' && !room.p2.userId;
      if (!room.isPublic && !isFriendHost) continue;
      if (!hasOpenHumanSlot && !isFriendHost) continue;

      list.push({
        code: room.code,
        hostName: room.p1.username,
        hostFriendCode: room.p1.friendCode,
        isFriend: isFriendHost,
        p2Mode: room.p2Mode,
        hasFreeSlot: room.p2Mode === 'human' && !room.p2.userId,
        p1CharId: room.p1.charId,
        p1Phase: room.p1.startPhase,
        isPublic: room.isPublic,
      });
    }
    return list;
  }

  function buildBotSlot(difficulty, charId = 'luffy', startPhase = 1, level = 1) {
    return {
      userId: 'bot',
      username: `BOT (${difficultyLabel(difficulty)})`,
      friendCode: null,
      isGuest: false,
      isBot: true,
      charId,
      startPhase: clampPhase(startPhase),
      level: clampLevel(level),
      ready: true,
    };
  }

  function buildEmptyHumanSlot() {
    return {
      userId: null,
      username: 'Aguardando Amigo...',
      friendCode: null,
      isGuest: false,
      isBot: false,
      charId: 'luffy',
      startPhase: 1,
      level: 1,
      ready: false,
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

    if (room.p1.userId === ctx.userId) {
      if (room.p2.userId && !room.p2.isBot) {
        // Promote P2 to Host
        room.p1 = {
          ...room.p2,
          ready: true,
        };
        room.hostId = room.p1.userId;
        room.p2 = buildEmptyHumanSlot();
        room.p2Mode = 'human';
        room.status = 'lobby';
        if (wasFighting) {
          sendToUser(room.p1.userId, {
            type: 'match:opponent_left',
            message: 'O anfitrião saiu da partida. Você agora é o líder da sala.',
          });
        }
        broadcastRoomState(room);
      } else {
        rooms.delete(roomCode);
      }
    } else if (room.p2.userId === ctx.userId) {
      room.p2 = buildEmptyHumanSlot();
      room.p2Mode = 'human';
      room.status = 'lobby';
      if (wasFighting) {
        sendToUser(room.p1.userId, {
          type: 'match:opponent_left',
          message: 'Seu oponente saiu da batalha.',
        });
      }
      broadcastRoomState(room);
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
          const p2Mode = msg.p2Mode === 'bot' ? 'bot' : 'human';
          const botDifficulty = ['easy', 'medium', 'master'].includes(msg.botDifficulty)
            ? msg.botDifficulty
            : 'medium';
          const isPublic = msg.isPublic !== false;
          const p1CharId = String(msg.charId || 'goku');
          const p1StartPhase = clampPhase(msg.startPhase || 1);
          const p1Level = clampLevel(msg.level || 1);
          const botCharId = String(msg.botCharId || (p1CharId === 'luffy' ? 'goku' : 'luffy'));

          const room = {
            code,
            isPublic,
            hostId: ctx.userId,
            p2Mode,
            botDifficulty,
            status: 'lobby',
            p1: {
              userId: ctx.userId,
              username: ctx.username,
              friendCode: ctx.friendCode,
              isGuest: ctx.isGuest,
              isBot: false,
              charId: p1CharId,
              startPhase: p1StartPhase,
              level: p1Level,
              ready: true,
            },
            p2:
              p2Mode === 'bot'
                ? buildBotSlot(botDifficulty, botCharId, p1StartPhase, p1Level)
                : buildEmptyHumanSlot(),
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

          if (room.p1.userId === ctx.userId || room.p2.userId === ctx.userId) {
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

          if (room.p2.userId && !room.p2.isBot) {
            sendWs(ws, {
              type: 'room:error',
              message: 'Esta sala já está cheia (2/2 jogadores).',
            });
            return;
          }

          leaveCurrentRoom(ctx, true);

          room.p2Mode = 'human';
          room.p2 = {
            userId: ctx.userId,
            username: ctx.username,
            friendCode: ctx.friendCode,
            isGuest: ctx.isGuest,
            isBot: false,
            charId: String(msg.charId || 'luffy'),
            startPhase: clampPhase(msg.startPhase || 1),
            level: clampLevel(msg.level || 1),
            ready: false,
          };
          ctx.roomCode = room.code;

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

          if (typeof msg.isPublic === 'boolean') {
            room.isPublic = msg.isPublic;
          }
          if (['easy', 'medium', 'master'].includes(msg.botDifficulty)) {
            room.botDifficulty = msg.botDifficulty;
          }

          if (msg.p2Mode === 'bot') {
            if (room.p2.userId && !room.p2.isBot) {
              const kickedUserId = room.p2.userId;
              const kickedSet = userSockets.get(kickedUserId);
              if (kickedSet) {
                for (const kCtx of kickedSet) {
                  if (kCtx.roomCode === room.code) kCtx.roomCode = null;
                }
              }
              sendToUser(kickedUserId, {
                type: 'room:kicked',
                code: room.code,
                message: 'O anfitrião mudou a sala para jogar contra Bot.',
              });
              notifyFriendsOfUser(kickedUserId);
            }
            room.p2Mode = 'bot';
            const prevChar = room.p2.isBot ? room.p2.charId : 'luffy';
            const prevPhase = room.p2.isBot ? room.p2.startPhase : room.p1.startPhase;
            room.p2 = buildBotSlot(
              room.botDifficulty,
              String(msg.botCharId || prevChar),
              msg.botStartPhase ?? prevPhase,
              room.p1.level
            );
          } else if (msg.p2Mode === 'human') {
            room.p2Mode = 'human';
            if (room.p2.isBot) {
              room.p2 = buildEmptyHumanSlot();
            }
          } else if (room.p2Mode === 'bot' && room.p2.isBot) {
            // Update bot metadata when difficulty/char/phase changed
            room.p2 = buildBotSlot(
              room.botDifficulty,
              String(msg.botCharId || room.p2.charId),
              msg.botStartPhase ?? room.p2.startPhase,
              room.p1.level
            );
          }

          broadcastRoomState(room);
          broadcastRoomsList();
          break;
        }

        case 'room:select': {
          if (!ctx.roomCode) return;
          const room = rooms.get(ctx.roomCode);
          if (!room || room.status !== 'lobby') return;

          let slot = null;
          if (msg.targetSlot === 'p2' && room.hostId === ctx.userId && room.p2Mode === 'bot') {
            slot = room.p2;
          } else if (room.p1.userId === ctx.userId) {
            slot = room.p1;
          } else if (room.p2.userId === ctx.userId) {
            slot = room.p2;
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
          if (typeof msg.ready === 'boolean' && slot === room.p2 && !slot.isBot) {
            slot.ready = msg.ready;
          }

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

          if (room.p2Mode === 'human') {
            if (!room.p2.userId) {
              sendWs(ws, {
                type: 'room:error',
                message: 'Aguarde um amigo entrar na sala ou troque o P2 para Bot.',
              });
              return;
            }
            if (!room.p2.ready) {
              sendWs(ws, {
                type: 'room:error',
                message: 'Aguarde seu amigo clicar em "Pronto!" para iniciar.',
              });
              return;
            }
          }

          room.status = 'fighting';

          const p2Phase =
            room.p2Mode === 'bot' && room.botDifficulty === 'master'
              ? Math.min(4, room.p2.startPhase)
              : room.p2.startPhase;

          const baseConfig = {
            p1CharId: room.p1.charId,
            p2CharId: room.p2.charId,
            p1StartPhase: room.p1.startPhase,
            p2StartPhase: p2Phase,
            p1Level: room.p1.level,
            p2Level: room.p2.level,
            p1DisplayName: room.p1.username,
            p2DisplayName: room.p2.username,
            difficulty: room.botDifficulty,
            mode: room.p2Mode === 'bot' ? 'room-bot' : 'online',
            roomCode: room.code,
          };

          sendToUser(room.p1.userId, {
            type: 'match:start',
            matchConfig: { ...baseConfig, localSlot: 'p1' },
          });

          if (room.p2Mode === 'human' && room.p2.userId) {
            sendToUser(room.p2.userId, {
              type: 'match:start',
              matchConfig: { ...baseConfig, localSlot: 'p2' },
            });
            notifyFriendsOfUser(room.p2.userId);
          }

          notifyFriendsOfUser(room.p1.userId);
          broadcastRoomState(room);
          broadcastRoomsList();
          break;
        }

        case 'match:sync': {
          if (!ctx.roomCode) return;
          const room = rooms.get(ctx.roomCode);
          if (!room || room.status !== 'fighting' || room.p2Mode !== 'human') return;
          const targetId =
            room.p1.userId === ctx.userId ? room.p2.userId : room.p1.userId;
          if (!targetId) return;
          sendToUser(targetId, {
            type: 'match:sync',
            payload: msg.payload,
          });
          break;
        }

        case 'match:event': {
          if (!ctx.roomCode) return;
          const room = rooms.get(ctx.roomCode);
          if (!room || room.p2Mode !== 'human') return;
          const targetId =
            room.p1.userId === ctx.userId ? room.p2.userId : room.p1.userId;
          if (!targetId) return;
          sendToUser(targetId, {
            type: 'match:event',
            payload: msg.payload,
          });
          break;
        }

        case 'match:end':
        case 'room:return_lobby': {
          if (!ctx.roomCode) return;
          const room = rooms.get(ctx.roomCode);
          if (!room) return;
          const changed = room.status !== 'lobby';
          room.status = 'lobby';
          if (room.p2Mode === 'human' && !room.p2.isBot) {
            if (msg.type === 'match:end') {
              room.p2.ready = false;
            }
          }
          if (changed) {
            notifyFriendsOfUser(room.p1.userId);
            if (room.p2.userId && !room.p2.isBot) notifyFriendsOfUser(room.p2.userId);
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

