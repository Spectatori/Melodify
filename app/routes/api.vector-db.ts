import { json, type ActionFunction, type LoaderFunction } from "@remix-run/node";
import { sessionStorage } from "~/services/session.server";
import { musicVectorDB, RecommendationRecord } from "~/vector/vector-db-server";


// GET /api/vector-db - Get database stats and user history
export const loader: LoaderFunction = async ({ request }) => {
  try {
    const session = await sessionStorage.getSession(request.headers.get('Cookie'));
    const user = session.get('user');
    
    if (!user) {
      return json({ error: 'Not authenticated' }, { status: 401 });
    }

    const url = new URL(request.url);
    const action = url.searchParams.get('action');

    switch (action) {
      case 'stats':
        const stats = await musicVectorDB.getStats();
        return json({ success: true, stats });

      case 'history':
        const limit = parseInt(url.searchParams.get('limit') || '10');
        const history = await musicVectorDB.getUserRecommendationHistory(user.id, limit);
        return json({ success: true, history });

      case 'similar':
        const prompt = url.searchParams.get('prompt') || '';
        const genre = url.searchParams.get('genre');
        const mood = url.searchParams.get('mood');
        const era = url.searchParams.get('era');
        const searchLimit = parseInt(url.searchParams.get('limit') || '5');
        
        const userOptions = {
          genre: genre || undefined,
          mood: mood || undefined,
          era: era || undefined
        };
        
        const similar = await musicVectorDB.findSimilarRecommendations(
          prompt, 
          userOptions, 
          user.id, 
          searchLimit
        );
        
        return json({ success: true, similar });

      default:
        return json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Vector DB API error:', error);
    return json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
};

// POST /api/vector-db - Add feedback to recommendations
export const action: ActionFunction = async ({ request }) => {
  try {
    const session = await sessionStorage.getSession(request.headers.get('Cookie'));
    const user = session.get('user');
    
    if (!user) {
      return json({ error: 'Not authenticated' }, { status: 401 });
    }

    const formData = await request.formData();
    const actionType = formData.get('actionType')?.toString();

    switch (actionType) {
      case 'addFeedback':
        const recommendationId = formData.get('recommendationId')?.toString();
        const liked = formData.get('liked')?.toString() === 'true';
        const rating = formData.get('rating')?.toString();
        const notes = formData.get('notes')?.toString();

        if (!recommendationId) {
          return json({ error: 'Missing recommendation ID' }, { status: 400 });
        }

        const feedback = {
          liked,
          rating: rating ? parseInt(rating) : undefined,
          notes: notes || undefined
        };

        await musicVectorDB.addFeedback(recommendationId, feedback);
        
        return json({ 
          success: true, 
          message: 'Feedback added successfully' 
        });

      case 'testStorage':
        // Test storing a sample recommendation
        const testRecord: RecommendationRecord = {
          id: `test-${user.id}-${Date.now()}`,
          userId: user.id,
          timestamp: new Date().toISOString(),
          userPrompt: "Test recommendation for debugging",
          userOptions: {
            genre: "Rock",
            mood: "Energetic"
          },
          aiResponse: "Here are some test recommendations",
          songs: [
            '1. "Test Song 1" by Test Artist 1',
            '2. "Test Song 2" by Test Artist 2',
            '3. "Test Song 3" by Test Artist 3'
          ]
        };

        await musicVectorDB.storeRecommendation(testRecord);
        
        return json({ 
          success: true, 
          message: 'Test recommendation stored',
          testRecord 
        });

      default:
        return json({ error: 'Invalid action type' }, { status: 400 });
    }
  } catch (error) {
    console.error('Vector DB API action error:', error);
    return json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
};