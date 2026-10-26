// ─────────────────────────────────────────────────────────────────────────────
// Main application logic.
//
// Persistence strategy:
//   • localStorage stores ONE key — the user's preferred calendar ID.
//   • Everything else (plan, race date, pace) is embedded as a metadata tag
//     inside every event description in Google Calendar. On sign-in we search
//     for that tag, parse the config, and reconstruct the preview — no
//     separate database needed.
//
// Metadata tag format (appended to every event description):
//   [marathon-planner: <planId> | <raceDate> | <goalPaceSec>]
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_CALENDAR = 'mp_calendar'; // preferred calendar ID only

// Home screen "default plan" widget — separate from the calendar-linked flow
// above, since it needs to render before (and without requiring) a Google
// sign-in. STORAGE_DEFAULT_PLAN_CHOICE holds a planId once chosen, or 'skip'
// once dismissed — either way the chooser never shows again after that.
const STORAGE_DEFAULT_PLAN_CHOICE = 'mp_default_plan_choice';
const STORAGE_DEFAULT_PLAN_SETUP  = 'mp_default_plan_setup'; // JSON {raceDate, secPerMile}
const DEFAULT_PLAN_ID = 'hal-novice-2'; // "TCM Hal Higdon 2"

// Baked-in race config for the one-click default plan option — this is the
// plan/date already reflected in the linked Google Calendar, so picking
// "TCM Hal Higdon 2" can load instantly with no extra setup step or sign-in.
const DEFAULT_PLAN_CONFIG = {
  'hal-novice-2': { raceDate: '2026-10-04', secPerMile: null },
};

// Backs the "Current Plan" page — set whenever a plan is built or restored
// via the Build-a-Plan flow, so that page (and its nav entry) work without
// needing an active Google sign-in every visit.
const STORAGE_CURRENT_PLAN = 'mp_current_plan'; // JSON {planId, raceDate, secPerMile}

// Settings page — per-view week-start preference. Calendar defaults to
// Sunday (a traditional calendar), List defaults to Monday (matches the
// plan's own native Mon–Sun schedule structure, so existing users see no
// change unless they opt in).
const STORAGE_CAL_WEEK_START   = 'mp_cal_week_start';
const STORAGE_LIST_WEEK_START  = 'mp_list_week_start';
const STORAGE_CURRENTPLAN_VIEW = 'mp_currentplan_view'; // 'calendar' | 'list'

// Home "Today's Plan" — a cached copy of the linked Google Calendar's events
// for roughly a week either side of the last sync, so today's workout shows
// on Home without a sign-in every visit (and with or without a chosen plan).
// JSON {calendarId, fetchedAt, from, to, byDate: {YYYY-MM-DD: [{title, description}]}}
// where `to` is exclusive.
const STORAGE_CAL_WORKOUTS = 'mp_cal_workouts';

function getCalWeekStart()  { return localStorage.getItem(STORAGE_CAL_WEEK_START)  || 'sunday'; }
function getListWeekStart() { return localStorage.getItem(STORAGE_LIST_WEEK_START) || 'monday'; }

/** Wires a Settings toggle (Sunday/Monday) — saves the choice and re-renders Current Plan if it's currently visible. */
function initSettingsToggle(containerId, storageKey, currentValue) {
  const container = document.getElementById(containerId);
  container.querySelectorAll('.heat-toggle-btn').forEach((btn) => {
    btn.classList.toggle('heat-toggle-active', btn.dataset.value === currentValue);
    btn.addEventListener('click', () => {
      localStorage.setItem(storageKey, btn.dataset.value);
      container.querySelectorAll('.heat-toggle-btn').forEach((b) =>
        b.classList.toggle('heat-toggle-active', b === btn));
      renderCurrentPlan();
    });
  });
}

/**
 * Settings' "Default Training Plan" group — management for the Home
 * default-plan widget lives here (race date, reset), while the initial
 * pick-or-skip decision stays a one-time moment on Home itself.
 */
function renderSettingsDefaultPlan() {
  const container = document.getElementById('settings-default-plan-content');
  const choice = localStorage.getItem(STORAGE_DEFAULT_PLAN_CHOICE);
  const plan   = choice ? PLANS.find((p) => p.id === choice) : null;
  const setupRaw = plan ? localStorage.getItem(STORAGE_DEFAULT_PLAN_SETUP) : null;
  const setup    = setupRaw ? JSON.parse(setupRaw) : null;

  if (!plan || !setup) {
    container.innerHTML = `<p class="hint">No default plan is set on Home yet &mdash; visit the Home tab to choose one.</p>`;
    return;
  }

  container.innerHTML = `
    <p class="settings-default-plan-name">${plan.name}</p>
    <p class="hint">Race day ${formatDisplayDate(setup.raceDate)}${setup.secPerMile ? ` &middot; Goal pace ${formatPace(setup.secPerMile)}` : ''}</p>
    <div class="today-plan-links">
      <button type="button" class="link-btn" id="settings-btn-edit-race-date">Update race date</button>
      <button type="button" class="link-btn link-btn-muted" id="settings-btn-clear-default-plan">Change default plan</button>
    </div>
    <div id="settings-edit-race-date" class="today-plan-edit-date hidden">
      <div class="form-group">
        <label for="settings-race-date-input">Race Date</label>
        <input type="date" id="settings-race-date-input" class="field">
      </div>
      <p id="settings-race-date-error" class="heat-invalid hidden"></p>
      <div class="btn-row">
        <button type="button" class="btn" id="settings-btn-save-race-date">Save</button>
        <button type="button" class="btn secondary" id="settings-btn-cancel-race-date">Cancel</button>
      </div>
    </div>
  `;

  document.getElementById('settings-btn-edit-race-date').addEventListener('click', () => {
    document.getElementById('settings-race-date-input').value = setup.raceDate || '';
    document.getElementById('settings-race-date-error').classList.add('hidden');
    document.getElementById('settings-edit-race-date').classList.remove('hidden');
  });

  document.getElementById('settings-btn-cancel-race-date').addEventListener('click', () => {
    document.getElementById('settings-edit-race-date').classList.add('hidden');
  });

  document.getElementById('settings-btn-save-race-date').addEventListener('click', () => {
    const raceDate = document.getElementById('settings-race-date-input').value;
    const errEl    = document.getElementById('settings-race-date-error');
    if (!raceDate) {
      errEl.textContent = 'Please select a race date.';
      errEl.classList.remove('hidden');
      return;
    }
    errEl.classList.add('hidden');
    setup.raceDate = raceDate;
    localStorage.setItem(STORAGE_DEFAULT_PLAN_SETUP, JSON.stringify(setup));
    renderTodayPlan();
    renderSettingsDefaultPlan();
  });

  document.getElementById('settings-btn-clear-default-plan').addEventListener('click', () => {
    localStorage.removeItem(STORAGE_DEFAULT_PLAN_CHOICE);
    localStorage.removeItem(STORAGE_DEFAULT_PLAN_SETUP);
    renderTodayPlan();
    renderSettingsDefaultPlan();
  });
}

function saveCurrentPlan(planId, raceDate, secPerMile) {
  localStorage.setItem(STORAGE_CURRENT_PLAN, JSON.stringify({ planId, raceDate, secPerMile: secPerMile || null }));
}

/**
 * Resolves whichever plan should back the "Current Plan" page: a plan
 * built/restored via the Build-a-Plan flow takes priority (the most
 * specific, deliberately-configured one), falling back to the Home
 * "default plan" selection. Returns null if neither is available — also
 * what gates the nav tab and the "This Week" link.
 */
function getCurrentPlanConfig() {
  const raw = localStorage.getItem(STORAGE_CURRENT_PLAN);
  if (raw) {
    try {
      const cfg = JSON.parse(raw);
      if (cfg && cfg.raceDate && PLANS.find((p) => p.id === cfg.planId)) return cfg;
    } catch { /* fall through to the default-plan check below */ }
  }

  const choice = localStorage.getItem(STORAGE_DEFAULT_PLAN_CHOICE);
  if (choice && choice !== 'skip') {
    const setupRaw = localStorage.getItem(STORAGE_DEFAULT_PLAN_SETUP);
    const setup    = setupRaw ? JSON.parse(setupRaw) : null;
    if (setup && setup.raceDate && PLANS.find((p) => p.id === choice)) {
      return { planId: choice, raceDate: setup.raceDate, secPerMile: setup.secPerMile || null };
    }
  }

  return null;
}

function updateCurrentPlanNav() {
  const has  = !!getCurrentPlanConfig();
  const tab  = document.getElementById('tab-btn-currentplan');
  const link = document.getElementById('btn-view-full-plan');
  if (tab)  tab.classList.toggle('hidden', !has);
  if (link) link.classList.toggle('hidden', !has);
}

// In-memory event IDs for the current session (populated from search or creation).
let savedCalendarId = null;
let savedEventIds   = [];

let browseMode = false;

// Selected paces — supports multiple for group runs.
let selectedPaces = [];

// ── Run-type filter ───────────────────────────────────────────────────────────
// Tracks which run types the user wants to include in the calendar push.
// Reset whenever a new plan is previewed.

let enabledTypes = new Set();

const TYPE_META = {
  easy:  { label: 'Easy Run',  color: '#3a6282' },
  long:  { label: 'Long Run',  color: '#1a9c5b' },
  pace:  { label: 'Pace',      color: '#1a9c5b' },
  tempo: { label: 'Tempo',     color: '#c97a1a' },
  speed: { label: 'Speed',     color: '#b5291c' },
  walk:  { label: 'Run / Walk', color: '#2d8abf' },
  hike:  { label: 'Hike / Walk', color: '#6b7f3a' },
  race:  { label: 'Race',      color: '#2d8abf' },
};

// ── Pace options ──────────────────────────────────────────────────────────────

const PACE_OPTIONS = [
  { finish: '2:45:00', secPerMile: 378 },
  { finish: '3:00:00', secPerMile: 412 },
  { finish: '3:15:00', secPerMile: 447 },
  { finish: '3:30:00', secPerMile: 481 },
  { finish: '3:45:00', secPerMile: 515 },
  { finish: '4:00:00', secPerMile: 549 },
  { finish: '4:15:00', secPerMile: 584 },
  { finish: '4:30:00', secPerMile: 618 },
  { finish: '4:45:00', secPerMile: 653 },
  { finish: '5:00:00', secPerMile: 687 },
  { finish: '5:15:00', secPerMile: 721 },
  { finish: '5:30:00', secPerMile: 756 },
  { finish: '6:00:00', secPerMile: 824 },
  { finish: '6:30:00', secPerMile: 893 },
];

// Goal finish times offered for each non-marathon distance (the marathon
// keeps PACE_OPTIONS above). Converted to an average pace per mile.
const FINISH_TIMES_BY_DISTANCE = {
  '5k':    ['15:00', '17:30', '20:00', '22:30', '25:00', '27:30', '30:00', '32:30', '35:00', '40:00', '45:00'],
  '10k':   ['32:00', '35:00', '40:00', '45:00', '50:00', '55:00', '1:00:00', '1:05:00', '1:10:00', '1:20:00', '1:30:00'],
  '10mi':  ['55:00', '1:05:00', '1:15:00', '1:25:00', '1:35:00', '1:45:00', '2:00:00', '2:15:00', '2:30:00'],
  'half':  ['1:15:00', '1:30:00', '1:45:00', '2:00:00', '2:15:00', '2:30:00', '2:45:00', '3:00:00'],
  '50k':   ['3:30:00', '4:00:00', '4:30:00', '5:00:00', '5:30:00', '6:00:00', '7:00:00', '8:00:00'],
  '100mi': ['18:00:00', '20:00:00', '22:00:00', '24:00:00', '27:00:00', '30:00:00', '33:00:00', '36:00:00'],
};

function parseClock(str) {
  return str.split(':').map(Number).reduce((acc, n) => acc * 60 + n, 0);
}

/** Goal-pace choices for a plan's race distance: [{ finish, secPerMile }]. */
function getPaceOptionsForPlan(plan) {
  const dist = planDistance(plan);
  if (dist.id === 'marathon') return PACE_OPTIONS;
  return (FINISH_TIMES_BY_DISTANCE[dist.id] || []).map((finish) => ({
    finish,
    secPerMile: Math.round(parseClock(finish) / dist.miles),
  }));
}

// ── Pace tag UI ───────────────────────────────────────────────────────────────

function renderPaceTags() {
  const container = document.getElementById('pace-tags');
  if (!container) return;
  container.innerHTML = selectedPaces.map((p, i) => `
    <span class="pace-tag">
      <span class="pace-tag-finish">${p.finish}</span>
      <span class="pace-tag-pace">${formatPace(p.secPerMile)}</span>
      <button class="pace-tag-remove" data-index="${i}" aria-label="Remove">×</button>
    </span>
  `).join('');
  container.querySelectorAll('.pace-tag-remove').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedPaces.splice(parseInt(btn.dataset.index, 10), 1);
      renderPaceTags();
    });
  });
}

// ── Pacing ────────────────────────────────────────────────────────────────────

function formatPace(secondsPerMile) {
  const m = Math.floor(secondsPerMile / 60);
  const s = Math.round(secondsPerMile % 60);
  return `${m}:${String(s).padStart(2, '0')} /mi`;
}

