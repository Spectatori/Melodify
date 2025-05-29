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
  coverImageUrl?: string;
  filters: {
    genre?: string;
    subgenre?: string;
    mood?: string;
    bpm?: string;
    activity?: string;
    era?: string;
    timeOfDay?: string;
    weather?: string;
  }
}

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

type SpotifyActionResponse = SpotifyActionSuccess | SpotifyActionError;

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

// Action to handle adding playlist to Spotify
export const action = async ({ request }: ActionFunctionArgs): Promise<SpotifyActionResponse> => {
  const session = await sessionStorage.getSession(request.headers.get('Cookie'));
  const user = session.get('user');
  
  console.log("Spotify action called, user:", user ? "authenticated" : "not authenticated");
  
  if (!user || !user.accessToken) {
    return { error: "Not authenticated with Spotify. Please log in again." };
  }
  
  const formData = await request.formData();
  const actionType = formData.get('actionType')?.toString();
  
  if (actionType === 'checkTokenScopes') {
    // Debug action to check what scopes the current token has
    try {
      const response = await fetch('https://api.spotify.com/v1/me', {
        headers: {
          'Authorization': `Bearer ${user.accessToken}`
        }
      });
      
      if (response.ok) {
        const userData = await response.json();
        console.log("Current user data:", userData);
        
        // Check if we can access playlists
        const playlistResponse = await fetch('https://api.spotify.com/v1/me/playlists?limit=1', {
          headers: {
            'Authorization': `Bearer ${user.accessToken}`
          }
        });
        
        console.log("Playlist access status:", playlistResponse.status);
        
        if (playlistResponse.ok) {
          return { 
            success: true, 
            message: `Token is valid. User: ${userData.display_name}. Playlist access: OK. Note: ugc-image-upload scope cannot be tested directly.`,
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
    // Debug action to test image upload to existing playlist
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
        
        console.log(`Test upload: Original image size: ${imageBuffer.length} bytes`);
        
        // If image is too large, resize it
        if (imageBuffer.length > 250 * 1024) { // 250KB to leave some margin
          console.log("Test upload: Image too large, resizing...");
          
          try {
            // Try to use Sharp for resizing
            const sharp = await import('sharp');
            
            // Resize and compress the image
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
            
            console.log(`Test upload: Resized image size: ${imageBuffer.length} bytes`);
            
          } catch (sharpError) {
            console.log("Test upload: Sharp not available, using original image...");
            console.warn("Test upload: Image size exceeds Spotify limit and cannot be resized");
          }
        }
        
        const base64Image = imageBuffer.toString('base64');
        
        console.log(`Test upload: Final image size: ${imageBuffer.length} bytes`);
        console.log(`Test upload: Base64 length: ${base64Image.length} characters`);
        
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
        
        console.log(`Test upload response: ${uploadResponse.status}`);
        
        if (uploadResponse.ok) {
          return { success: true, message: "Test image upload successful!", playlistUrl: '', tracksAdded: 0, totalSongs: 0, notFoundCount: 0 };
        } else {
          const errorText = await uploadResponse.text();
          console.error("Test upload failed:", errorText);
          return { error: `Test upload failed: ${uploadResponse.status} - ${errorText}` };
        }
      } else {
        return { error: "No cover image found for testing" };
      }
    } catch (error) {
      console.error("Test upload error:", error);
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
      
      // Wait a moment for the playlist to be fully created
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Try to add cover image to Spotify playlist if available
      if (playlistId) {
        try {
          const fs = await import('fs');
          const path = await import('path');
          
          // Check for both JPEG and WebP formats
          const jpegPath = path.join(process.cwd(), "public", "playlist-covers", `${playlistId}.jpg`);
          const webpPath = path.join(process.cwd(), "public", "playlist-covers", `${playlistId}.webp`);
          
          let coverPath: string | null = null;
          
          // Wait up to 30 seconds for the cover image to be generated
          for (let i = 0; i < 30; i++) {
            if (fs.existsSync(jpegPath)) {
              coverPath = jpegPath;
              break;
            } else if (fs.existsSync(webpPath)) {
              coverPath = webpPath;
              break;
            }
            
            // Wait 1 second before checking again
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          
          if (coverPath) {
            console.log(`Found cover image: ${coverPath}, uploading to Spotify...`);
            
            // Read the image file
            let imageBuffer = fs.readFileSync(coverPath);
            
            console.log(`Original image size: ${imageBuffer.length} bytes`);
            
            // If image is too large, resize it
            if (imageBuffer.length > 250 * 1024) { // 250KB to leave some margin
              console.log("Image too large, resizing...");
              
              try {
                // Try to use Sharp for resizing
                const sharp = await import('sharp');
                
                // Resize and compress the image
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
                
                console.log(`Resized image size: ${imageBuffer.length} bytes`);
                
              } catch (sharpError) {
                console.log("Sharp not available, trying Canvas API...");
                
                try {
                  // Fallback to Canvas API for resizing
                  const { createCanvas, loadImage } = await import('canvas');
                  
                  // Load the image
                  const img = await loadImage(imageBuffer);
                  
                  // Calculate new dimensions (max 512x512)
                  let { width, height } = img;
                  const maxSize = 512;
                  
                  if (width > maxSize || height > maxSize) {
                    if (width > height) {
                      height = (height * maxSize) / width;
                      width = maxSize;
                    } else {
                      width = (width * maxSize) / height;
                      height = maxSize;
                    }
                  }
                  
                  // Create canvas and draw resized image
                  const canvas = createCanvas(width, height);
                  const ctx = canvas.getContext('2d');
                  ctx.drawImage(img, 0, 0, width, height);
                  
                  // Convert to JPEG buffer
                  imageBuffer = canvas.toBuffer('image/jpeg', { quality: 0.8 });
                  
                  console.log(`Canvas resized image size: ${imageBuffer.length} bytes`);
                  
                } catch (canvasError) {
                  console.log("Canvas API not available, using original image...");
                  console.warn("Image size exceeds Spotify limit and cannot be resized");
                }
              }
            }
            
            // Final size check
            if (imageBuffer.length > 256 * 1024) {
              console.warn(`Final image size (${imageBuffer.length} bytes) still exceeds Spotify limit (256KB)`);
              console.warn("Upload may fail, but attempting anyway...");
            }
            
            // Convert to base64 (Spotify expects raw base64, not data URL)
            const base64Image = imageBuffer.toString('base64');
            
            console.log(`Uploading image to Spotify playlist ${playlistData.id}`);
            console.log(`Final image size: ${imageBuffer.length} bytes`);
            console.log(`Base64 length: ${base64Image.length} characters`);
            
            // Upload cover image to Spotify playlist
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
            
            console.log("Image upload response status:", uploadImageResponse.status);
            
            if (uploadImageResponse.ok) {
              console.log("✅ Successfully uploaded cover image to Spotify playlist");
            } else {
              const errorText = await uploadImageResponse.text();
              console.error("❌ Failed to upload cover image:", uploadImageResponse.status);
              console.error("Error response:", errorText);
              
              // Detailed error analysis
              if (uploadImageResponse.status === 400) {
                console.error("Bad Request - Image format might be invalid");
              } else if (uploadImageResponse.status === 401) {
                console.error("Unauthorized - Access token might be expired");
              } else if (uploadImageResponse.status === 403) {
                console.error("Forbidden - Missing required scope 'ugc-image-upload'");
                console.error("Required scopes: playlist-modify-public, playlist-modify-private, ugc-image-upload");
              } else if (uploadImageResponse.status === 413) {
                console.error("Payload Too Large - Image must be under 256KB");
                console.error(`Your image was ${imageBuffer.length} bytes`);
              } else {
                console.error("Unknown error occurred during image upload");
              }
            }
            
          } else {
            console.log("❌ No cover image found for playlist after 30 seconds:", playlistId);
          }
        } catch (imageError) {
          console.error("❌ Error handling cover image upload:", imageError);
          // Don't fail the whole operation if image upload fails
        }
      }
      
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
  }
  
  return { error: 'Invalid action' };
};

export default function PlaylistPage() {
  const { playlist: initialPlaylist, user, colorPalette: initialColorPalette } = useLoaderData<PlaylistData>();
  const fetcher = useFetcher<SpotifyActionResponse>();
  const testFetcher = useFetcher<SpotifyActionResponse>();
  const scopeCheckFetcher = useFetcher<SpotifyActionResponse>();
  const [currentColorPalette, setCurrentColorPalette] = useState<PlaylistData['colorPalette']>(initialColorPalette);
  const [isAddingToSpotify, setIsAddingToSpotify] = useState(false);
  const [playlist, setPlaylist] = useState(initialPlaylist);
  const [lastCreatedPlaylistId, setLastCreatedPlaylistId] = useState<string | null>(null);
  const [isExtractingColors, setIsExtractingColors] = useState(false);
  const [previousPalette, setPreviousPalette] = useState<PlaylistData['colorPalette']>(null);
  const [transitionProgress, setTransitionProgress] = useState(1);
  
  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data) {
      setIsAddingToSpotify(false);
      
      // Store the Spotify playlist ID for testing
      if ('success' in fetcher.data && fetcher.data.success && fetcher.data.playlistUrl) {
        const matches = fetcher.data.playlistUrl.match(/playlist\/([a-zA-Z0-9]+)/);
        if (matches) {
          setLastCreatedPlaylistId(matches[1]);
        }
      }
    }
  }, [fetcher.state, fetcher.data]);
  
  // Check for cover image if not already loaded
  useEffect(() => {
    if (!playlist.coverImageUrl) {
      // Try to load the cover image by checking if it exists
      const checkCoverImage = async () => {
        try {
          // Try JPEG first, then WebP
          let response = await fetch(`/playlist-covers/${playlist.id}.jpg`);
          if (response.ok) {
            const newCoverUrl = `/playlist-covers/${playlist.id}.jpg`;
            setPlaylist(prev => ({
              ...prev,
              coverImageUrl: newCoverUrl
            }));
            
            // Extract colors from the new cover image
            await extractColorsFromCover(playlist.id);
            return;
          }
          
          response = await fetch(`/playlist-covers/${playlist.id}.webp`);
          if (response.ok) {
            const newCoverUrl = `/playlist-covers/${playlist.id}.webp`;
            setPlaylist(prev => ({
              ...prev,
              coverImageUrl: newCoverUrl
            }));
            
            // Extract colors from the new cover image
            await extractColorsFromCover(playlist.id);
          }
        } catch (error) {
          console.log("No cover image found for playlist:", playlist.id);
        }
      };
      
      checkCoverImage();
    }
  }, [playlist.id, playlist.coverImageUrl]);
  
  // Function to extract colors from cover image
  const extractColorsFromCover = async (playlistId: string) => {
    try {
      setIsExtractingColors(true);
      const response = await fetch(`/api/extract-colors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playlistId })
      });
      
      if (response.ok) {
        const colors = await response.json();
        
        // Store current palette as previous before updating
        setPreviousPalette(currentColorPalette);
        
        // Start transition animation
        setTransitionProgress(0);
        
        // Animate the transition over 2 seconds
        const duration = 2000; // 2 seconds
        const startTime = Date.now();
        
        const animateTransition = () => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / duration, 1);
          
          // Use easing function for smoother transition
          const easedProgress = 1 - Math.pow(1 - progress, 3); // Ease-out cubic
          
          setTransitionProgress(easedProgress);
          
          if (progress < 1) {
            requestAnimationFrame(animateTransition);
          } else {
            // Transition complete, set new colors
            setCurrentColorPalette(colors);
            setPreviousPalette(null);
            setTransitionProgress(1);
          }
        };
        
        requestAnimationFrame(animateTransition);
        console.log("Colors extracted and transitioning:", colors);
      }
    } catch (error) {
      console.log("Error extracting colors client-side:", error);
    } finally {
      setIsExtractingColors(false);
    }
  };
  
  const handleCheckTokenScopes = () => {
    const formData = new FormData();
    formData.append('actionType', 'checkTokenScopes');
    
    scopeCheckFetcher.submit(formData, { method: 'post' });
  };
  
  const handleTestImageUpload = () => {
    if (!lastCreatedPlaylistId) {
      alert("Please create a Spotify playlist first to test image upload");
      return;
    }
    
    const formData = new FormData();
    formData.append('actionType', 'testImageUpload');
    formData.append('playlistId', playlist.id);
    formData.append('spotifyPlaylistId', lastCreatedPlaylistId);
    
    testFetcher.submit(formData, { method: 'post' });
  };

  const handleAddToSpotify = () => {
    setIsAddingToSpotify(true);
    
    const formData = new FormData();
    formData.append('actionType', 'addToSpotify');
    formData.append('playlistName', playlist.name);
    formData.append('playlistDescription', playlist.description);
    formData.append('songs', playlist.songs.join('\n'));
    formData.append('playlistId', playlist.id);
    
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
  
  // Helper function to interpolate between two colors
  const interpolateColor = (color1: string, color2: string, progress: number): string => {
    // Parse RGB values from color strings
    const parseRGB = (color: string) => {
      const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      if (match) {
        return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])];
      }
      
      // Handle HSL colors
      const hslMatch = color.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
      if (hslMatch) {
        // Convert HSL to RGB for interpolation
        const h = parseInt(hslMatch[1]) / 360;
        const s = parseInt(hslMatch[2]) / 100;
        const l = parseInt(hslMatch[3]) / 100;
        
        const hue2rgb = (p: number, q: number, t: number) => {
          if (t < 0) t += 1;
          if (t > 1) t -= 1;
          if (t < 1/6) return p + (q - p) * 6 * t;
          if (t < 1/2) return q;
          if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
          return p;
        };
        
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        const r = Math.round(hue2rgb(p, q, h + 1/3) * 255);
        const g = Math.round(hue2rgb(p, q, h) * 255);
        const b = Math.round(hue2rgb(p, q, h - 1/3) * 255);
        
        return [r, g, b];
      }
      
      // Fallback to default colors
      return [139, 69, 19];
    };
    
    const [r1, g1, b1] = parseRGB(color1);
    const [r2, g2, b2] = parseRGB(color2);
    
    const r = Math.round(r1 + (r2 - r1) * progress);
    const g = Math.round(g1 + (g2 - g1) * progress);
    const b = Math.round(b1 + (b2 - b1) * progress);
    
    return `rgb(${r}, ${g}, ${b})`;
  };

  // Create interpolated gradient during transition
  const getCurrentGradient = () => {
    const defaultGradient = 'linear-gradient(135deg, rgb(139, 69, 19) 0%, rgb(255, 105, 180) 50%, rgb(75, 0, 130) 100%)';
    
    if (!currentColorPalette && !previousPalette) {
      return defaultGradient;
    }
    
    // If we have colors but no transition, use current colors
    if (transitionProgress === 1 && currentColorPalette) {
      return currentColorPalette.gradient;
    }
    
    // During transition, interpolate between previous and current
    if (previousPalette && currentColorPalette && transitionProgress < 1) {
      const oldColors = ['rgb(139, 69, 19)', 'rgb(255, 105, 180)', 'rgb(75, 0, 130)'];
      const newColors = [currentColorPalette.primary, currentColorPalette.secondary, currentColorPalette.accent];
      
      const interpolatedColors = oldColors.map((oldColor, index) => 
        interpolateColor(oldColor, newColors[index] || oldColor, transitionProgress)
      );
      
      return `linear-gradient(135deg, ${interpolatedColors[0]} 0%, ${interpolatedColors[1]} 50%, ${interpolatedColors[2]} 100%)`;
    }
    
    // Use current palette if available, otherwise default
    return currentColorPalette?.gradient || defaultGradient;
  };

  // Dynamic styles to avoid the CSS-in-JS scope issue
  const dynamicStyles = `
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    @keyframes slide-in {
      from { opacity: 0; transform: translateX(-20px); }
      to { opacity: 1; transform: translateX(0); }
    }
    
    @keyframes shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
    
    .color-transition {
      position: relative;
      overflow: hidden;
    }
    
    .color-transition::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: linear-gradient(
        90deg,
        transparent 0%,
        rgba(255, 255, 255, 0.1) 50%,
        transparent 100%
      );
      background-size: 200% 100%;
      animation: shimmer 2s ease-in-out;
      pointer-events: none;
      opacity: ${transitionProgress < 1 ? 1 : 0};
      transition: opacity 0.5s ease-out;
    }
    
    .animate-slide-in {
      animation: slide-in 0.5s ease-out forwards;
    }
    
    .shadow-3xl {
      box-shadow: 0 35px 60px -12px rgba(0, 0, 0, 0.25);
    }
  `;
  
  return (
    <div 
      className={`flex h-screen w-full flex-col overflow-auto color-transition ${
        transitionProgress < 1 ? 'transition-none' : ''
      }`}
      style={{
        background: getCurrentGradient(),
        transition: transitionProgress === 1 ? 'background 0.8s cubic-bezier(0.4, 0, 0.2, 1)' : 'none'
      }}
    >
      {/* Inject dynamic styles */}
      <style dangerouslySetInnerHTML={{ __html: dynamicStyles }} />
      
      <UserMenu profileImage={user.profileImage} />
      
      {/* Color extraction indicator */}
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
            <div className='flex flex-col items-center bg-white/20 backdrop-blur-md rounded-xl p-6 ring-1 ring-white/30 shadow-xl
              hover:shadow-2xl transition-all duration-300 sticky top-4'>
              
              {/* Playlist artwork */}
              <div className={`aspect-square bg-gradient-to-br from-white/10 to-white/5 rounded-lg mb-4
                flex items-center justify-center text-6xl w-80 overflow-hidden backdrop-blur-sm
                ring-1 ring-white/20 shadow-2xl transition-all duration-500 ${
                  transitionProgress < 1 ? 'ring-2 ring-white/40 shadow-3xl' : ''
                }`}>
                {playlist.coverImageUrl ? (
                  <img 
                    src={playlist.coverImageUrl} 
                    alt={`${playlist.name} cover art`}
                    className="w-full h-full object-cover rounded-lg shadow-inner"
                    onLoad={() => {
                      // Extract colors when image loads
                      if (!currentColorPalette) {
                        extractColorsFromCover(playlist.id);
                      }
                    }}
                  />
                ) : (
                  '🎵'
                )}
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
                  hover:scale-105 disabled:hover:scale-100 flex items-center justify-center gap-2 mb-3'
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
              
              {/* Debug buttons */}
              <div className="flex gap-2">
                {/* Check Token Scopes button */}
                <button
                  onClick={handleCheckTokenScopes}
                  disabled={scopeCheckFetcher.state === 'submitting'}
                  className='flex-1 bg-purple-600 hover:bg-purple-500 text-white font-bold py-2 px-3 rounded-lg
                    transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed
                    hover:scale-105 disabled:hover:scale-100 flex items-center justify-center gap-2 text-sm'
                >
                  {scopeCheckFetcher.state === 'submitting' ? (
                    <>
                      <div className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin"></div>
                      Checking...
                    </>
                  ) : (
                    <>
                      🔍 Check Token
                    </>
                  )}
                </button>
                
                {/* Test Image Upload button */}
                {playlist.coverImageUrl && lastCreatedPlaylistId && (
                  <button
                    onClick={handleTestImageUpload}
                    disabled={testFetcher.state === 'submitting'}
                    className='flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-3 rounded-lg
                      transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed
                      hover:scale-105 disabled:hover:scale-100 flex items-center justify-center gap-2 text-sm'
                  >
                    {testFetcher.state === 'submitting' ? (
                      <>
                        <div className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin"></div>
                        Testing...
                      </>
                    ) : (
                      <>
                        🧪 Test Upload
                      </>
                    )}
                  </button>
                )}
              </div>
              
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
              
              {/* Token scope check results */}
              {scopeCheckFetcher.data && 'success' in scopeCheckFetcher.data && scopeCheckFetcher.data.success && (
                <div className="mt-4 p-3 bg-purple-500/20 border border-purple-500/30 rounded-lg">
                  <p className="text-purple-100 text-sm">
                    🔍 {scopeCheckFetcher.data.message}
                  </p>
                </div>
              )}
              
              {scopeCheckFetcher.data && 'error' in scopeCheckFetcher.data && scopeCheckFetcher.data.error && (
                <div className="mt-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg">
                  <p className="text-red-100 text-sm">
                    🔍❌ {scopeCheckFetcher.data.error}
                  </p>
                  {scopeCheckFetcher.data.error.includes('401') && (
                    <div className="mt-2 p-2 bg-yellow-500/20 border border-yellow-500/30 rounded">
                      <p className="text-yellow-200 text-xs mb-2">
                        💡 Your token has expired. Click below to get a fresh token with all required permissions.
                      </p>
                      <a 
                        href="/reauth" 
                        className="inline-block bg-yellow-600 hover:bg-yellow-500 text-white text-xs font-bold py-1 px-3 rounded transition-all duration-300 hover:scale-105"
                      >
                        🔄 Re-authenticate with Spotify
                      </a>
                    </div>
                  )}
                </div>
              )}
              
              {/* Test results */}
              {testFetcher.data && 'success' in testFetcher.data && testFetcher.data.success && (
                <div className="mt-4 p-3 bg-blue-500/20 border border-blue-500/30 rounded-lg">
                  <p className="text-blue-100 text-sm">
                    🧪 {testFetcher.data.message}
                  </p>
                </div>
              )}
              
              {testFetcher.data && 'error' in testFetcher.data && testFetcher.data.error && (
                <div className="mt-4 p-3 bg-orange-500/20 border border-orange-500/30 rounded-lg">
                  <p className="text-orange-100 text-sm">
                    🧪❌ {testFetcher.data.error}
                  </p>
                  {testFetcher.data.error.includes('401') && (
                    <div className="mt-2 p-2 bg-yellow-500/20 border border-yellow-500/30 rounded">
                      <p className="text-yellow-200 text-xs mb-2">
                        🔑 Token issue detected. This could be:
                      </p>
                      <ul className="text-yellow-200 text-xs list-disc list-inside space-y-1">
                        <li>Token has expired (Spotify tokens last ~1 hour)</li>
                        <li>Missing 'ugc-image-upload' scope in your Spotify app</li>
                        <li>App not approved for image upload permissions</li>
                      </ul>
                      <div className="mt-2">
                        <a href="/reauth" className="text-yellow-100 underline text-xs hover:text-yellow-50">
                          → Re-authenticate with Spotify (will ask for new permissions)
                        </a>
                      </div>
                    </div>
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
    </div>
  );
}