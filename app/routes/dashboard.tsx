import { LoaderFunctionArgs, redirect, ActionFunctionArgs, json } from '@remix-run/node';
import { useLoaderData, useFetcher, Link } from '@remix-run/react';
import { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { sessionStorage } from '~/services/session.server';
import UserMenu from '~/components/layout/UserMenu';
import { genreMap, 
  moodOptions, 
  bpmRanges, 
  activityOptions, 
  eraOptions, 
  timeOptions } from '~/data/optionMap';
import { fetchWeather, WeatherResponse } from '~/services/weather.api';
import { savePlaylist, getUserPlaylists } from '~/services/playlist.server';
import { generatePlaylistNaming } from '~/services/playlist-naming.server';

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
  };
}

interface FetcherData {
  content: string;
  error?: string;
  warning?: string;
}

interface ActionResponse {
  success?: boolean;
  error?: string;
  playlist?: PlaylistRecommendation;
  deletedId?: string;
  clearedCount?: number;
  coverImageUrl?: string;
  imagePrompt?: string;
  naming?: {
    name: string;
    description: string;
  };
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const session = await sessionStorage.getSession(request.headers.get('Cookie'));
  const user = session.get('user');
  if (!user) return redirect('/login');
  
  // Get user's existing playlists
  const existingPlaylists = getUserPlaylists(user.id);
  
  return json({ user, existingPlaylists });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const session = await sessionStorage.getSession(request.headers.get('Cookie'));
  const user = session.get('user');
  if (!user) return redirect('/login');
  
  const formData = await request.formData();
  const actionType = formData.get('actionType')?.toString();
  
  if (actionType === 'savePlaylist') {
    const playlistData = formData.get('playlistData')?.toString();
    if (!playlistData) {
      return json({ error: 'No playlist data provided' });
    }
    
    try {
      const playlist: PlaylistRecommendation = JSON.parse(playlistData);
      playlist.userId = user.id;
      
      const savedPlaylist = savePlaylist(playlist);
      return json({ success: true, playlist: savedPlaylist });
    } catch (error) {
      console.error('Error saving playlist:', error);
      return json({ error: 'Failed to save playlist' });
    }
  }
  
  if (actionType === 'deletePlaylist') {
    const playlistId = formData.get('playlistId')?.toString();
    if (!playlistId) {
      return json({ error: 'No playlist ID provided' });
    }
    
    try {
      const { deletePlaylist } = await import('~/services/playlist.server');
      const deleted = deletePlaylist(playlistId, user.id);
      
      if (deleted) {
        return json({ success: true, deletedId: playlistId });
      } else {
        return json({ error: 'Playlist not found or access denied' });
      }
    } catch (error) {
      console.error('Error deleting playlist:', error);
      return json({ error: 'Failed to delete playlist' });
    }
  }
  
  if (actionType === 'clearAllPlaylists') {
    try {
      const { clearUserPlaylists } = await import('~/services/playlist.server');
      const clearedCount = clearUserPlaylists(user.id);
      
      return json({ success: true, clearedCount });
    } catch (error) {
      console.error('Error clearing all playlists:', error);
      return json({ error: 'Failed to clear all playlists' });
    }
  }
  
  if (actionType === 'generateNaming') {
    const userOptionsData = formData.get('userOptions')?.toString();
    if (!userOptionsData) {
      return json({ error: 'No user options provided' });
    }
    
    try {
      const userOptions = JSON.parse(userOptionsData);
      const naming = await generatePlaylistNaming(userOptions);
      return json({ success: true, naming });
    } catch (error) {
      console.error('Error generating playlist naming:', error);
      return json({ error: 'Failed to generate playlist naming' });
    }
  }
  
  if (actionType === 'checkPlaylistCover') {
    const playlistId = formData.get('playlistId')?.toString();
    if (!playlistId) {
      return json({ error: 'No playlist ID provided' });
    }
    
    try {
      const { getPlaylistCoverUrl } = await import('~/services/stability.server');
      const coverUrl = getPlaylistCoverUrl(playlistId);
      return json({ success: true, coverImageUrl: coverUrl });
    } catch (error) {
      console.error('Error checking playlist cover:', error);
      return json({ error: 'Failed to check playlist cover' });
    }
  }
  
  if (actionType === 'generatePlaylistWithImage') {
    const userOptionsData = formData.get('userOptions')?.toString();
    const playlistData = formData.get('playlistData')?.toString();
    
    if (!userOptionsData || !playlistData) {
      return json({ error: 'Missing required data' });
    }
    
    try {
      const userOptions = JSON.parse(userOptionsData);
      const playlist: PlaylistRecommendation = JSON.parse(playlistData);
      
      // Import server-only modules inside the action function
      const { generatePlaylistImagePrompt } = await import('~/services/playlist-image-prompt.server');
      const { generatePlaylistCoverArt } = await import('~/services/stability.server');
      
      // Start both operations simultaneously
      const [namingResult, imagePromiseResult] = await Promise.allSettled([
        // Generate playlist naming
        generatePlaylistNaming(userOptions),
        
        // Generate image in parallel
        (async () => {
          const imagePrompt = await generatePlaylistImagePrompt(
            playlist.name,
            playlist.description,
            userOptions
          );
          
          const coverImageUrl = await generatePlaylistCoverArt(playlist.id, imagePrompt);
          return { coverImageUrl, imagePrompt };
        })()
      ]);
      
      // Handle results
      let naming = { name: playlist.name, description: playlist.description };
      if (namingResult.status === 'fulfilled') {
        naming = namingResult.value;
      }
      
      let coverImageUrl = undefined;
      if (imagePromiseResult.status === 'fulfilled') {
        coverImageUrl = imagePromiseResult.value.coverImageUrl;
      }
      
      return json({ 
        success: true, 
        naming,
        coverImageUrl,
        imagePrompt: imagePromiseResult.status === 'fulfilled' ? imagePromiseResult.value.imagePrompt : undefined
      });
      
    } catch (error) {
      console.error('Error in combined generation:', error);
      return json({ error: 'Failed to generate playlist and image' });
    }
  }
  
