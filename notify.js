'use strict';

var params = new URLSearchParams(window.location.search);
var type   = params.get('type') || 'work';

var STRINGS = {
  en: {
    work_title: 'Pomodoro done!',
    work_msg:   "Great work! What's next?",
    work_btn1:  '☕ Rest',
    work_btn2:  '▶ One more',
    break_title: 'Break over!',
    break_msg:   'Ready for the next cycle?',
    break_btn1:  '▶ Start cycle',
    break_btn2:  '☕ Rest',
  },
  ru: {
    work_title: 'Помидор завершён!',
    work_msg:   'Отличная работа! Что дальше?',
    work_btn1:  '☕ Отдохнуть',
    work_btn2:  '▶ Ещё цикл',
    break_title: 'Перерыв окончен!',
    break_msg:   'Готов к следующему циклу?',
    break_btn1:  '▶ Начать цикл',
    break_btn2:  '☕ Отдохнуть',
  }
};

function applyStrings(lang) {
  var s = STRINGS[lang] || STRINGS.en;
  var pfx = type === 'work' ? 'work' : 'break';
  document.getElementById('icon').textContent  = type === 'work' ? '🍅' : '⏰';
  document.getElementById('title').textContent = s[pfx + '_title'];
  document.getElementById('msg').textContent   = s[pfx + '_msg'];
  document.getElementById('btn1').textContent  = s[pfx + '_btn1'];
  document.getElementById('btn2').textContent  = s[pfx + '_btn2'];
}

chrome.storage.local.get(['appLang'], function(r) {
  var lang = r.appLang || (navigator.language.startsWith('ru') ? 'ru' : 'en');
  applyStrings(lang);
});

function closeMe() { window.close(); }
function sendCmd(action) { chrome.storage.local.set({ pendingCmd: action }, closeMe); }

document.getElementById('btn-close').addEventListener('click', closeMe);
document.getElementById('btn1').addEventListener('click', function() {
  sendCmd(type === 'work' ? 'START_BREAK' : 'START');
});
document.getElementById('btn2').addEventListener('click', function() {
  sendCmd('START_BREAK');
});
