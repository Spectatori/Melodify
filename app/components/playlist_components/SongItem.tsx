// components/playlist_components/SongItem.tsx
import * as React from 'react';
import type { SongDetail } from './types';

interface SongItemProps {
  song: string;
  index: number;
  isSelected: boolean;
  showFineTuneOptions: boolean;
  onToggleSelection: (index: number) => void;
  songDetail?: SongDetail;
}

// Local duration formatting function (copied from server)
function formatDuration(durationMs?: number): string {
  if (!durationMs) return '--:--';
  
  const minutes = Math.floor(durationMs / 60000);
  const seconds = Math.floor((durationMs % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// Generate consistent pseudo-random duration based on song content
function generateConsistentDuration(song: string, index: number): string {
  // Create a simple hash from song name for consistency
  let hash = 0;
  for (let i = 0; i < song.length; i++) {
    const char = song.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Use hash and index to generate consistent duration between 2:00 - 4:30
  const seedValue = Math.abs(hash + index);
  const minutes = 2 + (seedValue % 3); // 2, 3, or 4 minutes
  const seconds = (seedValue * 7) % 60; // Pseudo-random seconds
  
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export const SongItem = React.memo(({
  song,
  index,
  isSelected,
  showFineTuneOptions,
  onToggleSelection,
  songDetail
}: SongItemProps) => {
  // Extract song name and artist from format: "1. "Song Name" by Artist Name"
  const match = song.match(/^\d+\.\s*"([^"]+)"\s*by\s*(.+)$/);
  const songName = match ? match[1] : song;
  const artistName = match ? match[2] : '';
  
  // Format duration - use real duration if available, otherwise generate consistent placeholder
  const duration = songDetail?.duration 
    ? formatDuration(songDetail.duration)
    : generateConsistentDuration(song, index);

  // Check if song has Spotify data
  const hasSpotifyData = songDetail?.spotifyUrl || songDetail?.duration;

  const handleClick = () => {
    if (showFineTuneOptions) {
      onToggleSelection(index);
    }
  };

  return (
    <div 
      className={`flex items-center p-3 rounded-lg transition-all duration-300
        hover:translate-x-1 group song-item
        ${isSelected ? 'bg-white/20 ring-2 ring-white/40' : 'hover:bg-white/10'}
        ${showFineTuneOptions ? 'cursor-pointer' : ''}`}
      style={{ 
        animation: 'fadeIn 0.5s ease-out forwards',
        animationDelay: `${index * 50}ms`,
        opacity: '0'
      }}
      onClick={handleClick}
    >
      {/* Selection checkbox for fine-tune mode */}
      {showFineTuneOptions && (
        <div className="mr-3 flex-shrink-0">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelection(index)}
            className="w-4 h-4 text-blue-600 bg-white/20 border-white/30 rounded 
              focus:ring-blue-500 focus:ring-2 cursor-pointer"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

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
      
      {/* Duration */}
      <div className={`text-sm font-mono flex-shrink-0 ml-4 ${
        songDetail?.duration ? 'text-white/70' : 'text-white/40'
      }`}>
        {duration}
      </div>
      
      {/* Spotify link button - only show if song was found on Spotify */}
      {songDetail?.spotifyUrl && (
        <a
          href={songDetail.spotifyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className='ml-3 p-2 text-white/60 hover:text-green-400 rounded-full 
            hover:bg-white/10 transition-all opacity-0 group-hover:opacity-100'
          title="Open in Spotify"
          onClick={(e) => e.stopPropagation()}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.42 1.56-.299.421-1.02.599-1.559.3z"/>
          </svg>
        </a>
      )}
      
      {/* Not found on Spotify indicator - show for songs without Spotify data */}
      {!hasSpotifyData && (
        <div
          className='ml-3 p-2 text-white/30 rounded-full opacity-0 group-hover:opacity-60'
          title="Not found on Spotify"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      )}
      
      {/* Play button (placeholder) */}
      <button 
        className='ml-3 p-2 text-white/60 hover:text-white rounded-full 
          hover:bg-white/10 transition-all opacity-0 group-hover:opacity-100'
        onClick={(e) => e.stopPropagation()}
        title="Play song"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M8 5v14l11-7z"/>
        </svg>
      </button>
    </div>
  );
});

SongItem.displayName = 'SongItem';