import type { FighterInputState } from '../engine/InputManager';
import type { AIDifficulty } from '../game/AIController';
import type { MatchConfig } from '../game/ArenaScene';
import {
  teamForSlot,
  type FighterSlotId,
  type FighterState,
  type FighterTeam,
} from '../game/Fighter';
import { CharacterProgress, SaveManager } from '../storage/SaveManager';

export { teamForSlot, type FighterSlotId, type FighterTeam };
export type SlotMode = 'human' | 'bot' | 'closed';
export type RoomMode = '1v1' | 'rumble';

export interface MatchParticipantConfig {
  slot: FighterSlotId;
  team: FighterTeam;
  userId: string | null;
  displayName: string;
  charId: string;
  startPhase: number;
  level: number;
  isBot: boolean;
}

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
  slot?: FighterSlotId;
  team?: FighterTeam;
  slotMode?: SlotMode;
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
  roomMode?: RoomMode;
  teamSize?: 1 | 2 | 3;
  mapSeed?: number;
  mapTheme?: string;
  p2Mode: 'human' | 'bot';
  botDifficulty: AIDifficulty;
  status: 'lobby' | 'fighting';
  p1: RoomSlotState;
  p2: RoomSlotState;
  slots?: Record<FighterSlotId, RoomSlotState>;
  createdAt: number;
}

export interface OpenRoomSummary {
  code: string;
  hostName: string;
  hostFriendCode: string | null;
  isFriend: boolean;
  roomMode?: RoomMode;
  teamSize?: 1 | 2 | 3;
  mapTheme?: string;
  occupiedCount?: number;
  humanCount?: number;
  botCount?: number;
  maxPlayers?: number;
  openHumanSlots?: number;
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
  slot: FighterSlotId;
  seq: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  attackDirX?: number;
  attackDirY?: number;
  grounded: boolean;
  hp: number;
  peerHp?: number;
  hpMap?: Partial<Record<FighterSlotId, number>>;
  roundTimer?: number;
  currentRound?: number;
  team1RoundWins?: number;
  team2RoundWins?: number;
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
  slot: FighterSlotId;
  action?: 'ataque_1' | 'ataque_2' | 'ataque_3' | 'ataque_4';
  newPhase?: number;
  damage?: number;
  blocked?: boolean;
  winner?: 'p1' | 'p2' | 'draw';
  winnerTeam?: 1 | 2 | 'draw';
  p1HpRemaining?: number;
  p2HpRemaining?: number;
  hpRemainingMap?: Partial<Record<FighterSlotId, number>>;
  p1FinalPhase?: number;
  currentRound?: number;
  team1RoundWins?: number;
  team2RoundWins?: number;
  matchOver?: boolean;
}

export interface NetworkEventMap {
  authChanged: UserProfile | null;
  progressSynced: Record<string, CharacterProgress>;
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
  playerLeft: { slot: FighterSlotId; username: string };
}

const TOKEN_STORAGE_KEY = 'animekombat_auth_token_v1';
const GUEST_ID_STORAGE_KEY = 'animekombat_guest_id_v1';
const LOCAL_CHANNEL_NAME = 'animekombat_local_rooms';
const ALL_SLOTS: FighterSlotId[] = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];
const DEFAULT_BOT_CHARS = ['luffy', 'sukuna', 'goku', 'naruto', 'inuyasha', 'sukuna'];

function generateLocalCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function randomLocalSeed(): number {
  return (Math.floor(Math.random() * 0x7fffffff) >>> 0) || 1337;
}

function difficultyLabel(diff: AIDifficulty): string {
  return diff === 'easy' ? 'Fácil' : diff === 'master' ? 'Mestre' : 'Médio';
}

