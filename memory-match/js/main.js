// main.js — application entry point. Wires up the Home, Mode Selection,
// Game, and Leaderboard screens, plus the Settings/How-to-Play/Sound/Theme
// quick-access controls that live outside the core game flow.

import { topics, topicOrder, DIFFICULTY_PAIRS } from './topics.js';
import { el, formatTime, formatDate } from './utils.js';
import { getSettings, saveSettings, saveSession, getSession } from './storage.js';
import { bootSettings, applyTheme, buildSettingsModal, buildHowToPlayModal } from './settings.js';
import { setSoundEnabled, sounds } from './sound.js';
import { initUI, openModal, closeModal, showToast, launchConfetti } from './ui.js';
import { GameController } from './game.js';
import { recordResult, getTopEntries, wipeLeaderboard, renderLeaderboardTable } from './leaderboard.js';
import { renderVaultScreen } from './vault.js';
import { calculateXP, checkAchievements, calculateLevel, getXPForNextLevel } from './scoring.js';

/* ---------------------------------------------------------------------- */
/* Boot                                                                    */
/* ---------------------------------------------------------------------- */

let settings = bootSettings();

const dom = {
  overlay: document.getElementById('modal-overlay'),
  toast: document.getElementById('toast'),
  navLinks: document.querySelectorAll('[data-nav-target]'),
  screens: document.querySelectorAll('.screen'),
  soundToggleNav: document.getElementById('nav-sound-toggle'),
  themeToggleNav: document.getElementById('nav-theme-toggle'),

  // Home
  topicGrid: document.getElementById('topic-grid'),
  topicSelectCta: document.getElementById('topic-select-cta'),
  topicSelectBtn: document.getElementById('topic-select-btn'),

  // Mode selection
  modeBackBtn: document.getElementById('mode-back-btn'),
  modeTopicIcon: document.getElementById('mode-topic-icon'),
  modeTopicTitle: document.getElementById('mode-topic-title'),
  modeTopicDesc: document.getElementById('mode-topic-desc'),
  difficultyGrid: document.getElementById('difficulty-grid'),
  timerGrid: document.getElementById('timer-grid'),
  hintsToggle: document.getElementById('hints-toggle'),
  learnModeToggle: document.getElementById('learnmode-toggle'),
  startGameBtn: document.getElementById('start-game-btn'),

  // Game
  gameRoot: document.getElementById('game-screen'),
  gameBackBtn: document.getElementById('game-back-btn'),
  gameTitle: document.getElementById('game-title'),
  hintBtn: document.getElementById('hint-btn'),
  hintCountBadge: document.getElementById('hint-count-badge'),
  gameSettingsBtn: document.getElementById('game-settings-btn'),
  hudTimeWrap: document.getElementById('hud-time-wrap'),
  hudTime: document.getElementById('hud-time'),
  hudScore: document.getElementById('hud-score'),
  hudMoves: document.getElementById('hud-moves'),
  hudStreak: document.getElementById('hud-streak'),
  hudAccuracy: document.getElementById('hud-accuracy'),
  cardGrid: document.getElementById('card-grid'),
  progressFill: document.getElementById('progress-fill'),
  progressLabel: document.getElementById('progress-label'),
  soundBadge: document.getElementById('game-sound-badge'),
  learnBadge: document.getElementById('game-learn-badge'),
  streakToast: document.getElementById('streak-toast'),

  // Leaderboard
  leaderboardBody: document.getElementById('leaderboard-body'),
  clearLeaderboardBtn: document.getElementById('clear-leaderboard-btn'),
};

initUI({ overlay: dom.overlay, gameRoot: dom.gameRoot });

/* ---------------------------------------------------------------------- */
/* App state                                                              */
/* ---------------------------------------------------------------------- */

const state = {
  selectedTopicId: null,
  difficulty: settings.difficulty || 'easy',
  timerMode: settings.timer || 'none',
  hintsOn: settings.hints,
  learnModeOn: settings.learnMode,
  lastResult: null,
  playerName: getSession().playerName || '',
  isDailyChallenge: false,
};

function updateNavStats() {
  const session = getSession();
  const badge = document.getElementById('nav-level-badge');
  if (badge) badge.textContent = `Lvl ${session.level}`;
}
updateNavStats();

