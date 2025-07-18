# Millennial Daddy Active Context

## Current Focus
- Project initialization and memory bank setup
- Defining core architecture and workflows
- Planning API integration strategy

## Recent Changes
- Created memory bank structure
- Defined project requirements and constraints
- Established system architecture patterns
- Updated to daily posting schedule at 12:00 PM UTC

## Next Steps
- Set up Next.js project structure
- Configure Vercel deployment
- Implement Instagram webhook handler
- Create content queue with Vercel KV
- Integrate OpenAI for description generation
- Build scheduled posting service

## Active Decisions

### Admin Management
- Using hardcoded list of Instagram usernames for admin authentication
- Stored in environment variables for easy updates
- No admin UI required for initial version

### API Integration
- Need to verify Meta Business App permissions
- Will use Instagram Graph API for DM reception and content posting
- OpenAI API integration for description generation

### Posting Strategy
- Daily posting at 12:00 PM UTC via Vercel cron
- FIFO queue for content processing
- No content filtering in initial version
- Optimized for Vercel free tier limits

## Current Challenges
- Verifying Instagram API permissions and webhook setup
- Optimizing for Vercel free tier limitations
- Ensuring reliable DM reception and processing

## Implementation Priorities
1. Webhook handler for DM reception
2. Admin validation system
3. Content queue management
4. OpenAI integration for descriptions
5. Scheduled posting service

## Learning Resources
- Instagram Graph API documentation
- Vercel KV documentation
- OpenAI API documentation
- Next.js serverless functions
- Vercel Cron Jobs
