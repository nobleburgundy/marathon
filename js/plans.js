// ─────────────────────────────────────────────────────────────────────────────
// Training plan data.
//
// Each plan has N weeks. Each week is an array of 7 days [Mon … Sun].
// Each day: { miles: number, type: string }
//
// Types:
//   'rest'   – no event created
//   'cross'  – no event created (cross-training)
//   'easy'   – easy aerobic / recovery run
//   'long'   – long run (time on feet)
//   'pace'   – marathon goal-pace run
//   'tempo'  – lactate threshold / comfortably hard
//   'speed'  – track / interval workout (includes warmup + cooldown miles)
//   'walk'   – Galloway run-walk interval run
//   'race'   – race day (26.2)
//
// The race always falls on day-index 6 (Sunday) of the last week.
// ─────────────────────────────────────────────────────────────────────────────

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
];
