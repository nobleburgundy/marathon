// ─────────────────────────────────────────────────────────────────────────────
// Training plan data.
//
// Each plan has N weeks. Each week is an array of 7 days [Mon … Sun].
// Each day: { miles: number, type: string, label?, note?, optional? }
//
// Types:
//   'rest'   – no event created
//   'cross'  – no event created (cross-training / strength)
//   'easy'   – easy aerobic / recovery run
//   'long'   – long run (time on feet)
//   'pace'   – goal race-pace run
//   'tempo'  – lactate threshold / comfortably hard
//   'speed'  – track / interval / hill workout
//   'walk'   – Galloway run-walk interval run
//   'hike'   – walk or hike (time on feet)
//   'race'   – race day (the final race, or a tune-up race mid-plan)
//
// Optional day fields (used by the non-marathon plans, which follow their
// source tables cell by cell):
//   label    – the workout as the source writes it ("5 × 400m", "3 hr run");
//              used for the calendar event title and plan table. Days whose
//              distance isn't given have miles: 0 and rely on the label.
//   note     – the source's own explanation; replaces the generic tip.
//   paceAt   – a race distance whose pace the source names for this workout
//              ("400s at 5K pace"); the suggested pace converts to it.
//   estMin / estMiles – rough size of a session the source gives in time or
//              reps rather than miles; only used for approximate weekly
//              mileage (see estimateDayMiles below).
//   optional – "rest or …" days. Still added to the calendar, marked optional,
//              and left out of weekly mileage totals.
//
// Plan fields: distance (a RACE_DISTANCES id; marathon when absent),
// source { label, url }, paceOptional (goal time not required) and noPaces
// (purely effort-based — no goal-time field at all).
//
// The race always falls on day-index 6 (Sunday) of the last week.
// ─────────────────────────────────────────────────────────────────────────────

// Race distances, in display order. `miles` drives finish-time estimates.
const RACE_DISTANCES = [
  { id: '5k',       label: '5K',            miles: 3.1  },
  { id: '10k',      label: '10K',           miles: 6.2  },
  { id: '10mi',     label: '10 Mile / 15K', miles: 10   },
  { id: 'half',     label: 'Half Marathon', miles: 13.1 },
  { id: 'marathon', label: 'Marathon',      miles: 26.2 },
  { id: '50k',      label: '50K',           miles: 31.1 },
  { id: '100mi',    label: '100 Mile',      miles: 100  },
];

const R    = { miles: 0,    type: 'rest'  };
const X    = { miles: 0,    type: 'cross' };
const RACE = { miles: 26.2, type: 'race'  };
const e = (m) => ({ miles: m, type: 'easy'  });
const l = (m) => ({ miles: m, type: 'long'  });
const p = (m) => ({ miles: m, type: 'pace'  });
const T = (m) => ({ miles: m, type: 'tempo' });
const s = (m) => ({ miles: m, type: 'speed' });
const w = (m) => ({ miles: m, type: 'walk'  });

// ── 1. Hal Higdon Novice 1 ───────────────────────────────────────────────────
const HAL_NOVICE_1 = {
  id: 'hal-novice-1',
  name: 'Hal Higdon — Novice 1 (18 wks)',
  description: 'Ideal for first-time marathoners. 4 run days/week, 18 weeks.',
  schedule: [
    // Wk  Mon   Tue     Wed     Thu     Fri   Sat      Sun
    /*  1 */ [R, e(3),  e(3),  e(3),  X, l(6),   R],
    /*  2 */ [R, e(3),  e(3),  e(3),  X, l(7),   R],
    /*  3 */ [R, e(3),  e(4),  e(3),  X, l(5),   R],
    /*  4 */ [R, e(3),  e(4),  e(3),  X, l(9),   R],
    /*  5 */ [R, e(3),  e(5),  e(3),  X, l(10),  R],
    /*  6 */ [R, e(3),  e(5),  e(3),  X, l(7),   R],
    /*  7 */ [R, e(4),  e(5),  e(4),  X, l(12),  R],
    /*  8 */ [R, e(4),  e(5),  e(4),  X, l(13),  R],
    /*  9 */ [R, e(4),  e(6),  e(4),  X, l(10),  R],
    /* 10 */ [R, e(4),  e(6),  e(4),  X, l(15),  R],
    /* 11 */ [R, e(5),  e(7),  e(5),  X, l(16),  R],
    /* 12 */ [R, e(5),  e(7),  e(5),  X, l(12),  R],
    /* 13 */ [R, e(5),  e(8),  e(5),  X, l(18),  R],
    /* 14 */ [R, e(5),  e(8),  e(5),  X, l(20),  R],
    /* 15 */ [R, e(5),  e(6),  e(5),  X, l(12),  R],
    /* 16 */ [R, e(4),  e(5),  e(4),  X, l(8),   R],
    /* 17 */ [R, e(3),  e(4),  e(3),  X, e(4),   R],
    /* 18 */ [R, e(2),  e(3),  e(2),  R, R,       RACE],
  ]
};

// ── 2. Hal Higdon Novice 2 ───────────────────────────────────────────────────
const HAL_NOVICE_2 = {
  id: 'hal-novice-2',
  name: 'Hal Higdon — Novice 2 (18 wks)',
  description: 'Step up from Novice 1. Adds Wednesday goal-pace runs. 18 weeks.',
  schedule: [
    // Wk  Mon   Tue     Wed     Thu     Fri   Sat      Sun
    /*  1 */ [R, e(3),  p(3),  e(3),  X, l(6),   R],
    /*  2 */ [R, e(3),  p(4),  e(3),  X, l(7),   R],
    /*  3 */ [R, e(3),  p(4),  e(3),  X, l(5),   R],
    /*  4 */ [R, e(4),  p(5),  e(4),  X, l(9),   R],
    /*  5 */ [R, e(4),  p(5),  e(4),  X, l(10),  R],
    /*  6 */ [R, e(4),  p(5),  e(4),  X, l(7),   R],
    /*  7 */ [R, e(5),  p(6),  e(5),  X, l(12),  R],
    /*  8 */ [R, e(5),  p(6),  e(5),  X, l(13),  R],
    /*  9 */ [R, e(5),  p(7),  e(5),  X, l(10),  R],
    /* 10 */ [R, e(5),  p(7),  e(5),  X, l(15),  R],
    /* 11 */ [R, e(6),  p(8),  e(6),  X, l(16),  R],
    /* 12 */ [R, e(6),  p(8),  e(6),  X, l(12),  R],
    /* 13 */ [R, e(6),  p(9),  e(6),  X, l(18),  R],
    /* 14 */ [R, e(6),  p(10), e(6),  X, l(20),  R],
    /* 15 */ [R, e(6),  p(8),  e(6),  X, l(12),  R],
    /* 16 */ [R, e(5),  p(6),  e(5),  X, l(8),   R],
    /* 17 */ [R, e(4),  p(4),  e(4),  X, e(4),   R],
    /* 18 */ [R, e(2),  p(3),  e(2),  R, R,       RACE],
  ]
};

// ── 3. Hal Higdon Intermediate 1 ─────────────────────────────────────────────
const HAL_INTERMEDIATE_1 = {
  id: 'hal-intermediate-1',
  name: 'Hal Higdon — Intermediate 1 (18 wks)',
  description: '5 run days/week. Adds Mon aerobic + Wed pace runs. 18 weeks.',
  schedule: [
    // Wk  Mon     Tue     Wed     Thu     Fri   Sat      Sun
    /*  1 */ [e(3),  e(5),  p(5),  e(5),  R, l(8),   R],
    /*  2 */ [e(3),  e(5),  p(6),  e(5),  R, l(9),   R],
    /*  3 */ [e(3),  e(5),  p(6),  e(5),  R, l(6),   R],
    /*  4 */ [e(3),  e(6),  p(7),  e(6),  R, l(11),  R],
    /*  5 */ [e(3),  e(6),  p(8),  e(6),  R, l(12),  R],
    /*  6 */ [e(3),  e(6),  p(7),  e(6),  R, l(9),   R],
    /*  7 */ [e(4),  e(7),  p(8),  e(7),  R, l(14),  R],
    /*  8 */ [e(4),  e(7),  p(9),  e(7),  R, l(15),  R],
    /*  9 */ [e(4),  e(7),  p(9),  e(7),  R, l(11),  R],
    /* 10 */ [e(4),  e(8),  p(10), e(8),  R, l(17),  R],
    /* 11 */ [e(4),  e(8),  p(10), e(8),  R, l(18),  R],
    /* 12 */ [e(4),  e(8),  p(10), e(8),  R, l(13),  R],
    /* 13 */ [e(5),  e(8),  p(12), e(8),  R, l(20),  R],
    /* 14 */ [e(5),  e(8),  p(12), e(8),  R, l(20),  R],
    /* 15 */ [e(5),  e(8),  p(10), e(8),  R, l(14),  R],
    /* 16 */ [e(4),  e(7),  p(8),  e(7),  R, l(10),  R],
    /* 17 */ [e(3),  e(5),  p(6),  e(5),  R, e(6),   R],
    /* 18 */ [e(3),  e(4),  p(4),  e(3),  R, R,       RACE],
  ]
};

