// learnMode.js — renders the "Match Found" modal, with or without the
// educational explanation depending on the Learn Mode setting.

import { el } from './utils.js';

/**
 * @param {{term:{label,icon}, def:{label,icon}, learn:string}} pairData
 * @param {boolean} learnModeOn
 * @param {()=>void} onContinue
 */
export function buildMatchModal(pairData, learnModeOn, onContinue) {
  const children = [
    el('div', { class: 'match-modal__badge' }, el('i', { 'data-lucide': 'lightbulb' })),
    el('h3', { class: 'match-modal__title', style: 'color:var(--color-blue); margin-bottom: 16px;' }, 'Concept Mastered!'),
    el('div', { class: 'match-modal__pair' }, [
      el('div', { class: 'match-modal__concept' }, [
        el('div', { class: 'icon' }, el('i', { 'data-lucide': pairData.term.icon })),
        el('div', { class: 'label' }, pairData.term.label),
      ]),
      el('div', { class: 'match-modal__arrow' }, el('i', { 'data-lucide': 'arrow-right' })),
      el('div', { class: 'match-modal__concept' }, [
        el('div', { class: 'icon' }, el('i', { 'data-lucide': pairData.def.icon })),
        el('div', { class: 'label' }, pairData.def.label),
      ]),
    ]),
  ];

  if (learnModeOn) {
    const detailsContainer = el('div', { class: 'match-modal__details', style: 'margin: 20px 0; text-align: left; display:flex; flex-direction:column; gap:12px;' });
    
    // Main Explanation
    detailsContainer.appendChild(el('div', { 
      class: 'match-modal__explainer',
      style: 'background: var(--color-blue-soft); color: var(--color-blue); padding: 16px; border-radius: var(--radius-md); border-left: 4px solid var(--color-blue); font-size: 0.95rem; line-height: 1.5; font-weight: 500;'
    }, pairData.learn));

    // Real World Example
    if (pairData.example) {
      detailsContainer.appendChild(el('div', { 
        style: 'background: var(--color-surface); border: 1px solid var(--color-border); padding: 12px 16px; border-radius: var(--radius-md); font-size: 0.9rem; line-height: 1.4;'
      }, [
        el('strong', { style: 'display:flex; align-items:center; gap:6px; color:var(--color-text); margin-bottom:4px;' }, [
          el('i', { 'data-lucide': 'globe', style: 'width:16px; height:16px; color:var(--color-green);' }), 'Real World Example'
        ]),
        el('span', { style: 'color:var(--color-text-soft);' }, pairData.example)
      ]));
    }

    // Memory Tip
    if (pairData.tip) {
      detailsContainer.appendChild(el('div', { 
        style: 'background: var(--color-surface); border: 1px solid var(--color-border); padding: 12px 16px; border-radius: var(--radius-md); font-size: 0.9rem; line-height: 1.4;'
      }, [
        el('strong', { style: 'display:flex; align-items:center; gap:6px; color:var(--color-text); margin-bottom:4px;' }, [
          el('i', { 'data-lucide': 'zap', style: 'width:16px; height:16px; color:var(--color-yellow);' }), 'Memory Tip'
        ]),
        el('span', { style: 'color:var(--color-text-soft);' }, pairData.tip)
      ]));
    }

    children.push(detailsContainer);
  }

  const continueBtn = el('button', { class: 'pill-btn pill-btn--primary match-modal__cta', onClick: onContinue }, ['Continue ', el('i', { 'data-lucide': 'arrow-right' })]);
  children.push(continueBtn);

  return el('div', { class: 'modal match-modal animate-pop', style: 'max-width: 500px;' }, children);
}
