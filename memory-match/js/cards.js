// cards.js — builds the shuffled deck of card objects and renders card DOM nodes.
// Cards are always generated dynamically; nothing is hardcoded into HTML.

import { shuffle, el } from './utils.js';

/**
 * Build a shuffled deck of card objects from topic pairs.
 * Each pair contributes two cards: a "term" card and a "def" (meaning) card.
 */
export function buildDeck(pairs) {
  const cards = [];
  pairs.forEach((pair) => {
    cards.push({
      cardId: `${pair.pairId}-term`,
      pairId: pair.pairId,
      role: 'term',
      icon: pair.term.icon,
      label: pair.term.label,
      learn: pair.learn,
      partnerLabel: pair.def.label,
      partnerIcon: pair.def.icon,
    });
    cards.push({
      cardId: `${pair.pairId}-def`,
      pairId: pair.pairId,
      role: 'def',
      icon: pair.def.icon,
      label: pair.def.label,
      learn: pair.learn,
      partnerLabel: pair.term.label,
      partnerIcon: pair.term.icon,
    });
  });
  return shuffle(cards);
}

/** Build the DOM node for a single card. `onSelect` fires with the card object. */
export function renderCard(card, onSelect) {
  const node = el('div', {
    class: 'mm-card',
    'data-card-id': card.cardId,
    'data-pair-id': card.pairId,
    role: 'button',
    tabindex: '0',
    'aria-label': `Memory card, face down`,
    onClick: () => onSelect(card, node),
    onKeydown: (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onSelect(card, node);
      }
    },
  });

  const inner = el('div', { class: 'mm-card__inner' }, [
    el('div', { class: 'mm-card__face mm-card__face--front', 'aria-hidden': 'true' }, '?'),
    el('div', { class: 'mm-card__face mm-card__face--back', 'aria-hidden': 'true' }, [
      el('div', { class: 'mm-card__back-icon' }, el('i', { 'data-lucide': card.icon })),
      el('div', { class: 'mm-card__back-label' }, card.label),
    ]),
  ]);

  node.appendChild(inner);
  return node;
}

export function columnsForCount(cardCount) {
  return cardCount > 16 ? 6 : 4;
}