// ── 4. Hal Higdon Intermediate 2 ─────────────────────────────────────────────
const HAL_INTERMEDIATE_2 = {
  id: 'hal-intermediate-2',
  name: 'Hal Higdon — Intermediate 2 (18 wks)',
  description: '6 run days/week. Highest Higdon mileage. Adds Sunday recovery runs. 18 weeks.',
  schedule: [
    // Wk  Mon     Tue     Wed      Thu     Fri   Sat      Sun
    /*  1 */ [e(3),  e(5),  p(5),   e(5),  R, l(8),   e(4)],
    /*  2 */ [e(3),  e(5),  p(6),   e(5),  R, l(9),   e(4)],
    /*  3 */ [e(3),  e(5),  p(6),   e(5),  R, l(6),   e(4)],
    /*  4 */ [e(4),  e(6),  p(7),   e(6),  R, l(11),  e(5)],
    /*  5 */ [e(4),  e(6),  p(8),   e(6),  R, l(12),  e(5)],
    /*  6 */ [e(4),  e(6),  p(7),   e(6),  R, l(9),   e(5)],
    /*  7 */ [e(5),  e(7),  p(9),   e(7),  R, l(14),  e(6)],
    /*  8 */ [e(5),  e(7),  p(10),  e(7),  R, l(15),  e(6)],
    /*  9 */ [e(5),  e(7),  p(9),   e(7),  R, l(11),  e(6)],
    /* 10 */ [e(5),  e(8),  p(11),  e(8),  R, l(17),  e(7)],
    /* 11 */ [e(5),  e(8),  p(12),  e(8),  R, l(18),  e(7)],
    /* 12 */ [e(5),  e(8),  p(11),  e(8),  R, l(13),  e(7)],
    /* 13 */ [e(6),  e(9),  p(13),  e(9),  R, l(20),  e(8)],
    /* 14 */ [e(6),  e(9),  p(13),  e(9),  R, l(20),  e(8)],
    /* 15 */ [e(6),  e(8),  p(10),  e(8),  R, l(14),  e(7)],
    /* 16 */ [e(5),  e(7),  p(8),   e(7),  R, l(10),  e(6)],
    /* 17 */ [e(4),  e(5),  p(6),   e(5),  R, e(6),   e(4)],
    /* 18 */ [e(3),  e(4),  p(4),   e(3),  R, R,       RACE],
  ]
};

// ── 5. FIRST — Run Less Run Faster ───────────────────────────────────────────
// 3 quality runs/week — speed intervals (Tue), tempo (Thu), long run (Sat).
// Mon and Wed are cross-training. 16-week plan.
// Based on the Furman Institute of Running & Scientific Training methodology.
const FIRST = {
  id: 'first',
  name: 'FIRST — Run Less, Run Faster (16 wks)',
  description: '3 quality runs/week + 2 cross-train days. No junk miles. 16 weeks.',
  schedule: [
    // Wk  Mon   Tue       Wed   Thu        Fri   Sat      Sun
    /*  1 */ [X, s(5),  X, T(4),  R, l(10),  R],
    /*  2 */ [X, s(5),  X, T(5),  R, l(11),  R],
    /*  3 */ [X, s(6),  X, T(5),  R, l(13),  R],
    /*  4 */ [X, s(5),  X, T(4),  R, l(9),   R],
    /*  5 */ [X, s(6),  X, T(6),  R, l(15),  R],
    /*  6 */ [X, s(7),  X, T(6),  R, l(16),  R],
    /*  7 */ [X, s(7),  X, T(7),  R, l(17),  R],
    /*  8 */ [X, s(6),  X, T(5),  R, l(13),  R],
    /*  9 */ [X, s(7),  X, T(7),  R, l(18),  R],
    /* 10 */ [X, s(8),  X, T(7),  R, l(19),  R],
    /* 11 */ [X, s(8),  X, T(8),  R, l(20),  R],
    /* 12 */ [X, s(7),  X, T(6),  R, l(14),  R],
    /* 13 */ [X, s(8),  X, T(8),  R, l(20),  R],
    /* 14 */ [X, s(8),  X, T(8),  R, l(20),  R],
    /* 15 */ [X, s(6),  X, T(5),  R, l(12),  R],
    /* 16 */ [X, s(4),  X, T(3),  R, R,       RACE],
  ]
};

// ── 6. Galloway Run/Walk ──────────────────────────────────────────────────────
// Jeff Galloway's method: run-walk intervals throughout every run.
// 3 days/week. The walk breaks make long distances accessible.
// Descriptions include interval guidance.
const GALLOWAY = {
  id: 'galloway',
  name: 'Galloway — Run/Walk Method (18 wks)',
  description: '3 days/week using run-walk intervals throughout. 18 weeks.',
  schedule: [
    // Wk  Mon   Tue     Wed   Thu     Fri   Sat      Sun
    /*  1 */ [R, w(2),  R, w(2),  R, w(5),   R],
    /*  2 */ [R, w(3),  R, w(3),  R, w(6),   R],
    /*  3 */ [R, w(3),  R, w(3),  R, w(7),   R],
    /*  4 */ [R, w(3),  R, w(3),  R, w(8),   R],
    /*  5 */ [R, w(3),  R, w(3),  R, w(10),  R],
    /*  6 */ [R, w(4),  R, w(4),  R, w(11),  R],
    /*  7 */ [R, w(4),  R, w(4),  R, w(12),  R],
    /*  8 */ [R, w(4),  R, w(4),  R, w(14),  R],
    /*  9 */ [R, w(4),  R, w(4),  R, w(15),  R],
    /* 10 */ [R, w(4),  R, w(4),  R, w(16),  R],
    /* 11 */ [R, w(5),  R, w(5),  R, w(18),  R],
    /* 12 */ [R, w(5),  R, w(5),  R, w(20),  R],
    /* 13 */ [R, w(5),  R, w(5),  R, w(22),  R],
    /* 14 */ [R, w(5),  R, w(5),  R, w(24),  R],
    /* 15 */ [R, w(4),  R, w(4),  R, w(18),  R],
    /* 16 */ [R, w(4),  R, w(4),  R, w(14),  R],
    /* 17 */ [R, w(3),  R, w(3),  R, w(8),   R],
    /* 18 */ [R, w(2),  R, w(2),  R, R,       RACE],
  ]
};

