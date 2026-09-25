// storage.js — the ONLY module that talks to localStorage directly.
// Every other module reads/writes app state through these functions.

const KEYS = {
  settings: 'mm_settings_v1',
  leaderboard: 'mm_leaderboard_v1',
  session: 'mm_session_v1',
};

const DEFAULT_SETTINGS = {
  soundEffects: true,
  music: false,
  learnMode: true,
  hints: true,
  hintCount: 2,
  theme: 'light',
  difficulty: 'easy',
  timer: 'none',
};

function safeParse(raw, fallback) {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function safeWrite(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    console.error('Storage write failed:', err);
    return false;
  }
}

export function getSettings() {
  return { ...DEFAULT_SETTINGS, ...safeParse(localStorage.getItem(KEYS.settings), {}) };
}

export function saveSettings(partial) {
  const merged = { ...getSettings(), ...partial };
  safeWrite(KEYS.settings, merged);
  return merged;
}

export function resetSettings() {
  safeWrite(KEYS.settings, DEFAULT_SETTINGS);
  return { ...DEFAULT_SETTINGS };
}

export function getLeaderboard() {
  return safeParse(localStorage.getItem(KEYS.leaderboard), []);
}

export function addLeaderboardEntry(entry) {
  const list = getLeaderboard();
  list.push(entry);
  safeWrite(KEYS.leaderboard, list);
  return list;
}

export function clearLeaderboard() {
  safeWrite(KEYS.leaderboard, []);
}

const DEFAULT_SESSION = {
  playerName: '',
  xp: 0,
  level: 1,
  currentStreakDays: 0,
  maxStreakDays: 0,
  lastPlayDate: null,
  achievements: [],
  conceptMastery: {},
  dailyChallengeDate: null,
};

export function getSession() {
  const session = safeParse(localStorage.getItem(KEYS.session), {});
  // Ensure complex objects like conceptMastery are initialized if missing in old data
  if (!session.conceptMastery) session.conceptMastery = {};
  if (!session.achievements) session.achievements = [];
  return { ...DEFAULT_SESSION, ...session };
}

export function saveSession(partial) {
  const merged = { ...getSession(), ...partial };
  safeWrite(KEYS.session, merged);
  return merged;
}

export function clearAllProgress() {
  safeWrite(KEYS.leaderboard, []);
  safeWrite(KEYS.settings, DEFAULT_SETTINGS);
  safeWrite(KEYS.session, {});
}

export function resetPlayerProgress() {
  safeWrite(KEYS.session, {});
}
