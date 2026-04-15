'use strict';

const CIRCUMFERENCE = 2 * Math.PI * 90;

// Durations in seconds — updated from storage on load
var WORK_DURATION  = 25 * 60;
var BREAK_DURATION = 5  * 60;

// Track last rendered controls state to avoid unnecessary DOM rebuilds
var lastPhase  = null;
var lastPaused = null;

function loadDurations(cb) {
  chrome.storage.local.get(['workMinutes', 'breakMinutes'], function(r) {
    WORK_DURATION  = (r.workMinutes  || 25) * 60;
    BREAK_DURATION = (r.breakMinutes || 5)  * 60;
    if (cb) cb();
  });
}

let currentYear  = new Date().getFullYear();
let currentMonth = new Date().getMonth();
let pollInterval = null;

const COLOR_SCHEMES = {
  green:   { vars: ['#1a1916','#4cef84','#34b866','#27864d','#1e5c35','#1a3322'] },
  orange:  { vars: ['#1a1916','#f09040','#c86820','#904818','#5c3010','#2a1a08'] },
  red:     { vars: ['#1a1916','#f04040','#c82020','#941818','#5c1010','#220808'] },
  ocean:   { vars: ['#1a1916','#40d4ff','#0ea4d8','#0e72aa','#0e4a72','#0d2a3d'] }
};
var activeScheme = 'green';
var invertScheme = false;

function getSchemeColors() {
  var base = COLOR_SCHEMES[activeScheme].vars;
  if (!invertScheme) return base;
  // Keep index 0 (empty cell background) fixed, invert levels 1-5
  return [base[0], base[5], base[4], base[3], base[2], base[1]];
}

function applyColorScheme(scheme, invert) {
  activeScheme = scheme;
  if (invert !== undefined) invertScheme = invert;
  var colors = getSchemeColors();
  colors.forEach(function(c, i) { document.documentElement.style.setProperty('--heat-' + i, c); });
  // Set scheme-color = brightest active color (level 1 = lightest in normal, or level 5 inverted)
  document.documentElement.style.setProperty('--scheme-color', colors[1]);
  document.documentElement.style.setProperty('--scheme-color-dim', colors[3]);

  // Legend: 3 cells — lo (min), mid, hi (max)
  var lo  = document.getElementById('leg-lo');
  var mid = document.getElementById('leg-mid');
  var hi  = document.getElementById('leg-hi');
  if (lo)  { lo.style.background  = colors[1]; lo.style.border  = 'none'; }
  if (mid) { mid.style.background = colors[3]; mid.style.border = 'none'; }
  if (hi)  { hi.style.background  = colors[5]; hi.style.border  = 'none'; }

  if (document.getElementById('panel-history').classList.contains('active')) renderHistory();
  chrome.storage.local.set({ colorScheme: scheme, invertScheme: invertScheme });
}

function loadColorScheme() {
  chrome.storage.local.get(['colorScheme', 'invertScheme'], function(r) {
    var scheme = r.colorScheme || 'green';
    invertScheme = r.invertScheme || false;
    var radio = document.getElementById('scheme-' + scheme);
    if (radio) radio.checked = true;
    var cb = document.getElementById('scheme-invert');
    if (cb) cb.checked = invertScheme;
    applyColorScheme(scheme);
  });
}

document.querySelectorAll('input[name="colorscheme"]').forEach(function(radio) {
  radio.addEventListener('change', function() { if (radio.checked) applyColorScheme(radio.value); });
});

// Invert checkbox wired after DOM ready — see bottom of init section


