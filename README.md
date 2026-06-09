# Groupstage — 2026 World Cup Pool App

Track the 2026 FIFA World Cup with friends. Each member picks teams from the 48-nation field and earns points as those teams win matches, advance through rounds, and ultimately lift the trophy.

## What this app is

Groupstage is a lightweight pool app built for small groups of friends. Create a pool, share the invite link, have everyone pick their teams, then watch your standings update in real-time as the tournament plays out.

## No-auth model

**There are no passwords.** When you join a pool, you enter your name and email. Your browser stores this locally. If you clear your browser storage, go to `/recover`, enter your email, and the app will find your pools and restore your session. Trust-based, works great for friend groups. Real auth in v2.

## Firebase setup

1. Go to [console.firebase.google.com](https://console.firebase.google.com) and create a new project.
2. Enable Firestore (Build → Firestore Database → Create database → test mode for dev).
3. Add a web app (`</>` icon), copy the config.
4. Copy `.env.example` to `.env` and fill in your config values.
5. Deploy indexes: `npx firebase-tools deploy --only firestore:indexes`

## API key registration

**football-data.org** (free, 10 req/min) — register at [football-data.org/client/register](https://www.football-data.org/client/register), add key as `VITE_FOOTBALL_DATA_KEY`.

**api-football.com via RapidAPI** (free, 100 req/day) — subscribe at [rapidapi.com](https://rapidapi.com) to API-Football, add key as `VITE_API_FOOTBALL_KEY`.

Both APIs are optional — app works without them, live scores and squads won't load.

## Local development

```bash
npm install
npm run dev
```

## Deploy to Render

1. Push to GitHub (`.env` is gitignored).
2. New Static Site on Render: build command `npm run build`, publish directory `dist`.
3. Add environment variables in Render dashboard.

## How to invite friends

1. Create pool at `/create`.
2. Click **Copy invite** and share the link.
3. Friends open link, enter name + email, pick their teams.

## Known limitations (v1)

- No real auth — email is just an identifier
- API rate limits may prevent live score updates on busy match days
- Firestore starts in test mode — add security rules before going public
- 100 RapidAPI calls/day limits squad/lineup availability
