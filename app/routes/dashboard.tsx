import { LoaderFunctionArgs, redirect } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import { useState, useEffect, useRef } from 'react';
import { sessionStorage } from '~/services/session.server';
import { useFetcher } from "@remix-run/react";
import UserMenu from '~/components/layout/UserMenu';
import { genreMap } from '~/data/gengreMap';

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
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<string[]>([]);
  
  interface FetcherData {
    content: string;
    error?: string;
  }

  const llamaFetcher = useFetcher<FetcherData>();
  
  const handleLlamaClick = () => {
    const prompt = `Suggest me some songs in the ${selectedSubgenre} subgenre of ${selectedGenre} music. Format as a numbered list of 5 songs with artist names.`;
    
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
  
  // The GenreSelector component (could be extracted further)
  const GenreSelector = () => (
    <div className='bg-white/20 backdrop-blur-md rounded-xl p-4 w-1/3 ring-1 ring-white/30 shadow-xl
      hover:shadow-2xl transition-all duration-300'>
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
            ${selectedGenre === genre ? 'bg-white/30 text-white shadow-lg ring-1 ring-white/40 scale-102' : ''}`}
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
      hover:shadow-2xl transition-all duration-300'>
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
              ${selectedSubgenre === subgenre ? 'bg-white/30 text-white shadow-lg ring-1 ring-white/40 scale-102' : ''}`}
            onClick={() => {
              setSelectedSubgenre(subgenre);
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
  
  const RecommendationsList = () => (
    <div className='mt-4 bg-white/20 backdrop-blur-md rounded-xl p-4 ring-1 ring-white/30 shadow-xl
      hover:shadow-2xl transition-all duration-300'>
      <h3 className='text-white font-bold text-xl mb-3'>Top Recommendations</h3>
      <ul className='text-white'>
        {recommendations.map((song, index) => (
          <li key={index} className='py-2 border-b border-white/10 last:border-0'>
            {song}
          </li>
        ))}
      </ul>
    </div>
  );
  
  const LoadingIndicator = () => (
    <div className="fixed bottom-4 right-4 bg-white/20 backdrop-blur-md px-4 py-2 rounded-lg ring-1 ring-white/30 shadow-lg">
      <p className="text-white">Loading response from Llama...</p>
    </div>
  );
  
  return (
    <div className='flex h-screen w-full bg-gradient-to-br from-orange-400 via-pink-400 to-purple-400 flex-col'>
      
      <UserMenu profileImage={user.profileImage} />
      
      <div className='flex w-full h-full px-48 pt-20 gap-6 flex-col'>
        <h1 className='text-white text-4xl font-bold pb-8 drop-shadow-lg animate-slide-in'>
          Choose your vibe
        </h1>
        <div className='flex gap-10'>
          <GenreSelector />

          {selectedGenre && (
            <div className='flex flex-col w-1/3'>
              <SubgenreSelector />
              
              {selectedSubgenre && (
                <div className='flex flex-col gap-4 mt-4'>
                  <div className='flex gap-3'>
                    <button 
                      className='bg-white/20 backdrop-blur-md px-4 py-2 text-white rounded-lg
                        ring-1 ring-white/30 shadow-lg hover:bg-white/30 transition-all duration-300'
                      onClick={handleLlamaClick}
                      disabled={isLoading}
                    >
                      {isLoading ? 'Getting recommendations...' : 'Get Song Recommendations'}
                    </button>
                  </div>
                  {recommendations.length > 0 && <RecommendationsList />}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      {isLoading && <LoadingIndicator />}
    </div>
  );
}