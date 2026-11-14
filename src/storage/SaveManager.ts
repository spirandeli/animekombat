import { AIDifficulty } from '../game/AIController';
import { phaseForLevel } from '../game/Fighter';

export interface CharacterProgress {
  xp: number;
  level: number;
  unlockedPhase: number;
  wins: number;
  matches: number;
}

export interface GameSettings {
  controlsOpacity: number;
  controlsScale: number;
  stickDeadzone: number;
  jumpViaStick: boolean;
  hapticFeedback: boolean;
  bgmVolume: number;
  sfxVolume: number;
  bgmMuted: boolean;
  sfxMuted: boolean;
  difficulty: AIDifficulty;
}

export interface SaveData {
  version: number;
  characters: Record<string, CharacterProgress>;
  settings: GameSettings;
}

const SAVE_KEY = 'animekombat_save_v1';
const DB_NAME = 'animekombat_db';
const DB_STORE = 'state';

export function xpRequiredForLevel(level: number): number {
  return 100 + level * 45;
}

export function createDefaultSave(): SaveData {
  return {
    version: 1,
    characters: {
      goku: { xp: 0, level: 1, unlockedPhase: 1, wins: 0, matches: 0 },
      luffy: { xp: 0, level: 1, unlockedPhase: 1, wins: 0, matches: 0 },
      sukuna: { xp: 0, level: 1, unlockedPhase: 1, wins: 0, matches: 0 },
    },
    settings: {
      controlsOpacity: 0.85,
      controlsScale: 1.0,
      stickDeadzone: 0.22,
      jumpViaStick: true,
      hapticFeedback: true,
      bgmVolume: 0.45,
      sfxVolume: 0.78,
      bgmMuted: false,
      sfxMuted: false,
      difficulty: 'medium',
    },
  };
}

export class SaveManager {
  private data: SaveData = createDefaultSave();

  public async load(): Promise<SaveData> {
    // Tenta IndexedDB primeiro, com fallback instantâneo no localStorage
    const idbData = await this.readFromIndexedDb();
    if (idbData) {
      this.data = this.mergeWithDefaults(idbData);
      return this.data;
    }

    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<SaveData>;
        this.data = this.mergeWithDefaults(parsed);
      }
    } catch {
      this.data = createDefaultSave();
    }
    return this.data;
  }

  public getData(): SaveData {
    return this.data;
  }

  public getCharacterProgress(charId: string): CharacterProgress {
    if (!this.data.characters[charId]) {
      this.data.characters[charId] = {
        xp: 0,
        level: 1,
        unlockedPhase: 1,
        wins: 0,
        matches: 0,
      };
    }
    return this.data.characters[charId];
  }

  public recordMatchResult(
    charId: string,
    won: boolean,
    xpGained: number
  ): {
    oldLevel: number;
    newLevel: number;
    oldPhase: number;
    newPhase: number;
    xpGained: number;
  } {
    const prog = this.getCharacterProgress(charId);
    const oldLevel = prog.level;
    const oldPhase = prog.unlockedPhase;

    prog.matches += 1;
    if (won) prog.wins += 1;
    prog.xp += Math.max(15, Math.round(xpGained));

    while (prog.xp >= xpRequiredForLevel(prog.level)) {
      prog.xp -= xpRequiredForLevel(prog.level);
      prog.level += 1;
    }

    prog.unlockedPhase = Math.max(prog.unlockedPhase, phaseForLevel(prog.level));
    void this.save();

    return {
      oldLevel,
      newLevel: prog.level,
      oldPhase,
      newPhase: prog.unlockedPhase,
      xpGained: Math.max(15, Math.round(xpGained)),
    };
  }

  public updateSettings(patch: Partial<GameSettings>): void {
    this.data.settings = { ...this.data.settings, ...patch };
    void this.save();
  }

  public mergeRemoteProgress(
    remoteChars: Record<string, CharacterProgress> | undefined | null
  ): boolean {
    if (!remoteChars) return false;
    let changed = false;

    for (const [charId, remote] of Object.entries(remoteChars)) {
      if (!remote) continue;
      const local = this.getCharacterProgress(charId);
      const rLevel = Math.max(1, Math.floor(remote.level || 1));
      const rXp = Math.max(0, Math.floor(remote.xp || 0));
      const rPhase = Math.max(1, Math.min(4, Math.floor(remote.unlockedPhase || 1)));
      const rWins = Math.max(0, Math.floor(remote.wins || 0));
      const rMatches = Math.max(rWins, Math.floor(remote.matches || 0));

      if (rLevel > local.level) {
        local.level = rLevel;
        local.xp = rXp;
        changed = true;
      } else if (rLevel === local.level && rXp > local.xp) {
        local.xp = rXp;
        changed = true;
      }

      const nextPhase = Math.max(local.unlockedPhase, rPhase, phaseForLevel(local.level));
      if (nextPhase !== local.unlockedPhase) {
        local.unlockedPhase = nextPhase;
        changed = true;
      }

      if (rWins > local.wins) {
        local.wins = rWins;
        changed = true;
      }

      const nextMatches = Math.max(local.matches, rMatches, local.wins);
      if (nextMatches !== local.matches) {
        local.matches = nextMatches;
        changed = true;
      }
    }

    if (changed) {
      void this.save();
    }
    return changed;
  }

  public async save(): Promise<void> {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
    } catch {
      // Ignora caso localStorage esteja indisponível em modo privado restrito
    }
    await this.writeToIndexedDb(this.data);
  }

  private mergeWithDefaults(partial: Partial<SaveData>): SaveData {
    const def = createDefaultSave();
    return {
      version: 1,
      characters: {
        ...def.characters,
        ...(partial.characters ?? {}),
      },
      settings: {
        ...def.settings,
        ...(partial.settings ?? {}),
      },
    };
  }

  private openDb(): Promise<IDBDatabase | null> {
    if (typeof indexedDB === 'undefined') return Promise.resolve(null);
    return new Promise((resolve) => {
      try {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(DB_STORE)) {
            db.createObjectStore(DB_STORE);
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  private async readFromIndexedDb(): Promise<Partial<SaveData> | null> {
    const db = await this.openDb();
    if (!db) return null;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(DB_STORE, 'readonly');
        const store = tx.objectStore(DB_STORE);
        const req = store.get(SAVE_KEY);
        req.onsuccess = () => {
          resolve((req.result as Partial<SaveData> | undefined) ?? null);
          db.close();
        };
        req.onerror = () => {
          resolve(null);
          db.close();
        };
      } catch {
        resolve(null);
        db.close();
      }
    });
  }

  private async writeToIndexedDb(data: SaveData): Promise<void> {
    const db = await this.openDb();
    if (!db) return;
    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(DB_STORE, 'readwrite');
        const store = tx.objectStore(DB_STORE);
        store.put(data, SAVE_KEY);
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          resolve();
        };
      } catch {
        db.close();
        resolve();
      }
    });
  }
}
