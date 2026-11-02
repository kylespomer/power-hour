# Power Hour 🍻

A web app for the classic drinking game: **60 minutes, a drink every minute, and a new song after every drink.**

It runs in any modern browser, phone or laptop. You can also "Add to Home Screen" so it opens like an app.

## Features

- **Game modes**
  - **Power Hour**: 60 drinks, one a minute.
  - **Centurion**: 100 drinks, one a minute (1 hour 40 minutes).
  - **Custom**: choose the number of drinks and the seconds between them.
- **A big countdown** to the next drink, plus drinks taken and time remaining.
- **A "DRINK!" alert every minute**: the screen flashes full-screen, a sound plays (air horn, bell or whistle), a voice calls out the drink number, the phone vibrates, and a system notification appears if the tab is in the background.
- **Music between drinks.** The music gets quieter while the alert plays, then skips to the next song. You can pick where songs start (default 0:30) to skip slow intros.
- **Music sources**
  - **Spotify** (default): plays a playlist, album or artist directly in the browser, shuffled, with no ads. Needs Spotify Premium.
  - **YouTube / YouTube Music**: paste any public or unlisted playlist link. No account needed. YouTube may play ads, usually right when a new song starts after each drink. YouTube Premium may remove them if you're signed in in the same browser, but that isn't guaranteed inside embedded players. Use Spotify or your own files for an ad-free game.
  - **My files**: pick audio files from the device. Works offline.
  - **None**: just the timer, so you can play music any way you like.
- Keeps the screen awake during a game. The clock is based on real time, so it can't drift even if the browser slows the tab down.
- Pause/resume, skip a song, and a warning before you accidentally close the tab.

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests
npm run build      # production build in dist/
```

`dist/` is a static site that can be deployed anywhere (GitHub Pages, Netlify, Vercel, Cloudflare Pages). It must be served over **HTTPS** (or from localhost) for Spotify login, notifications and screen wake lock to work.

## Deploying for the family (GitHub Pages)

Every push to `main` builds the app and publishes it to GitHub Pages using `.github/workflows/deploy.yml`.

1. Turn on Pages: in the repo, go to **Settings → Pages** and set **Source** to **GitHub Actions**.
2. Optional: add the Spotify Client ID under **Settings → Secrets and variables → Actions → Variables** as `SPOTIFY_CLIENT_ID`, so nobody has to paste it into the app.
3. Re-run the workflow under **Actions → Deploy to GitHub Pages → Run workflow**, or push any change.
4. The app is live at **https://kylespomer.github.io/power-hour/**. Share that link. On phones, use Share → *Add to Home Screen* so it opens like an app.
5. In the Spotify developer dashboard, add `https://kylespomer.github.io/power-hour/` as a Redirect URI (with the trailing slash), and add each family member who will host under **User Management**.

## Spotify setup (one time)

Spotify only allows playback in a third-party app for **Premium** accounts. The app logs in with the PKCE flow, so it needs no server or secret.

1. Go to <https://developer.spotify.com/dashboard> and create an app. Under APIs, select **Web API** and **Web Playback SDK**.
2. Add the URL where you run Power Hour as a **Redirect URI**, for example `http://127.0.0.1:5173/` for local dev or `https://your-site.example/`. The app shows the exact value under "Spotify setup".
   - Spotify no longer accepts `localhost` redirect URIs. Use `http://127.0.0.1:5173/` and open the app at that address.
3. Copy the app's **Client ID** and paste it into the app under *Spotify setup*. To build it into a deployment instead, put it in `.env` as `VITE_SPOTIFY_CLIENT_ID` (see `.env.example`).
4. While the Spotify app is in *Development mode*, only the accounts you add under **User Management** in the dashboard can log in. Add everyone in the family who will host a game.

## Tips for game night

- Plug the phone or laptop into a speaker and keep the Power Hour tab in the foreground. The screen stays on by itself.
- Use **Test alert** before you start, and turn the volume up.
- On iPhone, the ringer/silent switch can mute web audio. Turn silent mode off.
- Please drink responsibly. Shots of beer are the traditional measure, and water works fine too.

## Project layout

```
src/
  game.ts            Wall-clock timer and game state (unit tested)
  alert.ts           Synthesized alert sounds, voice, vibration, notifications
  wakelock.ts        Keeps the screen on
  settings.ts        Saved settings
  main.ts            UI wiring
  music/
    types.ts         MusicSource interface
    spotify.ts       Spotify Web Playback SDK source
    spotify-auth.ts  PKCE login
    youtube.ts       YouTube IFrame Player source
    local.ts         Local audio files source
```

Adding another service (Apple Music via MusicKit JS, for example) means writing one more `MusicSource` and adding it to `buildSource()` in `main.ts`.
