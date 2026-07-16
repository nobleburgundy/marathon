// ─────────────────────────────────────────────────────────────────────────────
// Fill in your Google OAuth Client ID before deploying.
// See README.md for setup instructions.
//
// airNowApiKey: free key from https://docs.airnowapi.org/ — used for real
// EPA ground-station AQI (current conditions + short-range forecast) in the
// heat calculator. Unlike the Google Client ID, AirNow keys aren't
// domain-restricted, just rate-limited (500 req/hr on the free tier) — since
// this is a static site the key is visible in the page source either way.
// ─────────────────────────────────────────────────────────────────────────────
const CONFIG = {
  googleClientId: '222849803498-2t31rh155b18i1p9u5jgatp4uu8266cv.apps.googleusercontent.com',
  airNowApiKey: '051EC8AA-E757-49A4-B39C-8AA479E51402'
};
