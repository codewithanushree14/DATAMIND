import { topics, topicOrder } from './topics.js';
import { getSession } from './storage.js';
import { el } from './utils.js';
import { buildMatchModal } from './learnMode.js';
import { openModal, closeModal } from './ui.js';

let state = {
  activeTab: 'all',
  searchQuery: '',
  filterWeakOnly: false,
};

function getMasteryStats(stats) {
  const total = stats.correct + stats.wrong;
  let score = 0;
  if (total > 0) {
    score = Math.round((stats.correct / total) * 100);
  }
  if (stats.correct > 5 && score > 80) score = 100;

  const isMastered = score >= 90 && stats.correct >= 3;
  const isWeak = stats.wrong > stats.correct;

  return { score, isMastered, isWeak };
}

function handleReview(pairData) {
  // Re-use learnMode modal but tailor the title for a review session
  const modalNode = buildMatchModal(pairData, true, () => {
    closeModal();
  });
  // Swap the title from "Concept Mastered!" to "Concept Review"
  const titleEl = modalNode.querySelector('.match-modal__title');
  if (titleEl) {
    titleEl.textContent = 'Concept Review';
  }
  openModal(modalNode, { dismissible: true });
  if (window.lucide) window.lucide.createIcons({ root: modalNode });
}

function renderTabs(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';

  const tabs = [{ id: 'all', label: 'All Categories' }];
  topicOrder.forEach(tId => {
    tabs.push({ id: tId, label: topics[tId].title });
  });

  tabs.forEach(tab => {
    const btn = el('button', { 
      class: `pill-btn ${state.activeTab === tab.id ? 'pill-btn--primary' : 'pill-btn--ghost'}`,
      style: 'white-space: nowrap;',
      onClick: () => {
        state.activeTab = tab.id;
        renderTabs(containerId);
        renderContent('vault-content');
      }
    }, tab.label);
    container.appendChild(btn);
  });
}

function renderContent(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';

  const session = getSession();
  const mastery = session.conceptMastery || {};

  const query = state.searchQuery.toLowerCase();
  
  let topicsToRender = state.activeTab === 'all' ? topicOrder : [state.activeTab];

  const fragment = document.createDocumentFragment();

  topicsToRender.forEach(topicId => {
    const topic = topics[topicId];
    
    // Filter pairs by search query and weak filter
    const filteredPairs = topic.pairs.filter((pair, index) => {
      const pairId = `${topicId}-${index}`;
      const stats = mastery[pairId] || { correct: 0, wrong: 0 };
      const computed = getMasteryStats(stats);
      if (state.filterWeakOnly && !computed.isWeak) return false;

      if (!query) return true;
      return pair.term.label.toLowerCase().includes(query) || 
             pair.def.label.toLowerCase().includes(query) || 
             topic.title.toLowerCase().includes(query);
    });

    if (filteredPairs.length === 0) return;

    // Calculate category progress
    let masteredCount = 0;
    const enrichedPairs = filteredPairs.map((pair, index) => {
      const pairId = `${topicId}-${index}`;
      const stats = mastery[pairId] || { correct: 0, wrong: 0 };
      const computed = getMasteryStats(stats);
      if (computed.isMastered) masteredCount++;
      return { pair, stats, computed };
    });

    // Category Header
    const progressPercent = Math.round((masteredCount / topic.pairs.length) * 100);
    const categoryHeader = el('div', { style: 'margin-bottom: var(--space-4); margin-top: var(--space-6);' }, [
      el('div', { style: 'display:flex; justify-content:space-between; align-items:center; margin-bottom:var(--space-2);' }, [
        el('h3', { style: 'display:flex; align-items:center; gap:8px; font-size:1.4rem; margin:0;' }, [
          el('i', { 'data-lucide': topic.icon, style: 'color:var(--color-blue);' }),
          topic.title
        ]),
        el('span', { style: 'font-weight:600; font-size:0.9rem; color:var(--color-text-soft);' }, `${masteredCount}/${topic.pairs.length} Mastered`)
      ]),
      el('div', { class: 'progress-track', style: 'height:8px; border-radius:4px; background:var(--color-border); overflow:hidden;' }, [
        el('div', { class: 'progress-track__fill', style: `width:${progressPercent}%; background:var(--grad-primary); height:100%; transition:width 1s ease-out;` })
      ])
    ]);

    fragment.appendChild(categoryHeader);

    // Cards Container (List Layout)
    const listContainer = el('div', { style: 'display:flex; flex-direction:column; gap:var(--space-3);' });

    enrichedPairs.forEach(({ pair, stats, computed }) => {
      let statusColor = 'var(--color-text-faint)';
      let statusIcon = 'circle-dashed';
      if (stats.correct > 0 || stats.wrong > 0) {
        if (computed.isMastered) { statusColor = 'var(--color-success)'; statusIcon = 'check-circle-2'; }
        else if (computed.isWeak) { statusColor = 'var(--color-danger)'; statusIcon = 'alert-circle'; }
        else { statusColor = 'var(--color-yellow)'; statusIcon = 'trending-up'; }
      }

      const card = el('div', { class: 'vault-card' }, [
        // Status Icon
        el('div', { style: `color:${statusColor}; display:flex; flex-direction:column; align-items:center; min-width:40px;` }, [
          el('i', { 'data-lucide': statusIcon, style: 'width:24px; height:24px;' })
        ]),
        // Content
        el('div', { style: 'flex:1;' }, [
          el('div', { style: 'display:flex; align-items:center; gap:8px; margin-bottom:4px;' }, [
            el('h4', { style: 'font-size:1.1rem; margin:0;' }, pair.term.label),
            el('span', { style: 'font-size:0.75rem; background:var(--color-bg); padding:2px 8px; border-radius:var(--radius-pill); border:1px solid var(--color-border); color:var(--color-text-soft); font-weight:600;' }, 
              `C: ${stats.correct} | M: ${stats.wrong}`
            )
          ]),
          el('p', { style: 'font-size:0.9rem; color:var(--color-text-soft); margin:0; line-height:1.4;' }, pair.def.label)
        ]),
        // Review Action
        el('button', { 
          class: 'pill-btn pill-btn--ghost', 
          style: 'padding:8px 16px; font-size:0.9rem;',
          onClick: () => handleReview(pair)
        }, [el('i', { 'data-lucide': 'book-open' }), ' Review'])
      ]);

      listContainer.appendChild(card);
    });

    fragment.appendChild(listContainer);
  });

  if (fragment.children.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding: var(--space-8) 0; color:var(--color-text-faint);">
        <i data-lucide="inbox" style="width:48px; height:48px; margin-bottom:var(--space-3);"></i>
        <p>No concepts found for this filter.</p>
      </div>
    `;
  } else {
    container.appendChild(fragment);
  }

  if (window.lucide) window.lucide.createIcons({ root: container });
}

export function renderVaultScreen(unused, options = {}) {
  // Reset state on open
  state.activeTab = options.topicId || 'all';
  state.searchQuery = '';
  state.filterWeakOnly = options.filter === 'weak';
  
  const searchInput = document.getElementById('vault-search-input');
  if (searchInput) {
    searchInput.value = '';
    // Avoid multiple listeners by removing old one
    const newSearchInput = searchInput.cloneNode(true);
    searchInput.parentNode.replaceChild(newSearchInput, searchInput);
    
    newSearchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      renderContent('vault-content');
    });
  }

  renderTabs('vault-tabs');
  renderContent('vault-content');
}