// ── 7. Pfitzinger 18/55 ───────────────────────────────────────────────────────
// From Pete Pfitzinger's "Advanced Marathoning."
// 6 days/week, peaks at ~55 mi/week. For experienced runners targeting
// time improvement. Mileage shown is approximate.
// Mon=recovery, Tue=GA, Wed=MLR, Thu=recovery, Fri=LT, Sat=Long, Sun=recovery
const PFITZINGER = {
  id: 'pfitzinger-18-55',
  name: 'Pfitzinger — 18/55 (18 wks)',
  description: '6 days/week, peaks ~55 mi/wk. For experienced runners. 18 weeks.',
  schedule: [
    // Wk  Mon     Tue     Wed      Thu     Fri      Sat      Sun
    /*  1 */ [e(5), e(8),  l(10),  e(5),  T(6),  l(13),  e(4)],
    /*  2 */ [e(5), e(8),  l(11),  e(5),  T(6),  l(14),  e(4)],
    /*  3 */ [e(5), e(8),  l(11),  e(5),  T(7),  l(15),  e(4)],
    /*  4 */ [e(4), e(7),  l(9),   e(4),  T(5),  l(11),  R    ],
    /*  5 */ [e(5), e(9),  l(12),  e(5),  T(7),  l(16),  e(4)],
    /*  6 */ [e(5), e(9),  l(12),  e(5),  T(8),  l(17),  e(5)],
    /*  7 */ [e(5), e(9),  l(13),  e(5),  T(8),  l(18),  e(5)],
    /*  8 */ [e(4), e(8),  l(10),  e(4),  T(6),  l(13),  R    ],
    /*  9 */ [e(5), e(9),  l(13),  e(5),  T(9),  l(19),  e(5)],
    /* 10 */ [e(5), e(9),  l(14),  e(5),  T(9),  l(20),  e(5)],
    /* 11 */ [e(5), e(10), l(14),  e(5),  T(9),  l(20),  e(5)],
    /* 12 */ [e(4), e(8),  l(11),  e(4),  T(7),  l(15),  R    ],
    /* 13 */ [e(5), e(10), l(15),  e(5),  T(10), l(20),  e(5)],
    /* 14 */ [e(5), e(10), l(15),  e(5),  T(10), l(20),  e(5)],
    /* 15 */ [e(5), e(8),  l(12),  e(5),  T(8),  l(16),  e(4)],
    /* 16 */ [e(4), e(7),  l(10),  e(4),  T(7),  l(12),  e(4)],
    /* 17 */ [e(4), e(6),  l(8),   e(4),  T(5),  e(8),   e(3)],
    /* 18 */ [e(3), e(5),  p(5),   e(3),  e(3),  R,       RACE],
  ]
};

// ── 8. Boston Qualifier (BQ) ──────────────────────────────────────────────────
// High-intensity 18-week plan targeting Boston Qualifying times.
// 6 days/week with tempo and pace work. Assumes a solid base.
// Pace is set by official BAA qualifying standards for your age group — not
// a user-selected finish time. bqCategories drives the pace selector UI.
const BOSTON_QUALIFIER = {
  id: 'boston-qualifier',
  name: 'Boston Qualifier (18 wks)',
  description: 'Targets BAA qualifying standards. Tempo + pace work, 6 days/week. 18 weeks.',
  bqCategories: [
    { label: 'Men 18–34',    finish: '3:00:00', secPerMile: 412 },
    { label: 'Men 35–39',    finish: '3:05:00', secPerMile: 424 },
    { label: 'Men 40–44',    finish: '3:10:00', secPerMile: 435 },
    { label: 'Men 45–49',    finish: '3:15:00', secPerMile: 447 },
    { label: 'Men 50–54',    finish: '3:20:00', secPerMile: 458 },
    { label: 'Men 55–59',    finish: '3:25:00', secPerMile: 470 },
    { label: 'Men 60–64',    finish: '3:30:00', secPerMile: 481 },
    { label: 'Men 65–69',    finish: '3:35:00', secPerMile: 492 },
    { label: 'Men 70–74',    finish: '3:40:00', secPerMile: 504 },
    { label: 'Men 75–79',    finish: '3:45:00', secPerMile: 515 },
    { label: 'Men 80+',      finish: '3:50:00', secPerMile: 527 },
    { label: 'Women 18–34',  finish: '3:30:00', secPerMile: 481 },
    { label: 'Women 35–39',  finish: '3:35:00', secPerMile: 492 },
    { label: 'Women 40–44',  finish: '3:40:00', secPerMile: 504 },
    { label: 'Women 45–49',  finish: '3:45:00', secPerMile: 515 },
    { label: 'Women 50–54',  finish: '3:50:00', secPerMile: 527 },
    { label: 'Women 55–59',  finish: '3:55:00', secPerMile: 538 },
    { label: 'Women 60–64',  finish: '4:00:00', secPerMile: 550 },
    { label: 'Women 65–69',  finish: '4:05:00', secPerMile: 561 },
    { label: 'Women 70–74',  finish: '4:10:00', secPerMile: 573 },
    { label: 'Women 75–79',  finish: '4:15:00', secPerMile: 584 },
    { label: 'Women 80+',    finish: '4:20:00', secPerMile: 595 },
  ],
  schedule: [
    // Wk  Mon     Tue      Wed      Thu     Fri   Sat      Sun
    /*  1 */ [e(5), T(6),  p(6),   e(6),  R, l(13),  e(5)],
    /*  2 */ [e(5), T(7),  p(7),   e(6),  R, l(14),  e(5)],
    /*  3 */ [e(5), T(7),  p(7),   e(6),  R, l(15),  e(5)],
    /*  4 */ [e(4), T(5),  p(5),   e(5),  R, l(11),  R    ],
    /*  5 */ [e(5), T(8),  p(8),   e(7),  R, l(16),  e(6)],
    /*  6 */ [e(5), T(8),  p(8),   e(7),  R, l(17),  e(6)],
    /*  7 */ [e(6), T(9),  p(9),   e(7),  R, l(18),  e(6)],
    /*  8 */ [e(4), T(6),  p(6),   e(5),  R, l(13),  R    ],
    /*  9 */ [e(6), T(9),  p(10),  e(7),  R, l(19),  e(6)],
    /* 10 */ [e(6), T(10), p(10),  e(8),  R, l(20),  e(7)],
    /* 11 */ [e(6), T(10), p(11),  e(8),  R, l(20),  e(7)],
    /* 12 */ [e(5), T(7),  p(8),   e(6),  R, l(14),  R    ],
    /* 13 */ [e(6), T(10), p(12),  e(8),  R, l(20),  e(7)],
    /* 14 */ [e(6), T(10), p(12),  e(8),  R, l(20),  e(7)],
    /* 15 */ [e(5), T(8),  p(9),   e(7),  R, l(15),  e(6)],
    /* 16 */ [e(5), T(7),  p(7),   e(6),  R, l(12),  e(5)],
    /* 17 */ [e(4), T(5),  p(5),   e(5),  R, e(8),   e(4)],
    /* 18 */ [e(3), T(4),  p(4),   e(3),  R, R,       RACE],
  ]
};

// ── 9. Hansons Beginner ───────────────────────────────────────────────────────
// Based on the Hansons Marathon Method by Luke & Kevin Hanson.
// 6 days/week, Monday rest. Long run deliberately capped at 16 miles to
// reduce breakdown risk. Weeks 1–6 are base-building (all easy). Weeks 7–18
// introduce SOS workouts: Speed (Tue) at 5K–10K effort and Strength (Thu) at
// marathon goal pace, simulating late-race fatigue on already-tired legs.
const HANSONS_BEGINNER = {
  id: 'hansons-beginner',
  name: 'Hansons — Beginner (18 wks)',
  description: 'Long run capped at 16 mi. Speed + strength SOS workouts. 6 days/week. 18 weeks.',
  schedule: [
    // Wk   Mon    Tue      Wed    Thu      Fri    Sat      Sun
    /*  1 */ [R, e(5),  e(5),  e(5),  e(5),  l(6),  e(5)],
    /*  2 */ [R, e(6),  e(6),  e(6),  e(6),  l(10), e(6)],
    /*  3 */ [R, e(6),  e(7),  e(6),  e(6),  l(10), e(6)],
    /*  4 */ [R, e(6),  e(7),  e(6),  e(6),  l(12), e(6)],
    /*  5 */ [R, e(6),  e(7),  e(6),  e(6),  l(12), e(7)],
    /*  6 */ [R, e(7),  e(7),  e(7),  e(7),  l(14), e(7)],
    /*  7 */ [R, s(7),  e(7),  p(7),  e(7),  l(14), e(7)],
    /*  8 */ [R, s(7),  e(7),  p(7),  e(7),  l(14), e(7)],
    /*  9 */ [R, s(8),  e(7),  p(8),  e(7),  l(15), e(8)],
    /* 10 */ [R, s(8),  e(8),  p(8),  e(8),  l(15), e(8)],
    /* 11 */ [R, s(9),  e(8),  p(9),  e(8),  l(16), e(8)],
    /* 12 */ [R, s(9),  e(8),  p(9),  e(8),  l(16), e(8)],
    /* 13 */ [R, s(9),  e(8),  p(9),  e(8),  l(16), e(8)],
    /* 14 */ [R, s(8),  e(7),  p(8),  e(7),  l(16), e(8)],
    /* 15 */ [R, s(7),  e(6),  p(7),  e(6),  l(14), e(7)],
    /* 16 */ [R, s(7),  e(6),  p(7),  e(6),  l(12), e(6)],
    /* 17 */ [R, s(5),  e(5),  p(5),  e(5),  l(8),  e(5)],
    /* 18 */ [R, e(3),  e(3),  e(3),  R,     e(3),  RACE],
  ]
};

