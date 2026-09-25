// hints.js — manages the limited-use hint feature.

export class HintManager {
  constructor(maxHints = 2) {
    this.max = maxHints;
    this.remaining = maxHints;
  }

  reset(maxHints = this.max) {
    this.max = maxHints;
    this.remaining = maxHints;
  }

  canUse() {
    return this.remaining > 0;
  }

  /**
   * Uses a hint: picks one unmatched pair not currently flipped, reveals both
   * of its cards for ~1s via the provided callbacks, then hides them again.
   * @param {Array<{cardId:string,pairId:string}>} deck full deck of card objects
   * @param {Set<string>} matchedPairIds pair ids already solved
   * @param {(cardId:string)=>HTMLElement} getNode maps a cardId to its DOM node
   * @returns {boolean} whether a hint was actually used
   */
  useHint(deck, matchedPairIds, getNode) {
    if (!this.canUse()) return false;

    const unmatchedPairIds = [...new Set(deck.filter((c) => !matchedPairIds.has(c.pairId)).map((c) => c.pairId))];
    if (unmatchedPairIds.length === 0) return false;

    const targetPairId = unmatchedPairIds[Math.floor(Math.random() * unmatchedPairIds.length)];
    const targetCards = deck.filter((c) => c.pairId === targetPairId);

    targetCards.forEach((card) => {
      const node = getNode(card.cardId);
      if (node) {
        node.classList.add('is-flipped', 'is-hint');
      }
    });

    this.remaining -= 1;

    setTimeout(() => {
      targetCards.forEach((card) => {
        const node = getNode(card.cardId);
        if (node && !node.classList.contains('is-matched')) {
          node.classList.remove('is-flipped', 'is-hint');
        }
      });
    }, 1000);

    return true;
  }
}
