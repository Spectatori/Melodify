// app/routes/playlist.$id.tsx
import { LoaderFunctionArgs, redirect, ActionFunctionArgs } from '@remix-run/node';
import { useLoaderData, useFetcher, Link } from '@remix-run/react';
import { useState, useEffect } from 'react';
import { sessionStorage } from '~/services/session.server';
import { getPlaylist } from '~/services/playlist.server';
import UserMenu from '~/components/layout/UserMenu';

interface PlaylistRecommendation {
  id: string;
  name: string;
  description: string;
  songs: string[];
  createdAt: string;
  userId: string;
  filters: {
    genre?: string;
    subgenre?: string;
    mood?: string;
    bpm?: string;
    activity?: string;
    era?: string;
    timeOfDay?: string;
    weather?: string;
  };
}

interface PlaylistData {
  playlist: PlaylistRecommendation;
  user: any;
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
  const playlist = getPlaylist(playlistId);
  
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
      filters: {
        genre: "Rock",
        mood: "Energetic",
        activity: "Workout"
      }
    };
    
    return { playlist: samplePlaylist, user };
  }
  
  // Check if user owns this playlist
  if (playlist.userId !== user.id) {
    return redirect('/dashboard');
  }
  
  return { playlist, user };
};

// Action to handle adding playlist to Spotify
export const action = async ({ request }: ActionFunctionArgs): Promise<SpotifyActionResponse> => {
  const session = await sessionStorage.getSession(request.headers.get('Cookie'));
  const user = session.get('user');
  
  console.log("Spotify action called, user:", user ? "authenticated" : "not authenticated");
  
  if (!user || !user.accessToken) {
    return { error: "Not authenticated with Spotify. Please log in again." };
  }
  
  const formData = await request.formData();
  const playlistName = formData.get('playlistName')?.toString();
  const playlistDescription = formData.get('playlistDescription')?.toString();
  const songs = formData.get('songs')?.toString();
  
  if (!playlistName || !songs) {
    return { error: "Missing playlist data" };
  }
  
  try {
    // Parse songs from the string format
    const songList = songs.split('\n').filter(line => line.trim());
    console.log(`Processing ${songList.length} songs for Spotify playlist`);
    
    // First, test if the access token is still valid by getting user profile
    const profileTestResponse = await fetch('https://api.spotify.com/v1/me', {
      headers: {
        'Authorization': `Bearer ${user.accessToken}`
      }
    });
    
    if (!profileTestResponse.ok) {
      console.error("Access token test failed:", profileTestResponse.status);
      
      if (profileTestResponse.status === 401) {
        return { error: "Your Spotify session has expired. Please log out and log back in." };
      } else if (profileTestResponse.status === 403) {
        return { error: "Insufficient Spotify permissions. You need to reconnect your account with playlist creation permissions. Please log out and log back in." };
      } else {
        return { error: `Spotify API error: ${profileTestResponse.status}. Please try again.` };
      }
    }
    
    const profileData = await profileTestResponse.json();
    console.log("Spotify profile verified for user:", profileData.id);
    
    // DEBUGGING: Check what scopes this token actually has
    try {
      const tokenInfoResponse = await fetch(`https://api.spotify.com/v1/me`, {
        headers: {
          'Authorization': `Bearer ${user.accessToken}`
        }
      });
      
      if (tokenInfoResponse.ok) {
        const tokenInfo = await tokenInfoResponse.json();
        console.log("Current user info:", tokenInfo);
        
        // Try to get user's playlists to test scope
        const playlistsTestResponse = await fetch('https://api.spotify.com/v1/me/playlists?limit=1', {
          headers: {
            'Authorization': `Bearer ${user.accessToken}`
          }
        });
        
        console.log("Playlists test response status:", playlistsTestResponse.status);
      }
    } catch (debugError) {
      console.log("Debug error (non-fatal):", debugError);
    }
    
    // Create playlist on Spotify using the verified user ID
    const createPlaylistResponse = await fetch(`https://api.spotify.com/v1/users/${profileData.id}/playlists`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${user.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: playlistName,
        description: playlistDescription,
        public: false, // Changed to private by default
        collaborative: false
      })
    });
    
    if (!createPlaylistResponse.ok) {
      const errorText = await createPlaylistResponse.text();
      console.error("Failed to create playlist:", createPlaylistResponse.status, errorText);
      
      if (createPlaylistResponse.status === 403) {
        return { error: "Permission denied: Your Spotify account doesn't have permission to create playlists. Please ensure you've granted playlist creation permissions and try logging out and back in." };
      } else if (createPlaylistResponse.status === 401) {
        return { error: "Authentication failed: Your Spotify session has expired. Please log out and log back in." };
      } else {
        return { error: `Failed to create playlist: ${createPlaylistResponse.status}. ${errorText}` };
      }
    }
    
    const playlistData = await createPlaylistResponse.json();
    console.log("Created Spotify playlist:", playlistData.name, "ID:", playlistData.id);
    
    // Search for each song and add to playlist
    const trackUris: string[] = [];
    const notFoundSongs: string[] = [];
    
    for (const song of songList.slice(0, 50)) { // Limit to first 50 songs to avoid API limits
      try {
        // Extract song name and artist from format: "1. "Song Name" by Artist Name"
        const match = song.match(/^\d+\.\s*"([^"]+)"\s*by\s*(.+)$/);
        if (!match) {
          console.log("Could not parse song format:", song);
          continue;
        }
        
        const [, songName, artistName] = match;
        
        // Clean up the search query
        const cleanSongName = songName.replace(/[^\w\s]/g, ''); // Remove special characters
        const cleanArtistName = artistName.replace(/[^\w\s]/g, '').trim();
        
        // Search for the track on Spotify with a more flexible query
        const searchQuery = `${cleanSongName} ${cleanArtistName}`;
        const searchResponse = await fetch(
          `https://api.spotify.com/v1/search?q=${encodeURIComponent(searchQuery)}&type=track&limit=5`,
          {
            headers: {
              'Authorization': `Bearer ${user.accessToken}`
            }
          }
        );
        
        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          if (searchData.tracks.items.length > 0) {
            // Find the best match
            let bestMatch = searchData.tracks.items[0];
            
            // Try to find a better match by checking artist names
            for (const track of searchData.tracks.items) {
              const trackArtists = track.artists.map((a: any) => a.name.toLowerCase()).join(' ');
              if (trackArtists.includes(cleanArtistName.toLowerCase())) {
                bestMatch = track;
                break;
              }
            }
            
            trackUris.push(bestMatch.uri);
            console.log(`✓ Found: "${songName}" by ${artistName} -> ${bestMatch.artists[0].name}`);
          } else {
            notFoundSongs.push(song);
            console.log(`✗ Not found: "${songName}" by ${artistName}`);
          }
        } else {
          console.error(`Search failed for: ${song}`, searchResponse.status);
        }
        
        // Add a small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Error searching for song: ${song}`, error);
        notFoundSongs.push(song);
      }
    }
    
    console.log(`Found ${trackUris.length} tracks out of ${songList.length} songs`);
    
    // Add tracks to playlist in batches
    if (trackUris.length > 0) {
      const batchSize = 100;
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
        
        if (!addTracksResponse.ok) {
          const errorText = await addTracksResponse.text();
          console.error(`Failed to add batch ${Math.floor(i / batchSize) + 1} to playlist:`, addTracksResponse.status, errorText);
        } else {
          console.log(`✓ Added batch ${Math.floor(i / batchSize) + 1} to playlist`);
        }
      }
    }
    
    let resultMessage = `Successfully created playlist "${playlistName}"!`;
    if (notFoundSongs.length > 0) {
      resultMessage += ` ${trackUris.length} of ${songList.length} songs were found and added.`;
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
};

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

