// Usage: npm run init-vector-db

import path from 'path';
import fs from 'fs';
import { musicVectorDB } from '~/vector/vector-db-server';


interface InitializationData {
  initialized: boolean;
  createdAt: string;
  version: string;
  note: string;
}

async function initializeVectorDatabase(): Promise<void> {
  console.log('🚀 Initializing Vector Database for Remix TypeScript Project...');
  
  try {
    // Create database directory if it doesn't exist
    const dbPath = path.join(process.cwd(), 'data', 'vector-db');
    
    console.log(`📁 Creating database directory: ${dbPath}`);
    
    if (!fs.existsSync(dbPath)) {
      fs.mkdirSync(dbPath, { recursive: true });
      console.log('✅ Created vector database directory');
    } else {
      console.log('✅ Vector database directory already exists');
    }
    
    // Initialize the vector database (this creates the Vectra index)
    await musicVectorDB.initialize();
    console.log('✅ Vector database initialized successfully');
    
    // Create a TypeScript-compatible initialization marker file
    const initFile = path.join(dbPath, '.initialized');
    const initData: InitializationData = {
      initialized: true,
      createdAt: new Date().toISOString(),
      version: '1.0.0',
      note: 'Vector database directory for Remix TypeScript music recommendation app'
    };
    
    fs.writeFileSync(initFile, JSON.stringify(initData, null, 2));
    console.log('✅ Created initialization marker file');
    
    console.log('\n✅ Vector Database Initialization Complete!');
    console.log('📊 Database Info:');
    console.log(`   - Database Path: ${dbPath}`);
    console.log(`   - Status: Ready for recommendations`);
    console.log(`   - Created: ${initData.createdAt}`);
    console.log(`   - TypeScript Compatible: Yes`);
    
    console.log('\n🎵 Your music recommendation vector database is ready!');
    console.log('💡 The database will store AI recommendations and help avoid duplicates.');
    
  } catch (error) {
    console.error('❌ Error setting up vector database directory:', error);
    console.error('\n💡 Common issues:');
    console.error('   - Make sure you have write permissions');
    console.error('   - Ensure you\'re running from the Remix project root');
    console.error('   - Check that OpenAI API key is valid (if needed)');
    process.exit(1);
  }
}

// Run the initialization with proper TypeScript error handling
initializeVectorDatabase()
  .then(() => {
    console.log('\n🎉 Initialization completed successfully!');
    process.exit(0);
  })
  .catch((error: Error) => {
    console.error('💥 Setup failed:', error.message);
    console.error('\nFor Remix TypeScript projects, ensure:');
    console.error('   - All dependencies are installed');
    console.error('   - TypeScript is properly configured');
    console.error('   - Environment variables are set correctly');
    process.exit(1);
  });