// Heat & Humidity Pace Adjustment Calculator
//
// Methodology:
//   Dew point scale:  Matt Fitzgerald's widely-used guide for runners
//                     (popularized in "80/20 Running" and by elite running coaches).
//                     Dew point is the best single predictor of how much heat/humidity
//                     impairs evaporative cooling, which governs heat stress in runners.
//   Temperature add-on: Based on Jack Daniels' research (Daniels' Running Formula)
//                       showing additional performance degradation above 55°F beyond
//                       what humidity alone explains.
//   Intensity modifiers: Physiological principle — at easy effort the cardiovascular
//                        system has reserve capacity, so heat competes less with muscle
//                        perfusion. At threshold/race effort it competes maximally.

(function () {

  // ── Algorithm ─────────────────────────────────────────────────────────────────

  // Dew point pace adjustment (%, Fitzgerald dew point scale)
  function dewPointPct(dp) {
    if (dp < 50) return 0;
    if (dp < 55) return 0.5;
    if (dp < 60) return 2;
    if (dp < 65) return 4;
    if (dp < 70) return 7;
    if (dp < 75) return 10;
    return 14;
  }

  // Temperature additional adjustment (%, informed by Jack Daniels' research)
  function tempPct(t) {
    if (t < 55) return 0;
    if (t < 65) return 0.5;
    if (t < 70) return 1;
    if (t < 75) return 2;
    if (t < 80) return 3;
    if (t < 85) return 4;
    if (t < 90) return 5;
    return 6;
  }

  // Intensity multipliers reflect cardiovascular competition between
  // heat dissipation and muscle perfusion at different effort levels.
  const INTENSITY_MOD = { easy: 0.65, workout: 1.0, race: 1.3 };

  function calcAdjPct(temp, dp, intensity) {
    const base = dewPointPct(dp) + tempPct(temp);
    const mod  = INTENSITY_MOD[intensity] ?? 1.0;
    return Math.min(base * mod, 20);
  }

  function getCondition(temp, dp) {
    if (dp >= 75 || temp >= 95) return {
      label: 'Dangerous',
      cls:   'cond-danger',
      desc:  'Extreme heat stress — strongly consider moving indoors or postponing',
      tips:  [
        'Avoid running outside if possible',
        'If you must run: treadmill, or cut to a very short easy jog only',
        'Risk of heat stroke; know the signs (confusion, stopping sweating)',
      ],
    };
    if (dp >= 70 || temp >= 88) return {
      label: 'Very Hard',
      cls:   'cond-very-hard',
      desc:  'High heat stress; significant performance loss and risk of heat illness',
      tips:  [
        'Shorten workouts — cut planned miles by 25–30%',
        'Ditch pace targets; run by effort (heart rate or perceived exertion)',
        'Pre-cool with ice, cold water, or a cold shower before heading out',
        'Run early morning or after sunset when possible',
      ],
    };
    if (dp >= 65 || temp >= 82) return {
      label: 'Tough',
      cls:   'cond-tough',
      desc:  'Uncomfortable conditions; slow down and monitor yourself carefully',
      tips:  [
        'Use the adjusted pace as a hard ceiling — don\'t push through discomfort',
        'Carry or plan for fluids every 15–20 min',
        'Wear light, moisture-wicking clothing; avoid dark colors',
        'Consider cutting the workout short if you feel off',
      ],
    };
    if (dp >= 60 || temp >= 75) return {
      label: 'Moderate',
      cls:   'cond-moderate',
      desc:  'Noticeable humidity stress; slower paces and extra hydration recommended',
      tips:  [
        'Slow the first mile — let your body acclimate',
        'Hydrate before you leave; don\'t wait until thirsty',
        'Give yourself permission to run at the adjusted pace without guilt',
      ],
    };
    if (dp >= 50 || temp >= 65) return {
      label: 'Good',
      cls:   'cond-good',
      desc:  'Mild heat effect; stay hydrated and adjust effort',
      tips:  [
        'Slight pace adjustment is still warranted, especially for long runs',
        'Keep an eye on hydration — even mild heat adds up over distance',
      ],
    };
    return {
      label: 'Ideal',
      cls:   'cond-ideal',
      desc:  'Minimal heat stress — great running conditions',
      tips:  [
        'No significant pace adjustment needed',
        'Standard hydration and race preparation apply',
      ],
    };
  }

  // ── Formatters ────────────────────────────────────────────────────────────────

  // Auto-corrects a bare integer (e.g. "10") into mm:ss form ("10:00"),
  // so users don't have to type the trailing ":00" themselves.
  function autoFormatPace(input) {
    const v = input.value.trim();
    if (/^\d+$/.test(v)) input.value = `${parseInt(v, 10)}:00`;
  }

  function parseMMSS(str) {
    const parts = str.trim().split(':');
    if (parts.length !== 2) return null;
    const m = parseInt(parts[0], 10);
    const s = parseInt(parts[1], 10);
    if (isNaN(m) || isNaN(s) || m < 0 || s < 0 || s >= 60) return null;
    return m * 60 + s;
  }

  function fmtMMSS(secs) {
    const s = Math.round(secs);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  function fmtHMMSS(secs) {
    const s = Math.round(secs);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    return `${m}:${String(sec).padStart(2, '0')}`;
  }

  // ── RH → Dew Point conversion (Magnus formula) ───────────────────────────────

  function rhToDewPoint(tempF, rh) {
    const tc = (tempF - 32) * 5 / 9;
    const g  = (17.27 * tc / (237.7 + tc)) + Math.log(rh / 100);
    const dpC = (237.7 * g) / (17.27 - g);
    return dpC * 9 / 5 + 32;
  }

  // ── Humidity input mode ───────────────────────────────────────────────────────

  let humidityMode = 'dew'; // 'dew' | 'rh'

  function initHumidityToggle() {
    document.querySelectorAll('.heat-toggle-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        humidityMode = btn.dataset.mode;
        document.querySelectorAll('.heat-toggle-btn').forEach((b) =>
          b.classList.toggle('heat-toggle-active', b === btn));
        document.querySelector('.heat-humidity-header label').textContent =
          humidityMode === 'dew' ? 'Dew Point' : 'Humidity';
        document.getElementById('heat-dew-wrap').classList.toggle('hidden', humidityMode !== 'dew');
        document.getElementById('heat-rh-wrap').classList.toggle('hidden', humidityMode !== 'rh');
        document.getElementById('heat-invalid').classList.add('hidden');
        document.getElementById('heat-result').classList.add('hidden');
      });
    });
  }

  // ── Calculate & render ────────────────────────────────────────────────────────

  function calculate() {
    const milesStr  = document.getElementById('heat-miles').value.trim();
    const paceStr   = document.getElementById('heat-pace').value.trim();
    const tempStr   = document.getElementById('heat-temp').value.trim();
    const humidity  = humidityMode === 'dew'
      ? document.getElementById('heat-dew').value.trim()
      : document.getElementById('heat-rh').value.trim();
    const intensity = document.getElementById('heat-intensity').value;

    const result  = document.getElementById('heat-result');
    const invalid = document.getElementById('heat-invalid');

    if (!milesStr || !paceStr || !tempStr || !humidity || !intensity) {
      result.classList.add('hidden');
      invalid.classList.add('hidden');
      return;
    }

    const miles     = parseFloat(milesStr);
    const paceSecMi = parseMMSS(paceStr);
    const temp      = parseFloat(tempStr);
    const humVal    = parseFloat(humidity);

    if (!miles || miles <= 0 || !paceSecMi || isNaN(temp) || isNaN(humVal)) {
      result.classList.add('hidden');
      invalid.classList.add('hidden');
      return;
    }

    let dp;
    if (humidityMode === 'rh') {
      if (humVal < 0 || humVal > 100) {
        invalid.textContent = 'Humidity must be between 0 and 100%.';
        invalid.classList.remove('hidden');
        result.classList.add('hidden');
        return;
      }
      dp = rhToDewPoint(temp, humVal);
    } else {
      dp = humVal;
    }

    if (dp > temp) {
      invalid.textContent = 'Dew point cannot exceed air temperature.';
      invalid.classList.remove('hidden');
      result.classList.add('hidden');
      return;
    }
    invalid.classList.add('hidden');

    const adjPct      = calcAdjPct(temp, dp, intensity);
    const adjPaceSec  = paceSecMi * (1 + adjPct / 100);
    const goalTimeSec = paceSecMi * miles;
    const adjTimeSec  = adjPaceSec * miles;
    const condition   = getCondition(temp, dp);

    const badge = document.getElementById('heat-cond-badge');
    badge.textContent = condition.label;
    badge.className   = `heat-cond-badge ${condition.cls}`;
    document.getElementById('heat-cond-desc').textContent = condition.desc;

    document.getElementById('heat-adj-pct').textContent  = adjPct > 0 ? `+${adjPct.toFixed(1)}%` : '0%';
    document.getElementById('heat-adj-pace').textContent = fmtMMSS(adjPaceSec) + '/mi';
    document.getElementById('heat-adj-time').textContent = fmtHMMSS(adjTimeSec);

    document.getElementById('heat-goal-display').textContent =
      `${fmtMMSS(paceSecMi)}/mi  ·  ${fmtHMMSS(goalTimeSec)}`;
    document.getElementById('heat-adj-display').textContent =
      `${fmtMMSS(adjPaceSec)}/mi  ·  ${fmtHMMSS(adjTimeSec)}`;

    document.getElementById('heat-tips').innerHTML =
      condition.tips.map((t) => `<li>${t}</li>`).join('');

    const warning = document.getElementById('heat-warning');
    if (condition.cls === 'cond-danger' || condition.cls === 'cond-very-hard') {
      warning.textContent = condition.cls === 'cond-danger'
        ? 'Conditions are in the dangerous range. Serious risk of heat illness — strongly consider rescheduling or moving indoors.'
        : 'High heat stress. If you run, cut the workout short, slow down significantly, and watch for signs of heat exhaustion.';
      warning.classList.remove('hidden');
    } else {
      warning.classList.add('hidden');
    }

    result.classList.remove('hidden');
  }

  // ── Tab switching ─────────────────────────────────────────────────────────────

  function initTabs() {
    document.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        switchTab(btn.dataset.tab);
      });
    });
  }

  // ── Init ──────────────────────────────────────────────────────────────────────

  document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initHumidityToggle();
    ['heat-miles', 'heat-pace', 'heat-temp', 'heat-dew', 'heat-rh', 'heat-intensity'].forEach((id) => {
      document.getElementById(id).addEventListener('input', calculate);
    });

    const paceInput = document.getElementById('heat-pace');
    paceInput.addEventListener('blur', () => {
      autoFormatPace(paceInput);
      calculate();
    });
  });

})();