window.addEventListener('playerProgressReset', () => {
  updateNavStats();
  state.playerName = ''; // Ensure name is cleared

  // Destroy active game if any
  if (activeGame) {
    activeGame.destroy();
    activeGame = null;
  }

  // Close any open modals (like game complete or settings)
  closeModal();
  
  // Re-render the leaderboard so highlights drop off
  renderLeaderboardScreen();
  
  // Re-render vault if we are on that screen, otherwise go home
  const vaultScreen = document.querySelector('[data-screen="vault"]');
  if (vaultScreen && vaultScreen.classList.contains('is-active')) {
    renderVaultScreen('vault-grid');
  } else {
    // Navigate home to guarantee clean slate
    showScreen('home');
  }
  
  // Re-enable daily challenge if it was completed
  const dailyBtn = document.getElementById('daily-challenge-btn');
  if (dailyBtn) {
    dailyBtn.disabled = false;
    document.getElementById('daily-challenge-desc').textContent = 'Play today\'s seed';
    dailyBtn.style.opacity = '1';
  }
});

let activeGame = null;

/* ---------------------------------------------------------------------- */
/* Screen routing                                                         */
/* ---------------------------------------------------------------------- */

function showScreen(name) {
  dom.screens.forEach((s) => s.classList.toggle('is-active', s.dataset.screen === name));
  dom.navLinks.forEach((link) => link.classList.toggle('is-active', link.dataset.navTarget === name));
  window.scrollTo(0, 0);
}

document.querySelectorAll('[data-nav-target]').forEach((link) => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const target = link.dataset.navTarget;
    sounds.click();
    if (target === 'leaderboard') renderLeaderboardScreen();
    if (target === 'vault') renderVaultScreen('vault-grid');
    if (activeGame && target !== 'game') { activeGame.destroy(); activeGame = null; }
    showScreen(target);
  });
});

/* ---------------------------------------------------------------------- */
/* Quick-access: Settings / How to Play / Sound / Theme (outside flow)    */
/* ---------------------------------------------------------------------- */

function openSettings() {
  sounds.click();
  const modal = buildSettingsModal({
    onChange: (updated) => {
      settings = updated;
      state.hintsOn = settings.hints;
      state.learnModeOn = settings.learnMode;
      syncNavToggles();
    },
    onClose: () => closeModal(),
  });
  openModal(modal);
}

function openHowToPlay() {
  sounds.click();
  const modal = buildHowToPlayModal({ onClose: () => closeModal() });
  openModal(modal);
}

document.getElementById('nav-settings-btn')?.addEventListener('click', openSettings);
document.querySelectorAll('[data-open="settings"]').forEach((b) => b.addEventListener('click', openSettings));
document.getElementById('nav-howto-btn')?.addEventListener('click', openHowToPlay);
document.querySelectorAll('[data-open="howto"]').forEach((b) => b.addEventListener('click', openHowToPlay));
document.querySelectorAll('[data-open="leaderboard"]').forEach((b) => b.addEventListener('click', () => {
  renderLeaderboardScreen();
  showScreen('leaderboard');
}));
document.querySelectorAll('[data-open="sound-theme"]').forEach((b) => b.addEventListener('click', openSettings));

function syncNavToggles() {
  dom.soundToggleNav?.classList.toggle('is-on', settings.soundEffects);
  dom.themeToggleNav?.classList.toggle('is-on', settings.theme === 'dark');
  dom.themeToggleNav.innerHTML = settings.theme === 'dark' ? '<i data-lucide="sun"></i>' : '<i data-lucide="moon"></i>';
  if (window.lucide) window.lucide.createIcons({ root: dom.themeToggleNav });
}

dom.soundToggleNav?.addEventListener('click', () => {
  settings = saveSettings({ soundEffects: !settings.soundEffects });
  setSoundEnabled(settings.soundEffects);
  if (settings.soundEffects) sounds.click();
  syncNavToggles();
});

dom.themeToggleNav?.addEventListener('click', () => {
  const next = settings.theme === 'dark' ? 'light' : 'dark';
  settings = saveSettings({ theme: next });
  applyTheme(next);
  sounds.click();
  syncNavToggles();
});

syncNavToggles();

/* ---------------------------------------------------------------------- */
/* PAGE 1 — Home / Topic selection                                        */
/* ---------------------------------------------------------------------- */

function renderTopicGrid() {
  dom.topicGrid.innerHTML = '';
  topicOrder.forEach((topicId, index) => {
    const topic = topics[topicId];
    const card = el('button', {
      class: 'topic-card',
      'data-color': topic.color,
      'data-topic-id': topicId,
      type: 'button',
    }, [
      el('div', { class: 'topic-card__icon' }, el('i', { 'data-lucide': topic.icon })),
      el('div', { class: 'topic-card__number' }, `TOPIC ${index + 1}`),
      el('div', { class: 'topic-card__title' }, topic.title),
      el('div', { class: 'topic-card__desc' }, topic.description),
      el('div', { class: 'topic-card__pairs' }, '4 Pairs'),
    ]);
    card.addEventListener('click', () => selectTopic(topicId, card));
    dom.topicGrid.appendChild(card);
  });
  if (window.lucide) window.lucide.createIcons({ root: dom.topicGrid });
}

