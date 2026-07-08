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
  race:  { label: 'Race Day',  color: '#2d8abf' },
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

function getPaceForType(type, goalPace) {
  switch (type) {
    case 'easy':  return goalPace + 90;
    case 'walk':  return goalPace + 120;
    case 'long':  return goalPace + 60;
    case 'pace':  return goalPace;
    case 'tempo': return goalPace - 20;
    case 'speed': return goalPace - 45;
    default:      return null;
  }
}

function runTypeLabel(type) {
  return {
    easy:  'Easy Run',
    walk:  'Run / Walk Intervals',
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
    tempo: 'Comfortably hard — you can speak only a few words at a time. Lactate threshold effort.',
    speed: 'Warm up 1–2 mi easy. Run repeats at 5K–10K effort. Cool down 1–2 mi easy.',
    race:  'Trust your training. Start conservative, run your own race, enjoy every mile.',
  }[type] || '';
}

/**
 * Build the calendar event description, including the machine-readable
 * metadata tag that allows the app to reconstruct the plan on future visits.
 */
function buildDescription(day, paces, planId, raceDate) {
  const { miles, type } = day;
  let body;

  if (type === 'race') {
    const paceLines = paces.map((p) => {
      const finishSec = Math.round(p.secPerMile * 26.2);
      return `Goal pace: ${formatPace(p.secPerMile)}  ·  Estimated finish: ${formatTime(finishSec)}`;
    }).join('\n');
    body = [`Race Day — ${miles} mi`, paceLines, '', runTypeTip(type)].join('\n');
  } else {
    const paceLines = paces.map((p) => {
      const typePace = getPaceForType(type, p.secPerMile);
      return typePace ? `Suggested pace: ${formatPace(typePace)}` : null;
    }).filter(Boolean).join('\n');
    const lines = [runTypeLabel(type)];
    if (paceLines) lines.push(paceLines);
    lines.push('', runTypeTip(type));
    body = lines.join('\n');
  }

  // Metadata tag — parsed on future sign-ins to restore the plan.
  const meta = `[marathon-planner: ${planId} | ${raceDate} | ${paces.map((p) => p.secPerMile).join(',')}]`;
  return `${body}\n${meta}`;
}

// ── Metadata parsing ──────────────────────────────────────────────────────────

const META_RE = /\[marathon-planner:\s*([^|\]]+?)\s*\|\s*([^|\]]+?)\s*\|\s*([\d,]+)\s*\]/;