  if (actionType === 'generatePlaylistImage') {
    const playlistData = formData.get('playlistData')?.toString();
    const userOptionsData = formData.get('userOptions')?.toString();
    
    if (!playlistData || !userOptionsData) {
      return json({ error: 'Missing playlist or user options data' });
    }
    
    try {
      const playlist: PlaylistRecommendation = JSON.parse(playlistData);
      const userOptions = JSON.parse(userOptionsData);
      
      // Import server-only modules inside the action function
      const { generatePlaylistImagePrompt } = await import('~/services/playlist-image-prompt.server');
      const { generatePlaylistCoverArt } = await import('~/services/stability.server');
      
      // Generate image prompt using Llama
      console.log('Generating image prompt for playlist:', playlist.name);
      const imagePrompt = await generatePlaylistImagePrompt(
        playlist.name,
        playlist.description,
        userOptions
      );
      
      console.log('Generated image prompt:', imagePrompt);
      
      // Generate the actual image using Stability AI
      console.log('Generating cover art for playlist:', playlist.id);
      const coverImageUrl = await generatePlaylistCoverArt(playlist.id, imagePrompt);
      
      console.log('Generated cover art URL:', coverImageUrl);
      
      return json({ 
        success: true, 
        coverImageUrl,
        imagePrompt // Return the prompt for debugging if needed
      });
    } catch (error) {
      console.error('Error generating playlist image:', error);
      return json({ error: 'Failed to generate playlist image' });
    }
  }
  
  return json({ error: 'Invalid action' });
};