function selectTopic(topicId, cardNode) {
  sounds.click();
  state.selectedTopicId = topicId;
  [...dom.topicGrid.children].forEach((c) => c.classList.remove('is-selected'));
  cardNode.classList.add('is-selected');
  dom.topicSelectBtn.classList.add('is-visible');
}

dom.topicSelectBtn?.addEventListener('click', () => {
  if (!state.selectedTopicId) return;
  sounds.click();
  state.isDailyChallenge = false;
  openModeSelection(state.selectedTopicId);
});

// Daily Challenge Init
const dailyBtn = document.getElementById('daily-challenge-btn');
if (dailyBtn) {
  const today = formatDate(new Date());
  const session = getSession();
  if (session.dailyChallengeDate === today) {
    dailyBtn.disabled = true;
    document.getElementById('daily-challenge-desc').textContent = 'Completed for today';
    dailyBtn.style.opacity = '0.5';
  }
  dailyBtn.addEventListener('click', () => {
    sounds.click();
    state.isDailyChallenge = true;
    
    // Seed topic and difficulty based on day of month
    const day = new Date().getDate();
    state.selectedTopicId = topicOrder[day % topicOrder.length];
    state.difficulty = day % 2 === 0 ? 'medium' : 'hard';
    state.timerMode = '90';
    state.hintsOn = false;
    
    startGame();
  });
}

/* ---------------------------------------------------------------------- */
/* PAGE 2 — Mode selection                                                */
/* ---------------------------------------------------------------------- */

function openModeSelection(topicId) {
  const topic = topics[topicId];
  dom.modeTopicIcon.innerHTML = '';
  dom.modeTopicIcon.appendChild(el('i', { 'data-lucide': topic.icon }));
  if (window.lucide) window.lucide.createIcons({ root: dom.modeTopicIcon });
  dom.modeTopicTitle.textContent = topic.title;
  dom.modeTopicDesc.textContent = `"${topic.description}"`;

  // Adaptive Difficulty logic
  const session = getSession();
  const mastery = session.conceptMastery || {};
  let totalCorrect = 0;
  let totalAttempts = 0;
  let totalTimeMs = 0;
  let correctMatches = 0;
  
  topic.pairs.forEach((pair, index) => {
    const pairId = `${topicId}-${index}`;
    const stats = mastery[pairId] || { correct: 0, wrong: 0, totalTimeMs: 0, correctMatches: 0 };
    totalCorrect += stats.correct;
    totalAttempts += (stats.correct + stats.wrong);
    if (stats.correctMatches) {
      totalTimeMs += (stats.totalTimeMs || 0);
      correctMatches += stats.correctMatches;
    }
  });

  if (totalAttempts >= 5) {
    const accuracy = totalCorrect / totalAttempts;
    const avgTimeS = correctMatches > 0 ? (totalTimeMs / correctMatches) / 1000 : 999;
    
    if (accuracy >= 0.8 && avgTimeS < 4) state.difficulty = 'hard';
    else if (accuracy >= 0.5 && avgTimeS < 8) state.difficulty = 'medium';
    else state.difficulty = 'easy';
  } else {
    state.difficulty = 'easy'; // Default if not enough data
  }

  renderDifficultyGrid();
  renderTimerGrid();
  updateToggleUI(dom.hintsToggle, state.hintsOn);
  updateToggleUI(dom.learnModeToggle, state.learnModeOn);

  showScreen('mode-selection');
}

dom.modeBackBtn?.addEventListener('click', () => { sounds.click(); showScreen('home'); });

const DIFFICULTY_META = {
  easy: { accent: 'green', icon: 'star', sub: 'Best for Beginners' },
  medium: { accent: 'blue', icon: 'award', sub: 'Great for Practice' },
  hard: { accent: 'purple', icon: 'trophy', sub: 'For Experts' },
};

function renderDifficultyGrid() {
  dom.difficultyGrid.innerHTML = '';
  Object.entries(DIFFICULTY_PAIRS).forEach(([key, pairs]) => {
    const meta = DIFFICULTY_META[key];
    const card = el('button', { class: 'option-card', 'data-accent': meta.accent, type: 'button' }, [
      el('div', { class: 'option-card__check' }, '✓'),
      el('div', { class: 'option-card__icon' }, el('i', { 'data-lucide': meta.icon })),
      el('div', { class: 'option-card__title' }, key.charAt(0).toUpperCase() + key.slice(1)),
      el('div', { class: 'option-card__meta' }, `${pairs} Pairs`),
      el('div', { class: 'option-card__meta' }, `${pairs * 2} Cards`),
      el('div', { class: 'option-card__sub' }, meta.sub),
    ]);
    if (key === state.difficulty) card.classList.add('is-selected');
    card.addEventListener('click', () => {
      sounds.click();
      state.difficulty = key;
      saveSettings({ difficulty: key });
      [...dom.difficultyGrid.children].forEach((c) => c.classList.remove('is-selected'));
      card.classList.add('is-selected');
    });
    dom.difficultyGrid.appendChild(card);
  });
  if (window.lucide) window.lucide.createIcons({ root: dom.difficultyGrid });
}

