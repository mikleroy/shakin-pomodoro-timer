// background.js — service worker

const DEFAULT_WORK  = 25 * 60;
const DEFAULT_BREAK = 5  * 60;

let _cachedDurations = null;

async function getDurations() {
  if (_cachedDurations) return _cachedDurations;
  const d = await chrome.storage.local.get(['workMinutes', 'breakMinutes']);
  _cachedDurations = {
    work:  (d.workMinutes  || 25) * 60,
    break: (d.breakMinutes || 5)  * 60
  };
  return _cachedDurations;
}

// State stored in chrome.storage.session for cross-popup persistence
async function getState() {
  const dur  = await getDurations();
  const data = await chrome.storage.session.get(['timerState']);
  return data.timerState || {
    phase: 'idle',
    remaining: dur.work,
    startedAt: null,
    pausedAt: null,
    paused: false
  };
}

async function setState(state) {
  await chrome.storage.session.set({ timerState: state });
  await updateIcon(state);
}

// ─── DYNAMIC ICON WITH TIMER ──────────────────────────────────────────────────
// Renders a tomato icon + countdown arc + MM:SS text directly onto the toolbar icon
async function updateIcon(state, overrideRemaining) {
  const SIZE = 32;
  try {
    const canvas = new OffscreenCanvas(SIZE, SIZE);
    const ctx = canvas.getContext('2d');
    const cx = SIZE / 2, cy = SIZE / 2;

    if (state.phase === 'idle') {
      drawTomato(ctx, SIZE);
      chrome.action.setBadgeText({ text: '' });
      chrome.action.setTitle({ title: '🍅 Pomodoro Timer — нажми чтобы начать' });
    } else {
      // Use overrideRemaining if provided (from popup, most accurate),
      // otherwise calculate from startedAt
      const remaining = (overrideRemaining !== undefined)
        ? overrideRemaining
        : getRemainingSeconds(state);
      const dur   = await getDurations();
      const total = state.phase === 'work' ? dur.work : dur.break;
      const fraction = remaining / total;

      // Dark semi-transparent background circle
      ctx.clearRect(0, 0, SIZE, SIZE);
      ctx.beginPath();
      ctx.arc(cx, cy, SIZE/2, 0, Math.PI*2);
      ctx.fillStyle = state.phase === 'work' ? '#1a0a08' : '#081a0e';
      ctx.fill();

      // Progress arc (full circle track)
      const trackColor = state.phase === 'work' ? 'rgba(200,60,40,0.25)' : 'rgba(40,160,80,0.25)';
      ctx.beginPath();
      ctx.arc(cx, cy, SIZE/2 - 2, 0, Math.PI*2);
      ctx.strokeStyle = trackColor;
      ctx.lineWidth = 3;
      ctx.stroke();

      // Draw elapsed time arc (grows clockwise from 12 o'clock as timer runs)
      const arcColor = state.phase === 'work' ? '#e8472a' : '#34c868';
      const elapsed_fraction = 1 - fraction;
      const startAngle = -Math.PI / 2;
      const endAngle = startAngle + (Math.PI * 2 * elapsed_fraction);
      ctx.beginPath();
      ctx.arc(cx, cy, SIZE/2 - 2, startAngle, endAngle, false);
      ctx.strokeStyle = arcColor;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.stroke();

      // Small tomato in center (scaled down)
      ctx.save();
      const tSize = SIZE * 0.58;
      const tOff = (SIZE - tSize) / 2;
      ctx.translate(tOff, tOff);
      ctx.scale(tSize / SIZE, tSize / SIZE);
      drawTomato(ctx, SIZE);
      ctx.restore();

      // Timer text overlay: show MM:SS for work, M:SS for break
      const mins = Math.floor(remaining / 60);
      const secs = remaining % 60;
      const label = state.phase === 'work'
        ? `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`
        : `${mins}:${String(secs).padStart(2,'0')}`;

      // Badge for quick glance — minutes only (floor to match popup)
      const badgeMins = Math.floor(remaining / 60);
      chrome.action.setBadgeText({ text: badgeMins === 0 ? String(remaining) + 's' : String(badgeMins) });
      chrome.action.setBadgeBackgroundColor({
        color: state.phase === 'work' ? '#c05010' : '#27ae60'
      });

      // Tooltip on hover
      const phaseWord = state.phase === 'work' ? 'Работа' : 'Перерыв';
      const pausedStr = state.paused ? ' (пауза)' : '';
      chrome.action.setTitle({ title: `🍅 ${phaseWord}${pausedStr} — осталось ${label}` });

      // Paused indicator: dim overlay
      if (state.paused) {
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.beginPath();
        ctx.arc(cx, cy, SIZE/2, 0, Math.PI*2);
        ctx.fill();
        // Pause bars
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        const bw = SIZE * 0.1, bh = SIZE * 0.32;
        ctx.fillRect(cx - bw*1.6, cy - bh/2, bw, bh);
        ctx.fillRect(cx + bw*0.6, cy - bh/2, bw, bh);
      }
    }

    const imageData = ctx.getImageData(0, 0, SIZE, SIZE);
    chrome.action.setIcon({ imageData });

  } catch (e) {
    // Fallback to badge-only if OffscreenCanvas fails
    if (state.phase === 'idle') {
      chrome.action.setBadgeText({ text: '' });
    } else {
      const remaining = (overrideRemaining !== undefined) ? overrideRemaining : getRemainingSeconds(state);
      const mins = Math.floor(remaining / 60);
      chrome.action.setBadgeText({ text: mins === 0 ? String(remaining) + 's' : String(mins) });
      chrome.action.setBadgeBackgroundColor({
        color: state.phase === 'work' ? '#c0392b' : '#27ae60'
      });
    }
  }
}