function buildLocalBotSlot(
  slot: FighterSlotId,
  diff: AIDifficulty,
  charId?: string,
  startPhase = 1,
  level = 1
): RoomSlotState {
  const idx = Math.max(0, ALL_SLOTS.indexOf(slot));
  return {
    slot,
    team: teamForSlot(slot),
    slotMode: 'bot',
    userId: 'bot',
    username: `BOT ${slot.toUpperCase()} (${difficultyLabel(diff)})`,
    friendCode: null,
    isGuest: false,
    isBot: true,
    charId: charId || DEFAULT_BOT_CHARS[idx % DEFAULT_BOT_CHARS.length],
    startPhase,
    level,
    ready: true,
  };
}

function buildLocalEmptySlot(slot: FighterSlotId, charId?: string): RoomSlotState {
  const idx = Math.max(0, ALL_SLOTS.indexOf(slot));
  return {
    slot,
    team: teamForSlot(slot),
    slotMode: 'human',
    userId: null,
    username: 'Vaga Aberta...',
    friendCode: null,
    isGuest: false,
    isBot: false,
    charId: charId || DEFAULT_BOT_CHARS[idx % DEFAULT_BOT_CHARS.length],
    startPhase: 1,
    level: 1,
    ready: false,
  };
}

function buildLocalClosedSlot(slot: FighterSlotId): RoomSlotState {
  return {
    slot,
    team: teamForSlot(slot),
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

function getLocalActiveSlots(room: RoomState): FighterSlotId[] {
  const size = room.roomMode === 'rumble' ? Math.max(2, Math.min(3, room.teamSize ?? 3)) : 1;
  return ALL_SLOTS.slice(0, size * 2);
}

function findLocalUserSlot(room: RoomState, userId: string): FighterSlotId | null {
  if (!room.slots) return room.p1.userId === userId ? 'p1' : room.p2.userId === userId ? 'p2' : null;
  for (const sid of ALL_SLOTS) {
    const s = room.slots[sid];
    if (s && s.slotMode !== 'closed' && !s.isBot && s.userId === userId) {
      return sid;
    }
  }
  return null;
}

function syncLocalRoomLegacy(room: RoomState): void {
  if (!room.slots) return;
  room.p1 = { ...room.slots.p1 };
  room.p2 = { ...room.slots.p2 };
  room.p2Mode = room.slots.p2.slotMode === 'bot' ? 'bot' : 'human';
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
  private syncInFlight: Promise<boolean> | null = null;
  private pendingProgressSync = false;
  private lastSyncAt = 0;

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
    this.bindLifecycleSync();
  }

  private bindLifecycleSync(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        if (this.token) {
          void this.syncProgress();
        }
      });
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (
          document.visibilityState === 'visible' &&
          this.token &&
          (this.pendingProgressSync || Date.now() - this.lastSyncAt > 5000)
        ) {
          void this.syncProgress();
        }
      });
    }
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

  public async syncProgress(): Promise<boolean> {
    if (!this.token) return false;
    if (this.syncInFlight) return this.syncInFlight;

    this.pendingProgressSync = true;
    const task = (async () => {
      try {
        const res = await this.apiFetch<{
          characters: Record<string, CharacterProgress>;
        }>('/api/profile/sync', {
          method: 'POST',
          body: JSON.stringify({
            characters: this.save.getData().characters,
          }),
        });
        this.pendingProgressSync = false;
        this.lastSyncAt = Date.now();
        const changed = this.save.mergeRemoteProgress(res.characters);
        if (this.user) {
          this.user.characters = res.characters;
        }
        if (changed) {
          this.emit('progressSynced', res.characters);
        }
        return changed;
      } catch {
        // Mantém pendingProgressSync = true para tentar novamente ao reconectar/voltar online
        return false;
      } finally {
        this.syncInFlight = null;
      }
    })();

    this.syncInFlight = task;
    return task;
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
        if (
          this.token &&
          (this.pendingProgressSync || Date.now() - this.lastSyncAt > 5000)
        ) {
          void this.syncProgress();
        }
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
    roomMode?: RoomMode;
    teamSize?: 1 | 2 | 3;
    p2Mode?: 'human' | 'bot';
    botDifficulty?: AIDifficulty;
    isPublic?: boolean;
    mapTheme?: string;
    mapSeed?: number;
    fillBots?: boolean;
    charId?: string;
    startPhase?: number;
    level?: number;
  }): void {
    const charId = options?.charId ?? 'goku';
    const prog = this.save.getCharacterProgress(charId);
    const roomMode: RoomMode = options?.roomMode === 'rumble' ? 'rumble' : '1v1';
    const teamSize: 1 | 2 | 3 =
      roomMode === 'rumble'
        ? (Math.max(2, Math.min(3, options?.teamSize ?? 3)) as 2 | 3)
        : 1;
    const payload = {
      type: 'room:create',
      roomMode,
      teamSize,
      p2Mode: options?.p2Mode ?? 'human',
      botDifficulty: options?.botDifficulty ?? this.save.getData().settings.difficulty,
      isPublic: options?.isPublic ?? true,
      mapTheme: options?.mapTheme ?? 'random',
      mapSeed: options?.mapSeed ?? randomLocalSeed(),
      fillBots: Boolean(options?.fillBots),
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
    const slots = {} as Record<FighterSlotId, RoomSlotState>;
    slots.p1 = {
      slot: 'p1',
      team: 1,
      slotMode: 'human',
      userId: this.getActorId(),
      username: this.getDisplayName(),
      friendCode: this.user?.friendCode ?? null,
      isGuest: !this.user,
      isBot: false,
      charId: payload.charId,
      startPhase: payload.startPhase,
      level: payload.level,
      ready: true,
    };
    for (const sid of ALL_SLOTS.slice(1)) {
      if (roomMode === 'rumble' && payload.fillBots) {
        slots[sid] = buildLocalBotSlot(sid, diff, undefined, payload.startPhase, payload.level);
      } else if (sid === 'p2' && payload.p2Mode === 'bot') {
        slots[sid] = buildLocalBotSlot(
          sid,
          diff,
          payload.charId === 'luffy' ? 'goku' : 'luffy',
          payload.startPhase,
          payload.level
        );
      } else {
        slots[sid] = buildLocalEmptySlot(sid);
      }
    }

    const room: RoomState = {
      code,
      isPublic: payload.isPublic,
      hostId: this.getActorId(),
      roomMode,
      teamSize,
      mapSeed: payload.mapSeed,
      mapTheme: payload.mapTheme,
      p2Mode: payload.p2Mode,
      botDifficulty: diff,
      status: 'lobby',
      slots,
      p1: { ...slots.p1 },
      p2: { ...slots.p2 },
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
    if (localRoom) {
      if (!localRoom.slots) {
        localRoom.slots = {
          p1: { ...localRoom.p1, slot: 'p1', team: 1, slotMode: 'human' },
          p2: { ...localRoom.p2, slot: 'p2', team: 2, slotMode: localRoom.p2.isBot ? 'bot' : 'human' },
          p3: buildLocalEmptySlot('p3'),
          p4: buildLocalEmptySlot('p4'),
          p5: buildLocalEmptySlot('p5'),
          p6: buildLocalEmptySlot('p6'),
        };
      }
      const activeIds = getLocalActiveSlots(localRoom);
      const openSlots = activeIds.filter((sid) => {
        const s = localRoom.slots![sid];
        return s.slotMode === 'human' && !s.userId;
      });
      if (openSlots.length > 0) {
        const teamCount = { 1: 0, 2: 0 };
        for (const sid of activeIds) {
          const s = localRoom.slots[sid];
          if ((s.slotMode === 'human' && s.userId) || s.slotMode === 'bot') {
            teamCount[teamForSlot(sid)] += 1;
          }
        }
        const prefTeam = teamCount[2] < teamCount[1] ? 2 : 1;
        const chosen = openSlots.find((sid) => teamForSlot(sid) === prefTeam) ?? openSlots[0];
        localRoom.slots[chosen] = {
          slot: chosen,
          team: teamForSlot(chosen),
          slotMode: 'human',
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
        syncLocalRoomLegacy(localRoom);
        this.currentRoom = localRoom;
        this.broadcastLocal({ type: 'room:state', room: localRoom });
        this.emit('roomUpdated', { ...localRoom });
        return;
      }
    }

    this.emit(
      'roomError',
      'Sem conexão com o servidor para entrar nessa sala.'
    );
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
    roomMode?: RoomMode;
    teamSize?: 1 | 2 | 3;
    p2Mode?: 'human' | 'bot';
    targetSlot?: FighterSlotId;
    slotMode?: SlotMode;
    botDifficulty?: AIDifficulty;
    botCharId?: string;
    botStartPhase?: number;
    isPublic?: boolean;
    mapTheme?: string;
    rerollSeed?: boolean;
    fillBots?: boolean;
    openAllHuman?: boolean;
  }): void {
    if (this.wsConnected) {
      this.sendWs({ type: 'room:config', ...patch });
      return;
    }

    const room = this.currentRoom;
    const actor = this.getActorId();
    if (!room || room.hostId !== actor) return;
    if (!room.slots) {
      room.slots = {
        p1: { ...room.p1, slot: 'p1', team: 1, slotMode: 'human' },
        p2: { ...room.p2, slot: 'p2', team: 2, slotMode: room.p2.isBot ? 'bot' : 'human' },
        p3: buildLocalEmptySlot('p3'),
        p4: buildLocalEmptySlot('p4'),
        p5: buildLocalEmptySlot('p5'),
        p6: buildLocalEmptySlot('p6'),
      };
    }

    if (patch.botDifficulty) room.botDifficulty = patch.botDifficulty;
    if (typeof patch.isPublic === 'boolean') room.isPublic = patch.isPublic;
    if (patch.mapTheme !== undefined) room.mapTheme = patch.mapTheme;
    if (patch.rerollSeed) room.mapSeed = randomLocalSeed();

    if (patch.roomMode) {
      room.roomMode = patch.roomMode;
      room.teamSize = patch.roomMode === 'rumble' ? (Math.max(2, Math.min(3, patch.teamSize ?? room.teamSize ?? 3)) as 2 | 3) : 1;
      if (!room.mapSeed) room.mapSeed = randomLocalSeed();
    } else if (patch.teamSize !== undefined && room.roomMode === 'rumble') {
      room.teamSize = Math.max(2, Math.min(3, patch.teamSize)) as 2 | 3;
    }

    const hostSlotKey = findLocalUserSlot(room, actor) ?? 'p1';
    const hostSlot = room.slots[hostSlotKey];

    if (patch.fillBots) {
      for (const sid of getLocalActiveSlots(room)) {
        const s = room.slots[sid];
        if ((s.slotMode === 'human' && !s.userId) || s.slotMode === 'closed') {
          room.slots[sid] = buildLocalBotSlot(sid, room.botDifficulty, undefined, hostSlot.startPhase, hostSlot.level);
        }
      }
    } else if (patch.openAllHuman) {
      for (const sid of getLocalActiveSlots(room)) {
        if (sid === hostSlotKey) continue;
        const s = room.slots[sid];
        if (s.slotMode === 'bot' || s.slotMode === 'closed') {
          room.slots[sid] = buildLocalEmptySlot(sid, s.charId);
        }
      }
    }

    if (patch.targetSlot) {
      const ts = patch.targetSlot;
      const cur = room.slots[ts];
      if (cur.userId !== actor) {
        if (patch.slotMode === 'bot') {
          room.slots[ts] = buildLocalBotSlot(
            ts,
            room.botDifficulty,
            patch.botCharId ?? cur.charId,
            patch.botStartPhase ?? cur.startPhase,
            hostSlot.level
          );
        } else if (patch.slotMode === 'human') {
          room.slots[ts] = buildLocalEmptySlot(ts, cur.charId);
        } else if (patch.slotMode === 'closed') {
          room.slots[ts] = buildLocalClosedSlot(ts);
        }
      }
    } else if (patch.p2Mode === 'bot') {
      room.slots.p2 = buildLocalBotSlot(
        'p2',
        room.botDifficulty,
        patch.botCharId ?? (room.slots.p2.isBot ? room.slots.p2.charId : 'luffy'),
        patch.botStartPhase ?? hostSlot.startPhase,
        hostSlot.level
      );
    } else if (patch.p2Mode === 'human') {
      if (room.slots.p2.isBot || room.slots.p2.slotMode === 'closed') {
        room.slots.p2 = buildLocalEmptySlot('p2');
      }
    } else if (room.slots.p2.isBot) {
      room.slots.p2.charId = patch.botCharId ?? room.slots.p2.charId;
      if (patch.botStartPhase !== undefined) room.slots.p2.startPhase = patch.botStartPhase;
    }

    for (const sid of ALL_SLOTS) {
      const s = room.slots[sid];
      if (s.slotMode === 'bot' && s.isBot) {
        s.username = `BOT ${sid.toUpperCase()} (${difficultyLabel(room.botDifficulty)})`;
      }
    }

    syncLocalRoomLegacy(room);
    this.broadcastLocal({ type: 'room:state', room });
    this.emit('roomUpdated', { ...room });
  }

  public updateRoomSelection(patch: {
    charId?: string;
    startPhase?: number;
    level?: number;
    ready?: boolean;
    targetSlot?: FighterSlotId;
    switchTeam?: boolean;
  }): void {
    if (this.wsConnected) {
      this.sendWs({ type: 'room:select', ...patch });
      return;
    }

    const room = this.currentRoom;
    if (!room || !room.slots) return;
    const actor = this.getActorId();
    const mySlotKey = findLocalUserSlot(room, actor);

    if (patch.switchTeam && room.roomMode === 'rumble' && mySlotKey) {
      const mySlot = room.slots[mySlotKey];
      const targetTeam = teamForSlot(mySlotKey) === 1 ? 2 : 1;
      const candidates = getLocalActiveSlots(room).filter((sid) => teamForSlot(sid) === targetTeam);
      const destKey =
        candidates.find((sid) => room.slots![sid].slotMode === 'human' && !room.slots![sid].userId) ??
        candidates.find((sid) => room.slots![sid].slotMode !== 'human');
      if (!destKey) {
        this.emit('roomError', 'O outro time já está cheio!');
        return;
      }
      const destSlot = room.slots[destKey];
      room.slots[destKey] = {
        ...mySlot,
        slot: destKey,
        team: teamForSlot(destKey),
      };
      if (destSlot.slotMode === 'bot') {
        room.slots[mySlotKey] = buildLocalBotSlot(
          mySlotKey,
          room.botDifficulty,
          destSlot.charId,
          destSlot.startPhase,
          destSlot.level
        );
      } else if (destSlot.slotMode === 'closed') {
        room.slots[mySlotKey] = buildLocalClosedSlot(mySlotKey);
      } else {
        room.slots[mySlotKey] = buildLocalEmptySlot(mySlotKey);
      }
      syncLocalRoomLegacy(room);
      this.broadcastLocal({ type: 'room:state', room });
      this.emit('roomUpdated', { ...room });
      return;
    }

    const slot =
      patch.targetSlot && room.hostId === actor && room.slots[patch.targetSlot]?.isBot
        ? room.slots[patch.targetSlot]
        : mySlotKey
          ? room.slots[mySlotKey]
          : null;
    if (!slot) return;
    if (patch.charId) slot.charId = patch.charId;
    if (patch.startPhase !== undefined) slot.startPhase = patch.startPhase;
    if (patch.level !== undefined) slot.level = patch.level;
    if (patch.ready !== undefined && slot.userId !== room.hostId && !slot.isBot) {
      slot.ready = patch.ready;
    }
    syncLocalRoomLegacy(room);
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
    const roomMode: RoomMode = room.roomMode === 'rumble' ? 'rumble' : '1v1';
    const slots = room.slots ?? {
      p1: { ...room.p1, slot: 'p1' as FighterSlotId, team: 1 as FighterTeam, slotMode: 'human' as SlotMode },
      p2: { ...room.p2, slot: 'p2' as FighterSlotId, team: 2 as FighterTeam, slotMode: (room.p2.isBot ? 'bot' : 'human') as SlotMode },
      p3: buildLocalEmptySlot('p3'),
      p4: buildLocalEmptySlot('p4'),
      p5: buildLocalEmptySlot('p5'),
      p6: buildLocalEmptySlot('p6'),
    };
    const activeIds = getLocalActiveSlots(room);

    if (roomMode !== 'rumble' && room.p2Mode === 'human' && (!slots.p2.userId || !slots.p2.ready)) {
      this.emit('roomError', 'Aguarde seu amigo ficar pronto ou jogue contra Bot.');
      return;
    }

    const participants: MatchParticipantConfig[] = [];
    let t1 = 0;
    let t2 = 0;
    for (const sid of activeIds) {
      const s = slots[sid];
      if (!s || s.slotMode === 'closed') continue;
      if (s.slotMode === 'human' && !s.userId) continue;
      if (s.slotMode === 'human' && s.userId && s.userId !== room.hostId && !s.ready) {
        this.emit('roomError', `Aguarde ${s.username} ficar pronto para iniciar.`);
        return;
      }
      const team = teamForSlot(sid);
      participants.push({
        slot: sid,
        team,
        userId: s.userId,
        displayName: s.username,
        charId: s.charId,
        startPhase: s.startPhase,
        level: s.level,
        isBot: Boolean(s.isBot),
      });
      if (team === 1) t1 += 1;
      else t2 += 1;
    }

    if (t1 === 0 || t2 === 0) {
      this.emit('roomError', 'Os dois times precisam ter pelo menos 1 lutador (jogador ou bot)!');
      return;
    }

    room.status = 'fighting';
    const p1Leg = participants.find((p) => p.team === 1) ?? participants[0];
    const p2Leg = participants.find((p) => p.team === 2) ?? participants[1] ?? p1Leg;
    const hostSlot = findLocalUserSlot(room, room.hostId) ?? 'p1';
    const hasRemoteHuman = participants.some((p) => !p.isBot && p.userId !== room.hostId);

    const config: MatchConfig = {
      p1CharId: p1Leg.charId,
      p2CharId: p2Leg.charId,
      p1StartPhase: p1Leg.startPhase,
      p2StartPhase: p2Leg.startPhase,
      p1Level: p1Leg.level,
      p2Level: p2Leg.level,
      p1DisplayName: p1Leg.displayName,
      p2DisplayName: p2Leg.displayName,
      difficulty: room.botDifficulty,
      mode: hasRemoteHuman ? 'online' : 'room-bot',
      roomMode,
      teamSize: room.teamSize ?? (roomMode === 'rumble' ? 3 : 1),
      mapSeed: room.mapSeed ?? randomLocalSeed(),
      mapTheme: room.mapTheme ?? 'random',
      localSlot: hostSlot,
      hostSlot,
      roomCode: room.code,
      participants,
    };

    if (hasRemoteHuman) {
      this.broadcastLocal({
        type: 'match:start',
        roomCode: room.code,
        matchConfig: config,
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

      case 'match:player_left': {
        this.emit('playerLeft', {
          slot: (msg.slot as FighterSlotId) || 'p2',
          username: String(msg.username || 'Jogador'),
        });
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

    if (
      res.status === 401 &&
      this.token &&
      path !== '/api/auth/login' &&
      path !== '/api/auth/register'
    ) {
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
        const cfg = msg.matchConfig as MatchConfig;
        const myParticipant = cfg.participants?.find((p) => p.userId === this.getActorId());
        this.emit('matchStart', {
          ...cfg,
          localSlot: myParticipant?.slot ?? 'p2',
        });
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