// ─── I18N ─────────────────────────────────────────────────────────────────────
var LANGS = {
  en: {
    tab_timer: 'Timer', tab_history: 'History', tab_settings: 'Settings',
    ready: 'ready to work', working: 'working', paused: 'paused',
    break_active: 'break', break_paused: 'pause',
    cycle_label: 'work cycle', cycle_min: 'min', break_label: 'break',
    today_lbl: 'today', per_year: 'year', per_month: 'month', per_week: 'week',
    less: 'less', more: 'more',
    invert_lbl: 'invert: dark = more',
    calendar_heading: 'Calendar',
    analytics_title: 'activity by weekday, last 365 days (avg)',
    year_nav_sync: '↓ sync',
    color_scheme: 'Color scheme',
    settings_theme: 'Appearance', theme_dark: 'Dark', theme_light: 'Light',
    settings_duration: 'Cycle Duration',
    work_cycle: '🍅 Work cycle', break_cycle: '☕ Break',
    btn_apply: 'Apply',
    settings_storage: 'Export / Import history',
    hint_file: 'History is stored in the browser. Please save backups regularly.',
    btn_save_file: 'Save file', btn_load_file: 'Load file',
    settings_export: 'Export / Import',
    btn_export: 'Export JSON', btn_import: 'Import JSON',
    settings_lang: 'Language',
    made_by: 'Made by',
    notify_work_title: 'Pomodoro done!', notify_work_msg: "Great work! What's next?",
    notify_break_title: 'Break over!', notify_break_msg: 'Ready for the next cycle?',
    btn_rest: '☕ Rest', btn_more_cycle: '▶ One more', btn_start_cycle: '▶ Start cycle', btn_later: '⏸ Later', btn_rest_more: '☕ Rest',
    start: '▶ start', pause: '⏸ pause', reset: '⏹ reset', resume: '▶ resume',
    per_year_lbl: 'year', per_month_lbl: 'month', per_week_lbl: 'week', today_lbl2: 'today',
    streak: 'streak', best_day: 'best day',
    test_lbl: '🧪 test', test_add: '+1 today', test_fill: '📅 4 mo.', test_end: '⏱ end', test_clear: '✕',
    scheme_green: 'green', scheme_orange: 'orange', scheme_red: 'red', scheme_ocean: 'ocean',
    theme_dark: 'Dark', theme_light: 'Light',
    settings_sound: 'Sound',
    sound_enabled: 'sound notification',
    sound_preset: 'preset', sound_volume: 'volume',
    btn_preview_sound: '▶ test',
    settings_automation: 'Automation', auto_resume: 'auto-resume cycles',
    preset_classic: 'Classic', preset_bell: 'Bell', preset_blip: 'Blip', preset_chime: 'Chime', preset_drop: 'Drop',
    wd_short: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
    wd_full: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'],
    months: ['January','February','March','April','May','June','July','August','September','October','November','December'],
    tomato_plural: function(n) { return n === 1 ? 'pomodoro' : 'pomodoros'; },
    avg_label: 'avg',
  },
  ru: {
    tab_timer: 'Таймер', tab_history: 'История', tab_settings: 'Настройки',
    ready: 'готов к работе', working: 'работаем', paused: 'на паузе',
    break_active: 'перерыв', break_paused: 'пауза',
    cycle_label: 'рабочий цикл', cycle_min: 'мин', break_label: 'перерыв',
    today_lbl: 'сегодня', per_year: 'за год', per_month: 'за месяц', per_week: 'за неделю',
    color_scheme: 'цветовая гамма', less: 'меньше', more: 'больше',
    invert_lbl: 'инвертировать: тёмный = больше',
    calendar_heading: 'Календарь',
    analytics_title: 'активность по дням недели за год (среднее)',
    year_nav_sync: '↓ обновить',
    settings_theme: 'Тема оформления', theme_dark: 'Тёмная', theme_light: 'Светлая',
    settings_duration: 'Длительность циклов',
    work_cycle: '🍅 Рабочий цикл', break_cycle: '☕ Перерыв',
    btn_apply: 'Применить',
    settings_storage: 'Экспорт / импорт истории',
    hint_file: 'История хранится в браузере. Сохраняйте резервные копии вручную.',
    btn_save_file: 'Сохранить файл', btn_load_file: 'Загрузить файл',
    settings_export: 'Экспорт / импорт',
    btn_export: 'Экспорт JSON', btn_import: 'Импорт JSON',
    settings_lang: 'Язык',
    made_by: 'Сделано',
    notify_work_title: 'Помидор завершён!', notify_work_msg: 'Отличная работа! Что дальше?',
    notify_break_title: 'Перерыв окончен!', notify_break_msg: 'Готов к следующему циклу?',
    btn_rest: '☕ Отдохнуть', btn_more_cycle: '▶ Ещё цикл', btn_start_cycle: '▶ Начать цикл', btn_later: '⏸ Позже', btn_rest_more: '☕ Отдохнуть',
    start: '▶ старт', pause: '⏸ пауза', reset: '⏹ сброс', resume: '▶ продолжить',
    per_year_lbl: 'за год', per_month_lbl: 'за месяц', per_week_lbl: 'за неделю', today_lbl2: 'сегодня',
    streak: 'серия дней', best_day: 'лучший день',
    test_lbl: '🧪 тест', test_add: '+1 сегодня', test_fill: '📅 4 мес.', test_end: '⏱ конец', test_clear: '✕',
    scheme_green: 'зелёная', scheme_orange: 'оранжевая', scheme_red: 'красная', scheme_ocean: 'океан',
    theme_dark: 'Тёмная', theme_light: 'Светлая',
    settings_sound: 'Звук',
    sound_enabled: 'звуковое уведомление',
    sound_preset: 'пресет', sound_volume: 'громкость',
    btn_preview_sound: '▶ тест',
    settings_automation: 'Автоматизация', auto_resume: 'авто-возобновление циклов',
    preset_classic: 'Классик', preset_bell: 'Колокол', preset_blip: 'Бип', preset_chime: 'Перезвон', preset_drop: 'Нота',
    wd_short: ['пн','вт','ср','чт','пт','сб','вс'],
    wd_full: ['понедельник','вторник','среда','четверг','пятница','суббота','воскресенье'],
    months: ['январь','февраль','март','апрель','май','июнь','июль','август','сентябрь','октябрь','ноябрь','декабрь'],
    months_gen: ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'],
    tomato_plural: function(n) { return 'помидор' + (n % 10 === 1 && n % 100 !== 11 ? '' : [2,3,4].indexOf(n % 10) >= 0 && [12,13,14].indexOf(n % 100) < 0 ? 'а' : 'ов'); },
    avg_label: 'среднее',
  }
};

var currentLang = 'en';

function t(key) {
  return (LANGS[currentLang] && LANGS[currentLang][key]) || LANGS['en'][key] || key;
}