// ── 10. 80/20 Running ─────────────────────────────────────────────────────────
// Based on Matt Fitzgerald's 80/20 Running principle: 80% of weekly mileage
// at truly easy aerobic effort (zone 1–2), 20% at moderate-to-hard effort.
// Most runners run easy days too hard, accumulating fatigue that leads to
// overuse injury. One quality session mid-week (alternating intervals/tempo),
// long runs always at easy conversational effort. 5–6 days/week. 18 weeks.
const EIGHT_TWENTY = {
  id: '80-20-running',
  name: '80/20 Running — Fitzgerald (18 wks)',
  description: '80% easy effort. 1 quality session/week. Prevents chronic fatigue. 18 weeks.',
  schedule: [
    // Wk   Mon    Tue     Wed      Thu     Fri    Sat      Sun
    /*  1 */ [R, e(4),  T(5),  e(4),  R,     l(10), e(4)],
    /*  2 */ [R, e(5),  s(5),  e(5),  R,     l(11), e(5)],
    /*  3 */ [R, e(5),  T(6),  e(5),  e(4),  l(12), e(5)],
    /*  4 */ [R, e(4),  s(4),  e(4),  R,     l(9),  e(4)],
    /*  5 */ [R, e(6),  T(7),  e(5),  e(4),  l(14), e(5)],
    /*  6 */ [R, e(6),  s(7),  e(6),  e(4),  l(15), e(5)],
    /*  7 */ [R, e(6),  T(8),  e(6),  e(4),  l(16), e(6)],
    /*  8 */ [R, e(5),  s(6),  e(5),  e(4),  l(12), e(5)],
    /*  9 */ [R, e(7),  T(9),  e(7),  e(5),  l(17), e(6)],
    /* 10 */ [R, e(7),  s(9),  e(7),  e(5),  l(18), e(7)],
    /* 11 */ [R, e(7),  T(9),  e(7),  e(5),  l(20), e(7)],
    /* 12 */ [R, e(6),  s(7),  e(6),  e(4),  l(14), e(6)],
    /* 13 */ [R, e(8),  T(10), e(8),  e(5),  l(20), e(7)],
    /* 14 */ [R, e(8),  s(10), e(8),  e(5),  l(20), e(7)],
    /* 15 */ [R, e(7),  T(8),  e(7),  e(5),  l(18), e(6)],
    /* 16 */ [R, e(6),  s(7),  e(6),  R,     l(14), e(5)],
    /* 17 */ [R, e(5),  T(5),  e(5),  R,     l(8),  e(4)],
    /* 18 */ [R, e(4),  e(3),  e(3),  R,     e(3),  RACE],
  ]
};

// ── 11. MAF Method ────────────────────────────────────────────────────────────
// Based on Phil Maffetone's Maximum Aerobic Function (MAF) method.
// Every run is kept at or below the MAF heart rate: 180 minus age (bpm).
// No speedwork, no tempo — pure aerobic base development for 20 weeks.
// Early runs will feel very slow; aerobic efficiency builds progressively.
// The extra 2 weeks vs standard plans allow the aerobic base to fully develop.
// 5 days/week. 20 weeks.
const MAF = {
  id: 'maf',
  name: 'MAF Method — Maffetone (20 wks)',
  description: 'All runs at aerobic heart rate (180 − age bpm). No speedwork. 5 days/week. 20 weeks.',
  schedule: [
    // Wk   Mon    Tue     Wed     Thu    Fri     Sat      Sun
    /*  1 */ [R, e(3),  e(4),  R, e(3),  l(7),  e(4)],
    /*  2 */ [R, e(4),  e(4),  R, e(4),  l(8),  e(4)],
    /*  3 */ [R, e(4),  e(5),  R, e(4),  l(9),  e(4)],
    /*  4 */ [R, e(4),  e(4),  R, e(3),  l(8),  e(4)],
    /*  5 */ [R, e(5),  e(5),  R, e(5),  l(10), e(5)],
    /*  6 */ [R, e(5),  e(6),  R, e(5),  l(11), e(5)],
    /*  7 */ [R, e(5),  e(6),  R, e(5),  l(12), e(5)],
    /*  8 */ [R, e(5),  e(5),  R, e(4),  l(10), e(5)],
    /*  9 */ [R, e(6),  e(6),  R, e(6),  l(13), e(6)],
    /* 10 */ [R, e(6),  e(7),  R, e(6),  l(14), e(6)],
    /* 11 */ [R, e(6),  e(7),  R, e(6),  l(15), e(6)],
    /* 12 */ [R, e(5),  e(6),  R, e(5),  l(12), e(5)],
    /* 13 */ [R, e(7),  e(7),  R, e(7),  l(16), e(7)],
    /* 14 */ [R, e(7),  e(8),  R, e(7),  l(17), e(7)],
    /* 15 */ [R, e(7),  e(8),  R, e(7),  l(18), e(7)],
    /* 16 */ [R, e(6),  e(7),  R, e(6),  l(16), e(6)],
    /* 17 */ [R, e(6),  e(6),  R, e(6),  l(13), e(6)],
    /* 18 */ [R, e(5),  e(5),  R, e(5),  l(10), e(5)],
    /* 19 */ [R, e(4),  e(4),  R, e(4),  l(7),  e(4)],
    /* 20 */ [R, e(3),  e(3),  R, e(3),  R,     RACE],
  ]
};

// ── 12. Hal Higdon Novice Supreme ────────────────────────────────────────────
// 30-week plan designed for first-time marathoners who want maximum preparation
// time. Starts with run/walk intervals in weeks 1–4, builds a full aerobic
// base through week 12, then follows a standard novice progression through
// week 30. Cross-training Wednesday throughout keeps impact low.
const HAL_NOVICE_SUPREME = {
  id: 'hal-novice-supreme',
  name: 'Hal Higdon — Novice Supreme (30 wks)',
  description: 'Maximum base-building time. Starts with walk/run. Cross-train Wed. 30 weeks.',
  schedule: [
    // Wk   Mon    Tue     Wed   Thu     Fri    Sat      Sun
    /*  1 */ [R, w(2),  X, w(2),  R, w(3),  R],
    /*  2 */ [R, w(2),  X, w(2),  R, w(4),  R],
    /*  3 */ [R, e(2),  X, e(2),  R, w(4),  R],
    /*  4 */ [R, e(2),  X, e(2),  R, e(5),  R],
    /*  5 */ [R, e(3),  X, e(3),  R, e(5),  R],
    /*  6 */ [R, e(3),  X, e(3),  R, e(6),  R],
    /*  7 */ [R, e(3),  X, e(3),  R, e(7),  R],
    /*  8 */ [R, e(3),  X, e(3),  R, e(5),  R],
    /*  9 */ [R, e(3),  X, e(3),  R, e(8),  R],
    /* 10 */ [R, e(3),  X, e(3),  R, e(9),  R],
    /* 11 */ [R, e(4),  X, e(4),  R, e(10), R],
    /* 12 */ [R, e(3),  X, e(3),  R, e(7),  R],
    /* 13 */ [R, e(3),  X, e(3),  R, l(11), R],
    /* 14 */ [R, e(3),  X, e(3),  R, l(12), R],
    /* 15 */ [R, e(3),  X, e(4),  R, l(8),  R],
    /* 16 */ [R, e(4),  X, e(4),  R, l(13), R],
    /* 17 */ [R, e(4),  X, e(4),  R, l(14), R],
    /* 18 */ [R, e(4),  X, e(5),  R, l(10), R],
    /* 19 */ [R, e(5),  X, e(5),  R, l(15), R],
    /* 20 */ [R, e(5),  X, e(5),  R, l(16), R],
    /* 21 */ [R, e(5),  X, e(5),  R, l(12), R],
    /* 22 */ [R, e(5),  X, e(5),  R, l(18), R],
    /* 23 */ [R, e(5),  X, e(6),  R, l(19), R],
    /* 24 */ [R, e(5),  X, e(6),  R, l(20), R],
    /* 25 */ [R, e(5),  X, e(6),  R, l(20), R],
    /* 26 */ [R, e(5),  X, e(5),  R, l(13), R],
    /* 27 */ [R, e(4),  X, e(4),  R, l(10), R],
    /* 28 */ [R, e(4),  X, e(4),  R, l(8),  R],
    /* 29 */ [R, e(3),  X, e(3),  R, e(5),  R],
    /* 30 */ [R, e(2),  X, e(2),  R, R,     RACE],
  ]
};

