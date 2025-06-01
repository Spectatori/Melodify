// app/routes/playlist.$id.tsx
import React from 'react';
import { LoaderFunctionArgs, redirect, ActionFunctionArgs } from '@remix-run/node';
import { useLoaderData, useFetcher, Link } from '@remix-run/react';
import { useState, useEffect, useRef } from 'react';
import { sessionStorage } from '~/services/session.server';
import { getPlaylist, savePlaylist } from '~/services/playlist.server';
import UserMenu from '~/components/layout/UserMenu';
import { SongsList, PlaylistInfo, PlaylistRecommendation, BackgroundGradient, SongDetail } from '~/components/playlist_components';

interface PlaylistData {
  playlist: PlaylistRecommendation;
  user: any;
  colorPalette: {
    primary: string;
    secondary: string;
    accent: string;
    gradient: string;
  } | null;
}

// Types for action responses
interface SpotifyActionSuccess {
  success: true;
  message: string;
  playlistUrl: string;
  tracksAdded: number;
  totalSongs: number;
  notFoundCount: number;
  previewUrl?: string;
  albumArt?: string;
}

interface SpotifyActionError {
  error: string;
  success?: false;
}

interface FineTuneResponse {
  success: boolean;
  newSongs?: string[];
  newSongDetails?: SongDetail[];
  error?: string;
  playlist?: any;
}

type SpotifyActionResponse = SpotifyActionSuccess | SpotifyActionError;

// Music Player Modal Component
interface MusicPlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  songName: string;
  artistName: string;
  albumArt?: string;
  previewUrl?: string;
  spotifyUrl?: string;
}

