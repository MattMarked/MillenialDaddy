#!/usr/bin/env node

// Manual test script for content processing system
const { ContentExtractorFactory } = require('./src/lib/content-extractors');
const { AIContentAnalyzer } = require('./src/lib/ai-content-analyzer');

async function testContentExtraction() {
  console.log('🧪 Testing Content Extraction System\n');

  // Test URL detection
  console.log('1. Testing URL Platform Detection:');
  const testUrls = [
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://www.instagram.com/reel/ABC123/',
    'https://www.tiktok.com/@user/video/1234567890',
    'https://invalid-url.com/video'
  ];

  testUrls.forEach(url => {
    const platform = ContentExtractorFactory.detectPlatform(url);
    console.log(`  ${url} → ${platform || 'Unknown'}`);
  });

  // Test URL validation
  console.log('\n2. Testing URL Validation:');
  console.log(`  YouTube URL valid: ${ContentExtractorFactory.validateUrl(testUrls[0], 'youtube')}`);
  console.log(`  Instagram URL valid: ${ContentExtractorFactory.validateUrl(testUrls[1], 'instagram')}`);
  console.log(`  TikTok URL valid: ${ContentExtractorFactory.validateUrl(testUrls[2], 'tiktok')}`);

  // Test video ID extraction
  console.log('\n3. Testing Video ID Extraction:');
  console.log(`  YouTube ID: ${ContentExtractorFactory.extractVideoId(testUrls[0], 'youtube')}`);
  console.log(`  Instagram ID: ${ContentExtractorFactory.extractVideoId(testUrls[1], 'instagram')}`);
  console.log(`  TikTok ID: ${ContentExtractorFactory.extractVideoId(testUrls[2], 'tiktok')}`);

  // Test AI Content Analysis (with mock data)
  console.log('\n4. Testing AI Content Analysis:');
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

  try {
    const analyzer = new AIContentAnalyzer();
    const analysis = await analyzer.analyzeContent(mockMetadata);
    console.log('  AI Analysis Result:');
    console.log(`    Description: ${analysis.description}`);
    console.log(`    Hashtags: ${analysis.hashtags.join(', ')}`);
    console.log(`    Citation: ${analysis.citation}`);
  } catch (error) {
    console.log(`  AI Analysis failed (expected without API key): ${error.message}`);
    console.log('  This is normal if you haven\'t set up OpenAI API key');
  }

  console.log('\n✅ Content extraction system test completed!');
}

// Run the test
testContentExtraction().catch(console.error);