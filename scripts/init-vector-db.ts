import { musicVectorDB } from "../app/vector/vector-db-server";



async function initializeVectorDatabase() {
  console.log('🚀 Initializing Vector Database...');
  
  try {
    // Initialize the database
    await musicVectorDB.initialize();
    
    // Get stats to verify everything is working
    const stats = await musicVectorDB.getStats();
    
    console.log('✅ Vector Database Initialization Complete!');
    console.log('📊 Database Stats:');
    console.log(`   - Total Recommendations: ${stats.totalRecommendations}`);
    console.log(`   - Database Path: ${stats.dbPath}`);
    console.log(`   - Is Initialized: ${stats.isInitialized}`);
    
    console.log('\n🎵 Your music recommendation vector database is ready!');
    console.log('💡 The database will store AI recommendations and help avoid duplicates.');
    
  } catch (error) {
    console.error('❌ Error initializing vector database:', error);
    process.exit(1);
  }
}

// Run the initialization
initializeVectorDatabase()
  .then(() => {
    console.log('🎉 Initialization completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Initialization failed:', error);
    process.exit(1);
  });