const TIMER_META = [
  ['none', { accent: 'teal', icon: 'infinity', title: 'No Timer', sub: 'Play at your pace' }],
  ['60', { accent: 'yellow', icon: 'clock', title: '60 Seconds', sub: 'Challenge Mode' }],
  ['90', { accent: 'coral', icon: 'timer', title: '90 Seconds', sub: 'Pro Challenge' }],
];

function renderTimerGrid() {
  dom.timerGrid.innerHTML = '';
  TIMER_META.forEach(([key, meta]) => {
    const card = el('button', { class: 'option-card', 'data-accent': meta.accent, type: 'button' }, [
      el('div', { class: 'option-card__check' }, '✓'),
      el('div', { class: 'option-card__icon' }, el('i', { 'data-lucide': meta.icon })),
      el('div', { class: 'option-card__title' }, meta.title),
      el('div', { class: 'option-card__sub' }, meta.sub),
    ]);
    if (key === state.timerMode) card.classList.add('is-selected');
    card.addEventListener('click', () => {
      sounds.click();
      state.timerMode = key;
      saveSettings({ timer: key });
      [...dom.timerGrid.children].forEach((c) => c.classList.remove('is-selected'));
      card.classList.add('is-selected');
    });
    dom.timerGrid.appendChild(card);
  });
  if (window.lucide) window.lucide.createIcons({ root: dom.timerGrid });
}

function updateToggleUI(switchEl, isOn) {
  switchEl.classList.toggle('is-on', isOn);
  switchEl.setAttribute('aria-checked', String(isOn));
}

dom.hintsToggle?.addEventListener('click', () => {
  state.hintsOn = !state.hintsOn;
  saveSettings({ hints: state.hintsOn });
  updateToggleUI(dom.hintsToggle, state.hintsOn);
  sounds.click();
});

dom.learnModeToggle?.addEventListener('click', () => {
  state.learnModeOn = !state.learnModeOn;
  saveSettings({ learnMode: state.learnModeOn });
  updateToggleUI(dom.learnModeToggle, state.learnModeOn);
  sounds.click();
});

dom.startGameBtn?.addEventListener('click', () => {
  sounds.click();
  startGame();
});

/* ---------------------------------------------------------------------- */
/* PAGE 3 — Flip card game                                                */
/* ---------------------------------------------------------------------- */

function startGame() {
  if (activeGame) activeGame.destroy();

  const config = {
    topicId: state.selectedTopicId,
    difficulty: state.difficulty,
    timerMode: state.timerMode,
    hintsOn: state.hintsOn,
    learnModeOn: state.learnModeOn,
  };

  const gameDom = {
    cardGrid: dom.cardGrid,
    hudTime: dom.hudTime,
    hudTimeWrap: dom.hudTimeWrap,
    hudScore: dom.hudScore,
    hudMoves: dom.hudMoves,
    hudStreak: dom.hudStreak,
    hudAccuracy: dom.hudAccuracy,
    progressFill: dom.progressFill,
    progressLabel: dom.progressLabel,
    hintBtn: dom.hintBtn,
    hintCountBadge: dom.hintCountBadge,
    learnBadge: dom.learnBadge,
    streakToast: dom.streakToast,
    titleEl: dom.gameTitle,
    gameRoot: dom.gameRoot,
  };

  activeGame = new GameController(config, gameDom, {
    onComplete: (result) => handleGameFinished(result),
  });

  showScreen('game');
}

dom.gameBackBtn?.addEventListener('click', () => {
  if (confirm('Leave the game? Your progress will be lost.')) {
    sounds.click();
    activeGame?.destroy();
    activeGame = null;
    showScreen('mode-selection');
  }
});

dom.hintBtn?.addEventListener('click', () => activeGame?.useHint());
dom.gameSettingsBtn?.addEventListener('click', openSettings);
dom.soundBadge?.addEventListener('click', () => {
  settings = saveSettings({ soundEffects: !settings.soundEffects });
  setSoundEnabled(settings.soundEffects);
  dom.soundBadge.textContent = settings.soundEffects ? '🔊 Sound ON' : '🔇 Sound OFF';
  syncNavToggles();
});