function formatTime(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.round(totalSeconds % 60);
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Suggested pace for a run type. Training paces are offsets from marathon
 * pace, so for other race distances the goal pace is first converted to an
 * equivalent marathon pace (Riegel's formula, T2 = T1 × (D2/D1)^1.06).
 * 'pace' runs are always at the goal race's own pace.
 */
function getPaceForType(type, goalPace, raceMiles = 26.2) {
  if (!goalPace) return null;
  const marathonPace = raceMiles === 26.2
    ? goalPace
    : Math.round(goalPace * Math.pow(26.2 / raceMiles, 0.06));
  switch (type) {
    case 'easy':  return marathonPace + 90;
    case 'walk':  return marathonPace + 120;
    case 'long':  return marathonPace + 60;
    case 'pace':  return goalPace;
    case 'tempo': return marathonPace - 20;
    case 'speed': return marathonPace - 45;
    default:      return null;
  }
}

/**
 * Suggested pace for one day of a plan. Days that name a race pace in their
 * source (Hal's "400s at 5K pace", tempo "near 10K pace") use that distance's
 * equivalent of the goal pace; everything else uses the run-type offsets.
 */
function planPaceForDay(plan, day, goalPace) {
  if (!goalPace) return null;
  const raceMiles = planDistance(plan).miles;
  if (day.paceAt) {
    const target = RACE_DISTANCES.find((d) => d.id === day.paceAt);
    return Math.round(goalPace * Math.pow(target.miles / raceMiles, 0.06));
  }
  return getPaceForType(day.type, goalPace, raceMiles);
}

/** Tip for a day: the source's own note, else the run-type tip ("goal race pace" outside the marathon). */
function planDayTip(plan, day) {
  if (day.note) return day.note;
  if (day.type === 'pace' && planDistance(plan).id !== 'marathon') {
    return 'Run at your goal race pace. Stay controlled and focused.';
  }
  return runTypeTip(day.type);
}

/** Text for a day in tables, calendars and event titles: the source's own label, or its mileage. */
function dayText(day) {
  return day.label || `${day.miles} mi`;
}

/** Short form for small calendar squares: miles, a duration ("45m", "3h"), or a dash. */
function dayShort(day) {
  if (day.miles > 0) return String(day.miles);
  const m = (day.label || '').match(/^(\d+(?:\.\d+)?(?:[–-]\d+)?)\s*(min|hr|h)\b/i);
  if (m) return m[1] + (/^m/i.test(m[2]) ? 'm' : 'h');
  return '—';
}

function runTypeLabel(type) {
  return {
    easy:  'Easy Run',
    walk:  'Run / Walk Intervals',
    hike:  'Hike / Walk',
    long:  'Long Run',
    pace:  'Pace Run',
    tempo: 'Tempo Run',
    speed: 'Speed / Track Workout',
    race:  'Race Day',
  }[type] || type;
}

function runTypeTip(type) {
  return {
    easy:  'Keep it comfortable and conversational — you should be able to speak in full sentences.',
    walk:  'Use Galloway run-walk intervals throughout. Suggested ratio: run 30 sec, walk 30 sec. Adjust to your fitness level.',
    long:  'Run by effort, not pace. The goal is time on feet. Walk breaks are fine.',
    pace:  'Run at your goal marathon pace. Stay controlled and focused.',
    hike:  'Time on feet at an easy, steady effort. Walk the climbs, practice fueling.',
    tempo: 'Comfortably hard — you can speak only a few words at a time. Lactate threshold effort.',
    speed: 'Warm up 1–2 mi easy. Run repeats at 5K–10K effort. Cool down 1–2 mi easy.',
    race:  'Trust your training. Start conservative, run your own race, enjoy every mile.',
    rest:  'Full rest — no running today. Prioritize sleep, hydration, and mobility work.',
    cross: 'Low-impact cross-training — swimming, cycling, or the elliptical. Keep the effort easy.',
  }[type] || '';
}

/**
 * Build the calendar event description, including the machine-readable
 * metadata tag that allows the app to reconstruct the plan on future visits.
 */
function buildDescription(day, paces, plan, raceDate, isFinalRace) {
  const { miles, type } = day;
  let body;

  if (type === 'race' && isFinalRace) {
    const paceLines = paces.map((p) => {
      const finishSec = Math.round(p.secPerMile * miles);
      return `Goal pace: ${formatPace(p.secPerMile)}  ·  Estimated finish: ${formatTime(finishSec)}`;
    }).join('\n');
    const lines = [`Race Day — ${miles} mi`];
    if (paceLines) lines.push(paceLines);
    lines.push('', runTypeTip(type));
    body = lines.join('\n');
  } else {
    const paceLines = paces.map((p) => {
      const typePace = planPaceForDay(plan, day, p.secPerMile);
      return typePace ? `Suggested pace: ${formatPace(typePace)}` : null;
    }).filter(Boolean).join('\n');
    const lines = [runTypeLabel(type)];
    if (day.label) lines.push(day.optional ? `${day.label} (optional)` : day.label);
    if (paceLines) lines.push(paceLines);
    lines.push('', planDayTip(plan, day));
    body = lines.join('\n');
  }

  // Metadata tag — parsed on future sign-ins to restore the plan. Effort-based
  // plans can have no goal pace; that's stored as 0.
  const paceList = paces.length ? paces.map((p) => p.secPerMile).join(',') : '0';
  const meta = `[marathon-planner: ${plan.id} | ${raceDate} | ${paceList}]`;
  return `${body}\n${meta}`;
}

// ── Metadata parsing ──────────────────────────────────────────────────────────

const META_RE = /\[marathon-planner:\s*([^|\]]+?)\s*\|\s*([^|\]]+?)\s*\|\s*([\d,]+)\s*\]/;

function parseEventMetadata(description = '') {
  const m = description.match(META_RE);
  if (!m) return null;
  const planId   = m[1].trim();
  const raceDate = m[2].trim();
  const plan = PLANS.find((p) => p.id === planId);
  if (!plan) return null;
  const options = getPaceOptionsForPlan(plan);
  const paces = m[3].split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((sec) => sec > 0)
    .map((sec) => options.find((o) => o.secPerMile === sec)
      || { finish: formatTime(Math.round(sec * planDistance(plan).miles)), secPerMile: sec });
  return { planId, raceDate, paces };
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function toDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

function formatDisplayDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });
}

// ── Plan → events ─────────────────────────────────────────────────────────────

function buildEvents(plan, raceDateStr, paces) {
  const TOTAL_DAYS   = plan.schedule.length * 7;
  const startDateStr = addDays(raceDateStr, -(TOTAL_DAYS - 1));
  const events = [];

  const lastWeek = plan.schedule.length - 1;
  plan.schedule.forEach((week, wi) => {
    week.forEach((day, di) => {
      if (!dayIsRun(day)) return;
      const dateStr     = addDays(startDateStr, wi * 7 + di);
      const isFinalRace = day.type === 'race' && wi === lastWeek && di === 6;
      let title;
      if (isFinalRace) {
        title = planDistance(plan).id === 'marathon'
          ? '26.2 mi — RACE DAY'
          : `${day.miles} mi — RACE DAY`;
      } else {
        title = day.optional ? `${dayText(day)} (optional)` : dayText(day);
      }
      events.push({
        date:        dateStr,
        title,
        description: buildDescription(day, paces, plan, raceDateStr, isFinalRace),
        type:        day.type,
      });
    });
  });

  return events;
}

// ── Home screen: today's plan widget ──────────────────────────────────────────

function daysBetweenStr(aStr, bStr) {
  const a = new Date(aStr + 'T00:00:00');
  const b = new Date(bStr + 'T00:00:00');
  return Math.round((b - a) / 86400000);
}

/**
 * Locates the schedule entry for a given calendar date within a plan, given
 * the plan's race date (mirrors the date math in buildEvents/renderPreview).
 */
function getPlanDayForDate(plan, raceDateStr, targetDateStr) {
  const TOTAL_DAYS   = plan.schedule.length * 7;
  const startDateStr = addDays(raceDateStr, -(TOTAL_DAYS - 1));
  const idx = daysBetweenStr(startDateStr, targetDateStr);

  if (idx < 0) return { state: 'before', startDateStr };
  if (idx >= TOTAL_DAYS) return { state: 'after' };

  const wi = Math.floor(idx / 7);
  const di = idx % 7;
  return {
    state: 'active',
    day: plan.schedule[wi][di],
    week: wi + 1,
    totalWeeks: plan.schedule.length,
    dayIndex: di,
    weekDays: plan.schedule[wi],
  };
}

const WEEK_DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const WEEK_DAY_LABELS_FULL = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
];

// Short labels for the bottom-of-square run-type tag — distinct from
// runTypeLabel()'s full-sentence versions, which are too long to fit here.
const WEEK_CAL_TYPE_LABEL = {
  rest: 'Rest', cross: 'Rest', easy: 'Easy', long: 'Long',
  pace: 'Pace', tempo: 'Tempo', speed: 'Speed', walk: 'Walk', race: 'Race',
  hike: 'Hike',
};

// Populated by renderTodayPlan() whenever there's an active scheduled week —
// lets clicking a day, or swiping to an adjacent week, re-render the hero
// above without re-deriving the plan from scratch. `weekIndex` is whichever
// week is currently displayed (starts on today's week); `todayWeekIndex` /
// `todayDayIndex` stay fixed on the real today so it can still be marked
// once the user has swiped away from it.
let todayWeekChartState = null;
// { plan, planStartDateStr, totalWeeks, todayWeekIndex, todayDayIndex,
//   todayStr, setup, weekIndex, selectedDayIndex }

/** Renders the 7-day week calendar (one square per day) for the plan's current week. `todayDayIndex` marks the real today; `selectedDayIndex` marks the day currently shown in the hero above — click a day to select it. */
function renderTodayWeekChart(weekDays, todayDayIndex, selectedDayIndex) {
  const container = document.getElementById('today-week-chart');
  const calEl      = document.getElementById('today-week-cal');
  const totalEl    = document.getElementById('today-week-total');

  const totalMiles = weekMiles(weekDays);
  totalEl.textContent = ` — ${totalMiles.toFixed(1)} mi total`;

  calEl.innerHTML = weekDays.map((d, i) => {
    const classes = ['week-cal-cell'];
    const isToday = i === todayDayIndex;
    if (isToday) classes.push('week-cal-cell-today');
    if (i === selectedDayIndex) classes.push('week-cal-cell-selected');
    const ariaCurrent = isToday ? ' aria-current="date"' : '';
    return `
      <button type="button" class="${classes.join(' ')}" data-day-index="${i}" aria-pressed="${i === selectedDayIndex}"${ariaCurrent}>
        <span class="week-cal-daylabel">${WEEK_DAY_LABELS[i]}</span>
        <span class="week-cal-miles">${dayShort(d)}</span>
        <span class="week-cal-type week-cal-type-${d.type}">${WEEK_CAL_TYPE_LABEL[d.type] || d.type}</span>
      </button>`;
  }).join('');

  calEl.querySelectorAll('.week-cal-cell').forEach((cell) => {
    cell.addEventListener('click', () => renderHeroForDay(Number(cell.dataset.dayIndex)));
  });

  container.classList.remove('hidden');
}

// Non-numeric hero states (rest/cross/before/after) show a short word in the
// hero slot rather than a mileage figure — reset to that smaller style each
// call, since the same elements are reused for numeric run days too.
function setTodayHero(text, unit, isWord) {
  const milesEl = document.getElementById('today-plan-miles');
  const unitEl  = document.getElementById('today-plan-unit');
  milesEl.textContent = text;
  unitEl.textContent  = unit;
  milesEl.classList.toggle('today-plan-hero-word', isWord);
}

/** Renders the hero mileage + run description for a given day of the currently displayed week (defaults to today; clicking a day, or swiping to another week, re-renders for that day instead). */
function renderHeroForDay(selectedIndex) {
  const ctx = todayWeekChartState;
  if (!ctx) return;
  ctx.selectedDayIndex = selectedIndex;

  const { plan, planStartDateStr, totalWeeks, todayWeekIndex, todayDayIndex, weekIndex, setup } = ctx;
  const weekDays = plan.schedule[weekIndex];
  const day      = weekDays[selectedIndex];
  const dateStr  = addDays(planStartDateStr, weekIndex * 7 + selectedIndex);
  const isToday  = weekIndex === todayWeekIndex && selectedIndex === todayDayIndex;

  document.getElementById('today-plan-label-text').textContent =
    isToday ? 'Today’s Plan' : `${WEEK_DAY_LABELS_FULL[selectedIndex]}’s Plan`;
  document.getElementById('today-plan-date-suffix').textContent = ' — ' + formatDisplayDate(dateStr);
  document.getElementById('today-plan-week').textContent = `Week ${weekIndex + 1} of ${totalWeeks}`;

  const weekStartStr = addDays(planStartDateStr, weekIndex * 7);
  const weekEndStr   = addDays(weekStartStr, 6);
  document.getElementById('today-week-label-text').textContent = weekIndex === todayWeekIndex
    ? 'This Week'
    : `${formatShortDate(weekStartStr)} – ${formatShortDate(weekEndStr)}`;
  document.getElementById('btn-back-to-today').classList.toggle('hidden', weekIndex === todayWeekIndex);
  document.getElementById('btn-prev-week').disabled = weekIndex <= 0;
  document.getElementById('btn-next-week').disabled = weekIndex >= totalWeeks - 1;

  const typeEl = document.getElementById('today-plan-type');
  const paceEl = document.getElementById('today-plan-pace');
  const tipEl  = document.getElementById('today-plan-tip');

  // Today's hero comes from Google Calendar when it's synced — the calendar
  // is what the runner actually sees and edits, so it wins over the plan.
  const calWorkouts = isToday ? getCalendarWorkoutsForDate(dateStr) : null;
  if (calWorkouts) {
    const extra = renderCalendarHero(calWorkouts);
    if (extra) document.getElementById('today-plan-week').textContent += ` · ${extra}`;
    renderTodayWeekChart(weekDays, weekIndex === todayWeekIndex ? todayDayIndex : -1, selectedIndex);
    return;
  }

  if (!dayIsRun(day)) {
    setTodayHero('REST', '', true);
    typeEl.textContent = day.label ? day.label.charAt(0).toUpperCase() + day.label.slice(1) : 'Rest Day';
  } else if (day.miles > 0) {
    setTodayHero(day.miles, 'mi', false);
    typeEl.textContent = day.label && !/^\d+(\.\d+)? mi$/.test(day.label) ? day.label : runTypeLabel(day.type);
  } else {
    const short = dayShort(day);
    if (short !== '—') setTodayHero(short.slice(0, -1), short.endsWith('m') ? 'min' : 'hr', false);
    else setTodayHero(WEEK_CAL_TYPE_LABEL[day.type].toUpperCase(), '', true);
    typeEl.textContent = day.label || runTypeLabel(day.type);
  }

  tipEl.textContent = planDayTip(plan, day);

  const typePace = dayIsRun(day) ? planPaceForDay(plan, day, setup.secPerMile) : null;
  paceEl.textContent = typePace ? formatPace(typePace) : '';

  renderTodayWeekChart(weekDays, weekIndex === todayWeekIndex ? todayDayIndex : -1, selectedIndex);
}

/** Moves the week chart to the previous (-1) or next (+1) week of the plan, keeping the same weekday selected — clamps at the plan's first/last week. Triggered by swiping on mobile. */
function changeTodayWeek(delta) {
  const ctx = todayWeekChartState;
  if (!ctx) return;
  const newWeekIndex = ctx.weekIndex + delta;
  if (newWeekIndex < 0 || newWeekIndex >= ctx.totalWeeks) return;
  ctx.weekIndex = newWeekIndex;
  renderHeroForDay(ctx.selectedDayIndex);
}

/**
 * Generic horizontal slide+fade pager — shared by the Home "This Week"
 * widget and the Current Plan month calendar so swiping, scrolling, and
 * clicking Prev/Next all read as the same motion everywhere it appears.
 *
 * `getEl` re-queries the transformed/gesture element each time (its
 * innerHTML gets rebuilt on every page change, so a cached reference would
 * go stale). `canGo(direction)` reports whether that direction is a valid
 * move (used both to clamp real navigation and to rubber-band a touch drag
 * at the ends); `go(direction)` performs the state mutation + re-render for
 * a single step.
 */