// ── 13. Jack Daniels 2Q Plan ─────────────────────────────────────────────────
// Based on Jack Daniels' "Running Formula." The 2Q plan uses two quality
// sessions per week in a four-phase structure:
//   Phase I  (wks 1–4):  Foundation — easy running only, building aerobic base
//   Phase II (wks 5–8):  Transition — introduces threshold (T) work
//   Phase III (wks 9–14): Quality — intervals (I) + threshold, long run grows
//   Phase IV (wks 15–18): Peak/Taper — marathon pace (M) replaces intervals
// Pace types: T = lactate threshold, I = intervals (speed), M = marathon pace.
const JACK_DANIELS = {
  id: 'jack-daniels-2q',
  name: 'Jack Daniels — 2Q Plan (18 wks)',
  description: 'Phase-based: Foundation → Threshold → Intervals → Race pace. 6 days/week. 18 weeks.',
  schedule: [
    // Wk   Mon    Tue      Wed    Thu      Fri    Sat      Sun
    /*  1 */ [R, e(6),  e(7),  e(6),  e(5),  l(10), e(5)],
    /*  2 */ [R, e(6),  e(8),  e(6),  e(5),  l(11), e(5)],
    /*  3 */ [R, e(7),  e(8),  e(6),  e(5),  l(12), e(5)],
    /*  4 */ [R, e(7),  e(8),  e(7),  e(5),  l(10), e(5)],
    /*  5 */ [R, T(8),  e(7),  e(7),  e(5),  l(13), e(5)],
    /*  6 */ [R, T(8),  e(7),  T(7),  e(5),  l(14), e(5)],
    /*  7 */ [R, T(9),  e(7),  T(8),  e(6),  l(15), e(6)],
    /*  8 */ [R, T(8),  e(7),  T(7),  e(5),  l(11), e(5)],
    /*  9 */ [R, s(9),  e(8),  T(8),  e(6),  l(16), e(6)],
    /* 10 */ [R, s(10), e(8),  T(9),  e(6),  l(17), e(6)],
    /* 11 */ [R, s(10), e(8),  T(9),  e(7),  l(18), e(6)],
    /* 12 */ [R, s(9),  e(7),  T(8),  e(6),  l(13), e(5)],
    /* 13 */ [R, s(10), e(8),  p(10), e(7),  l(20), e(7)],
    /* 14 */ [R, s(10), e(8),  p(10), e(7),  l(20), e(7)],
    /* 15 */ [R, s(9),  e(7),  p(9),  e(6),  l(16), e(6)],
    /* 16 */ [R, s(8),  e(6),  T(7),  e(5),  l(12), e(5)],
    /* 17 */ [R, s(6),  e(5),  T(5),  e(4),  l(8),  e(4)],
    /* 18 */ [R, e(4),  e(3),  T(3),  e(3),  R,     RACE],
  ]
};

// ═════════════════════════════════════════════════════════════════════════════
// Other race distances. Schedules are transcribed cell by cell from each
// source's published table (see `source`). Where a cell gives time or a
// workout instead of a distance, miles is 0 and the label carries it.
// ═════════════════════════════════════════════════════════════════════════════

const HAL_TEMPO_NOTE = 'Tempo run: a continuous run that starts easy, builds to near 10K race pace in the middle, then eases back down for the last few minutes.';
const HAL_400_NOTE   = 'Run 400 meters hard at about 5K race pace, then recover by jogging and/or walking 400 meters. Warm up and cool down with easy running.';
const HAL_800_NOTE   = 'Run 800 meters at about 5K race pace, then recover by jogging and/or walking. Warm up and cool down with easy running.';

// ── Mileage estimates for sessions given in time or reps ────────────────────
// Rough on purpose — they only feed the "~N mi" weekly totals.
const EST_WARMUP_MIN = 20;   // warm-up + cool-down around timed workouts
const EST_HIKE_MIN_PER_MILE = 27;
// Hilly hike pace by Naismith's rule (3 mph + 1 hr per 2,000 ft of ascent),
// assuming a ~10% average grade with about half the distance uphill:
// 20 min/mi + (0.5 × 528 ft ÷ 2,000 ft × 60 min) ≈ 28 min/mi → ~27 to round.
const EST_WALK_MIN_PER_MILE = 20;  // flat walking, 3 mph

/** Hours in a label like "1.5 hr run" or "4–5h hilly hike" (ranges use the midpoint). */
function labelHours(label) {
  const m = label.match(/^(\d+(?:\.\d+)?)(?:[–-](\d+(?:\.\d+)?))?\s*(?:hr|h)\b/);
  if (!m) return 0;
  return m[2] ? (Number(m[1]) + Number(m[2])) / 2 : Number(m[1]);
}

const rl   = (label)        => ({ miles: 0, type: 'rest',  label });
const xt   = (label)        => ({ miles: 0, type: 'cross', label });
const hk   = (label, note)  => {
  const hours = labelHours(label);
  const estMiles = hours
    ? hours * 60 / EST_HIKE_MIN_PER_MILE                                   // "6–7h hilly hike"
    : parseFloat(label) / EST_WALK_MIN_PER_MILE;                            // "30 min walk"
  return { miles: 0, type: 'hike', label, estMiles, ...(note ? { note } : {}) };
};
// Hal's tempo minutes already include the easy start and finish.
const tmp  = (min)          => ({ miles: 0, type: 'tempo', label: `${min} min tempo`, note: HAL_TEMPO_NOTE, paceAt: '10k', estMin: min });
// Reps + an equal 400m recovery jog each, plus ~2 mi warm-up/cool-down.
const r400 = (n)            => ({ miles: 0, type: 'speed', label: `${n} × 400m`, note: HAL_400_NOTE, paceAt: '5k', estMiles: n * 0.5 + 2 });
const r800 = (n)            => ({ miles: 0, type: 'speed', label: `${n} × 800m`, note: HAL_800_NOTE, paceAt: '5k', estMiles: n * 0.75 + 2 });
const fast = (m)            => ({ miles: m, type: 'tempo', label: `${m} mi fast`, note: 'Run somewhat faster than on a regular run day — not race pace.' });
const es   = (m)            => ({ miles: m, type: 'easy',  label: `${m} mi + strength`, note: 'Easy run, followed by strength training.' });
const opt  = (m, label)     => ({ miles: m, type: 'easy',  label, optional: true });
const orx  = (m)            => opt(m, `${m} mi run or cross`);
const tl   = (label)        => ({ miles: 0, type: 'long',  label, estMin: labelHours(label) * 60 });   // time-based long run
const te   = (label)        => ({ miles: 0, type: 'easy',  label, estMin: labelHours(label) * 60 });   // time-based easy run
const tp   = (label)        => ({ miles: 0, type: 'pace',  label, estMin: labelHours(label) * 60 });   // time-based race-pace run
const tune = (miles, label, note) => ({ miles, type: 'race', label, note: note || 'Tune-up race. Race it, or run it as a hard workout, then recover.' });
const fin  = (miles, label) => ({ miles, type: 'race', label });

const RACE_5K   = fin(3.1,  '5K Race');
const RACE_10K  = fin(6.2,  '10K Race');
const RACE_10MI = fin(10,   '10 Mile / 15K Race');
const RACE_HALF = fin(13.1, 'Half Marathon');
const RACE_50K  = fin(31.1, '50K Race');
const RACE_100  = fin(100,  '100 Mile Race');

const SS  = xt('stretch & strengthen');
const REW = rl('rest or run/walk');
const RER = rl('rest or easy run');
const x   = (min) => xt(`${min} min cross`);
const wk  = (min) => hk(`${min} min walk`);
const T5K  = tune(3.1, '5K Race');
const T10K = tune(6.2, '10K Race');

