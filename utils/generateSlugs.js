const mongoose = require('mongoose');
const Blog = require('../models/blog');
const KnowledgeBase = require('../models/knowledgebase');

// Load environment variables
require('dotenv').config();

const generateSlugsForAllModels = async () => {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });

        console.log('Connected to MongoDB');
        console.log('Starting slug generation for existing data...\n');

        // Generate slugs for blogs
        console.log('🔍 Checking blogs...');
        const blogCount = await Blog.generateSlugsForExisting();
        console.log(`✅ Processed ${blogCount} blogs\n`);

        // Generate slugs for knowledge base articles
        console.log('🔍 Checking knowledge base articles...');
        const kbCount = await KnowledgeBase.generateSlugsForExisting();
        console.log(`✅ Processed ${kbCount} knowledge base articles\n`);

        console.log('🎉 Slug generation completed successfully!');
        console.log(`Total processed: ${blogCount + kbCount} documents`);

    } catch (error) {
        console.error('❌ Error during slug generation:', error);
    } finally {
        // Close the database connection
        await mongoose.connection.close();
        console.log('Database connection closed');
        process.exit(0);
    }
};

// Add a command line option to run the script
if (require.main === module) {
    generateSlugsForAllModels();
}

module.exports = generateSlugsForAllModels;
