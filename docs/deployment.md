# Deployment Guide

## Vercel Deployment

This guide covers deploying the Video Link Queue Service to Vercel's platform.

### Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **Vercel CLI**: Install globally with `npm install -g vercel`
3. **Database**: Set up a PostgreSQL database (recommended: Vercel Postgres or Neon)
4. **Redis**: Set up a Redis instance (recommended: Upstash Redis)
5. **API Keys**: Obtain required API keys for Instagram, YouTube, TikTok, and OpenAI

### Step 1: Initial Setup

1. Clone the repository and install dependencies:

```bash
git clone <repository-url>
cd video-link-queue
npm install
```

2. Run the setup script to configure environment variables:

```bash
./scripts/setup-vercel-env.sh
```

### Step 2: Database Setup

1. Create your PostgreSQL database
2. Run the migration script:

```bash
npm run db:migrate
```

3. Seed the database with initial data:

```bash
npm run db:seed
```

### Step 3: Environment Variables

Set the following environment variables in your Vercel dashboard or using the setup script:

#### Database Configuration

- `POSTGRES_URL`: Main PostgreSQL connection string
- `POSTGRES_PRISMA_URL`: PostgreSQL URL with connection pooling
- `POSTGRES_URL_NON_POOLING`: PostgreSQL URL without pooling

#### Redis Configuration

- `REDIS_URL`: Redis connection string

#### API Keys

- `INSTAGRAM_ACCESS_TOKEN`: Instagram Graph API access token
- `INSTAGRAM_ACCOUNT_ID`: Instagram account ID for posting
- `YOUTUBE_API_KEY`: YouTube Data API v3 key
- `TIKTOK_CLIENT_KEY`: TikTok API client key
- `TIKTOK_CLIENT_SECRET`: TikTok API client secret
- `OPENAI_API_KEY`: OpenAI API key for content analysis

#### Application Configuration

- `NEXTAUTH_SECRET`: Random secret for NextAuth (generate with `openssl rand -base64 32`)
- `NEXTAUTH_URL`: Your application URL (e.g., `https://your-app.vercel.app`)
- `ADMIN_EMAILS`: Comma-separated list of admin email addresses

### Step 4: Deploy

1. Run the deployment script:

```bash
# For preview deployment
./scripts/deploy.sh

# For production deployment
./scripts/deploy.sh production
```

2. Alternatively, deploy manually:

```bash
# Preview deployment
vercel

# Production deployment
vercel --prod
```

### Step 5: Post-Deployment Verification

1. **Health Check**: Visit `https://your-app.vercel.app/api/health` to verify the service is running
2. **Database Connection**: Check that the database is accessible
3. **Queue System**: Verify Redis connection is working
4. **Admin Access**: Test admin login and link submission
5. **Monitoring**: Check the monitoring dashboard at `/`

### Vercel-Specific Considerations

#### Function Limits

- **Execution Time**: 10 seconds maximum for Hobby plan
- **Memory**: 1024MB maximum
- **Payload Size**: 4.5MB maximum

#### Optimizations

- Content processing is optimized for Vercel's execution limits
- Database connections use connection pooling
- Redis operations are batched where possible

#### Cron Jobs

The application uses Vercel Cron Jobs for scheduled publishing:

- Default schedule: Daily at 9:00 AM UTC
- Configurable through the admin interface

### Monitoring and Logging

#### Vercel Dashboard

- Function logs are available in the Vercel dashboard
- Real-time function invocations and errors
- Performance metrics and analytics

#### Application Monitoring

- Health check endpoint: `/api/health`
- Metrics endpoint: `/api/monitoring/metrics`
- Queue status: Available in the admin dashboard

### Troubleshooting

#### Common Issues

1. **Function Timeout**
   - Check if content processing is taking too long
   - Verify external API response times
   - Consider breaking large operations into smaller chunks

2. **Database Connection Issues**
   - Verify connection strings are correct
   - Check if database is accessible from Vercel
   - Ensure connection pooling is properly configured

3. **Redis Connection Issues**
   - Verify Redis URL is correct
   - Check if Redis instance is accessible
   - Ensure Redis instance has sufficient memory

4. **API Rate Limits**
   - Monitor external API usage
   - Implement proper retry logic
   - Consider caching strategies

#### Debug Mode

Enable debug logging by setting `NODE_ENV=development` in environment variables.

### Scaling Considerations

#### Vercel Hobby Plan Limits

- 100GB bandwidth per month
- 100 serverless function invocations per day
- 1 concurrent build

#### Upgrading to Pro Plan

- Increased limits for bandwidth and function invocations
- Custom domains
- Advanced analytics
- Team collaboration features

### Security Best Practices

1. **Environment Variables**: Never commit API keys to version control
2. **HTTPS**: Always use HTTPS in production
3. **API Authentication**: Implement proper admin authentication
4. **Rate Limiting**: Monitor and limit API usage
5. **Input Validation**: Validate all user inputs

### Backup and Recovery

1. **Database Backups**: Set up automated database backups
2. **Configuration Backup**: Export environment variables regularly
3. **Code Backup**: Ensure code is backed up in version control
4. **Recovery Plan**: Document recovery procedures

### Support and Maintenance

1. **Monitoring**: Set up alerts for critical failures
2. **Updates**: Keep dependencies updated regularly
3. **Performance**: Monitor function execution times
4. **Costs**: Monitor Vercel usage to avoid overages

For additional support, refer to the [Vercel documentation](https://vercel.com/docs) or contact the development team.