// ── Hal Higdon 5K Novice ────────────────────────────────────────────────────
const HAL_5K_NOVICE = {
  id: 'hal-5k-novice',
  distance: '5k',
  name: 'Hal Higdon — 5K Novice (8 wks)',
  description: 'For beginners. 3 short runs plus a walk each week; longest run 3 miles. 8 weeks.',
  source: { label: 'halhigdon.com', url: 'https://www.halhigdon.com/training-programs/5k-training/novice-5k/' },
  schedule: [
    // Wk   Mon   Tue      Wed   Thu      Fri  Sat      Sun
    /* 1 */ [REW, e(1.5),  REW, e(1.5),  R,   e(1.5),  wk(30)],
    /* 2 */ [REW, e(1.75), REW, e(1.5),  R,   e(1.75), wk(35)],
    /* 3 */ [REW, e(2),    REW, e(1.5),  R,   e(2),    wk(40)],
    /* 4 */ [REW, e(2.25), REW, e(1.5),  R,   e(2.25), wk(45)],
    /* 5 */ [REW, e(2.5),  REW, e(2),    R,   e(2.5),  wk(50)],
    /* 6 */ [REW, e(2.75), REW, e(2),    R,   e(2.75), wk(55)],
    /* 7 */ [REW, e(3),    REW, e(2),    R,   e(3),    wk(60)],
    /* 8 */ [REW, e(3),    REW, e(2),    R,   R,       RACE_5K],
  ]
};

// ── Hal Higdon 5K Intermediate ──────────────────────────────────────────────
const HAL_5K_INTERMEDIATE = {
  id: 'hal-5k-intermediate',
  distance: '5k',
  name: 'Hal Higdon — 5K Intermediate (8 wks)',
  description: 'For experienced runners chasing a PR. 400m repeats, tempo runs, and a 5K test in week 4. 8 weeks.',
  source: { label: 'halhigdon.com', url: 'https://www.halhigdon.com/training-programs/5k-training/intermediate-5k/' },
  schedule: [
    // Wk   Mon Tue   Wed      Thu   Fri Sat      Sun
    /* 1 */ [R, e(3), r400(5), e(3), R, e(3),    l(5)],
    /* 2 */ [R, e(3), tmp(30), e(3), R, fast(3), l(5)],
    /* 3 */ [R, e(3), r400(6), e(3), R, e(4),    l(6)],
    /* 4 */ [R, e(3), tmp(35), e(3), R, R,       tune(3.1, '5K Test')],
    /* 5 */ [R, e(3), r400(7), e(3), R, fast(4), l(6)],
    /* 6 */ [R, e(3), tmp(40), e(3), R, e(5),    l(7)],
    /* 7 */ [R, e(3), r400(8), e(3), R, fast(5), l(7)],
    /* 8 */ [R, e(3), tmp(30), e(2), R, R,       RACE_5K],
  ]
};

// ── Hal Higdon 10K Novice ───────────────────────────────────────────────────
const HAL_10K_NOVICE = {
  id: 'hal-10k-novice',
  distance: '10k',
  name: 'Hal Higdon — 10K Novice (8 wks)',
  description: 'Gentle, low-mileage plan. 3 runs plus 2 cross-training days a week; longest run 5.5 miles. 8 weeks.',
  source: { label: 'halhigdon.com', url: 'https://www.halhigdon.com/training-programs/10k-training/novice-10k/' },
  schedule: [
    // Wk   Mon Tue     Wed    Thu   Fri Sat    Sun
    /* 1 */ [R, e(2.5), x(30), e(2), R, x(40), l(3)],
    /* 2 */ [R, e(2.5), x(30), e(2), R, x(40), l(3.5)],
    /* 3 */ [R, e(2.5), x(35), e(2), R, x(50), l(4)],
    /* 4 */ [R, e(3),   x(35), e(2), R, x(50), l(4)],
    /* 5 */ [R, e(3),   x(40), e(2), R, x(60), l(4.5)],
    /* 6 */ [R, e(3),   x(40), e(2), R, x(60), l(5)],
    /* 7 */ [R, e(3),   x(45), e(2), R, x(60), l(5.5)],
    /* 8 */ [R, e(3),   x(30), e(2), R, R,     RACE_10K],
  ]
};

// ── Hal Higdon 10K Intermediate ─────────────────────────────────────────────
const HAL_10K_INTERMEDIATE = {
  id: 'hal-10k-intermediate',
  distance: '10k',
  name: 'Hal Higdon — 10K Intermediate (8 wks)',
  description: 'For runners averaging 15–25 mi/week. Alternating 400m repeats and tempo runs, with a 5K tune-up. 8 weeks.',
  source: { label: 'halhigdon.com', url: 'https://www.halhigdon.com/training-programs/10k-training/intermediate-10k/' },
  schedule: [
    // Wk   Mon   Tue     Wed       Thu   Fri Sat    Sun
    /* 1 */ [e(3), e(3),   tmp(35),  e(3), R, x(60), l(4)],
    /* 2 */ [e(3), e(3.5), r400(8),  e(4), R, x(60), l(5)],
    /* 3 */ [e(3), e(4),   tmp(40),  e(3), R, x(60), l(6)],
    /* 4 */ [e(3), e(4.5), r400(9),  e(4), R, R,     T5K],
    /* 5 */ [e(3), e(5),   tmp(45),  e(3), R, x(60), l(6)],
    /* 6 */ [e(3), e(5.5), r400(10), e(4), R, x(60), l(7)],
    /* 7 */ [e(3), e(6),   tmp(50),  e(4), R, x(60), l(8)],
    /* 8 */ [e(3), e(3),   r400(5),  { miles: 2, type: 'easy', label: '1–3 mi run' }, R, R, RACE_10K],
  ]
};

// ── Hal Higdon 15K / 10 Mile Novice ─────────────────────────────────────────
const HAL_10MI_NOVICE = {
  id: 'hal-10mi-novice',
  distance: '10mi',
  name: 'Hal Higdon — 15K / 10 Mile Novice (10 wks)',
  description: 'For first-timers. 3 runs, 2 cross-training days, and strength work each week; long run builds to 8 miles. 10 weeks.',
  source: { label: 'halhigdon.com', url: 'https://www.halhigdon.com/training-programs/15k-10-mile-training/novice-15k-10-mile/' },
  schedule: [
    // Wk    Mon Tue   Wed    Thu    Fri Sat   Sun
    /*  1 */ [SS, e(2), x(30), es(2), R, l(2), x(30)],
    /*  2 */ [SS, e(3), x(30), es(2), R, l(3), x(30)],
    /*  3 */ [SS, e(3), x(35), es(2), R, l(4), x(30)],
    /*  4 */ [SS, e(2), x(35), es(2), R, l(2), x(40)],
    /*  5 */ [SS, e(4), x(40), es(3), R, l(5), x(40)],
    /*  6 */ [SS, e(4), x(40), es(3), R, l(6), x(50)],
    /*  7 */ [SS, e(3), x(45), es(3), R, l(4), x(50)],
    /*  8 */ [SS, e(5), x(45), es(3), R, l(7), x(60)],
    /*  9 */ [SS, e(5), x(45), es(3), R, l(8), x(60)],
    /* 10 */ [SS, e(3), x(30), es(2), opt(2, '2 mi run or rest'), R, RACE_10MI],
  ]
};

// ── Hal Higdon 15K / 10 Mile Intermediate ───────────────────────────────────
const HAL_10MI_INTERMEDIATE = {
  id: 'hal-10mi-intermediate',
  distance: '10mi',
  name: 'Hal Higdon — 15K / 10 Mile Intermediate (10 wks)',
  description: 'For runners averaging 15–25 mi/week. 800m repeats, tempo runs, and 5K and 10K tune-up races. 10 weeks.',
  source: { label: 'halhigdon.com', url: 'https://www.halhigdon.com/training-programs/15k-10-mile-training/intermediate-15k-10-mile/' },
  schedule: [
    // Wk    Mon    Tue   Wed      Thu    Fri Sat    Sun
    /*  1 */ [es(3), e(4), r800(4), es(2), R, l(6),  x(60)],
    /*  2 */ [es(3), e(5), tmp(30), es(3), R, l(7),  x(60)],
    /*  3 */ [es(3), e(6), r800(5), es(4), R, l(8),  x(60)],
    /*  4 */ [es(3), e(4), tmp(35), es(2), R, e(4),  T5K],
    /*  5 */ [es(3), e(5), r800(6), es(3), R, l(7),  x(60)],
    /*  6 */ [es(3), e(6), tmp(40), es(4), R, l(8),  x(60)],
    /*  7 */ [es(3), e(4), r800(7), es(2), R, e(4),  T10K],
    /*  8 */ [es(3), e(5), tmp(45), es(3), R, l(9),  x(60)],
    /*  9 */ [es(3), e(6), r800(8), es(4), R, l(10), x(60)],
    /* 10 */ [es(3), e(4), tmp(30), e(4), { miles: 1.5, type: 'easy', label: '1–2 mi run' }, R, RACE_10MI],
  ]
};

