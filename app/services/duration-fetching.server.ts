import { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET } from '~/utils/envExports';

interface SpotifyTrack {
  id: string;
  name: string;
  artists: Array<{ name: string }>;
  duration_ms: number;
  external_urls: { spotify: string };
}

interface SongDetail {
  name: string;
  artist: string;
  duration?: number;
  spotifyId?: string;
  spotifyUrl?: string;
}

class SpotifyDurationService {
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  // Get Spotify access token
  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken as string;
    }

    try {
      const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')}`
        },
        body: 'grant_type=client_credentials'
      });

      if (!response.ok) {
        throw new Error(`Spotify token error: ${response.status}`);
      }

      const data = await response.json();
      this.accessToken = data.access_token;
      this.tokenExpiry = Date.now() + (data.expires_in * 1000) - 30000; // 30s buffer

      return this.accessToken as string;
    } catch (error) {
      console.error('Error getting Spotify token:', error);
      throw error;
    }
  }

  // Search for a single track and get its details
  private async searchTrack(songName: string, artistName: string): Promise<SongDetail> {
    try {
      const token = await this.getAccessToken();
      
      // Clean up search query
      const cleanSong = songName.replace(/[^\w\s]/g, '').trim();
      const cleanArtist = artistName.replace(/[^\w\s]/g, '').trim();
      const query = `track:"${cleanSong}" artist:"${cleanArtist}"`;

      const response = await fetch(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=1`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (!response.ok) {
        console.warn(`Spotify search failed for "${songName}" by ${artistName}: ${response.status}`);
        return { name: songName, artist: artistName };
      }

      const data = await response.json();
      
      if (data.tracks.items.length > 0) {
        const track: SpotifyTrack = data.tracks.items[0];
        return {
          name: songName,
          artist: artistName,
          duration: track.duration_ms,
          spotifyId: track.id,
          spotifyUrl: track.external_urls.spotify
        };
      }

      return { name: songName, artist: artistName };
    } catch (error) {
      console.error(`Error searching for "${songName}" by ${artistName}:`, error);
      return { name: songName, artist: artistName };
    }
  }

  // Get durations for multiple songs
  async getSongDetails(songs: string[]): Promise<SongDetail[]> {
    const songDetails: SongDetail[] = [];
    
    console.log(`🎵 Fetching Spotify details for ${songs.length} songs...`);

    for (const song of songs) {
      try {
        // Parse song format: "1. "Song Name" by Artist Name"
        const match = song.match(/^\d+\.\s*"([^"]+)"\s*by\s*(.+)$/);
        if (!match) {
          console.warn('Could not parse song format:', song);
          songDetails.push({ name: song, artist: 'Unknown' });
          continue;
        }

        const [, songName, artistName] = match;
        const details = await this.searchTrack(songName.trim(), artistName.trim());
        songDetails.push(details);

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error('Error processing song:', song, error);
        songDetails.push({ name: song, artist: 'Unknown' });
      }
    }

    const foundCount = songDetails.filter(s => s.duration).length;
    console.log(`✅ Found Spotify details for ${foundCount}/${songs.length} songs`);

    return songDetails;
  }

  // Format duration from milliseconds to MM:SS
  static formatDuration(durationMs?: number): string {
    if (!durationMs) return '--:--';
    
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  // Calculate total playlist duration
  static calculateTotalDuration(songDetails: SongDetail[]): number {
    return songDetails.reduce((total, song) => {
      return total + (song.duration || 0);
    }, 0);
  }
}

export const spotifyDurationService = new SpotifyDurationService();
export { SpotifyDurationService };
export type { SongDetail };