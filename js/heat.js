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

  // Capped to Open-Meteo's air quality horizon (its shorter of the two) so the
  // AQI badge is always available whenever a forecast can be selected at all.
  const FORECAST_MAX_DAYS = 7;

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

  // Finds the hourly entry closest to a target Date, given a naive (offset-less)
  // "local to the location" time array — shared by the weather, AQI, and
  // chart-detail lookups so they all resolve "closest hour" the same way.
  function closestTimeIndex(times, target) {
    let bestIdx = 0, bestDiffMs = Infinity;
    times.forEach((t, i) => {
      const diff = Math.abs(new Date(t).getTime() - target.getTime());
      if (diff < bestDiffMs) { bestDiffMs = diff; bestIdx = i; }
    });
    return { bestIdx, bestDiffMs };
  }

  // Fetches and validates the AQI hourly series; returns null (rather than
  // throwing) on any failure, since AQI is supplementary to the weather call.
  async function fetchAqiHourly(lat, lon) {
    try {
      const aqiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}`
        + `&hourly=us_aqi&timezone=auto&forecast_days=${FORECAST_MAX_DAYS}&past_days=2`;
      const res = await fetch(aqiUrl);
      if (!res.ok) return null;
      const data = await res.json();
      if (!data.hourly || !data.hourly.time || !data.hourly.time.length) return null;
      return data.hourly;
    } catch {
      return null;
    }
  }

  // The official overall AQI for a location is the max across whatever
  // pollutants were monitored/forecasted there (PM2.5, ozone, PM10, …) — a
  // -1 AQI from AirNow means "not available yet" for that entry, not zero.
  function maxAqiFromAirNowEntries(entries) {
    if (!Array.isArray(entries) || !entries.length) return null;
    const valid = entries.filter((e) => typeof e.AQI === 'number' && e.AQI >= 0);
    if (!valid.length) return null;
    return Math.max(...valid.map((e) => e.AQI));
  }

  async function fetchAirNowCurrentAqi(lat, lon) {
    try {
      const url = `https://www.airnowapi.org/aq/observation/latLong/current/`
        + `?format=application/json&latitude=${lat}&longitude=${lon}&distance=25&API_KEY=${CONFIG.airNowApiKey}`;
      const res = await fetch(url);
      if (!res.ok) return null;
      return maxAqiFromAirNowEntries(await res.json());
    } catch {
      return null;
    }
  }

  // Real EPA ground-station AQI (ambient, not modeled) from AirNow.gov, used
  // in preference to Open-Meteo's modeled estimate whenever there's any real
  // AirNow reading for the day in question — Open-Meteo's model has proven
  // much less accurate during fast-changing events like wildfire smoke, so
  // it's kept strictly as a last resort for dates truly beyond AirNow's
  // forecast horizon (identified by AirNow returning zero entries at all for
  // that date, vs. AQI: -1 placeholders when it knows the date but hasn't
  // issued numbers for it yet — in the latter case we still prefer today's
  // real current observation, flat across the day, over the modeled curve).
  async function fetchAirNowOverride(lat, lon, referenceIso) {
    if (!CONFIG.airNowApiKey) return null;
    const day = referenceIso.slice(0, 10);
    try {
      const url = `https://www.airnowapi.org/aq/forecast/latLong/`
        + `?format=application/json&latitude=${lat}&longitude=${lon}&date=${day}&distance=25&API_KEY=${CONFIG.airNowApiKey}`;
      const res = await fetch(url);
      const data = res.ok ? await res.json() : [];
      const dayEntries = Array.isArray(data) ? data.filter((e) => e.DateForecast === day) : [];

      const forecastAqi = maxAqiFromAirNowEntries(dayEntries);
      if (forecastAqi != null) return { aqi: forecastAqi, day, viaCurrentObservation: false };

      if (dayEntries.length) {
        // AirNow knows this date but hasn't issued real numbers for it yet.
        const currentAqi = await fetchAirNowCurrentAqi(lat, lon);
        if (currentAqi != null) return { aqi: currentAqi, day, viaCurrentObservation: true };
      }

      return null; // genuinely beyond AirNow's forecast horizon
    } catch {
      return null;
    }
  }

  // Fetches the weather hourly series + AQI hourly series for a location in
  // parallel. AQI failure never blocks weather (see fetchAqiHourly); weather
  // failure throws, since there's nothing to show without it.
  async function fetchWeatherAndAqi(lat, lon) {
    // timezone=auto returns hourly.time as naive local-to-the-location strings,
    // matching the naive (offset-less) string a datetime-local input gives us —
    // so comparing them directly lines up "wall clock at the run location"
    // without needing any UTC conversion.
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}`
      + `&hourly=temperature_2m,relative_humidity_2m,dew_point_2m&temperature_unit=fahrenheit`
      + `&timezone=auto&forecast_days=${FORECAST_MAX_DAYS}&past_days=2`;

    const [res, aqiHourly] = await Promise.all([
      fetch(url),
      fetchAqiHourly(lat, lon),
    ]);
    if (!res.ok) throw new Error('Weather service unavailable');
    const data = await res.json();
    if (!data.hourly || !data.hourly.time || !data.hourly.time.length) throw new Error('No forecast data');
    return { hourly: data.hourly, aqiHourly };
  }

  // Fetches weather for a location and fills in the Heat Calculator form. If
  // a run date/time is selected in the "Run Date & Time" fields, pulls the
  // closest forecasted hour instead of current conditions — both share the
  // same lat/lon lookup flow (geolocation or ZIP), so the date/time applies
  // no matter which one the user picked.
  async function applyWeatherFromCoords(lat, lon) {
    const dtStr  = getSelectedRunDatetimeStr();
    const target = dtStr ? new Date(dtStr) : new Date();

    const { hourly, aqiHourly } = await fetchWeatherAndAqi(lat, lon);

    const { bestIdx, bestDiffMs } = closestTimeIndex(hourly.time, target);
    const referenceIso = hourly.time[bestIdx];

    if (dtStr && bestDiffMs > 3 * 3600000) throw new Error('OUT_OF_RANGE');

    fillWeatherFields(
      hourly.temperature_2m[bestIdx],
      hourly.dew_point_2m[bestIdx],
      hourly.relative_humidity_2m[bestIdx]
    );
    const airNowOverride = await fetchAirNowOverride(lat, lon, referenceIso);
    heatChart.render(hourly, referenceIso, aqiHourly, document.getElementById('heat-intensity').value, airNowOverride);
    renderAqiBadge(HEAT_AQI_IDS, aqiHourly, referenceIso, airNowOverride);
    return { forecast: !!dtStr, time: referenceIso };
  }

  // Read-only counterpart for the "Current Conditions" panel: always "now",
  // no form fields to fill, no pace-adjustment math shown.
  async function fetchCurrentConditions(lat, lon) {
    const { hourly, aqiHourly } = await fetchWeatherAndAqi(lat, lon);
    const { bestIdx } = closestTimeIndex(hourly.time, new Date());
    const referenceIso = hourly.time[bestIdx];

    renderConditionBadge(HOME_COND_IDS, hourly.temperature_2m[bestIdx], hourly.dew_point_2m[bestIdx]);
    const airNowOverride = await fetchAirNowOverride(lat, lon, referenceIso);
    renderAqiBadge(HOME_AQI_IDS, aqiHourly, referenceIso, airNowOverride);
    homeChart.render(hourly, referenceIso, aqiHourly, '', airNowOverride);
    return { forecast: false };
  }

  // ── Air quality badge ──────────────────────────────────────────────────────────
  // Category names, ranges, and health messages are the official EPA/AirNow
  // AQI categories (airnow.gov/aqi/aqi-basics), collapsed from their 6 official
  // colors (green/yellow/orange/red/purple/maroon) down to the 4 requested
  // here — the top 3 (Unhealthy, Very Unhealthy, Hazardous) all render red.

  function getAqiTier(aqi) {
    if (aqi <= 50)  return { label: 'Good', cls: 'aqi-good',
      desc: 'Air quality is satisfactory, and air pollution poses little or no risk.' };
    if (aqi <= 100) return { label: 'Moderate', cls: 'aqi-moderate',
      desc: 'Acceptable air quality; unusually sensitive people should consider limiting prolonged outdoor exertion.' };
    if (aqi <= 150) return { label: 'Unhealthy for Sensitive Groups', cls: 'aqi-orange',
      desc: 'Sensitive groups (heart or lung disease, older adults, children) may experience health effects.' };
    if (aqi <= 200) return { label: 'Unhealthy', cls: 'aqi-red',
      desc: 'Some members of the general public may experience health effects; sensitive groups may experience more serious effects.' };
    if (aqi <= 300) return { label: 'Very Unhealthy', cls: 'aqi-red',
      desc: 'Health alert: the risk of health effects is increased for everyone.' };
    return { label: 'Hazardous', cls: 'aqi-red',
      desc: 'Health warning of emergency conditions: everyone is more likely to be affected.' };
  }

  function renderAqiBadge(ids, aqiHourly, referenceIso, airNowOverride) {
    const row  = document.getElementById(ids.row);
    const note = document.getElementById(ids.note);

    let aqi = airNowOverride ? airNowOverride.aqi : null;
    if (aqi == null) {
      if (!aqiHourly) { row.classList.add('hidden'); note.classList.add('hidden'); return; }
      const { bestIdx, bestDiffMs } = closestTimeIndex(aqiHourly.time, new Date(referenceIso));
      const modeled = aqiHourly.us_aqi[bestIdx];
      if (bestDiffMs > 3 * 3600000 || modeled == null) { row.classList.add('hidden'); note.classList.add('hidden'); return; }
      aqi = modeled;
    }

    const tier = getAqiTier(aqi);
    const badge = document.getElementById(ids.badge);
    badge.textContent = `AQI ${Math.round(aqi)} — ${tier.label}`;
    badge.className   = `heat-cond-badge ${tier.cls}`;
    document.getElementById(ids.desc).textContent = tier.desc;
    row.classList.remove('hidden');

    if (airNowOverride && airNowOverride.viaCurrentObservation) {
      note.textContent = 'Source: AirNow.gov current reading — a day-specific forecast hasn’t been issued yet for this date.';
    } else if (airNowOverride) {
      // Real EPA ground-station data — no lag caveat needed.
      note.textContent = 'Source: AirNow.gov (EPA ground-station monitor).';
    } else {
      // This is a modeled (CAMS-based) estimate, not an EPA ground-station
      // reading — it can significantly underestimate fast-moving events like
      // wildfire smoke, which real monitors (AirNow) pick up much faster.
      note.innerHTML = 'Modeled estimate, not a ground-station reading &mdash; can lag real conditions during fast-changing events like wildfire smoke. Verify at <a href="https://www.airnow.gov/" target="_blank" rel="noopener">AirNow.gov</a>.';
    }
    note.classList.remove('hidden');
  }

  function renderConditionBadge(ids, temp, dp) {
    const condition = getCondition(temp, dp);
    const badge = document.getElementById(ids.badge);
    badge.textContent = condition.label;
    badge.className   = `heat-cond-badge ${condition.cls}`;
    document.getElementById(ids.desc).textContent = condition.desc;
    return condition;
  }

  // ── Heat risk by hour chart (6am–10pm) ────────────────────────────────────────

  const CHART_START_HOUR = 6;
  const CHART_END_HOUR   = 22;

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

  // Same idea for the AQI bar, ordered to match getAqiTier()'s severity.
  const AQI_TIER_HEIGHT_PCT = {
    'aqi-good':     20,
    'aqi-moderate': 47,
    'aqi-orange':   73,
    'aqi-red':     100,
  };

  // Builds a chart controller bound to one set of DOM ids, so the same
  // rendering logic can drive two independent chart instances on the same
  // page (the heat calculator's and the home screen's) without their click
  // handlers or "currently inspected hour" state leaking into each other.
  // `intensity` may be '' (home screen has no workout-type selector) —
  // calcAdjPct treats that as a neutral 1.0 multiplier; showPaceAdjustment
  // controls whether that number is surfaced in the UI at all, since it's
  // only meaningful once a workout type has actually been chosen.
  function createRiskChart(ids, { showPaceAdjustment }) {
    let rows = [];

    function render(hourly, referenceIso, aqiHourly, intensity, airNowOverride) {
      const container = document.getElementById(ids.container);
      const legendEl   = document.getElementById(ids.legend);
      const barsEl     = document.getElementById(ids.bars);
      const hoursEl    = document.getElementById(ids.hours);
      const dateEl     = document.getElementById(ids.date);

      const day = referenceIso.slice(0, 10); // "YYYY-MM-DD", local to the run location

      // AQI's forecast horizon is often shorter than weather's in practice
      // (see fetchAqiHourly) — build an hour→AQI lookup for this same day so
      // each heat-risk row can carry a matching AQI value only where one exists.
      const aqiByHour = {};
      if (aqiHourly) {
        aqiHourly.time.forEach((t, i) => {
          if (!t.startsWith(day)) return;
          aqiByHour[parseInt(t.slice(11, 13), 10)] = aqiHourly.us_aqi[i];
        });
      }

      // Real AirNow data (see fetchAirNowOverride) overrides the modeled
      // Open-Meteo values for every hour of the day — AirNow has no hourly
      // forecast resolution, only a whole-day value, so this is flat.
      if (airNowOverride && airNowOverride.day === day) {
        for (let h = CHART_START_HOUR; h <= CHART_END_HOUR; h++) aqiByHour[h] = airNowOverride.aqi;
      }

      rows = [];
      hourly.time.forEach((t, i) => {
        if (!t.startsWith(day)) return;
        const hour = parseInt(t.slice(11, 13), 10);
        if (hour < CHART_START_HOUR || hour > CHART_END_HOUR) return;
        const temp = hourly.temperature_2m[i];
        const dew  = hourly.dew_point_2m[i];
        const rh   = hourly.relative_humidity_2m[i];
        const aqi  = aqiByHour[hour];
        rows.push({
          hour, temp, dew, rh,
          adjPct: calcAdjPct(temp, dew, intensity),
          condition: getCondition(temp, dew),
          aqi: aqi != null ? aqi : null,
          aqiTier: aqi != null ? getAqiTier(aqi) : null,
        });
      });

      if (!rows.length) {
        container.classList.add('hidden');
        return;
      }

      const selectedHour = parseInt(referenceIso.slice(11, 13), 10);
      const hasAqi = rows.some((r) => r.aqi != null);

      dateEl.textContent = new Date(referenceIso).toLocaleDateString(undefined, {
        weekday: 'short', month: 'short', day: 'numeric',
      });

      legendEl.classList.toggle('hidden', !hasAqi);

      barsEl.innerHTML = rows.map((r) => {
        // Height tracks the same risk tier as the color (RISK_TIER_HEIGHT_PCT),
        // not the raw adjPct — adjPct is a continuous, intensity-scaled pace
        // penalty while the tier is a threshold-based environmental read that
        // can trip on temp OR dew point alone. Driving height off adjPct while
        // color came from the tier meant a lower (safer-looking) bar could still
        // be the more severe color, since the two don't always move together.
        const heightPct = RISK_TIER_HEIGHT_PCT[r.condition.cls] ?? 50;
        const paceAdjText = showPaceAdjustment ? `, +${r.adjPct.toFixed(1)}% pace adjustment` : '';
        const heatBar = `
          <div
            class="heat-risk-bar heat-risk-bar-heat ${r.condition.cls}"
            style="height:${heightPct}%"
            title="${formatHourLabel(r.hour)} heat risk: ${r.condition.label}${paceAdjText}"
          ></div>
        `;
        const aqiBar = !hasAqi ? '' : r.aqiTier
          ? `
            <div
              class="heat-risk-bar heat-risk-bar-aqi ${r.aqiTier.cls}"
              style="height:${AQI_TIER_HEIGHT_PCT[r.aqiTier.cls]}%"
              title="${formatHourLabel(r.hour)} air quality: AQI ${Math.round(r.aqi)} (${r.aqiTier.label})"
            ></div>
          `
          : `
            <div
              class="heat-risk-bar heat-risk-bar-aqi heat-risk-bar-aqi-none"
              title="${formatHourLabel(r.hour)} air quality: not available"
            ></div>
          `;
        return `
          <div class="heat-risk-bar-col" data-hour="${r.hour}">
            <div class="heat-risk-bar-pair">${heatBar}${aqiBar}</div>
          </div>
        `;
      }).join('');

      hoursEl.innerHTML = rows.map((r) => `
        <span class="heat-risk-bar-hour ${r.hour === selectedHour ? 'heat-risk-bar-hour-selected' : ''}" data-hour="${r.hour}">${formatHourLabel(r.hour)}</span>
      `).join('');

      barsEl.querySelectorAll('.heat-risk-bar-col').forEach((col) => {
        col.addEventListener('click', () => detail(parseInt(col.dataset.hour, 10)));
      });

      container.classList.remove('hidden');

      // Default the detail panel to the selected run time (or the first bar,
      // if the selected time falls outside the chart's 6am–10pm window).
      const defaultHour = rows.some((r) => r.hour === selectedHour) ? selectedHour : rows[0].hour;
      detail(defaultHour);
    }

    // Shows temp/humidity/condition for a clicked hour, and marks that bar +
    // hour label (within THIS chart instance only) as currently inspected.
    function detail(hour) {
      const row      = rows.find((r) => r.hour === hour);
      const detailEl = document.getElementById(ids.detail);
      if (!row || !detailEl) return;

      document.querySelectorAll(`#${ids.bars} .heat-risk-bar-col`).forEach((col) => {
        col.classList.toggle('heat-risk-col-active', parseInt(col.dataset.hour, 10) === hour);
      });
      document.querySelectorAll(`#${ids.hours} .heat-risk-bar-hour`).forEach((el) => {
        el.classList.toggle('heat-risk-bar-hour-active', parseInt(el.dataset.hour, 10) === hour);
      });

      const aqiPart = row.aqiTier
        ? ` &mdash; <span class="${row.aqiTier.cls}">AQI ${Math.round(row.aqi)} (${row.aqiTier.label})</span>`
        : '';
      const paceAdjPart = showPaceAdjustment ? `, +${row.adjPct.toFixed(1)}% pace adjustment` : '';

      detailEl.innerHTML = `
        <strong>${formatHourLabel(row.hour)}</strong> &mdash;
        ${Math.round(row.temp)}&deg;F, ${Math.round(row.rh)}% humidity (dew point ${Math.round(row.dew)}&deg;F)
        &mdash; <span class="${row.condition.cls}">${row.condition.label}</span>${paceAdjPart}${aqiPart}
      `;
    }

    return { render };
  }

  // Element ids for the two places this feature set appears: the full Heat
  // Calculator tab (miles/pace/intensity, date+time picker, pace-adjustment
  // numbers) and the read-only "Current Conditions" panel on the Home
  // screen (location only, always "now", no pace-adjustment math shown).
  const HEAT_COND_IDS   = { badge: 'heat-cond-badge', desc: 'heat-cond-desc' };
  const HEAT_AQI_IDS    = { row: 'heat-aqi-row', badge: 'heat-aqi-badge', desc: 'heat-aqi-desc', note: 'heat-aqi-note' };
  const HEAT_CHART_IDS  = {
    container: 'heat-risk-chart', legend: 'heat-risk-chart-legend',
    bars: 'heat-risk-chart-bars', hours: 'heat-risk-chart-hours',
    date: 'heat-risk-chart-date', detail: 'heat-risk-chart-detail',
  };

  const HOME_COND_IDS  = { badge: 'cc-cond-badge', desc: 'cc-cond-desc' };
  const HOME_AQI_IDS   = { row: 'cc-aqi-row', badge: 'cc-aqi-badge', desc: 'cc-aqi-desc', note: 'cc-aqi-note' };
  const HOME_CHART_IDS = {
    container: 'cc-risk-chart', legend: 'cc-risk-chart-legend',
    bars: 'cc-risk-chart-bars', hours: 'cc-risk-chart-hours',
    date: 'cc-risk-chart-date', detail: 'cc-risk-chart-detail',
  };

  const heatChart = createRiskChart(HEAT_CHART_IDS, { showPaceAdjustment: true });
  const homeChart = createRiskChart(HOME_CHART_IDS, { showPaceAdjustment: false });

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

  // Wires up one location-resolution widget (the "Use my location" button +
  // ZIP input/button + saved-ZIP chips, optionally a date/time picker), bound
  // to a set of DOM ids. `onResolve(lat, lon)` does whatever that particular
  // widget needs once a location is known (fill the calculator form and
  // render its chart, or — for the read-only home screen panel — just render
  // the badges/chart). Shared saved-ZIP storage means a ZIP saved from either
  // widget shows up as a chip in both.
  function initLocationControls(ids, onResolve, opts) {
    const btn           = document.getElementById(ids.useLocationBtn);
    const status         = document.getElementById(ids.status);
    const zipInput       = document.getElementById(ids.zipInput);
    const zipBtn         = document.getElementById(ids.zipBtn);
    const zipSavedRow    = document.getElementById(ids.zipSaved);
    const locationLabel  = ids.locationLabel ? document.getElementById(ids.locationLabel) : null;

    function setStatus(msg, isError) {
      status.textContent = msg;
      status.classList.toggle('heat-weather-error', !!isError);
    }

    // e.g. "Current Conditions in 55409" — only known for ZIP lookups, since
    // geolocation gives coordinates, not a ZIP to display.
    function setLocationLabel(text) {
      if (locationLabel) locationLabel.textContent = text;
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
        const result = await onResolve(lat, lon);
        saveZip(zip, lat, lon);
        renderSavedZips();
        setStatus(weatherStatusMessage(result, zip), false);
        setLocationLabel(` in ${zip}`);
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
            const result = await onResolve(pos.coords.latitude, pos.coords.longitude);
            setStatus(weatherStatusMessage(result, 'your current location'), false);
            setLocationLabel(''); // geolocation gives coordinates, not a ZIP to show
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

    if (opts && opts.includeDateTime) {
      const dateInput = document.getElementById(ids.dateInput);
      const timeSelect = document.getElementById(ids.timeSelect);
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
    }

    renderSavedZips();

    if (opts && opts.autoLoadDefault) {
      const zips = loadSavedZips();
      if (zips.length) loadZip(zips[0].zip);
    }
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
    const condition   = renderConditionBadge(HEAT_COND_IDS, temp, dp);

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

  const HEAT_LOCATION_IDS = {
    useLocationBtn: 'btn-use-weather', status: 'heat-weather-status',
    zipInput: 'heat-zip-input', zipBtn: 'btn-zip-fetch', zipSaved: 'heat-zip-saved',
    dateInput: 'heat-weather-date', timeSelect: 'heat-weather-time',
  };
  const HOME_LOCATION_IDS = {
    useLocationBtn: 'cc-btn-use-weather', status: 'cc-weather-status',
    zipInput: 'cc-zip-input', zipBtn: 'cc-btn-zip-fetch', zipSaved: 'cc-zip-saved',
    locationLabel: 'cc-location-suffix',
  };

  document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initHumidityToggle();
    initLocationControls(HEAT_LOCATION_IDS, applyWeatherFromCoords, { includeDateTime: true });
    // Current Conditions panel: no workout inputs, auto-loads the most
    // recently used (or default-seeded) ZIP on load so it's never empty.
    initLocationControls(HOME_LOCATION_IDS, fetchCurrentConditions, { autoLoadDefault: true });

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
