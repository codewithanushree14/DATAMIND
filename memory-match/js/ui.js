// ui.js — small reusable UI primitives: modal shell, toast, confetti, score pop.

import { el } from './utils.js';

let overlayEl = null;
let gameRootEl = null;

export function initUI({ overlay, gameRoot }) {
  overlayEl = overlay;
  gameRootEl = gameRoot || null;
}

/**
 * Opens a modal by clearing the overlay and inserting the given content node.
 * @param {HTMLElement} contentNode a `.modal` element
 * @param {{dismissible?:boolean, onClose?:()=>void}} opts
 */
export function openModal(contentNode, opts = {}) {
  const { dismissible = true } = opts;
  if (overlayEl._clearTimer) {
    clearTimeout(overlayEl._clearTimer);
    overlayEl._clearTimer = null;
  }
  overlayEl.innerHTML = '';
  overlayEl.appendChild(contentNode);
  overlayEl.classList.add('is-visible');
  overlayEl.dataset.dismissible = dismissible ? '1' : '0';
  if (gameRootEl) gameRootEl.classList.add('game-blur');
  if (window.lucide) window.lucide.createIcons({ root: overlayEl });

  const escHandler = (e) => {
    if (e.key === 'Escape' && overlayEl.dataset.dismissible === '1') {
      closeModal();
    }
  };
  overlayEl._escHandler = escHandler;
  document.addEventListener('keydown', escHandler);

  const clickAway = (e) => {
    if (e.target === overlayEl && overlayEl.dataset.dismissible === '1') closeModal();
  };
  overlayEl._clickAway = clickAway;
  overlayEl.addEventListener('click', clickAway);

  if (opts.onClose) overlayEl._onClose = opts.onClose;

  // Focus the first focusable element for accessibility
  const focusable = contentNode.querySelector('button, [href], input, [tabindex]');
  focusable?.focus();
}

export function closeModal() {
  overlayEl.classList.remove('is-visible');
  if (gameRootEl) gameRootEl.classList.remove('game-blur');
  if (overlayEl._escHandler) document.removeEventListener('keydown', overlayEl._escHandler);
  if (overlayEl._clickAway) overlayEl.removeEventListener('click', overlayEl._clickAway);
  const onClose = overlayEl._onClose;
  overlayEl._onClose = null;
  overlayEl._clearTimer = setTimeout(() => {
    if (!overlayEl.classList.contains('is-visible')) overlayEl.innerHTML = '';
    overlayEl._clearTimer = null;
  }, 250);
  if (onClose) onClose();
}

export function isModalOpen() {
  return overlayEl?.classList.contains('is-visible');
}

let toastTimeout = null;
export function showToast(message, toastEl) {
  toastEl.textContent = message;
  toastEl.classList.add('is-visible');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toastEl.classList.remove('is-visible'), 2200);
}

const CONFETTI_COLORS = ['#3B6CF6', '#22B573', '#8B5CF6', '#F0563E', '#F5B942', '#2FB6C4'];

export function launchConfetti(container, count = 36) {
  for (let i = 0; i < count; i++) {
    const size = 6 + Math.random() * 6;
    const piece = el('div', { class: 'confetti-piece' });
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.width = `${size}px`;
    piece.style.height = `${size * 0.4}px`;
    piece.style.background = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
    piece.style.animationDuration = `${1.4 + Math.random() * 1.4}s`;
    piece.style.animationDelay = `${Math.random() * 0.4}s`;
    container.appendChild(piece);
    setTimeout(() => piece.remove(), 3200);
  }
}

/** Shows a floating "+10" / "-2" popup anchored to a card element */
export function showScorePop(cardNode, delta) {
  const pop = el('div', {
    class: `mm-card__score-pop ${delta >= 0 ? 'mm-card__score-pop--pos' : 'mm-card__score-pop--neg'}`,
  }, `${delta >= 0 ? '+' : ''}${delta}`);
  cardNode.appendChild(pop);
  setTimeout(() => pop.remove(), 950);
}

export function showStreakToast(message, toastEl) {
  if (!message) return;
  toastEl.textContent = message;
  toastEl.classList.add('is-visible');
  clearTimeout(toastEl._t);
  toastEl._t = setTimeout(() => toastEl.classList.remove('is-visible'), 1400);
}