function createSlidePager({ getEl, canGo, go }) {
  let dragWidth = 300; // last-measured element width, refreshed before each gesture/jump

  function measure() {
    const el = getEl();
    if (el) dragWidth = el.getBoundingClientRect().width || dragWidth;
  }

  function setTransform(px, animate) {
    const el = getEl();
    if (!el) return;
    el.style.transition = animate
      ? 'transform 0.22s cubic-bezier(0.22, 0.8, 0.2, 1), opacity 0.22s'
      : 'none';
    el.style.transform = `translateX(${px}px)`;
    el.style.opacity   = String(Math.max(0.4, 1 - Math.abs(px) / dragWidth));
  }

  function afterTransform(onDone) {
    const el = getEl();
    if (!el) { onDone(); return; }
    el.addEventListener('transitionend', function handler(e) {
      if (e.propertyName !== 'transform') return;
      el.removeEventListener('transitionend', handler);
      onDone();
    });
  }

  function springBack() {
    setTransform(0, true);
  }

  // Slides the current content fully out, applies `mutateFn` (updates
  // state and rebuilds the element's contents), then slides the new
  // content in from the opposite edge — the same "exit, reposition, enter"
  // sequence native calendar apps use for paging.
  function animateSwap(direction, mutateFn) {
    measure();
    const el = getEl();
    setTransform(-direction * dragWidth, true);
    afterTransform(() => {
      mutateFn();
      setTransform(direction * dragWidth, false);
      if (el) void el.offsetWidth; // force reflow so the instant position commits before animating
      setTransform(0, true);
    });
  }

  function slide(direction) {
    if (!canGo(direction)) { springBack(); return; }
    animateSwap(direction, () => go(direction));
  }

  // Touch: the content tracks the finger 1:1 while dragging (direct
  // manipulation reads as far more "swipeable" than static content that
  // only reacts on release), resists at either end like a native scroll
  // bounce, and on release either completes the swipe or springs back.
  function attachTouch(gestureEl) {
    const SWIPE_THRESHOLD = 40; // px of horizontal travel to count as a committed swipe
    const DIRECTION_LOCK  = 10; // px of travel before committing to h-swipe vs v-scroll
    let startX = 0, startY = 0, tracking = false, decided = false, isHorizontal = false, dragDx = 0;

    gestureEl.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      measure();
      tracking = true;
      decided = false;
      isHorizontal = false;
      dragDx = 0;
    }, { passive: true });

    gestureEl.addEventListener('touchmove', (e) => {
      if (!tracking || e.touches.length !== 1) return;
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;

      if (!decided) {
        if (Math.abs(dx) < DIRECTION_LOCK && Math.abs(dy) < DIRECTION_LOCK) return;
        decided = true;
        isHorizontal = Math.abs(dx) > Math.abs(dy);
      }
      if (!isHorizontal) return;

      // Once committed to a horizontal swipe, stop the page from also
      // scrolling vertically underneath the gesture.
      if (e.cancelable) e.preventDefault();

      const atStart = !canGo(-1) && dx > 0;
      const atEnd   = !canGo(1) && dx < 0;
      dragDx = (atStart || atEnd) ? dx * 0.35 : dx; // rubber-band resistance at either end
      setTransform(dragDx, false);
    }, { passive: false });

    gestureEl.addEventListener('touchend', () => {
      if (!tracking) return;
      tracking = false;
      if (!isHorizontal) return;
      if (Math.abs(dragDx) >= SWIPE_THRESHOLD) slide(dragDx < 0 ? 1 : -1);
      else springBack();
    });

    gestureEl.addEventListener('touchcancel', () => {
      if (tracking && isHorizontal) springBack();
      tracking = false;
    });
  }

  // Wheel: desktop trackpad horizontal-swipe / shift+wheel paging. Only
  // claims genuinely horizontal deltas (deltaX > deltaY) — plain vertical
  // wheel/trackpad motion is left completely alone (no preventDefault) so
  // the page underneath keeps scrolling smoothly no matter where the
  // cursor sits over the calendar. Accumulates delta so a single physical
  // gesture doesn't overshoot, and cools down after each page change so a
  // continuous fling pages once per gesture instead of firing repeatedly
  // while its own animation is still running.
  function attachWheel(gestureEl) {
    const WHEEL_THRESHOLD = 50;
    let acc = 0;
    let cooling = false;

    gestureEl.addEventListener('wheel', (e) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return; // vertical — let the page scroll
      e.preventDefault();
      if (cooling) return;
      acc += e.deltaX;
      if (Math.abs(acc) < WHEEL_THRESHOLD) return;
      const direction = acc > 0 ? 1 : -1;
      acc = 0;
      cooling = true;
      slide(direction);
      setTimeout(() => { cooling = false; }, 450); // outlasts the ~0.44s exit+enter animation
    }, { passive: false });
  }

  return { slide, animateSwap, attachTouch, attachWheel };
}

const todayWeekPager = createSlidePager({
  getEl: () => document.getElementById('today-week-cal'),
  canGo: (direction) => {
    const ctx = todayWeekChartState;
    return !!ctx && ctx.weekIndex + direction >= 0 && ctx.weekIndex + direction < ctx.totalWeeks;
  },
  go: (direction) => changeTodayWeek(direction),
});

function slideToWeek(direction) {
  todayWeekPager.slide(direction);
}

/** Jumps the week chart back to today's week/day, sliding in from whichever side today lies on. Wired to the "Back to Today" link, which only shows once the user has swiped to another week. */
function jumpToTodayWeek() {
  const ctx = todayWeekChartState;
  if (!ctx || ctx.weekIndex === ctx.todayWeekIndex) return;
  const direction = ctx.weekIndex > ctx.todayWeekIndex ? -1 : 1;
  todayWeekPager.animateSwap(direction, () => {
    ctx.weekIndex = ctx.todayWeekIndex;
    renderHeroForDay(ctx.todayDayIndex);
  });
}

// Swipe-to-change-week for touch devices (phone/tablet) — attached once to
// the week-cal container, which persists across renderTodayWeekChart()
// re-renders since only its innerHTML (the day cells) is replaced. Desktop
// gets Prev/Next buttons instead (wired in the bootstrap section below).
function initTodayWeekSwipe() {
  const calEl = document.getElementById('today-week-cal');
  if (calEl) todayWeekPager.attachTouch(calEl);
}

// Reads the currently-configured default plan (if any) and, if there's an
// active scheduled run today, maps its run type to the heat calculator's
// intensity buckets — used by the Current Conditions risk chart so its
// pace-adjustment reflects today's actual workout instead of a neutral read.
function runTypeToIntensity(type) {
  switch (type) {
    case 'race':                    return 'race';
    case 'tempo': case 'speed': case 'pace': return 'workout';
    case 'easy':  case 'long':  case 'walk': case 'hike': return 'easy';
    default:                        return ''; // rest, cross
  }
}

function getTodayRunIntensity() {
  const calWorkouts = getCalendarWorkoutsForDate(toDateStr(new Date()));
  if (calWorkouts) {
    if (!calWorkouts.length) return '';
    const w = pickCalendarWorkout(calWorkouts);
    // A distance with no recognisable type is most likely an easy run.
    return w.runType ? runTypeToIntensity(w.runType) : (w.isWorkout ? 'easy' : '');
  }

  const choice = localStorage.getItem(STORAGE_DEFAULT_PLAN_CHOICE);
  if (!choice || choice === 'skip') return '';

  const plan     = PLANS.find((p) => p.id === choice);
  const setupRaw = localStorage.getItem(STORAGE_DEFAULT_PLAN_SETUP);
  const setup    = setupRaw ? JSON.parse(setupRaw) : null;
  if (!plan || !setup || !setup.raceDate) return '';

  const result = getPlanDayForDate(plan, setup.raceDate, toDateStr(new Date()));
  if (result.state !== 'active') return '';
  return runTypeToIntensity(result.day.type);
}

// ── Home screen: today's workout from Google Calendar ─────────────────────────

const CAL_SYNC_DAYS_BACK  = 7;
const CAL_SYNC_DAYS_AHEAD = 15;

let homeCalendarSyncing  = false;
let homeCalendarError    = '';
let homeCalendarPickerOn = false; // signed in from Home with no calendar linked yet

/** True when Home reads a public training calendar via API key (config.js) — no sign-in involved. */
function usesPublicTrainingCalendar() {
  return !!(CONFIG.trainingCalendarId && CONFIG.googleApiKey);
}

/** The calendar Home reads today's workout from. */
function getLinkedCalendarId() {
  return usesPublicTrainingCalendar()
    ? CONFIG.trainingCalendarId
    : localStorage.getItem(STORAGE_CALENDAR);
}

function getCalendarWorkoutsCache() {
  const linked = getLinkedCalendarId();
  if (!linked) return null;
  try {
    const cache = JSON.parse(localStorage.getItem(STORAGE_CAL_WORKOUTS) || 'null');
    return cache && cache.calendarId === linked && cache.byDate ? cache : null;
  } catch {
    return null;
  }
}

/** True when the synced calendar has anything scheduled today or later (within the synced window). */
function hasUpcomingCalendarWorkouts() {
  const cache = getCalendarWorkoutsCache();
  if (!cache) return false;
  const todayStr = toDateStr(new Date());
  return Object.keys(cache.byDate).some((d) => d >= todayStr && cache.byDate[d].length);
}

/** Calendar events for a date — `null` if the last sync didn't cover that date, `[]` if it did and nothing was scheduled. */
function getCalendarWorkoutsForDate(dateStr) {
  const cache = getCalendarWorkoutsCache();
  if (!cache || dateStr < cache.from || dateStr >= cache.to) return null;
  return cache.byDate[dateStr] || [];
}

/** Local dates an event falls on. All-day events can span several days (end date is exclusive). */
function calendarEventDates(ev) {
  if (ev.start && ev.start.date) {
    const dates = [];
    const end = (ev.end && ev.end.date) || addDays(ev.start.date, 1);
    for (let d = ev.start.date; d < end && dates.length < 31; d = addDays(d, 1)) dates.push(d);
    return dates;
  }
  if (ev.start && ev.start.dateTime) return [toDateStr(new Date(ev.start.dateTime))];
  return [];
}

async function refreshCalendarWorkouts() {
  const calendarId = getLinkedCalendarId();
  const isPublic   = usesPublicTrainingCalendar();
  if (!calendarId || homeCalendarSyncing) return;
  if (!isPublic && !CalendarAPI.isSignedIn()) return;

  homeCalendarSyncing = true;
  homeCalendarError   = '';
  renderTodayPlan();

  try {
    const todayStr = toDateStr(new Date());
    const from = addDays(todayStr, -CAL_SYNC_DAYS_BACK);
    const to   = addDays(todayStr, CAL_SYNC_DAYS_AHEAD);
    const events = isPublic
      ? await CalendarAPI.listPublicEventsInRange(calendarId, CONFIG.googleApiKey, from, to)
      : await CalendarAPI.listEventsInRange(calendarId, from, to);

    const byDate = {};
    events.forEach((ev) => {
      if (ev.status === 'cancelled') return;
      calendarEventDates(ev).forEach((d) => {
        if (d < from || d >= to) return;
        (byDate[d] = byDate[d] || []).push({
          title:       ev.summary || '',
          description: ev.description || '',
        });
      });
    });

    localStorage.setItem(STORAGE_CAL_WORKOUTS, JSON.stringify({
      calendarId, fetchedAt: Date.now(), from, to, byDate,
    }));
  } catch (err) {
    console.warn('Could not sync Google Calendar:', err.message);
    homeCalendarError = /sign-in|signed in|401/i.test(err.message)
      ? 'Google sign-in expired.'
      : 'Couldn’t reach Google Calendar.';
  } finally {
    homeCalendarSyncing = false;
    renderTodayPlan();
  }
}

const CAL_AUTO_SYNC_MIN_AGE_MS = 5 * 60 * 1000;

/** Syncs without any user action whenever a Google token from an earlier sign-in is still valid (and the last sync is a few minutes old). */
function autoSyncCalendarWorkouts() {
  if (!getLinkedCalendarId()) return;
  if (!usesPublicTrainingCalendar() && !CalendarAPI.isSignedIn()) return;
  const cache = getCalendarWorkoutsCache();
  if (cache && Date.now() - cache.fetchedAt < CAL_AUTO_SYNC_MIN_AGE_MS) return;
  refreshCalendarWorkouts();
}

/** Home's Sync/Connect button — reuses this session's Google token if there is one, otherwise opens the Google sign-in popup. */
function onHomeCalendarSync() {
  if (usesPublicTrainingCalendar()) {
    refreshCalendarWorkouts();
    return;
  }
  if (CalendarAPI.isSignedIn()) {
    if (getLinkedCalendarId()) refreshCalendarWorkouts();
    else showHomeCalendarPicker();
    return;
  }
  if (typeof google === 'undefined' || !google.accounts) {
    homeCalendarError = 'Google sign-in is still loading — try again in a moment.';
    renderTodayPlan();
    return;
  }
  homeCalendarError = '';
  CalendarAPI.init(CONFIG.googleClientId, onHomeSignedIn);
  CalendarAPI.signIn();
}

function onHomeSignedIn() {
  if (getLinkedCalendarId()) refreshCalendarWorkouts();
  else showHomeCalendarPicker();
}

/** No calendar linked yet — let the user pick their training calendar right on Home. */
async function showHomeCalendarPicker() {
  const sel = document.getElementById('today-cal-select');
  try {
    const calendars = await CalendarAPI.listCalendars();
    sel.innerHTML = '<option value="">Choose your training calendar…</option>';
    calendars.forEach((cal) => {
      const opt = document.createElement('option');
      opt.value = cal.id;
      opt.textContent = cal.summary + (cal.primary ? ' (primary)' : '');
      sel.appendChild(opt);
    });
    homeCalendarPickerOn = true;
    homeCalendarError    = '';
  } catch (err) {
    console.warn('Could not list calendars:', err.message);
    homeCalendarError = 'Couldn’t load your calendars.';
  }
  renderTodayPlan();
}

function formatSyncTime(ts) {
  const d    = new Date(ts);
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return toDateStr(d) === toDateStr(new Date())
    ? time
    : `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}, ${time}`;
}

function renderCalendarSyncRow() {
  const statusEl = document.getElementById('today-cal-sync-status');
  const btn      = document.getElementById('btn-today-cal-sync');
  const sel      = document.getElementById('today-cal-select');
  const linked   = getLinkedCalendarId();
  const cache    = getCalendarWorkoutsCache();

  sel.classList.toggle('hidden', !(homeCalendarPickerOn && !linked));
  btn.classList.remove('hidden');

  if (homeCalendarSyncing) {
    statusEl.textContent = 'Syncing with Google Calendar…';
    btn.classList.add('hidden');
  } else if (!linked && homeCalendarPickerOn) {
    statusEl.textContent = homeCalendarError || 'Which calendar are your runs on?';
    btn.classList.add('hidden');
  } else if (homeCalendarError) {
    statusEl.textContent = homeCalendarError;
    btn.textContent = 'Try again';
  } else if (!linked) {
    statusEl.textContent = 'See today’s workout from your Google Calendar.';
    btn.textContent = 'Connect';
  } else if (cache) {
    statusEl.textContent = `Synced from Google Calendar · ${formatSyncTime(cache.fetchedAt)}`;
    btn.textContent = 'Refresh';
  } else {
    statusEl.textContent = 'Load today’s workout from Google Calendar.';
    btn.textContent = 'Sync';
  }
}

/** Google Calendar descriptions edited on the web can contain HTML — reduce to plain text lines. */
function calendarDescriptionToText(desc = '') {
  if (!/<[a-z][\s\S]*>/i.test(desc)) return desc;
  const withBreaks = desc.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li)>/gi, '\n');
  return new DOMParser().parseFromString(withBreaks, 'text/html').body.textContent || '';
}

const CAL_DISTANCE_RE = /(\d+(?:\.\d+)?)\s*(mi|miles?|km|k)\b/i;

