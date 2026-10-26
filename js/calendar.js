// ─────────────────────────────────────────────────────────────────────────────
// Google Calendar API — authentication, event search, creation, and deletion.
// ─────────────────────────────────────────────────────────────────────────────

const CalendarAPI = (() => {
  const SCOPES = [
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/calendar.readonly',
  ].join(' ');

  let tokenClient = null;
  let accessToken  = null;

  // The access token is kept in localStorage (with its expiry) so reloading
  // or relaunching the app within the token's ~1 hour lifetime syncs
  // automatically instead of needing another Google popup.
  const TOKEN_KEY = 'mp_gcal_token';

  function restoreToken() {
    try {
      const saved = JSON.parse(localStorage.getItem(TOKEN_KEY) || 'null');
      if (saved && saved.token && saved.expiresAt > Date.now() + 60000) {
        accessToken = saved.token;
      }
    } catch { /* storage unavailable — just sign in again */ }
  }

  function saveToken(token, expiresInSec) {
    try {
      localStorage.setItem(TOKEN_KEY, JSON.stringify({
        token, expiresAt: Date.now() + (Number(expiresInSec) || 3600) * 1000,
      }));
    } catch { /* ignore */ }
  }

  function clearToken() {
    accessToken = null;
    try { localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
  }

  restoreToken();

  // ── Auth ───────────────────────────────────────────────────────────────────

  function init(clientId, onSignedIn) {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      callback: (response) => {
        if (response.error) {
          console.error('Google auth error:', response);
          return;
        }
        accessToken = response.access_token;
        saveToken(accessToken, response.expires_in);
        if (onSignedIn) onSignedIn();
      },
    });
  }

  function signIn() {
    if (!tokenClient) throw new Error('CalendarAPI.init() must be called first.');
    tokenClient.requestAccessToken({ prompt: '' });
  }

  function isSignedIn() { return !!accessToken; }

  // ── API helpers ────────────────────────────────────────────────────────────

  async function apiFetch(path, options = {}, retries = 4, backoff = 1000) {
    const url = `https://www.googleapis.com/calendar/v3${path}`;
    const res = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });

    if (res.status === 401) {
      // Token expired or revoked. Clear it first so the wait below actually
      // waits for a *new* token rather than resolving on the stale one.
      clearToken();
      if (!tokenClient || retries <= 0) {
        throw new Error('Google sign-in expired — please sign in again.');
      }
      await new Promise((resolve, reject) => {
        tokenClient.requestAccessToken({ prompt: '' });
        const started = Date.now();
        const check = setInterval(() => {
          if (accessToken) { clearInterval(check); resolve(); }
          else if (Date.now() - started > 120000) {
            clearInterval(check);
            reject(new Error('Google sign-in timed out.'));
          }
        }, 500);
      });
      return apiFetch(path, options, retries - 1, backoff);
    }

    // 204 No Content (DELETE), 404/410 (already deleted) are all fine.
    if (res.status === 204 || res.status === 404 || res.status === 410) {
      return null;
    }

    // Retry on rate-limit responses (429 or 403 rateLimitExceeded) with backoff.
    if (res.status === 429 || res.status === 403) {
      const body = await res.text();
      const isRateLimit = res.status === 429 || body.includes('rateLimitExceeded');
      if (isRateLimit && retries > 0) {
        await sleep(backoff);
        return apiFetch(path, options, retries - 1, backoff * 2);
      }
      throw new Error(`Calendar API error ${res.status}: ${body}`);
    }

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Calendar API error ${res.status}: ${body}`);
    }
    return res.json();
  }

  // ── Calendar list ──────────────────────────────────────────────────────────

  async function listCalendars() {
    const data = await apiFetch('/users/me/calendarList');
    return (data.items || []).sort((a, b) => {
      if (a.primary) return -1;
      if (b.primary) return 1;
      return (a.summary || '').localeCompare(b.summary || '');
    });
  }

  // ── Event search ───────────────────────────────────────────────────────────

  /**
   * Search a calendar for all events that contain the marathon-planner
   * metadata tag in their description. Searches a 4-year window (2 years
   * back, 2 years forward) to catch both past and future plans.
   */
  async function searchMarathonEvents(calendarId) {
    const timeMin = new Date();
    timeMin.setFullYear(timeMin.getFullYear() - 2);
    const timeMax = new Date();
    timeMax.setFullYear(timeMax.getFullYear() + 2);

    const params = new URLSearchParams({
      q:             'marathon-planner',
      singleEvents:  'true',
      maxResults:    '500',
      timeMin:       timeMin.toISOString(),
      timeMax:       timeMax.toISOString(),
    });

    const data = await apiFetch(
      `/calendars/${encodeURIComponent(calendarId)}/events?${params}`
    );
    return data.items || [];
  }

  /**
   * All events on a calendar between two dates (YYYY-MM-DD, end exclusive),
   * expanded so recurring events show up as individual days.
   */
  async function listEventsInRange(calendarId, startDateStr, endDateStr) {
    const params = new URLSearchParams({
      singleEvents: 'true',
      orderBy:      'startTime',
      maxResults:   '250',
      timeMin:      new Date(startDateStr + 'T00:00:00').toISOString(),
      timeMax:      new Date(endDateStr + 'T00:00:00').toISOString(),
    });
    const data = await apiFetch(
      `/calendars/${encodeURIComponent(calendarId)}/events?${params}`
    );
    return data.items || [];
  }

  /**
   * Same as listEventsInRange, but for a PUBLIC calendar read with an API
   * key — no sign-in needed. Plain GET with no custom headers, so the
   * browser doesn't need a CORS preflight.
   */
  async function listPublicEventsInRange(calendarId, apiKey, startDateStr, endDateStr) {
    const params = new URLSearchParams({
      key:          apiKey,
      singleEvents: 'true',
      orderBy:      'startTime',
      maxResults:   '250',
      timeMin:      new Date(startDateStr + 'T00:00:00').toISOString(),
      timeMax:      new Date(endDateStr + 'T00:00:00').toISOString(),
    });
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`
    );
    if (!res.ok) throw new Error(`Calendar API error ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return data.items || [];
  }

  // ── Event creation ─────────────────────────────────────────────────────────

  async function createAllDayEvent(calendarId, dateStr, title, description) {
    const endDate = nextDay(dateStr);
    const body = {
      summary:     title,
      description,
      start: { date: dateStr },
      end:   { date: endDate },
    };
    return apiFetch(
      `/calendars/${encodeURIComponent(calendarId)}/events`,
      { method: 'POST', body: JSON.stringify(body) }
    );
  }

  /**
   * Create many all-day events in batches of 5.
   * Returns an array of the created event IDs.
   */
  async function createEvents(calendarId, events, onProgress) {
    const BATCH = 3;
    let created = 0;
    const ids = [];

    for (let i = 0; i < events.length; i += BATCH) {
      const chunk   = events.slice(i, i + BATCH);
      const results = await Promise.all(
        chunk.map(({ date, title, description }) =>
          createAllDayEvent(calendarId, date, title, description)
        )
      );
      results.forEach((r) => { if (r && r.id) ids.push(r.id); });
      created += chunk.length;
      onProgress(created, events.length);
      if (i + BATCH < events.length) await sleep(800);
    }

    return ids;
  }

  // ── Event deletion ─────────────────────────────────────────────────────────

  async function deleteEvent(calendarId, eventId) {
    return apiFetch(
      `/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
      { method: 'DELETE' }
    );
  }

  /**
   * Delete many events by ID in batches of 5.
   */
  async function deleteEvents(calendarId, eventIds, onProgress) {
    const BATCH = 5;
    let deleted = 0;

    for (let i = 0; i < eventIds.length; i += BATCH) {
      const chunk = eventIds.slice(i, i + BATCH);
      await Promise.all(chunk.map((id) => deleteEvent(calendarId, id)));
      deleted += chunk.length;
      onProgress(deleted, eventIds.length);
      if (i + BATCH < eventIds.length) await sleep(400);
    }
  }

  // ── Utilities ──────────────────────────────────────────────────────────────

  function nextDay(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + 1);
    return toDateStr(d);
  }

  function toDateStr(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

  return {
    init, signIn, isSignedIn, clearToken,
    listCalendars,
    searchMarathonEvents,
    listEventsInRange,
    listPublicEventsInRange,
    createEvents,
    deleteEvents,
  };
})();
