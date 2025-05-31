import { LocalIndex } from 'vectra';
import { OpenAI } from 'openai';
import { OPENAI_API_KEY } from '~/utils/envExports';
import path from 'path';
import fs from 'fs';

// Initialize OpenAI for embeddings
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

// Define the structure of our recommendation data
interface RecommendationRecord {
  id: string;
  userId: string;
  timestamp: string;
  userPrompt: string;
  userOptions: {
    genre?: string;
    subgenre?: string;
    mood?: string;
    era?: string;
    activity?: string;
    bpm?: string;
    timeOfDay?: string;
    weather?: string;
  };
  aiResponse: string;
  songs: string[];
  playlistId?: string;
  feedback?: {
    liked: boolean;
    rating?: number;
    notes?: string;
  };
}

// Vector database class
class MusicRecommendationVectorDB {
  private index: LocalIndex;
  private isInitialized = false;
  private dbPath: string;

  constructor() {
    // Create database directory if it doesn't exist
    this.dbPath = path.join(process.cwd(), 'data', 'vector-db');
    this.ensureDirectoryExists(this.dbPath);
    
    // Initialize the Vectra index
    this.index = new LocalIndex(this.dbPath);
  }

  private ensureDirectoryExists(dirPath: string) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(`Created vector database directory: ${dirPath}`);
    }
  }

  // Initialize the database (call this once on startup)
  async initialize(): Promise<void> {
    try {
      if (!this.isInitialized) {
        // Check if index exists, if not create it
        if (!await this.index.isIndexCreated()) {
          await this.index.createIndex();
          console.log('✅ Vector database index created successfully');
        } else {
          console.log('✅ Vector database index loaded successfully');
        }
        this.isInitialized = true;
      }
    } catch (error) {
      console.error('❌ Error initializing vector database:', error);
      throw error;
    }
  }

  // Generate embeddings for text using OpenAI
  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await openai.embeddings.create({
        model: 'text-embedding-3-small', // Cheaper and faster than text-embedding-3-large
        input: text,
      });
      
      return response.data[0].embedding;
    } catch (error) {
      console.error('❌ Error generating embedding:', error);
      throw error;
    }
  }

  // Create a searchable text representation of the recommendation
  private createSearchableText(record: RecommendationRecord): string {
    const parts = [
      `User prompt: ${record.userPrompt}`,
      record.userOptions.genre ? `Genre: ${record.userOptions.genre}` : '',
      record.userOptions.subgenre ? `Subgenre: ${record.userOptions.subgenre}` : '',
      record.userOptions.mood ? `Mood: ${record.userOptions.mood}` : '',
      record.userOptions.era ? `Era: ${record.userOptions.era}` : '',
      record.userOptions.activity ? `Activity: ${record.userOptions.activity}` : '',
      record.userOptions.bpm ? `BPM: ${record.userOptions.bpm}` : '',
      record.userOptions.timeOfDay ? `Time: ${record.userOptions.timeOfDay}` : '',
      record.userOptions.weather ? `Weather: ${record.userOptions.weather}` : '',
      `AI Response: ${record.aiResponse}`,
      `Songs: ${record.songs.join(', ')}`
    ].filter(part => part.length > 0);

    return parts.join(' | ');
  }

  // Store a recommendation in the vector database
  async storeRecommendation(record: RecommendationRecord): Promise<void> {
    try {
      await this.initialize();

      // Create searchable text for embedding
      const searchableText = this.createSearchableText(record);
      
      // Generate embedding
      const embedding = await this.generateEmbedding(searchableText);
      
      // Store in vector database
      await this.index.insertItem({
        vector: embedding,
        metadata: {
          id: record.id,
          userId: record.userId,
          timestamp: record.timestamp,
          userPrompt: record.userPrompt,
          userOptions: JSON.stringify(record.userOptions),
          aiResponse: record.aiResponse,
          songs: JSON.stringify(record.songs),
          playlistId: record.playlistId || '',
          feedback: record.feedback ? JSON.stringify(record.feedback) : '',
          searchableText: searchableText
        }
      });

      console.log(`✅ Stored recommendation ${record.id} in vector database`);
    } catch (error) {
      console.error('❌ Error storing recommendation:', error);
      throw error;
    }
  }

  // Find similar recommendations based on user query and options
  async findSimilarRecommendations(
    userPrompt: string,
    userOptions: RecommendationRecord['userOptions'],
    userId?: string,
    limit: number = 5
  ): Promise<RecommendationRecord[]> {
    try {
      await this.initialize();

      // Create query text similar to how we store recommendations
      const queryParts = [
        `User prompt: ${userPrompt}`,
        userOptions.genre ? `Genre: ${userOptions.genre}` : '',
        userOptions.subgenre ? `Subgenre: ${userOptions.subgenre}` : '',
        userOptions.mood ? `Mood: ${userOptions.mood}` : '',
        userOptions.era ? `Era: ${userOptions.era}` : '',
        userOptions.activity ? `Activity: ${userOptions.activity}` : '',
        userOptions.bpm ? `BPM: ${userOptions.bpm}` : '',
        userOptions.timeOfDay ? `Time: ${userOptions.timeOfDay}` : '',
        userOptions.weather ? `Weather: ${userOptions.weather}` : ''
      ].filter(part => part.length > 0);

      const queryText = queryParts.join(' | ');
      
      // Generate embedding for the query
      const queryEmbedding = await this.generateEmbedding(queryText);
      
      // Search for similar recommendations
      const results = await this.index.queryItems(queryEmbedding, "", limit * 2); // Get more to filter
      
      // Convert results back to RecommendationRecord format
      const recommendations: RecommendationRecord[] = [];
      
      for (const result of results) {
        try {
          const playlistId = result.item.metadata.playlistId as string;
          const recommendation: RecommendationRecord = {
            id: result.item.metadata.id as string,
            userId: result.item.metadata.userId as string,
            timestamp: result.item.metadata.timestamp as string,
            userPrompt: result.item.metadata.userPrompt as string,
            userOptions: JSON.parse(result.item.metadata.userOptions as string),
            aiResponse: result.item.metadata.aiResponse as string,
            songs: JSON.parse(result.item.metadata.songs as string),
            playlistId: playlistId && playlistId !== '' ? playlistId : undefined,
            feedback: result.item.metadata.feedback && result.item.metadata.feedback !== '' 
              ? JSON.parse(result.item.metadata.feedback as string) 
              : undefined
          };
          recommendations.push(recommendation);
        } catch (error) {
          console.error('❌ Error parsing recommendation record:', error);
          // Skip invalid records
          continue;
        }
      }

      // Filter by user if specified, and limit results
      let filteredRecommendations: RecommendationRecord[];
      if (userId) {
        filteredRecommendations = [];
        for (const rec of recommendations) {
          if (rec.userId === userId) {
            filteredRecommendations.push(rec);
          }
        }
        filteredRecommendations = filteredRecommendations.slice(0, limit);
      } else {
        filteredRecommendations = recommendations.slice(0, limit);
      }

      console.log(`✅ Found ${filteredRecommendations.length} similar recommendations`);
      return filteredRecommendations;
    } catch (error) {
      console.error('❌ Error finding similar recommendations:', error);
      return [];
    }
  }

  // Get user's recommendation history
  async getUserRecommendationHistory(userId: string, limit: number = 10): Promise<RecommendationRecord[]> {
    try {
      await this.initialize();

      // This is a simple approach - in a real implementation you might want to use metadata filtering
      const allResults = await this.index.queryItems(await this.generateEmbedding("music recommendation"), "", 100);
      
      // Convert results and filter by user in one step
      const userRecommendations: RecommendationRecord[] = [];
      
      for (const result of allResults) {
        try {
          if (result.item.metadata.userId === userId) {
            const playlistId = result.item.metadata.playlistId as string;
            const recommendation: RecommendationRecord = {
              id: result.item.metadata.id as string,
              userId: result.item.metadata.userId as string,
              timestamp: result.item.metadata.timestamp as string,
              userPrompt: result.item.metadata.userPrompt as string,
              userOptions: JSON.parse(result.item.metadata.userOptions as string),
              aiResponse: result.item.metadata.aiResponse as string,
              songs: JSON.parse(result.item.metadata.songs as string),
              playlistId: playlistId && playlistId !== '' ? playlistId : undefined,
              feedback: result.item.metadata.feedback && result.item.metadata.feedback !== ''
                ? JSON.parse(result.item.metadata.feedback as string) 
                : undefined
            };
            userRecommendations.push(recommendation);
          }
        } catch (error) {
          // Skip invalid records
          continue;
        }
      }
      
      // Sort and limit
      userRecommendations.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      const limitedRecommendations = userRecommendations.slice(0, limit);

      console.log(`✅ Retrieved ${limitedRecommendations.length} recommendations for user ${userId}`);
      return limitedRecommendations;
    } catch (error) {
      console.error('❌ Error getting user recommendation history:', error);
      return [];
    }
  }

  // Add feedback to a recommendation
  async addFeedback(
    recommendationId: string, 
    feedback: RecommendationRecord['feedback']
  ): Promise<void> {
    try {
      await this.initialize();

      // This is a limitation of Vectra - we can't easily update items
      // In a production system, you'd want to use a database that supports updates
      // For now, we'll store feedback separately or rebuild the record
      
      console.log(`ℹ️ Feedback noted for recommendation ${recommendationId}:`, feedback);
      // TODO: Implement feedback storage mechanism
    } catch (error) {
      console.error('❌ Error adding feedback:', error);
      throw error;
    }
  }

  // Get database statistics
  async getStats(): Promise<{
    totalRecommendations: number;
    dbPath: string;
    isInitialized: boolean;
  }> {
    try {
      await this.initialize();
      
      // Get approximate count (Vectra doesn't have a direct count method)
      const countQuery = await this.generateEmbedding("count");
      const results = await this.index.queryItems(countQuery, "", 1000);
      
      return {
        totalRecommendations: results.length,
        dbPath: this.dbPath,
        isInitialized: this.isInitialized
      };
    } catch (error) {
      console.error('❌ Error getting database stats:', error);
      return {
        totalRecommendations: 0,
        dbPath: this.dbPath,
        isInitialized: this.isInitialized
      };
    }
  }
}

// Export singleton instance
export const musicVectorDB = new MusicRecommendationVectorDB();

// Export types for use in other files
export type { RecommendationRecord };