// ── Hal Higdon Half Marathon Novice 1 ───────────────────────────────────────
const HAL_HALF_NOVICE_1 = {
  id: 'hal-half-novice-1',
  distance: 'half',
  name: 'Hal Higdon — Half Marathon Novice 1 (12 wks)',
  description: 'For a first half marathon. Assumes you can run 3 miles, 3–4 times a week; long run builds to 10 miles. 12 weeks.',
  source: { label: 'halhigdon.com', url: 'https://www.halhigdon.com/training-programs/half-marathon-training/novice-1-half-marathon/' },
  schedule: [
    // Wk    Mon Tue     Wed     Thu     Fri  Sat    Sun
    /*  1 */ [R, e(3),   orx(2), e(3),   R,   x(30), l(4)],
    /*  2 */ [R, e(3),   orx(2), e(3),   R,   x(30), l(4)],
    /*  3 */ [R, e(3.5), orx(2), e(3.5), R,   x(40), l(5)],
    /*  4 */ [R, e(3.5), orx(2), e(3.5), R,   x(40), l(5)],
    /*  5 */ [R, e(4),   orx(2), e(4),   R,   x(40), l(6)],
    /*  6 */ [R, e(4),   orx(2), e(4),   RER, R,     T5K],
    /*  7 */ [R, e(4.5), orx(3), e(4.5), R,   x(50), l(7)],
    /*  8 */ [R, e(4.5), orx(3), e(4.5), R,   x(50), l(8)],
    /*  9 */ [R, e(5),   orx(3), e(5),   RER, R,     T10K],
    /* 10 */ [R, e(5),   orx(3), e(5),   R,   x(60), l(9)],
    /* 11 */ [R, e(5),   orx(3), e(5),   R,   x(60), l(10)],
    /* 12 */ [R, e(4),   orx(3), e(2),   R,   R,     RACE_HALF],
  ]
};

// ── Hal Higdon Half Marathon Intermediate 1 ─────────────────────────────────
const HAL_HALF_INTERMEDIATE_1 = {
  id: 'hal-half-intermediate-1',
  distance: 'half',
  name: 'Hal Higdon — Half Marathon Intermediate 1 (12 wks)',
  description: 'One step up from Novice. Adds half-marathon-pace runs; long run builds to 12 miles. 12 weeks.',
  source: { label: 'halhigdon.com', url: 'https://www.halhigdon.com/training-programs/half-marathon-training/intermediate-1-half-marathon/' },
  schedule: [
    // Wk    Mon    Tue     Wed   Thu     Fri  Sat   Sun
    /*  1 */ [x(30), e(3),   e(4), e(3),   R,   e(3), l(4)],
    /*  2 */ [x(30), e(3),   p(4), e(3),   R,   p(3), l(5)],
    /*  3 */ [x(40), e(3.5), e(5), e(3.5), R,   R,    l(6)],
    /*  4 */ [x(40), e(3.5), p(5), e(3.5), R,   e(3), l(7)],
    /*  5 */ [x(40), e(4),   e(6), e(4),   R,   p(3), l(8)],
    /*  6 */ [x(50), e(4),   p(6), e(4),   RER, R,    T5K],
    /*  7 */ [R,     e(4.5), e(7), e(4.5), R,   p(4), l(9)],
    /*  8 */ [x(50), e(4.5), p(7), e(4.5), R,   p(5), l(10)],
    /*  9 */ [x(60), e(5),   e(8), e(5),   RER, R,    T10K],
    /* 10 */ [R,     e(5),   p(8), e(5),   R,   p(5), l(11)],
    /* 11 */ [x(60), e(5),   e(6), e(4),   R,   p(3), l(12)],
    /* 12 */ [R,     e(4),   p(4), e(2),   R,   R,    RACE_HALF],
  ]
};

// ── Hal Higdon Ultramarathon 50K ────────────────────────────────────────────
// Weekends switch from distance to time from week 19.
const HAL_50K = {
  id: 'hal-50k',
  distance: '50k',
  paceOptional: true,
  name: 'Hal Higdon — Ultramarathon 50K (26 wks)',
  description: 'For marathoners moving up to 50K. No speedwork; long runs build to 20 miles, then to 4–5 hours on feet. 26 weeks.',
  source: { label: 'halhigdon.com', url: 'https://www.halhigdon.com/training-programs/more-training/ultramarathon-50k/' },
  schedule: [
    // Wk    Mon Tue   Wed    Thu   Fri Sat                Sun
    /*  1 */ [R, e(3), e(5),  e(3), R, p(5),              l(10)],
    /*  2 */ [R, e(3), e(5),  e(3), R, e(5),              tl('1.5 hr run')],
    /*  3 */ [R, e(3), e(6),  e(3), R, p(6),              l(8)],
    /*  4 */ [R, e(3), e(6),  e(3), R, p(6),              l(13)],
    /*  5 */ [R, e(3), e(7),  e(3), R, e(7),              tl('2 hr run')],
    /*  6 */ [R, e(3), e(7),  e(3), R, p(7),              l(10)],
    /*  7 */ [R, e(4), e(8),  e(4), R, p(5),              l(16)],
    /*  8 */ [R, e(4), e(8),  e(4), R, e(8),              tl('2.5 hr run')],
    /*  9 */ [R, e(4), e(9),  e(4), R, R,                 tune(13.1, 'Half marathon (13.1 mi)', 'A half marathon — race it or run it as a training run.')],
    /* 10 */ [R, e(4), e(9),  e(4), R, p(9),              tl('3 hr run')],
    /* 11 */ [R, e(5), e(10), e(5), R, e(10),             l(20)],
    /* 12 */ [R, e(5), e(6),  e(5), R, p(6),              tl('2 hr run')],
    /* 13 */ [R, e(5), e(10), e(5), R, p(10),             l(20)],
    /* 14 */ [R, e(5), e(6),  e(5), R, e(6),              tl('2.5 hr run')],
    /* 15 */ [R, e(5), e(10), e(5), R, p(10),             l(20)],
    /* 16 */ [R, e(5), e(8),  e(5), R, p(10),             tl('3 hr run')],
    /* 17 */ [R, e(4), e(6),  e(4), R, p(4),              l(8)],
    /* 18 */ [R, e(3), e(4),  R,    R, e(2),              tune(26.2, 'Marathon (26.2 mi)', 'Optional: a marathon run as a training run, not an all-out race.')],
    /* 19 */ [R, R,    R,     e(3), R, te('1 hr run'),    te('1 hr run')],
    /* 20 */ [R, e(3), e(10), e(3), R, tp('1 hr pace'),   tl('3 hr run')],
    /* 21 */ [R, e(3), e(6),  e(3), R, te('1.5 hr run'),  tl('2 hr run')],
    /* 22 */ [R, e(3), e(10), e(3), R, tp('1.5 hr pace'), tl('4 hr run')],
    /* 23 */ [R, e(4), e(7),  e(4), R, te('2 hr run'),    tl('3 hr run')],
    /* 24 */ [R, e(4), e(10), e(4), R, tp('2 hr pace'),   tl('5 hr run')],
    /* 25 */ [R, e(4), e(8),  e(4), R, te('1 hr run'),    te('1 hr run')],
    /* 26 */ [R, e(4), e(4),  R,    R, e(2),              RACE_50K],
  ]
};

