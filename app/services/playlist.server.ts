// src/services/playlist.server.ts
interface PlaylistRecommendation {
  id: string;
  name: string;
  description: string;
  songs: string[];
  createdAt: string;
  userId: string;
  filters: {
    genre?: string;
    subgenre?: string;
    mood?: string;
    bpm?: string;
    activity?: string;
    era?: string;
    timeOfDay?: string;
    weather?: string;
  };
}

// In-memory storage for playlists (in a real app, this would be a database)
const playlistStorage: Map<string, PlaylistRecommendation> = new Map();
const userPlaylists: Map<string, string[]> = new Map();

export function savePlaylist(playlist: PlaylistRecommendation): PlaylistRecommendation {
  playlistStorage.set(playlist.id, playlist);
  
  // Add to user's playlist list
  const userPlaylistIds = userPlaylists.get(playlist.userId) || [];
  userPlaylistIds.unshift(playlist.id); // Add to beginning for newest first
  userPlaylists.set(playlist.userId, userPlaylistIds);
  
  console.log(`Saved playlist ${playlist.id} for user ${playlist.userId}`);
  return playlist;
}

export function getPlaylist(id: string): PlaylistRecommendation | null {
  return playlistStorage.get(id) || null;
}

export function getUserPlaylists(userId: string): PlaylistRecommendation[] {
  const playlistIds = userPlaylists.get(userId) || [];
  return playlistIds
    .map(id => playlistStorage.get(id))
    .filter((playlist): playlist is PlaylistRecommendation => playlist !== undefined);
}

export function deletePlaylist(id: string, userId: string): boolean {
  const playlist = playlistStorage.get(id);
  if (!playlist || playlist.userId !== userId) {
    return false;
  }
  
  playlistStorage.delete(id);
  
  // Remove from user's playlist list
  const userPlaylistIds = userPlaylists.get(userId) || [];
  const updatedIds = userPlaylistIds.filter(playlistId => playlistId !== id);
  userPlaylists.set(userId, updatedIds);
  
  return true;
}