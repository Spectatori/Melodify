import { LoaderFunctionArgs, redirect } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import { useState, useEffect, useRef } from 'react';
import { sessionStorage } from '~/services/session.server';

const genreMap = {
  'Rock': ['Alternative', 'Classic Rock', 'Indie Rock', 'Progressive Rock', 'Punk Rock', 'Soft Rock'],
  'Pop': ['Dance Pop', 'Indie Pop', 'K-pop', 'Synth-pop', 'Pop Rock', 'Traditional Pop'],
  'Hip-Hop': ['Trap', 'Rap', 'Old School', 'Underground', 'Alternative Hip Hop', 'Pop Rap'],
  'Country': ['Traditional', 'Modern', 'Bluegrass', 'Country Pop', 'Country Rock', 'Western'],
  'Classical': ['Baroque', 'Classical Period', 'Romantic', 'Contemporary', 'Opera', 'Chamber Music'],
  'Electro': ['House', 'Techno', 'Trance', 'Dubstep', 'Ambient', 'EDM'],
  'Jazz': ['Bebop', 'Swing', 'Cool Jazz', 'Free Jazz', 'Fusion', 'Latin Jazz'],
  'Latin': ['Salsa', 'Reggaeton', 'Bachata', 'Latin Pop', 'Latin Rock', 'Merengue'],
  'Heavy Metal': ['Black Metal', 'Death Metal', 'Thrash Metal', 'Power Metal', 'Nu Metal', 'Gothic Metal'],
  'K-pop': ['Boy Groups', 'Girl Groups', 'Solo Artists', 'K-rap', 'K-rock', 'K-indie'],
  'Funk': ['P-Funk', 'Deep Funk', 'Funk Rock', 'G-Funk', 'Jazz-Funk', 'Soul Funk'],
  'Folk': ['Traditional', 'Contemporary', 'Celtic', 'American', 'Folk Rock', 'World Folk'],
  'Gym': ['Workout', 'Power Music', 'High Energy', 'Cardio', 'Training', 'Motivation']
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const session = await sessionStorage.getSession(request.headers.get('Cookie'));
  const user = session.get('user');
  if (!user) return redirect('/login');
  return user;
};

export default function Dashboard() {
  const user = useLoaderData<typeof loader>();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [selectedSubgenre, setSelectedSubgenre] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  return (
    <div className='flex h-screen w-full bg-gradient-to-br from-orange-400 via-pink-400 to-purple-400 flex-col'>
      <div className='flex w-full h-14 justify-end items-center gap-1 pt-5 pr-4'>
        <div className="relative" ref={dropdownRef}>
          <img 
            src={user.profileImage}
            className='rounded-full w-12 cursor-pointer hover:opacity-80 transition-opacity ring-2 ring-orange-200/50'
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            alt="Profile"
          />
          {isDropdownOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white/20 backdrop-blur-md rounded-md shadow-lg py-1 ring-1 ring-white/30">
              <button 
                className="block w-full text-left px-4 py-2 text-sm text-white hover:bg-white/30"
                onClick={() => window.location.href = '/profile'}
              >
                Profile
              </button>
              <button 
                className="block w-full text-left px-4 py-2 text-sm text-white hover:bg-white/30"
                onClick={() => window.location.href = '/settings'}
              >
                Settings
              </button>
              <button 
                onClick={() => window.location.href = '/logout'} 
                type="submit"
                className="block w-full text-left px-4 py-2 text-sm text-red-100 hover:bg-white/30"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
      
      <div className='flex w-full h-full px-48 pt-20 gap-6 flex-col'>
          <h1 className='text-white text-4xl font-bold pb-8 drop-shadow-lg animate-slide-in'>
            Choose your vibe
          </h1>
          <div className='flex gap-10'>
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
                  }}
                >
                  {genre}
                </div>
                ))}
              </div>
            </div>

            {selectedGenre && (
              <div className='flex flex-col w-1/3'>
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
                    {genreMap[selectedGenre as keyof typeof genreMap].map((subgenre, index) => (
                      <div
                        key={subgenre}
                        style={{ 
                          animation: 'slideUp 0.5s ease-out forwards',
                          animationDelay: `${index * 50}ms`,
                          opacity: '0'
                        }}
                        className={`cursor-pointer p-3 rounded-lg transition-all duration-300 hover:bg-white/20
                          ${selectedSubgenre === subgenre ? 'bg-white/30 text-white shadow-lg ring-1 ring-white/40 scale-102' : ''}`}
                        onClick={() => setSelectedSubgenre(subgenre)}
                      >
                        {subgenre}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
      </div>
    </div>
  );
}