// Draw a tomato onto ctx at given size (pixel art style, clean for small sizes)
function drawTomato(ctx, s) {
  const cx = s / 2, cy = s / 2;
  const r = s * 0.42;

  // Body gradient
  const grad = ctx.createRadialGradient(cx - r*0.3, cy - r*0.3, r*0.05, cx, cy, r);
  grad.addColorStop(0, '#ff7055');
  grad.addColorStop(0.4, '#e03020');
  grad.addColorStop(1, '#8a1810');
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI*2);
  ctx.fillStyle = grad;
  ctx.fill();

  // Subtle specular
  const spec = ctx.createRadialGradient(cx - r*0.3, cy - r*0.35, 0, cx - r*0.3, cy - r*0.35, r*0.4);
  spec.addColorStop(0, 'rgba(255,255,255,0.35)');
  spec.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI*2);
  ctx.fillStyle = spec;
  ctx.fill();

  // Stem
  const sw = Math.max(1.5, s * 0.055);
  const sh = s * 0.18;
  ctx.fillStyle = '#2d8a2d';
  ctx.beginPath();
  ctx.roundRect(cx - sw/2, cy - r - sh*0.55, sw, sh, sw/2);
  ctx.fill();

  // Leaf
  ctx.fillStyle = '#38b038';
  ctx.beginPath();
  ctx.ellipse(cx + r*0.22, cy - r*0.82, r*0.22, r*0.1, -0.4, 0, Math.PI*2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx - r*0.18, cy - r*0.86, r*0.16, r*0.08, 0.4, 0, Math.PI*2);
  ctx.fill();
}

function getRemainingSeconds(state) {
  if (state.paused || state.phase === 'idle') return state.remaining;
  const elapsed = Math.floor((Date.now() - state.startedAt) / 1000);
  return Math.max(0, state.remaining - elapsed);
}

// Timestamp of last icon update triggered by the popup (via UPDATE_ICON message).
// Used to prevent the alarm from overwriting the popup's fresher value.
let lastPopupIconUpdate = 0;

