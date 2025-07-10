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

### Vercel (Recommended)

1. Connect your repository to Vercel
2. Configure environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

### AWS Alternative

See deployment documentation for AWS Lambda setup instructions.

## Contributing

1. Follow the existing code style and conventions
2. Write tests for new functionality
3. Update documentation as needed
4. Submit pull requests for review

## License

This project is private and proprietary.
