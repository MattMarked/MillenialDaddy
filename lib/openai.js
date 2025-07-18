/**
 * OpenAI integration utilities for MillenialDaddy
 * 
 * This module handles interaction with OpenAI API for generating
 * engaging descriptions for Instagram reels.
 */

import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Generate an engaging description for an Instagram reel
 * @param {Object} content - Content metadata
 * @param {string} content.reelUrl - URL of the Instagram reel
 * @param {string} [content.context] - Additional context about the reel
 * @returns {Promise<string>} - Generated description
 */
export async function generateDescription(content) {
  if (!process.env.ENABLE_AI_DESCRIPTIONS) {
    return 'Check out this awesome reel! 🎬 #reels #instagram';
  }

  try {
    const prompt = createPrompt(content);
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: `You are a social media expert who writes engaging, authentic Instagram captions. 
                   Your captions are concise, use appropriate emojis, and include relevant hashtags. 
                   Keep the tone casual and relatable, perfect for millennial parents.`
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 150,
      temperature: 0.7
    });

    return completion.choices[0].message.content.trim();
  } catch (error) {
    console.error('Error generating description:', error);
    return createFallbackDescription();
  }
}

/**
 * Create a prompt for the OpenAI API
 * @param {Object} content - Content metadata
 * @returns {string} - Formatted prompt
 */
function createPrompt(content) {
  return `Write an engaging Instagram caption for a reel.
          The caption should:
          - Be under 100 characters
          - Include 2-3 relevant emojis
          - Include 3-5 relevant hashtags
          - Have a casual, relatable tone
          - End with a call to action

          Additional context about the reel:
          ${content.context || 'This is a curated reel worth sharing'}

          Format the response as a single paragraph with hashtags at the end.`;
}

/**
 * Create a fallback description when AI generation fails
 * @returns {string} - Fallback description
 */
function createFallbackDescription() {
  const templates = [
    '✨ Had to share this amazing reel! #reels #instagram #trending',
    '🎬 Check this out! You\'ll love it! #reels #viral #mustwatch',
    '🔥 This reel is everything! #instagram #reels #viral'
  ];
  
  return templates[Math.floor(Math.random() * templates.length)];
}

/**
 * Validate OpenAI configuration
 * @returns {Promise<boolean>} - True if configuration is valid
 */
export async function validateOpenAIConfig() {
  if (!process.env.OPENAI_API_KEY) return false;
  
  try {
    const models = await openai.models.list();
    return models.data.some(model => model.id === 'gpt-4');
  } catch (error) {
    console.error('OpenAI validation error:', error);
    return false;
  }
}