function applyLang() {
  // Tabs
  document.querySelectorAll('.tab').forEach(function(btn) {
    var tab = btn.dataset.tab;
    if (tab === 'timer')    btn.textContent = t('tab_timer');
    if (tab === 'history')  btn.textContent = t('tab_history');
    if (tab === 'settings') btn.textContent = t('tab_settings');
  });
  // Timer panel static labels
  var el;
  // color_scheme title now uses data-i18n and is handled by the loop below
  el = document.getElementById('calendar-heading-el'); if (el) el.textContent = t('calendar_heading');
  el = document.getElementById('analytics-title-el');  if (el) el.textContent = t('analytics_title');
  // Legend
  document.querySelectorAll('[data-i18n]').forEach(function(el2) {
    el2.textContent = t(el2.dataset.i18n);
  });
  // Scheme names
  var schemeMap = {green: t('scheme_green'), orange: t('scheme_orange'), red: t('scheme_red'), ocean: t('scheme_ocean')};
  document.querySelectorAll('.scheme-opt').forEach(function(opt) {
    var inp = opt.querySelector('input');
    var span = opt.querySelector('[data-i18n]');
    if (inp && span && schemeMap[inp.value]) span.textContent = schemeMap[inp.value];
  });
  // Theme button labels
  var tdLbl = document.querySelector('label[for="theme-dark"] [data-i18n="theme_dark"]');
  var tlLbl = document.querySelector('label[for="theme-light"] [data-i18n="theme_light"]');
  if (tdLbl) tdLbl.textContent = t('theme_dark');
  if (tlLbl) tlLbl.textContent = t('theme_light');
  // Update duration value units
  var wv = document.getElementById('work-val');
  var bv = document.getElementById('break-val');
  if (wv) { var wm2 = wv.textContent.split(' ')[0]; wv.textContent = wm2 + ' ' + t('cycle_min'); }
  if (bv) { var bm2 = bv.textContent.split(' ')[0]; bv.textContent = bm2 + ' ' + t('cycle_min'); }
  // Re-render calendar if history panel open (updates month names)
  if (document.getElementById('panel-history').classList.contains('active')) renderHistory();
  // Settings
  document.querySelectorAll('.settings-title:not([data-i18n])').forEach(function(el3, idx) {
    var keys = ['settings_theme','settings_duration'];
    if (keys[idx]) el3.textContent = t(keys[idx]);
  });
  el = document.getElementById('theme-dark-lbl');  if (el) el.childNodes[el.childNodes.length-1].textContent = ' ' + t('theme_dark');
  el = document.getElementById('theme-light-lbl'); if (el) el.childNodes[el.childNodes.length-1].textContent = ' ' + t('theme_light');
  el = document.querySelector('#storage-file .settings-hint'); if (el) el.textContent = t('hint_file');
  el = document.getElementById('btn-export-file');  if (el) el.textContent = t('btn_save_file');
  el = document.getElementById('btn-import-file2'); if (el) el.textContent = t('btn_load_file');
  el = document.getElementById('btn-save-durations'); if (el && !el.classList.contains('saved')) el.textContent = t('btn_apply');
  var durSection = document.querySelector('#panel-settings .settings-section:has(#work-slider)');
  if (durSection) {
    var durRows = durSection.querySelectorAll('.dur-row');
    if (durRows[0]) durRows[0].querySelector('.dur-label').textContent = t('work_cycle');
    if (durRows[1]) durRows[1].querySelector('.dur-label').textContent = t('break_cycle');
  }
  // Invert label
  el = document.querySelector('.invert-label'); if (el) el.textContent = t('invert_lbl');
  // Test bar
  el = document.querySelector('.test-label');   if (el) el.textContent = t('test_lbl');
  el = document.getElementById('btn-test-add'); if (el) el.textContent = t('test_add');
  el = document.getElementById('btn-test-fill');if (el) el.textContent = t('test_fill');
  el = document.getElementById('btn-test-end'); if (el) el.textContent = t('test_end');
  el = document.getElementById('btn-test-clear');if (el) el.textContent = t('test_clear');
  // Timer stats labels
  document.querySelectorAll('.ts-lbl').forEach(function(lbl, idx) {
    var keys2 = ['per_year_lbl','per_month_lbl','per_week_lbl','today_lbl2'];
    if (keys2[idx]) lbl.textContent = t(keys2[idx]);
  });
}

function loadLang() {
  chrome.storage.local.get(['appLang'], function(r) {
    var br = navigator.language && navigator.language.startsWith('ru') ? 'ru' : 'en';
    currentLang = r.appLang || br;
    var radio = document.getElementById('lang-' + currentLang);
    if (radio) radio.checked = true;
    applyLang();
  });
}

document.querySelectorAll('input[name="applang"]').forEach(function(radio) {
  radio.addEventListener('change', function() {
    if (radio.checked) {
      currentLang = radio.value;
      chrome.storage.local.set({ appLang: currentLang });
      applyLang();
      updateTimerUI();
    }
  });
});

// ─── THEME ────────────────────────────────────────────────────────────────────
function applyTheme(theme) {
  document.body.className = 'theme-' + theme;
  chrome.storage.local.set({ appTheme: theme });
}

function loadTheme() {
  chrome.storage.local.get(['appTheme'], function(r) {
    var theme = r.appTheme || 'dark';
    var radio = document.getElementById('theme-' + theme);
    if (radio) radio.checked = true;
    applyTheme(theme);
  });
}

document.querySelectorAll('input[name="apptheme"]').forEach(function(radio) {
  radio.addEventListener('change', function() { if (radio.checked) applyTheme(radio.value); });
});

// ─── TIMER STATS ──────────────────────────────────────────────────────────────
function updateTimerStats() {
  chrome.runtime.sendMessage({ type: 'GET_HISTORY' }, function(r) {
    var history = r.history || {};
    var now = new Date();
    var todayStr = now.toISOString().split('T')[0];
    var yearPfx  = String(now.getFullYear()) + '-';
    var monthPfx = String(now.getFullYear()) + '-' + String(now.getMonth()+1).padStart(2,'0');
    var dayOfWeek = (now.getDay() + 6) % 7;
    var weekStart = new Date(now); weekStart.setDate(now.getDate() - dayOfWeek); weekStart.setHours(0,0,0,0);

    var yr = 0, mo = 0, wk = 0, td = 0;
    Object.keys(history).forEach(function(key) {
      var val = history[key];
      if (key.startsWith(yearPfx))  yr += val;
      if (key.startsWith(monthPfx)) mo += val;
      if (key === todayStr)          td += val;
      var d = new Date(key + 'T12:00:00');
      if (d >= weekStart)            wk += val;
    });

    var el;
    el = document.getElementById('ts-year');  if (el) el.textContent = yr;
    el = document.getElementById('ts-month'); if (el) el.textContent = mo;
    el = document.getElementById('ts-week');  if (el) el.textContent = wk;
    el = document.getElementById('ts-today'); if (el) el.textContent = td;
  });
}

// TABS
document.querySelectorAll('.tab').forEach(function(btn) {
  btn.addEventListener('click', function() {
    document.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active'); });
    document.querySelectorAll('.panel').forEach(function(p) { p.classList.remove('active'); });
    btn.classList.add('active');
    document.getElementById('panel-' + btn.dataset.tab).classList.add('active');
    if (btn.dataset.tab === 'history')  renderHistory();
    if (btn.dataset.tab === 'settings') loadSettings();
  });
});

// TIMER
function timerAction(action) {
  if (action === 'pause') {
    // Compute remaining right now before any async delay
    chrome.runtime.sendMessage({ type: 'GET_STATE' }, function(state) {
      if (!state) return;
      var elapsed = state.paused ? 0 : Math.floor((Date.now() - state.startedAt) / 1000);
      var rem = Math.max(0, state.remaining - elapsed);
      chrome.runtime.sendMessage({ type: 'PAUSE', remaining: rem }, function() {
        setTimeout(updateTimerUI, 50);
      });
    });
  } else {
    chrome.runtime.sendMessage({ type: action.toUpperCase() }, function() {
      setTimeout(updateTimerUI, 80);
    });
  }
}

