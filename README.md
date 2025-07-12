# Millenial Daddy - Video Link Queue Service

An automated content curation and publishing system that allows administrators to submit social media video links (Instagram Reels, YouTube videos, TikTok videos) to a processing queue. The service automatically processes these links to generate enriched content with descriptions, tags, and citations, then publishes them to Instagram on a configurable schedule.

## Features

- **Multi-platform Support**: Instagram Reels, YouTube videos, and TikTok videos
- **Automated Processing**: AI-powered content analysis and enrichment
- **Scheduled Publishing**: Configurable publication frequency to Instagram
- **Admin Management**: Dynamic admin user management
- **Queue-based Architecture**: Reliable processing with Redis queues
- **Serverless Deployment**: Optimized for Vercel free tier and AWS

## Getting Started

### Prerequisites

- Node.js 18+
- Redis server
- PostgreSQL database
- API keys for Instagram, YouTube, TikTok, and OpenAI

### Installation

1. Clone the repository
2. Install dependencies:

   ```bash
   npm install
   ```

3. Copy environment variables:

   ```bash
   cp .env.local.example .env.local
   ```

4. Configure your environment variables in `.env.local`

5. Run the development server:
   ```bash
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## Development

### Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier
- `npm run test` - Run tests
- `npm run type-check` - Run TypeScript type checking

### Project Structure

```
src/
├── app/                 # Next.js App Router
│   ├── api/            # API routes
│   ├── globals.css     # Global styles
│   ├── layout.tsx      # Root layout
│   └── page.tsx        # Home page
├── components/         # React components
├── lib/               # Core utilities and configurations
├── types/             # TypeScript type definitions
└── utils/             # Utility functions
```

## Deployment

### Quick Start Deployment

1. **Set up environment variables**:

   ```bash
   npm run setup:vercel
   ```

2. **Deploy to Vercel**:

   ```bash
   npm run deploy:prod
   ```

3. **Verify deployment**:
   ```bash
   ./scripts/verify-deployment.sh https://your-app.vercel.app
   ```

### Detailed Deployment Guide

See [docs/deployment.md](docs/deployment.md) for comprehensive deployment instructions including:

- Vercel configuration and setup
- Environment variable management
- Database and Redis setup
- CI/CD pipeline configuration
- Monitoring and troubleshooting

### Deployment Scripts

- `npm run deploy` - Deploy preview to Vercel
- `npm run deploy:prod` - Deploy to production
- `npm run setup:vercel` - Interactive environment setup
- `npm run pre-deploy` - Run all pre-deployment checks

### Environment Requirements

#### Database

- PostgreSQL database (Vercel Postgres recommended)
- Redis instance (Upstash Redis recommended)

#### API Keys

- Instagram Graph API access token
- YouTube Data API v3 key
- TikTok API credentials
- OpenAI API key

#### Hosting

- **Vercel** (recommended): Optimized for free tier
- **AWS**: Lambda + RDS/DynamoDB alternative

### Monitoring

After deployment, monitor your application:

- Health check: `https://your-app.vercel.app/api/health`
- Metrics: `https://your-app.vercel.app/api/monitoring/metrics`
- Admin dashboard: `https://your-app.vercel.app/`

## Contributing

1. Follow the existing code style and conventions
2. Write tests for new functionality
3. Update documentation as needed
4. Submit pull requests for review

## License

This project is private and proprietary.