/** Turns a calendar event (one this app created, or one the user typed in) into the pieces of the Home hero. */
function parseCalendarWorkout(ev) {
  const title  = (ev.title || '').trim();
  const text   = calendarDescriptionToText(ev.description).replace(META_RE, '');
  const tagged = META_RE.test(ev.description || '');
  const lines  = text.split('\n').map((l) => l.trim()).filter(Boolean);

  // Run type — this app writes the run-type label as the first description line.
  const typeByLabel = {};
  ['easy', 'walk', 'hike', 'long', 'pace', 'tempo', 'speed', 'race'].forEach((t) => {
    typeByLabel[runTypeLabel(t).toLowerCase()] = t;
  });
  let runType = '';
  let typeLine = '';
  if (tagged && lines.length) {
    typeLine = lines[0];
    runType  = typeByLabel[typeLine.toLowerCase()] || (/^race day/i.test(typeLine) ? 'race' : '');
    if (runType === 'race') typeLine = runTypeLabel('race');
  }
  if (!runType) {
    if (/race/i.test(title)) runType = 'race';
    else if (/\b(rest|off)\b/i.test(title)) runType = 'rest';
    else {
      const hit = Object.keys(typeByLabel).find((t) => typeByLabel[t] !== 'race' && new RegExp(`\\b${typeByLabel[t]}\\b`, 'i').test(title));
      if (hit) runType = typeByLabel[hit];
    }
  }

  const paceLines = lines.filter((l) => /^(suggested|goal) pace:/i.test(l));
  const pace = paceLines.map((l) => l.replace(/^suggested pace:\s*/i, '')).join(' · ');
  const tip  = lines.filter((l, i) => !(tagged && i === 0) && !paceLines.includes(l)).join(' ');

  const dist = title.match(CAL_DISTANCE_RE);
  let hero, unit = '', isWord = true, type;
  if (dist) {
    hero   = dist[1];
    unit   = /^k/i.test(dist[2]) ? 'km' : 'mi';
    isWord = false;
    const rest = title
      .replace(CAL_DISTANCE_RE, '')
      .replace(/^\s*(run|workout)\s*:\s*/i, '')   // "Run: 6 mi …" prefix
      .replace(/^[\s—–-]+|[\s—–-]+$/g, '')
      .replace(/\s{2,}/g, ' ');
    // "5 mi easy" / "6 mi LONG RUN" → "Easy Run" / "Long Run"; anything more
    // descriptive is kept as typed ("4 mi + 4 strides" → "Run + 4 strides").
    const restLower = rest.toLowerCase();
    const restIsJustType = runType &&
      (restLower === runType || restLower === `${runType} run` || restLower === runTypeLabel(runType).toLowerCase());
    if (typeLine) type = typeLine;
    else if (rest && !restIsJustType) type = /^(\+|w\/|with\b)/i.test(rest) ? `Run ${rest}` : rest;
    else type = runType ? runTypeLabel(runType) : 'Scheduled Run';
  } else if (runType === 'rest') {
    hero = 'REST';
    type = typeLine || title;
  } else {
    hero = title && title.length <= 9 ? title.toUpperCase() : 'WORKOUT';
    type = typeLine || (title.length > 9 ? title : '');
  }

  return {
    hero, unit, isWord, type, pace, runType,
    tip: tip || (runType ? runTypeTip(runType) : ''),
    isWorkout: !!dist || tagged || !!runType,
  };
}

/** Picks the event that looks most like a workout when several share a day. */
function pickCalendarWorkout(events) {
  const parsed = events.map(parseCalendarWorkout);
  const idx = parsed.findIndex((w) => w.isWorkout);
  return parsed[idx >= 0 ? idx : 0];
}

/** Fills the Home hero from today's calendar events. Returns a short note to show next to the week label (e.g. "+1 more on calendar"). */
function renderCalendarHero(events) {
  const typeEl = document.getElementById('today-plan-type');
  const paceEl = document.getElementById('today-plan-pace');
  const tipEl  = document.getElementById('today-plan-tip');

  if (!events.length) {
    setTodayHero('REST', '', true);
    typeEl.textContent = 'Nothing on your calendar today';
    paceEl.textContent = '';
    tipEl.textContent  = runTypeTip('rest');
    return '';
  }

  const w = pickCalendarWorkout(events);
  setTodayHero(w.hero, w.unit, w.isWord);
  typeEl.textContent = w.type;
  paceEl.textContent = w.pace;
  tipEl.textContent  = w.tip;
  return events.length > 1 ? `+${events.length - 1} more on calendar` : '';
}

function renderTodayPlan() {
  const chooser  = document.getElementById('default-plan-chooser');
  const widget   = document.getElementById('today-plan');
  const skipLink = document.getElementById('show-default-plan-link');
  let   choice   = localStorage.getItem(STORAGE_DEFAULT_PLAN_CHOICE);

  updateCurrentPlanNav();

  let plan  = null;
  let setup = null;
  if (choice && choice !== 'skip') {
    plan = PLANS.find((p) => p.id === choice);
    const setupRaw = localStorage.getItem(STORAGE_DEFAULT_PLAN_SETUP);
    setup = setupRaw ? JSON.parse(setupRaw) : null;
    if (!plan || !setup || !setup.raceDate) {
      // Corrupted/missing local storage — reset back to the chooser.
      localStorage.removeItem(STORAGE_DEFAULT_PLAN_CHOICE);
      localStorage.removeItem(STORAGE_DEFAULT_PLAN_SETUP);
      choice = null;
      plan   = null;
      setup  = null;
    }
  }

  // The widget shows whenever there's a default plan OR a Google Calendar to
  // read today's workout from — so Home still shows today's run with no plan
  // chosen, before a plan starts, or after it's over.
  const calendarOn = !!getLinkedCalendarId() || CalendarAPI.isSignedIn();
  const showWidget = !!plan || calendarOn;

  // The "Select Default Marathon Plan" prompt is only useful when there's
  // nothing else to show — skip it while the connected calendar has runs
  // coming up (and during the first sync, so it doesn't flash in and out).
  const calendarCovered = hasUpcomingCalendarWorkouts() ||
    (homeCalendarSyncing && !getCalendarWorkoutsCache());
  chooser.classList.toggle('hidden', !!choice || calendarCovered);
  skipLink.classList.toggle('hidden', choice !== 'skip');
  document.getElementById('btn-today-cal-connect').classList.toggle('hidden', calendarOn);
  widget.classList.toggle('hidden', !showWidget);
  todayWeekChartState = null;
  if (!showWidget) return;

  document.getElementById('btn-goto-settings').classList.toggle('hidden', !plan);
  renderCalendarSyncRow();

  const todayStr    = toDateStr(new Date());
  const calWorkouts = getCalendarWorkoutsForDate(todayStr);
  const result      = plan ? getPlanDayForDate(plan, setup.raceDate, todayStr) : null;

  const typeEl  = document.getElementById('today-plan-type');
  const paceEl  = document.getElementById('today-plan-pace');
  const weekEl  = document.getElementById('today-plan-week');
  const tipEl   = document.getElementById('today-plan-tip');
  const weekChartEl = document.getElementById('today-week-chart');

  document.getElementById('today-plan-label-text').textContent = 'Today’s Plan';
  document.getElementById('today-plan-date-suffix').textContent = ' — ' + formatDisplayDate(todayStr);

  if (result && result.state === 'active') {
    const { totalWeeks, dayIndex } = result;
    const TOTAL_DAYS       = plan.schedule.length * 7;
    const planStartDateStr = addDays(setup.raceDate, -(TOTAL_DAYS - 1));

    todayWeekChartState = {
      plan, planStartDateStr, totalWeeks,
      todayWeekIndex: result.week - 1, todayDayIndex: dayIndex,
      todayStr, setup,
      weekIndex: result.week - 1, selectedDayIndex: dayIndex,
    };
    renderHeroForDay(dayIndex);
    return;
  }

  weekChartEl.classList.add('hidden');

  // Plan status (if any) goes in the small meta line when the calendar is
  // driving the hero, or takes over the hero itself when it isn't.
  let planNote = '';
  if (result && result.state === 'before') planNote = `${plan.name} starts ${formatDisplayDate(result.startDateStr)}`;
  if (result && result.state === 'after')  planNote = `${plan.name} complete`;

  if (calWorkouts) {
    const extra = renderCalendarHero(calWorkouts);
    weekEl.textContent = [planNote, extra].filter(Boolean).join(' · ');
    return;
  }

  paceEl.textContent = '';
  weekEl.textContent = '';
  tipEl.textContent  = '';

  if (result && result.state === 'before') {
    setTodayHero('SOON', '', true);
    typeEl.textContent = planNote;
  } else if (result && result.state === 'after') {
    setTodayHero('DONE', '', true);
    typeEl.textContent = 'Race complete — nice work!';
  } else {
    setTodayHero('—', '', true);
    typeEl.textContent = homeCalendarSyncing ? 'Loading today’s workout…' : 'No workout loaded yet';
  }
}

// ── Current Plan page ─────────────────────────────────────────────────────────

let currentPlanCalMonth = null; // Date (first-of-month currently anchored/scrolled to)
let currentPlanScrollInitialized = false; // whether the one-time scroll-to-anchor has run
let currentPlanViewMode = localStorage.getItem(STORAGE_CURRENTPLAN_VIEW) || 'calendar'; // 'calendar' | 'list'

function formatShortDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function renderCurrentPlan() {
  const config = getCurrentPlanConfig();
  if (!config) return; // switchTab() already redirects away when this happens

  const plan = PLANS.find((p) => p.id === config.planId);
  if (!plan) return;

  const TOTAL_DAYS   = plan.schedule.length * 7;
  const startDateStr = addDays(config.raceDate, -(TOTAL_DAYS - 1));
  const totalMiles   = plan.schedule.reduce((s, w) => s + weekMiles(w), 0);

  const summaryEntries = [
    ['Plan',        plan.name],
    ['Race Date',   formatDisplayDate(config.raceDate)],
    ['Plan Start',  formatDisplayDate(startDateStr)],
    ['Total Miles', planHasEstimates(plan) ? `~${Math.round(totalMiles)} mi` : totalMiles.toFixed(1) + ' mi'],
  ];
  if (config.secPerMile) summaryEntries.splice(3, 0, ['Goal Pace', formatPace(config.secPerMile)]);
  document.getElementById('currentplan-summary').innerHTML = buildSummaryRowsHtml(summaryEntries);

  document.getElementById('currentplan-list').innerHTML =
    buildPlanTableHtml(plan, config.secPerMile, true, getListWeekStart());

  const todayStr = toDateStr(new Date());
  if (!currentPlanCalMonth) {
    // Default to today's month if the plan is currently active, otherwise
    // whichever end of the plan is closer to now — never an empty month.
    let anchorStr = todayStr;
    if (todayStr < startDateStr) anchorStr = startDateStr;
    if (todayStr > config.raceDate) anchorStr = config.raceDate;
    const anchor = new Date(anchorStr + 'T00:00:00');
    currentPlanCalMonth = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  }

  renderCurrentPlanCalendar(plan, startDateStr, config.raceDate, todayStr, getCalWeekStart());
  updateCurrentPlanCalNav();

  // Scrolls to the anchor month exactly once, deferred until the tab is
  // actually visible — this can also run while hidden (e.g. a Settings
  // change before Current Plan has ever been opened), and scrollIntoView is
  // a silent no-op on display:none content, so we wait rather than burn the
  // one-time flag on a scroll that didn't actually happen. After it fires
  // once, the list keeps whatever scroll position the user's left it at —
  // matches how the old paged view remembered currentPlanCalMonth across
  // tab switches instead of resetting it every time.
  if (!currentPlanScrollInitialized && !document.getElementById('currentplan-view').classList.contains('hidden')) {
    currentPlanScrollInitialized = true;
    scrollToCurrentPlanMonth(currentPlanCalMonth, false);
  }
}

/** Prev/Next click handler — steps the anchor month and smooth-scrolls its sticky header into view. */
function stepCurrentPlanMonth(direction) {
  if (!currentPlanCalMonth) return;
  const btn = document.getElementById(direction < 0 ? 'currentplan-cal-prev' : 'currentplan-cal-next');
  if (btn && btn.disabled) return;
  currentPlanCalMonth = new Date(currentPlanCalMonth.getFullYear(), currentPlanCalMonth.getMonth() + direction, 1);
  updateCurrentPlanCalNav();
  scrollToCurrentPlanMonth(currentPlanCalMonth, true);
}

function scrollToCurrentPlanMonth(monthDate, smooth) {
  const key    = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
  const header = document.getElementById(`cp-month-${key}`);
  if (header) header.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
}

/** Enables/disables Prev/Next based on currentPlanCalMonth vs. the plan's actual date range. Self-contained (re-derives the plan) so it can be called from the scroll tracker without threading extra state through. */
function updateCurrentPlanCalNav() {
  const config = getCurrentPlanConfig();
  if (!config || !currentPlanCalMonth) return;
  const plan = PLANS.find((p) => p.id === config.planId);
  if (!plan) return;
  const startDateStr = addDays(config.raceDate, -(plan.schedule.length * 7 - 1));
  const thisMonthStr = `${currentPlanCalMonth.getFullYear()}-${String(currentPlanCalMonth.getMonth() + 1).padStart(2, '0')}`;
  document.getElementById('currentplan-cal-prev').disabled = thisMonthStr <= startDateStr.slice(0, 7);
  document.getElementById('currentplan-cal-next').disabled = thisMonthStr >= config.raceDate.slice(0, 7);
}

// Keeps currentPlanCalMonth in sync with whatever month is actually
// scrolled into view (sticky headers make this the visually "current" one
// at all times), so Prev/Next always step relative to where the user
// actually is — not wherever they last clicked to — even after a manual
// scroll, swipe, or trackpad gesture.
function initCurrentPlanMonthScrollTracking() {
  const weeksEl = document.getElementById('currentplan-weeks');
  if (!weeksEl) return;
  let queued = false;

  function sync() {
    queued = false;
    if (currentPlanViewMode !== 'calendar') return;
    if (document.getElementById('currentplan-view').classList.contains('hidden')) return;
    const headers = weeksEl.querySelectorAll('.cp-month-header');
    if (!headers.length) return;
    const areaTop = weeksEl.getBoundingClientRect().top;
    let active = headers[0];
    headers.forEach((h) => {
      if (h.getBoundingClientRect().top <= areaTop + 44) active = h;
    });
    const [y, m] = active.id.replace('cp-month-', '').split('-').map(Number);
    currentPlanCalMonth = new Date(y, m - 1, 1);
    updateCurrentPlanCalNav();
  }

  // .currentplan-weeks is its own bounded, overflow-y:auto pane (roughly
  // one month tall) rather than part of the page's overall scroll, so the
  // scroll event fires here directly, not on .scroll-area.
  weeksEl.addEventListener('scroll', () => {
    if (!queued) { queued = true; requestAnimationFrame(sync); }
  }, { passive: true });
}

