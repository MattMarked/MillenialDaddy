#!/bin/bash

# Vercel Deployment Script for Video Link Queue Service
set -e

echo "🚀 Starting Vercel deployment process..."

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI not found. Installing..."
    npm install -g vercel
fi

# Run pre-deployment checks
echo "🔍 Running pre-deployment checks..."

# Type checking
echo "📝 Running TypeScript type check..."
npm run type-check

# Linting
echo "🔧 Running ESLint..."
npm run lint

# Code formatting check
echo "💅 Checking code formatting..."
npm run format:check

# Run tests
echo "🧪 Running test suite..."
npm run test

# Build the project locally to catch any build issues
echo "🏗️ Building project locally..."
npm run build

echo "✅ All pre-deployment checks passed!"

# Deploy to Vercel
echo "🚀 Deploying to Vercel..."

if [ "$1" = "production" ]; then
    echo "📦 Deploying to production..."
    vercel --prod
else
    echo "🔧 Deploying to preview..."
    vercel
fi

echo "✅ Deployment completed successfully!"
echo "📋 Next steps:"
echo "1. Verify environment variables are set in Vercel dashboard"
echo "2. Test the deployed application"
echo "3. Monitor logs for any issues"