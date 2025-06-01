import * as React from 'react';

interface SongItemProps {
  song: string;
  index: number;
  isSelected: boolean;
  showFineTuneOptions: boolean;
  onToggleSelection: (index: number) => void;
}

export const SongItem = React.memo(({ 
  song, 
  index, 
  isSelected, 
  showFineTuneOptions, 
  onToggleSelection 
}: SongItemProps) => {
  const match = song.match(/^\d+\.\s*"([^"]+)"\s*by\s*(.+)$/);
  const songName = match ? match[1] : song;
  const artistName = match ? match[2] : '';
  
  return (
    <div 
      className={`song-item flex items-center p-3 rounded-lg group cursor-pointer ${
        isSelected 
          ? 'bg-white/20 ring-2 ring-white/40' 
          : 'hover:bg-white/10'
        }`}
      onClick={() => showFineTuneOptions && onToggleSelection(index)}
    >
      {/* Selection checkbox */}
      {showFineTuneOptions && (
        <div className='mr-3 flex-shrink-0'>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelection(index)}
            className="w-4 h-4 text-blue-600 bg-transparent border-white/40 rounded"
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
      
      {/* Duration placeholder */}
      <div className='text-white/50 text-sm font-mono flex-shrink-0 ml-4'>
        {Math.floor(Math.random() * 2 + 2)}:{String(Math.floor(Math.random() * 60)).padStart(2, '0')}
      </div>
      
      {/* Play button */}
      <button className='ml-3 p-2 text-white/60 hover:text-white rounded-full 
        hover:bg-white/10 transition-all opacity-0 group-hover:opacity-100'>
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M8 5v14l11-7z"/>
        </svg>
      </button>
    </div>
  );
});

SongItem.displayName = 'SongItem';