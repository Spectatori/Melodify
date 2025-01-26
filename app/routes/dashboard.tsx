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
    </div>
  );
}