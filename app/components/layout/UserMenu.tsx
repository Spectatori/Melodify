// src/components/layout/UserMenu.tsx
import { useRef, useState, useEffect } from 'react';

interface UserMenuProps {
  profileImage: string;
}

export default function UserMenu({ profileImage }: UserMenuProps) {
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
    <div className='flex w-full h-14 justify-end items-center gap-1 pt-5 pr-4'>
      <div className="relative" ref={dropdownRef}>
        <img 
          src={profileImage}
          className='rounded-full w-12 cursor-pointer hover:opacity-80 transition-opacity ring-2 ring-orange-200/50'
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          alt="Profile"
        />
        {isDropdownOpen && (
          <div className="absolute right-0 mt-2 w-48 bg-white/20 backdrop-blur-md rounded-md shadow-lg py-1 ring-1 ring-white/30">
            {/* <button 
              className="block w-full text-left px-4 py-2 text-sm text-white hover:bg-white/30"
              onClick={() => window.location.href = '/profile'}
            >
              Profile
            </button> */}
            <button 
              onClick={() => window.location.href = '/logout'} 
              className="block w-full text-left px-4 py-2 text-sm text-red-100 hover:bg-white/30"
            >
              Logout
            </button>
          </div>
        )}
      </div>
    </div>
  );
}