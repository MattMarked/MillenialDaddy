# Millennial Daddy Project Brief

## Project Overview
Millennial Daddy is an Instagram automation tool designed to simplify content curation and reposting. It enables a small team of admins to share reels via DM, which are then automatically processed, enhanced with AI-generated descriptions, and reposted to the main Millennial Daddy Instagram account on a configurable schedule.

## Core Functionality
- **DM Collection**: Admins send reels to the Millennial Daddy Instagram account via direct messages
- **Content Queue**: Received reels are stored in a processing queue
- **AI Description**: OpenAI API generates engaging descriptions for each reel
- **Scheduled Posting**: Content is automatically posted at configurable intervals

## Key Requirements
- **Admin Management**: Hardcoded list of authorized Instagram usernames (< 5 users)
- **Deployment**: Vercel-hosted web service utilizing free tier features
- **API Integration**: Meta Business API and OpenAI API
- **Posting Schedule**: Configurable posting interval via environment variables

## Technical Constraints
- Must utilize Vercel's free tier capabilities
- Must integrate with existing Meta Business App (permissions to be verified)
- Must operate autonomously after initial setup

## Success Criteria
- Admins can easily submit content for reposting via Instagram DMs
- Content is automatically enhanced with AI-generated descriptions
- Reels are posted on a consistent, configurable schedule
- System operates with minimal manual intervention
