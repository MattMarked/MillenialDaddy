#!/bin/bash

# Script to set up Vercel environment variables
set -e

echo "🔧 Setting up Vercel environment variables..."

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI not found. Please install it first:"
    echo "npm install -g vercel"
    exit 1
fi

# Function to set environment variable
set_env_var() {
    local key=$1
    local description=$2
    local is_secret=${3:-true}
    
    echo "Setting $key..."
    if [ "$is_secret" = "true" ]; then
        read -s -p "Enter $description: " value
        echo
    else
        read -p "Enter $description: " value
    fi
    
    if [ -n "$value" ]; then
        vercel env add "$key" production <<< "$value"
        vercel env add "$key" preview <<< "$value"
        vercel env add "$key" development <<< "$value"
        echo "✅ $key set successfully"
    else
        echo "⚠️  Skipping $key (empty value)"
    fi
    echo
}

echo "📝 This script will help you set up environment variables for your Vercel deployment."
echo "Press Enter to skip any variable you don't want to set now."
echo

# Database Configuration
echo "🗄️  Database Configuration"
set_env_var "POSTGRES_URL" "PostgreSQL connection URL" true
set_env_var "POSTGRES_PRISMA_URL" "PostgreSQL Prisma URL (with connection pooling)" true
set_env_var "POSTGRES_URL_NON_POOLING" "PostgreSQL URL without pooling" true

# Redis Configuration
echo "🔴 Redis Configuration"
set_env_var "REDIS_URL" "Redis connection URL" true

# Instagram API Configuration
echo "📸 Instagram API Configuration"
set_env_var "INSTAGRAM_ACCESS_TOKEN" "Instagram access token" true
set_env_var "INSTAGRAM_ACCOUNT_ID" "Instagram account ID" false

# YouTube API Configuration
echo "📺 YouTube API Configuration"
set_env_var "YOUTUBE_API_KEY" "YouTube Data API key" true

# TikTok API Configuration
echo "🎵 TikTok API Configuration"
set_env_var "TIKTOK_CLIENT_KEY" "TikTok client key" true
set_env_var "TIKTOK_CLIENT_SECRET" "TikTok client secret" true

# OpenAI API Configuration
echo "🤖 OpenAI API Configuration"
set_env_var "OPENAI_API_KEY" "OpenAI API key" true

# Application Configuration
echo "⚙️  Application Configuration"
set_env_var "NEXTAUTH_SECRET" "NextAuth secret (random string)" true
set_env_var "NEXTAUTH_URL" "Application URL (e.g., https://your-app.vercel.app)" false
set_env_var "ADMIN_EMAILS" "Comma-separated list of admin emails" false

echo "✅ Environment variable setup completed!"
echo "📋 Next steps:"
echo "1. Verify all variables are set in your Vercel dashboard"
echo "2. Deploy your application using: ./scripts/deploy.sh"
echo "3. Test the deployed application functionality"