const MusicPlayerModal: React.FC<MusicPlayerModalProps> = ({
  isOpen,
  onClose,
  songName,
  artistName,
  albumArt,
  previewUrl,
  spotifyUrl
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(30); // Spotify previews are 30 seconds
  const [volume, setVolume] = useState(0.7);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setIsPlaying(false);
      setCurrentTime(0);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setIsPlaying(false);
      setCurrentTime(0);
    }
  }, [isOpen]);

  // Update current time
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration || 30);
    const onEnded = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('ended', onEnded);
    };
  }, [previewUrl]);

  // Update volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  const togglePlayPause = async () => {
    if (!audioRef.current || !previewUrl) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      try {
        await audioRef.current.play();
        setIsPlaying(true);
      } catch (error) {
        console.error('Error playing audio:', error);
      }
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;

    const newTime = parseFloat(e.target.value);
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVolume(parseFloat(e.target.value));
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const openInSpotify = () => {
    if (spotifyUrl) {
      window.open(spotifyUrl, '_blank');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-purple-900/90 to-pink-900/90 backdrop-blur-md rounded-2xl p-8 max-w-md w-full mx-4 ring-1 ring-white/20 shadow-2xl animate-scale-in">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Album Art */}
        <div className="flex justify-center mb-6">
          <div className="w-48 h-48 rounded-xl overflow-hidden shadow-xl bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center">
            {albumArt ? (
              <img 
                src={albumArt} 
                alt={`${songName} album art`}
                className="w-full h-full object-cover"
              />
            ) : (
              <svg className="w-20 h-20 text-white/50" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
              </svg>
            )}
          </div>
        </div>

        {/* Song Info */}
        <div className="text-center mb-6">
          <h3 className="text-white text-xl font-bold mb-1 line-clamp-2">{songName}</h3>
          <p className="text-white/70 text-lg">{artistName}</p>
        </div>

        {/* Audio Element */}
        {previewUrl && (
          <audio
            ref={audioRef}
            src={previewUrl}
            preload="metadata"
          />
        )}

        {/* Controls */}
        <div className="space-y-4">
          {/* Progress Bar */}
          <div className="space-y-2">
            <input
              type="range"
              min="0"
              max={duration}
              value={currentTime}
              onChange={handleSeek}
              disabled={!previewUrl}
              className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer slider"
            />
            <div className="flex justify-between text-white/60 text-sm">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Play Controls */}
          <div className="flex items-center justify-center space-x-4">
            <button
              onClick={togglePlayPause}
              disabled={!previewUrl}
              className="bg-white text-purple-900 rounded-full p-4 hover:bg-white/90 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:scale-105"
            >
              {isPlaying ? (
                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                </svg>
              ) : (
                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              )}
            </button>
          </div>

          {/* Volume Control */}
          <div className="flex items-center space-x-3">
            <svg className="w-5 h-5 text-white/60" fill="currentColor" viewBox="0 0 24 24">
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
            </svg>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={handleVolumeChange}
              className="flex-1 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer slider"
            />
          </div>

          {/* Preview Notice & Spotify Link */}
          <div className="text-center space-y-3">
            {previewUrl ? (
              <p className="text-white/60 text-sm">30-second preview</p>
            ) : (
              <p className="text-white/60 text-sm">Preview not available</p>
            )}
            
            {spotifyUrl && (
              <button
                onClick={openInSpotify}
                className="bg-green-600 hover:bg-green-500 text-white px-6 py-2 rounded-full font-medium transition-all duration-200 hover:scale-105 shadow-lg flex items-center justify-center space-x-2 mx-auto"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.42 1.56-.299.421-1.02.599-1.559.3z"/>
                </svg>
                <span>Listen on Spotify</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const fetchDetailsForNewSongs = async (songs: string[]): Promise<SongDetail[]> => {
  try {
    const { spotifyDurationService } = await import('~/services/duration-fetching.server');
    const details = await spotifyDurationService.getSongDetails(songs);
    
    // Convert to our local SongDetail type
    return details.map(detail => ({
      name: detail.name,
      artist: detail.artist,
      duration: detail.duration,
      spotifyId: detail.spotifyId,
      spotifyUrl: detail.spotifyUrl
    }));
  } catch (error) {
    console.error('Error fetching details for new songs:', error);
    return songs.map(song => {
      const match = song.match(/^\d+\.\s*"([^"]+)"\s*by\s*(.+)$/);
      return {
        name: match ? match[1] : song,
        artist: match ? match[2] : 'Unknown'
      };
    });
  }
};

// Function to get detailed Spotify data for a song (including preview URL and album art)
async function getDetailedSpotifyData(songName: string, artistName: string): Promise<{
  spotifyUrl?: string;
  previewUrl?: string;
  albumArt?: string;
} | null> {
  try {
    // Import Spotify credentials
    const { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET } = await import('~/utils/envExports');
    
    // Get token
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')}`
      },
      body: 'grant_type=client_credentials'
    });
    
    if (!tokenResponse.ok) return null;
    
    const tokenData = await tokenResponse.json();
    const token = tokenData.access_token;
    
    // Search for song
    const searchQuery = `track:"${songName}" artist:"${artistName}"`;
    const searchResponse = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(searchQuery)}&type=track&limit=1`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    if (!searchResponse.ok) return null;
    
    const searchData = await searchResponse.json();
    if (searchData.tracks.items.length > 0) {
      const track = searchData.tracks.items[0];
      return {
        spotifyUrl: track.external_urls.spotify,
        previewUrl: track.preview_url,
        albumArt: track.album.images[0]?.url
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error getting detailed Spotify data:', error);
    return null;
  }
}

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const session = await sessionStorage.getSession(request.headers.get('Cookie'));
  const user = session.get('user');
  if (!user) return redirect('/login');
  
  const playlistId = params.id;
  if (!playlistId) return redirect('/dashboard');
  
  // Check if user has the required scopes by testing playlist access
  if (user.accessToken) {
    try {
      const scopeTestResponse = await fetch('https://api.spotify.com/v1/me/playlists?limit=1', {
        headers: {
          'Authorization': `Bearer ${user.accessToken}`
        }
      });
      
      // If we get 403, the user needs to re-authenticate with new scopes
      if (scopeTestResponse.status === 403) {
        console.log("User needs to re-authenticate for playlist permissions");
        // Clear the session and redirect to auth
        return redirect('/auth/spotify', {
          headers: {
            'Set-Cookie': await sessionStorage.destroySession(session)
          }
        });
      }
    } catch (error) {
      console.log("Error checking playlist permissions:", error);
    }
  }
  
  // Get playlist from storage
  let playlist = getPlaylist(playlistId);
  
  if (!playlist) {
    // If playlist not found, create a sample playlist for demo purposes
    const samplePlaylist: PlaylistRecommendation = {
      id: playlistId,
      name: "Sample Energetic Rock Mix",
      description: "A high-energy rock playlist perfect for workouts and getting pumped up",
      songs: [
        '1. "Thunder" by Imagine Dragons',
        '2. "Believer" by Imagine Dragons', 
        '3. "Radioactive" by Imagine Dragons',
        '4. "Whatever It Takes" by Imagine Dragons',
        '5. "Natural" by Imagine Dragons',
        '6. "Enemy" by Imagine Dragons',
        '7. "Bones" by Imagine Dragons',
        '8. "Follow You" by Imagine Dragons',
        '9. "Wrecked" by Imagine Dragons',
        '10. "Bad Liar" by Imagine Dragons',
        '11. "It\'s Time" by Imagine Dragons',
        '12. "Demons" by Imagine Dragons',
        '13. "On Top of the World" by Imagine Dragons',
        '14. "I Bet My Life" by Imagine Dragons',
        '15. "Shots" by Imagine Dragons'
      ],
      createdAt: new Date().toISOString(),
      userId: user.id,
      coverImageUrl: undefined,
      filters: {
        genre: "Rock",
        mood: "Energetic",
        activity: "Workout"
      }
    };
    
    playlist = samplePlaylist;
  }
  
  // Check if user owns this playlist
  if (playlist.userId !== user.id) {
    return redirect('/dashboard');
  }
  
  // Skip Spotify verification since songs were already verified during generation
  // Only fetch song details if not already cached (for duration info only)
  if (playlist && !(playlist as any).songDetails) {
  try {
    console.log('Fetching song details...');
    
    // First try to get from Spotify
    const { spotifyDurationService } = await import('~/services/duration-fetching.server');
    const details = await spotifyDurationService.getSongDetails(playlist.songs);
    
    // If we got details, use them
    if (details && details.length > 0) {
      (playlist as any).songDetails = details;
    } 
    // Fallback if Spotify fails
    else {
      (playlist as any).songDetails = playlist.songs.map(song => {
        const match = song.match(/^\d+\.\s*"([^"]+)"\s*by\s*(.+)$/);
        return {
          name: match ? match[1] : song,
          artist: match ? match[2] : 'Unknown',
          duration: 180000, // Default 3 minutes
          spotifyId: undefined,
          spotifyUrl: undefined
        };
      });
    }
    
    savePlaylist(playlist);
    console.log('Song details processed');
    
  } catch (error) {
    console.error('Error getting song details:', error);
    // Emergency fallback
    (playlist as any).songDetails = playlist.songs.map(song => ({
      name: song,
      artist: 'Unknown',
      duration: 180000 // Default 3 minutes
    }));
  }
}
  
  // Check for cover image if not already set
  if (!playlist.coverImageUrl) {
    try {
      const { getPlaylistCoverUrl } = await import('~/services/stability.server');
      const coverUrl = getPlaylistCoverUrl(playlistId);
      if (coverUrl) {
        playlist.coverImageUrl = coverUrl;
      }
    } catch (error) {
      console.log("Error checking for cover image:", error);
    }
  }
  
  // Extract colors from cover image if available
  let colorPalette = null;
  if (playlist.coverImageUrl) {
    try {
      const { extractColorsFromPlaylistCover } = await import('~/services/color-extraction.server');
      colorPalette = await extractColorsFromPlaylistCover(playlistId);
    } catch (error) {
      console.log("Error extracting colors:", error);
    }
  }
  
  return { playlist, user, colorPalette };
};

export const action = async ({ request }: ActionFunctionArgs): Promise<SpotifyActionResponse | FineTuneResponse> => {
  const session = await sessionStorage.getSession(request.headers.get('Cookie'));
  const user = session.get('user');
  
  const formData = await request.formData();
  const actionType = formData.get('actionType')?.toString();
  
  // Handle play song action
  if (actionType === 'playSong') {
    const songName = formData.get('songName')?.toString();
    const artistName = formData.get('artistName')?.toString();
    
    if (!songName || !artistName) {
      return { error: 'Missing song or artist name' };
    }
    
    try {
      const spotifyData = await getDetailedSpotifyData(songName, artistName);
      
      if (spotifyData && spotifyData.spotifyUrl) {
        return { 
          success: true, 
          message: 'Song found on Spotify',
          playlistUrl: spotifyData.spotifyUrl,
          tracksAdded: 1,
          totalSongs: 1,
          notFoundCount: 0,
          previewUrl: spotifyData.previewUrl,
          albumArt: spotifyData.albumArt
        };
      } else {
        return { error: 'Song not found on Spotify' };
      }
    } catch (error) {
      console.error('Error getting song data:', error);
      return { error: 'Failed to get song data' };
    }
  }
  
  // Handle fine-tuning actions first
  if (actionType === 'savePlaylist') {
    const playlistData = formData.get('playlistData')?.toString();
    if (!playlistData) {
      return { error: 'No playlist data provided' };
    }
    
    try {
      const playlist: any = JSON.parse(playlistData);
      playlist.userId = user.id;
      
      console.log(`Saving updated playlist: ${playlist.name} with ${playlist.songs.length} songs`);
      
      const savedPlaylist = savePlaylist(playlist);
      return { success: true, playlist: savedPlaylist };
    } catch (error) {
      console.error('Error saving playlist:', error);
      return { error: 'Failed to save playlist' };
    }
  }
  
  if (actionType === 'addMoreSongs') {
    const playlistId = formData.get('playlistId')?.toString();
    const currentSongs = formData.get('currentSongs')?.toString();
    const userOptionsData = formData.get('userOptions')?.toString();
    
    if (!playlistId || !currentSongs || !userOptionsData) {
      return { success: false, error: 'Missing required data for adding more songs' };
    }
    
    try {
      const userOptions = JSON.parse(userOptionsData);
      const existingSongs = currentSongs.split('\n').filter(line => line.trim());
      
      const { callEnhancedLlama } = await import('~/services/llama.server');
      const prompt = `Add 5 more songs to this existing playlist. Avoid these already included songs: ${existingSongs.slice(0, 10).join(', ')}`;
      
      const response = await callEnhancedLlama(prompt, userOptions, user.id);
      
      if (response.content) {
        const newSongs = response.content
          .split('\n')
          .filter(line => line.trim().match(/^\d+\.\s*"[^"]+"\s*by\s*.+/))
          .map(line => line.trim())
          .slice(0, 5);
        
        // Fetch details for new songs
        const newSongDetails = await fetchDetailsForNewSongs(newSongs);
        
        return { success: true, newSongs, newSongDetails };
      } else {
        return { success: false, error: 'Failed to generate new songs' };
      }
    } catch (error) {
      console.error('Error adding more songs:', error);
      return { success: false, error: 'Failed to generate additional songs' };
    }
  }
  
  if (actionType === 'replaceSongs') {
    const playlistId = formData.get('playlistId')?.toString();
    const songsToReplace = formData.get('songsToReplace')?.toString();
    const userOptionsData = formData.get('userOptions')?.toString();
    
    if (!playlistId || !songsToReplace || !userOptionsData) {
      return { success: false, error: 'Missing required data for replacing songs' };
    }
    
    try {
      const userOptions = JSON.parse(userOptionsData);
      const songsToReplaceArray = songsToReplace.split('\n').filter(line => line.trim());
      
      console.log(`Replacing ${songsToReplaceArray.length} songs`);
      
      const { callEnhancedLlama } = await import('~/services/llama.server');
      const prompt = `Generate ${songsToReplaceArray.length} replacement songs similar to these but different: ${songsToReplaceArray.join(', ')}. Make sure they match the same genre and mood preferences.`;
      
      const response = await callEnhancedLlama(prompt, userOptions, user.id);
      
      if (response.content) {
        const newSongs = response.content
          .split('\n')
          .filter(line => line.trim().match(/^\d+\.\s*"[^"]+"\s*by\s*.+/))
          .map(line => line.trim())
          .slice(0, songsToReplaceArray.length);
        
        console.log(`Generated ${newSongs.length} replacement songs`);
        
        // Fetch details for replacement songs
        const newSongDetails = await fetchDetailsForNewSongs(newSongs);
        
        return { success: true, newSongs, newSongDetails };
      } else {
        return { success: false, error: 'Failed to generate replacement songs' };
      }
    } catch (error) {
      console.error('Error replacing songs:', error);
      return { success: false, error: 'Failed to generate replacement songs' };
    }
  }
  
  if (actionType === 'regeneratePlaylist') {
    const playlistId = formData.get('playlistId')?.toString();
    const userOptionsData = formData.get('userOptions')?.toString();
    
    if (!playlistId || !userOptionsData) {
      return { success: false, error: 'Missing required data for regenerating playlist' };
    }
    
    try {
      const userOptions = JSON.parse(userOptionsData);
      
      console.log('Regenerating playlist with options:', userOptions);
      
      const { callEnhancedLlama } = await import('~/services/llama.server');
      const prompt = 'Create a fresh playlist of exactly 20 songs based on my preferences, avoiding any previously recommended songs';
      
      const response = await callEnhancedLlama(prompt, userOptions, user.id);
      
      if (response.content) {
        console.log('Raw regeneration response:', response.content);
        
        const newSongs = response.content
          .split('\n')
          .filter(line => {
            const trimmed = line.trim();
            return trimmed.match(/^\d+\.\s*.*?\s+(by|-)?\s*.+/) && trimmed.length > 10;
          })
          .map(line => {
            const trimmed = line.trim();
            if (trimmed.match(/^\d+\.\s*"[^"]+"\s*by\s*.+/)) {
              return trimmed;
            } else if (trimmed.match(/^\d+\.\s*([^"]+?)\s+by\s+(.+)/)) {
              const match = trimmed.match(/^(\d+\.\s*)([^"]+?)\s+by\s+(.+)/);
              if (match) {
                return `${match[1]}"${match[2].trim()}" by ${match[3].trim()}`;
              }
            } else if (trimmed.match(/^\d+\.\s*(.+?)\s+-\s+(.+)/)) {
              const match = trimmed.match(/^(\d+\.\s*)(.+?)\s+-\s+(.+)/);
              if (match) {
                return `${match[1]}"${match[2].trim()}" by ${match[3].trim()}`;
              }
            }
            return trimmed;
          });
        
        console.log(`Generated ${newSongs.length} songs for regenerated playlist`);
        
        if (newSongs.length < 20) {
          console.log(`Only got ${newSongs.length} songs, padding to 20`);
          const fallbackSongs = [
            '"Blinding Lights" by The Weeknd',
            '"Shape of You" by Ed Sheeran',
            '"Dance The Night" by Dua Lipa',
            '"As It Was" by Harry Styles',
            '"Anti-Hero" by Taylor Swift',
            '"Flowers" by Miley Cyrus',
            '"Unholy" by Sam Smith ft. Kim Petras',
            '"Heat Waves" by Glass Animals',
            '"Stay" by The Kid LAROI & Justin Bieber',
            '"Good 4 U" by Olivia Rodrigo'
          ];
          
          let songIndex = newSongs.length;
          while (newSongs.length < 20 && fallbackSongs.length > 0) {
            const fallback = fallbackSongs.shift();
            if (fallback) {
              newSongs.push(`${songIndex + 1}. ${fallback}`);
              songIndex++;
            }
          }
        }
        
        const finalSongs = newSongs.slice(0, 20).map((song, index) => {
          return song.replace(/^\d+\./, `${index + 1}.`);
        });
        
        console.log(`Final regenerated playlist has ${finalSongs.length} songs:`, finalSongs);
        
        // Fetch details for all new songs
        const newSongDetails = await fetchDetailsForNewSongs(finalSongs);
        
        return { success: true, newSongs: finalSongs, newSongDetails };
      } else {
        console.error('No content received from LLM for regeneration');
        return { success: false, error: 'Failed to regenerate playlist - no content received' };
      }
    } catch (error) {
      console.error('Error regenerating playlist:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return { success: false, error: `Failed to regenerate playlist: ${errorMessage}` };
    }
  }
  
  // Spotify integration actions
  console.log("Spotify action called, user:", user ? "authenticated" : "not authenticated");
  
  if (!user || !user.accessToken) {
    return { error: "Not authenticated with Spotify. Please log in again." };
  }
  
  if (actionType === 'checkTokenScopes') {
    try {
      const response = await fetch('https://api.spotify.com/v1/me', {
        headers: {
          'Authorization': `Bearer ${user.accessToken}`
        }
      });
      
      if (response.ok) {
        const userData = await response.json();
        console.log("Current user data:", userData);
        
        const playlistResponse = await fetch('https://api.spotify.com/v1/me/playlists?limit=1', {
          headers: {
            'Authorization': `Bearer ${user.accessToken}`
          }
        });
        
        console.log("Playlist access status:", playlistResponse.status);
        
        if (playlistResponse.ok) {
          return { 
            success: true, 
            message: `Token is valid. User: ${userData.display_name}. Playlist access: OK.`,
            playlistUrl: '',
            tracksAdded: 0,
            totalSongs: 0,
            notFoundCount: 0
          };
        } else {
          const errorText = await playlistResponse.text();
          return { 
            error: `Token valid but playlist access failed: ${playlistResponse.status} - ${errorText}` 
          };
        }
      } else {
        const errorText = await response.text();
        return { 
          error: `Token invalid: ${response.status} - ${errorText}` 
        };
      }
    } catch (error) {
      return { error: `Token check failed: ${error}` };
    }
  }
  
  if (actionType === 'testImageUpload') {
    const playlistId = formData.get('playlistId')?.toString();
    const spotifyPlaylistId = formData.get('spotifyPlaylistId')?.toString();
    
    if (!playlistId || !spotifyPlaylistId) {
      return { error: "Missing playlist IDs" };
    }
    
    try {
      const fs = await import('fs');
      const path = await import('path');
      
      const jpegPath = path.join(process.cwd(), "public", "playlist-covers", `${playlistId}.jpg`);
      const webpPath = path.join(process.cwd(), "public", "playlist-covers", `${playlistId}.webp`);
      
      let coverPath: string | null = null;
      
      if (fs.existsSync(jpegPath)) {
        coverPath = jpegPath;
      } else if (fs.existsSync(webpPath)) {
        coverPath = webpPath;
      }
      
      if (coverPath) {
        let imageBuffer = fs.readFileSync(coverPath);
        
        if (imageBuffer.length > 250 * 1024) {
          try {
            const sharp = await import('sharp');
            imageBuffer = await sharp.default(imageBuffer)
              .resize(512, 512, { 
                fit: 'cover',
                withoutEnlargement: true 
              })
              .jpeg({ 
                quality: 80,
                progressive: true 
              })
              .toBuffer();
          } catch (sharpError) {
            console.log("Sharp not available, using original image...");
          }
        }
        
        const base64Image = imageBuffer.toString('base64');
        
        const uploadResponse = await fetch(
          `https://api.spotify.com/v1/playlists/${spotifyPlaylistId}/images`,
          {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${user.accessToken}`,
              'Content-Type': 'image/jpeg'
            },
            body: base64Image
          }
        );
        
        if (uploadResponse.ok) {
          return { success: true, message: "Test image upload successful!", playlistUrl: '', tracksAdded: 0, totalSongs: 0, notFoundCount: 0 };
        } else {
          const errorText = await uploadResponse.text();
          return { error: `Test upload failed: ${uploadResponse.status} - ${errorText}` };
        }
      } else {
        return { error: "No cover image found for testing" };
      }
    } catch (error) {
      return { error: `Test upload error: ${error}` };
    }
  }
  
  if (actionType === 'addToSpotify') {
    const playlistName = formData.get('playlistName')?.toString();
    const playlistDescription = formData.get('playlistDescription')?.toString();
    const songs = formData.get('songs')?.toString();
    const playlistId = formData.get('playlistId')?.toString();
    
    if (!playlistName || !songs) {
      return { error: "Missing playlist data" };
    }
  
    try {
      const songList = songs.split('\n').filter(line => line.trim());
      console.log(`Processing ${songList.length} PRE-VERIFIED songs for Spotify playlist`);
      
      const profileTestResponse = await fetch('https://api.spotify.com/v1/me', {
        headers: {
          'Authorization': `Bearer ${user.accessToken}`
        }
      });
      
      if (!profileTestResponse.ok) {
        if (profileTestResponse.status === 401) {
          return { error: "Your Spotify session has expired. Please log out and log back in." };
        } else if (profileTestResponse.status === 403) {
          return { error: "Insufficient Spotify permissions. You need to reconnect your account with playlist creation permissions." };
        } else {
          return { error: `Spotify API error: ${profileTestResponse.status}. Please try again.` };
        }
      }
      
      const profileData = await profileTestResponse.json();
      console.log("Spotify profile verified for user:", profileData.id);
      
      const createPlaylistResponse = await fetch(`https://api.spotify.com/v1/users/${profileData.id}/playlists`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: playlistName,
          description: playlistDescription,
          public: false,
          collaborative: false
        })
      });
      
      if (!createPlaylistResponse.ok) {
        const errorText = await createPlaylistResponse.text();
        
        if (createPlaylistResponse.status === 403) {
          return { error: "Permission denied: Your Spotify account doesn't have permission to create playlists." };
        } else if (createPlaylistResponse.status === 401) {
          return { error: "Authentication failed: Your Spotify session has expired." };
        } else {
          return { error: `Failed to create playlist: ${createPlaylistResponse.status}. ${errorText}` };
        }
      }
      
      const playlistData = await createPlaylistResponse.json();
      console.log("Created Spotify playlist:", playlistData.name, "ID:", playlistData.id);
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Add cover image logic
      if (playlistId) {
        try {
          const fs = await import('fs');
          const path = await import('path');
          
          const jpegPath = path.join(process.cwd(), "public", "playlist-covers", `${playlistId}.jpg`);
          const webpPath = path.join(process.cwd(), "public", "playlist-covers", `${playlistId}.webp`);
          
          let coverPath: string | null = null;
          
          for (let i = 0; i < 30; i++) {
            if (fs.existsSync(jpegPath)) {
              coverPath = jpegPath;
              break;
            } else if (fs.existsSync(webpPath)) {
              coverPath = webpPath;
              break;
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          
          if (coverPath) {
            let imageBuffer = fs.readFileSync(coverPath);
            
            if (imageBuffer.length > 250 * 1024) {
              try {
                const sharp = await import('sharp');
                imageBuffer = await sharp.default(imageBuffer)
                  .resize(512, 512, { 
                    fit: 'cover',
                    withoutEnlargement: true 
                  })
                  .jpeg({ 
                    quality: 80,
                    progressive: true 
                  })
                  .toBuffer();
              } catch (sharpError) {
                console.log("Sharp not available for resizing");
              }
            }
            
            const base64Image = imageBuffer.toString('base64');
            
            const uploadImageResponse = await fetch(
              `https://api.spotify.com/v1/playlists/${playlistData.id}/images`,
              {
                method: 'PUT',
                headers: {
                  'Authorization': `Bearer ${user.accessToken}`,
                  'Content-Type': 'image/jpeg'
                },
                body: base64Image
              }
            );
            
            if (uploadImageResponse.ok) {
              console.log("✅ Successfully uploaded cover image to Spotify playlist");
            } else {
              console.error("❌ Failed to upload cover image");
            }
          }
        } catch (imageError) {
          console.error("❌ Error handling cover image upload:", imageError);
        }
      }
      
      // Search and add pre-verified songs - should have high success rate
      const trackUris: string[] = [];
      const notFoundSongs: string[] = [];
      
      console.log("🔍 Searching for pre-verified songs on Spotify...");
      
      for (const song of songList) {
        try {
          const match = song.match(/^\d+\.\s*"([^"]+)"\s*by\s*(.+)$/);
          if (!match) {
            console.warn("Invalid song format:", song);
            continue;
          }
          
          const [, songName, artistName] = match;
          const cleanSongName = songName.replace(/[^\w\s]/g, '');
          const cleanArtistName = artistName.replace(/[^\w\s]/g, '').trim();
          const searchQuery = `track:"${cleanSongName}" artist:"${cleanArtistName}"`;
          
          const searchResponse = await fetch(
            `https://api.spotify.com/v1/search?q=${encodeURIComponent(searchQuery)}&type=track&limit=3`,
            {
              headers: {
                'Authorization': `Bearer ${user.accessToken}`
              }
            }
          );
          
          if (searchResponse.ok) {
            const searchData = await searchResponse.json();
            if (searchData.tracks.items.length > 0) {
              let bestMatch = searchData.tracks.items[0];
              
              // Try to find exact match by artist
              for (const track of searchData.tracks.items) {
                const trackArtists = track.artists.map((a: any) => a.name.toLowerCase()).join(' ');
                if (trackArtists.includes(cleanArtistName.toLowerCase())) {
                  bestMatch = track;
                  break;
                }
              }
              
              trackUris.push(bestMatch.uri);
              console.log(`✅ Found: "${bestMatch.name}" by ${bestMatch.artists[0].name}`);
            } else {
              notFoundSongs.push(song);
              console.log(`❌ Unexpected: Pre-verified song not found: "${songName}" by ${artistName}`);
            }
          } else {
            notFoundSongs.push(song);
            console.warn(`Search failed for: "${songName}" by ${artistName}`);
          }
          
          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 150));
        } catch (error) {
          notFoundSongs.push(song);
          console.error(`Error searching for song: ${song}`, error);
        }
      }
      
      console.log(`✅ Successfully found ${trackUris.length} out of ${songList.length} pre-verified songs`);
      
      // Add tracks to playlist in batches
      if (trackUris.length > 0) {
        const batchSize = 100;
        let addedCount = 0;
        
        for (let i = 0; i < trackUris.length; i += batchSize) {
          const batch = trackUris.slice(i, i + batchSize);
          
          const addTracksResponse = await fetch(
            `https://api.spotify.com/v1/playlists/${playlistData.id}/tracks`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${user.accessToken}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                uris: batch
              })
            }
          );
          
          if (addTracksResponse.ok) {
            addedCount += batch.length;
            console.log(`✅ Added batch of ${batch.length} songs to playlist (Total: ${addedCount})`);
          } else {
            console.error(`❌ Failed to add batch to playlist: ${addTracksResponse.status}`);
          }
        }
      }
      
      const successRate = songList.length > 0 ? Math.round((trackUris.length / songList.length) * 100) : 0;
      let resultMessage = `Successfully created playlist "${playlistName}" with ${trackUris.length} songs!`;
      
      if (successRate < 100) {
        resultMessage += ` ${successRate}% of songs were successfully added.`;
      }
      
      if (notFoundSongs.length > 0) {
        resultMessage += ` Note: ${notFoundSongs.length} pre-verified songs were unexpectedly not found.`;
      }
      
      return { 
        success: true, 
        message: resultMessage,
        playlistUrl: playlistData.external_urls.spotify,
        tracksAdded: trackUris.length,
        totalSongs: songList.length,
        notFoundCount: notFoundSongs.length
      };
      
    } catch (error) {
      console.error("Error creating Spotify playlist:", error);
      return { 
        error: error instanceof Error ? error.message : "An unexpected error occurred while creating the playlist"
      };
    }
  }
  
  return { error: 'Invalid action' };
};