// Alarm fires every minute — used for cycle-end detection and icon refresh when popup is closed.
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'tick') return;

  const state = await getState();
  if (state.phase === 'idle' || state.paused) return;

  const remaining = getRemainingSeconds(state);

  if (remaining <= 0) {
    await handleCycleEnd(state);
  } else {
    // Only update icon from alarm when popup is not actively doing so.
    // If popup sent UPDATE_ICON within the last 1.5 s, it will handle the icon itself —
    // writing from the alarm here would race against the popup's more accurate value.
    if (Date.now() - lastPopupIconUpdate > 1500) {
      await updateIcon(state, remaining);
    }
  }
});

async function handleCycleEnd(state) {
  const dur = await getDurations();
  const { autoResume } = await chrome.storage.local.get('autoResume');

  if (state.phase === 'work') {
    await recordPomodoro();

    if (autoResume) {
      // Auto-start break immediately, skip notification overlay
      await setState({ phase:'break', remaining:dur.break, startedAt:Date.now(), pausedAt:null, paused:false });
      chrome.alarms.create('tick', { periodInMinutes: 1 });
      chrome.action.setBadgeText({ text: '' });
      chrome.runtime.sendMessage({ type: 'CYCLE_DONE', cycleType: 'work', autoResumed: true }, function() { void chrome.runtime.lastError; });
      return;
    }

    await setState({ phase:'idle', remaining:dur.work, startedAt:null, pausedAt:null, paused:false });
    chrome.alarms.clear('tick');

    // Alert badge — persists until popup is opened
    chrome.action.setBadgeText({ text: '!' });
    chrome.action.setBadgeBackgroundColor({ color: '#c05010' });

    // Save pending notification so popup can show overlay even if it was closed
    await chrome.storage.local.set({ pendingNotify: 'work' });
    // Notify popup overlay if open; if popup is closed — play sound via offscreen
    chrome.runtime.sendMessage({ type: 'CYCLE_DONE', cycleType: 'work' }, function() {
      if (chrome.runtime.lastError) playSound(true);
    });

    // System notification — always visible, works when popup is closed
    chrome.notifications.create('cycle-work-done', {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/icon128.png'),
      title: '🍅 Pomodoro done!',
      message: "Great work! Time for a break.",
      buttons: [{ title: '☕ Rest' }, { title: '▶ One more' }],
      requireInteraction: true,
      priority: 2
    });

  } else {
    if (autoResume) {
      // Auto-start work immediately, skip notification overlay
      await setState({ phase:'work', remaining:dur.work, startedAt:Date.now(), pausedAt:null, paused:false });
      chrome.alarms.create('tick', { periodInMinutes: 1 });
      chrome.action.setBadgeText({ text: '' });
      chrome.runtime.sendMessage({ type: 'CYCLE_DONE', cycleType: 'break', autoResumed: true }, function() { void chrome.runtime.lastError; });
      return;
    }

    await setState({ phase:'idle', remaining:dur.work, startedAt:null, pausedAt:null, paused:false });
    chrome.alarms.clear('tick');

    // Alert badge
    chrome.action.setBadgeText({ text: '!' });
    chrome.action.setBadgeBackgroundColor({ color: '#27ae60' });

    await chrome.storage.local.set({ pendingNotify: 'break' });
    chrome.runtime.sendMessage({ type: 'CYCLE_DONE', cycleType: 'break' }, function() {
      if (chrome.runtime.lastError) playSound(false);
    });

    chrome.notifications.create('cycle-break-done', {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/icon128.png'),
      title: '⏰ Break over!',
      message: 'Ready for the next cycle?',
      buttons: [{ title: '▶ Start cycle' }, { title: '☕ Rest more' }],
      requireInteraction: true,
      priority: 2
    });
  }
}

