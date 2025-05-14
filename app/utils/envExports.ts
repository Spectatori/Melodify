const getEnv = (key: string, defaultValue?: string): string => {
    const value = process.env[key] || defaultValue;
  
    if(value == undefined){
      throw new Error(`Missing environment variable ${key}`);
    }
  
    return value;
}
  
export const LASTFM_API_KEY = getEnv("LASTFM_API_KEY");

export const SPOTIFY_CLIENT_ID = getEnv("SPOTIFY_CLIENT_ID");

export const SPOTIFY_CLIENT_SECRET = getEnv("SPOTIFY_CLIENT_SECRET");

export const SPOTIFY_CALLBACK_URL = getEnv("SPOTIFY_CALLBACK_URL");

export const OPENAI_API_KEY = getEnv("OPENAI_API_KEY");

export const SESSION_SECRET = getEnv("SESSION_SECRET");