// Enhanced SongsList component with play functionality
const EnhancedSongsList = ({ 
  songs, 
  selectedSongs, 
  showFineTuneOptions, 
  isLoading, 
  onToggleSongSelection, 
  onClearSelection,
  songDetails 
}: {
  songs: string[];
  selectedSongs: Set<number>;
  showFineTuneOptions: boolean;
  isLoading: boolean;
  onToggleSongSelection: (index: number) => void;
  onClearSelection: () => void;
  songDetails?: SongDetail[];
}) => {
  const playFetcher = useFetcher<SpotifyActionResponse>();
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const [showPlayer, setShowPlayer] = useState(false);
  const [currentSong, setCurrentSong] = useState<{
    name: string;
    artist: string;
    previewUrl?: string;
    spotifyUrl?: string;
    albumArt?: string;
  } | null>(null);
  
  const handlePlaySong = (index: number, songName: string, artistName: string) => {
    setPlayingIndex(index);
    
    const formData = new FormData();
    formData.append('actionType', 'playSong');
    formData.append('songName', songName);
    formData.append('artistName', artistName);
    
    playFetcher.submit(formData, { method: 'post' });
  };
  
  useEffect(() => {
    if (playFetcher.state === 'idle' && playFetcher.data) {
      if (playFetcher.data.success && 'playlistUrl' in playFetcher.data) {
        // Get song info for the modal
        const songIndex = playingIndex;
        if (songIndex !== null) {
          const song = songs[songIndex];
          const match = song.match(/^\d+\.\s*"([^"]+)"\s*by\s*(.+)$/);
          const songName = match ? match[1] : song;
          const artistName = match ? match[2] : 'Unknown Artist';
          
          setCurrentSong({
            name: songName,
            artist: artistName,
            spotifyUrl: playFetcher.data.playlistUrl,
            previewUrl: playFetcher.data.previewUrl,
            albumArt: playFetcher.data.albumArt
          });
          setShowPlayer(true);
        }
      } else if (playFetcher.data.error) {
        alert(`Error: ${playFetcher.data.error}`);
      }
      setPlayingIndex(null);
    }
  }, [playFetcher.state, playFetcher.data, playingIndex, songs]);
  
  const closePlayer = () => {
    setShowPlayer(false);
    setCurrentSong(null);
  };
  
  return (
    <>
      <div className='flex-1 bg-white/10 backdrop-blur-md rounded-xl p-6 ring-1 ring-white/30 shadow-xl hover:shadow-2xl transition-all duration-300'>
        <div className='flex items-center justify-between mb-4'>
          <h3 className='text-white font-bold text-xl'>Songs ({songs.length})</h3>
          {showFineTuneOptions && selectedSongs.size > 0 && (
            <button
              onClick={onClearSelection}
              className='text-white/80 hover:text-white text-sm underline'
            >
              Clear selection ({selectedSongs.size})
            </button>
          )}
        </div>
        
        <div className='max-h-[600px] overflow-y-auto space-y-3 pr-4
          [&::-webkit-scrollbar]:w-1.5
          [&::-webkit-scrollbar]:hover:w-2
          [&::-webkit-scrollbar-track]:rounded-xl
          [&::-webkit-scrollbar-track]:bg-white/10
          [&::-webkit-scrollbar-thumb]:rounded-lg
          [&::-webkit-scrollbar-thumb]:bg-orange-200/30
          [&::-webkit-scrollbar-thumb]:hover:bg-orange-200/40'>
          
          {songs.map((song, index) => {
            const match = song.match(/^\d+\.\s*"([^"]+)"\s*by\s*(.+)$/);
            const songName = match ? match[1] : song;
            const artistName = match ? match[2] : 'Unknown Artist';
            const songDetail = songDetails?.[index];
            const isSelected = selectedSongs.has(index);
            const isPlaying = playingIndex === index;
            
            return (
              <div
                key={index}
                className={`song-item p-4 rounded-lg flex items-center justify-between group transition-all duration-200 ${
                  isSelected ? 'bg-white/20 ring-1 ring-white/40' : ''
                } ${isLoading ? 'opacity-50' : ''}`}
              >
                <div className='flex items-center space-x-4 flex-1'>
                  <div className='text-white/60 font-medium w-8 text-center text-sm'>
                    {index + 1}
                  </div>
                  
                  {showFineTuneOptions && (
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggleSongSelection(index)}
                      disabled={isLoading}
                      className="w-4 h-4 text-pink-600 bg-white/20 border-white/30 rounded focus:ring-pink-500 focus:ring-2"
                    />
                  )}
                  
                  <div className='flex-1 min-w-0'>
                    <div className='text-white font-medium text-base mb-1 truncate'>
                      {songName}
                    </div>
                    <div className='text-white/70 text-sm truncate'>
                      {artistName}
                    </div>
                  </div>
                  
                  <div className='text-white/60 text-sm tabular-nums font-medium'>
                    {songDetail?.duration ? 
                      `${Math.floor(songDetail.duration / 60000)}:${String(Math.floor((songDetail.duration % 60000) / 1000)).padStart(2, '0')}` : 
                      '--:--'
                    }
                  </div>
                </div>
                
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handlePlaySong(index, songName, artistName);
                  }}
                  disabled={isPlaying || playFetcher.state === 'submitting'}
                  className='ml-4 p-3 text-white/60 hover:text-white rounded-full hover:bg-white/20 transition-all duration-200 group-hover:opacity-100 opacity-0 disabled:opacity-50 hover:scale-110'
                  title="Play song"
                  type="button"
                >
                  {isPlaying ? (
                    <div className="w-5 h-5 rounded-full border-2 border-current border-t-transparent animate-spin"></div>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Music Player Modal */}
      {currentSong && (
        <MusicPlayerModal
          isOpen={showPlayer}
          onClose={closePlayer}
          songName={currentSong.name}
          artistName={currentSong.artist}
          albumArt={currentSong.albumArt}
          previewUrl={currentSong.previewUrl}
          spotifyUrl={currentSong.spotifyUrl}
        />
      )}
    </>
  );
};

