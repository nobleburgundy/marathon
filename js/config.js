// ─────────────────────────────────────────────────────────────────────────────
// Fill in your Google OAuth Client ID before deploying.
// See README.md for setup instructions.
//
// airNowApiKey: free key from https://docs.airnowapi.org/ — used for real
// EPA ground-station AQI (current conditions + short-range forecast) in the
// heat calculator. Unlike the Google Client ID, AirNow keys aren't
// domain-restricted, just rate-limited (500 req/hr on the free tier) — since
// this is a static site the key is visible in the page source either way.
//
// googleApiKey + trainingCalendarId: Home reads today's workout from this
// PUBLIC Google Calendar with an API key — no sign-in, so it syncs on every
// page load. The key is restricted (in Google Cloud) to this site's URLs and
// to the Calendar API only. Leave trainingCalendarId empty to fall back to
// the signed-in calendar picked in Build Plan.
// ─────────────────────────────────────────────────────────────────────────────
const CONFIG = {
  googleClientId: '222849803498-2t31rh155b18i1p9u5jgatp4uu8266cv.apps.googleusercontent.com',
  airNowApiKey: '051EC8AA-E757-49A4-B39C-8AA479E51402',
  googleApiKey: 'AIzaSyBGpAudUerPQhmxIV7sbcsQBkQrzPsKJ0k',
  trainingCalendarId: 'ee6eec8601947f23fd351bc50021a2b154b286efc90ceaac17f4b639223c5258@group.calendar.google.com',
};