function buildControls(state) {
  if (state.phase === lastPhase && state.paused === lastPaused) return;
  lastPhase  = state.phase;
  lastPaused = state.paused;

  var controls = document.getElementById('controls');
  controls.innerHTML = '';

  if (state.phase === 'idle') {
    var btn = document.createElement('button');
    btn.className = 'btn primary';
    btn.textContent = t('start');
    btn.addEventListener('click', function() { timerAction('start'); });
    controls.appendChild(btn);

  } else if (state.paused) {
    var r = document.createElement('button');
    r.className = 'btn primary';
    r.textContent = t('resume');
    r.addEventListener('click', function() { timerAction('resume'); });
    var s = document.createElement('button');
    s.className = 'btn';
    s.textContent = t('reset');
    s.addEventListener('click', function() { timerAction('reset'); });
    controls.appendChild(r);
    controls.appendChild(s);

  } else {
    var p = document.createElement('button');
    p.className = 'btn';
    p.textContent = t('pause');
    p.addEventListener('click', function() { timerAction('pause'); });
    var s2 = document.createElement('button');
    s2.className = 'btn';
    s2.textContent = t('reset');
    s2.addEventListener('click', function() { timerAction('reset'); });
    controls.appendChild(p);
    controls.appendChild(s2);
  }
}

function updateTimerUI() {
  chrome.runtime.sendMessage({ type: 'GET_STATE' }, function(state) {
    if (!state) return;

    // Single timestamp for both UI and icon — guarantees zero drift
    var now = Date.now();
    var rem;
    if (state.phase === 'idle' || state.paused) {
      rem = state.remaining;
    } else {
      var elapsed = Math.floor((now - state.startedAt) / 1000);
      rem = Math.max(0, state.remaining - elapsed);
    }

    // Detect cycle end
    if (rem === 0 && state.phase !== 'idle' && !state.paused) {
      chrome.runtime.sendMessage({ type: 'FORCE_CYCLE_END' });
      return;
    }

    // Update display
    var mins = String(Math.floor(rem / 60)).padStart(2, '0');
    var secs = String(rem % 60).padStart(2, '0');
    document.getElementById('timer-time').textContent = mins + ':' + secs;

    var total    = state.phase === 'break' ? BREAK_DURATION : WORK_DURATION;
    var fraction = rem / total;
    var ring     = document.getElementById('ring-prog');
    ring.style.strokeDashoffset = -CIRCUMFERENCE * (1 - fraction);
    ring.classList.toggle('break-mode', state.phase === 'break');

    var phaseEl = document.getElementById('phase-label');
    var subEl   = document.getElementById('timer-sub');
    if (state.phase === 'idle') {
      phaseEl.textContent = t('ready'); phaseEl.className = 'phase-label';
      subEl.textContent   = t('cycle_label') + ' · ' + Math.round(WORK_DURATION / 60) + ' ' + t('cycle_min');
    } else if (state.phase === 'work') {
      phaseEl.textContent = state.paused ? t('paused') : t('working'); phaseEl.className = 'phase-label work';
      subEl.textContent   = t('cycle_label') + ' · ' + Math.round(WORK_DURATION / 60) + ' ' + t('cycle_min');
    } else {
      phaseEl.textContent = state.paused ? t('break_paused') : t('break_active'); phaseEl.className = 'phase-label break';
      subEl.textContent   = t('break_label') + ' · ' + Math.round(BREAK_DURATION / 60) + ' ' + t('cycle_min');
    }

    buildControls(state);

    // Update icon with the exact same rem — no second round-trip, no drift
    if (state.phase !== 'idle' && !state.paused && rem > 0) {
      chrome.runtime.sendMessage({ type: 'UPDATE_ICON', remaining: rem });
    }
  });
}

function updateIconFromPopup() {} // merged into updateTimerUI

function startPolling() {
  updateTimerUI();
  updateIconFromPopup();
  pollInterval = setInterval(function() {
    updateTimerUI();
    updateIconFromPopup();
  }, 1000);
}
function stopPolling()  { if (pollInterval) clearInterval(pollInterval); }
window.addEventListener('unload', stopPolling);

// Wire year nav
document.getElementById('btn-year-prev').addEventListener('click', function() { changeYear(-1); });
document.getElementById('btn-year-next').addEventListener('click', function() { changeYear(1); });
document.getElementById('btn-month-prev').addEventListener('click', function() { changeMonth(-1); });
document.getElementById('btn-month-next').addEventListener('click', function() { changeMonth(1); });

// Wire sync


// ─── SOUND SETTING ────────────────────────────────────────────────────────────
var soundEnabled = true;
var soundPreset  = 'classic';
var soundVolume  = 100; // 0–100

function soundTone(ctx, type, freq, t0, duration, vol) {
  var osc = ctx.createOscillator();
  var gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
  osc.start(t0);
  osc.stop(t0 + duration);
}

