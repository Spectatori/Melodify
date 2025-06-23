// components/playlist_components/SongsList.tsx
import * as React from 'react';
import { SongItem } from './SongItem';
import type { SongDetail } from './types';

interface SongsListProps {
  songs: string[];
  selectedSongs: Set<number>;
  showFineTuneOptions: boolean;
  isLoading: boolean;
  onToggleSongSelection: (index: number) => void;
  onClearSelection: () => void;
  songDetails?: SongDetail[];
}

// Local utility functions (copied from server)
function calculateTotalDuration(songDetails: SongDetail[]): number {
  return songDetails.reduce((total, song) => {
    return total + (song.duration || 0);
  }, 0);
}

function formatDuration(durationMs: number): string {
  if (!durationMs) return '--:--';
  
  const totalMinutes = Math.floor(durationMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

export const SongsList = React.memo(({
  songs,
  selectedSongs,
  showFineTuneOptions,
  isLoading,
  onToggleSongSelection,
  onClearSelection,
  songDetails
}: SongsListProps) => {
  // Calculate total duration if song details are available
  const totalDuration = songDetails ? calculateTotalDuration(songDetails) : null;

  return (
    <div className='lg:w-2/3'>
      <div className='bg-white/20 backdrop-blur-md rounded-xl p-6 ring-1 ring-white/30 shadow-xl
        hover:shadow-2xl transition-all duration-300'>
        
        <h3 className='text-white font-bold text-xl mb-4 flex items-center'>
          <span className="mr-2">🎶</span> Tracklist
          {isLoading && (
            <span className="ml-auto text-sm font-normal flex items-center">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white mr-2"></div>
              Processing...
            </span>
          )}
          {totalDuration && !isLoading && (
            <span className="ml-auto text-sm font-normal">
              Total: {formatDuration(totalDuration)}
            </span>
          )}
        </h3>
        
        {showFineTuneOptions && !isLoading && (
          <div className="mb-4 p-3 bg-white/10 rounded-lg border border-white/20">
            <div className="flex items-center justify-between">
              <span className="text-white/80 text-sm">
                Select songs to replace:
              </span>
              <button
                onClick={onClearSelection}
                className="text-white/70 hover:text-white text-xs underline"
              >
                Clear all
              </button>
            </div>
          </div>
        )}
        
        <div className='space-y-2'>
          {songs.map((song, index) => (
            <SongItem
              key={index}
              song={song}
              index={index}
              isSelected={selectedSongs.has(index)}
              showFineTuneOptions={showFineTuneOptions}
              onToggleSelection={onToggleSongSelection}
              songDetail={songDetails?.[index]}
            />
          ))}
        </div>
      </div>
    </div>
  );
});

SongsList.displayName = 'SongsList';