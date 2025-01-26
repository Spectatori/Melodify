import { LoaderFunctionArgs, redirect } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import { useState } from 'react';
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
  
  return (
    <div className='flex h-screen w-full bg-gradient-to-b from-secondary from-70% to-primary flex-col'>
      <div className='flex w-full h-14 justify-end items-center gap-1 pt-5 pr-4'>
        <div className="relative">
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
              <form action="/logout" method="post">
                <button 
                  type="submit"
                  className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
                >
                  Logout
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
      {/* <h1>Welcome, {user.displayName}</h1>
        <img 
          src={user.profileImage}
          className='rounded-full w-12'
        />
        <form action="/logout" method="post">
        <button 
          onClick={() => window.location.href = '/logout'} 
          type="button"
        >
          Logout
        </button>
        </form> */}