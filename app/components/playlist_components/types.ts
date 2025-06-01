export interface PlaylistRecommendation {
  id: string;
  name: string;
  description: string;
  songs: string[];
  createdAt: string;
  userId: string;
  coverImageUrl?: string;
  filters: {
    genre?: string;
    subgenre?: string;
    mood?: string;
    bpm?: string;
    activity?: string;
    era?: string;
    timeOfDay?: string;
    weather?: string;
  }
}