var SOUND_PRESETS = {
  classic: function(ctx, isWork, vol) {
    var t = ctx.currentTime;
    if (isWork) {
      soundTone(ctx, 'sine', 660, t,        0.25, 0.25 * vol);
      soundTone(ctx, 'sine', 880, t + 0.30, 0.35, 0.25 * vol);
    } else {
      soundTone(ctx, 'sine', 528, t, 0.45, 0.20 * vol);
    }
  },
  bell: function(ctx, isWork, vol) {
    var t = ctx.currentTime;
    if (isWork) {
      soundTone(ctx, 'triangle', 880,  t, 1.2, 0.30 * vol);
      soundTone(ctx, 'triangle', 1760, t, 0.4, 0.10 * vol);
    } else {
      soundTone(ctx, 'triangle', 660, t, 1.5, 0.28 * vol);
    }
  },
  blip: function(ctx, isWork, vol) {
    var t = ctx.currentTime;
    if (isWork) {
      soundTone(ctx, 'square', 900,  t,        0.07, 0.18 * vol);
      soundTone(ctx, 'square', 1200, t + 0.12, 0.07, 0.18 * vol);
    } else {
      soundTone(ctx, 'square', 600, t, 0.12, 0.16 * vol);
    }
  },
  chime: function(ctx, isWork, vol) {
    var t = ctx.currentTime;
    if (isWork) {
      soundTone(ctx, 'sine', 523, t, 0.6, 0.20 * vol);
      soundTone(ctx, 'sine', 659, t, 0.6, 0.16 * vol);
      soundTone(ctx, 'sine', 784, t, 0.6, 0.12 * vol);
    } else {
      soundTone(ctx, 'sine', 392, t, 0.7, 0.20 * vol);
      soundTone(ctx, 'sine', 494, t, 0.7, 0.16 * vol);
      soundTone(ctx, 'sine', 587, t, 0.7, 0.12 * vol);
    }
  },
  drop: function(ctx, isWork, vol) {
    var t = ctx.currentTime;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    if (isWork) {
      osc.frequency.setValueAtTime(880, t);
      osc.frequency.linearRampToValueAtTime(440, t + 0.5);
    } else {
      osc.frequency.setValueAtTime(440, t);
      osc.frequency.linearRampToValueAtTime(660, t + 0.4);
    }
    gain.gain.setValueAtTime(0.28 * vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    osc.start(t);
    osc.stop(t + 0.7);
  }
};

function updateSoundOptionsVisibility() {
  var opts = document.getElementById('sound-options');
  if (opts) opts.style.display = soundEnabled ? '' : 'none';
}

function loadSoundSettings() {
  chrome.storage.local.get(['soundEnabled', 'soundPreset', 'soundVolume'], function(r) {
    soundEnabled = r.soundEnabled !== false;
    soundPreset  = r.soundPreset  || 'classic';
    soundVolume  = r.soundVolume  != null ? r.soundVolume : 100;

    var cb = document.getElementById('sound-enabled');
    if (cb) cb.checked = soundEnabled;

    var radio = document.getElementById('preset-' + soundPreset);
    if (radio) radio.checked = true;

    var slider = document.getElementById('vol-slider');
    var val    = document.getElementById('vol-val');
    if (slider) slider.value = soundVolume;
    if (val)    val.textContent = soundVolume + '%';

    updateSoundOptionsVisibility();
  });
}

document.getElementById('sound-enabled').addEventListener('change', function() {
  soundEnabled = this.checked;
  chrome.storage.local.set({ soundEnabled: soundEnabled });
  updateSoundOptionsVisibility();
});

document.querySelectorAll('input[name="soundpreset"]').forEach(function(radio) {
  radio.addEventListener('change', function() {
    if (radio.checked) {
      soundPreset = radio.value;
      chrome.storage.local.set({ soundPreset: soundPreset });
      playNotifySound(true);
    }
  });
});

(function() {
  var slider = document.getElementById('vol-slider');
  var val    = document.getElementById('vol-val');
  slider.addEventListener('input', function() {
    soundVolume = parseInt(slider.value, 10);
    val.textContent = soundVolume + '%';
    chrome.storage.local.set({ soundVolume: soundVolume });
  });
})();


// ─── CYCLE END OVERLAY ────────────────────────────────────────────────────────
function playNotifySound(isWork) {
  if (!soundEnabled) return;
  try {
    var ctx = new AudioContext();
    var preset = SOUND_PRESETS[soundPreset] || SOUND_PRESETS.classic;
    ctx.resume().then(function() {
      preset(ctx, isWork, soundVolume / 100);
      setTimeout(function() { ctx.close(); }, 2000);
    }).catch(function() { ctx.close(); });
  } catch(e) {}
}

function showCycleNotify(cycleType, skipSound) {
  chrome.storage.local.remove('pendingNotify');
  chrome.action.setBadgeText({ text: '' });
  if (!skipSound) playNotifySound(cycleType === 'work');
  var overlay   = document.getElementById('cycle-notify');
  var icon      = document.getElementById('notify-icon');
  var title     = document.getElementById('notify-title');
  var msg       = document.getElementById('notify-msg');
  var btn1      = document.getElementById('notify-btn1');
  var btn2      = document.getElementById('notify-btn2');

  if (cycleType === 'work') {
    icon.textContent  = '🍅';
    title.textContent = t('notify_work_title');
    msg.textContent   = t('notify_work_msg');
    btn1.textContent  = t('btn_rest');
    btn2.textContent  = t('btn_more_cycle');
    btn1.className    = 'btn primary';
    btn2.className    = 'btn';
    btn1.onclick = function() {
      hideNotify();
      chrome.runtime.sendMessage({ type: 'START_BREAK' }, function() { updateTimerUI(); });
    };
    btn2.onclick = function() {
      hideNotify();
      chrome.runtime.sendMessage({ type: 'START' }, function() { updateTimerUI(); });
    };
  } else {
    icon.textContent  = '⏰';
    title.textContent = t('notify_break_title');
    msg.textContent   = t('notify_break_msg');
    btn1.textContent  = t('btn_start_cycle');
    btn2.textContent  = t('btn_rest_more');
    btn1.className    = 'btn primary';
    btn2.className    = 'btn';
    btn1.onclick = function() {
      hideNotify();
      chrome.runtime.sendMessage({ type: 'START' }, function() { updateTimerUI(); });
    };
    btn2.onclick = function() {
      hideNotify();
      chrome.runtime.sendMessage({ type: 'START_BREAK' }, function() { updateTimerUI(); });
    };
  }

  overlay.classList.add('visible');
}

function hideNotify() {
  document.getElementById('cycle-notify').classList.remove('visible');
}

document.getElementById('notify-close').addEventListener('click', hideNotify);

// Listen for cycle-done message from background
chrome.runtime.onMessage.addListener(function(msg) {
  if (msg.type === 'CYCLE_DONE') {
    updateTimerStats();
    if (!msg.autoResumed) {
      showCycleNotify(msg.cycleType);
    }
  }
});

// Init — load color scheme first, then start everything
document.getElementById('year-label').textContent = currentYear;
loadLang();
loadTheme();
loadColorScheme();
loadSoundSettings(); // sets --scheme-color synchronously after storage read
loadDurations(function() {
  startPolling();
  // Show overlay if cycle ended while popup was closed
  chrome.storage.local.get(['pendingNotify'], function(r) {
    if (r.pendingNotify) showCycleNotify(r.pendingNotify, true);
  });
});
updateTimerStats();

// Wire invert checkbox
var invertCb = document.getElementById('scheme-invert');
if (invertCb) {
  invertCb.addEventListener('change', function() {
    applyColorScheme(activeScheme, this.checked);
  });
}

// Wire auto-resume checkbox
var autoResumeCb = document.getElementById('auto-resume');
if (autoResumeCb) {
  chrome.storage.local.get(['autoResume'], function(r) {
    autoResumeCb.checked = r.autoResume === true;
  });
  autoResumeCb.addEventListener('change', function() {
    chrome.storage.local.set({ autoResume: this.checked });
  });
}

// HISTORY
function MONTHS_FULL() { return LANGS[currentLang].months || LANGS['en'].months; }
function MONTHS_GEN()  { return LANGS[currentLang].months_gen || LANGS[currentLang].months || LANGS['en'].months; }
function WEEKDAYS() { return LANGS[currentLang].wd_short || LANGS['en'].wd_short; }

function changeYear(delta) {
  currentYear += delta;
  document.getElementById('year-label').textContent = currentYear;
  renderHistory();
}

function changeMonth(delta) {
  currentMonth += delta;
  if (currentMonth < 0)  { currentMonth = 11; currentYear--; document.getElementById('year-label').textContent = currentYear; }
  if (currentMonth > 11) { currentMonth = 0;  currentYear++; document.getElementById('year-label').textContent = currentYear; }
  renderHistory();
}

function getHeatLevel(n) {
  if (!n)     return 0;
  if (n <= 1) return 1;
  if (n <= 3) return 2;
  if (n <= 5) return 3;
  if (n <= 8) return 4;
  return 5;
}
function getHeatColor(level) { return getSchemeColors()[level]; }

function renderHistory() {
  chrome.runtime.sendMessage({ type: 'GET_HISTORY' }, function(r) {
    var history    = r.history || {};
    var year       = currentYear;
    var now        = new Date();
    var todayYear  = now.getFullYear();
    var todayMonth = now.getMonth();
    var todayDate  = now.getDate();

    // Week start = Monday
    var dayOfWeek  = (now.getDay() + 6) % 7; // Mon=0
    var weekStart  = new Date(now); weekStart.setDate(now.getDate() - dayOfWeek); weekStart.setHours(0,0,0,0);

    var total = 0, monthTotal = 0, weekTotal = 0, todayTotal = 0;
    var weekdayTotals = [0,0,0,0,0,0,0];
    var todayStr  = now.toISOString().split('T')[0];
    var monthPfx  = String(year) + '-' + String(todayMonth+1).padStart(2,'0');

    Object.keys(history).forEach(function(key) {
      if (!key.startsWith(String(year))) return;
      var val = history[key];
      total += val;
      var d   = new Date(key + 'T12:00:00');
      var dow = (d.getDay() + 6) % 7;
      weekdayTotals[dow] += val;
      if (year === todayYear) {
        if (key === todayStr)           todayTotal  += val;
        if (key.startsWith(monthPfx))   monthTotal  += val;
        if (d >= weekStart)             weekTotal   += val;
      }
    });

    var stEl = document.getElementById('stat-total'); if (stEl) stEl.textContent = total;
    var mEl = document.getElementById('stat-month');  if (mEl) mEl.textContent = year === todayYear ? monthTotal : '—';
    var wEl = document.getElementById('stat-week');   if (wEl) wEl.textContent = year === todayYear ? weekTotal  : '—';
    var tEl = document.getElementById('stat-today2'); if (tEl) tEl.textContent = year === todayYear ? todayTotal : '—';

    // Update month nav label
    var navLabel = document.getElementById('month-nav-label');
    if (navLabel) navLabel.textContent = MONTHS_FULL()[currentMonth] + ' ' + currentYear;

    // Render single month
    var grid = document.getElementById('calendar-grid');
    grid.innerHTML = '';

    // Weekday headers
    var wdRow = document.createElement('div');
    wdRow.className = 'month-weekdays';
    WEEKDAYS().forEach(function(wd, i) {
      var el = document.createElement('div');
      el.className = 'wd-label' + (i >= 5 ? ' wd-weekend' : '');
      el.textContent = wd;
      wdRow.appendChild(el);
    });
    grid.appendChild(wdRow);

    // Days grid
    var daysEl = document.createElement('div');
    daysEl.className = 'month-days';

    var m = currentMonth;
    var startOffset = (new Date(year, m, 1).getDay() + 6) % 7;
    var daysInMonth = new Date(year, m + 1, 0).getDate();

    for (var e = 0; e < startOffset; e++) {
      var empty = document.createElement('div');
      empty.className = 'day-cell day-empty';
      daysEl.appendChild(empty);
    }

    for (var d = 1; d <= daysInMonth; d++) {
      var dateStr = year + '-' + String(m+1).padStart(2,'0') + '-' + String(d).padStart(2,'0');
      var count   = history[dateStr] || 0;
      var level   = getHeatLevel(count);
      var dow     = (new Date(year, m, d).getDay() + 6) % 7;
      var isWE    = dow >= 5;
      var isToday = (year === todayYear && m === todayMonth && d === todayDate);

      var cell = document.createElement('div');
      cell.className = 'day-cell'
        + (count   ? ' day-has-work' : '')
        + (isWE    ? ' day-weekend'  : '')
        + (isToday ? ' day-today'    : '');
      if (level > 0) cell.style.background = getHeatColor(level);

      var num = document.createElement('span');
      num.className = 'day-num';
      num.textContent = d;
      cell.appendChild(num);

      var tf2 = LANGS[currentLang].tomato_plural || LANGS['en'].tomato_plural;
      cell.title = count
        ? d + ' ' + MONTHS_GEN()[m] + ': ' + count + ' ' + tf2(count)
        : d + ' ' + MONTHS_GEN()[m];
      daysEl.appendChild(cell);
    }
    grid.appendChild(daysEl);

    var schemeColors = getSchemeColors();
    var lo2  = document.getElementById('leg-lo');
    var mid2 = document.getElementById('leg-mid');
    var hi2  = document.getElementById('leg-hi');
    if (lo2)  { lo2.style.background  = schemeColors[1]; lo2.style.border  = 'none'; }
    if (mid2) { mid2.style.background = schemeColors[3]; mid2.style.border = 'none'; }
    if (hi2)  { hi2.style.background  = schemeColors[5]; hi2.style.border  = 'none'; }

    renderAnalytics(history);
  });
}

function plural(n) {
  if (n % 10 === 1 && n % 100 !== 11) return '';
  if ([2,3,4].indexOf(n % 10) >= 0 && [12,13,14].indexOf(n % 100) < 0) return 'а';
  return 'ов';
}

function calcStreak(history) {
  var streak = 0;
  var today = new Date();
  for (var i = 0; i < 365; i++) {
    var d = new Date(today);
    d.setDate(d.getDate() - i);
    if (history[d.toISOString().split('T')[0]] > 0) streak++;
    else break;
  }
  return streak;
}

// SETTINGS

// Duration sliders live preview
document.getElementById('work-slider').addEventListener('input', function() {
  document.getElementById('work-val').textContent = this.value + ' ' + t('cycle_min');
});
document.getElementById('break-slider').addEventListener('input', function() {
  document.getElementById('break-val').textContent = this.value + ' ' + t('cycle_min');
});
document.getElementById('btn-save-durations').addEventListener('click', saveDurations);

function loadSettings() {
  chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, function(r) {
    var wm = r.workMinutes  || 25;
    var bm = r.breakMinutes || 5;
    var ws = document.getElementById('work-slider');
    var bs = document.getElementById('break-slider');
    if (ws) { ws.value = wm; document.getElementById('work-val').textContent = wm + ' ' + t('cycle_min'); }
    if (bs) { bs.value = bm; document.getElementById('break-val').textContent = bm + ' ' + t('cycle_min'); }
  });
}