async function playSound(isWork) {
  try {
    const s = await chrome.storage.local.get(['soundEnabled', 'soundPreset', 'soundVolume']);
    if (s.soundEnabled === false) return;
    const preset = s.soundPreset  || 'classic';
    const volume = s.soundVolume  != null ? s.soundVolume : 100;
    const exists = await chrome.offscreen.hasDocument();
    if (exists) {
      chrome.runtime.sendMessage({ type: 'PLAY_SOUND', work: isWork, preset, volume }, function() { void chrome.runtime.lastError; });
    } else {
      const params = new URLSearchParams({ work: isWork ? '1' : '0', preset, volume });
      await chrome.offscreen.createDocument({
        url: chrome.runtime.getURL('offscreen.html') + '?' + params.toString(),
        reasons: ['AUDIO_PLAYBACK'],
        justification: 'Play cycle completion sound'
      });
    }
  } catch (e) {
    // Sound is non-critical — ignore errors
  }
}

// Handle notification button clicks
chrome.notifications.onButtonClicked.addListener(async function(notifId, btnIdx) {
  const dur = await getDurations();
  chrome.notifications.clear(notifId);
  chrome.storage.local.remove('pendingNotify');
  chrome.action.setBadgeText({ text: '' });

  if (notifId === 'cycle-work-done') {
    if (btnIdx === 0) {
      // Rest — start break
      await setState({ phase:'break', remaining:dur.break, startedAt:Date.now(), pausedAt:null, paused:false });
      chrome.alarms.create('tick', { periodInMinutes: 1 });
    } else {
      // One more — start work
      await setState({ phase:'work', remaining:dur.work, startedAt:Date.now(), pausedAt:null, paused:false });
      chrome.alarms.create('tick', { periodInMinutes: 1 });
    }
  }

  if (notifId === 'cycle-break-done') {
    if (btnIdx === 0) {
      // Start cycle
      await setState({ phase:'work', remaining:dur.work, startedAt:Date.now(), pausedAt:null, paused:false });
      chrome.alarms.create('tick', { periodInMinutes: 1 });
    } else {
      // Rest more — another break
      await setState({ phase:'break', remaining:dur.break, startedAt:Date.now(), pausedAt:null, paused:false });
      chrome.alarms.create('tick', { periodInMinutes: 1 });
    }
  }
});

// Close notification if popup opened (user saw overlay)
chrome.notifications.onClicked.addListener(function(notifId) {
  chrome.notifications.clear(notifId);
});

