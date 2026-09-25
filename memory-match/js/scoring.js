// scoring.js — pure scoring/streak/accuracy calculations, no DOM access.

const STREAK_BONUS = [10, 12, 15, 18]; // 1st, 2nd, 3rd, 4th+ consecutive correct match
const WRONG_PENALTY = 2;

/** Points earned for a correct match at a given (1-based) consecutive streak count */
export function pointsForStreak(streakCount) {
  if (streakCount <= 0) return STREAK_BONUS[0];
  if (streakCount <= STREAK_BONUS.length) return STREAK_BONUS[streakCount - 1];
  // Beyond the table, keep escalating modestly
  return STREAK_BONUS[STREAK_BONUS.length - 1] + (streakCount - STREAK_BONUS.length) * 3;
}

export const WRONG_MATCH_PENALTY = WRONG_PENALTY;

export function createScoreState() {
  return {
    score: 0,
    moves: 0,
    streak: 0,
    bestStreak: 0,
    correctMatches: 0,
    wrongAttempts: 0,
  };
}

export function applyCorrectMatch(state) {
  state.streak += 1;
  state.bestStreak = Math.max(state.bestStreak, state.streak);
  state.correctMatches += 1;
  const gained = pointsForStreak(state.streak);
  state.score += gained;
  return gained;
}

export function applyWrongMatch(state) {
  state.streak = 0;
  state.wrongAttempts += 1;
  state.score = Math.max(0, state.score - WRONG_PENALTY);
  return -WRONG_PENALTY;
}

export function registerMove(state) {
  state.moves += 1;
}

export function accuracy(state) {
  const totalAttempts = state.correctMatches + state.wrongAttempts;
  if (totalAttempts === 0) return 100;
  return Math.round((state.correctMatches / totalAttempts) * 100);
}

/** Returns a streak feedback message, or null if none applies at this streak level */
export function streakMessage(streak) {
  if (streak >= 5) return '🔥🔥 Unstoppable!';
  if (streak === 3 || streak === 4) return '🔥 On Fire!';
  if (streak === 2) return 'Nice!';
  return null;
}

export function calculateXP(result, isDailyChallenge) {
  let xp = result.score;
  
  if (result.accuracy === 100) xp += 50;
  else if (result.accuracy >= 80) xp += 20;

  xp += result.bestStreak * 5;

  if (isDailyChallenge) xp += 250;

  return xp;
}

export const ACHIEVEMENTS = {
  first_game: { id: 'first_game', title: 'First Steps', icon: 'footprints', desc: 'Complete your first game.' },
  perfect_game: { id: 'perfect_game', title: 'Flawless', icon: 'star', desc: 'Finish a game with 100% accuracy.' },
  speed_demon: { id: 'speed_demon', title: 'Speed Demon', icon: 'zap', desc: 'Finish a game in under 30 seconds.' },
  streak_master: { id: 'streak_master', title: 'Streak Master', icon: 'flame', desc: 'Achieve a 5+ streak.' },
  time_lord: { id: 'time_lord', title: 'Time Lord', icon: 'hourglass', desc: 'Average under 3 seconds per match.' },
  daily_devotee: { id: 'daily_devotee', title: 'Daily Devotee', icon: 'calendar-check', desc: 'Complete a Daily Challenge.' },
  dedicated_learner: { id: 'dedicated_learner', title: 'Dedicated Learner', icon: 'book', desc: 'Complete 5 games.' },
};

export function checkAchievements(session, result, isDaily) {
  const newUnlocks = [];
  const add = (id) => {
    if (!session.achievements.includes(id)) {
      session.achievements.push(id);
      newUnlocks.push(ACHIEVEMENTS[id]);
    }
  };

  add('first_game');
  if (result.accuracy === 100) add('perfect_game');
  if (result.timeSeconds > 0 && result.timeSeconds < 30) add('speed_demon');
  if (result.bestStreak >= 5) add('streak_master');
  
  if (isDaily) add('daily_devotee');
  
  // time lord logic
  let totalTime = 0, matches = 0;
  result.pairStats?.forEach(p => { if (p.timeMs) { totalTime += p.timeMs; matches++; } });
  if (matches > 0 && (totalTime / matches) < 3000) add('time_lord');
  
  // dedicated learner logic
  const totalGamesPlayed = (session.gamesPlayed || 0) + 1;
  session.gamesPlayed = totalGamesPlayed;
  if (totalGamesPlayed >= 5) add('dedicated_learner');

  return newUnlocks;
}

export function calculateLevel(xp) {
  return Math.floor(Math.sqrt(xp / 50)) + 1;
}

export function getXPForNextLevel(currentLevel) {
  return 50 * Math.pow(currentLevel, 2);
}