function saveDurations() {
  var wm = parseInt(document.getElementById('work-slider').value,  10);
  var bm = parseInt(document.getElementById('break-slider').value, 10);
  WORK_DURATION  = wm * 60;
  BREAK_DURATION = bm * 60;
  chrome.runtime.sendMessage({ type: 'SAVE_DURATIONS', workMinutes: wm, breakMinutes: bm }, function() {
    // Update timer display if idle
    updateTimerUI();
    // Visual feedback
    var btn = document.getElementById('btn-save-durations');
    if (btn) {
      btn.textContent = '✓';
      btn.classList.add('saved');
      setTimeout(function() {
        btn.textContent = t('btn_apply');
        btn.classList.remove('saved');
      }, 2000);
    }
  });
}

function setSaveBtnState(id, state, text) {
  var btn = document.getElementById(id);
  if (!btn) return;
  btn.classList.remove('saved','saving');
  if (state) btn.classList.add(state);
  btn.textContent = text;
}

document.getElementById('btn-export-file').addEventListener('click', exportDataWithFeedback);
document.getElementById('btn-import-file2').addEventListener('click', function() { document.getElementById('import-file2').click(); });
// import-file still used by importData listener below
document.getElementById('import-file').addEventListener('change', importData);
document.getElementById('import-file2').addEventListener('change', importData);

