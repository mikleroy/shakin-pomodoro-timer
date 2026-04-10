'use strict';

function soundTone(ctx, type, freq, t0, duration, vol) {
  var osc  = ctx.createOscillator();
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
    var t   = ctx.currentTime;
    var osc  = ctx.createOscillator();
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

function playBeep(isWork, preset, volume) {
  var ctx = new AudioContext();
  var fn  = SOUND_PRESETS[preset] || SOUND_PRESETS.classic;
  ctx.resume().then(function() {
    fn(ctx, isWork, volume / 100);
    setTimeout(function() {
      ctx.close();
      try { chrome.offscreen.closeDocument(); } catch(e) {}
    }, 2000);
  }).catch(function() {
    ctx.close();
    try { chrome.offscreen.closeDocument(); } catch(e) {}
  });
}

// On load: read params from URL (passed by background.js)
(function() {
  var p = new URLSearchParams(location.search);
  if (p.has('work')) {
    playBeep(
      p.get('work') === '1',
      p.get('preset') || 'classic',
      p.get('volume') != null ? parseInt(p.get('volume'), 10) : 100
    );
  }
})();

// Handle direct messages when offscreen document was already open
chrome.runtime.onMessage.addListener(function(msg) {
  if (msg.type === 'PLAY_SOUND') {
    playBeep(
      msg.work,
      msg.preset || 'classic',
      msg.volume != null ? msg.volume : 100
    );
  }
});
