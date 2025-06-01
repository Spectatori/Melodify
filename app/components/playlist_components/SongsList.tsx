import * as React from 'react';
import { SongItem } from './SongItem';

interface SongsListProps {
  songs: string[];
  selectedSongs: Set<number>;
  showFineTuneOptions: boolean;
  isLoading: boolean;
  onToggleSongSelection: (index: number) => void;
  onClearSelection: () => void;
}

export const SongsList = React.memo(({ 
  songs, 
  selectedSongs, 
  showFineTuneOptions, 
  isLoading, 
  onToggleSongSelection, 
  onClearSelection 
}: SongsListProps) => {
  return (
    <div className='lg:w-2/3'>
      <div className='bg-white/20 backdrop-blur-md rounded-xl p-6 ring-1 ring-white/30 shadow-xl
        hover:shadow-2xl transition-all duration-300'>
        
        <h3 className='text-white font-bold text-xl mb-4 flex items-center'>
          <span className="mr-2">🎶</span> Tracklist
          {isLoading && (
            <span className="ml-2 text-sm text-white/70 flex items-center">
              <div className="w-3 h-3 rounded-full bg-white animate-pulse mr-1"></div>
              Processing...
            </span>
          )}
        </h3>
        
        {showFineTuneOptions && !isLoading && (
          <div className="flex items-center gap-2 mb-4">
            <span className="text-white/70 text-sm">
              Select songs to replace:
            </span>
            <button
              onClick={onClearSelection}
              className="text-white/60 hover:text-white text-sm underline"
            >
              Clear all
            </button>
          </div>
        )}
        
        <div className='space-y-2'>
          {songs.map((song, index) => (
            <div 
              key={index}
              style={{ 
                animation: 'fadeIn 0.5s ease-out forwards',
                animationDelay: `${index * 50}ms`,
                opacity: '0'
              }}
            >
              <SongItem
                song={song}
                index={index}
                isSelected={selectedSongs.has(index)}
                showFineTuneOptions={showFineTuneOptions}
                onToggleSelection={onToggleSongSelection}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

SongsList.displayName = 'SongsList';