async function saveJsonFile(history, btnId, statusId) {
  var filename = 'pomodoro-' + new Date().toISOString().split('T')[0] + '.json';
  var content  = JSON.stringify(history, null, 2);

  // Try File System Access API (lets user pick folder)
  if (window.showSaveFilePicker) {
    try {
      var fh = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }]
      });
      var writable = await fh.createWritable();
      await writable.write(content);
      await writable.close();
      if (btnId)    setSaveBtnState(btnId, 'saved', '✓ Файл сохранён');
      if (statusId) setFileStatus(statusId, 'Файл сохранён: ' + fh.name, 'ok');
      return;
    } catch(e) {
      // User cancelled — do nothing
      if (e.name === 'AbortError') {
        if (btnId) setSaveBtnState(btnId, null, btnId === 'btn-export-file' ? '↑ Сохранить файл' : '↑ экспорт JSON');
        return;
      }
    }
  }

  // Fallback: regular download (no folder choice)
  var blob = new Blob([content], { type: 'application/json' });
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
  if (btnId)    setSaveBtnState(btnId, 'saved', '✓ Файл сохранён');
  if (statusId) setFileStatus(statusId, 'Файл скачан в папку загрузок', 'ok');
}

function exportData() {
  chrome.runtime.sendMessage({ type: 'GET_HISTORY' }, function(r) {
    saveJsonFile(r.history, null, null);
  });
}

function setFileStatus(statusId, text, type) {
  var s = document.getElementById(statusId);
  if (!s) return;
  s.textContent = text;
  s.className   = 'status-msg ' + type;
  clearTimeout(setFileStatus._t);
  setFileStatus._t = setTimeout(function() {
    s.className   = 'status-msg';
    s.textContent = '';
  }, 3000);
}

function exportDataWithFeedback() {
  setSaveBtnState('btn-export-file', 'saving', '⏳ Сохраняю...');
  chrome.runtime.sendMessage({ type: 'GET_HISTORY' }, function(r) {
    saveJsonFile(r.history, 'btn-export-file', 'file-status');
  });
}

function importData(event) {
  var file = event.target.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var data = JSON.parse(e.target.result);
      // Rebuild timestamps from imported history counts.
      // Approximation: spread pomodoros at 25-min intervals starting 09:00 each day.
      var newTs = [];
      Object.keys(data).forEach(function(dateStr) {
        var count = parseInt(data[dateStr], 10) || 0;
        var base  = new Date(dateStr + 'T09:00:00').getTime();
        for (var i = 0; i < count; i++) {
          newTs.push(base + i * 25 * 60 * 1000);
        }
      });
      chrome.storage.local.set({ history: data, timestamps: newTs }, function() {
        renderHistory();
        updateTimerStats();
        setFileStatus('file-status', '✓ История загружена', 'ok');
      });
    } catch(err) { alert('Ошибка при чтении файла'); }
  };
  reader.readAsText(file);
}

// TEST HELPERS
function addTestCycles(n) {
  chrome.storage.local.get(['history'], function(r) {
    var h   = r.history || {};
    var key = new Date().toISOString().split('T')[0];
    h[key]  = (h[key] || 0) + n;
    chrome.storage.local.set({ history: h }, function() {
      updateTimerStats();
      if (document.getElementById('panel-history').classList.contains('active')) renderHistory();
    });
  });
}

