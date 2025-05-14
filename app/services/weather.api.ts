// src/utils/weatherApi.ts
export interface WeatherResponse {
    temperature: number;
    condition: string;
    location: string;
  }
  
  // Helper function to determine weather condition based on temperature and any other parameters
  const determineWeatherCondition = (temperature: number): string => {
    // This is a simple implementation - you might want to enhance this with more data points
    if (temperature > 25) return 'Sunny';
    if (temperature < 5) return 'Cold';
    if (temperature < 15) return 'Cloudy';
    return 'Pleasant';
  };
  
  // Function to get location name from coordinates using reverse geocoding
  async function getLocationName(latitude: number, longitude: number): Promise<string> {
    try {
      // Using OpenStreetMap Nominatim for reverse geocoding
      // This is a free service with reasonable usage limits
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10`;
      
      const response = await fetch(url, {
        headers: {
          // Adding a user agent as required by Nominatim usage policy
          'User-Agent': 'MusicRecommendationApp/1.0'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Geocoding API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Extract the most relevant location info
      let locationName = 'Unknown Location';
      
      if (data.address) {
        // Try to construct a meaningful location string
        const parts = [];
        
        // City or town
        if (data.address.city) {
          parts.push(data.address.city);
        } else if (data.address.town) {
          parts.push(data.address.town);
        } else if (data.address.village) {
          parts.push(data.address.village);
        }
        
        // State/province/region
        if (data.address.state) {
          parts.push(data.address.state);
        } else if (data.address.county) {
          parts.push(data.address.county);
        }
        
        // Country
        if (data.address.country) {
          parts.push(data.address.country);
        }
        
        if (parts.length > 0) {
          locationName = parts.join(', ');
        }
      } else if (data.display_name) {
        // Fallback to display_name if structured address is not available
        locationName = data.display_name;
      }
      
      return locationName;
    } catch (error) {
      console.error('Error with reverse geocoding:', error);
      return 'Current Location'; // Fallback
    }
  }
  
  export async function fetchWeather(latitude: number = 42.697708, longitude: number = 23.321868): Promise<WeatherResponse> {
    try {
      // Start both API calls in parallel
      const weatherPromise = fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&timezone=auto`);
      const locationPromise = getLocationName(latitude, longitude);
      
      // Wait for the weather API response
      const weatherResponse = await weatherPromise;
      
      if (!weatherResponse.ok) {
        throw new Error(`Weather API error: ${weatherResponse.status}`);
      }
      
      const weatherData = await weatherResponse.json();
      
      // Extract the current temperature
      const temperature = Math.round(weatherData.current.temperature_2m);
      
      // Determine weather condition based on weather_code or temperature
      const weatherCode = weatherData.current.weather_code;
      let condition = 'Unknown';
      
      // WMO Weather interpretation codes (https://open-meteo.com/en/docs)
      if (weatherCode >= 0 && weatherCode < 20) {
        condition = 'Clear';
      } else if (weatherCode >= 20 && weatherCode < 30) {
        condition = 'Cloudy';
      } else if (weatherCode >= 30 && weatherCode < 70) {
        condition = 'Rainy';
      } else if (weatherCode >= 70 && weatherCode < 80) {
        condition = 'Snowy';
      } else if (weatherCode >= 80 && weatherCode < 100) {
        condition = 'Stormy';
      } else {
        // Fallback to temperature-based determination
        condition = determineWeatherCondition(temperature);
      }
      
      // Wait for the location name
      const location = await locationPromise;
      
      // Return formatted weather data
      return {
        temperature,
        condition,
        location,
      };
    } catch (error) {
      console.error('Error fetching weather data:', error);
      
      // Return default values if there's an error
      return {
        temperature: 20,
        condition: 'Pleasant',
        location: 'Current Location',
      };
    }
  }