/**
 * Current Plan's calendar view: the entire plan as one continuously
 * scrollable list of week-rows, with a sticky month-header divider
 * wherever a row crosses into a new month — native scroll (touch, wheel,
 * trackpad, scrollbar) is what moves you through past/future months, no
 * custom paging/gesture code involved. Week-start is a user preference
 * (Settings) — the plan's own week structure is always Monday–Sunday
 * internally (schedule day-index 0 = Monday, race always a Sunday), so a
 * Sunday-first calendar row doesn't align 1:1 with one plan week the way a
 * Monday-first row does — it spans the tail of one plan week (its Sunday)
 * plus the start of the next (Monday–Saturday). Rather than track a row →
 * plan-week correspondence, this looks up each day individually by date
 * and sums whatever 7 real dates are shown for that row's total — a
 * "calendar week" total, which is what a Sunday-first grid actually
 * implies (and reduces to the same thing as a "plan week" total when
 * Monday-first, since the two align in that case). The row label names
 * whichever plan week owns most of the row (via its Monday) — and that
 * same Monday decides which month "owns" the row for the header divider.
 */
function renderCurrentPlanCalendar(plan, startDateStr, raceDateStr, todayStr, weekStartsOn) {
  const totalWeeks = plan.schedule.length;
  const startsOnSunday = weekStartsOn === 'sunday';

  document.getElementById('currentplan-cal-weekday-labels').innerHTML =
    WEEK_DAY_LABELS_BY_START[weekStartsOn].map((d) => `<span>${d}</span>`).join('');

  // Flat date → day lookup, independent of week/row alignment.
  const dayByDate = {};
  plan.schedule.forEach((week, wi) => {
    week.forEach((day, di) => {
      dayByDate[addDays(startDateStr, wi * 7 + di)] = day;
    });
  });

  // JS Date.getDay() is Sunday-indexed (0=Sun..6=Sat); convert to
  // Monday-indexed (0=Mon..6=Sun) when the grid starts on Monday instead.
  const weekdayOffset = (date) => startsOnSunday ? date.getDay() : (date.getDay() + 6) % 7;

  const firstOfPlan = new Date(startDateStr + 'T00:00:00');
  const gridStartDateStr = addDays(startDateStr, -weekdayOffset(firstOfPlan));

  const lastOfPlan = new Date(raceDateStr + 'T00:00:00');
  const gridEndDateStr = addDays(raceDateStr, 6 - weekdayOffset(lastOfPlan));

  const numRows = Math.round(daysBetweenStr(gridStartDateStr, gridEndDateStr) / 7) + 1;

  // Monday's offset within a row: 0 when the grid starts on Monday, 1 when
  // it starts on Sunday (Sunday leads, then Monday).
  const mondayOffsetInRow = startsOnSunday ? 1 : 0;

  let lastMonthKey = null;
  const rows = [];
  for (let r = 0; r < numRows; r++) {
    const weekStartDateStr = addDays(gridStartDateStr, r * 7);
    const weekEndDateStr   = addDays(weekStartDateStr, 6);
    const containsToday    = todayStr >= weekStartDateStr && todayStr <= weekEndDateStr;
    const mondayDateStr    = addDays(weekStartDateStr, mondayOffsetInRow);

    const monthKey = mondayDateStr.slice(0, 7);
    if (monthKey !== lastMonthKey) {
      lastMonthKey = monthKey;
      const monthLabel = new Date(mondayDateStr + 'T00:00:00')
        .toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
      rows.push(`<div class="cp-month-header" id="cp-month-${monthKey}">${monthLabel}</div>`);
    }

    // Whichever plan week owns the Monday within this row, for the "Wk N" label.
    const mondayIdx = daysBetweenStr(startDateStr, mondayDateStr);
    const weekIdx = (mondayIdx >= 0 && mondayIdx % 7 === 0 && mondayIdx / 7 < totalWeeks) ? mondayIdx / 7 : null;

    let weekTotal = 0;
    let hasAnyData = false;
    const dayCells = [];
    for (let di = 0; di < 7; di++) {
      const dateStr    = addDays(weekStartDateStr, di);
      const dayNum     = parseInt(dateStr.slice(8, 10), 10);
      const day        = dayByDate[dateStr] || null;
      const todayClass = dateStr === todayStr ? ' week-cal-cell-today' : '';

      if (day) { weekTotal += dayCountedMiles(day); hasAnyData = true; }

      dayCells.push(day
        ? `<div class="week-cal-cell${todayClass}">
             <span class="week-cal-daylabel">${dayNum}</span>
             <span class="week-cal-miles">${dayShort(day)}</span>
             <span class="week-cal-type week-cal-type-${day.type}">${WEEK_CAL_TYPE_LABEL[day.type] || day.type}</span>
           </div>`
        : `<div class="week-cal-cell week-cal-cell-empty">
             <span class="week-cal-daylabel">${dayNum}</span>
           </div>`);
    }

    rows.push(`
      <div class="cp-week-row${containsToday ? ' cp-week-row-current' : ''}">
        <div class="cp-week-label">
          <span class="cp-week-num">${weekIdx !== null ? `Wk ${weekIdx + 1}` : '—'}</span>
          <span class="cp-week-dates">${formatShortDate(weekStartDateStr)}–${formatShortDate(weekEndDateStr)}</span>
        </div>
        <div class="cp-week-days">${dayCells.join('')}</div>
        <div class="cp-week-total">${hasAnyData ? weekTotal.toFixed(1) + ' mi' : '—'}</div>
      </div>`);
  }
  document.getElementById('currentplan-weeks').innerHTML = rows.join('');
}

// ── Calendar search & restore ─────────────────────────────────────────────────

/**
 * Search the given calendar for existing marathon-planner events.
 * If found, parse config from the metadata tag, reconstruct the preview,
 * and return true. Returns false if no plan is found.
 */
async function searchExistingPlan(calendarId) {
  showLoadingOverlay('Checking calendar for existing plan…');
  try {
    const events = await CalendarAPI.searchMarathonEvents(calendarId);
    hideLoadingOverlay();

    if (!events.length) return false;

    // Parse config from the first event that carries the metadata tag.
    let config = null;
    for (const ev of events) {
      config = parseEventMetadata(ev.description);
      if (config) break;
    }
    if (!config) return false;

    const plan = PLANS.find((p) => p.id === config.planId);
    if (!plan) return false;

    saveCurrentPlan(config.planId, config.raceDate, config.paces.length ? config.paces[0].secPerMile : null);
    updateCurrentPlanNav();

    // Store event IDs in memory for potential deletion this session.
    savedCalendarId = calendarId;
    savedEventIds   = events.map((ev) => ev.id);

    // Sync form fields so "Back" works correctly.
    document.getElementById('race-date').value   = config.raceDate;
    document.getElementById('goal-pace').value   = '';
    document.getElementById('race-date-auto').checked = false; // keep the calendar's own race date
    setBuildFormPlan(config.planId);
    selectedPaces = config.paces;
    renderPaceTags();

    // Render preview.
    selectedEvents = buildEvents(plan, config.raceDate, config.paces);
    renderPreview(plan, config.raceDate, config.paces, true);
    updateClearButton();
    showStep('step-preview');
    return true;

  } catch (err) {
    hideLoadingOverlay();
    console.warn('Could not search calendar:', err.message);
    return false;
  }
}

// ── Plans guide metadata ──────────────────────────────────────────────────────

const PLAN_META = {
  'hal-5k-novice': {
    level:    'beginner',
    bestFor:  'New runners, or anyone who wants a low-mileage build to a first 5K.',
    approach: 'Three short runs a week at a conversational pace, a weekly walk that grows from 30 to 60 minutes, and optional run/walk days. The longest run is 3 miles.',
  },
  'hal-5k-intermediate': {
    level:    'intermediate',
    bestFor:  'Runners with a year or two at 15–20 mi/wk who have raced 5Ks and want a PR.',
    approach: 'Five runs a week: 400m repeats at 5K pace alternate with tempo runs on Wednesdays, plus "fast" Saturday runs and Sunday long runs of 5–7 miles. A 5K test in week 4 checks progress.',
  },
  'hal-10k-novice': {
    level:    'beginner',
    bestFor:  'New runners, or experienced runners who want a gentle, low-mileage 10K build.',
    approach: 'Three easy runs a week plus two cross-training days. Sunday runs build from 3 to 5.5 miles, and walking breaks are fine.',
  },
  'hal-10k-intermediate': {
    level:    'intermediate',
    bestFor:  'Runners doing 5–6 runs and 15–25 mi a week who have raced several times between 5K and the half.',
    approach: 'Alternating 400m repeats at 5K pace and tempo runs each Wednesday, easy runs most other days, and a long run building to 8 miles, with a 5K tune-up race in week 4.',
  },
  'hal-10mi-novice': {
    level:    'beginner',
    bestFor:  'First-timers, or runners who have done little running, aiming at a 10 mile or 15K race.',
    approach: 'Three runs a week plus cross-training and strength work. The Saturday long run builds to 8 miles over 10 weeks, with lighter weeks along the way.',
  },
  'hal-10mi-intermediate': {
    level:    'intermediate',
    bestFor:  'Runners doing 5–6 runs and 15–25 mi a week who have raced 10K to half marathon.',
    approach: '800m repeats at 5K pace alternate with tempo runs, strength work follows easy runs, and the Saturday long run reaches 10 miles. Includes 5K and 10K tune-up races.',
  },
  'hal-half-novice-1': {
    level:    'beginner',
    bestFor:  'A first half marathon, for runners who can already run 3 miles, 3–4 times a week.',
    approach: 'Easy runs on Tuesday and Thursday, a short run or cross-training on Wednesday, and a Sunday long run building to 10 miles. 5K and 10K tune-up races in weeks 6 and 9.',
  },
  'hal-half-intermediate-1': {
    level:    'intermediate',
    bestFor:  'Runners with a half or two behind them who want to finish stronger.',
    approach: 'Endurance-based: five days of running, with half-marathon-pace runs on Wednesday and Saturday and a long run that reaches 12 miles. 5K and 10K tune-ups in weeks 6 and 9.',
  },
  'hal-50k': {
    level:    'advanced',
    bestFor:  'Marathoners ready to move up to their first 50K.',
    approach: 'The first 18 weeks closely follow a marathon build, with no speedwork and an optional training marathon in week 18. From week 19 the weekend runs switch to time, up to 5 hours on feet. Every third week steps back.',
  },
  'inov8-100-mile': {
    level:    'advanced',
    bestFor:  'Experienced ultrarunners preparing for a hilly 100-mile trail race.',
    approach: 'Effort-based: hill reps, surges, and tempo and fartlek sessions set by "race pace for 1h / 2h / 3h", long runs that include a share of your race\'s total climb, and hilly hikes of up to 8–9 hours. No pace targets.',
  },
  'hal-novice-supreme': {
    level:    'beginner',
    bestFor:  'Absolute beginners or runners returning after a long break who want 30 weeks of gradual build-up.',
    approach: 'Starts with run/walk intervals for the first four weeks, spends twelve weeks building a pure aerobic base, then follows a standard novice long-run progression. The extra time significantly lowers injury risk.',
  },
  'galloway': {
    level:    'beginner',
    bestFor:  'Beginners, injury-prone runners, or anyone who wants to enjoy every mile rather than just survive it.',
    approach: 'Jeff Galloway\'s run-walk intervals reduce impact and cumulative fatigue on every run — including the long run. Many runners finish faster using this method than with continuous running.',
  },
  'maf': {
    level:    'beginner',
    bestFor:  'Runners who push too hard on easy days, battle chronic fatigue, or want to rebuild their aerobic base from scratch.',
    approach: 'Every run stays at or below the MAF heart rate (180 minus your age in bpm). No speedwork, no tempo. Early runs will feel very slow; aerobic efficiency builds progressively over 20 weeks.',
  },
  'hal-novice-1': {
    level:    'beginner',
    bestFor:  'First-time marathoners whose only goal is to cross the finish line.',
    approach: 'Four days per week — three easy runs and a Saturday long run — with rest or cross-training on the other days. No speedwork. Long runs increase gradually to 20 miles before an 18-week taper.',
  },
  'hal-novice-2': {
    level:    'beginner',
    bestFor:  'Runners on their second marathon or first-timers already comfortable with 25+ mi/wk.',
    approach: 'Same Saturday long-run structure as Novice 1, but adds Wednesday goal-pace runs. A gentle introduction to purposeful pacing without jumping into a full intermediate plan.',
  },
  'first': {
    level:    'intermediate',
    bestFor:  'Busy runners, triathletes, or anyone who can only run three days per week.',
    approach: 'The Furman Institute\'s "Run Less, Run Faster" principle: one speed session (intervals), one tempo run, and one long run per week — plus two cross-training days. No junk miles; every run has a specific purpose.',
  },
  '80-20-running': {
    level:    'intermediate',
    bestFor:  'Runners who feel perpetually tired, catch frequent colds, or keep picking up overuse injuries — signs of chronically hard easy days.',
    approach: 'Matt Fitzgerald\'s 80/20 principle keeps 80% of weekly mileage at a genuinely easy conversational effort, with just one quality session per week. Simple to follow, hard to overdo.',
  },
  'hansons-beginner': {
    level:    'intermediate',
    bestFor:  'Runners who\'ve been injured on 20-mile long runs or who want a "cumulative fatigue" approach over a single weekly sufferfest.',
    approach: 'The Hansons method caps the long run at 16 miles. Instead, six-day training weeks build fatigue across the week. SOS (something of substance) workouts — speed on Tuesday, strength at marathon pace on Thursday — simulate late-race legs.',
  },
  'hal-intermediate-1': {
    level:    'intermediate',
    bestFor:  'Runners with one or two marathons who want a structured five-day schedule and a realistic shot at a PR.',
    approach: 'Adds Monday aerobic runs and Wednesday goal-pace work on top of the Novice structure. Mileage is meaningfully higher; the plan rewards consistency over intensity.',
  },
  'jack-daniels-2q': {
    level:    'intermediate',
    bestFor:  'Analytical, data-driven runners who want a science-backed periodized plan with clear phase progressions.',
    approach: 'Two quality sessions per week, progressing through four phases: Foundation (easy base), Transition (threshold), Quality (intervals + threshold), and Peak/Taper (marathon pace). Paces derived from VDOT tables.',
  },
  'hal-intermediate-2': {
    level:    'advanced',
    bestFor:  'High-mileage marathoners chasing a significant PR who can handle six days and 50+ mi/wk comfortably.',
    approach: 'The highest-mileage Higdon plan. Adds Sunday recovery runs to the Intermediate 1 structure, pushing peak weeks into the 50s. Requires solid base fitness — not a plan to jump into cold.',
  },
  'pfitzinger-18-55': {
    level:    'advanced',
    bestFor:  'Competitive runners with 5+ years of consistent training who are currently running 40+ mi/wk.',
    approach: 'From Pete Pfitzinger\'s "Advanced Marathoning." Six structured days: recovery runs, general aerobic work, medium-long runs, lactate threshold sessions, and long runs. Peaks around 55 mi/wk. Each day has a physiological purpose.',
  },
  'boston-qualifier': {
    level:    'advanced',
    bestFor:  'Runners chasing a specific Boston Qualifying time for their age group (set by official BAA standards).',
    approach: 'Six days/week with tempo and goal-pace sessions throughout. Paces are locked to BAA qualifying standards for your age group — select your category after choosing this plan. Assumes a current base of 40+ mi/wk.',
  },
};

