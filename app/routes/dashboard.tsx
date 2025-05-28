import { LoaderFunctionArgs, redirect, ActionFunctionArgs } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import { useState, useEffect } from 'react';
import { sessionStorage } from '~/services/session.server';
import { useFetcher } from "@remix-run/react";
import { Link } from "@remix-run/react";
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

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const session = await sessionStorage.getSession(request.headers.get('Cookie'));
  const user = session.get('user');
  if (!user) return redirect('/login');
  
  // Get user's existing playlists
  const existingPlaylists = getUserPlaylists(user.id);
  
  return { user, existingPlaylists };
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
      return { error: 'No playlist data provided' };
    }
    
    try {
      const playlist: PlaylistRecommendation = JSON.parse(playlistData);
      playlist.userId = user.id; // Ensure playlist is associated with current user
      
      const savedPlaylist = savePlaylist(playlist);
      return { success: true, playlist: savedPlaylist };
    } catch (error) {
      console.error('Error saving playlist:', error);
      return { error: 'Failed to save playlist' };
    }
  }
  
  if (actionType === 'generateNaming') {
    const userOptionsData = formData.get('userOptions')?.toString();
    if (!userOptionsData) {
      return { error: 'No user options provided' };
    }
    
    try {
      const userOptions = JSON.parse(userOptionsData);
      const naming = await generatePlaylistNaming(userOptions);
      return { success: true, naming };
    } catch (error) {
      console.error('Error generating playlist naming:', error);
      return { error: 'Failed to generate playlist naming' };
    }
  }
  
  return { error: 'Invalid action' };
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
  
  interface FetcherData {
    content: string;
    error?: string;
    warning?: string;
  }

  const llamaFetcher = useFetcher<FetcherData>();
  const saveFetcher = useFetcher();
  
  const handleLlamaClick = () => {
    // Reset any previous error message
    setErrorMessage(null);
    
    // Build a more detailed prompt based on all selected filters
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
    
    console.log("Submitting Enhanced Llama request with prompt:", prompt);
    setIsLoading(true);
    
    // Create form data with all the selected filters
    const formData = new FormData();
    formData.append("prompt", prompt);
    
    // Add all the filter options to help with Last.fm context building
    if (selectedGenre) formData.append("genre", selectedGenre);
    if (selectedSubgenre) formData.append("subgenre", selectedSubgenre);
    if (selectedMood) formData.append("mood", selectedMood);
    if (selectedBPM) formData.append("bpm", selectedBPM);
    if (selectedActivity) formData.append("activity", selectedActivity);
    if (selectedEra) formData.append("era", selectedEra);
    if (selectedTimeOfDay) formData.append("timeOfDay", selectedTimeOfDay);
    if (useWeather && weatherData) formData.append("weather", weatherData.condition);
    
    llamaFetcher.submit(
      formData, 
      { 
        method: "post", 
        action: "/api/llama" 
      }
    );
  };
  
  // Weather API fetch using our utility
  useEffect(() => {
    const getWeatherData = async () => {
      try {
        setIsLoadingWeather(true);
        
        // Use the browser's geolocation API to get user's coordinates
        // with maximumAge: 0 to force a fresh location reading
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            try {
              const { latitude, longitude } = position.coords;
              console.log(`Got user coordinates: ${latitude}, ${longitude}`);
              const weatherData = await fetchWeather(latitude, longitude);
              setWeatherData(weatherData);
            } catch (error) {
              console.error("Error fetching weather with user location:", error);
              // Fall back to default location
              const weatherData = await fetchWeather();
              setWeatherData(weatherData);
            } finally {
              setIsLoadingWeather(false);
            }
          },
          async (error) => {
            console.warn("Geolocation error:", error);
            // Fall back to default location if user denies location access
            const weatherData = await fetchWeather();
            setWeatherData(weatherData);
            setIsLoadingWeather(false);
          },
          {
            // Force fresh location reading (don't use cached values)
            maximumAge: 0,
            // High accuracy for better results
            enableHighAccuracy: true,
            // Timeout after 10 seconds
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
      setIsLoading(false);
      console.log("Llama Fetcher data:", llamaFetcher.data);
      
      if (llamaFetcher.data.error) {
        console.error("Error:", llamaFetcher.data.error);
        setErrorMessage(llamaFetcher.data.error);
      } else if (llamaFetcher.data.content) {
        
        // Display warning if present
        if (llamaFetcher.data.warning) {
          setErrorMessage(llamaFetcher.data.warning);
        } else {
          setErrorMessage(null);
        }
        
        // Parse the response into an array of songs
        const songList = llamaFetcher.data.content
          .split('\n')
          .filter(line => line.trim().match(/^\d+\.\s/))
          .map(line => line.trim());
        
        // Generate AI-powered playlist name and description
        const generateNamingAndSave = async () => {
          const userOptions = {
            genre: selectedGenre || undefined,
            subgenre: selectedSubgenre || undefined,
            mood: selectedMood || undefined,
            bpm: selectedBPM || undefined,
            activity: selectedActivity || undefined,
            era: selectedEra || undefined,
            timeOfDay: selectedTimeOfDay || undefined,
            weather: useWeather && weatherData ? weatherData.condition : undefined,
          };
          
          // Call AI naming service
          const namingFormData = new FormData();
          namingFormData.append('actionType', 'generateNaming');
          namingFormData.append('userOptions', JSON.stringify(userOptions));
          
          try {
            const namingResponse = await fetch(window.location.pathname, {
              method: 'POST',
              body: namingFormData
            });
            
            const namingResult = await namingResponse.json();
            
            let playlistName = 'Custom Playlist';
            let playlistDescription = 'A personalized playlist generated by AI.';
            
            if (namingResult.success && namingResult.naming) {
              playlistName = namingResult.naming.name;
              playlistDescription = namingResult.naming.description;
            } else {
              console.log("AI naming failed, using fallback names");
              // Fallback naming
              playlistName = await generatePlaylistName();
              playlistDescription = await generatePlaylistDescription();
            }
            
            // Create the playlist with AI-generated name and description
            const newPlaylist: PlaylistRecommendation = {
              id: Date.now().toString(),
              name: playlistName,
              description: playlistDescription,
              songs: songList,
              createdAt: new Date().toISOString(),
              userId: user.id,
              filters: userOptions
            };
            
            // Save playlist to server
            const saveFormData = new FormData();
            saveFormData.append('actionType', 'savePlaylist');
            saveFormData.append('playlistData', JSON.stringify(newPlaylist));
            
            saveFetcher.submit(saveFormData, { method: 'post' });
            
            // Add to local playlists array immediately for better UX
            setPlaylists(prev => [newPlaylist, ...prev]);
            
          } catch (error) {
            console.error("Error generating naming:", error);
            
            // Fallback to simple naming
            const newPlaylist: PlaylistRecommendation = {
              id: Date.now().toString(),
              name: await generatePlaylistName(),
              description: await generatePlaylistDescription(),
              songs: songList,
              createdAt: new Date().toISOString(),
              userId: user.id,
              filters: userOptions
            };
            
            // Save playlist to server
            const saveFormData = new FormData();
            saveFormData.append('actionType', 'savePlaylist');
            saveFormData.append('playlistData', JSON.stringify(newPlaylist));
            
            saveFetcher.submit(saveFormData, { method: 'post' });
            
            // Add to local playlists array immediately for better UX
            setPlaylists(prev => [newPlaylist, ...prev]);
          }
        };
        
        generateNamingAndSave();
      }
    }
  }, [llamaFetcher]);
  
  interface SaveFetcherData {
    error?: string;
    success?: boolean;
    playlist?: PlaylistRecommendation;
  }

  // Handle save playlist response
  useEffect(() => {
    if (saveFetcher.state === 'idle' && saveFetcher.data) {
      const data = saveFetcher.data as SaveFetcherData;
      if ('error' in data) {
        console.error("Error saving playlist:", data.error);
        setErrorMessage(data.error ?? null);
      } else if ('success' in data) {
        console.log("Playlist saved successfully");
      }
    }
  }, [saveFetcher]);
  
  const generatePlaylistName = async () => {
    // Build context for playlist naming
    let context = "";
    
    if (selectedGenre) {
      context += `Genre: ${selectedGenre}`;
      if (selectedSubgenre) {
        context += ` (${selectedSubgenre})`;
      }
    }
    
    if (selectedMood) {
      context += `, Mood: ${selectedMood}`;
    }
    
    if (selectedActivity) {
      context += `, Activity: ${selectedActivity}`;
    }
    
    if (selectedEra) {
      context += `, Era: ${selectedEra}`;
    }
    
    if (selectedTimeOfDay) {
      context += `, Time: ${selectedTimeOfDay}`;
    }
    
    if (useWeather && weatherData) {
      context += `, Weather: ${weatherData.condition}`;
    }
    
    // Use a simple but creative approach for now
    // In a real implementation, you might want to call the LLM here too
    const creativeNames = [
      `${selectedMood || 'Perfect'} ${selectedGenre || 'Music'} Vibes`,
      `${selectedActivity || 'Daily'} ${selectedGenre || 'Soundtrack'}`,
      `${selectedEra || 'Timeless'} ${selectedGenre || 'Classics'}`,
      `${selectedMood || 'Good'} ${selectedTimeOfDay || 'Anytime'} Mix`,
      `${weatherData?.condition || 'Perfect'} Day ${selectedGenre || 'Playlist'}`,
      `${selectedSubgenre || selectedGenre || 'Music'} ${selectedActivity || 'Session'}`,
      `${selectedMood || 'Ultimate'} ${selectedGenre || 'Collection'}`,
      `${selectedTimeOfDay || 'All Day'} ${selectedGenre || 'Beats'}`,
    ];
    
    // Filter out names with "undefined" and pick a random one
    const validNames = creativeNames.filter(name => !name.includes('undefined'));
    return validNames[Math.floor(Math.random() * validNames.length)] || 'Custom Playlist';
  };
  
  const generatePlaylistDescription = async () => {
    let description = "A carefully curated playlist";
    
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
      elements.push(`drawing from the ${selectedEra}`);
    }
    
    if (selectedTimeOfDay) {
      elements.push(`ideal for ${selectedTimeOfDay.toLowerCase()} listening`);
    }
    
    if (useWeather && weatherData) {
      elements.push(`matching the ${weatherData.condition.toLowerCase()} weather in ${weatherData.location}`);
    }
    
    if (elements.length > 0) {
      description += " " + elements.join(", ");
    }
    
    description += ". Generated by your AI music assistant to match your exact preferences.";
    
    return description;
  };
  
  // The GenreSelector component
  const GenreSelector = () => (
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
          className={`cursor-pointer p-3 rounded-lg transition-all duration-300 hover:bg-white/20 animate-slide-up
            ${selectedGenre === genre ? 'bg-white/30 text-white shadow-lg ring-1 ring-white/40 scale-105' : ''}`}
          style={{
            animationFillMode: 'forwards',
            animationDelay: `${index * 50}ms`
          }}
          onClick={() => {
            setSelectedGenre(genre);
            setSelectedSubgenre(null);
            setErrorMessage(null);
          }}
        >
          {genre}
        </div>
        ))}
      </div>
    </div>
  );
  
  // The SubgenreSelector component
  const SubgenreSelector = () => (
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
        {selectedGenre && genreMap[selectedGenre as keyof typeof genreMap].map((subgenre: string, index: number) => (
          <div
            key={subgenre}
            style={{ 
              animation: 'slideUp 0.5s ease-out forwards',
              animationDelay: `${index * 50}ms`,
              opacity: '0'
            }}
            className={`cursor-pointer p-3 rounded-lg transition-all duration-300 hover:bg-white/20
              ${selectedSubgenre === subgenre ? 'bg-white/30 text-white shadow-lg ring-1 ring-white/40 scale-105' : ''}`}
            onClick={() => {
              setSelectedSubgenre(subgenre === selectedSubgenre ? null : subgenre);
              setErrorMessage(null);
            }}
          >
            {subgenre}
          </div>
        ))}
      </div>
    </div>
  );
  
  const FilterOption = ({ 
    title, 
    options, 
    selectedValue, 
    onSelect 
  }: { 
    title: string; 
    options: string[]; 
    selectedValue: string | null; 
    onSelect: (value: string) => void;
  }) => (
    <div className='bg-white/20 backdrop-blur-md rounded-xl p-4 ring-1 ring-white/30 shadow-xl
      hover:shadow-2xl transition-all duration-300 w-full hover:bg-white/30'>
      <h3 className='text-white font-bold text-xl mb-2'>{title}</h3>
      <div className='flex flex-wrap gap-2'>
        {options.map((option, index) => (
          <div
            key={option}
            style={{ 
              animation: 'slideUp 0.3s ease-out forwards',
              animationDelay: `${index * 30}ms`,
              opacity: '0'
            }}
            className={`cursor-pointer p-2 px-3 rounded-lg transition-all duration-300 hover:bg-white/20 text-white
              ${selectedValue === option ? 'bg-white/30 shadow-lg ring-1 ring-white/40 font-bold scale-105' : 'text-white/90'}`}
            onClick={() => {
              onSelect(selectedValue === option ? '' : option);
              setErrorMessage(null);
            }}
          >
            {option}
          </div>
        ))}
      </div>
    </div>
  );
  
  const PlaylistsList = () => (
    <div className='mt-6 w-full max-w-4xl mx-auto'>
      <h3 className='text-white font-bold text-2xl mb-4'>Your Generated Playlists</h3>
      
      {errorMessage && (
        <div className="mb-4 py-2 px-4 bg-white/20 rounded-lg text-white/90 text-sm">
          {errorMessage}
        </div>
      )}
      
      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
        {playlists.map((playlist, index) => (
          <Link 
            key={playlist.id}
            to={`/playlist/${playlist.id}`}
            className='block'
          >
            <div 
              className='bg-white/20 backdrop-blur-md rounded-xl p-6 ring-1 ring-white/30 shadow-xl
                hover:shadow-2xl transition-all duration-300 hover:bg-white/30 hover:scale-105 cursor-pointer'
              style={{ 
                animation: 'fadeIn 0.5s ease-out forwards',
                animationDelay: `${index * 100}ms`,
                opacity: '0'
              }}
            >
              <div className="flex items-start justify-between mb-3">
                <h4 className='text-white font-bold text-lg line-clamp-2'>{playlist.name}</h4>
                <div className="text-white/60 text-2xl">🎵</div>
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
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
  
  const LoadingIndicator = () => (
    <div className="fixed bottom-4 right-10 bg-white/20 backdrop-blur-md px-4 py-2 rounded-lg ring-1 ring-white/30 shadow-lg
     animate-pulse">
      <div className="flex items-center space-x-2">
        <div className="w-4 h-4 rounded-full bg-white animate-bounce"></div>
        <p className="text-white">Creating playlist...</p>
      </div>
    </div>
  );
  
  return (
    <div className='flex h-screen w-full bg-gradient-to-br from-primary via-pink-400 via-70% to-tertiar flex-col overflow-auto'>
      <UserMenu profileImage={user.profileImage} />
      
      <div className='flex w-full px-10 pt-10 pb-20 flex-col'>
        <h1 className='text-white text-4xl font-bold pb-8 drop-shadow-lg animate-slide-in flex items-center'>
          <span className="mr-2">🎵</span> Create your playlist
        </h1>
        
        <div className='flex flex-wrap gap-8'>
          {/* Main selectors row */}
          <div className='grid grid-cols-1 md:grid-cols-2 gap-6 w-full'>
            <GenreSelector />
            
            {selectedGenre && (
              <SubgenreSelector />
            )}
          </div>
          
          {/* Additional options toggle */}
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
          
          {/* Additional options section */}
          {showAdditionalOptions && (
            <div className='w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fadeIn'>
              <FilterOption
                title="Mood (Optional)"
                options={moodOptions}
                selectedValue={selectedMood}
                onSelect={(value) => setSelectedMood(value || null)}
              />
              
              <FilterOption
                title="BPM Range (Optional)"
                options={bpmRanges}
                selectedValue={selectedBPM}
                onSelect={(value) => setSelectedBPM(value || null)}
              />
              
              <FilterOption
                title="Activity (Optional)"
                options={activityOptions}
                selectedValue={selectedActivity}
                onSelect={(value) => setSelectedActivity(value || null)}
              />
              
              <FilterOption
                title="Era (Optional)"
                options={eraOptions}
                selectedValue={selectedEra}
                onSelect={(value) => setSelectedEra(value || null)}
              />
              
              <FilterOption
                title="Time of Day (Optional)"
                options={timeOptions}
                selectedValue={selectedTimeOfDay}
                onSelect={(value) => setSelectedTimeOfDay(value || null)}
              />
              
              {/* Weather option */}
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
                      
                      // Request new location and weather data
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
        
        {/* Button section */}
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
        
        {/* Playlists display */}
        {playlists.length > 0 && <PlaylistsList />}
      </div>
      
      {isLoading && <LoadingIndicator />}
      
      {/* Add some animations to the global styles */}
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
        
        .scale-102 {
          transform: scale(1.02);
        }
        
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </div>
  );
}