export default function PlaylistPage() {
  const { playlist: initialPlaylist, user, colorPalette: initialColorPalette } = useLoaderData<PlaylistData>();
  const [currentColorPalette, setCurrentColorPalette] = useState<PlaylistData['colorPalette']>(initialColorPalette);
  const [isExtractingColors, setIsExtractingColors] = useState(false);
  
  // State - only in main component
  const [playlist, setPlaylist] = useState(initialPlaylist);
  const [selectedSongs, setSelectedSongs] = useState<Set<number>>(new Set());
  const [showFineTuneOptions, setShowFineTuneOptions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [successMessage, setSuccessMessage] = useState<string | undefined>();
  const [currentActionType, setCurrentActionType] = useState<string | null>(null);
  
  const fetcher = useFetcher<FineTuneResponse>();
  
  // Effect - handles all fetcher responses
  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data) {
      setIsLoading(false);
      
      if (fetcher.data.success && fetcher.data.newSongs) {
        const newSongs = fetcher.data.newSongs;
        const newSongDetails = fetcher.data.newSongDetails || [];
        let updatedPlaylist: PlaylistRecommendation | null = null;
        
        if (currentActionType === 'addMoreSongs') {
          updatedPlaylist = { 
            ...playlist, 
            songs: [...playlist.songs, ...newSongs],
            songDetails: [...(((playlist as any).songDetails) || []), ...newSongDetails]
          };
          setPlaylist(updatedPlaylist);
          setSuccessMessage('Successfully added new songs!');
        } else if (currentActionType === 'replaceSongs') {
          const updatedSongs = [...playlist.songs];
          const updatedSongDetails = [...((playlist as any).songDetails || [])];
          
          Array.from(selectedSongs).forEach((index, replaceIndex) => {
            if (newSongs[replaceIndex]) {
              updatedSongs[index] = newSongs[replaceIndex];
              updatedSongDetails[index] = newSongDetails[replaceIndex] || { 
                name: newSongs[replaceIndex], 
                artist: 'Unknown' 
              };
            }
          });
          
          updatedPlaylist = { 
            ...playlist, 
            songs: updatedSongs,
            songDetails: updatedSongDetails
          };
          setPlaylist(updatedPlaylist);
          setSelectedSongs(new Set());
          setSuccessMessage(`Successfully replaced ${selectedSongs.size} songs!`);
        } else if (currentActionType === 'regeneratePlaylist') {
          updatedPlaylist = { 
            ...playlist, 
            songs: [...newSongs],
            songDetails: newSongDetails,
            createdAt: new Date().toISOString() 
          };
          setPlaylist(updatedPlaylist);
          setSelectedSongs(new Set());
          setSuccessMessage('Successfully regenerated playlist!');
        }
        
        if (updatedPlaylist) {
          const saveFormData = new FormData();
          saveFormData.append('actionType', 'savePlaylist');
          saveFormData.append('playlistData', JSON.stringify(updatedPlaylist));
          
          fetch(window.location.pathname, {
            method: 'POST',
            body: saveFormData
          }).catch(error => {
            console.error('Error saving playlist:', error);
          });
        }
        
        setErrorMessage(undefined);
        setCurrentActionType(null);
      } else if (fetcher.data.error) {
        setErrorMessage(fetcher.data.error);
        setSuccessMessage(undefined);
        setCurrentActionType(null);
      }
    }
  }, [fetcher.state, fetcher.data, selectedSongs, currentActionType, playlist]);
  
  // Handlers
  const handleAddMoreSongs = () => {
    setIsLoading(true);
    setCurrentActionType('addMoreSongs');
    const formData = new FormData();
    formData.append('actionType', 'addMoreSongs');
    formData.append('playlistId', playlist.id);
    formData.append('currentSongs', playlist.songs.join('\n'));
    formData.append('userOptions', JSON.stringify(playlist.filters));
    fetcher.submit(formData, { method: 'post' });
  };
  
  const handleReplaceSelectedSongs = () => {
    if (selectedSongs.size === 0) {
      alert("Please select some songs to replace");
      return;
    }
    setIsLoading(true);
    setCurrentActionType('replaceSongs');
    const songsToReplace = Array.from(selectedSongs).map(index => playlist.songs[index]);
    const formData = new FormData();
    formData.append('actionType', 'replaceSongs');
    formData.append('playlistId', playlist.id);
    formData.append('songsToReplace', songsToReplace.join('\n'));
    formData.append('userOptions', JSON.stringify(playlist.filters));
    fetcher.submit(formData, { method: 'post' });
  };
  
  const handleRegeneratePlaylist = () => {
    if (!confirm('Are you sure you want to regenerate the entire playlist? This will replace all current songs.')) {
      return;
    }
    setIsLoading(true);
    setCurrentActionType('regeneratePlaylist');
    const formData = new FormData();
    formData.append('actionType', 'regeneratePlaylist');
    formData.append('playlistId', playlist.id);
    formData.append('userOptions', JSON.stringify(playlist.filters));
    fetcher.submit(formData, { method: 'post' });
  };
  
  const handleSongSelection = (index: number) => {
    setSelectedSongs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };
  
  const handleAddToSpotify = () => {
    console.log('Add to Spotify triggered from main component');
  };
  
  return (
    <BackgroundGradient 
      imageUrl={playlist.coverImageUrl}
      className="flex h-screen w-full flex-col overflow-auto relative"
    >
      <UserMenu profileImage={user.profileImage} />
      
      {isExtractingColors && (
        <div className="fixed top-20 right-4 bg-white/10 backdrop-blur-md rounded-lg px-3 py-2 
          ring-1 ring-white/20 shadow-lg animate-pulse z-50">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-gradient-to-r from-pink-400 to-purple-400 animate-spin"></div>
            <span className="text-white text-xs">Extracting colors...</span>
          </div>
        </div>
      )}
      
      <div className='flex w-full px-10 pt-10 pb-20 flex-col'>
        <div className='flex items-center mb-6'>
          <Link 
            to="/dashboard"
            className='mr-4 p-2 text-white/80 hover:text-white rounded-full hover:bg-white/10 transition-all'
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className='text-white text-4xl font-bold drop-shadow-lg flex items-center'>
            <span className="mr-2">🎵</span> {playlist.name}
          </h1>
        </div>
        
        <div className='flex flex-col lg:flex-row gap-8 h-full'>
          <PlaylistInfo
            playlist={playlist}
            user={user}
            selectedSongs={selectedSongs}
            showFineTuneOptions={showFineTuneOptions}
            isLoading={isLoading}
            onToggleFineTuneOptions={() => setShowFineTuneOptions(!showFineTuneOptions)}
            onAddMoreSongs={handleAddMoreSongs}
            onReplaceSelectedSongs={handleReplaceSelectedSongs}
            onRegeneratePlaylist={handleRegeneratePlaylist}
            onAddToSpotify={handleAddToSpotify}
            errorMessage={errorMessage}
            successMessage={successMessage}
          />
          
          <EnhancedSongsList
            songs={playlist.songs}
            selectedSongs={selectedSongs}
            showFineTuneOptions={showFineTuneOptions}
            isLoading={isLoading}
            onToggleSongSelection={handleSongSelection}
            onClearSelection={() => setSelectedSongs(new Set())}
            songDetails={(playlist as any).songDetails}
          />
        </div>
      </div>
      
      <style>{`
        .song-item {
          background-color: rgba(255, 255, 255, 0.05) !important;
          transition: all 0.3s ease !important;
          will-change: transform, background-color;
        }
        
        .song-item:hover {
          background-color: rgba(255, 255, 255, 0.1) !important;
          transform: translateX(4px) !important;
        }
        
        .song-item.bg-white\\/20 {
          background-color: rgba(255, 255, 255, 0.2) !important;
        }
        
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes scale-in {
          from {
            opacity: 0;
            transform: scale(0.9);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        .animate-scale-in {
          animation: scale-in 0.3s ease-out;
        }

        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 16px;
          height: 16px;
          background: white;
          border-radius: 50%;
          cursor: pointer;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
        }

        .slider::-webkit-slider-thumb:hover {
          transform: scale(1.1);
        }

        .slider::-moz-range-thumb {
          width: 16px;
          height: 16px;
          background: white;
          border-radius: 50%;
          cursor: pointer;
          border: none;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
        }

        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </BackgroundGradient>
  );
}