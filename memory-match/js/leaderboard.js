// leaderboard.js — sorts and renders leaderboard entries.
// Storage access goes through storage.js only.

import { getLeaderboard, addLeaderboardEntry, clearLeaderboard } from './storage.js';
import { el, formatTime, escapeHTML } from './utils.js';

export function recordResult(entry) {
  return addLeaderboardEntry(entry);
}

/** Sort by highest score, then highest accuracy, then lowest completion time */
export function sortEntries(entries) {
  return entries.slice().sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
    return a.timeSeconds - b.timeSeconds;
  });
}

export function getTopEntries(limit = 10, filterFn = null) {
  const all = getLeaderboard();
  const filtered = filterFn ? all.filter(filterFn) : all;
  return sortEntries(filtered).slice(0, limit);
}

export function wipeLeaderboard() {
  clearLeaderboard();
}

function rankBadge(rank, rankChange = 0) {
  let badge;
  if (rank === 1) badge = el('span', { class: 'lb-rank lb-rank--1' }, el('i', { 'data-lucide': 'medal' }));
  else if (rank === 2) badge = el('span', { class: 'lb-rank lb-rank--2' }, el('i', { 'data-lucide': 'medal' }));
  else if (rank === 3) badge = el('span', { class: 'lb-rank lb-rank--3' }, el('i', { 'data-lucide': 'medal' }));
  else badge = el('span', { class: 'lb-rank' }, String(rank));

  let changeIcon;
  if (rankChange > 0) {
    changeIcon = el('span', { style: 'color: var(--color-success); font-size: 0.85rem; margin-left: 8px; font-weight: 800;' }, '↑ ' + rankChange);
  } else if (rankChange < 0) {
    changeIcon = el('span', { style: 'color: var(--color-danger); font-size: 0.85rem; margin-left: 8px; font-weight: 800;' }, '↓ ' + Math.abs(rankChange));
  } else {
    changeIcon = el('span', { style: 'color: var(--color-border); font-size: 0.85rem; margin-left: 8px; font-weight: 800;' }, '—');
  }

  return el('div', { style: 'display:flex; align-items:center;' }, [badge, changeIcon]);
}

/**
 * Renders the leaderboard table body into `tbodyEl`.
 * @param {HTMLElement} tbodyEl
 * @param {Array} entries already sorted, already limited
 * @param {string|null} currentPlayerName highlight this player's row if present
 * @param {number|null} currentPlayerRankChange rank change for the current player
 */
export function renderLeaderboardTable(tbodyEl, entries, currentPlayerName = null, currentPlayerRankChange = 0) {
  tbodyEl.innerHTML = '';

  if (entries.length === 0) {
    const emptyRow = el('tr', {}, [
      el('td', { colspan: '9' }, [
        el('div', { class: 'leaderboard-empty' }, [
          el('div', { class: 'icon' }, el('i', { 'data-lucide': 'trophy' })),
          el('p', {}, 'No scores yet — play a game to be the first on the board!'),
        ]),
      ]),
    ]);
    tbodyEl.appendChild(emptyRow);
    return;
  }

  const fragment = document.createDocumentFragment();

  entries.forEach((entryData, index) => {
    const isCurrent = currentPlayerName && entryData.name === currentPlayerName;
    const rankDelta = isCurrent ? currentPlayerRankChange : 0;
    
    const row = el('tr', { class: isCurrent ? 'is-current-user' : '' }, [
      el('td', {}, [rankBadge(index + 1, rankDelta)]),
      el('td', {}, entryData.name),
      el('td', {}, entryData.topicTitle),
      el('td', {}, entryData.difficulty.charAt(0).toUpperCase() + entryData.difficulty.slice(1)),
      el('td', {}, String(entryData.score)),
      el('td', { style: 'color: var(--color-purple); font-weight:700;' }, entryData.xp ? `+${entryData.xp}` : '-'),
      el('td', { class: 'hide-mobile' }, formatTime(entryData.timeSeconds)),
      el('td', { class: 'hide-mobile' }, `${entryData.accuracy}%`),
      el('td', {}, entryData.date),
    ]);
    fragment.appendChild(row);
  });
  
  tbodyEl.appendChild(fragment);
  if (window.lucide) window.lucide.createIcons({ root: tbodyEl });
}
