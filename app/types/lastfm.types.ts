export interface LastFmTrack {
    name: string;
    artist: {
      name: string;
      mbid?: string;
      url?: string;
    };
    url?: string;
    duration?: string;
    listeners?: string;
    playcount?: string;
    mbid?: string;
    image?: LastFmImage[];
    streamable?: {
      fulltrack: string;
      "#text": string;
    };
    match?: number;
  }
  
  export interface LastFmImage {
    "#text": string;
    size: 'small' | 'medium' | 'large' | 'extralarge';
  }
  
  export interface LastFmTopTracksResponse {
    tracks: {
      track: LastFmTrack[];
      "@attr"?: {
        page: string;
        perPage: string;
        totalPages: string;
        total: string;
      };
    };
  }
  
  export interface LastFmTagTracksResponse {
    tracks: {
      track: LastFmTrack[];
      "@attr"?: {
        tag: string;
        page: string;
        perPage: string;
        totalPages: string;
        total: string;
      };
    };
  }
  
  export interface LastFmSearchTracksResponse {
    results: {
      trackmatches: {
        track: LastFmTrack[];
      };
      "@attr"?: {
        for: string;
      };
    };
  }
  
  export interface LastFmSimilarTracksResponse {
    similartracks: {
      track: LastFmTrack[];
      "@attr"?: {
        artist: string;
      };
    };
  }
  
  // Types for our own functions
  export interface LastFmContextTrack {
    name: string;
    artist: string;
    listeners?: string;
    url?: string;
  }
  
  export interface LastFmContextParams {
    genre?: string;
    subgenre?: string;
    mood?: string;
    era?: string;
    limit?: number;
  }
  
  export interface UserOptions {
    genre?: string;
    subgenre?: string;
    mood?: string;
    bpm?: string;
    activity?: string;
    era?: string;
    timeOfDay?: string;
    weather?: string;
  }