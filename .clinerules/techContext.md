# MillenialDaddy Technical Context

## Technology Stack

### Core Platform
- **Hosting**: Vercel (Free Tier)
- **Runtime**: Node.js
- **Framework**: Next.js (Vercel-optimized)
- **API**: Next.js API Routes / Edge Functions

### Data Storage
- **Queue Storage**: Vercel KV (Redis-compatible)
- **State Management**: Vercel KV
- **Configuration**: Environment Variables

### External APIs
- **Instagram Graph API**: For DM reception and content posting
- **OpenAI API**: For generating content descriptions

## Development Setup

### Local Environment
- Node.js development environment
- Vercel CLI for local testing
- Environment variables for API keys and configuration

### Deployment Pipeline
- GitHub repository connected to Vercel
- Automatic deployments on push to main branch
- Environment variables configured in Vercel dashboard

## Technical Constraints

### Vercel Free Tier Limitations
- Limited serverless function execution time
- Limited KV storage capacity
- Limited cron job frequency

### Instagram API Constraints
- Rate limits for posting content
- Webhook verification requirements
- Authentication token expiration/refresh

### OpenAI API Considerations
- Token usage optimization
- Cost management for description generation
- Response time handling

## Integration Points

### Instagram Graph API Integration
- Webhook setup for DM notifications
- Authentication flow for posting permissions
- Content posting endpoints

### OpenAI API Integration
- Prompt engineering for description generation
- Context optimization for relevant descriptions
- Error handling for API failures

## Configuration Management

### Environment Variables
- `POSTING_INTERVAL_MINUTES`: Configurable posting schedule
- `ADMIN_USERNAMES`: Comma-separated list of authorized Instagram usernames
- `INSTAGRAM_ACCESS_TOKEN`: Authentication token for Instagram API
- `OPENAI_API_KEY`: Authentication key for OpenAI API

### Feature Flags
- `ENABLE_AUTO_POSTING`: Toggle for automatic posting feature
- `ENABLE_AI_DESCRIPTIONS`: Toggle for AI description generation

## Monitoring & Maintenance

### Logging
- Vercel built-in logging
- Error tracking for API failures
- Queue status monitoring

### Performance Metrics
- API response times
- Queue processing times
- Posting success rate

## Security Considerations

### API Key Management
- Secure storage in Vercel environment
- Minimal permission scopes
- Regular rotation policy

### Input Validation
- URL validation for submitted reels
- Admin username validation
- Content type verification
