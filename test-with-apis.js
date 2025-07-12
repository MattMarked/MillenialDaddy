#!/usr/bin/env node

// Test script with real API calls (requires API keys)
require('dotenv').config();
const { ContentExtractorFactory } = require('./src/lib/content-extractors');
const { AIContentAnalyzer } = require('./src/lib/ai-content-analyzer');

async function testWithRealAPIs() {
  console.log('🔑 Testing with Real APIs (requires API keys)\n');

  // Check if API keys are available
  const hasYouTubeKey = !!process.env.YOUTUBE_API_KEY;
  const hasOpenAIKey = !!process.env.OPENAI_API_KEY;
  const hasInstagramToken = !!process.env.INSTAGRAM_ACCESS_TOKEN;

  console.log('API Keys Status:');
  console.log(`  YouTube API Key: ${hasYouTubeKey ? '✅ Available' : '❌ Missing'}`);
  console.log(`  OpenAI API Key: ${hasOpenAIKey ? '✅ Available' : '❌ Missing'}`);
  console.log(`  Instagram Token: ${hasInstagramToken ? '✅ Available' : '❌ Missing'}`);

  // Test YouTube extraction (if API key is available)
  if (hasYouTubeKey) {
    console.log('\n🎥 Testing YouTube Extraction:');
    try {
      const metadata = await ContentExtractorFactory.extractMetadata(
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ', // Rick Roll - safe test video
        'youtube'
      );
      console.log('  ✅ YouTube extraction successful:');
      console.log(`    Title: ${metadata.title}`);
      console.log(`    Author: ${metadata.author}`);
      console.log(`    Duration: ${metadata.duration} seconds`);
      console.log(`    Views: ${metadata.viewCount}`);
    } catch (error) {
      console.log(`  ❌ YouTube extraction failed: ${error.message}`);
    }
  }

  // Test AI analysis (if OpenAI key is available)
  if (hasOpenAIKey) {
    console.log('\n🤖 Testing AI Content Analysis:');
    try {
      const mockMetadata = {
        title: 'Amazing Cooking Tutorial',
        description: 'Learn how to make delicious pasta in 10 minutes',
        thumbnailUrl: 'https://example.com/thumb.jpg',
        duration: 600,
        author: 'ChefMaster',
        publishedAt: new Date('2023-01-01'),
        viewCount: 10000,
        platform: 'youtube',
        videoId: 'abc123',
      };

      const analyzer = new AIContentAnalyzer();
      const analysis = await analyzer.analyzeContent(mockMetadata);
      console.log('  ✅ AI analysis successful:');
      console.log(`    Description: ${analysis.description}`);
      console.log(`    Hashtags: ${analysis.hashtags.join(', ')}`);
      console.log(`    Citation: ${analysis.citation}`);
    } catch (error) {
      console.log(`  ❌ AI analysis failed: ${error.message}`);
    }
  }

  if (!hasYouTubeKey && !hasOpenAIKey) {
    console.log('\n💡 To test with real APIs, add these to your .env.local file:');
    console.log('   YOUTUBE_API_KEY=your_youtube_api_key');
    console.log('   OPENAI_API_KEY=your_openai_api_key');
    console.log('   INSTAGRAM_ACCESS_TOKEN=your_instagram_token');
  }

  console.log('\n✅ API testing completed!');
}

testWithRealAPIs().catch(console.error);