type SpotifyActionResponse = SpotifyActionSuccess | SpotifyActionError;

export default function PlaylistPage() {
  const { playlist, user } = useLoaderData<PlaylistData>();
  const fetcher = useFetcher<SpotifyActionResponse>();
  const [isAddingToSpotify, setIsAddingToSpotify] = useState(false);
  
  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data) {
      setIsAddingToSpotify(false);
    }
  }, [fetcher.state, fetcher.data]);
  
  const handleAddToSpotify = () => {
    setIsAddingToSpotify(true);
    
    const formData = new FormData();
    formData.append('playlistName', playlist.name);
    formData.append('playlistDescription', playlist.description);
    formData.append('songs', playlist.songs.join('\n'));
    
    fetcher.submit(formData, { method: 'post' });
  };
  
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  return (
    <div className='flex h-screen w-full bg-gradient-to-br from-primary via-pink-400 via-70% to-tertiar flex-col overflow-auto'>
      <UserMenu profileImage={user.profileImage} />
      
      <div className='flex w-full px-10 pt-10 pb-20 flex-col'>
        {/* Header with back button */}
        <div className='flex items-center mb-6'>
          <Link 
            to="/dashboard"
            className='mr-4 p-2 text-white/80 hover:text-white rounded-full hover:bg-white/10 transition-all'
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className='text-white text-4xl font-bold drop-shadow-lg animate-slide-in flex items-center'>
            <span className="mr-2">🎵</span> {playlist.name}
          </h1>
        </div>
        
        {/* Main content */}
        <div className='flex flex-col lg:flex-row gap-8'>
          {/* Playlist info panel */}
          <div className='lg:w-1/3'>
            <div className='bg-white/20 backdrop-blur-md rounded-xl p-6 ring-1 ring-white/30 shadow-xl
              hover:shadow-2xl transition-all duration-300 sticky top-4'>
              
              {/* Playlist artwork placeholder */}
              <div className='w-full aspect-square bg-gradient-to-br from-pink-500 to-purple-600 rounded-lg mb-4
                flex items-center justify-center text-6xl'>
                🎵
              </div>
              
              <h2 className='text-white font-bold text-2xl mb-2'>{playlist.name}</h2>
              <p className='text-white/80 text-sm mb-4'>{playlist.description}</p>
              
              {/* Playlist stats */}
              <div className='flex justify-between text-white/60 text-sm mb-4'>
                <span>{playlist.songs.length} songs</span>
                <span>~{Math.round(playlist.songs.length * 3.5)} min</span>
              </div>
              
              <div className='text-white/60 text-xs mb-6'>
                Created {formatDate(playlist.createdAt)}
              </div>
              
              {/* Filter tags */}
              <div className='flex flex-wrap gap-2 mb-6'>
                {Object.entries(playlist.filters).map(([key, value]) => 
                  value && (
                    <span key={key} className='bg-white/20 px-3 py-1 rounded-full text-xs text-white'>
                      {value}
                    </span>
                  )
                )}
              </div>
              
              {/* Add to Spotify button */}
              <button
                onClick={handleAddToSpotify}
                disabled={isAddingToSpotify}
                className='w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-4 rounded-lg
                  transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed
                  hover:scale-105 disabled:hover:scale-100 flex items-center justify-center gap-2'
              >
                {isAddingToSpotify ? (
                  <>
                    <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin"></div>
                    Adding to Spotify...
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.42 1.56-.299.421-1.02.599-1.559.3z"/>
                    </svg>
                    Add to Spotify
                  </>
                )}
              </button>
              
              {/* Status messages */}
              {fetcher.data && 'success' in fetcher.data && fetcher.data.success && (
                <div className="mt-4 p-3 bg-green-500/20 border border-green-500/30 rounded-lg">
                  <p className="text-green-100 text-sm">
                    ✅ {fetcher.data.message}
                  </p>
                  {fetcher.data.playlistUrl && (
                    <a 
                      href={fetcher.data.playlistUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-green-200 underline text-sm hover:text-green-100 block mt-2"
                    >
                      🎵 Open in Spotify →
                    </a>
                  )}
                  {fetcher.data.notFoundCount > 0 && (
                    <p className="text-green-200 text-xs mt-1">
                      Note: {fetcher.data.notFoundCount} songs couldn't be found on Spotify
                    </p>
                  )}
                </div>
              )}
              
              {fetcher.data && 'error' in fetcher.data && fetcher.data.error && (
                <div className="mt-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg">
                  <p className="text-red-100 text-sm">
                    ❌ {fetcher.data.error}
                  </p>
                  
                  {/* Show re-auth button for permission errors */}
                  {(fetcher.data.error.includes('permission') || fetcher.data.error.includes('scope') || fetcher.data.error.includes('Insufficient')) && (
                    <div className="mt-3 p-3 bg-yellow-500/20 border border-yellow-500/30 rounded-lg">
                      <p className="text-yellow-200 text-sm mb-2">
                        🔑 Your Spotify token doesn't have playlist creation permissions.
                      </p>
                      <div className="flex gap-2">
                        <a
                          href="/reauth"
                          className="inline-block bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-4 rounded
                            transition-all duration-300 hover:scale-105 text-sm"
                        >
                          🎵 Re-authenticate with Playlist Permissions
                        </a>
                      </div>
                    </div>
                  )}
                  
                  {fetcher.data.error.includes('log') && (
                    <p className="text-red-200 text-xs mt-2">
                      💡 Try logging out and back in to refresh your Spotify permissions
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
          
          {/* Songs list */}
          <div className='lg:w-2/3'>
            <div className='bg-white/20 backdrop-blur-md rounded-xl p-6 ring-1 ring-white/30 shadow-xl
              hover:shadow-2xl transition-all duration-300'>
              
              <h3 className='text-white font-bold text-xl mb-4 flex items-center'>
                <span className="mr-2">🎶</span> Tracklist
              </h3>
              
              <div className='space-y-2'>
                {playlist.songs.map((song, index) => {
                  // Extract song name and artist from format: "1. "Song Name" by Artist Name"
                  const match = song.match(/^\d+\.\s*"([^"]+)"\s*by\s*(.+)$/);
                  const songName = match ? match[1] : song;
                  const artistName = match ? match[2] : '';
                  
                  return (
                    <div 
                      key={index}
                      className='flex items-center p-3 rounded-lg hover:bg-white/10 transition-all duration-300
                        hover:translate-x-1 group'
                      style={{ 
                        animation: 'fadeIn 0.5s ease-out forwards',
                        animationDelay: `${index * 50}ms`,
                        opacity: '0'
                      }}
                    >
                      {/* Track number */}
                      <div className='w-8 text-white/60 text-sm font-mono flex-shrink-0'>
                        {index + 1}
                      </div>
                      
                      {/* Song info */}
                      <div className='flex-grow min-w-0 ml-3'>
                        <div className='text-white font-medium truncate'>
                          {songName}
                        </div>
                        {artistName && (
                          <div className='text-white/70 text-sm truncate'>
                            {artistName}
                          </div>
                        )}
                      </div>
                      
                      {/* Duration placeholder */}
                      <div className='text-white/50 text-sm font-mono flex-shrink-0 ml-4'>
                        {Math.floor(Math.random() * 2 + 2)}:{String(Math.floor(Math.random() * 60)).padStart(2, '0')}
                      </div>
                      
                      {/* Play button (placeholder) */}
                      <button className='ml-3 p-2 text-white/60 hover:text-white rounded-full 
                        hover:bg-white/10 transition-all opacity-0 group-hover:opacity-100'>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z"/>
                        </svg>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Add animations */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes slide-in {
          from { opacity: 0; transform: translateX(-20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        
        .animate-slide-in {
          animation: slide-in 0.5s ease-out forwards;
        }
      `}</style>
    </div>
  );
}