/* ---------------------------------------------------------------------- */
/* PAGE 4 handled inside GameController (Match Found modal)               */
/* PAGE 5 — Game complete                                                 */
/* ---------------------------------------------------------------------- */

function handleGameFinished(result) {
  state.lastResult = result;
  if (result.timedOut) {
    showGameOverModal(result);
  } else {
    showGameCompleteModal(result);
  }
}

function showGameOverModal(result) {
  const modal = el('div', { class: 'modal gameover-modal animate-pop' }, [
    el('div', { class: 'gameover-modal__icon' }, el('i', { 'data-lucide': 'alarm-clock' })),
    el('h2', { class: 'gameover-modal__title' }, "Time's Up!"),
    el('p', { style: 'color:var(--color-text-soft);margin-top:8px;' }, `You matched ${result.matchedPairs} of ${result.totalPairs} pairs.`),
    el('div', { class: 'complete-stats' }, [
      statBlock('Score', String(result.score)),
      statBlock('Accuracy', `${result.accuracy}%`),
      statBlock('Moves', String(result.moves)),
    ]),
    el('div', { class: 'complete-actions' }, [
      actionBtn(el('span', {}, [el('i', { 'data-lucide': 'refresh-cw' }), ' Try Again']), 'pill-btn--primary', () => { closeModal(); startGame(); }),
      actionBtn(el('span', {}, [el('i', { 'data-lucide': 'shuffle' }), ' Change Topic']), 'pill-btn--ghost', () => { closeModal(); activeGame?.destroy(); activeGame = null; showScreen('home'); }),
      actionBtn(el('span', {}, [el('i', { 'data-lucide': 'trophy' }), ' Leaderboard']), 'pill-btn--outline-yellow', () => { closeModal(); renderLeaderboardScreen(); showScreen('leaderboard'); }),
    ]),
  ]);
  openModal(modal, { dismissible: false });
  if (window.lucide) window.lucide.createIcons({ root: modal });
}

function statBlock(label, value) {
  return el('div', {}, [
    el('div', { class: 'stat-label' }, label),
    el('div', { class: 'stat-value' }, value),
  ]);
}
function actionBtn(label, cls, onClick) {
  return el('button', { class: `pill-btn ${cls}`, onClick }, label);
}

