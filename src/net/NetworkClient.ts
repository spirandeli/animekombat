import type { FighterInputState } from '../engine/InputManager';
import type { AIDifficulty } from '../game/AIController';
import type { MatchConfig } from '../game/ArenaScene';
import type { FighterState } from '../game/Fighter';
import { CharacterProgress, SaveManager } from '../storage/SaveManager';

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  friendCode: string;
  createdAt: string;
  characters: Record<string, CharacterProgress>;
}

export interface PresenceInfo {
  status: 'online' | 'in_room' | 'fighting' | 'offline';
  roomCode: string | null;
}

export interface FriendEntry {
  friendshipId: string;
  userId: string;
  username: string;
  friendCode: string;
  presence: PresenceInfo;
}

export interface FriendRequestEntry {
  friendshipId: string;
  createdAt: string;
  fromUser?: {
    id: string;
    username: string;
    friendCode: string;
  };
  toUser?: {
    id: string;
    username: string;
    friendCode: string;
  };
}

export interface FriendsOverview {
  friends: FriendEntry[];
  incomingRequests: FriendRequestEntry[];
  outgoingRequests: FriendRequestEntry[];
}

export interface RoomSlotState {
  userId: string | null;
  username: string;
  friendCode: string | null;
  isGuest: boolean;
  isBot: boolean;
  charId: string;
  startPhase: number;
  level: number;
  ready: boolean;
}

export interface RoomState {
  code: string;
  isPublic: boolean;
  hostId: string;
  p2Mode: 'human' | 'bot';
  botDifficulty: AIDifficulty;
  status: 'lobby' | 'fighting';
  p1: RoomSlotState;
  p2: RoomSlotState;
  createdAt: number;
}

export interface OpenRoomSummary {
  code: string;
  hostName: string;
  hostFriendCode: string | null;
  isFriend: boolean;
  p2Mode: 'human' | 'bot';
  hasFreeSlot: boolean;
  p1CharId: string;
  p1Phase: number;
  isPublic: boolean;
}

export interface RoomInvitePayload {
  roomCode: string;
  fromUser: {
    id: string;
    username: string;
    friendCode: string | null;
  };
  timestamp: number;
}

export interface RemoteFighterSyncPayload {
  slot: 'p1' | 'p2';
  seq: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  grounded: boolean;
  hp: number;
  peerHp?: number;
  roundTimer?: number;
  ki: number;
  evoEnergy: number;
  phase: number;
  state: FighterState;
  stateTime: number;
  hitstunRemaining: number;
  invulnTime: number;
  input: FighterInputState;
}

export interface CombatEventPayload {
  kind: 'attack' | 'hit' | 'projectile' | 'evolve' | 'ko';
  slot: 'p1' | 'p2';
  action?: 'ataque_1' | 'ataque_2' | 'ataque_3' | 'ataque_4';
  newPhase?: number;
  damage?: number;
  blocked?: boolean;
  winner?: 'p1' | 'p2' | 'draw';
  p1HpRemaining?: number;
  p2HpRemaining?: number;
  p1FinalPhase?: number;
}

export interface NetworkEventMap {
  authChanged: UserProfile | null;
  wsStatusChanged: boolean;
  friendsUpdated: void;
  roomsListUpdated: OpenRoomSummary[];
  roomUpdated: RoomState | null;
  roomLeft: { code?: string; reason?: string };
  roomError: string;
  inviteReceived: RoomInvitePayload;
  inviteSent: { toUserId: string; roomCode: string };
  matchStart: MatchConfig;
  remoteSync: RemoteFighterSyncPayload;
  remoteEvent: CombatEventPayload;
  opponentLeft: string;
}

const TOKEN_STORAGE_KEY = 'animekombat_auth_token_v1';
const GUEST_ID_STORAGE_KEY = 'animekombat_guest_id_v1';
const LOCAL_CHANNEL_NAME = 'animekombat_local_rooms';

function generateLocalCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export class NetworkClient {
  private readonly save: SaveManager;
  private token: string | null = null;
  private user: UserProfile | null = null;
  private clientActorId: string;
  private ws: WebSocket | null = null;
  private wsConnected = false;
  private reconnectTimer: number | null = null;
  private reconnectAttempts = 0;
  private pingTimer: number | null = null;
  private manualClose = false;

  private currentRoom: RoomState | null = null;
  private openRooms: OpenRoomSummary[] = [];
  private friendsCache: FriendsOverview = {
    friends: [],
    incomingRequests: [],
    outgoingRequests: [],
  };

  // Fallback offline via BroadcastChannel (multi-aba / modo Bot offline)
  private localChannel: BroadcastChannel | null = null;
  private localRooms = new Map<string, RoomState>();

  private listeners: {
    [K in keyof NetworkEventMap]?: Set<(payload: NetworkEventMap[K]) => void>;
  } = {};

  constructor(save: SaveManager) {
    this.save = save;
    this.token = this.readToken();
    this.clientActorId = this.getOrCreateGuestId();
    this.setupLocalChannel();
  }

  public on<K extends keyof NetworkEventMap>(
    event: K,
    handler: (payload: NetworkEventMap[K]) => void
  ): () => void {
    let set = this.listeners[event] as
      | Set<(payload: NetworkEventMap[K]) => void>
      | undefined;
    if (!set) {
      set = new Set();
      this.listeners[event] = set as never;
    }
    set.add(handler);
    return () => {
      set?.delete(handler);
    };
  }

  private emit<K extends keyof NetworkEventMap>(
    event: K,
    payload: NetworkEventMap[K]
  ): void {
    const set = this.listeners[event] as
      | Set<(payload: NetworkEventMap[K]) => void>
      | undefined;
    if (!set) return;
    for (const fn of set) {
      fn(payload);
    }
  }

  public getUser(): UserProfile | null {
    return this.user;
  }

  public isAuthenticated(): boolean {
    return this.user !== null && this.token !== null;
  }

  public isOnline(): boolean {
    return this.wsConnected;
  }

  public getActorId(): string {
    return this.user?.id ?? this.clientActorId;
  }

  public getDisplayName(): string {
    return this.user?.username ?? 'Convidado';
  }

  public getCurrentRoom(): RoomState | null {
    return this.currentRoom;
  }

  public getOpenRooms(): OpenRoomSummary[] {
    return this.openRooms;
  }

  public getFriendsOverview(): FriendsOverview {
    return this.friendsCache;
  }

  public async initSession(): Promise<void> {
    if (this.token) {
      try {
        await this.fetchMe();
        await this.syncProgress();
        await this.fetchFriends().catch(() => undefined);
      } catch {
        // Se token expirou (401), fetchMe limpa; se offline, mantém token para tentar depois
      }
    }
    this.connectWebSocket();
  }

  public async register(
    username: string,
    email: string,
    password: string
  ): Promise<UserProfile> {
    const res = await this.apiFetch<{ token: string; user: UserProfile }>(
      '/api/auth/register',
      {
        method: 'POST',
        body: JSON.stringify({
          username,
          email,
          password,
          characters: this.save.getData().characters,
        }),
      }
    );
    this.setSession(res.token, res.user);
    return res.user;
  }

  public async login(identifier: string, password: string): Promise<UserProfile> {
    const res = await this.apiFetch<{ token: string; user: UserProfile }>(
      '/api/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ identifier, password }),
      }
    );
    this.setSession(res.token, res.user);
    await this.syncProgress().catch(() => undefined);
    await this.fetchFriends().catch(() => undefined);
    return res.user;
  }

  public logout(): void {
    this.leaveRoom();
    this.token = null;
    this.user = null;
    this.friendsCache = {
      friends: [],
      incomingRequests: [],
      outgoingRequests: [],
    };
    this.writeToken(null);
    this.emit('authChanged', null);
    this.emit('friendsUpdated', undefined);
    if (this.wsConnected) {
      this.sendWs({ type: 'auth', token: '', guestName: 'Convidado' });
    }
  }

  public async fetchMe(): Promise<UserProfile> {
    const res = await this.apiFetch<{ user: UserProfile }>('/api/auth/me', {
      method: 'GET',
    });
    this.user = res.user;
    this.clientActorId = res.user.id;
    this.save.mergeRemoteProgress(res.user.characters);
    this.emit('authChanged', this.user);
    return res.user;
  }

  public async syncProgress(): Promise<void> {
    if (!this.token) return;
    try {
      const res = await this.apiFetch<{
        characters: Record<string, CharacterProgress>;
      }>('/api/profile/sync', {
        method: 'POST',
        body: JSON.stringify({
          characters: this.save.getData().characters,
        }),
      });
      this.save.mergeRemoteProgress(res.characters);
      if (this.user) {
        this.user.characters = res.characters;
      }
    } catch {
      // Ignora offline para manter progresso local intacto
    }
  }

  public async fetchFriends(): Promise<FriendsOverview> {
    if (!this.token) {
      this.friendsCache = {
        friends: [],
        incomingRequests: [],
        outgoingRequests: [],
      };
      return this.friendsCache;
    }
    const res = await this.apiFetch<FriendsOverview>('/api/friends', {
      method: 'GET',
    });
    this.friendsCache = res;
    this.emit('friendsUpdated', undefined);
    return res;
  }

  public async sendFriendRequest(
    query: string
  ): Promise<{ status: string; message?: string }> {
    const res = await this.apiFetch<{ status: string; message?: string }>(
      '/api/friends/request',
      {
        method: 'POST',
        body: JSON.stringify({ query }),
      }
    );
    await this.fetchFriends().catch(() => undefined);
    return res;
  }

  public async respondFriendRequest(
    friendshipId: string,
    accept: boolean
  ): Promise<void> {
    await this.apiFetch('/api/friends/respond', {
      method: 'POST',
      body: JSON.stringify({ friendshipId, accept }),
    });
    await this.fetchFriends().catch(() => undefined);
  }

  public async removeFriend(friendIdOrFriendshipId: string): Promise<void> {
    await this.apiFetch(
      `/api/friends/${encodeURIComponent(friendIdOrFriendshipId)}`,
      { method: 'DELETE' }
    );
    await this.fetchFriends().catch(() => undefined);
  }

  public async fetchOpenRooms(): Promise<OpenRoomSummary[]> {
    try {
      const res = await this.apiFetch<{ rooms: OpenRoomSummary[] }>('/api/rooms', {
        method: 'GET',
      });
      this.openRooms = res.rooms;
      this.emit('roomsListUpdated', this.openRooms);
      return this.openRooms;
    } catch {
      return this.openRooms;
    }
  }

  public connectWebSocket(): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }
    this.manualClose = false;
    if (typeof window === 'undefined' || typeof WebSocket === 'undefined') return;

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const qs = new URLSearchParams();
    if (this.token) qs.set('token', this.token);
    qs.set('guestName', this.getDisplayName());

    const wsUrl = `${proto}//${window.location.host}/ws?${qs.toString()}`;
    try {
      const ws = new WebSocket(wsUrl);
      this.ws = ws;

      ws.addEventListener('open', () => {
        this.wsConnected = true;
        this.reconnectAttempts = 0;
        this.emit('wsStatusChanged', true);
        this.startPing();
      });

      ws.addEventListener('message', (ev) => {
        this.handleWsMessage(String(ev.data || ''));
      });

      ws.addEventListener('close', () => {
        const wasConnected = this.wsConnected;
        this.wsConnected = false;
        this.ws = null;
        this.stopPing();
        if (wasConnected) {
          this.emit('wsStatusChanged', false);
        }
        if (!this.manualClose) {
          this.scheduleReconnect();
        }
      });

      ws.addEventListener('error', () => {
        // O evento close tratará a reconexão
      });
    } catch {
      this.scheduleReconnect();
    }
  }

  public requestRoomList(): void {
    if (this.wsConnected) {
      this.sendWs({ type: 'room:list' });
    } else {
      void this.fetchOpenRooms();
    }
  }

  public createRoom(options?: {
    p2Mode?: 'human' | 'bot';
    botDifficulty?: AIDifficulty;
    isPublic?: boolean;
    charId?: string;
    startPhase?: number;
    level?: number;
  }): void {
    const charId = options?.charId ?? 'goku';
    const prog = this.save.getCharacterProgress(charId);
    const payload = {
      type: 'room:create',
      p2Mode: options?.p2Mode ?? 'human',
      botDifficulty: options?.botDifficulty ?? this.save.getData().settings.difficulty,
      isPublic: options?.isPublic ?? true,
      charId,
      startPhase: options?.startPhase ?? 1,
      level: options?.level ?? prog.level,
    };

    if (this.wsConnected) {
      this.sendWs(payload);
      return;
    }

    // Fallback offline para sala local (Bot ou BroadcastChannel entre abas)
    const code = generateLocalCode();
    const diff = payload.botDifficulty;
    const room: RoomState = {
      code,
      isPublic: payload.isPublic,
      hostId: this.getActorId(),
      p2Mode: payload.p2Mode,
      botDifficulty: diff,
      status: 'lobby',
      p1: {
        userId: this.getActorId(),
        username: this.getDisplayName(),
        friendCode: this.user?.friendCode ?? null,
        isGuest: !this.user,
        isBot: false,
        charId: payload.charId,
        startPhase: payload.startPhase,
        level: payload.level,
        ready: true,
      },
      p2:
        payload.p2Mode === 'bot'
          ? {
              userId: 'bot',
              username: `BOT (${diff === 'easy' ? 'Fácil' : diff === 'master' ? 'Mestre' : 'Médio'})`,
              friendCode: null,
              isGuest: false,
              isBot: true,
              charId: payload.charId === 'luffy' ? 'goku' : 'luffy',
              startPhase: payload.startPhase,
              level: payload.level,
              ready: true,
            }
          : {
              userId: null,
              username: 'Aguardando Amigo...',
              friendCode: null,
              isGuest: false,
              isBot: false,
              charId: 'luffy',
              startPhase: 1,
              level: 1,
              ready: false,
            },
      createdAt: Date.now(),
    };
    this.localRooms.set(code, room);
    this.currentRoom = room;
    this.broadcastLocal({ type: 'room:state', room });
    this.emit('roomUpdated', room);
  }

  public joinRoom(
    code: string,
    options?: { charId?: string; startPhase?: number; level?: number }
  ): void {
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) return;
    const charId = options?.charId ?? 'luffy';
    const prog = this.save.getCharacterProgress(charId);

    if (this.wsConnected) {
      this.sendWs({
        type: 'room:join',
        code: cleanCode,
        charId,
        startPhase: options?.startPhase ?? 1,
        level: options?.level ?? prog.level,
      });
      return;
    }

    const localRoom = this.localRooms.get(cleanCode);
    if (localRoom && !localRoom.p2.userId) {
      localRoom.p2Mode = 'human';
      localRoom.p2 = {
        userId: this.getActorId(),
        username: this.getDisplayName(),
        friendCode: this.user?.friendCode ?? null,
        isGuest: !this.user,
        isBot: false,
        charId,
        startPhase: options?.startPhase ?? 1,
        level: options?.level ?? prog.level,
        ready: false,
      };
      this.currentRoom = localRoom;
      this.broadcastLocal({ type: 'room:state', room: localRoom });
      this.emit('roomUpdated', localRoom);
    } else {
      this.emit(
        'roomError',
        'Sem conexão com o servidor para entrar nessa sala.'
      );
    }
  }

  public leaveRoom(): void {
    if (this.wsConnected) {
      this.sendWs({ type: 'room:leave' });
    }
    const prev = this.currentRoom;
    this.currentRoom = null;
    if (prev && !this.wsConnected) {
      this.localRooms.delete(prev.code);
      this.emit('roomLeft', { code: prev.code });
    }
    this.emit('roomUpdated', null);
  }

  public updateRoomConfig(patch: {
    p2Mode?: 'human' | 'bot';
    botDifficulty?: AIDifficulty;
    botCharId?: string;
    botStartPhase?: number;
    isPublic?: boolean;
  }): void {
    if (this.wsConnected) {
      this.sendWs({ type: 'room:config', ...patch });
      return;
    }

    const room = this.currentRoom;
    if (!room || room.hostId !== this.getActorId()) return;
    if (patch.botDifficulty) room.botDifficulty = patch.botDifficulty;
    if (typeof patch.isPublic === 'boolean') room.isPublic = patch.isPublic;
    if (patch.p2Mode === 'bot') {
      room.p2Mode = 'bot';
      room.p2 = {
        userId: 'bot',
        username: `BOT (${room.botDifficulty === 'easy' ? 'Fácil' : room.botDifficulty === 'master' ? 'Mestre' : 'Médio'})`,
        friendCode: null,
        isGuest: false,
        isBot: true,
        charId: patch.botCharId ?? (room.p2.isBot ? room.p2.charId : 'luffy'),
        startPhase: patch.botStartPhase ?? room.p1.startPhase,
        level: room.p1.level,
        ready: true,
      };
    } else if (patch.p2Mode === 'human') {
      room.p2Mode = 'human';
      if (room.p2.isBot) {
        room.p2 = {
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
    } else if (room.p2Mode === 'bot') {
      room.p2.username = `BOT (${room.botDifficulty === 'easy' ? 'Fácil' : room.botDifficulty === 'master' ? 'Mestre' : 'Médio'})`;
      if (patch.botCharId) room.p2.charId = patch.botCharId;
      if (patch.botStartPhase) room.p2.startPhase = patch.botStartPhase;
    }
    this.broadcastLocal({ type: 'room:state', room });
    this.emit('roomUpdated', { ...room });
  }

  public updateRoomSelection(patch: {
    charId?: string;
    startPhase?: number;
    level?: number;
    ready?: boolean;
    targetSlot?: 'p1' | 'p2';
  }): void {
    if (this.wsConnected) {
      this.sendWs({ type: 'room:select', ...patch });
      return;
    }

    const room = this.currentRoom;
    if (!room) return;
    const actor = this.getActorId();
    const slot =
      patch.targetSlot === 'p2' && room.hostId === actor && room.p2Mode === 'bot'
        ? room.p2
        : room.p1.userId === actor
          ? room.p1
          : room.p2.userId === actor
            ? room.p2
            : null;
    if (!slot) return;
    if (patch.charId) slot.charId = patch.charId;
    if (patch.startPhase !== undefined) slot.startPhase = patch.startPhase;
    if (patch.level !== undefined) slot.level = patch.level;
    if (patch.ready !== undefined && slot === room.p2 && !slot.isBot) {
      slot.ready = patch.ready;
    }
    this.broadcastLocal({ type: 'room:state', room });
    this.emit('roomUpdated', { ...room });
  }

  public inviteFriendToRoom(toUserId: string): void {
    if (!this.wsConnected) {
      this.emit('roomError', 'Conecte-se ao servidor para convidar amigos.');
      return;
    }
    this.sendWs({ type: 'room:invite', toUserId });
  }

  public startRoomMatch(): void {
    if (this.wsConnected) {
      this.sendWs({ type: 'room:start' });
      return;
    }

    const room = this.currentRoom;
    if (!room || room.hostId !== this.getActorId()) return;
    if (room.p2Mode === 'human' && (!room.p2.userId || !room.p2.ready)) {
      this.emit('roomError', 'Aguarde seu amigo ficar pronto ou jogue contra Bot.');
      return;
    }
    room.status = 'fighting';
    const config: MatchConfig = {
      p1CharId: room.p1.charId,
      p2CharId: room.p2.charId,
      p1StartPhase: room.p1.startPhase,
      p2StartPhase: room.p2.startPhase,
      p1Level: room.p1.level,
      p2Level: room.p2.level,
      p1DisplayName: room.p1.username,
      p2DisplayName: room.p2.username,
      difficulty: room.botDifficulty,
      mode: room.p2Mode === 'bot' ? 'room-bot' : 'online',
      localSlot: 'p1',
      roomCode: room.code,
    };
    if (room.p2Mode === 'human') {
      this.broadcastLocal({
        type: 'match:start',
        roomCode: room.code,
        matchConfig: { ...config, localSlot: 'p2' },
      });
    }
    this.emit('matchStart', config);
  }

  public returnRoomToLobby(): void {
    if (this.wsConnected) {
      this.sendWs({ type: 'room:return_lobby' });
    } else if (this.currentRoom) {
      this.currentRoom.status = 'lobby';
      this.emit('roomUpdated', { ...this.currentRoom });
    }
  }

  public notifyMatchEnded(): void {
    if (this.wsConnected) {
      this.sendWs({ type: 'match:end' });
    } else if (this.currentRoom) {
      this.currentRoom.status = 'lobby';
      this.emit('roomUpdated', { ...this.currentRoom });
    }
  }

  public sendCombatSync(payload: RemoteFighterSyncPayload): void {
    if (this.wsConnected) {
      this.sendWs({ type: 'match:sync', payload });
    } else if (this.currentRoom) {
      this.broadcastLocal({
        type: 'match:sync',
        roomCode: this.currentRoom.code,
        senderId: this.getActorId(),
        payload,
      });
    }
  }

  public sendCombatEvent(payload: CombatEventPayload): void {
    if (this.wsConnected) {
      this.sendWs({ type: 'match:event', payload });
    } else if (this.currentRoom) {
      this.broadcastLocal({
        type: 'match:event',
        roomCode: this.currentRoom.code,
        senderId: this.getActorId(),
        payload,
      });
    }
  }

  private setSession(token: string, user: UserProfile): void {
    this.token = token;
    this.user = user;
    this.clientActorId = user.id;
    this.writeToken(token);
    this.save.mergeRemoteProgress(user.characters);
    this.emit('authChanged', user);

    if (this.wsConnected) {
      this.sendWs({ type: 'auth', token });
    } else {
      this.connectWebSocket();
    }
  }

  private handleWsMessage(raw: string): void {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return;
    }

    switch (msg.type) {
      case 'ws:ready': {
        if (typeof msg.userId === 'string') {
          this.clientActorId = msg.userId;
        }
        if (Array.isArray(msg.rooms)) {
          this.openRooms = msg.rooms as OpenRoomSummary[];
          this.emit('roomsListUpdated', this.openRooms);
        }
        break;
      }

      case 'friends:updated': {
        void this.fetchFriends().catch(() => undefined);
        break;
      }

      case 'rooms:list': {
        if (Array.isArray(msg.rooms)) {
          this.openRooms = msg.rooms as OpenRoomSummary[];
          this.emit('roomsListUpdated', this.openRooms);
        }
        break;
      }

      case 'room:state': {
        const room = (msg.room as RoomState) ?? null;
        this.currentRoom = room;
        this.emit('roomUpdated', room);
        break;
      }

      case 'room:left': {
        this.currentRoom = null;
        this.emit('roomLeft', { code: msg.code as string | undefined });
        this.emit('roomUpdated', null);
        break;
      }

      case 'room:kicked': {
        this.currentRoom = null;
        this.emit('roomLeft', {
          code: msg.code as string | undefined,
          reason: String(msg.message || 'Você foi removido da sala.'),
        });
        this.emit('roomUpdated', null);
        break;
      }

      case 'room:error': {
        this.emit('roomError', String(msg.message || 'Erro na sala.'));
        break;
      }

      case 'room:invited': {
        if (msg.invite) {
          this.emit('inviteReceived', msg.invite as RoomInvitePayload);
        }
        break;
      }

      case 'room:invite_sent': {
        this.emit('inviteSent', {
          toUserId: String(msg.toUserId || ''),
          roomCode: String(msg.roomCode || ''),
        });
        break;
      }

      case 'match:start': {
        if (msg.matchConfig) {
          this.emit('matchStart', msg.matchConfig as MatchConfig);
        }
        break;
      }

      case 'match:sync': {
        if (msg.payload) {
          this.emit('remoteSync', msg.payload as RemoteFighterSyncPayload);
        }
        break;
      }

      case 'match:event': {
        if (msg.payload) {
          this.emit('remoteEvent', msg.payload as CombatEventPayload);
        }
        break;
      }

      case 'match:opponent_left': {
        this.emit(
          'opponentLeft',
          String(msg.message || 'Seu oponente saiu da batalha.')
        );
        break;
      }
    }
  }

  private sendWs(payload: unknown): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  private startPing(): void {
    this.stopPing();
    this.pingTimer = window.setInterval(() => {
      if (this.wsConnected) {
        this.sendWs({ type: 'ping', ts: Date.now() });
      }
    }, 25000);
  }

  private stopPing(): void {
    if (this.pingTimer !== null) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer !== null || this.manualClose) return;
    this.reconnectAttempts += 1;
    const delay = Math.min(10000, 1500 * Math.pow(1.4, this.reconnectAttempts - 1));
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connectWebSocket();
    }, delay);
  }

  private async apiFetch<T>(path: string, init: RequestInit): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(init.headers as Record<string, string> | undefined),
    };
    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    let res: Response;
    try {
      res = await fetch(path, { ...init, headers });
    } catch {
      throw new Error('Sem conexão com o servidor. Modo offline ativo.');
    }

    let data: Record<string, unknown> = {};
    try {
      data = (await res.json()) as Record<string, unknown>;
    } catch {
      // Resposta vazia ou não-JSON
    }

    if (res.status === 401 && path === '/api/auth/me') {
      this.token = null;
      this.user = null;
      this.writeToken(null);
      this.emit('authChanged', null);
    }

    if (!res.ok) {
      throw new Error(String(data.error || `Erro HTTP ${res.status}`));
    }

    return data as T;
  }

  private readToken(): string | null {
    try {
      return localStorage.getItem(TOKEN_STORAGE_KEY);
    } catch {
      return null;
    }
  }

  private writeToken(token: string | null): void {
    try {
      if (token) {
        localStorage.setItem(TOKEN_STORAGE_KEY, token);
      } else {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
      }
    } catch {
      // Ignora storage bloqueado
    }
  }

  private getOrCreateGuestId(): string {
    try {
      let id = sessionStorage.getItem(GUEST_ID_STORAGE_KEY);
      if (!id) {
        id = `guest:${Math.random().toString(36).slice(2, 10)}`;
        sessionStorage.setItem(GUEST_ID_STORAGE_KEY, id);
      }
      return id;
    } catch {
      return `guest:${Math.random().toString(36).slice(2, 10)}`;
    }
  }

  private setupLocalChannel(): void {
    if (typeof BroadcastChannel === 'undefined') return;
    this.localChannel = new BroadcastChannel(LOCAL_CHANNEL_NAME);
    this.localChannel.addEventListener('message', (ev) => {
      if (this.wsConnected) return;
      const msg = ev.data as Record<string, unknown> | null;
      if (!msg || typeof msg.type !== 'string') return;
      if (msg.type === 'room:state' && msg.room) {
        const room = msg.room as RoomState;
        this.localRooms.set(room.code, room);
        if (this.currentRoom?.code === room.code) {
          this.currentRoom = room;
          this.emit('roomUpdated', room);
        }
      } else if (
        msg.type === 'match:start' &&
        this.currentRoom &&
        this.currentRoom.code === msg.roomCode &&
        this.currentRoom.hostId !== this.getActorId()
      ) {
        this.emit('matchStart', msg.matchConfig as MatchConfig);
      } else if (
        msg.type === 'match:sync' &&
        this.currentRoom &&
        this.currentRoom.code === msg.roomCode &&
        msg.senderId !== this.getActorId()
      ) {
        this.emit('remoteSync', msg.payload as RemoteFighterSyncPayload);
      } else if (
        msg.type === 'match:event' &&
        this.currentRoom &&
        this.currentRoom.code === msg.roomCode &&
        msg.senderId !== this.getActorId()
      ) {
        this.emit('remoteEvent', msg.payload as CombatEventPayload);
      }
    });
  }

  private broadcastLocal(data: unknown): void {
    this.localChannel?.postMessage(data);
  }
}