export default function Dashboard() {
  const { user, existingPlaylists } = useLoaderData<{ user: any; existingPlaylists: PlaylistRecommendation[] }>();
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [selectedSubgenre, setSelectedSubgenre] = useState<string | null>(null);
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [selectedBPM, setSelectedBPM] = useState<string | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<string | null>(null);
  const [selectedEra, setSelectedEra] = useState<string | null>(null);
  const [selectedTimeOfDay, setSelectedTimeOfDay] = useState<string | null>(null);
  const [useWeather, setUseWeather] = useState(false);
  const [weatherData, setWeatherData] = useState<WeatherResponse | null>(null);
  const [isLoadingWeather, setIsLoadingWeather] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [playlists, setPlaylists] = useState<PlaylistRecommendation[]>(existingPlaylists || []);
  const [showAdditionalOptions, setShowAdditionalOptions] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deletingPlaylistId, setDeletingPlaylistId] = useState<string | null>(null);
  const [pendingPlaylistId, setPendingPlaylistId] = useState<string | null>(null);
  const [completedOperations, setCompletedOperations] = useState<{
    songs?: string[];
    assets?: { coverImageUrl?: string; naming?: { name: string; description: string } };
  }>({});
  
  const llamaFetcher = useFetcher<FetcherData>();
  const saveFetcher = useFetcher<ActionResponse>();
  const deleteFetcher = useFetcher<ActionResponse>();
  const clearAllFetcher = useFetcher<ActionResponse>();
  const imageFetcher = useFetcher<ActionResponse>();
  const coverCheckFetcher = useFetcher<ActionResponse>();
  
  const handleLlamaClick = useCallback(() => {
    setErrorMessage(null);
    
    let prompt = `Create a playlist of Spotify songs`;
    
    if (selectedSubgenre) {
      prompt += ` in the ${selectedSubgenre} subgenre of ${selectedGenre} music`;
    } else if (selectedGenre) {
      prompt += ` in the ${selectedGenre} genre`;
    }
    
    if (selectedMood) {
      prompt += ` with a ${selectedMood} mood`;
    }
    
    if (selectedBPM) {
      prompt += ` at ${selectedBPM}`;
    }
    
    if (selectedActivity) {
      prompt += ` for ${selectedActivity}`;
    }
    
    if (selectedEra) {
      prompt += ` from the ${selectedEra}`;
    }
    
    if (selectedTimeOfDay) {
      prompt += ` perfect for ${selectedTimeOfDay} listening`;
    }
    
    if (useWeather && weatherData) {
      prompt += ` that matches ${weatherData.condition} weather`;
    }
    
    prompt += `. Format as a numbered list of 15-20 songs with artist names.`;
    
    console.log("Starting parallel generation: songs + image + naming");
    setIsLoading(true);
    
    // Create the playlist structure immediately
    const newPlaylistId = Date.now().toString();
    const tempPlaylist: PlaylistRecommendation = {
      id: newPlaylistId,
      name: generateSimplePlaylistName(),
      description: generateSimplePlaylistDescription(),
      songs: [],
      createdAt: new Date().toISOString(),
      userId: user.id,
      coverImageUrl: undefined,
      filters: {
        genre: selectedGenre || undefined,
        subgenre: selectedSubgenre || undefined,
        mood: selectedMood || undefined,
        bpm: selectedBPM || undefined,
        activity: selectedActivity || undefined,
        era: selectedEra || undefined,
        timeOfDay: selectedTimeOfDay || undefined,
        weather: useWeather && weatherData ? weatherData.condition : undefined,
      }
    };
    
    // Add empty playlist to UI immediately for instant feedback
    setPlaylists(prev => [tempPlaylist, ...prev]);
    setPendingPlaylistId(newPlaylistId);
    setCompletedOperations({}); // Reset completed operations
    
    // Start both operations simultaneously
    const userOptions = {
      genre: selectedGenre,
      subgenre: selectedSubgenre,
      mood: selectedMood,
      bpm: selectedBPM,
      activity: selectedActivity,
      era: selectedEra,
      timeOfDay: selectedTimeOfDay,
      weather: useWeather && weatherData ? weatherData.condition : undefined,
    };
    
    // 1. Start song generation
    const songFormData = new FormData();
    songFormData.append("prompt", prompt);
    if (selectedGenre) songFormData.append("genre", selectedGenre);
    if (selectedSubgenre) songFormData.append("subgenre", selectedSubgenre);
    if (selectedMood) songFormData.append("mood", selectedMood);
    if (selectedBPM) songFormData.append("bpm", selectedBPM);
    if (selectedActivity) songFormData.append("activity", selectedActivity);
    if (selectedEra) songFormData.append("era", selectedEra);
    if (selectedTimeOfDay) songFormData.append("timeOfDay", selectedTimeOfDay);
    if (useWeather && weatherData) songFormData.append("weather", weatherData.condition);
    
    llamaFetcher.submit(songFormData, { method: "post", action: "/api/llama" });
    
    // 2. Start image + naming generation simultaneously
    const assetsFormData = new FormData();
    assetsFormData.append('actionType', 'generatePlaylistWithImage');
    assetsFormData.append('playlistData', JSON.stringify(tempPlaylist));
    assetsFormData.append('userOptions', JSON.stringify(userOptions));
    
    imageFetcher.submit(assetsFormData, { method: 'post' });
    
  }, [selectedGenre, selectedSubgenre, selectedMood, selectedBPM, selectedActivity, selectedEra, selectedTimeOfDay, useWeather, weatherData, llamaFetcher, imageFetcher, user.id]);
  
  // Weather API fetch
  useEffect(() => {
    const getWeatherData = async () => {
      try {
        setIsLoadingWeather(true);
        
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            try {
              const { latitude, longitude } = position.coords;
              console.log(`Got user coordinates: ${latitude}, ${longitude}`);
              const weatherData = await fetchWeather(latitude, longitude);
              setWeatherData(weatherData);
            } catch (error) {
              console.error("Error fetching weather with user location:", error);
              const weatherData = await fetchWeather();
              setWeatherData(weatherData);
            } finally {
              setIsLoadingWeather(false);
            }
          },
          async (error) => {
            console.warn("Geolocation error:", error);
            const weatherData = await fetchWeather();
            setWeatherData(weatherData);
            setIsLoadingWeather(false);
          },
          {
            maximumAge: 0,
            enableHighAccuracy: true,
            timeout: 10000
          }
        );
      } catch (error) {
        console.error("Weather fetching error:", error);
        setWeatherData({
          temperature: 20,
          condition: 'Pleasant',
          location: 'Default Location'
        });
        setIsLoadingWeather(false);
      }
    };
    
    getWeatherData();
  }, []);
  
  useEffect(() => {
    if (llamaFetcher.state === 'idle' && llamaFetcher.data) {
      console.log("Songs generation completed");
      
      if (llamaFetcher.data.error) {
        console.error("Error:", llamaFetcher.data.error);
        setErrorMessage(llamaFetcher.data.error);
        setIsLoading(false);
        setPendingPlaylistId(null);
      } else if (llamaFetcher.data.content) {
        if (llamaFetcher.data.warning) {
          setErrorMessage(llamaFetcher.data.warning);
        } else {
          setErrorMessage(null);
        }
        
        const songList = llamaFetcher.data.content
          .split('\n')
          .filter(line => line.trim().match(/^\d+\.\s/))
          .map(line => line.trim());
        
        // Store completed songs
        setCompletedOperations(prev => ({ ...prev, songs: songList }));
      }
    }
  }, [llamaFetcher.state, llamaFetcher.data]);
  
  useEffect(() => {
    if (imageFetcher.state === 'idle' && imageFetcher.data) {
      console.log("Assets generation completed");
      
      if (imageFetcher.data.error) {
        console.error("Error generating playlist assets:", imageFetcher.data.error);
        // Don't fail the whole operation for assets
      } else if (imageFetcher.data.success) {
        const assets = {
          coverImageUrl: imageFetcher.data.coverImageUrl,
          naming: imageFetcher.data.naming
        };
        
        // Store completed assets
        setCompletedOperations(prev => ({ ...prev, assets }));
      }
    }
  }, [imageFetcher.state, imageFetcher.data]);
  
  // Combine results when both operations are complete
  useEffect(() => {
    if (pendingPlaylistId && completedOperations.songs && completedOperations.assets) {
      console.log("Both operations completed, combining results");
      
      const finalPlaylist: PlaylistRecommendation = {
        id: pendingPlaylistId,
        name: completedOperations.assets.naming?.name || generateSimplePlaylistName(),
        description: completedOperations.assets.naming?.description || generateSimplePlaylistDescription(),
        songs: completedOperations.songs,
        createdAt: new Date().toISOString(),
        userId: user.id,
        coverImageUrl: completedOperations.assets.coverImageUrl,
        filters: {
          genre: selectedGenre || undefined,
          subgenre: selectedSubgenre || undefined,
          mood: selectedMood || undefined,
          bpm: selectedBPM || undefined,
          activity: selectedActivity || undefined,
          era: selectedEra || undefined,
          timeOfDay: selectedTimeOfDay || undefined,
          weather: useWeather && weatherData ? weatherData.condition : undefined,
        }
      };
      
      // Update the playlist in the UI
      setPlaylists(prev => prev.map(playlist => 
        playlist.id === pendingPlaylistId ? finalPlaylist : playlist
      ));
      
      // Save the final playlist
      const formData = new FormData();
      formData.append('actionType', 'savePlaylist');
      formData.append('playlistData', JSON.stringify(finalPlaylist));
      saveFetcher.submit(formData, { method: 'post' });
      
      // Clean up
      setIsLoading(false);
      setPendingPlaylistId(null);
      setCompletedOperations({});
    }
  }, [pendingPlaylistId, completedOperations, user.id, selectedGenre, selectedSubgenre, selectedMood, selectedBPM, selectedActivity, selectedEra, selectedTimeOfDay, useWeather, weatherData]);
  
  useEffect(() => {
    if (coverCheckFetcher.state === 'idle' && coverCheckFetcher.data) {
      if (coverCheckFetcher.data.success && coverCheckFetcher.data.coverImageUrl) {
        // Update playlists that now have cover images
        setPlaylists(prev => prev.map(playlist => {
          if (!playlist.coverImageUrl && coverCheckFetcher.data?.coverImageUrl) {
            return { ...playlist, coverImageUrl: coverCheckFetcher.data.coverImageUrl };
          }
          return playlist;
        }));
      }
    }
  }, [coverCheckFetcher]);
  
  // Check for existing covers when component mounts
  useEffect(() => {
    const playlistsWithoutCovers = playlists.filter(p => !p.coverImageUrl);
    if (playlistsWithoutCovers.length > 0) {
      // Check for existing covers for playlists that don't have them
      playlistsWithoutCovers.forEach(playlist => {
        const formData = new FormData();
        formData.append('actionType', 'checkPlaylistCover');
        formData.append('playlistId', playlist.id);
        
        setTimeout(() => {
          coverCheckFetcher.submit(formData, { method: 'post' });
        }, Math.random() * 1000); // Stagger the requests
      });
    }
  }, [playlists.length]);
  
  useEffect(() => {
    if (saveFetcher.state === 'idle' && saveFetcher.data) {
      if (saveFetcher.data.error) {
        console.error("Error saving playlist:", saveFetcher.data.error);
        setErrorMessage(saveFetcher.data.error);
      } else if (saveFetcher.data.success) {
        console.log("Playlist saved successfully");
      }
    }
  }, [saveFetcher]);
  
  useEffect(() => {
    if (deleteFetcher.state === 'idle' && deleteFetcher.data) {
      if (deleteFetcher.data.error) {
        console.error("Error deleting playlist:", deleteFetcher.data.error);
        setErrorMessage(deleteFetcher.data.error);
      } else if (deleteFetcher.data.success && deleteFetcher.data.deletedId) {
        console.log("Playlist deleted successfully");
        setTimeout(() => {
          setPlaylists(prev => prev.filter(playlist => playlist.id !== deleteFetcher.data?.deletedId));
          setDeletingPlaylistId(null);
        }, 300);
        setErrorMessage(null);
      }
      setDeletingPlaylistId(null);
    }
  }, [deleteFetcher]);
  
  useEffect(() => {
    if (clearAllFetcher.state === 'idle' && clearAllFetcher.data) {
      if (clearAllFetcher.data.error) {
        console.error("Error clearing all playlists:", clearAllFetcher.data.error);
        setErrorMessage(clearAllFetcher.data.error);
      } else if (clearAllFetcher.data.success) {
        console.log(`Cleared ${clearAllFetcher.data.clearedCount || 0} playlists`);
        setTimeout(() => {
          setPlaylists([]);
        }, 300);
        setErrorMessage(null);
      }
    }
  }, [clearAllFetcher]);
  
  const handleGenreClick = useCallback((genre: string) => {
    if (selectedGenre !== genre) {
      setSelectedGenre(genre);
      setSelectedSubgenre(null);
      setErrorMessage(null);
    }
  }, [selectedGenre]);
  
  const handleSubgenreClick = useCallback((subgenre: string) => {
    const newSubgenre = subgenre === selectedSubgenre ? null : subgenre;
    if (newSubgenre !== selectedSubgenre) {
      setSelectedSubgenre(newSubgenre);
      setErrorMessage(null);
    }
  }, [selectedSubgenre]);
  
  const handleFilterClick = useCallback((currentValue: string | null, newValue: string, setter: (value: string | null) => void) => {
    const finalValue = currentValue === newValue ? null : newValue;
    if (finalValue !== currentValue) {
      setter(finalValue);
      setErrorMessage(null);
    }
  }, []);
  
  const handleDeletePlaylist = useCallback((playlistId: string, playlistName: string) => {
    if (confirm(`Are you sure you want to delete "${playlistName}"? This action cannot be undone.`)) {
      setDeletingPlaylistId(playlistId);
      const formData = new FormData();
      formData.append('actionType', 'deletePlaylist');
      formData.append('playlistId', playlistId);
      
      deleteFetcher.submit(formData, { method: 'post' });
    }
  }, [deleteFetcher]);
  
  const handleClearAllPlaylists = useCallback(() => {
    if (playlists.length === 0) {
      setErrorMessage("No playlists to clear.");
      return;
    }
    
    if (confirm(`Are you sure you want to delete ALL ${playlists.length} playlists? This action cannot be undone.`)) {
      const formData = new FormData();
      formData.append('actionType', 'clearAllPlaylists');
      
      clearAllFetcher.submit(formData, { method: 'post' });
    }
  }, [playlists.length, clearAllFetcher]);
  
  const generateSimplePlaylistName = useCallback(() => {
    const parts = [];
    
    if (selectedMood) {
      parts.push(selectedMood);
    }
    
    if (selectedSubgenre) {
      parts.push(selectedSubgenre);
    } else if (selectedGenre) {
      parts.push(selectedGenre);
    }
    
    if (selectedActivity) {
      parts.push(`for ${selectedActivity}`);
    } else if (selectedTimeOfDay) {
      parts.push(selectedTimeOfDay);
    }
    
    if (parts.length === 0) {
      return 'Custom Playlist';
    }
    
    return parts.join(' ') + ' Mix';
  }, [selectedMood, selectedSubgenre, selectedGenre, selectedActivity, selectedTimeOfDay]);
  
  const generateSimplePlaylistDescription = useCallback(() => {
    let description = "A personalized playlist";
    
    const elements = [];
    
    if (selectedGenre) {
      elements.push(`featuring ${selectedGenre} music`);
      if (selectedSubgenre) {
        elements.push(`with a focus on ${selectedSubgenre}`);
      }
    }
    
    if (selectedMood) {
      elements.push(`crafted for a ${selectedMood.toLowerCase()} mood`);
    }
    
    if (selectedActivity) {
      elements.push(`perfect for ${selectedActivity.toLowerCase()}`);
    }
    
    if (selectedEra) {
      elements.push(`from the ${selectedEra}`);
    }
    
    if (elements.length > 0) {
      description += " " + elements.join(", ");
    }
    
    description += ". Generated by your AI music assistant.";
    
    return description;
  }, [selectedGenre, selectedSubgenre, selectedMood, selectedActivity, selectedEra]);
  
  // Memoized filter handlers
  const moodHandler = useCallback((value: string) => handleFilterClick(selectedMood, value, setSelectedMood), [selectedMood, handleFilterClick]);
  const bpmHandler = useCallback((value: string) => handleFilterClick(selectedBPM, value, setSelectedBPM), [selectedBPM, handleFilterClick]);
  const activityHandler = useCallback((value: string) => handleFilterClick(selectedActivity, value, setSelectedActivity), [selectedActivity, handleFilterClick]);
  const eraHandler = useCallback((value: string) => handleFilterClick(selectedEra, value, setSelectedEra), [selectedEra, handleFilterClick]);
  const timeHandler = useCallback((value: string) => handleFilterClick(selectedTimeOfDay, value, setSelectedTimeOfDay), [selectedTimeOfDay, handleFilterClick]);
  
  // Memoized components
  const GenreSelector = useMemo(() => (
    <div className='bg-white/20 backdrop-blur-md rounded-xl p-4 w-full ring-1 ring-white/30 shadow-xl
      hover:shadow-2xl transition-all duration-300 hover:bg-white/30'>
      <h3 className='text-white font-bold text-xl mb-2'>Genre</h3>
      <div className='flex flex-col font-bold text-white text-xl max-h-72 overflow-y-auto gap-2 pr-4
      [&::-webkit-scrollbar]:w-1.5
      [&::-webkit-scrollbar]:hover:w-2
      [&::-webkit-scrollbar-track]:rounded-xl
      [&::-webkit-scrollbar-track]:bg-white/10
      [&::-webkit-scrollbar-thumb]:rounded-lg
      [&::-webkit-scrollbar-thumb]:bg-orange-200/30
      [&::-webkit-scrollbar-thumb]:hover:bg-orange-200/40
      '>
        {Object.keys(genreMap).map((genre, index) => (
          <div 
          key={genre}
          className={`cursor-pointer p-3 rounded-lg transition-all duration-200 hover:bg-white/20 animate-slide-up
            ${selectedGenre === genre ? 'bg-white/30 text-white shadow-lg ring-1 ring-white/40 scale-105' : ''}`}
          style={{
            animationFillMode: 'forwards',
            animationDelay: `${index * 50}ms`
          }}
          onClick={() => handleGenreClick(genre)}
        >
          {genre}
        </div>
        ))}
      </div>
    </div>
  ), [selectedGenre, handleGenreClick]);
  
  const SubgenreSelector = useMemo(() => {
    if (!selectedGenre) return null;
    
    const subgenres = genreMap[selectedGenre as keyof typeof genreMap];
    
    return (
      <div className='bg-white/20 backdrop-blur-md rounded-xl p-4 ring-1 ring-white/30 shadow-xl
        hover:shadow-2xl transition-all duration-300 hover:bg-white/30'>
        <h3 className='text-white font-bold text-xl mb-2'>Subgenre (Optional)</h3>
        <div className='flex flex-col font-bold text-white text-xl max-h-72 overflow-y-auto gap-2 pr-4
        [&::-webkit-scrollbar]:w-1.5
        [&::-webkit-scrollbar]:hover:w-2
        [&::-webkit-scrollbar-track]:rounded-xl
        [&::-webkit-scrollbar-track]:bg-white/10
        [&::-webkit-scrollbar-thumb]:rounded-lg
        [&::-webkit-scrollbar-thumb]:bg-orange-200/30
        [&::-webkit-scrollbar-thumb]:hover:bg-orange-200/40
        '>
          {subgenres.map((subgenre: string, index: number) => (
            <div
              key={subgenre}
              style={{ 
                animation: 'slideUp 0.5s ease-out forwards',
                animationDelay: `${index * 50}ms`,
                opacity: '0'
              }}
              className={`cursor-pointer p-3 rounded-lg transition-all duration-200 hover:bg-white/20
                ${selectedSubgenre === subgenre ? 'bg-white/30 text-white shadow-lg ring-1 ring-white/40 scale-105' : ''}`}
              onClick={() => handleSubgenreClick(subgenre)}
            >
              {subgenre}
            </div>
          ))}
        </div>
      </div>
    );
  }, [selectedGenre, selectedSubgenre, handleSubgenreClick]);
  
  // Memoized filter components to prevent re-renders
  const MoodFilter = useMemo(() => (
    <div className='bg-white/20 backdrop-blur-md rounded-xl p-4 ring-1 ring-white/30 shadow-xl
      hover:shadow-2xl transition-all duration-300 w-full hover:bg-white/30'>
      <h3 className='text-white font-bold text-xl mb-2'>Mood (Optional)</h3>
      <div className='flex flex-wrap gap-2'>
        {moodOptions.map((option, index) => (
          <div
            key={option}
            style={{ 
              animation: 'slideUp 0.3s ease-out forwards',
              animationDelay: `${index * 30}ms`,
              opacity: '0'
            }}
            className={`cursor-pointer p-2 px-3 rounded-lg transition-all duration-200 hover:bg-white/20 text-white
              ${selectedMood === option ? 'bg-white/30 shadow-lg ring-1 ring-white/40 font-bold scale-105' : 'text-white/90'}`}
            onClick={() => moodHandler(option)}
          >
            {option}
          </div>
        ))}
      </div>
    </div>
  ), [selectedMood, moodHandler]);
  
  const BPMFilter = useMemo(() => (
    <div className='bg-white/20 backdrop-blur-md rounded-xl p-4 ring-1 ring-white/30 shadow-xl
      hover:shadow-2xl transition-all duration-300 w-full hover:bg-white/30'>
      <h3 className='text-white font-bold text-xl mb-2'>BPM Range (Optional)</h3>
      <div className='flex flex-wrap gap-2'>
        {bpmRanges.map((option, index) => (
          <div
            key={option}
            style={{ 
              animation: 'slideUp 0.3s ease-out forwards',
              animationDelay: `${index * 30}ms`,
              opacity: '0'
            }}
            className={`cursor-pointer p-2 px-3 rounded-lg transition-all duration-200 hover:bg-white/20 text-white
              ${selectedBPM === option ? 'bg-white/30 shadow-lg ring-1 ring-white/40 font-bold scale-105' : 'text-white/90'}`}
            onClick={() => bpmHandler(option)}
          >
            {option}
          </div>
        ))}
      </div>
    </div>
  ), [selectedBPM, bpmHandler]);
  
  const ActivityFilter = useMemo(() => (
    <div className='bg-white/20 backdrop-blur-md rounded-xl p-4 ring-1 ring-white/30 shadow-xl
      hover:shadow-2xl transition-all duration-300 w-full hover:bg-white/30'>
      <h3 className='text-white font-bold text-xl mb-2'>Activity (Optional)</h3>
      <div className='flex flex-wrap gap-2'>
        {activityOptions.map((option, index) => (
          <div
            key={option}
            style={{ 
              animation: 'slideUp 0.3s ease-out forwards',
              animationDelay: `${index * 30}ms`,
              opacity: '0'
            }}
            className={`cursor-pointer p-2 px-3 rounded-lg transition-all duration-200 hover:bg-white/20 text-white
              ${selectedActivity === option ? 'bg-white/30 shadow-lg ring-1 ring-white/40 font-bold scale-105' : 'text-white/90'}`}
            onClick={() => activityHandler(option)}
          >
            {option}
          </div>
        ))}
      </div>
    </div>
  ), [selectedActivity, activityHandler]);
  
  const EraFilter = useMemo(() => (
    <div className='bg-white/20 backdrop-blur-md rounded-xl p-4 ring-1 ring-white/30 shadow-xl
      hover:shadow-2xl transition-all duration-300 w-full hover:bg-white/30'>
      <h3 className='text-white font-bold text-xl mb-2'>Era (Optional)</h3>
      <div className='flex flex-wrap gap-2'>
        {eraOptions.map((option, index) => (
          <div
            key={option}
            style={{ 
              animation: 'slideUp 0.3s ease-out forwards',
              animationDelay: `${index * 30}ms`,
              opacity: '0'
            }}
            className={`cursor-pointer p-2 px-3 rounded-lg transition-all duration-200 hover:bg-white/20 text-white
              ${selectedEra === option ? 'bg-white/30 shadow-lg ring-1 ring-white/40 font-bold scale-105' : 'text-white/90'}`}
            onClick={() => eraHandler(option)}
          >
            {option}
          </div>
        ))}
      </div>
    </div>
  ), [selectedEra, eraHandler]);
  
  const TimeFilter = useMemo(() => (
    <div className='bg-white/20 backdrop-blur-md rounded-xl p-4 ring-1 ring-white/30 shadow-xl
      hover:shadow-2xl transition-all duration-300 w-full hover:bg-white/30'>
      <h3 className='text-white font-bold text-xl mb-2'>Time of Day (Optional)</h3>
      <div className='flex flex-wrap gap-2'>
        {timeOptions.map((option, index) => (
          <div
            key={option}
            style={{ 
              animation: 'slideUp 0.3s ease-out forwards',
              animationDelay: `${index * 30}ms`,
              opacity: '0'
            }}
            className={`cursor-pointer p-2 px-3 rounded-lg transition-all duration-200 hover:bg-white/20 text-white
              ${selectedTimeOfDay === option ? 'bg-white/30 shadow-lg ring-1 ring-white/40 font-bold scale-105' : 'text-white/90'}`}
            onClick={() => timeHandler(option)}
          >
            {option}
          </div>
        ))}
      </div>
    </div>
  ), [selectedTimeOfDay, timeHandler]);
  
  return (
    <div className='flex h-screen w-full bg-gradient-to-br from-primary via-pink-400 via-70% to-tertiar flex-col overflow-auto'>
      <UserMenu profileImage={user.profileImage} />
      
      <div className='flex w-full px-10 pt-10 pb-20 flex-col'>
        <h1 className='text-white text-4xl font-bold pb-8 drop-shadow-lg animate-slide-in flex items-center'>
          <span className="mr-2">🎵</span> Create your playlist
        </h1>
        
        <div className='flex flex-wrap gap-8'>
          <div className='grid grid-cols-1 md:grid-cols-2 gap-6 w-full'>
            {GenreSelector}
            {SubgenreSelector}
          </div>
          
          <div className='w-full flex justify-center mt-2 mb-4'>
            <button
              onClick={() => setShowAdditionalOptions(!showAdditionalOptions)}
              className='bg-white/30 backdrop-blur-md px-5 py-2.5 text-white rounded-lg
                ring-1 ring-white/40 shadow-lg hover:bg-white/40 transition-all duration-300 flex items-center gap-2
                hover:scale-105'
            >
              {showAdditionalOptions ? 'Hide' : 'Show'} Additional Options
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className={`h-5 w-5 transition-transform duration-300 ${showAdditionalOptions ? 'rotate-180' : ''}`} 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
          
          {showAdditionalOptions && (
            <div className='w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fadeIn'>
              {MoodFilter}
              {BPMFilter}
              {ActivityFilter}
              {EraFilter}
              {TimeFilter}
              
              <div className='bg-white/20 backdrop-blur-md rounded-xl p-4 ring-1 ring-white/30 shadow-xl
                hover:shadow-2xl transition-all duration-300 w-full hover:bg-white/30'>
                <div className='flex items-center justify-between'>
                  <h3 className='text-white font-bold text-xl'>Weather (Optional)</h3>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={useWeather} 
                      onChange={() => setUseWeather(!useWeather)} 
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-white/30 peer-focus:outline-none rounded-full peer 
                      peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] 
                      after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-white 
                      after:border after:rounded-full after:h-5 after:w-5 after:transition-all 
                      peer-checked:bg-pink-500"></div>
                  </label>
                </div>
                <div className='flex justify-between items-center'>
                  {weatherData && (
                    <div className='text-white mt-2 pl-2 flex items-center'>
                      <div className="mr-2 text-xl">
                        {weatherData.condition === 'Sunny' || weatherData.condition === 'Clear' ? '☀️' : 
                         weatherData.condition === 'Rainy' || weatherData.condition === 'Stormy' ? '🌧️' : 
                         weatherData.condition === 'Cloudy' ? '☁️' : 
                         weatherData.condition === 'Snowy' ? '❄️' : 
                         weatherData.condition === 'Cold' ? '🥶' : '🌤️'}
                      </div>
                      <div>
                        <p className='text-lg'>{weatherData.temperature}°C - {weatherData.condition}</p>
                        <p className='text-white/80 text-sm'>{weatherData.location}</p>
                      </div>
                      {isLoadingWeather && (
                        <div className="ml-2 w-3 h-3 rounded-full bg-white animate-pulse"></div>
                      )}
                    </div>
                  )}
                  
                  <button 
                    onClick={() => {
                      setIsLoadingWeather(true);
                      
                      navigator.geolocation.getCurrentPosition(
                        async (position) => {
                          try {
                            const { latitude, longitude } = position.coords;
                            console.log(`Got refreshed coordinates: ${latitude}, ${longitude}`);
                            const weatherData = await fetchWeather(latitude, longitude);
                            setWeatherData(weatherData);
                          } catch (error) {
                            console.error("Error refreshing weather:", error);
                          } finally {
                            setIsLoadingWeather(false);
                          }
                        },
                        (error) => {
                          console.warn("Geolocation refresh error:", error);
                          setIsLoadingWeather(false);
                        },
                        {
                          maximumAge: 0,
                          enableHighAccuracy: true,
                          timeout: 10000
                        }
                      );
                    }}
                    disabled={isLoadingWeather}
                    className="ml-2 p-2 text-white/80 hover:text-white rounded-full hover:bg-white/10 transition-all"
                    title="Refresh weather data"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${isLoadingWeather ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
        
        <div className='flex justify-center mt-8'>
          <button 
            className='bg-white/20 backdrop-blur-md px-8 py-4 text-white rounded-lg text-xl
              ring-1 ring-white/30 shadow-xl hover:shadow-2xl hover:bg-white/30 
              transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed
              hover:scale-105 disabled:hover:scale-100'
            onClick={handleLlamaClick}
            disabled={!selectedGenre || isLoading}
          >
            {isLoading ? 'Creating playlist...' : '🎵 Generate Playlist'}
          </button>
        </div>
        
        {playlists.length > 0 && (
          <div className='mt-6 w-full max-w-4xl mx-auto'>
            <div className="flex items-center justify-between mb-4">
              <h3 className='text-white font-bold text-2xl'>Your Generated Playlists</h3>
              
              <button
                onClick={handleClearAllPlaylists}
                disabled={clearAllFetcher.state === 'submitting'}
                className='bg-red-600/80 hover:bg-red-500 text-white font-bold py-2 px-4 rounded-lg
                  transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed
                  hover:scale-105 disabled:hover:scale-100 flex items-center gap-2 text-sm'
              >
                {clearAllFetcher.state === 'submitting' ? (
                  <>
                    <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin"></div>
                    Clearing...
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Clear All ({playlists.length})
                  </>
                )}
              </button>
            </div>
            
            {errorMessage && (
              <div className="mb-4 py-2 px-4 bg-white/20 rounded-lg text-white/90 text-sm">
                {errorMessage}
              </div>
            )}
            
            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
              {playlists.map((playlist, index) => (
                <div 
                  key={playlist.id}
                  className={`bg-white/20 backdrop-blur-md rounded-xl p-6 ring-1 ring-white/30 shadow-xl
                    hover:shadow-2xl transition-all duration-300 hover:bg-white/30 relative group
                    ${deletingPlaylistId === playlist.id ? 'opacity-50 scale-95 pointer-events-none' : ''}`}
                  style={{ 
                    animation: 'fadeIn 0.5s ease-out forwards',
                    animationDelay: `${index * 100}ms`,
                    opacity: '0'
                  }}
                >
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleDeletePlaylist(playlist.id, playlist.name);
                    }}
                    disabled={deleteFetcher.state === 'submitting' || deletingPlaylistId === playlist.id}
                    className="absolute top-2 right-2 p-2 text-white/60 hover:text-red-400 rounded-full 
                      hover:bg-red-500/20 transition-all duration-200 opacity-0 group-hover:opacity-100
                      disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Delete playlist"
                  >
                    {deletingPlaylistId === playlist.id ? (
                      <div className="w-5 h-5 rounded-full border-2 border-current border-t-transparent animate-spin"></div>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    )}
                  </button>
                  
                  <Link 
                    to={`/playlist/${playlist.id}`}
                    className='block h-full'
                  >
                    <div className="flex items-start justify-between mb-3 pr-8">
                      <h4 className='text-white font-bold text-lg line-clamp-2'>{playlist.name}</h4>
                      <div className="text-white/60 text-2xl">
                        {playlist.coverImageUrl ? (
                          <img 
                            src={playlist.coverImageUrl} 
                            alt={`${playlist.name} cover`}
                            className="w-8 h-8 rounded object-cover"
                          />
                        ) : (
                          '🎵'
                        )}
                      </div>
                    </div>
                    
                    <p className='text-white/80 text-sm mb-3 line-clamp-2'>{playlist.description}</p>
                    
                    <div className="flex items-center justify-between text-white/60 text-xs">
                      <span>{playlist.songs.length} songs</span>
                      <span>{new Date(playlist.createdAt).toLocaleDateString()}</span>
                    </div>
                    
                    <div className="mt-3 flex flex-wrap gap-1">
                      {playlist.filters.genre && (
                        <span className="bg-white/20 px-2 py-1 rounded text-xs text-white">
                          {playlist.filters.genre}
                        </span>
                      )}
                      {playlist.filters.mood && (
                        <span className="bg-white/20 px-2 py-1 rounded text-xs text-white">
                          {playlist.filters.mood}
                        </span>
                      )}
                      {playlist.filters.era && (
                        <span className="bg-white/20 px-2 py-1 rounded text-xs text-white">
                          {playlist.filters.era}
                        </span>
                      )}
                    </div>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {playlists.length === 0 && (
          <div className="mt-6 text-center py-12">
            <div className="text-white/60 text-6xl mb-4">🎵</div>
            <h4 className="text-white/80 text-xl font-medium mb-2">No playlists yet</h4>
            <p className="text-white/60 text-sm">Create your first playlist by selecting a genre and clicking "Generate Playlist"</p>
          </div>
        )}
      </div>
      
      {isLoading && (
        <div className="fixed bottom-4 right-10 space-y-2">
          {/* Main loading indicator */}
          <div className="bg-white/20 backdrop-blur-md px-4 py-2 rounded-lg ring-1 ring-white/30 shadow-lg animate-pulse">
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 rounded-full bg-white animate-bounce"></div>
              <p className="text-white">Creating playlist...</p>
            </div>
          </div>
          
          {/* Songs progress */}
          <div className={`bg-blue-600/20 backdrop-blur-md px-4 py-2 rounded-lg ring-1 ring-blue-300/30 shadow-lg transition-all duration-300 ${
            llamaFetcher.state === 'submitting' ? 'animate-pulse' : completedOperations.songs ? 'bg-green-600/20 ring-green-300/30' : 'opacity-50'
          }`}>
            <div className="flex items-center space-x-2">
              {completedOperations.songs ? (
                <div className="w-4 h-4 rounded-full bg-green-300 flex items-center justify-center">
                  <svg className="w-2 h-2 text-green-800" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              ) : (
                <div className="w-4 h-4 rounded-full bg-blue-300 animate-bounce"></div>
              )}
              <p className="text-white text-sm">
                {completedOperations.songs ? '✓ Songs ready' : 'Generating songs...'}
              </p>
            </div>
          </div>
          
          {/* Assets progress */}
          <div className={`bg-purple-600/20 backdrop-blur-md px-4 py-2 rounded-lg ring-1 ring-purple-300/30 shadow-lg transition-all duration-300 ${
            imageFetcher.state === 'submitting' ? 'animate-pulse' : completedOperations.assets ? 'bg-green-600/20 ring-green-300/30' : 'opacity-50'
          }`}>
            <div className="flex items-center space-x-2">
              {completedOperations.assets ? (
                <div className="w-4 h-4 rounded-full bg-green-300 flex items-center justify-center">
                  <svg className="w-2 h-2 text-green-800" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              ) : (
                <div className="w-4 h-4 rounded-full bg-purple-300 animate-bounce"></div>
              )}
              <p className="text-white text-sm">
                {completedOperations.assets ? '✓ Cover art & naming ready' : 'Generating cover art & naming...'}
              </p>
            </div>
          </div>
        </div>
      )}
      
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(15px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes slide-in {
          from { opacity: 0; transform: translateX(-20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        
        .animate-fadeIn {
          animation: fadeIn 0.4s ease-out forwards;
        }
        
        .animate-slide-up {
          animation: slideUp 0.4s ease-out forwards;
        }
        
        .animate-slide-in {
          animation: slide-in 0.5s ease-out forwards;
        }
        
        .scale-105 {
          transform: scale(1.05);
        }
        
        .scale-95 {
          transform: scale(0.95);
        }
        
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        
        * {
          transition-property: opacity, transform, background-color, border-color, color, box-shadow;
          transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .no-flash {
          backface-visibility: hidden;
          perspective: 1000px;
        }
        
        .hover-smooth:hover {
          transform: translateY(-2px);
        }
      `}</style>
    </div>
  );
}