function fillTestHistory() {
  chrome.storage.local.get(['history', 'timestamps'], function(r) {
    var h   = r.history    || {};
    var ts  = r.timestamps || [];
    var now = new Date();

    // Realistic hour distributions: morning peak 9-11, afternoon 14-17, evening 20-22
    var hourWeights = [0,0,0,0,0,0,1,2,4,8,9,7,4,3,6,8,7,5,3,2,4,5,3,1];
    var totalW = hourWeights.reduce(function(a,b){return a+b;},0);

    function pickHour() {
      var rr = Math.random() * totalW, acc = 0;
      for (var i = 0; i < 24; i++) { acc += hourWeights[i]; if (rr < acc) return i; }
      return 10;
    }

    for (var ago = 1; ago <= 120; ago++) {
      var d  = new Date(now); d.setDate(d.getDate() - ago);
      var dw = d.getDay();
      var we = dw === 0 || dw === 6;
      if (Math.random() > (we ? 0.25 : 0.70)) continue;
      var rv = Math.random();
      var c  = rv < 0.15 ? 1 : rv < 0.35 ? 2 + Math.floor(Math.random()*2)
                            : rv < 0.70 ? 4 + Math.floor(Math.random()*3)
                            : rv < 0.90 ? 7 + Math.floor(Math.random()*2)
                            :             9 + Math.floor(Math.random()*3);
      var key = d.toISOString().split('T')[0];
      if (!h[key]) {
        h[key] = c;
        // Generate c timestamps spread across realistic hours
        for (var ci = 0; ci < c; ci++) {
          var hr  = pickHour();
          var min = Math.floor(Math.random() * 60);
          var tsd = new Date(d);
          tsd.setHours(hr, min, 0, 0);
          ts.push(tsd.getTime());
        }
      }
    }
    chrome.storage.local.set({ history: h, timestamps: ts }, function() {
      updateTimerStats();
      if (document.getElementById('panel-history').classList.contains('active')) renderHistory();
    });
  });
}

function clearTestCycles() {
  chrome.storage.local.set({ history: {}, timestamps: [] }, function() {
    updateTimerStats();
    if (document.getElementById('panel-history').classList.contains('active')) renderHistory();
  });
}

// ─── ANALYTICS ────────────────────────────────────────────────────────────────
function renderAnalytics(historyFallback) {
  chrome.runtime.sendMessage({ type: 'GET_TIMESTAMPS' }, function(r) {
    var timestamps = r.timestamps || [];
    var wdCounts   = [0,0,0,0,0,0,0]; // total cycles per weekday Mon=0…Sun=6
    var wdDays     = [0,0,0,0,0,0,0]; // number of unique days per weekday
    var WD_FULL    = LANGS[currentLang].wd_full || LANGS['en'].wd_full;
    var WD_SHORT   = LANGS[currentLang].wd_short || LANGS['en'].wd_short;

    // Last 365 days
    var cutoff  = Date.now() - 365 * 24 * 60 * 60 * 1000;
    var seenDays = {}; // track unique dates per weekday

    if (timestamps.length > 0) {
      timestamps.forEach(function(ms) {
        if (ms < cutoff) return;
        var d   = new Date(ms);
        var dow = (d.getDay() + 6) % 7;
        wdCounts[dow]++;
        var dateKey = d.toISOString().split('T')[0];
        if (!seenDays[dow]) seenDays[dow] = {};
        seenDays[dow][dateKey] = true;
      });
    } else if (historyFallback) {
      // Fallback: compute weekday data from history dates (no timestamps available)
      Object.keys(historyFallback).forEach(function(dateKey) {
        var ms = new Date(dateKey + 'T12:00:00').getTime();
        if (ms < cutoff) return;
        var count = historyFallback[dateKey] || 0;
        if (count <= 0) return;
        var d   = new Date(dateKey + 'T12:00:00');
        var dow = (d.getDay() + 6) % 7;
        wdCounts[dow] += count;
        if (!seenDays[dow]) seenDays[dow] = {};
        seenDays[dow][dateKey] = true;
      });
    }

    // Count unique days per weekday
    for (var i = 0; i < 7; i++) {
      wdDays[i] = seenDays[i] ? Object.keys(seenDays[i]).length : 0;
    }

    // Compute averages (cycles / unique working days of that weekday)
    var wdAvg = wdCounts.map(function(total, i) {
      return wdDays[i] > 0 ? Math.round(total / wdDays[i] * 10) / 10 : 0;
    });

    var totalTs = wdCounts.reduce(function(a,b){return a+b;},0);
    var blk = document.getElementById('analytics-block');
    if (!blk) return;
    var showAnalytics = totalTs > 0;
    blk.style.display = showAnalytics ? 'block' : 'none';
    var ph = document.getElementById('panel-history');
    if (ph) ph.classList.toggle('has-analytics', showAnalytics);
    if (totalTs === 0) return;

    var maxAvg = Math.max.apply(null, wdAvg);
    var barsEl = document.getElementById('wd-bars');
    if (!barsEl) return;
    barsEl.innerHTML = '';
    var schClrs = getSchemeColors(); // [0]=empty, [1]=lightest … [5]=darkest
    // Available height for bars: container minus fixed val label + day label + gaps (~32px)
    var BAR_MAX_H = Math.max(20, barsEl.offsetHeight - 32);

    wdAvg.forEach(function(avg, i) {
      var wrap = document.createElement('div');
      wrap.className = 'wd-bar-wrap';

      var valEl = document.createElement('div');
      valEl.className = 'wd-bar-val';
      valEl.textContent = avg > 0 ? avg.toFixed(1) : '';

      var bar = document.createElement('div');
      bar.className = 'wd-bar';
      var pct = maxAvg > 0 ? avg / maxAvg : 0;
      bar.style.height = avg === 0 ? '3px' : Math.max(3, Math.round(pct * BAR_MAX_H)) + 'px';
      // Color from scheme: map pct 0..1 to levels 1..5
      if (avg === 0) {
        bar.style.background = 'var(--surface2)';
      } else {
        var lvl = Math.max(1, Math.min(5, Math.round(pct * 4) + 1));
        bar.style.background = schClrs[lvl];
      }
      var tf = LANGS[currentLang].tomato_plural || LANGS['en'].tomato_plural;
      bar.title = WD_FULL[i] + ': ' + t('avg_label') + ' ' + avg.toFixed(1) + ' ' + tf(Math.round(avg));

      var lbl = document.createElement('div');
      lbl.className = 'wd-bar-label';
      lbl.textContent = WD_SHORT[i];

      wrap.appendChild(valEl);
      wrap.appendChild(bar);
      wrap.appendChild(lbl);
      barsEl.appendChild(wrap);
    });
  });
}
