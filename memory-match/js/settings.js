// settings.js — Settings modal content + theme application.

import { getSettings, saveSettings, resetPlayerProgress } from './storage.js';
import { el, clamp } from './utils.js';
import { setSoundEnabled, sounds } from './sound.js';

export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme === 'dark' ? 'dark' : 'light');
}

/** Call once on boot to sync sound + theme engines with stored settings */
export function bootSettings() {
  const s = getSettings();
  applyTheme(s.theme);
  setSoundEnabled(s.soundEffects);
  return s;
}

function switchEl(isOn, onToggle) {
  const btn = el('button', {
    class: `switch ${isOn ? 'is-on' : ''}`,
    role: 'switch',
    'aria-checked': String(isOn),
    onClick: () => onToggle(btn),
  });
  return btn;
}

/**
 * Builds the Settings modal. `onChange` is called with the updated settings
 * object whenever something changes (so callers can re-sync live UI, e.g. nav icons).
 */
export function buildSettingsModal({ onChange, onClose }) {
  let settings = getSettings();

  const soundToggle = switchEl(settings.soundEffects, (btn) => {
    settings = saveSettings({ soundEffects: !settings.soundEffects });
    setSoundEnabled(settings.soundEffects);
    btn.classList.toggle('is-on', settings.soundEffects);
    btn.setAttribute('aria-checked', String(settings.soundEffects));
    if (settings.soundEffects) sounds.click();
    onChange?.(settings);
  });

  const musicToggle = switchEl(settings.music, (btn) => {
    settings = saveSettings({ music: !settings.music });
    btn.classList.toggle('is-on', settings.music);
    btn.setAttribute('aria-checked', String(settings.music));
    onChange?.(settings);
  });

  const learnToggle = switchEl(settings.learnMode, (btn) => {
    settings = saveSettings({ learnMode: !settings.learnMode });
    btn.classList.toggle('is-on', settings.learnMode);
    btn.setAttribute('aria-checked', String(settings.learnMode));
    onChange?.(settings);
  });

  const hintCountLabel = el('span', {}, String(settings.hintCount));
  const hintStepper = el('div', { class: 'hint-stepper' }, [
    el('button', { 'aria-label': 'Decrease hints', onClick: () => {
      settings = saveSettings({ hintCount: clamp(settings.hintCount - 1, 0, 5) });
      hintCountLabel.textContent = String(settings.hintCount);
      onChange?.(settings);
    } }, '−'),
    hintCountLabel,
    el('button', { 'aria-label': 'Increase hints', onClick: () => {
      settings = saveSettings({ hintCount: clamp(settings.hintCount + 1, 0, 5) });
      hintCountLabel.textContent = String(settings.hintCount);
      onChange?.(settings);
    } }, '+'),
  ]);

  const lightBtn = el('button', { class: settings.theme === 'light' ? 'is-active' : '' }, [el('i', { 'data-lucide': 'sun' }), ' Light']);
  const darkBtn = el('button', { class: settings.theme === 'dark' ? 'is-active' : '' }, [el('i', { 'data-lucide': 'moon' }), ' Dark']);
  lightBtn.addEventListener('click', () => {
    settings = saveSettings({ theme: 'light' });
    applyTheme('light');
    lightBtn.classList.add('is-active');
    darkBtn.classList.remove('is-active');
    onChange?.(settings);
  });
  darkBtn.addEventListener('click', () => {
    settings = saveSettings({ theme: 'dark' });
    applyTheme('dark');
    darkBtn.classList.add('is-active');
    lightBtn.classList.remove('is-active');
    onChange?.(settings);
  });
  const themeGroup = el('div', { class: 'theme-toggle-group' }, [lightBtn, darkBtn]);

  const resetBtn = el('button', { class: 'pill-btn pill-btn--outline-coral' }, [el('i', { 'data-lucide': 'trash-2' }), ' Reset Progress']);
  resetBtn.addEventListener('click', () => {
    if (confirm('Reset all player progress? This will revert you to Level 1, 0 XP, and clear your concept mastery. Your settings and leaderboard scores will remain.')) {
      resetPlayerProgress();
      window.dispatchEvent(new Event('playerProgressReset'));
      onClose?.();
    }
  });

  const closeBtn = el('button', { class: 'icon-btn modal__close', 'aria-label': 'Close settings', onClick: () => onClose?.() }, el('i', { 'data-lucide': 'x' }));

  const modal = el('div', { class: 'modal modal--wide animate-pop', style: 'position:relative;' }, [
    closeBtn,
    el('h2', {}, [el('i', { 'data-lucide': 'settings' }), ' Settings']),
    el('div', { class: 'settings-list', style: 'margin-top:20px;' }, [
      el('div', { class: 'settings-row' }, [
        el('div', { class: 'settings-row__label' }, [el('span', { class: 'settings-row__icon' }, el('i', { 'data-lucide': 'volume-2' })), el('div', {}, [el('div', { class: 'settings-row__title' }, 'Sound Effects'), el('div', { class: 'settings-row__desc' }, 'Card flips, matches, and buttons')])]),
        soundToggle,
      ]),
      el('div', { class: 'settings-row' }, [
        el('div', { class: 'settings-row__label' }, [el('span', { class: 'settings-row__icon' }, el('i', { 'data-lucide': 'music' })), el('div', {}, [el('div', { class: 'settings-row__title' }, 'Background Music'), el('div', { class: 'settings-row__desc' }, 'Ambient music while you play')])]),
        musicToggle,
      ]),
      el('div', { class: 'settings-row' }, [
        el('div', { class: 'settings-row__label' }, [el('span', { class: 'settings-row__icon' }, el('i', { 'data-lucide': 'book-open' })), el('div', {}, [el('div', { class: 'settings-row__title' }, 'Learn Mode'), el('div', { class: 'settings-row__desc' }, 'Show explanations after each match')])]),
        learnToggle,
      ]),
      el('div', { class: 'settings-row' }, [
        el('div', { class: 'settings-row__label' }, [el('span', { class: 'settings-row__icon' }, el('i', { 'data-lucide': 'lightbulb' })), el('div', {}, [el('div', { class: 'settings-row__title' }, 'Hints per game'), el('div', { class: 'settings-row__desc' }, 'How many hints you start with')])]),
        hintStepper,
      ]),
      el('div', { class: 'settings-row' }, [
        el('div', { class: 'settings-row__label' }, [el('span', { class: 'settings-row__icon' }, el('i', { 'data-lucide': 'moon' })), el('div', {}, [el('div', { class: 'settings-row__title' }, 'Theme'), el('div', { class: 'settings-row__desc' }, 'Light or dark appearance')])]),
        themeGroup,
      ]),
    ]),
    el('div', { class: 'settings-danger' }, [resetBtn]),
  ]);

  return modal;
}

export function buildHowToPlayModal({ onClose }) {
  const steps = [
    'Choose a topic.',
    'Select difficulty and timer.',
    'Flip two cards.',
    'Find matching pairs.',
    'Correct matches earn points.',
    'Wrong matches reduce points.',
    'Build streaks for bonus points.',
    'Use hints wisely.',
    'Match all pairs before time runs out.',
  ];

  const closeBtn = el('button', { class: 'icon-btn modal__close', 'aria-label': 'Close', onClick: () => onClose?.() }, el('i', { 'data-lucide': 'x' }));

  return el('div', { class: 'modal modal--wide animate-pop', style: 'position:relative;' }, [
    closeBtn,
    el('h2', { style: 'text-align:center;' }, [el('i', { 'data-lucide': 'book-open' }), ' How to Play']),
    el('div', { class: 'htp-steps', style: 'margin-top:20px;' }, steps.map((s) => {
      return el('div', { class: 'htp-step' }, [
        el('span', { class: 'htp-step__num' }, el('i', { 'data-lucide': 'check-circle' })),
        el('span', { class: 'htp-step__text' }, s),
      ]);
    })),
  ]);
}
