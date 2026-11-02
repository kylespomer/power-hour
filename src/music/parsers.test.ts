import { describe, expect, it } from 'vitest';
import { parseSpotifyContextUri } from './spotify';
import { parseYouTubePlaylistId } from './youtube';

describe('parseSpotifyContextUri', () => {
  it.each([
    ['https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=abc', 'spotify:playlist:37i9dQZF1DXcBWIGoYBM5M'],
    ['https://open.spotify.com/intl-de/album/4aawyAB9vmqN3uQ7FjRGTy', 'spotify:album:4aawyAB9vmqN3uQ7FjRGTy'],
    ['https://open.spotify.com/artist/0OdUWJ0sBjDrqHygGUXeCF', 'spotify:artist:0OdUWJ0sBjDrqHygGUXeCF'],
    ['spotify:playlist:37i9dQZF1DXcBWIGoYBM5M', 'spotify:playlist:37i9dQZF1DXcBWIGoYBM5M'],
  ])('%s', (input, expected) => {
    expect(parseSpotifyContextUri(input)).toBe(expected);
  });

  it('rejects other links', () => {
    expect(parseSpotifyContextUri('https://open.spotify.com/track/abc')).toBeNull();
    expect(parseSpotifyContextUri('https://example.com/playlist/abc')).toBeNull();
    expect(parseSpotifyContextUri('')).toBeNull();
  });
});

describe('parseYouTubePlaylistId', () => {
  it.each([
    ['https://www.youtube.com/playlist?list=PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI', 'PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI'],
    ['https://music.youtube.com/playlist?list=RDCLAK5uy_abc123XYZ', 'RDCLAK5uy_abc123XYZ'],
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL123456789', 'PL123456789'],
    ['PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI', 'PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI'],
  ])('%s', (input, expected) => {
    expect(parseYouTubePlaylistId(input)).toBe(expected);
  });

  it('rejects links without a playlist', () => {
    expect(parseYouTubePlaylistId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBeNull();
    expect(parseYouTubePlaylistId('')).toBeNull();
  });
});
