// game.js — orchestrates a single play session on the Flip Card Game screen.

import { topics, getTopicPairs } from './topics.js';
import { buildDeck, renderCard, columnsForCount } from './cards.js';
import { createScoreState, applyCorrectMatch, applyWrongMatch, registerMove, accuracy, streakMessage } from './scoring.js';
import { GameTimer } from './timer.js';
import { HintManager } from './hints.js';
import { buildMatchModal } from './learnMode.js';
import { openModal, closeModal, showScorePop, showStreakToast } from './ui.js';
import { formatTime, el } from './utils.js';
import { sounds } from './sound.js';
import { getSettings } from './storage.js';

const WRONG_FLIP_DELAY = 800;

export class GameController {
  /**
   * @param {{topicId:string, difficulty:string, timerMode:string, hintsOn:boolean, learnModeOn:boolean}} config
   * @param {{
   *   cardGrid:HTMLElement, hudTime:HTMLElement, hudTimeWrap:HTMLElement, hudScore:HTMLElement,
   *   hudMoves:HTMLElement, hudStreak:HTMLElement, hudAccuracy:HTMLElement, progressFill:HTMLElement,
   *   progressLabel:HTMLElement, hintBtn:HTMLElement, hintCountBadge:HTMLElement, learnBadge:HTMLElement,
   *   streakToast:HTMLElement, titleEl:HTMLElement, gameRoot:HTMLElement
   * }} dom
   * @param {{onComplete:(result)=>void, onExit:()=>void}} callbacks
   */
  constructor(config, dom, callbacks) {
    this.config = config;
    this.dom = dom;
    this.callbacks = callbacks;

    const settings = getSettings();
    this.topic = topics[config.topicId];
    this.pairs = getTopicPairs(config.topicId, config.difficulty);
    this.pairsById = Object.fromEntries(this.pairs.map((p) => [p.pairId, p]));
    this.deck = buildDeck(this.pairs);
    this.totalPairs = this.pairs.length;

    this.scoreState = createScoreState();
    this.matchedPairIds = new Set();
    this.flippedCards = [];
    this.locked = false;
    this.cardNodes = new Map();
    this.timeouts = new Set();

    this.pairStats = new Map();
    this.pairs.forEach(p => {
      this.pairStats.set(p.pairId, { pairId: p.pairId, termLabel: p.term.label, missed: false });
    });

    this.lastMatchTime = Date.now();

    this.hintManager = new HintManager(config.hintsOn ? settings.hintCount : 0);
    this.timer = new GameTimer(config.timerMode, {
      onTick: (seconds, isWarning) => this._renderTime(seconds, isWarning),
      onWarningEnter: () => sounds.timerWarning(),
      onExpire: () => this._handleTimeUp(),
    });

    this._render();
    this._renderTime(this.timer.getDisplaySeconds(), false);
    this.timer.start();
  }

  _render() {
    const { cardGrid, titleEl, hintCountBadge, learnBadge } = this.dom;
    cardGrid.innerHTML = '';
    cardGrid.dataset.cols = String(columnsForCount(this.deck.length));
    this.cardNodes.clear();

    this.deck.forEach((card) => {
      const node = renderCard(card, (c, n) => this._handleCardClick(c, n));
      this.cardNodes.set(card.cardId, node);
      cardGrid.appendChild(node);
    });
    if (window.lucide) window.lucide.createIcons({ root: cardGrid });

    if (titleEl) {
      titleEl.innerHTML = '';
      titleEl.appendChild(el('i', { 'data-lucide': this.topic.icon }));
      titleEl.appendChild(document.createTextNode(` ${this.topic.title}`));
      if (window.lucide) window.lucide.createIcons({ root: titleEl });
    }
    if (hintCountBadge) hintCountBadge.textContent = String(this.hintManager.remaining);
    if (this.dom.hintBtn) this.dom.hintBtn.disabled = !this.config.hintsOn || this.hintManager.remaining <= 0;
    if (learnBadge) learnBadge.textContent = this.config.learnModeOn ? 'Learn Mode ON' : 'Learn Mode OFF';

    this._renderStats();
    this._renderProgress();
  }

  _renderTime(seconds, isWarning) {
    const { hudTime, hudTimeWrap } = this.dom;
    if (hudTime) hudTime.textContent = formatTime(seconds);
    if (hudTimeWrap) hudTimeWrap.classList.toggle('is-warning', !!isWarning);
  }

  _renderStats() {
    const { hudScore, hudMoves, hudStreak, hudAccuracy } = this.dom;
    if (hudScore) hudScore.textContent = String(this.scoreState.score);
    if (hudMoves) hudMoves.textContent = String(this.scoreState.moves);
    if (hudStreak) hudStreak.textContent = String(this.scoreState.streak);
    if (hudAccuracy) hudAccuracy.textContent = `${accuracy(this.scoreState)}%`;
  }

  _renderProgress() {
    const { progressFill, progressLabel } = this.dom;
    const pct = this.totalPairs ? Math.round((this.matchedPairIds.size / this.totalPairs) * 100) : 0;
    if (progressFill) progressFill.style.width = `${pct}%`;
    if (progressLabel) progressLabel.textContent = `Pairs Found: ${this.matchedPairIds.size} / ${this.totalPairs}`;
  }