function showGameCompleteModal(result) {
  const topic = topics[state.selectedTopicId];
  const session = getSession();
  
  // 1. Calculate XP and Level
  const gainedXP = calculateXP(result, state.isDailyChallenge);
  session.xp += gainedXP;
  
  const newLevel = calculateLevel(session.xp);
  let levelUpMsg = '';
  if (newLevel > session.level) {
    levelUpMsg = `LEVEL UP! You are now Level ${newLevel}!`;
    session.level = newLevel;
  }
  
  // 2. Achievements
  const newAchievements = checkAchievements(session, result, state.isDailyChallenge);
  
  // 3. Update Concept Mastery
  if (!session.conceptMastery) session.conceptMastery = {};
  result.pairStats?.forEach(stat => {
    if (!session.conceptMastery[stat.pairId]) {
      session.conceptMastery[stat.pairId] = { correct: 0, wrong: 0, totalTimeMs: 0, correctMatches: 0 };
    }
    if (stat.missed) {
      session.conceptMastery[stat.pairId].wrong += 1;
    } else {
      session.conceptMastery[stat.pairId].correct += 1;
      if (stat.timeMs) {
        session.conceptMastery[stat.pairId].totalTimeMs = (session.conceptMastery[stat.pairId].totalTimeMs || 0) + stat.timeMs;
        session.conceptMastery[stat.pairId].correctMatches = (session.conceptMastery[stat.pairId].correctMatches || 0) + 1;
      }
    }
  });

  if (state.isDailyChallenge) {
    session.dailyChallengeDate = formatDate(new Date());
  }

  saveSession(session);
  updateNavStats();

  // 4. Recalculate Adaptive Difficulty for next game
  const mastery = session.conceptMastery || {};
  let totalCorrect = 0, totalAttempts = 0, totalTimeMs = 0, correctMatches = 0;
  topic.pairs.forEach((pair, index) => {
    const pairId = `${topic.id}-${index}`;
    const stats = mastery[pairId] || { correct: 0, wrong: 0, totalTimeMs: 0, correctMatches: 0 };
    totalCorrect += stats.correct;
    totalAttempts += (stats.correct + stats.wrong);
    if (stats.correctMatches) {
      totalTimeMs += (stats.totalTimeMs || 0);
      correctMatches += stats.correctMatches;
    }
  });

  let adjustmentInsight = null;
  if (totalAttempts >= 5 && !state.isDailyChallenge) {
    const oldDifficulty = state.difficulty;
    const acc = totalCorrect / totalAttempts;
    const avgTimeS = correctMatches > 0 ? (totalTimeMs / correctMatches) / 1000 : 999;
    
    let newDifficulty = 'easy';
    if (acc >= 0.8 && avgTimeS < 4) newDifficulty = 'hard';
    else if (acc >= 0.5 && avgTimeS < 8) newDifficulty = 'medium';
    
    if (newDifficulty !== oldDifficulty) {
      state.difficulty = newDifficulty;
      if (newDifficulty === 'hard') adjustmentInsight = "Difficulty Adjusted: Increased to Hard due to high accuracy and fast recall!";
      else if (newDifficulty === 'easy') adjustmentInsight = "Difficulty Adjusted: Reduced to Easy to focus on revising concepts.";
      else adjustmentInsight = oldDifficulty === 'hard' ? "Difficulty Adjusted: Reduced to Medium for a balanced pace." : "Difficulty Adjusted: Increased to Medium! You're improving.";
    }
  }

  // 5. Build Learning Analytics UI
  const insightText = result.accuracy === 100 
    ? "Flawless! You've completely mastered this set." 
    : result.accuracy >= 80 
      ? "Great job! Just a few concepts need a bit more practice."
      : "A good attempt. Reviewing your weak concepts will boost your score next time.";

  const modalBody = el('div', { class: 'modal complete-modal animate-pop', id: 'complete-modal-body', style: 'max-width: 650px;' }, [
    el('div', { class: 'complete-modal__trophy' }, el('i', { 'data-lucide': 'award' })),
    el('h2', { class: 'complete-modal__title' }, [el('i', { 'data-lucide': 'bar-chart' }), ' Learning Analytics']),
    el('p', { style: 'text-align:center; color:var(--color-text-soft); margin-bottom:12px; font-size:1.05rem;' }, insightText),
    
    adjustmentInsight ? el('div', { 
      style: 'margin: 0 0 16px 0; padding: 12px; background: var(--color-purple-soft); color: var(--color-purple); border-radius: var(--radius-sm); border: 1px solid var(--color-purple); font-size: 0.9rem; text-align: center; display: flex; align-items: center; justify-content: center; gap: 8px;' 
    }, [
      el('i', { 'data-lucide': 'zap', style: 'width:16px; height:16px;' }),
      adjustmentInsight
    ]) : null,
    
    // XP Bar
    el('div', { style: 'margin: var(--space-4) 0; padding: var(--space-3); background: var(--color-surface); border-radius: var(--radius-md); border: 1px solid var(--color-border);' }, [
      el('div', { style: 'display:flex; justify-content:space-between; margin-bottom: 8px;' }, [
        el('strong', {}, `+${gainedXP} XP Earned ${state.isDailyChallenge ? '(+250 Bonus!)' : ''}`),
        el('span', { style: 'color:var(--color-text-soft); font-size:0.9rem;' }, `Total: ${session.xp} XP`)
      ]),
      el('div', { class: 'progress-track', style: 'height:12px;' }, [
        el('div', { class: 'progress-track__fill', style: `width: ${(session.xp / getXPForNextLevel(session.level)) * 100}%; background: linear-gradient(90deg, var(--color-yellow), var(--color-coral));` })
      ]),
      levelUpMsg ? el('div', { style: 'color: var(--color-success); font-weight:700; margin-top: 8px; text-align:center; animation: pulseSoft 2s infinite;' }, levelUpMsg) : null
    ]),

    el('div', { class: 'complete-stats', style: 'grid-template-columns: repeat(3, 1fr); margin-bottom: var(--space-4);' }, [
      statBlock([el('i', { 'data-lucide': 'star' }), ' Score'], String(result.score)),
      statBlock([el('i', { 'data-lucide': 'clock' }), ' Time'], formatTime(result.timeSeconds)),
      statBlock([el('i', { 'data-lucide': 'target' }), ' Accuracy'], `${result.accuracy}%`),
    ])
  ]);

  // Weak Areas / Perfect areas
  const weakPairs = result.pairStats?.filter(s => s.missed) || [];
  const weakAreas = weakPairs.map(s => s.termLabel);
  const masteredAreas = result.pairStats?.filter(s => !s.missed).map(s => s.termLabel) || [];

  if (masteredAreas.length > 0) {
    modalBody.appendChild(el('div', { style: 'margin-bottom: var(--space-4); text-align:left; background: var(--color-green-soft); padding: var(--space-3); border-radius: var(--radius-sm); border: 1px solid var(--color-success);' }, [
      el('h4', { style: 'color: var(--color-success); margin-bottom: 6px; display:flex; align-items:center; gap:6px;' }, [el('i', { 'data-lucide': 'check-circle-2', style: 'width:16px;height:16px;' }), 'Concepts Mastered']),
      el('ul', { style: 'margin-left: 20px; font-size:0.9rem;' }, masteredAreas.map(w => el('li', {}, w)))
    ]));
  }

  if (weakAreas.length > 0) {
    modalBody.appendChild(el('div', { style: 'margin-bottom: var(--space-4); text-align:left; background: var(--color-danger-soft, rgba(240,86,62,0.1)); padding: var(--space-3); border-radius: var(--radius-sm); border: 1px solid var(--color-danger);' }, [
      el('h4', { style: 'color: var(--color-danger); margin-bottom: 6px; display:flex; align-items:center; gap:6px;' }, [el('i', { 'data-lucide': 'alert-circle', style: 'width:16px;height:16px;' }), 'Weak Concepts']),
      el('ul', { style: 'margin-left: 20px; font-size:0.9rem;' }, weakAreas.map(w => el('li', {}, w)))
    ]));
  } else {
    modalBody.appendChild(el('div', { style: 'margin-bottom: var(--space-4); text-align:left; background: var(--color-success-soft, rgba(34,197,94,0.1)); padding: var(--space-3); border-radius: var(--radius-sm); border: 1px solid var(--color-success);' }, [
      el('h4', { style: 'color: var(--color-success); margin-bottom: 6px; display:flex; align-items:center; gap:6px;' }, [el('i', { 'data-lucide': 'check-circle-2', style: 'width:16px;height:16px;' }), 'Perfect Execution!']),
      el('p', { style: 'font-size:0.9rem;' }, 'You matched every concept without a single mistake.')
    ]));
  }

  // Achievements Unlocked
  if (newAchievements.length > 0) {
    const achContainer = el('div', { style: 'display:flex; gap:10px; margin-bottom: var(--space-4); justify-content:center; flex-wrap:wrap;' });
    newAchievements.forEach(ach => {
      achContainer.appendChild(el('div', { style: 'background: var(--color-purple-soft, rgba(168,85,247,0.1)); border: 1px solid var(--color-purple); padding: 8px 12px; border-radius: var(--radius-pill); display:flex; align-items:center; gap:8px; color: var(--color-purple); font-weight:700; font-size:0.85rem; animation: popIn 0.5s ease-out;' }, [
        el('i', { 'data-lucide': ach.icon }),
        `Unlocked: ${ach.title}`
      ]));
    });
    modalBody.appendChild(achContainer);
  }

  const nameInput = el('input', { type: 'text', placeholder: 'Your Name', maxlength: '20', value: state.playerName });
  const saveBtn = el('button', { class: 'pill-btn pill-btn--success' }, 'SAVE SCORE');
  const nameSection = el('div', { class: 'name-entry' }, [
    el('label', {}, 'Enter your name to save your score to leaderboard'),
    el('div', { class: 'name-entry-row' }, [
      el('div', { class: 'name-input' }, [el('span', {}, el('i', { 'data-lucide': 'user' })), nameInput]),
      saveBtn,
    ]),
  ]);
  modalBody.appendChild(nameSection);

  const postSaveActions = el('div', { class: 'complete-actions', style: 'display:none;' }, [
    actionBtn(el('span', {}, [el('i', { 'data-lucide': 'refresh-cw' }), ' Play Again']), 'pill-btn--primary', () => { closeModal(); startGame(); }),
    weakAreas.length > 0 ? actionBtn(el('span', {}, [el('i', { 'data-lucide': 'book-open' }), ' Review Weak Concepts']), 'pill-btn--outline-coral', () => { 
      closeModal(); 
      activeGame?.destroy(); 
      activeGame = null; 
      renderVaultScreen('vault-grid', { filter: 'weak', topicId: state.selectedTopicId }); 
      showScreen('vault');
    }) : null,
    actionBtn(el('span', {}, [el('i', { 'data-lucide': 'trophy' }), ' Leaderboard']), 'pill-btn--outline-yellow', () => { closeModal(); renderLeaderboardScreen(); showScreen('leaderboard'); }),
  ].filter(Boolean));
  modalBody.appendChild(postSaveActions);

  saveBtn.addEventListener('click', () => {
    const name = nameInput.value.trim() || 'Player';
    state.playerName = name;
    saveSession({ playerName: name });
    recordResult({
      name,
      topicTitle: topic.title,
      difficulty: state.difficulty,
      score: result.score,
      xp: gainedXP,
      timeSeconds: result.timeSeconds,
      accuracy: result.accuracy,
      date: formatDate(new Date()),
    });
    sounds.click();
    nameSection.style.display = 'none';
    postSaveActions.style.display = 'grid';
    showToast('Score saved!', dom.toast);
    launchConfetti(modalBody, 40);
  });

  openModal(modalBody, { dismissible: false });
  if (window.lucide) window.lucide.createIcons({ root: modalBody });
  
  // Confetti burst: double if level up or achievements
  const confettiCount = (levelUpMsg || newAchievements.length > 0) ? 60 : 30;
  launchConfetti(modalBody, confettiCount);
}