function planHasEstimates(plan) {
  return plan.schedule.some((w) => w.some(dayIsEstimated));
}

/** Weeks, run days per week (at the peak week) and peak weekly miles — for plan cards. */
function planStats(plan) {
  const totals    = plan.schedule.map(weekMiles);
  const peakMiles = Math.max(...totals);
  const peakWeek  = plan.schedule[totals.indexOf(peakMiles)];
  return {
    weeks:     plan.schedule.length,
    daysPerWk: peakWeek.filter((d) => dayIsRun(d) && !d.optional).length,
    peakMiles,
  };
}

// ── Plans guide render ────────────────────────────────────────────────────────

let plansGuideDistance = 'marathon';

function renderPlansGuide() {
  const chips = document.getElementById('plans-distance-chips');
  chips.innerHTML = RACE_DISTANCES
    .filter((d) => PLANS.some((p) => planDistance(p).id === d.id))
    .map((d) => `<button type="button" class="distance-chip${d.id === plansGuideDistance ? ' distance-chip-active' : ''}" data-distance="${d.id}" aria-pressed="${d.id === plansGuideDistance}">${d.label}</button>`)
    .join('');
  chips.querySelectorAll('.distance-chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      plansGuideDistance = btn.dataset.distance;
      renderPlansGuide();
    });
  });

  const groups = [
    { level: 'beginner',     label: 'Beginner'     },
    { level: 'intermediate', label: 'Intermediate' },
    { level: 'advanced',     label: 'Advanced'     },
  ];

  const html = groups.map(({ level, label }) => {
    const groupPlans = PLANS.filter((p) =>
      planDistance(p).id === plansGuideDistance && (PLAN_META[p.id] || {}).level === level);
    if (!groupPlans.length) return '';

    const cards = groupPlans.map((plan) => {
      const meta = PLAN_META[plan.id] || {};
      const { weeks, daysPerWk, peakMiles } = planStats(plan);

      return `
        <div class="plan-card">
          <div class="plan-card-header">
            <span class="plan-card-name">${plan.name}</span>
            <div class="plan-card-stats">
              <span class="plan-stat">${weeks}&nbsp;wks</span>
              <span class="plan-stat">${daysPerWk}&nbsp;days/wk</span>
              <span class="plan-stat">~${Math.round(peakMiles)}&nbsp;mi peak</span>
            </div>
          </div>
          <p class="plan-card-approach">${meta.approach || plan.description}</p>
          <p class="plan-card-bestfor"><span class="plan-card-bestfor-label">Best for:</span> ${meta.bestFor || ''}</p>
          ${plan.source ? `<p class="plan-card-source">Source: <a href="${plan.source.url}" target="_blank" rel="noopener">${plan.source.label} ↗</a></p>` : ''}
          <button class="btn secondary plan-select-btn" data-plan-id="${plan.id}">Select this plan</button>
        </div>`;
    }).join('');

    return `
      <div class="plan-guide-group">
        <p class="plan-guide-level">${label}</p>
        ${cards}
      </div>`;
  }).join('');

  document.getElementById('plans-guide-content').innerHTML = html;

  document.querySelectorAll('.plan-select-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectPlanAndBuild(btn.dataset.planId);
    });
  });
}

// ── Training wizard ───────────────────────────────────────────────────────────

const WIZARD_QUESTIONS = [
  {
    id: 'experience',
    question: 'How many marathons have you finished?',
    options: [
      { value: 'first',   label: 'This is my first',          detail: 'I\'ve never run 26.2' },
      { value: 'some',    label: 'One or two before',         detail: 'I know what to expect' },
      { value: 'several', label: 'Several — I\'m after time', detail: 'Focused on performance' },
    ],
  },
  {
    id: 'days',
    question: 'How many days a week can you train?',
    options: [
      { value: '3', label: '3 days', detail: 'Quality only — no filler' },
      { value: '4', label: '4 days', detail: 'The most common setup' },
      { value: '5', label: '5 days', detail: 'Serious commitment' },
      { value: '6', label: '6 days', detail: 'High-mileage focus' },
    ],
  },
  {
    id: 'goal',
    question: 'What\'s your main goal for this race?',
    options: [
      { value: 'finish', label: 'Cross the finish line',    detail: 'Completion is the victory' },
      { value: 'base',   label: 'Build aerobic fitness',    detail: 'Long-term health focus' },
      { value: 'pr',     label: 'Run a personal best',      detail: 'Chasing a time goal' },
      { value: 'bq',     label: 'Qualify for Boston',       detail: 'Hit the official BAA standard' },
    ],
  },
  {
    id: 'special',
    question: 'Anything else we should know?',
    options: [
      { value: 'injury',  label: 'I get injured when mileage ramps up',   detail: 'History of overuse or stress injuries' },
      { value: 'busy',    label: 'Training time is limited each week',     detail: 'Efficiency matters most' },
      { value: 'maxtime', label: 'I want maximum preparation time',        detail: 'Race is 6+ months away' },
      { value: 'none',    label: 'None of the above',                      detail: '' },
    ],
  },
  {
    id: 'mileage',
    question: 'What\'s your current weekly mileage?',
    options: [
      { value: 'low',  label: 'Under 25 mi/wk', detail: 'Building a base' },
      { value: 'mid',  label: '25–40 mi/wk',    detail: 'Comfortable running base' },
      { value: 'high', label: 'Over 40 mi/wk',  detail: 'Strong consistent base' },
    ],
  },
];

const WIZARD_DISTANCE_QUESTION = {
  id: 'distance',
  question: 'What race are you training for?',
  options: RACE_DISTANCES
    .filter((d) => PLANS.some((p) => planDistance(p).id === d.id))
    .map((d) => ({ value: d.id, label: d.label, detail: '' })),
};

// Non-marathon distances have only a novice and/or intermediate plan, so a
// single question is enough to rank them.
const WIZARD_DISTANCE_EXPERIENCE_QUESTION = {
  id: 'distExperience',
  question: 'Where are you starting from?',
  options: [
    { value: 'new',         label: 'New to this distance',  detail: 'Finishing comfortably is the goal' },
    { value: 'experienced', label: 'I\'ve raced it before', detail: 'I want a faster time' },
  ],
};

const wizardState = { step: 0, answers: {} };

function getWizardQuestions() {
  const distance = wizardState.answers.distance;
  if (distance && distance !== 'marathon') {
    const plansForDistance = PLANS.filter((p) => planDistance(p).id === distance);
    return plansForDistance.length > 1
      ? [WIZARD_DISTANCE_QUESTION, WIZARD_DISTANCE_EXPERIENCE_QUESTION]
      : [WIZARD_DISTANCE_QUESTION];
  }
  return [WIZARD_DISTANCE_QUESTION, ...WIZARD_QUESTIONS.filter((q) =>
    q.id !== 'mileage' || wizardState.answers.experience !== 'first')];
}

/** Ranks a non-marathon distance's plans: beginner plans first for new runners, harder ones first otherwise. */
function recommendForDistance(distance, experience) {
  const order = experience === 'experienced'
    ? ['advanced', 'intermediate', 'beginner']
    : ['beginner', 'intermediate', 'advanced'];
  return PLANS
    .filter((p) => planDistance(p).id === distance)
    .sort((a, b) =>
      order.indexOf((PLAN_META[a.id] || {}).level) - order.indexOf((PLAN_META[b.id] || {}).level));
}

function initWizard() {
  renderWizardStep();
}

function renderWizardStep() {
  const questions = getWizardQuestions();
  const step      = wizardState.step;
  const container = document.getElementById('wizard-container');

  if (step >= questions.length) { renderWizardResults(); return; }

  const q      = questions[step];
  const total  = questions.length;
  const pct    = Math.round((step / total) * 100);
  const answer = wizardState.answers[q.id];

  container.innerHTML = `
    <div class="wizard-head">
      <div class="wizard-progress-track">
        <div class="wizard-progress-fill" style="width:${pct}%"></div>
      </div>
      <span class="wizard-step-label">Step ${step + 1} of ${total}</span>
    </div>
    <h2 class="wizard-question">${q.question}</h2>
    <div class="wizard-options">
      ${q.options.map((opt) => `
        <button class="wizard-option${answer === opt.value ? ' wizard-option-selected' : ''}" data-value="${opt.value}">
          <span class="wizard-option-label">${opt.label}</span>
          ${opt.detail ? `<span class="wizard-option-detail">${opt.detail}</span>` : ''}
        </button>`).join('')}
    </div>
    <div class="wizard-nav">
      ${step > 0 ? '<button class="btn secondary wizard-back">Back</button>' : '<span></span>'}
    </div>`;

  container.querySelectorAll('.wizard-option').forEach((btn) => {
    btn.addEventListener('click', () => {
      wizardState.answers[q.id] = btn.dataset.value;
      btn.classList.add('wizard-option-selected');
      setTimeout(() => { wizardState.step++; renderWizardStep(); }, 180);
    });
  });

  const back = container.querySelector('.wizard-back');
  if (back) back.addEventListener('click', () => { wizardState.step--; renderWizardStep(); });
}

function scoreWizard(answers) {
  const scores = {};
  const add = (id, pts) => { scores[id] = (scores[id] || 0) + pts; };
  const { experience, days, goal, special, mileage } = answers;

  if (experience === 'first') {
    add('hal-novice-1', 6); add('hal-novice-supreme', 4); add('galloway', 4); add('maf', 2);
  } else if (experience === 'some') {
    add('hal-novice-2', 5); add('hal-intermediate-1', 5); add('first', 4);
    add('hansons-beginner', 4); add('80-20-running', 4); add('jack-daniels-2q', 3);
  } else {
    add('hal-intermediate-2', 4); add('pfitzinger-18-55', 5);
    add('boston-qualifier', 5); add('jack-daniels-2q', 4); add('hal-intermediate-1', 2);
  }

  const d = parseInt(days, 10);
  if (d === 3) { add('galloway', 5); add('first', 5); }
  else if (d === 4) { add('hal-novice-1', 5); add('hal-novice-2', 4); add('hal-novice-supreme', 3); }
  else if (d === 5) { add('hal-intermediate-1', 4); add('maf', 4); add('80-20-running', 4); }
  else { add('pfitzinger-18-55', 4); add('boston-qualifier', 4); add('hal-intermediate-2', 4); add('hansons-beginner', 5); add('jack-daniels-2q', 4); }

  if (goal === 'finish') {
    add('hal-novice-1', 6); add('galloway', 5); add('hal-novice-supreme', 4); add('maf', 2);
  } else if (goal === 'base') {
    add('maf', 10); add('80-20-running', 7);
  } else if (goal === 'pr') {
    add('hal-intermediate-1', 5); add('jack-daniels-2q', 5); add('hansons-beginner', 4);
    add('first', 4); add('hal-intermediate-2', 4); add('80-20-running', 3);
    add('hal-novice-2', 3); add('pfitzinger-18-55', 3);
  } else {
    add('boston-qualifier', 12); add('pfitzinger-18-55', 7); add('jack-daniels-2q', 5);
  }

  if (special === 'injury') {
    add('galloway', 7); add('maf', 6); add('hansons-beginner', 3); add('80-20-running', 3);
    add('pfitzinger-18-55', -5); add('hal-intermediate-2', -4); add('boston-qualifier', -4);
  } else if (special === 'busy') {
    add('first', 8); add('galloway', 4);
    add('pfitzinger-18-55', -5); add('hansons-beginner', -4);
    add('hal-intermediate-2', -4); add('boston-qualifier', -4);
  } else if (special === 'maxtime') {
    add('hal-novice-supreme', 12); add('maf', 5);
  }

  if (mileage === 'low') {
    add('hal-novice-1', 3); add('hal-novice-2', 2);
    add('pfitzinger-18-55', -5); add('boston-qualifier', -5); add('hal-intermediate-2', -3);
  } else if (mileage === 'mid') {
    add('hal-intermediate-1', 4); add('hansons-beginner', 4); add('80-20-running', 3); add('jack-daniels-2q', 3);
    add('pfitzinger-18-55', -2); add('boston-qualifier', -2);
  } else if (mileage === 'high') {
    add('pfitzinger-18-55', 6); add('boston-qualifier', 5); add('hal-intermediate-2', 5); add('jack-daniels-2q', 4);
  }

  return Object.entries(scores)
    .sort(([, a], [, b]) => b - a)
    .filter(([, s]) => s > 0)
    .slice(0, 3)
    .map(([id]) => PLANS.find((p) => p.id === id))
    .filter(Boolean);
}

function buildMatchReason(planId, answers) {
  const parts = [];
  const { experience, days, goal, special, mileage } = answers;
  if (planId === 'galloway' && special === 'injury')          parts.push('run-walk intervals reduce injury risk on every run');
  if (planId === 'galloway' && days === '3')                  parts.push('designed for 3 training days per week');
  if (planId === 'galloway' && goal === 'finish')             parts.push('proven completion method for first-time marathoners');
  if (planId === 'first' && days === '3')                     parts.push('built for exactly 3 quality runs per week');
  if (planId === 'first' && special === 'busy')               parts.push('maximum return on minimum training time');
  if (planId === 'maf')                                       parts.push('every run stays at aerobic heart rate — impossible to overtrain');
  if (planId === 'maf' && special === 'injury')               parts.push('no intense sessions means dramatically lower injury risk');
  if (planId === 'hal-novice-supreme' && special === 'maxtime') parts.push('30 weeks — the most gradual marathon build available');
  if (planId === 'boston-qualifier' && goal === 'bq')         parts.push('targets official BAA qualifying standards for your age group');
  if (planId === 'pfitzinger-18-55' && mileage === 'high')    parts.push('structured for runners already at 40+ mi/wk');
  if (planId === 'hansons-beginner' && special === 'injury')  parts.push('long runs capped at 16 miles reduces breakdown risk');
  if (planId === 'jack-daniels-2q' && goal === 'pr')          parts.push('phase-based progression from aerobic base to race-specific pace');
  if (planId === '80-20-running' && goal === 'base')          parts.push('80% of mileage at easy effort builds aerobic engine without burnout');
  if (planId === '80-20-running' && special === 'injury')     parts.push('avoids the chronically hard easy days that cause overuse injuries');
  if (planId === 'hal-novice-1' && experience === 'first')    parts.push('the most popular plan for first-time marathoners worldwide');
  if (planId === 'hal-intermediate-1' && experience === 'some') parts.push('structured step up for runners ready to focus on time');
  if (planId === 'hal-intermediate-2' && mileage === 'high')  parts.push('high weekly mileage with added Sunday recovery runs');
  if (!parts.length) {
    const meta = PLAN_META[planId] || {};
    parts.push(meta.bestFor || 'strong match for your training profile');
  }
  return parts.join(' · ');
}

