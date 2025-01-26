import { LoaderFunctionArgs, redirect } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import { useState, useEffect, useRef } from 'react';
import { sessionStorage } from '~/services/session.server';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const session = await sessionStorage.getSession(request.headers.get('Cookie'));
  const user = session.get('user');

  if (!user) {
    return redirect('/login');
  }

  return user;
};

export default function Dashboard() {
  const user = useLoaderData<typeof loader>();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
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
    <div className='flex h-screen w-full bg-gradient-to-b from-secondary from-70% to-primary flex-col'>
      <div className='flex w-full h-14 justify-end items-center gap-1 pt-5 pr-4'>
        <div className="relative" ref={dropdownRef}>
          <img 
            src={user.profileImage}
            className='rounded-full w-12 cursor-pointer hover:opacity-80 transition-opacity'
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            alt="Profile"
          />
          {isDropdownOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 ring-1 ring-black ring-opacity-5">
              <button 
                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                onClick={() => window.location.href = '/profile'}
              >
                Profile
              </button>
              <button 
                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                onClick={() => window.location.href = '/settings'}
              >
                Settings
              </button>
              <button 
                onClick={() => window.location.href = '/logout'} 
                type="submit"
                className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
      <div className='flex w-full h-full px-48 pt-20'>
        <div className='flex w-1/3 flex-col'>
          <h1 className='text-black text-3xl font-bold pb-8'>Choose your vibe</h1>
          <div className='flex flex-col font-bold text-black text-xl max-h-72 overflow-y-auto gap-1
          [&::-webkit-scrollbar]:w-1
          [&::-webkit-scrollbar]:hover:w-2
          [&::-webkit-scrollbar-track]:rounded-xl
          [&::-webkit-scrollbar-track]:bg-secondary
          [&::-webkit-scrollbar-thumb]:rounded-lg
          [&::-webkit-scrollbar-thumb]:bg-primary
          '>
          <h2>Rock</h2>
          <h2>Pop</h2>
          <h2>Hip-Hop</h2>
          <h2>Country</h2>
          <h2>Classical</h2>
          <h2>Electro</h2>
          <h2>Jazz</h2>
          <h2>Latin</h2>
          <h2>Heavy Metal</h2>
          <h2>K-pop</h2>
          <h2>Funk</h2>
          <h2>Folk</h2>
          <h2>Gym</h2>
        </div>
        </div>
        <div className='flex w-1/3 flex-col'>

        </div>
        <div className='flex w-1/3 flex-col'>

        </div>
      </div>
    </div>
  );
}