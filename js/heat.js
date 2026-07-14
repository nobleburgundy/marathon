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

  // Sourced from the National Weather Service (weather.gov/safety/heat-illness),
  // cross-checked against the CDC's heat-related-illness guidance. Do not add
  // symptoms here that aren't backed by a source like this.
  const HEAT_EXHAUSTION_SIGNS = [
    'Heavy sweating',
    'Cool, pale, clammy skin',
    'Fast, weak pulse',
    'Muscle cramps',
    'Nausea or vomiting',
    'Headache',
    'Dizziness',
    'Weakness or tiredness',
    'Fainting',
  ];

  const HEAT_STROKE_SIGNS = [
    'Body temperature above 103°F',
    'Hot, red, dry or damp skin',
    'Rapid, strong pulse',
    'Throbbing headache',
    'Confusion or slurred speech',
    'Nausea or dizziness',
    'Fainting or loss of consciousness',
  ];

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

  // ── Local weather auto-fill ───────────────────────────────────────────────────
  // Uses the browser's geolocation, or a saved ZIP code, + Open-Meteo (no API key
  // required, free for this kind of client-side use) to fill in Temperature and
  // Dew Point/Humidity. ZIP → lat/lon comes from Zippopotam.us (also key-free).

  const STORAGE_ZIPS  = 'mp_heat_zips'; // [{ zip, lat, lon }, …] most-recent-first, max 3
  const DEFAULT_ZIPS  = ['55409'];      // seeded once for first-time visitors; removable like any chip

  function loadSavedZips() {
    const raw = localStorage.getItem(STORAGE_ZIPS);
    if (raw === null) {
      // First-ever visit — nothing saved or removed yet, so seed the default(s).
      const seeded = DEFAULT_ZIPS.map((zip) => ({ zip }));
      localStorage.setItem(STORAGE_ZIPS, JSON.stringify(seeded));
      return seeded;
    }
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveZip(zip, lat, lon) {
    const list = loadSavedZips().filter((z) => z.zip !== zip);
    list.unshift({ zip, lat, lon });
    localStorage.setItem(STORAGE_ZIPS, JSON.stringify(list.slice(0, 3)));
  }

  function removeSavedZip(zip) {
    const list = loadSavedZips().filter((z) => z.zip !== zip);
    localStorage.setItem(STORAGE_ZIPS, JSON.stringify(list));
  }

  async function geocodeZip(zip) {
    const res = await fetch(`https://api.zippopotam.us/us/${zip}`);
    if (!res.ok) throw new Error('ZIP code not found');
    const data = await res.json();
    const place = data.places && data.places[0];
    if (!place) throw new Error('ZIP code not found');
    return { lat: parseFloat(place.latitude), lon: parseFloat(place.longitude) };
  }

  const FORECAST_MAX_DAYS = 16; // Open-Meteo's hourly forecast horizon

  function fillWeatherFields(temp, dew, rh) {
    document.getElementById('heat-temp').value = Math.round(temp);
    document.getElementById('heat-dew').value  = Math.round(dew);
    document.getElementById('heat-rh').value   = Math.round(rh);
    calculate();
  }

  function toDateValue(date) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  // The date input and the 30-minute time <select> only combine into a
  // datetime once both are set — either alone falls back to "now".
  function getSelectedRunDatetimeStr() {
    const dateVal = document.getElementById('heat-weather-date').value;
    const timeVal = document.getElementById('heat-weather-time').value;
    return dateVal && timeVal ? `${dateVal}T${timeVal}` : '';
  }

  // Fetches weather for a location. If a run date/time is selected in the
  // "Run Date & Time" fields, pulls the closest forecasted hour instead of
  // current conditions — both share the same lat/lon lookup flow (geolocation
  // or ZIP), so the date/time applies no matter which one the user picked.
  // Always pulls the hourly series (rather than a separate "current" endpoint)
  // so the same response can drive the 6am–10pm heat-risk-by-hour chart.
  async function applyWeatherFromCoords(lat, lon) {
    const dtStr  = getSelectedRunDatetimeStr();
    const target = dtStr ? new Date(dtStr) : new Date();

    // timezone=auto returns hourly.time as naive local-to-the-location strings,
    // matching the naive (offset-less) string a datetime-local input gives us —
    // so comparing them directly lines up "wall clock at the run location"
    // without needing any UTC conversion.
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}`
      + `&hourly=temperature_2m,relative_humidity_2m,dew_point_2m&temperature_unit=fahrenheit`
      + `&timezone=auto&forecast_days=${FORECAST_MAX_DAYS}&past_days=2`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Weather service unavailable');
    const data = await res.json();
    if (!data.hourly || !data.hourly.time || !data.hourly.time.length) throw new Error('No forecast data');

    const times = data.hourly.time;
    let bestIdx = 0, bestDiffMs = Infinity;
    times.forEach((t, i) => {
      const diff = Math.abs(new Date(t).getTime() - target.getTime());
      if (diff < bestDiffMs) { bestDiffMs = diff; bestIdx = i; }
    });

    if (dtStr && bestDiffMs > 3 * 3600000) throw new Error('OUT_OF_RANGE');

    fillWeatherFields(
      data.hourly.temperature_2m[bestIdx],
      data.hourly.dew_point_2m[bestIdx],
      data.hourly.relative_humidity_2m[bestIdx]
    );
    renderHeatRiskChart(data.hourly, times[bestIdx]);
    return { forecast: !!dtStr, time: times[bestIdx] };
  }

  // ── Heat risk by hour chart (6am–10pm) ────────────────────────────────────────

  const CHART_START_HOUR = 6;
  const CHART_END_HOUR   = 22;

  let chartRows          = []; // current day's [{ hour, temp, dew, rh, adjPct, condition }, …]
  let chartInspectedHour = null;

  function formatHourLabel(hour) {
    if (hour === 0) return '12a';
    if (hour === 12) return '12p';
    return hour < 12 ? `${hour}a` : `${hour - 12}p`;
  }

  // Ordered to match getCondition()'s own cascading severity, so a bar's
  // height always agrees with its color (and with the condition badge shown
  // above for the selected hour's exact temp/dew values).
  const RISK_TIER_HEIGHT_PCT = {
    'cond-ideal':     15,
    'cond-good':      32,
    'cond-moderate':  49,
    'cond-tough':     66,
    'cond-very-hard': 83,
    'cond-danger':   100,
  };

  function renderHeatRiskChart(hourly, referenceIso) {
    const container = document.getElementById('heat-risk-chart');
    const barsEl     = document.getElementById('heat-risk-chart-bars');
    const hoursEl    = document.getElementById('heat-risk-chart-hours');
    const dateEl     = document.getElementById('heat-risk-chart-date');

    const day       = referenceIso.slice(0, 10); // "YYYY-MM-DD", local to the run location
    const intensity = document.getElementById('heat-intensity').value;

    const rows = [];
    hourly.time.forEach((t, i) => {
      if (!t.startsWith(day)) return;
      const hour = parseInt(t.slice(11, 13), 10);
      if (hour < CHART_START_HOUR || hour > CHART_END_HOUR) return;
      const temp = hourly.temperature_2m[i];
      const dew  = hourly.dew_point_2m[i];
      const rh   = hourly.relative_humidity_2m[i];
      rows.push({
        hour, temp, dew, rh,
        adjPct: calcAdjPct(temp, dew, intensity),
        condition: getCondition(temp, dew),
      });
    });

    chartRows = rows;

    if (!rows.length) {
      container.classList.add('hidden');
      return;
    }

    const selectedHour = parseInt(referenceIso.slice(11, 13), 10);

    dateEl.textContent = new Date(referenceIso).toLocaleDateString(undefined, {
      weekday: 'short', month: 'short', day: 'numeric',
    });

    barsEl.innerHTML = rows.map((r) => {
      // Height tracks the same risk tier as the color (RISK_TIER_HEIGHT_PCT),
      // not the raw adjPct — adjPct is a continuous, intensity-scaled pace
      // penalty while the tier is a threshold-based environmental read that
      // can trip on temp OR dew point alone. Driving height off adjPct while
      // color came from the tier meant a lower (safer-looking) bar could still
      // be the more severe color, since the two don't always move together.
      const heightPct = RISK_TIER_HEIGHT_PCT[r.condition.cls] ?? 50;
      return `
        <div class="heat-risk-bar-col" data-hour="${r.hour}">
          <div
            class="heat-risk-bar ${r.condition.cls} ${r.hour === selectedHour ? 'heat-risk-bar-selected' : ''}"
            style="height:${heightPct}%"
            title="${formatHourLabel(r.hour)}: ${r.condition.label}, +${r.adjPct.toFixed(1)}% pace adjustment"
          ></div>
        </div>
      `;
    }).join('');

    hoursEl.innerHTML = rows.map((r) => `
      <span class="heat-risk-bar-hour ${r.hour === selectedHour ? 'heat-risk-bar-hour-selected' : ''}" data-hour="${r.hour}">${formatHourLabel(r.hour)}</span>
    `).join('');

    barsEl.querySelectorAll('.heat-risk-bar-col').forEach((col) => {
      col.addEventListener('click', () => renderChartDetail(parseInt(col.dataset.hour, 10)));
    });

    container.classList.remove('hidden');

    // Default the detail panel to the selected run time (or the first bar,
    // if the selected time falls outside the chart's 6am–10pm window).
    const defaultHour = rows.some((r) => r.hour === selectedHour) ? selectedHour : rows[0].hour;
    renderChartDetail(defaultHour);
  }

  // Shows temp/humidity/condition for a clicked hour, and marks that bar +
  // hour label as the one currently being inspected.
  function renderChartDetail(hour) {
    const row      = chartRows.find((r) => r.hour === hour);
    const detailEl = document.getElementById('heat-risk-chart-detail');
    if (!row || !detailEl) return;

    chartInspectedHour = hour;

    document.querySelectorAll('.heat-risk-bar-col').forEach((col) => {
      col.classList.toggle('heat-risk-col-active', parseInt(col.dataset.hour, 10) === hour);
    });
    document.querySelectorAll('.heat-risk-bar-hour').forEach((el) => {
      el.classList.toggle('heat-risk-bar-hour-active', parseInt(el.dataset.hour, 10) === hour);
    });

    detailEl.innerHTML = `
      <strong>${formatHourLabel(row.hour)}</strong> &mdash;
      ${Math.round(row.temp)}&deg;F, ${Math.round(row.rh)}% humidity (dew point ${Math.round(row.dew)}&deg;F)
      &mdash; <span class="${row.condition.cls}">${row.condition.label}</span>, +${row.adjPct.toFixed(1)}% pace adjustment
    `;
  }

  function weatherStatusMessage(result, sourceLabel) {
    if (!result.forecast) return `Filled in from ${sourceLabel}.`;
    const label = new Date(result.time).toLocaleString(undefined, {
      weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    });
    return `Forecast for ${label} — ${sourceLabel}.`;
  }

  function weatherErrorMessage(err, fallback) {
    if (err && err.message === 'OUT_OF_RANGE') {
      return `Forecast only reaches ~${FORECAST_MAX_DAYS} days out — pick a closer date, or leave it blank for current conditions.`;
    }
    if (err && err.message === 'ZIP code not found') return err.message;
    return fallback;
  }

  function initWeatherButton() {
    const btn        = document.getElementById('btn-use-weather');
    const status      = document.getElementById('heat-weather-status');
    const zipInput    = document.getElementById('heat-zip-input');
    const zipBtn      = document.getElementById('btn-zip-fetch');
    const zipSavedRow = document.getElementById('heat-zip-saved');

    function setStatus(msg, isError) {
      status.textContent = msg;
      status.classList.toggle('heat-weather-error', !!isError);
    }

    function renderSavedZips() {
      const zips = loadSavedZips();
      zipSavedRow.innerHTML = zips.map((z) => `
        <span class="heat-zip-chip">
          <button type="button" class="heat-zip-chip-load" data-zip="${z.zip}">${z.zip}</button>
          <button type="button" class="heat-zip-chip-remove" data-zip="${z.zip}" aria-label="Remove ${z.zip}">&times;</button>
        </span>
      `).join('');

      zipSavedRow.querySelectorAll('.heat-zip-chip-load').forEach((el) => {
        el.addEventListener('click', () => loadZip(el.dataset.zip));
      });
      zipSavedRow.querySelectorAll('.heat-zip-chip-remove').forEach((el) => {
        el.addEventListener('click', () => {
          removeSavedZip(el.dataset.zip);
          renderSavedZips();
        });
      });
    }

    async function loadZip(zip) {
      // A seeded default has no cached lat/lon yet — geocode it once, same as any new zip.
      const cached = loadSavedZips().find((z) => z.zip === zip && z.lat != null && z.lon != null);
      zipBtn.disabled = true;
      setStatus(`Fetching weather for ${zip}…`, false);
      try {
        const { lat, lon } = cached || await geocodeZip(zip);
        const result = await applyWeatherFromCoords(lat, lon);
        saveZip(zip, lat, lon);
        renderSavedZips();
        setStatus(weatherStatusMessage(result, zip), false);
      } catch (err) {
        setStatus(weatherErrorMessage(err, 'Could not fetch weather for that ZIP.'), true);
      } finally {
        zipBtn.disabled = false;
      }
    }

    btn.addEventListener('click', () => {
      if (!navigator.geolocation) {
        setStatus('Geolocation isn’t supported by this browser.', true);
        return;
      }

      btn.disabled = true;
      setStatus('Locating…', false);

      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          setStatus('Fetching weather…', false);
          try {
            const result = await applyWeatherFromCoords(pos.coords.latitude, pos.coords.longitude);
            setStatus(weatherStatusMessage(result, 'your current location'), false);
          } catch (err) {
            setStatus(weatherErrorMessage(err, 'Could not fetch local weather — enter it manually.'), true);
          } finally {
            btn.disabled = false;
          }
        },
        (err) => {
          setStatus(
            err.code === err.PERMISSION_DENIED
              ? 'Location permission denied — enter weather manually.'
              : 'Could not determine your location.',
            true
          );
          btn.disabled = false;
        },
        { timeout: 10000, maximumAge: 300000 }
      );
    });

    zipBtn.addEventListener('click', () => {
      const zip = zipInput.value.trim();
      if (!/^\d{5}$/.test(zip)) {
        setStatus('Enter a 5-digit US ZIP code.', true);
        return;
      }
      loadZip(zip);
    });

    zipInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') zipBtn.click();
    });

    const dateInput = document.getElementById('heat-weather-date');
    const timeSelect = document.getElementById('heat-weather-time');
    const now = new Date();
    dateInput.min = toDateValue(now);
    dateInput.max = toDateValue(new Date(now.getTime() + FORECAST_MAX_DAYS * 86400000));

    // Native datetime-local pickers don't reliably honor a `step` — mobile
    // browsers in particular still show minute-by-minute wheels. A plain
    // <select> of fixed half-hour marks guarantees the 30-min granularity
    // on every platform. Bounded to the same 6am–10pm window as the heat
    // risk chart, so every selectable time actually has a bar to show for it.
    for (let mins = CHART_START_HOUR * 60; mins <= CHART_END_HOUR * 60; mins += 30) {
      const h24 = Math.floor(mins / 60);
      const m   = mins % 60;
      const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
      const ampm = h24 < 12 ? 'AM' : 'PM';
      const opt = document.createElement('option');
      opt.value = `${String(h24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      opt.textContent = `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
      timeSelect.appendChild(opt);
    }

    renderSavedZips();
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

    const warning  = document.getElementById('heat-warning');
    const isDanger = condition.cls === 'cond-danger';
    if (isDanger || condition.cls === 'cond-very-hard') {
      const mainMsg = isDanger
        ? 'Conditions are in the dangerous range. Serious risk of heat illness — strongly consider rescheduling or moving indoors.'
        : 'High heat stress. If you run, cut the workout short, slow down significantly, and watch for signs of heat exhaustion.';

      let html = `<p class="heat-warning-main">${mainMsg}</p>`;

      html += `
        <p class="heat-warning-signs-label">Signs of heat exhaustion:</p>
        <ul class="heat-warning-signs-list">${HEAT_EXHAUSTION_SIGNS.map((s) => `<li>${s}</li>`).join('')}</ul>
        <p class="heat-warning-note">If you or a running partner shows these signs: stop running, move to shade or
          air conditioning, loosen clothing, sip water, and apply cool, wet cloths. Get medical help right away if
          symptoms include vomiting, get worse, or last longer than an hour.</p>
      `;

      if (isDanger) {
        html += `
          <p class="heat-warning-signs-label">Signs of heat stroke &mdash; a medical emergency:</p>
          <ul class="heat-warning-signs-list">${HEAT_STROKE_SIGNS.map((s) => `<li>${s}</li>`).join('')}</ul>
          <p class="heat-warning-note heat-warning-note-urgent">Heat stroke can be fatal. Call 911 immediately if
            these appear &mdash; do not wait.</p>
        `;
      }

      html += `<p class="heat-warning-source">Source: National Weather Service (weather.gov/safety/heat-illness), CDC</p>`;

      warning.innerHTML = html;
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
    initWeatherButton();
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