async function recordPomodoro() {
  const now   = new Date();
  const today = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const ts    = now.getTime(); // unix ms

  const data    = await chrome.storage.local.get(['history', 'timestamps']);
  const history = data.history    || {};
  const stamps  = data.timestamps || [];

  history[today] = (history[today] || 0) + 1;
  stamps.push(ts);
  if (stamps.length > 2000) stamps.splice(0, stamps.length - 2000);

  await chrome.storage.local.set({ history, timestamps: stamps });
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    if (msg.type === 'GET_STATE') {
      const state = await getState();
      sendResponse(state);
    }

    if (msg.type === 'START') {
      const state = await getState();
      if (state.phase === 'idle') {
        const dur = await getDurations();
        const newState = {
          phase: 'work',
          remaining: dur.work,
          startedAt: Date.now(),
          pausedAt: null,
          paused: false
        };
        await setState(newState);
        chrome.alarms.create('tick', { periodInMinutes: 1 });
        sendResponse({ ok: true });
      } else {
        sendResponse({ ok: false });
      }
    }

    if (msg.type === 'START_BREAK') {
      const dur = await getDurations();
      const newState = {
        phase: 'break',
        remaining: dur.break,
        startedAt: Date.now(),
        pausedAt: null,
        paused: false
      };
      await setState(newState);
      chrome.alarms.create('tick', { periodInMinutes: 1 });
      sendResponse({ ok: true });
    }

    if (msg.type === 'PAUSE') {
      const state = await getState();
      if (!state.paused && state.phase !== 'idle') {
        // Use remaining from popup if provided (most accurate, avoids async race)
        const remaining = (msg.remaining !== undefined) ? msg.remaining : getRemainingSeconds(state);
        const newState = { ...state, paused: true, remaining, pausedAt: Date.now() };
        await setState(newState);
        sendResponse({ ok: true });
      } else {
        sendResponse({ ok: false });
      }
    }

    if (msg.type === 'RESUME') {
      const state = await getState();
      if (state.paused) {
        const newState = {
          ...state,
          paused: false,
          startedAt: Date.now(),
          pausedAt: null
        };
        await setState(newState);
        sendResponse({ ok: true });
      } else {
        sendResponse({ ok: false });
      }
    }

    if (msg.type === 'RESET') {
      chrome.alarms.clear('tick');
      const dur = await getDurations();
      const newState = {
        phase: 'idle',
        remaining: dur.work,
        startedAt: null,
        pausedAt: null,
        paused: false
      };
      await setState(newState);
      sendResponse({ ok: true });
    }

    if (msg.type === 'GET_HISTORY') {
      const data = await chrome.storage.local.get(['history']);
      sendResponse({ history: data.history || {} });
    }

    if (msg.type === 'GET_TIMESTAMPS') {
      const data = await chrome.storage.local.get(['timestamps']);
      sendResponse({ timestamps: data.timestamps || [] });
    }

    if (msg.type === 'UPDATE_ICON') {
      lastPopupIconUpdate = Date.now();
      const state = await getState();
      if (state.phase !== 'idle') {
        await updateIcon(state, msg.remaining);
      }
      sendResponse({ ok: true });
    }

    if (msg.type === 'FORCE_CYCLE_END') {
      const state = await getState();
      // Only act if timer is actually running and at zero
      if (state.phase !== 'idle' && !state.paused) {
        const remaining = getRemainingSeconds(state);
        if (remaining <= 0) {
          await handleCycleEnd(state);
        }
      }
      sendResponse({ ok: true });
    }

    if (msg.type === 'GET_SETTINGS') {
      const data = await chrome.storage.local.get(['workMinutes', 'breakMinutes']);
      sendResponse({
        workMinutes:  data.workMinutes  || 25,
        breakMinutes: data.breakMinutes || 5
      });
    }

    if (msg.type === 'SAVE_DURATIONS') {
      await chrome.storage.local.set({
        workMinutes:  msg.workMinutes,
        breakMinutes: msg.breakMinutes
      });
      _cachedDurations = null; // invalidate cache
      // If timer is idle, update its remaining to reflect new work duration
      const state = await getState();
      if (state.phase === 'idle') {
        const newState = { ...state, remaining: msg.workMinutes * 60 };
        await setState(newState);
      }
      sendResponse({ ok: true });
    }
  })().catch(() => { try { sendResponse({ ok: false }); } catch(e) {} });
  return true; // async response
});


// Clear stale notification state on browser/extension startup
chrome.runtime.onStartup.addListener(function() {
  chrome.storage.local.remove(['pendingNotify', 'pendingCmd']);
  chrome.action.setBadgeText({ text: '' });
});

// Listen for commands from notify window via storage
chrome.storage.onChanged.addListener(async function(changes, area) {
  if (area !== 'local' || !changes.pendingCmd) return;
  const cmd = changes.pendingCmd.newValue;
  if (!cmd) return;
  // Clear command immediately
  await chrome.storage.local.remove('pendingCmd');
  const dur = await getDurations();
  if (cmd === 'START') {
    await setState({ phase:'work', remaining:dur.work, startedAt:Date.now(), pausedAt:null, paused:false });
    chrome.alarms.create('tick', { periodInMinutes: 1 });
  } else if (cmd === 'START_BREAK') {
    await setState({ phase:'break', remaining:dur.break, startedAt:Date.now(), pausedAt:null, paused:false });
    chrome.alarms.create('tick', { periodInMinutes: 1 });
  }
});
