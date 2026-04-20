# Marathon Training Planner

A static web app that adds a full marathon training schedule to your Google Calendar as all-day events.

- Pick a **race date** and **training plan** (Hal Higdon Novice 1 & 2, Intermediate 1 & 2)
- Enter your **goal pace** (e.g. `9:30`) or finish time (e.g. `4:15:00`)
- Events are created with the mileage as the title (`12 mi`) and pace guidance in the description
- Deploys to **GitHub Pages** — no backend required

---

## Setup

### 1. Create a Google Cloud project

1. Go to <https://console.cloud.google.com> and create a new project.
2. Enable the **Google Calendar API**:
   - APIs & Services → Enable APIs → search "Google Calendar API" → Enable
3. Create OAuth credentials:
   - APIs & Services → Credentials → Create Credentials → **OAuth client ID**
   - Application type: **Web application**
   - Name: anything (e.g. "Marathon Planner")
   - Authorized JavaScript origins:
     - `http://localhost` (for local testing)
     - `https://YOUR-USERNAME.github.io` (for GitHub Pages)
   - Click **Create** and copy the **Client ID**

4. Configure the OAuth consent screen (APIs & Services → OAuth consent screen):
   - User type: **External**
   - Fill in app name and your email
   - Add scope: `https://www.googleapis.com/auth/calendar.events`
   - Add yourself as a test user (required while the app is in "Testing" mode)

### 2. Add your Client ID

Open `js/config.js` and replace the placeholder:

```js
const CONFIG = {
  googleClientId: 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com'
};
```

### 3. Deploy to GitHub Pages

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR-USERNAME/marathon.git
git push -u origin main
```

Then in your GitHub repository:
- Settings → Pages → Source: **Deploy from a branch** → `main` / `/ (root)` → Save

Your app will be live at `https://YOUR-USERNAME.github.io/marathon`.

> **Note:** After deploying, add `https://YOUR-USERNAME.github.io` to the
> **Authorized JavaScript origins** list in your OAuth credentials (see step 1.3).

---

## Local testing

Any static file server works:

```bash
# Python
python3 -m http.server 8080

# Node (npx)
npx serve .
```

Then open `http://localhost:8080`.

---

## Training plans

Mileage is based on publicly documented Hal Higdon training schedules and is
intended as a close approximation. Verify exact week-by-week mileage against
the official plans at [halhigdon.com](https://www.halhigdon.com).

| Plan | Days/week | Peak long run |
|------|-----------|---------------|
| Novice 1 | 4 | 20 mi |
| Novice 2 | 4 | 20 mi (+ pace runs) |
| Intermediate 1 | 5 | 20 mi (twice) |
| Intermediate 2 | 6 | 20 mi (twice) |

## Pace guidance (in event descriptions)

| Run type | Suggested pace |
|----------|---------------|
| Easy | Goal pace + 90 sec/mi |
| Long | Goal pace + 60 sec/mi |
| Pace | Goal marathon pace |
| Race | Goal marathon pace |