// ── inov8 100 Mile ──────────────────────────────────────────────────────────
// Effort-based: "3h / 2h / 1h race pace" means the pace you could hold for a
// race of that duration. Long runs carry a share of your race's total climb.
const SURGES = { miles: 0, type: 'speed', label: 'Surges 6 × 30s', note: 'Surges: 6 × 30 seconds quick but relaxed, with 2 min easy jog in between.', estMin: 6 * 2.5 + EST_WARMUP_MIN };
const OPT3   = opt(3, 'Rest or 3 mi easy');
// Hill reps: each rep plus a jog back down of about the same time.
const hills  = (n, dur) => ({ miles: 0, type: 'speed', label: `Hills ${n} × ${dur}`, note: `Hill reps: ${n} × ${dur} hard uphill with easy jog recovery back to your starting point. Aim for the fastest sustainable pace and consistent pacing between reps.`, estMin: n * parseFloat(dur) * 2 + EST_WARMUP_MIN });
const hillFartlek = (min) => ({ miles: 0, type: 'speed', label: `${min} min hill fartlek`, note: `${min} min hill fartlek: all uphills a hard effort (1h race pace, or 90% effort); all flats and descents at easy recovery pace.`, estMin: min + EST_WARMUP_MIN });
// workMin = minutes of effort + recoveries in between; warm-up/cool-down is added.
const itm    = (label, note, workMin) => ({ miles: 0, type: 'tempo', label, note, estMin: workMin + EST_WARMUP_MIN });
const climb  = (m, pct) => ({ miles: m, type: 'long', label: `${m} mi long (${pct}% climb)`, note: `${m} mile long run with ${pct}% of the climb you will do in your race.` });
const hike   = (hrs) => hk(`${hrs}h hilly hike`, `${hrs} hours of hilly hiking — time on feet at a steady effort.`);

const INOV8_100 = {
  id: 'inov8-100-mile',
  distance: '100mi',
  paceOptional: true,
  noPaces: true,
  name: 'inov8 — 100 Mile Ultramarathon (18 wks)',
  description: 'Effort-based trail plan: hill reps, tempo and fartlek work, climb-specific long runs, and long hilly hikes up to 8–9 hours. 18 weeks.',
  source: { label: 'inov8.com', url: 'https://www.inov8.com/blog/post/100-mile-training-plan' },
  schedule: [
    // Wk    Mon Tue                Wed   Thu                Fri Sat   Sun
    /*  1 */ [R, SURGES,            OPT3, hills(5, '2 min'),   R, e(5), climb(14, 20)],
    /*  2 */ [R, e(4),              OPT3, hills(5, '2.5 min'), R, e(5), climb(16, 20)],
    /*  3 */ [R, itm('15 min tempo', '15 min steady tempo @ 3h race pace (65–70% effort).', 15),
                                    OPT3, hills(5, '3 min'),   R, e(4), climb(10, 10)],
    /*  4 */ [R, SURGES,            OPT3, hills(4, '2 min'),   R, e(5), hike('4–5')],
    /*  5 */ [R, itm('20 min trail tempo', '20 min steady trail tempo @ 3h race pace (65–70% effort).', 20),
                                    OPT3, hillFartlek(20),     R, e(3), climb(18, 20)],
    /*  6 */ [R, e(4),              OPT3, itm('Fartlek 3 × 8 min', 'Trail fartlek: 3 × 8 min tempo @ 2h race pace (80% effort) with 2 min easy running in between.', 3 * 8 + 2 * 2),
                                                               R, e(6), hike('6–7')],
    /*  7 */ [R, itm('25 min trail tempo', '25 min steady trail tempo @ 3h race pace (65–70% effort).', 25),
                                    OPT3, hillFartlek(25),     R, e(4), climb(20, 20)],
    /*  8 */ [R, e(4),              OPT3, itm('Fartlek 3 × 10 min', 'Trail fartlek: 3 × 10 min tempo @ 2h race pace (80% effort) with 2 min easy running in between.', 3 * 10 + 2 * 2),
                                                               R, e(7), hike('6–7')],
    /*  9 */ [R, { miles: 0, type: 'speed', label: 'Hills 1-2-3-3-2-1 min', note: 'Hills: 1-2-3-3-2-1 min hard uphill, with an easy run back down to your starting point after each rep.', estMin: 12 * 2 + EST_WARMUP_MIN },
                                    OPT3, itm('Progression 15 + 10 min', 'Trail progression: 15 min @ 3h race pace (65% effort), followed by 10 min @ 2h race pace (80% effort).', 25),
                                                               R, e(5), climb(10, 15)],
    /* 10 */ [R, e(5),              OPT3, itm('Tempo 2 × 15 min', '2 × 15 min steady tempo @ 3h race pace (65–70% effort) with 3 min easy run in between.', 2 * 15 + 3),
                                                               R, e(6), climb(24, 25)],
    /* 11 */ [R, e(4),              OPT3, SURGES,              R, itm('Fartlek 2 × 10 min', 'Trail fartlek: 2 × 10 min tempo @ 2h race pace (80% effort) with 2 min easy running in between.', 2 * 10 + 2),
                                                                        hike('8–9')],
    /* 12 */ [R, e(5),              OPT3, itm('Progression 15 + 10 + 5 min', 'Trail progression: 15 min @ 3h race pace (65% effort), then 10 min @ 2h race pace (80% effort), then 5 min @ 1h race pace (90% effort).', 30),
                                                               R, hills(4, '2 min'), climb(12, 10)],
    /* 13 */ [R, SURGES,            OPT3, itm('Tempo 2 × 20 min', '2 × 20 min steady tempo @ 3h race pace (65–70% effort) with 3 min easy run in between.', 2 * 20 + 3),
                                                               R, e(3), climb(28, 30)],
    /* 14 */ [R, e(3),              OPT3, e(6),                R, itm('Hills + 20 min tempo', '3 × 3 min hard uphill with an easy run back to your starting point, followed by 20 min tempo @ 3h race pace (65–70% effort).', 3 * 3 * 2 + 20),
                                                                        climb(12, 15)],
    /* 15 */ [R, hillFartlek(20),   OPT3, itm('40 min tempo', '40 min steady tempo @ 3h race pace (65–70% effort).', 40),
                                                               R, e(4), hike('8–9')],
    /* 16 */ [R, e(4),              OPT3, itm('Progression 20 + 20 min', 'Trail progression: 20 min @ 3h race pace (65% effort), followed by 20 min @ 2h race pace (80% effort).', 40),
                                                               R, e(6), climb(16, 10)],
    /* 17 */ [R, e(4),              OPT3, SURGES,              R, e(4), climb(7, 5)],
    /* 18 */ [R, e(4),              OPT3, e(3),                R, e(2), RACE_100],
  ]
};

const PLANS = [
  HAL_NOVICE_1,
  HAL_NOVICE_2,
  HAL_INTERMEDIATE_1,
  HAL_INTERMEDIATE_2,
  FIRST,
  GALLOWAY,
  PFITZINGER,
  BOSTON_QUALIFIER,
  HANSONS_BEGINNER,
  EIGHT_TWENTY,
  MAF,
  HAL_NOVICE_SUPREME,
  JACK_DANIELS,
  HAL_5K_NOVICE,
  HAL_5K_INTERMEDIATE,
  HAL_10K_NOVICE,
  HAL_10K_INTERMEDIATE,
  HAL_10MI_NOVICE,
  HAL_10MI_INTERMEDIATE,
  HAL_HALF_NOVICE_1,
  HAL_HALF_INTERMEDIATE_1,
  HAL_50K,
  INOV8_100,
];

// ── Plan helpers (shared by every view) ─────────────────────────────────────

function planDistance(plan) {
  return RACE_DISTANCES.find((d) => d.id === (plan.distance || 'marathon'));
}

/** True for days that become a calendar event (anything but rest / cross-training). */
function dayIsRun(day) {
  return day.type !== 'rest' && day.type !== 'cross';
}

// Average minutes per mile used to turn a timed session into miles.
const EST_MIN_PER_MILE = { easy: 10.5, long: 10.5, pace: 9.5, tempo: 10, speed: 10, walk: 12 };

/**
 * A day's mileage: the listed distance, or a rough estimate for sessions the
 * source gives in time or reps (see estMin / estMiles above).
 */
function estimateDayMiles(day) {
  if (day.miles > 0 || !dayIsRun(day)) return day.miles;
  if (day.estMiles) return day.estMiles;
  if (day.estMin) return day.estMin / (EST_MIN_PER_MILE[day.type] || 10);
  return 0;
}

/** True when a day's mileage is an estimate rather than a listed distance. */
function dayIsEstimated(day) {
  return dayIsRun(day) && !day.miles && estimateDayMiles(day) > 0;
}

/** Miles that count toward weekly totals — optional "rest or …" days are left out. */
function dayCountedMiles(day) {
  return day.optional ? 0 : estimateDayMiles(day);
}

function weekMiles(week) {
  return week.reduce((s, d) => s + dayCountedMiles(d), 0);
}
