// app/routes/playlist.$id.tsx
import { LoaderFunctionArgs, redirect, ActionFunctionArgs } from '@remix-run/node';
import { useLoaderData, useFetcher, Link } from '@remix-run/react';
import { useState, useEffect } from 'react';
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
  
  // Fetch song details if not already cached
  if (playlist && !(playlist as any).songDetails) {
    try {
      console.log('🎵 Fetching song details for playlist:', playlist.name);
      const { spotifyDurationService } = await import('~/services/duration-fetching.server');
      const songDetails = await spotifyDurationService.getSongDetails(playlist.songs);
      
      // Update playlist with song details
      (playlist as any).songDetails = songDetails;
      
      // Save the updated playlist to cache the details
      savePlaylist(playlist);
      
      console.log('✅ Song details cached successfully');
    } catch (error) {
      console.error('❌ Error fetching song details:', error);
      // Continue without song details - the component will show fallback durations
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

  if (!actionType) {
    return { error: "No action type provided" };
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
      return { 
        error: error instanceof Error ? error.message : "An unexpected error occurred while creating the playlist"
      };
    }
  }

  return { error: "Invalid action type" };
}

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
          
          <SongsList
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
      `}</style>
    </BackgroundGradient>
  );
}