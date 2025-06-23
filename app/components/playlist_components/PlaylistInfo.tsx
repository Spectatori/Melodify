import * as React from 'react';
import { useFetcher } from '@remix-run/react';
import { useState, useEffect } from 'react';
import { PlaylistRecommendation } from './types';

interface SpotifyActionSuccess {
  success: true;
  message: string;
  playlistUrl: string;
  tracksAdded: number;
  totalSongs: number;
  notFoundCount: number;
}

interface SpotifyActionError {
  error: string;
  success?: false;
}

type SpotifyActionResponse = SpotifyActionSuccess | SpotifyActionError;

interface PlaylistInfoProps {
  playlist: PlaylistRecommendation;
  user: any;
  selectedSongs: Set<number>;
  showFineTuneOptions: boolean;
  isLoading: boolean;
  onToggleFineTuneOptions: () => void;
  onAddMoreSongs: () => void;
  onReplaceSelectedSongs: () => void;
  onRegeneratePlaylist: () => void;
  onAddToSpotify: () => void;
  errorMessage?: string;
  successMessage?: string;
}

export const PlaylistInfo = React.memo(({ 
  playlist, 
  user, 
  selectedSongs, 
  showFineTuneOptions, 
  isLoading, 
  onToggleFineTuneOptions,
  onAddMoreSongs,
  onReplaceSelectedSongs,
  onRegeneratePlaylist,
  onAddToSpotify,
  errorMessage,
  successMessage
}: PlaylistInfoProps) => {
  const fetcher = useFetcher<SpotifyActionResponse>();
  const testFetcher = useFetcher<SpotifyActionResponse>();
  const scopeCheckFetcher = useFetcher<SpotifyActionResponse>();
  const [isAddingToSpotify, setIsAddingToSpotify] = useState(false);
  const [lastCreatedPlaylistId, setLastCreatedPlaylistId] = useState<string | null>(null);

  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data) {
      setIsAddingToSpotify(false);
      
      // Store the Spotify playlist ID for testing
      if ('success' in fetcher.data && fetcher.data.success && fetcher.data.playlistUrl) {
        const matches = fetcher.data.playlistUrl.match(/playlist\/([a-zA-Z0-9]+)/);
        if (matches) {
          setLastCreatedPlaylistId(matches[1]);
        }
      }
    }
  }, [fetcher.state, fetcher.data]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleCheckTokenScopes = () => {
    const formData = new FormData();
    formData.append('actionType', 'checkTokenScopes');
    
    scopeCheckFetcher.submit(formData, { method: 'post' });
  };
  
  const handleTestImageUpload = () => {
    if (!lastCreatedPlaylistId) {
      alert("Please create a Spotify playlist first to test image upload");
      return;
    }
    
    const formData = new FormData();
    formData.append('actionType', 'testImageUpload');
    formData.append('playlistId', playlist.id);
    formData.append('spotifyPlaylistId', lastCreatedPlaylistId);
    
    testFetcher.submit(formData, { method: 'post' });
  };

  const handleAddToSpotify = () => {
    setIsAddingToSpotify(true);
    
    const formData = new FormData();
    formData.append('actionType', 'addToSpotify');
    formData.append('playlistName', playlist.name);
    formData.append('playlistDescription', playlist.description);
    formData.append('songs', playlist.songs.join('\n'));
    formData.append('playlistId', playlist.id);
    
    fetcher.submit(formData, { method: 'post' });
  };

  return (
    <div className='lg:w-1/3'>
      <div className='flex flex-col items-center bg-white/20 backdrop-blur-md rounded-xl p-6 ring-1 ring-white/30 shadow-xl
        hover:shadow-2xl transition-all duration-300 sticky top-4'>
        
        {/* Playlist artwork */}
        <div className="aspect-square bg-gradient-to-br from-white/10 to-white/5 rounded-lg mb-4
          flex items-center justify-center text-6xl w-80 overflow-hidden backdrop-blur-sm
          ring-1 ring-white/20 shadow-2xl">
          {playlist.coverImageUrl ? (
            <img 
              src={playlist.coverImageUrl} 
              alt={`${playlist.name} cover art`}
              className="w-full h-full object-cover rounded-lg shadow-inner"
            />
          ) : (
            '🎵'
          )}
        </div>
        
        <h2 className='text-white font-bold text-2xl mb-2'>{playlist.name}</h2>
        <p className='text-white/80 text-sm mb-4'>{playlist.description}</p>
        
        {/* Playlist stats */}
        <div className='flex justify-between text-white/60 text-sm mb-4'>
          <span>{playlist.songs.length} songs</span>
          <span>~{Math.round(playlist.songs.length * 3.5)} min</span>
        </div>
        
        <div className='text-white/60 text-xs mb-6'>
          Created {formatDate(playlist.createdAt)}
        </div>
        
        {/* Filter tags */}
        <div className='flex flex-wrap gap-2 mb-6'>
          {Object.entries(playlist.filters).map(([key, value]) => 
            value && (
              <span key={key} className='bg-white/20 px-3 py-1 rounded-full text-xs text-white'>
                {value}
              </span>
            )
          )}
        </div>
        
        {/* Fine-tune section */}
        <div className="w-full mb-4">
          <button
            onClick={onToggleFineTuneOptions}
            className='w-full bg-purple-600/80 hover:bg-purple-500 text-white font-bold py-2 px-4 rounded-lg transition-all'
          >
            Fine-tune Playlist
          </button>
          
          {showFineTuneOptions && (
            <div className="mt-3 space-y-2">
              <button
                onClick={onAddMoreSongs}
                disabled={isLoading}
                className='w-full bg-blue-600/80 hover:bg-blue-500 text-white font-bold py-2 px-3 rounded-lg
                  transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm'
              >
                {isLoading ? 'Processing...' : 'Add More Songs'}
              </button>
              
              <button
                onClick={onReplaceSelectedSongs}
                disabled={isLoading || selectedSongs.size === 0}
                className='w-full bg-orange-600/80 hover:bg-orange-500 text-white font-bold py-2 px-3 rounded-lg
                  transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm'
              >
                Replace Selected ({selectedSongs.size})
              </button>
              
              <button
                onClick={onRegeneratePlaylist}
                disabled={isLoading}
                className='w-full bg-red-600/80 hover:bg-red-500 text-white font-bold py-2 px-3 rounded-lg
                  transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm'
              >
                {isLoading ? 'Regenerating...' : 'Regenerate All'}
              </button>
            </div>
          )}
        </div>
        
        {/* Add to Spotify button */}
        <button
          onClick={handleAddToSpotify}
          disabled={isAddingToSpotify}
          className='w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-4 rounded-lg
            transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed
            hover:scale-105 disabled:hover:scale-100 flex items-center justify-center gap-2 mb-3'
        >
          {isAddingToSpotify ? (
            <>
              <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin"></div>
              Adding to Spotify...
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.42 1.56-.299.421-1.02.599-1.559.3z"/>
              </svg>
              Add to Spotify
            </>
          )}
        </button>

        {/* Status messages for fine-tuning */}
        {successMessage && (
          <div className="mt-4 p-3 bg-green-500/20 border border-green-500/30 rounded-lg">
            <p className="text-green-100 text-sm">
              ✅ {successMessage}
            </p>
          </div>
        )}
        
        {errorMessage && (
          <div className="mt-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg">
            <p className="text-red-100 text-sm">
              ❌ {errorMessage}
            </p>
          </div>
        )}

        {/* Spotify success messages */}
        {fetcher.data && 'success' in fetcher.data && fetcher.data.success && (
          <div className="mt-4 p-3 bg-green-500/20 border border-green-500/30 rounded-lg">
            <p className="text-green-100 text-sm">
              ✅ {fetcher.data.message}
            </p>
            {fetcher.data.playlistUrl && (
              <a 
                href={fetcher.data.playlistUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-green-200 underline text-sm hover:text-green-100 block mt-2"
              >
                🎵 Open in Spotify →
              </a>
            )}
            {fetcher.data.notFoundCount > 0 && (
              <p className="text-green-200 text-xs mt-1">
                Note: {fetcher.data.notFoundCount} songs couldn't be found on Spotify
              </p>
            )}
          </div>
        )}
        
        {/* Spotify error messages */}
        {fetcher.data && 'error' in fetcher.data && fetcher.data.error && (
          <div className="mt-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg">
            <p className="text-red-100 text-sm">
              ❌ {fetcher.data.error}
            </p>
            
            {(fetcher.data.error.includes('permission') || fetcher.data.error.includes('scope') || fetcher.data.error.includes('Insufficient')) && (
              <div className="mt-3 p-3 bg-yellow-500/20 border border-yellow-500/30 rounded-lg">
                <p className="text-yellow-200 text-sm mb-2">
                  🔑 Your Spotify token doesn't have playlist creation permissions.
                </p>
                <div className="flex gap-2">
                  <a
                    href="/reauth"
                    className="inline-block bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-4 rounded
                      transition-all duration-300 hover:scale-105 text-sm"
                  >
                    🎵 Re-authenticate with Playlist Permissions
                  </a>
                </div>
              </div>
            )}
            
            {fetcher.data && 'error' in fetcher.data && fetcher.data.error.includes('log') && (
              <p className="text-red-200 text-xs mt-2">
                💡 Try logging out and back in to refresh your Spotify permissions
              </p>
            )}
          </div>
        )}

        {/* Token scope check results */}
        {scopeCheckFetcher.data && 'success' in scopeCheckFetcher.data && scopeCheckFetcher.data.success && (
          <div className="mt-4 p-3 bg-purple-500/20 border border-purple-500/30 rounded-lg">
            <p className="text-purple-100 text-sm">
              🔍 {scopeCheckFetcher.data.message}
            </p>
          </div>
        )}
        
        {scopeCheckFetcher.data && 'error' in scopeCheckFetcher.data && scopeCheckFetcher.data.error && (
          <div className="mt-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg">
            <p className="text-red-100 text-sm">
              🔍❌ {scopeCheckFetcher.data.error}
            </p>
            {scopeCheckFetcher.data.error.includes('401') && (
              <div className="mt-2 p-2 bg-yellow-500/20 border border-yellow-500/30 rounded">
                <p className="text-yellow-200 text-xs mb-2">
                  💡 Your token has expired. Click below to get a fresh token with all required permissions.
                </p>
                <a 
                  href="/reauth" 
                  className="inline-block bg-yellow-600 hover:bg-yellow-500 text-white text-xs font-bold py-1 px-3 rounded transition-all duration-300 hover:scale-105"
                >
                  🔄 Re-authenticate with Spotify
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

PlaylistInfo.displayName = 'PlaylistInfo';