function renderWizardResults() {
  const { distance, distExperience } = wizardState.answers;
  const recs = distance && distance !== 'marathon'
    ? recommendForDistance(distance, distExperience)
    : scoreWizard(wizardState.answers);
  const container = document.getElementById('wizard-container');

  if (!recs.length) {
    container.innerHTML = `
      <p class="section-label">No match found</p>
      <p class="plans-guide-intro">Try adjusting your answers.</p>
      <button class="btn secondary" id="wizard-restart-empty">Start over</button>`;
    document.getElementById('wizard-restart-empty')
      .addEventListener('click', restartWizard);
    return;
  }

  const cards = recs.map((plan, i) => {
    const { daysPerWk, peakMiles } = planStats(plan);
    const reason = buildMatchReason(plan.id, wizardState.answers);

    return `
      <div class="plan-card wizard-result-card${i === 0 ? ' wizard-result-top' : ''}">
        ${i === 0 ? '<span class="wizard-best-badge">Best match</span>' : ''}
        <div class="plan-card-header">
          <span class="plan-card-name">${plan.name}</span>
          <div class="plan-card-stats">
            <span class="plan-stat">${plan.schedule.length}&nbsp;wks</span>
            <span class="plan-stat">${daysPerWk}&nbsp;days/wk</span>
            <span class="plan-stat">~${Math.round(peakMiles)}&nbsp;mi peak</span>
          </div>
        </div>
        <p class="plan-card-approach">${reason}</p>
        <button class="btn${i === 0 ? '' : ' secondary'} plan-select-btn" data-plan-id="${plan.id}">
          ${i === 0 ? 'Build this plan' : 'Select instead'}
        </button>
      </div>`;
  }).join('');

  container.innerHTML = `
    <p class="section-label">Recommended for you</p>
    <div class="wizard-results">${cards}</div>
    <div class="wizard-nav wizard-results-nav">
      <button class="btn secondary" id="wizard-restart">Start over</button>
      <button class="link-btn" id="wizard-browse-all">Browse all plans &rarr;</button>
    </div>`;

  container.querySelectorAll('.plan-select-btn').forEach((btn) => {
    btn.addEventListener('click', () => selectPlanAndBuild(btn.dataset.planId));
  });
  document.getElementById('wizard-restart').addEventListener('click', restartWizard);
  document.getElementById('wizard-browse-all').addEventListener('click', () => switchTab('plans'));
}

function restartWizard() {
  wizardState.step    = 0;
  wizardState.answers = {};
  renderWizardStep();
}

// ── Tab switching ─────────────────────────────────────────────────────────────

const TAB_VIEWS = ['home', 'currentplan', 'plan', 'wizard', 'plans', 'heat', 'settings'];

// Shareable-link slugs for each tab, e.g. #heat-calculator
const TAB_HASHES = {
  home:  'home',
  currentplan: 'current-plan',
  plan:  'plan',
  wizard: 'training-wizard',
  plans: 'plans',
  heat:  'heat-calculator',
  settings: 'settings',
};

function switchTab(tabId) {
  // Current Plan requires a resolvable plan — a stale bookmark or hash link
  // shouldn't land on an empty page if one isn't configured.
  if (tabId === 'currentplan' && !getCurrentPlanConfig()) tabId = 'home';

  TAB_VIEWS.forEach((v) => {
    document.getElementById(`${v}-view`).classList.toggle('hidden', v !== tabId);
  });
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.classList.toggle('tab-active', btn.dataset.tab === tabId);
  });
  if (tabId === 'currentplan') renderCurrentPlan();
  if (tabId === 'settings') renderSettingsDefaultPlan();
  const hash = `#${TAB_HASHES[tabId]}`;
  if (location.hash !== hash) history.replaceState(null, '', hash);
}

// Opens the tab matching the current URL hash (e.g. a shared /heat-calculator link).
function openTabFromHash() {
  const slug = location.hash.slice(1);
  const tabId = Object.keys(TAB_HASHES).find((k) => TAB_HASHES[k] === slug);
  if (tabId && tabId !== 'home') switchTab(tabId);
}

function selectPlanAndBuild(planId) {
  setBuildFormPlan(planId);
  switchTab('plan');
  showStep('step-configure');
}

// ── UI state machine ──────────────────────────────────────────────────────────

const steps = [
  'step-signin', 'step-configure', 'step-preview',
  'step-progress', 'step-done',
];

function showStep(id) {
  steps.forEach((s) => {
    document.getElementById(s).classList.toggle('hidden', s !== id);
  });
}

function showLoadingOverlay(msg) {
  document.getElementById('loading-text').textContent = msg;
  document.getElementById('loading-overlay').classList.remove('hidden');
}

function hideLoadingOverlay() {
  document.getElementById('loading-overlay').classList.add('hidden');
}

// ── Preview render ────────────────────────────────────────────────────────────

const PLAN_TABLE_DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Shared [label, value] → .summary-rows markup, used by the Build Plan preview and Current Plan page. */
function buildSummaryRowsHtml(entries) {
  const rows = entries.map(([label, value]) => `
    <div class="summary-row">
      <span class="summary-label">${label}</span>
      <span class="summary-value">${value}</span>
    </div>
  `).join('');
  return `<div class="summary-rows">${rows}</div>`;
}

/** Shared week-by-week plan table, used by the Build Plan preview and Current Plan's List view. */
// Schedule day-index order (and matching header labels) for each week-start
// preference. Schedule arrays are always [Mon, Tue, Wed, Thu, Fri, Sat, Sun]
// (index 6 = Sunday) — 'sunday' just reorders which column each index
// renders into, it doesn't change what week a day belongs to.
const WEEK_DAY_ORDER = {
  monday: [0, 1, 2, 3, 4, 5, 6],
  sunday: [6, 0, 1, 2, 3, 4, 5],
};
const WEEK_DAY_LABELS_BY_START = {
  monday: PLAN_TABLE_DAY_LABELS,
  sunday: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
};