function parseEventMetadata(description = '') {
  const m = description.match(META_RE);
  if (!m) return null;
  const planId   = m[1].trim();
  const raceDate = m[2].trim();
  if (!PLANS.find((p) => p.id === planId)) return null;
  const paces = m[3].split(',').map((s) => {
    const sec = parseInt(s.trim(), 10);
    return PACE_OPTIONS.find((o) => o.secPerMile === sec)
      || { finish: formatTime(Math.round(sec * 26.2)), secPerMile: sec };
  });
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

  plan.schedule.forEach((week, wi) => {
    week.forEach((day, di) => {
      if (day.miles === 0) return;
      const dateStr = addDays(startDateStr, wi * 7 + di);
      const title   = day.type === 'race' ? '26.2 mi — RACE DAY' : `${day.miles} mi`;
      events.push({
        date:        dateStr,
        title,
        description: buildDescription(day, paces, plan.id, raceDateStr),
        type:        day.type,
      });
    });
  });

  return events;
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

    // Store event IDs in memory for potential deletion this session.
    savedCalendarId = calendarId;
    savedEventIds   = events.map((ev) => ev.id);

    // Sync form fields so "Back" works correctly.
    document.getElementById('race-date').value   = config.raceDate;
    document.getElementById('goal-pace').value   = '';
    document.getElementById('plan-select').value = config.planId;
    updatePlanDescription();
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

// ── Plans guide render ────────────────────────────────────────────────────────

function renderPlansGuide() {
  const groups = [
    { level: 'beginner',     label: 'Beginner'     },
    { level: 'intermediate', label: 'Intermediate' },
    { level: 'advanced',     label: 'Advanced'     },
  ];

  const html = groups.map(({ level, label }) => {
    const groupPlans = PLANS.filter((p) => (PLAN_META[p.id] || {}).level === level);
    if (!groupPlans.length) return '';

    const cards = groupPlans.map((plan) => {
      const meta      = PLAN_META[plan.id] || {};
      const weekMiles = plan.schedule.map((w) => w.reduce((s, d) => s + d.miles, 0));
      const peakMiles = Math.max(...weekMiles);
      const peakWeek  = plan.schedule[weekMiles.indexOf(peakMiles)];
      const daysPerWk = peakWeek.filter((d) => d.miles > 0).length;
      const weeks     = plan.schedule.length;

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

const wizardState = { step: 0, answers: {} };

function getWizardQuestions() {
  return WIZARD_QUESTIONS.filter((q) =>
    q.id !== 'mileage' || wizardState.answers.experience !== 'first');
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
  const recs      = scoreWizard(wizardState.answers);
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
    const weekMiles = plan.schedule.map((w) => w.reduce((s, d) => s + d.miles, 0));
    const peakMiles = Math.max(...weekMiles);
    const peakWeek  = plan.schedule[weekMiles.indexOf(peakMiles)];
    const daysPerWk = peakWeek.filter((d) => d.miles > 0).length;
    const reason    = buildMatchReason(plan.id, wizardState.answers);

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

const TAB_VIEWS = ['plan', 'wizard', 'plans', 'heat'];

function switchTab(tabId) {
  TAB_VIEWS.forEach((v) => {
    document.getElementById(`${v}-view`).classList.toggle('hidden', v !== tabId);
  });
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.classList.toggle('tab-active', btn.dataset.tab === tabId);
  });
}

function selectPlanAndBuild(planId) {
  document.getElementById('plan-select').value = planId;
  updatePlanDescription();
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

function renderPreview(plan, raceDateStr, paces, restoredFromCalendar = false, resetFilters = true) {
  // Reset type filters to all types present in this plan.
  if (resetFilters) {
    enabledTypes = new Set(selectedEvents.map((e) => e.type));
  }
  const TOTAL_DAYS   = plan.schedule.length * 7;
  const startDateStr = addDays(raceDateStr, -(TOTAL_DAYS - 1));
  const DAY_LABELS   = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const primaryPace = paces[0].secPerMile;
  const totalMiles  = plan.schedule.flat().reduce((s, d) => s + d.miles, 0);

  const paceDisplay   = paces.map((p) => formatPace(p.secPerMile)).join('<br>');
  const finishDisplay = paces.map((p) => formatTime(Math.round(p.secPerMile * 26.2))).join('<br>');

  // Section label
  document.getElementById('preview-section-label').textContent = restoredFromCalendar
    ? `Plan loaded from calendar  (${savedEventIds.length} events found)`
    : 'Review your plan';

  const summaryRows = [
    ['Plan',        plan.name],
    ['Race date',   formatDisplayDate(raceDateStr)],
    ['Plan start',  formatDisplayDate(startDateStr)],
    ['Goal pace',   paceDisplay],
    ['Est. finish', finishDisplay],
    ['Total miles', totalMiles.toFixed(1) + ' mi'],
  ].map(([label, value]) => `
    <div class="summary-row">
      <span class="summary-label">${label}</span>
      <span class="summary-value">${value}</span>
    </div>
  `).join('');

  document.getElementById('plan-summary').innerHTML =
    `<div class="summary-rows">${summaryRows}</div>`;

  const tbody = plan.schedule.map((week, wi) => {
    const cells = week.map((day) => {
      if (day.miles === 0) {
        const label = day.type === 'cross' ? 'x-train' : 'rest';
        return `<td class="day-${day.type}" data-type="${day.type}"><span class="day-miles">${label}</span></td>`;
      }
      const pace    = getPaceForType(day.type, primaryPace);
      const paceStr = pace ? formatPace(pace) : '';
      return `<td class="day-${day.type}" data-type="${day.type}">
        <span class="day-miles">${day.miles} mi</span>
        <span class="day-pace-hint">${paceStr}</span>
      </td>`;
    }).join('');
    return `<tr><td class="week-num">wk ${wi + 1}</td>${cells}</tr>`;
  }).join('');

  document.getElementById('plan-preview').innerHTML = `
    <div class="table-scroll">
      <table class="plan-table">
        <thead>
          <tr>
            <th></th>
            ${DAY_LABELS.map((d) => `<th>${d}</th>`).join('')}
          </tr>
        </thead>
        <tbody>${tbody}</tbody>
      </table>
    </div>
  `;

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
  if (el && plan) el.textContent = plan.description;
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

// ── Boot ──────────────────────────────────────────────────────────────────────

let selectedEvents = [];

window.addEventListener('load', () => {
  showStep('step-signin');

  // Pace dropdown — each selection adds a pace chip; multiple are supported.
  const paceSelect = document.getElementById('goal-pace');
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'Select a pace to add…';
  paceSelect.appendChild(placeholder);
  PACE_OPTIONS.forEach((opt) => {
    const el = document.createElement('option');
    el.value       = opt.secPerMile;
    el.textContent = `Finish ${opt.finish}  —  ${formatPace(opt.secPerMile)}`;
    paceSelect.appendChild(el);
  });
  paceSelect.value = '';
  paceSelect.addEventListener('change', () => {
    const val = parseInt(paceSelect.value, 10);
    if (!val) return;
    const opt = PACE_OPTIONS.find((o) => o.secPerMile === val);
    if (opt && !selectedPaces.some((p) => p.secPerMile === val)) {
      selectedPaces.push(opt);
      renderPaceTags();
    }
    paceSelect.value = '';
  });

  // Plan dropdown
  const planSelect = document.getElementById('plan-select');
  PLANS.forEach((plan) => {
    const el = document.createElement('option');
    el.value       = plan.id;
    el.textContent = plan.name;
    planSelect.appendChild(el);
  });
  planSelect.addEventListener('change', () => {
    updatePlanDescription();
    selectedPaces = [];
    renderPaceTags();
  });
  updatePlanDescription();

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
      savedEventIds = [];
      updateClearButton();
      const found = await searchExistingPlan(calendarId);
      if (!found) showStep('step-configure');
    });
});

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
    return showError(plan && plan.bqCategories
      ? 'Please select your BQ category to set your qualifying pace.'
      : 'Please add at least one goal pace.');
  }

  const planId = document.getElementById('plan-select').value;
  const plan   = PLANS.find((p) => p.id === planId);

  selectedEvents = buildEvents(plan, raceDateStr, selectedPaces);
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
    document.getElementById('plan-summary').innerHTML = '';
    document.getElementById('plan-preview').innerHTML = '';
    updateClearButton();
    showStep('step-configure');
  } catch (err) {
    showStep('step-preview');
    showError('Something went wrong while clearing: ' + err.message);
  }
}