/* ---------------------------------------------------------------------- */
/* PAGE 6 — Leaderboard                                                   */
/* ---------------------------------------------------------------------- */

let currentLeaderboardTab = 'all-time';

function renderLeaderboardScreen() {
  const tabs = document.querySelectorAll('#leaderboard-tabs button');
  tabs.forEach(btn => {
    if (btn.dataset.tab === currentLeaderboardTab) {
      btn.classList.replace('pill-btn--ghost', 'pill-btn--primary');
    } else {
      btn.classList.replace('pill-btn--primary', 'pill-btn--ghost');
    }
  });

  let filterFn = null;
  const now = new Date();
  if (currentLeaderboardTab === 'today') {
    filterFn = (entry) => {
      const entryDate = new Date(entry.date);
      return entryDate.toDateString() === now.toDateString();
    };
  } else if (currentLeaderboardTab === 'weekly') {
    filterFn = (entry) => {
      const entryDate = new Date(entry.date);
      const diffTime = Math.abs(now - entryDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
      return diffDays <= 7;
    };
  }

  const entries = getTopEntries(10, filterFn);

  // Find current user rank
  let currentRank = null;
  const playerEntryIndex = entries.findIndex(e => e.name === state.playerName);
  if (playerEntryIndex !== -1) currentRank = playerEntryIndex + 1;

  // Track rank changes and Personal Best
  const session = getSession();
  if (!session.lastRanks) session.lastRanks = {};
  
  let rankChange = 0;
  if (currentRank) {
    const prevRank = session.lastRanks[currentLeaderboardTab];
    if (prevRank && prevRank !== currentRank) {
      rankChange = prevRank - currentRank; 
    }
    session.lastRanks[currentLeaderboardTab] = currentRank;
    saveSession(session);
  }

  const allEntries = getTopEntries(999, null);
  const pbEntry = allEntries.find(e => e.name === state.playerName);
  const pbScore = pbEntry ? pbEntry.score : 0;

  const banner = document.getElementById('user-rank-banner');
  if (banner) {
    if (pbScore > 0) {
      banner.style.display = 'flex';
      banner.innerHTML = `
        <div style="display:flex; align-items:center; gap: 12px;">
          <div style="width: 42px; height: 42px; border-radius: 50%; background: var(--color-blue); color: var(--color-bg); display:flex; align-items:center; justify-content:center; font-weight:700; font-size: 1.2rem;">
            ${currentRank ? '#' + currentRank : '-'}
          </div>
          <div>
            <div style="font-weight: 700; color: var(--color-text);">Your Rank (${currentLeaderboardTab})</div>
            <div style="font-size: 0.8rem; color: var(--color-text-soft);">Playing as <strong>${state.playerName || 'Player'}</strong></div>
          </div>
        </div>
        <div style="text-align: right;">
          <div style="font-weight: 700; color: var(--color-text); display:flex; align-items:center; justify-content:flex-end; gap:6px;">
            <i data-lucide="award" style="width:16px;height:16px;color:var(--color-yellow);"></i> Personal Best
          </div>
          <div style="display: flex; flex-direction: column; align-items: flex-end;">
            <div style="font-size: 1.2rem; color: var(--color-yellow-text, #96700E); font-family: var(--font-display); font-weight: 800;">
              ${pbScore} Pts
            </div>
            <div style="font-size: 0.85rem; color: var(--color-purple); font-weight: 700;">
              Total: ${session.xp || 0} XP
            </div>
          </div>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons({ root: banner });
    } else {
      banner.style.display = 'none';
    }
  }

  renderLeaderboardTable(dom.leaderboardBody, entries, state.playerName, rankChange);
}

document.querySelectorAll('#leaderboard-tabs button').forEach(btn => {
  btn.addEventListener('click', (e) => {
    currentLeaderboardTab = e.target.dataset.tab;
    renderLeaderboardScreen();
  });
});

dom.clearLeaderboardBtn?.addEventListener('click', () => {
  if (confirm('Clear all leaderboard scores? This cannot be undone.')) {
    wipeLeaderboard();
    renderLeaderboardScreen();
    showToast('Leaderboard cleared', dom.toast);
  }
});

/* ---------------------------------------------------------------------- */
/* Init                                                                    */
/* ---------------------------------------------------------------------- */

renderTopicGrid();
renderLeaderboardScreen();
showScreen('home');
if (window.lucide) window.lucide.createIcons();