  useHint() {
    if (!this.config.hintsOn || this.locked) return;
    const used = this.hintManager.useHint(this.deck, this.matchedPairIds, (id) => this.cardNodes.get(id));
    if (used) {
      sounds.hint();
      if (this.dom.hintCountBadge) this.dom.hintCountBadge.textContent = String(this.hintManager.remaining);
      if (this.dom.hintBtn) this.dom.hintBtn.disabled = this.hintManager.remaining <= 0;
    }
  }

  _handleCardClick(card, node) {
    if (this.locked) return;
    if (node.classList.contains('is-flipped') || node.classList.contains('is-matched')) return;
    if (this.flippedCards.length >= 2) return;

    sounds.flip();
    node.classList.add('is-flipped');
    node.setAttribute('aria-label', `${card.icon} ${card.label}`);
    this.flippedCards.push({ card, node });

    if (this.flippedCards.length === 2) {
      this.locked = true;
      registerMove(this.scoreState);
      this._renderStats();
      const tId = setTimeout(() => {
        this.timeouts.delete(tId);
        this._evaluatePair();
      }, 420);
      this.timeouts.add(tId);
    }
  }

  _evaluatePair() {
    const [first, second] = this.flippedCards;
    const isMatch = first.card.pairId === second.card.pairId;

    if (isMatch) {
      this._handleMatch(first, second);
    } else {
      this._handleMismatch(first, second);
    }
  }

  _handleMatch(first, second) {
    const delta = Date.now() - this.lastMatchTime;
    this.lastMatchTime = Date.now();
    this.pairStats.get(first.card.pairId).timeMs = delta;

    const gained = applyCorrectMatch(this.scoreState);
    this.matchedPairIds.add(first.card.pairId);

    [first, second].forEach(({ node }) => {
      node.classList.add('is-matched');
      node.setAttribute('aria-label', 'Matched card');
    });
    showScorePop(second.node, gained);
    sounds.correct();

    const msg = streakMessage(this.scoreState.streak);
    if (msg && this.dom.streakToast) showStreakToast(msg, this.dom.streakToast);

    if (this.scoreState.streak >= 3 && this.dom.hudStreak) {
      const val = this.dom.hudStreak.querySelector('.hud-stat__value') || this.dom.hudStreak;
      val.classList.remove('streak-pop');
      void val.offsetWidth;
      val.classList.add('streak-pop');
    }

    this._renderStats();
    this._renderProgress();
    this.flippedCards = [];
    this.locked = false;

    const isComplete = this.matchedPairIds.size >= this.totalPairs;

    if (this.config.learnModeOn) {
      const pairData = this.pairsById[first.card.pairId];
      this.locked = true;
      openModal(buildMatchModal(pairData, true, () => {
        closeModal();
        this.locked = false;
        if (isComplete) this._handleComplete();
      }), { dismissible: false });
    } else if (isComplete) {
      this._handleComplete();
    }
  }

  _handleMismatch(first, second) {
    this.lastMatchTime = Date.now(); // reset timer so penalty time isn't added to next match
    this.pairStats.get(first.card.pairId).missed = true;
    this.pairStats.get(second.card.pairId).missed = true;
    const delta = applyWrongMatch(this.scoreState);
    showScorePop(second.node, delta);
    sounds.wrong();
    [first.node, second.node].forEach((n) => n.classList.add('is-shake'));
    this._renderStats();

    const tId = setTimeout(() => {
      this.timeouts.delete(tId);
      [first, second].forEach(({ node, card }) => {
        node.classList.remove('is-flipped', 'is-shake');
        node.setAttribute('aria-label', 'Memory card, face down');
      });
      this.flippedCards = [];
      this.locked = false;
    }, WRONG_FLIP_DELAY);
    this.timeouts.add(tId);
  }

  _handleComplete() {
    this.timer.stop();
    sounds.complete();

    // Cascading clear animation
    Array.from(this.cardNodes.values()).forEach(({ node }, i) => {
      const tId = setTimeout(() => {
        this.timeouts.delete(tId);
        node.style.transition = 'transform 0.5s ease, opacity 0.5s ease';
        node.style.transform = 'translateY(-30px) scale(0.9)';
        node.style.opacity = '0';
      }, i * 40);
      this.timeouts.add(tId);
    });

    const completeId = setTimeout(() => {
      this.timeouts.delete(completeId);
      const result = {
        score: this.scoreState.score,
        moves: this.scoreState.moves,
        timeSeconds: this.timer.getElapsedSeconds(),
        bestStreak: this.scoreState.bestStreak,
        accuracy: accuracy(this.scoreState),
        matchedPairs: this.matchedPairIds.size,
        totalPairs: this.totalPairs,
        timedOut: false,
        pairStats: Array.from(this.pairStats.values()),
      };
      this.callbacks.onComplete?.(result);
    }, this.totalPairs * 80 + 300);
    this.timeouts.add(completeId);
  }

  _handleTimeUp() {
    this.locked = true;
    const result = {
      score: this.scoreState.score,
      moves: this.scoreState.moves,
      timeSeconds: this.timer.mode === 'none' ? this.timer.getElapsedSeconds() : parseInt(this.timer.mode, 10),
      bestStreak: this.scoreState.bestStreak,
      accuracy: accuracy(this.scoreState),
      matchedPairs: this.matchedPairIds.size,
      totalPairs: this.totalPairs,
      timedOut: true,
      pairStats: Array.from(this.pairStats.values()),
    };
    this.callbacks.onComplete?.(result);
  }

  destroy() {
    this.timer.stop();
    this.timeouts.forEach(clearTimeout);
    this.timeouts.clear();
  }
}
