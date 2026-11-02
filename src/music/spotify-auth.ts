/**
 * Spotify Authorization Code + PKCE flow. Runs entirely in the browser, so no
 * backend or client secret is required — only a Client ID from
 * https://developer.spotify.com/dashboard with this page's URL registered as a
 * Redirect URI.
 */

const TOKEN_KEY = 'ph.spotify.token';
const VERIFIER_KEY = 'ph.spotify.verifier';
const CLIENT_ID_KEY = 'ph.spotify.clientId';

const SCOPES = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-read-playback-state',
  'user-modify-playback-state',
];

interface StoredToken {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export function redirectUri(): string {
  return `${location.origin}${location.pathname}`;
}

export function getClientId(): string {
  return localStorage.getItem(CLIENT_ID_KEY) || import.meta.env.VITE_SPOTIFY_CLIENT_ID || '';
}

export function setClientId(id: string): void {
  if (id.trim()) localStorage.setItem(CLIENT_ID_KEY, id.trim());
  else localStorage.removeItem(CLIENT_ID_KEY);
}

export function isLoggedIn(): boolean {
  return readToken() !== null;
}

export function logout(): void {
  localStorage.removeItem(TOKEN_KEY);
}

function readToken(): StoredToken | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    return raw ? (JSON.parse(raw) as StoredToken) : null;
  } catch {
    return null;
  }
}

function storeToken(json: { access_token: string; refresh_token?: string; expires_in: number }): void {
  const prev = readToken();
  const token: StoredToken = {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? prev?.refreshToken ?? '',
    expiresAt: Date.now() + json.expires_in * 1000,
  };
  localStorage.setItem(TOKEN_KEY, JSON.stringify(token));
}

function base64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export async function beginLogin(): Promise<void> {
  const clientId = getClientId();
  if (!clientId) throw new Error('Enter your Spotify Client ID first.');

  const verifier = base64Url(crypto.getRandomValues(new Uint8Array(64)));
  const challenge = base64Url(
    new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))),
  );
  localStorage.setItem(VERIFIER_KEY, verifier);

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri(),
    code_challenge_method: 'S256',
    code_challenge: challenge,
    scope: SCOPES.join(' '),
  });
  location.assign(`https://accounts.spotify.com/authorize?${params}`);
}

/** Call on page load. Completes the login if we were just redirected back. */
export async function handleRedirect(): Promise<string | null> {
  const params = new URLSearchParams(location.search);
  const code = params.get('code');
  const error = params.get('error');
  if (!code && !error) return null;

  history.replaceState(null, '', redirectUri());
  if (error) return `Spotify login failed: ${error}`;

  const verifier = localStorage.getItem(VERIFIER_KEY);
  localStorage.removeItem(VERIFIER_KEY);
  if (!verifier) return 'Spotify login failed: missing PKCE verifier, please try again.';

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: code!,
      redirect_uri: redirectUri(),
      client_id: getClientId(),
      code_verifier: verifier,
    }),
  });
  if (!res.ok) return `Spotify login failed (${res.status}).`;
  storeToken(await res.json());
  return null;
}

export async function getAccessToken(): Promise<string> {
  const token = readToken();
  if (!token) throw new Error('Not logged in to Spotify.');
  if (token.expiresAt - Date.now() > 60_000) return token.accessToken;

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: token.refreshToken,
      client_id: getClientId(),
    }),
  });
  if (!res.ok) {
    logout();
    throw new Error('Spotify session expired — please log in again.');
  }
  storeToken(await res.json());
  return readToken()!.accessToken;
}