/** "4.5", "14", "1.5" — estimates rounded to the nearest half mile. */
function formatEstMiles(miles) {
  const r = Math.round(miles * 2) / 2;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

function escapeAttr(str) {
  return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function buildPlanTableHtml(plan, primaryPace, showWeekTotal = false, weekStartsOn = 'monday') {
  const dayOrder   = WEEK_DAY_ORDER[weekStartsOn] || WEEK_DAY_ORDER.monday;
  const dayLabels  = WEEK_DAY_LABELS_BY_START[weekStartsOn] || WEEK_DAY_LABELS_BY_START.monday;

  const tbody = plan.schedule.map((week, wi) => {
    const cells = dayOrder.map((di) => {
      const day = week[di];
      const title = day.note ? ` title="${escapeAttr(day.note)}"` : '';
      if (!dayIsRun(day)) {
        const label = day.label || (day.type === 'cross' ? 'rest/x-train' : 'rest');
        return `<td class="day-${day.type}" data-type="${day.type}"${title}><span class="day-miles">${label}</span></td>`;
      }
      const pace    = planPaceForDay(plan, day, primaryPace);
      const hints   = [];
      if (dayIsEstimated(day)) hints.push(`~${formatEstMiles(estimateDayMiles(day))} mi`);
      if (pace) hints.push(formatPace(pace));
      const paceStr = hints.join(' · ');
      const optCls  = day.optional ? ' day-optional' : '';
      return `<td class="day-${day.type}${optCls}" data-type="${day.type}"${title}>
        <span class="day-miles">${dayText(day)}${day.optional ? ' <span class="day-opt-tag">opt</span>' : ''}</span>
        <span class="day-pace-hint">${paceStr}</span>
      </td>`;
    }).join('');
    const totalCell = showWeekTotal
      ? `<td class="week-total">${weekMiles(week).toFixed(1)} mi</td>`
      : '';
    // Without a Total column (Build Plan preview), show the week's mileage
    // under its number instead. "~" because timed workouts and optional days
    // aren't counted.
    const weekLabel = showWeekTotal
      ? `wk ${wi + 1}`
      : `wk ${wi + 1}<span class="week-num-miles">~${Math.round(weekMiles(week))} mi</span>`;
    return `<tr><td class="week-num">${weekLabel}</td>${cells}${totalCell}</tr>`;
  }).join('');

  return `
    <div class="table-scroll">
      <table class="plan-table${showWeekTotal ? ' plan-table-fixed' : ''}">
        <thead>
          <tr>
            <th class="plan-table-num-col"></th>
            ${dayLabels.map((d) => `<th>${d}</th>`).join('')}
            ${showWeekTotal ? '<th class="plan-table-total-col">Total</th>' : ''}
          </tr>
        </thead>
        <tbody>${tbody}</tbody>
      </table>
    </div>
    ${showWeekTotal ? '<p class="hint plan-table-scroll-hint">Scroll right to see each week&rsquo;s total.</p>' : ''}
  `;
}

function renderPreview(plan, raceDateStr, paces, restoredFromCalendar = false, resetFilters = true) {
  // Reset type filters to all types present in this plan.
  if (resetFilters) {
    enabledTypes = new Set(selectedEvents.map((e) => e.type));
  }
  const TOTAL_DAYS   = plan.schedule.length * 7;
  const startDateStr = addDays(raceDateStr, -(TOTAL_DAYS - 1));

  const primaryPace = paces.length ? paces[0].secPerMile : null;
  const totalMiles  = plan.schedule.reduce((s, w) => s + weekMiles(w), 0);
  const raceMiles   = planDistance(plan).miles;

  const paceDisplay   = paces.length ? paces.map((p) => formatPace(p.secPerMile)).join('<br>') : 'By effort';
  const finishDisplay = paces.length ? paces.map((p) => formatTime(Math.round(p.secPerMile * raceMiles))).join('<br>') : '—';

  // Section label
  document.getElementById('preview-section-label').textContent = restoredFromCalendar
    ? `Plan loaded from calendar  (${savedEventIds.length} events found)`
    : 'Review your plan';

  document.getElementById('plan-summary').innerHTML = buildSummaryRowsHtml([
    ['Plan',        plan.name],
    ['Distance',    planDistance(plan).label],
    ['Race date',   formatDisplayDate(raceDateStr)],
    ['Plan start',  formatDisplayDate(startDateStr)],
    ['Goal pace',   paceDisplay],
    ['Est. finish', finishDisplay],
    ['Total miles', planHasEstimates(plan) ? `~${Math.round(totalMiles)} mi` : totalMiles.toFixed(1) + ' mi'],
  ]);

  document.getElementById('plan-preview').innerHTML = buildPlanTableHtml(plan, primaryPace);

  renderTypeFilters();
}

// ── Type filter ───────────────────────────────────────────────────────────────

function countByType() {
  const counts = {};
  selectedEvents.forEach((e) => { counts[e.type] = (counts[e.type] || 0) + 1; });
  return counts;
}

function getFilteredEvents() {
  return selectedEvents.filter((e) => enabledTypes.has(e.type));
}

function renderTypeFilters() {
  const counts    = countByType();
  const container = document.getElementById('type-filters');

  container.innerHTML = Object.entries(counts).map(([type, count]) => {
    const meta   = TYPE_META[type] || { label: type, color: '#666' };
    const active = enabledTypes.has(type);
    const style  = active
      ? `background:${meta.color};border-color:${meta.color};color:#fff`
      : '';
    return `<button class="type-badge${active ? ' active' : ''}"
                    data-type="${type}"
                    style="${style}">
      ${meta.label}<span class="badge-count">${count}</span>
    </button>`;
  }).join('');

  container.querySelectorAll('.type-badge').forEach((btn) => {
    btn.addEventListener('click', () => {
      const t = btn.dataset.type;
      enabledTypes.has(t) ? enabledTypes.delete(t) : enabledTypes.add(t);
      renderTypeFilters();
      syncAddButton();
    });
  });

  syncAddButton();
  syncTableHighlight();
}

function syncAddButton() {
  const n = getFilteredEvents().length;
  document.getElementById('btn-add-to-calendar').textContent =
    `Add ${n} Event${n !== 1 ? 's' : ''} to Calendar`;
}

function syncTableHighlight() {
  document.querySelectorAll('#plan-preview td[data-type]').forEach((td) => {
    td.classList.toggle('day-disabled', !enabledTypes.has(td.dataset.type));
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function updateClearButton() {
  document.getElementById('btn-clear-plan')
    .classList.toggle('hidden', savedEventIds.length === 0);
}

function setProgressLabel(text) {
  document.getElementById('progress-label-text').textContent = text;
  document.getElementById('progress-fill').style.width = '0%';
  document.getElementById('progress-text').textContent  = '';
}

function showError(msg) {
  const el = document.getElementById('error-msg');
  el.textContent = msg;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 6000);
}

function updatePlanDescription() {
  const id   = document.getElementById('plan-select').value;
  const plan = PLANS.find((p) => p.id === id);
  const el   = document.getElementById('plan-description');
  if (el && plan) {
    el.textContent = plan.description;
    if (plan.source) {
      const a = document.createElement('a');
      a.href = plan.source.url;
      a.target = '_blank';
      a.rel = 'noopener';
      a.className = 'plan-source-link';
      a.textContent = `Source: ${plan.source.label} ↗`;
      el.appendChild(document.createTextNode(' '));
      el.appendChild(a);
    }
  }
  updateBQSelector();
}

function updateBQSelector() {
  const id    = document.getElementById('plan-select').value;
  const plan  = PLANS.find((p) => p.id === id);
  const group = document.getElementById('bq-category-group');
  if (!group) return;

  if (plan && plan.bqCategories) {
    const sel = document.getElementById('bq-category');
    sel.innerHTML = '<option value="">Select your age group…</option>';
    plan.bqCategories.forEach((cat, i) => {
      const opt = document.createElement('option');
      opt.value       = i;
      opt.textContent = `${cat.label}  —  ${cat.finish}`;
      sel.appendChild(opt);
    });
    sel.value = '';
    group.classList.remove('hidden');
  } else {
    group.classList.add('hidden');
  }
}

// ── Build Plan form: distance / plan / pace ───────────────────────────────────

function getSelectedBuildPlan() {
  return PLANS.find((p) => p.id === document.getElementById('plan-select').value) || PLANS[0];
}

function populatePlanSelect(distanceId) {
  const planSelect = document.getElementById('plan-select');
  planSelect.innerHTML = '';
  PLANS.filter((p) => planDistance(p).id === distanceId).forEach((plan) => {
    const el = document.createElement('option');
    el.value       = plan.id;
    el.textContent = plan.name;
    planSelect.appendChild(el);
  });
}

/** Rebuilds the goal-time dropdown for the selected plan's distance. */
function rebuildPaceSelect() {
  const plan       = getSelectedBuildPlan();
  const paceSelect = document.getElementById('goal-pace');
  paceSelect.innerHTML = '';
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = plan.paceOptional ? 'Optional — select a goal time…' : 'Select a pace to add…';
  paceSelect.appendChild(placeholder);
  getPaceOptionsForPlan(plan).forEach((opt) => {
    const el = document.createElement('option');
    el.value       = opt.secPerMile;
    el.textContent = `Finish ${opt.finish}  —  ${formatPace(opt.secPerMile)}`;
    paceSelect.appendChild(el);
  });
  paceSelect.value = '';
  document.getElementById('goal-pace-label').textContent =
    plan.paceOptional ? 'Goal Finish Time (optional)' : 'Goal Finish Time';
  // Purely effort-based plans have no pace targets to fill in.
  document.getElementById('goal-pace').closest('.form-group').classList.toggle('hidden', !!plan.noPaces);
}

function onBuildPlanChanged() {
  updatePlanDescription();
  selectedPaces = [];
  renderPaceTags();
  rebuildPaceSelect();
  applyAutoRaceDate();
}

/** This Monday if today is a Monday, otherwise the next one — plans always run Monday → race Sunday. */
function nextMondayStr() {
  const d = new Date();
  d.setDate(d.getDate() + (8 - d.getDay()) % 7);
  return toDateStr(d);
}

/**
 * "Auto-pick" race date: start the selected plan on the coming Monday and set
 * the race date to the end of its last week. The date field is locked while
 * it's on, and follows the plan if a different one is picked.
 */
function applyAutoRaceDate() {
  const on    = document.getElementById('race-date-auto').checked;
  const input = document.getElementById('race-date');
  const hint  = document.getElementById('race-date-auto-hint');
  input.disabled = on;
  hint.classList.toggle('hidden', !on);
  if (!on) return;

  const plan     = getSelectedBuildPlan();
  const startStr = nextMondayStr();
  input.value = addDays(startStr, plan.schedule.length * 7 - 1);
  hint.textContent = `Starts ${formatDisplayDate(startStr)} · ${plan.schedule.length} weeks`;
}

/** Points the whole Build Plan form (distance, plan list, goal times) at one plan. */
function setBuildFormPlan(planId) {
  const plan = PLANS.find((p) => p.id === planId);
  if (!plan) return;
  document.getElementById('race-distance').value = planDistance(plan).id;
  populatePlanSelect(planDistance(plan).id);
  document.getElementById('plan-select').value = planId;
  onBuildPlanChanged();
}

// ── Boot ──────────────────────────────────────────────────────────────────────

let selectedEvents = [];

window.addEventListener('load', () => {
  showStep('step-signin');

  // Pace dropdown — each selection adds a pace chip; multiple are supported.
  // Its options follow the selected plan's race distance.
  const paceSelect = document.getElementById('goal-pace');
  paceSelect.addEventListener('change', () => {
    const val = parseInt(paceSelect.value, 10);
    if (!val) return;
    const opt = getPaceOptionsForPlan(getSelectedBuildPlan()).find((o) => o.secPerMile === val);
    if (opt && !selectedPaces.some((p) => p.secPerMile === val)) {
      selectedPaces.push(opt);
      renderPaceTags();
    }
    paceSelect.value = '';
  });

  // Race distance → plan dropdown
  const distanceSelect = document.getElementById('race-distance');
  RACE_DISTANCES.forEach((d) => {
    if (!PLANS.some((p) => planDistance(p).id === d.id)) return;
    const el = document.createElement('option');
    el.value       = d.id;
    el.textContent = d.label;
    distanceSelect.appendChild(el);
  });
  distanceSelect.value = 'marathon';
  distanceSelect.addEventListener('change', () => {
    populatePlanSelect(distanceSelect.value);
    onBuildPlanChanged();
  });

  document.getElementById('race-date-auto').addEventListener('change', applyAutoRaceDate);

  const planSelect = document.getElementById('plan-select');
  populatePlanSelect('marathon');
  planSelect.addEventListener('change', onBuildPlanChanged);
  onBuildPlanChanged();

  document.getElementById('bq-category').addEventListener('change', () => {
    const id   = document.getElementById('plan-select').value;
    const plan = PLANS.find((p) => p.id === id);
    if (!plan || !plan.bqCategories) return;
    const idx = parseInt(document.getElementById('bq-category').value, 10);
    if (isNaN(idx)) return;
    const cat = plan.bqCategories[idx];
    if (!selectedPaces.some((p) => p.secPerMile === cat.secPerMile)) {
      selectedPaces.push({ finish: cat.finish, secPerMile: cat.secPerMile });
      renderPaceTags();
    }
    document.getElementById('bq-category').value = '';
  });

  // Buttons
  document.getElementById('btn-signin')
    .addEventListener('click', () => {
      CalendarAPI.init(CONFIG.googleClientId, onSignedIn);
      CalendarAPI.signIn();
    });

  document.getElementById('btn-browse')
    .addEventListener('click', () => {
      browseMode = true;
      document.getElementById('plan-view').classList.add('browse-mode');
      showStep('step-configure');
    });

  document.querySelectorAll('.home-link-card').forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.goto));
  });

  document.getElementById('btn-plans-guide')
    .addEventListener('click', () => switchTab('plans'));

  renderPlansGuide();
  document.getElementById('btn-plans-to-wizard')
    .addEventListener('click', () => switchTab('wizard'));

  initWizard();

  document.getElementById('btn-export-pdf')
    .addEventListener('click', () => window.print());
  document.getElementById('btn-preview')
    .addEventListener('click', onPreview);
  document.getElementById('btn-back')
    .addEventListener('click', () => showStep('step-configure'));
  document.getElementById('btn-add-to-calendar')
    .addEventListener('click', onAddToCalendar);
  document.getElementById('btn-clear-plan')
    .addEventListener('click', onClearPlan);
  document.getElementById('btn-restart')
    .addEventListener('click', () => {
      selectedEvents = [];
      savedEventIds  = [];
      selectedPaces  = [];
      renderPaceTags();
      document.getElementById('plan-summary').innerHTML  = '';
      document.getElementById('plan-preview').innerHTML  = '';
      document.getElementById('type-filters').innerHTML  = '';
      if (browseMode) {
        browseMode = false;
        document.getElementById('plan-view').classList.remove('browse-mode');
        showStep('step-signin');
      } else {
        showStep('step-configure');
      }
    });

  // When the user changes the calendar dropdown after sign-in, re-search.
  document.getElementById('calendar-select')
    .addEventListener('change', async (e) => {
      const calendarId = e.target.value;
      if (!calendarId) return;
      localStorage.setItem(STORAGE_CALENDAR, calendarId);
      refreshCalendarWorkouts();
      savedEventIds = [];
      updateClearButton();
      const found = await searchExistingPlan(calendarId);
      if (!found) showStep('step-configure');
    });

  // Default plan chooser / today's plan widget (Home tab)

  // Picker label/detail are generated from the plan + baked-in config
  // (rather than hand-typed in the HTML) so they can never drift from the
  // canonical plan name used everywhere else in the app, or from the actual
  // seeded race date.
  const tcmPlan   = PLANS.find((p) => p.id === DEFAULT_PLAN_ID);
  const tcmConfig = DEFAULT_PLAN_CONFIG[DEFAULT_PLAN_ID];
  document.getElementById('choose-tcm-label').textContent  = tcmPlan.name;
  document.getElementById('choose-tcm-detail').textContent =
    `Race day ${formatDisplayDate(tcmConfig.raceDate)} · Twin Cities Marathon`;

  document.getElementById('btn-choose-tcm').addEventListener('click', () => {
    localStorage.setItem(STORAGE_DEFAULT_PLAN_CHOICE, DEFAULT_PLAN_ID);
    localStorage.setItem(STORAGE_DEFAULT_PLAN_SETUP, JSON.stringify(DEFAULT_PLAN_CONFIG[DEFAULT_PLAN_ID]));
    renderTodayPlan();
  });

  document.getElementById('btn-choose-skip').addEventListener('click', () => {
    localStorage.setItem(STORAGE_DEFAULT_PLAN_CHOICE, 'skip');
    renderTodayPlan();
  });

  document.getElementById('btn-show-default-plan-picker').addEventListener('click', () => {
    localStorage.removeItem(STORAGE_DEFAULT_PLAN_CHOICE);
    localStorage.removeItem(STORAGE_DEFAULT_PLAN_SETUP);
    renderTodayPlan();
  });

  document.getElementById('btn-goto-settings').addEventListener('click', () => switchTab('settings'));

  document.getElementById('btn-today-cal-sync').addEventListener('click', onHomeCalendarSync);
  document.getElementById('btn-today-cal-connect').addEventListener('click', onHomeCalendarSync);
  document.getElementById('today-cal-select').addEventListener('change', (e) => {
    if (!e.target.value) return;
    localStorage.setItem(STORAGE_CALENDAR, e.target.value);
    homeCalendarPickerOn = false;
    refreshCalendarWorkouts();
  });

  renderTodayPlan();
  autoSyncCalendarWorkouts();

  // Coming back to the app (switching tabs, reopening the home-screen app)
  // re-syncs if the last sync is stale, and picks up a new day at midnight.
  let lastRenderedDay = toDateStr(new Date());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    const todayStr = toDateStr(new Date());
    if (todayStr !== lastRenderedDay) {
      lastRenderedDay = todayStr;
      renderTodayPlan();
    }
    autoSyncCalendarWorkouts();
  });
  initTodayWeekSwipe();
  document.getElementById('btn-back-to-today').addEventListener('click', jumpToTodayWeek);
  document.getElementById('btn-prev-week').addEventListener('click', () => slideToWeek(-1));
  document.getElementById('btn-next-week').addEventListener('click', () => slideToWeek(1));

  // Current Plan page
  document.getElementById('btn-view-full-plan')
    .addEventListener('click', () => switchTab('currentplan'));

  function applyCurrentPlanViewMode() {
    document.querySelectorAll('#currentplan-view-toggle .heat-toggle-btn').forEach((b) =>
      b.classList.toggle('heat-toggle-active', b.dataset.view === currentPlanViewMode));
    document.getElementById('currentplan-calendar').classList.toggle('hidden', currentPlanViewMode !== 'calendar');
    document.getElementById('currentplan-list').classList.toggle('hidden', currentPlanViewMode !== 'list');
  }
  document.querySelectorAll('#currentplan-view-toggle .heat-toggle-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      currentPlanViewMode = btn.dataset.view;
      localStorage.setItem(STORAGE_CURRENTPLAN_VIEW, currentPlanViewMode);
      applyCurrentPlanViewMode();
    });
  });
  applyCurrentPlanViewMode(); // sync DOM to the remembered choice (HTML hardcodes "Calendar" by default)

  // Prev/Next jump-scroll to a month's sticky header; the list itself is
  // one continuous native-scroll region (touch, wheel, trackpad, scrollbar
  // all just work — no custom gesture code).
  document.getElementById('currentplan-cal-prev').addEventListener('click', () => stepCurrentPlanMonth(-1));
  document.getElementById('currentplan-cal-next').addEventListener('click', () => stepCurrentPlanMonth(1));
  initCurrentPlanMonthScrollTracking();

  // Settings page
  initSettingsToggle('settings-cal-week-start', STORAGE_CAL_WEEK_START, getCalWeekStart());
  initSettingsToggle('settings-list-week-start', STORAGE_LIST_WEEK_START, getListWeekStart());

  // Opens directly to a tab if the URL was shared with a hash, e.g. #heat-calculator.
  openTabFromHash();
});

window.addEventListener('hashchange', openTabFromHash);

// ── Sign-in handler ───────────────────────────────────────────────────────────

async function onSignedIn() {
  showStep('step-configure');

  try {
    const calendars = await CalendarAPI.listCalendars();
    const sel = document.getElementById('calendar-select');
    sel.innerHTML = '';
    calendars.forEach((cal) => {
      const opt      = document.createElement('option');
      opt.value      = cal.id;
      opt.textContent = cal.summary + (cal.primary ? ' (primary)' : '');
      sel.appendChild(opt);
    });

    // Restore preferred calendar.
    const preferred = localStorage.getItem(STORAGE_CALENDAR);
    if (preferred && [...sel.options].some((o) => o.value === preferred)) {
      sel.value = preferred;
    }

    // Search selected calendar for an existing plan.
    const calendarId = sel.value;
    if (calendarId && !localStorage.getItem(STORAGE_CALENDAR)) {
      localStorage.setItem(STORAGE_CALENDAR, calendarId);
    }
    refreshCalendarWorkouts();
    if (calendarId) {
      const found = await searchExistingPlan(calendarId);
      if (!found) showStep('step-configure');
    }
  } catch (err) {
    showError('Could not load your calendars: ' + err.message);
    showStep('step-configure');
  }
}

// ── Preview handler ───────────────────────────────────────────────────────────

function onPreview() {
  const raceDateStr = document.getElementById('race-date').value;
  if (!raceDateStr) return showError('Please select a race date.');

  if (!selectedPaces.length) {
    const planId = document.getElementById('plan-select').value;
    const plan   = PLANS.find((p) => p.id === planId);
    if (!(plan && plan.paceOptional)) return showError(plan && plan.bqCategories
      ? 'Please select your BQ category to set your qualifying pace.'
      : 'Please add at least one goal pace.');
  }

  const planId = document.getElementById('plan-select').value;
  const plan   = PLANS.find((p) => p.id === planId);

  selectedEvents = buildEvents(plan, raceDateStr, selectedPaces);
  saveCurrentPlan(planId, raceDateStr, selectedPaces.length ? selectedPaces[0].secPerMile : null);
  updateCurrentPlanNav();
  renderPreview(plan, raceDateStr, selectedPaces, false);
  updateClearButton();
  showStep('step-preview');
}

// ── Add to calendar ───────────────────────────────────────────────────────────

async function onAddToCalendar() {
  const calendarId = document.getElementById('calendar-select').value;
  if (!calendarId) return showError('Please select a calendar.');

  // Remember this calendar for next visit.
  localStorage.setItem(STORAGE_CALENDAR, calendarId);

  setProgressLabel('Adding events to calendar…');
  showStep('step-progress');

  const progressFill = document.getElementById('progress-fill');
  const progressText = document.getElementById('progress-text');

  try {
    const eventsToAdd = getFilteredEvents();
    const ids = await CalendarAPI.createEvents(calendarId, eventsToAdd, (n, total) => {
      progressFill.style.width = Math.round((n / total) * 100) + '%';
      progressText.textContent = `${n} / ${total} events added`;
    });

    // Store in memory so Clear works for the rest of this session.
    savedCalendarId = calendarId;
    savedEventIds   = ids;
    updateClearButton();
    refreshCalendarWorkouts();

    showStep('step-done');
  } catch (err) {
    showStep('step-preview');
    showError('Something went wrong: ' + err.message);
  }
}

// ── Clear plan ────────────────────────────────────────────────────────────────

async function onClearPlan() {
  if (!savedEventIds.length) return showError('No plan events found to clear.');

  if (!confirm(`Remove ${savedEventIds.length} training events from your calendar? This cannot be undone.`)) {
    return;
  }

  setProgressLabel('Removing events from calendar…');
  showStep('step-progress');

  const progressFill = document.getElementById('progress-fill');
  const progressText = document.getElementById('progress-text');

  try {
    await CalendarAPI.deleteEvents(savedCalendarId, savedEventIds, (n, total) => {
      progressFill.style.width = Math.round((n / total) * 100) + '%';
      progressText.textContent = `${n} / ${total} events removed`;
    });

    savedEventIds = [];
    savedCalendarId = null;
    selectedEvents  = [];
    localStorage.removeItem(STORAGE_CURRENT_PLAN);
    updateCurrentPlanNav();
    document.getElementById('plan-summary').innerHTML = '';
    document.getElementById('plan-preview').innerHTML = '';
    updateClearButton();
    refreshCalendarWorkouts();
    showStep('step-configure');
  } catch (err) {
    showStep('step-preview');
    showError('Something went wrong while clearing: ' + err.message);
  }
}
