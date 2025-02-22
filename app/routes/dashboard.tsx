import { LoaderFunctionArgs, redirect } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import { useState, useEffect } from 'react';
import { sessionStorage } from '~/services/session.server';
import { useFetcher } from "@remix-run/react";
import UserMenu from '~/components/layout/UserMenu';
import { genreMap, 
  moodOptions, 
  bpmRanges, 
  activityOptions, 
  eraOptions, 
  timeOptions,} from '~/data/optionMap';


export const loader = async ({ request }: LoaderFunctionArgs) => {
  const session = await sessionStorage.getSession(request.headers.get('Cookie'));
  const user = session.get('user');
  if (!user) return redirect('/login');
  return user;
};

export default function Dashboard() {
  const user = useLoaderData<typeof loader>();
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [selectedSubgenre, setSelectedSubgenre] = useState<string | null>(null);
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [selectedBPM, setSelectedBPM] = useState<string | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<string | null>(null);
  const [selectedEra, setSelectedEra] = useState<string | null>(null);
  const [selectedTimeOfDay, setSelectedTimeOfDay] = useState<string | null>(null);
  const [useWeather, setUseWeather] = useState(false);
  const [weatherData, setWeatherData] = useState<any>(null);
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [showAdditionalOptions, setShowAdditionalOptions] = useState(false);
  
  interface FetcherData {
    content: string;
    error?: string;
  }

  const llamaFetcher = useFetcher<FetcherData>();
  
  const handleLlamaClick = () => {
    // Build a more detailed prompt based on all selected filters
    let prompt = `Suggest me some Spotify songs`;
    
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
      prompt += ` from the ${selectedEra} songs`;
    }
    
    if (selectedTimeOfDay) {
      prompt += ` perfect for ${selectedTimeOfDay} listening`;
    }
    
    if (useWeather && weatherData) {
      prompt += ` that matches ${weatherData.condition} weather`;
    }
    
    prompt += `. Format as a numbered list of 5 songs with artist names.`;
    
    console.log("Submitting Llama request with prompt:", prompt);
    setIsLoading(true);
    
    llamaFetcher.submit(
      { prompt }, 
      { 
        method: "post", 
        action: "/api/llama" 
      }
    );
  };
  
  // Weather API fetch (placeholder)
  useEffect(() => {
    const fetchWeather = async () => {
      try {
        setWeatherData({
          temperature: 3,
          condition: 'Rainy',
          location: 'Current Location'
        });
      } catch (error) {
        console.error('Error fetching weather:', error);
      }
    };
    
    fetchWeather();
  }, []);
  
  useEffect(() => {
    if (llamaFetcher.state === 'idle' && llamaFetcher.data) {
      setIsLoading(false);
      console.log("Llama Fetcher data:", llamaFetcher.data);
      if (llamaFetcher.data.error) {
        console.error("Error:", llamaFetcher.data.error);
      } else if (llamaFetcher.data.content) {
        setAiResponse(llamaFetcher.data.content);
        
        // Parse the response into an array of songs
        const songList = llamaFetcher.data.content
          .split('\n')
          .filter(line => line.trim().match(/^\d+\.\s/))
          .map(line => line.trim());
        
        setRecommendations(songList);
      }
    }
  }, [llamaFetcher]);
  
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
            setAiResponse(null);
            setRecommendations([]);
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
              setAiResponse(null);
              setRecommendations([]);
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
            onClick={() => onSelect(selectedValue === option ? '' : option)}
          >
            {option}
          </div>
        ))}
      </div>
    </div>
  );
  
  const RecommendationsList = () => (
    <div className='mt-6 bg-white/20 backdrop-blur-md rounded-xl p-6 ring-1 ring-white/30 shadow-xl
      hover:shadow-2xl transition-all duration-300 w-full max-w-3xl mx-auto'>
      <h3 className='text-white font-bold text-2xl mb-4'>Your Personalized Recommendations</h3>
      <ul className='text-white text-lg space-y-3'>
        {recommendations.map((song, index) => (
          <li 
            key={index} 
            className='py-3 px-4 border-b border-white/10 last:border-0 hover:bg-white/10 rounded-lg transition-all duration-300
              hover:translate-x-1 hover:shadow-md'
            style={{ 
              animation: 'fadeIn 0.5s ease-out forwards',
              animationDelay: `${index * 100}ms`,
              opacity: '0'
            }}
          >
            {song}
          </li>
        ))}
      </ul>
    </div>
  );
  
  const LoadingIndicator = () => (
    <div className="fixed bottom-4 right-4 bg-white/20 backdrop-blur-md px-4 py-2 rounded-lg ring-1 ring-white/30 shadow-lg
     animate-pulse">
      <div className="flex items-center space-x-2">
        <div className="w-4 h-4 rounded-full bg-white animate-bounce"></div>
        <p className="text-white">Loading response from Llama...</p>
      </div>
    </div>
  );
  
  return (
    <div className='flex h-screen w-full bg-gradient-to-br from-orange-400 via-pink-400 to-purple-400 flex-col overflow-auto'>
      <UserMenu profileImage={user.profileImage} />
      
      <div className='flex w-full px-10 pt-10 pb-20 flex-col'>
        <h1 className='text-white text-4xl font-bold pb-8 drop-shadow-lg animate-slide-in flex items-center'>
          <span className="mr-2">✨</span> Choose your vibe
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
                {weatherData && (
                  <div className='text-white mt-2 pl-2 flex items-center'>
                    <div className="mr-2">
                      {weatherData.condition === 'Sunny' ? '☀️' : 
                       weatherData.condition === 'Rainy' ? '🌧️' : 
                       weatherData.condition === 'Cloudy' ? '☁️' : '🌤️'}
                    </div>
                    <div>
                      <p className='text-lg'>{weatherData.temperature}°C - {weatherData.condition}</p>
                      <p className='text-white/80 text-sm'>{weatherData.location}</p>
                    </div>
                  </div>
                )}
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
            {isLoading ? 'Getting recommendations...' : '🎵 Get Song Recommendations'}
          </button>
        </div>
        
        {/* Recommendations display */}
        {recommendations.length > 0 && <RecommendationsList />}
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
      `}</style>
    </div>
  );
}