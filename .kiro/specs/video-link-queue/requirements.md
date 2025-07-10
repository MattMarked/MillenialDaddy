# Requirements Document

## Introduction

The Video Link Queue Service is an automated content curation and publishing system that allows administrators to submit social media video links (Instagram Reels, YouTube videos, TikTok videos) to a processing queue. The service automatically processes these links to generate enriched content with descriptions, tags, and citations, then publishes them to Instagram on a configurable schedule. The system is designed to be hosted on Vercel's free tier or AWS with dynamic admin management and flexible publishing frequency controls.

## Requirements

### Requirement 1

**User Story:** As an admin, I want to submit video links from Instagram Reels, YouTube videos, and TikTok videos to the service, so that they can be processed and queued for publication.

#### Acceptance Criteria

1. WHEN an admin submits a valid Instagram Reel URL THEN the system SHALL accept and store the link in the input queue
2. WHEN an admin submits a valid YouTube video URL THEN the system SHALL accept and store the link in the input queue
3. WHEN an admin submits a valid TikTok video URL THEN the system SHALL accept and store the link in the input queue
4. WHEN an admin submits an invalid or unsupported URL THEN the system SHALL reject the submission and provide an error message
5. WHEN a non-admin user attempts to submit a link THEN the system SHALL deny access and return an authentication error

### Requirement 2

**User Story:** As a system administrator, I want to dynamically manage the list of admins who can submit links, so that I can control access to the service without code changes.

#### Acceptance Criteria

1. WHEN a system administrator adds a new admin THEN the new admin SHALL immediately have access to submit links
2. WHEN a system administrator removes an admin THEN the removed admin SHALL immediately lose access to submit links
3. WHEN a system administrator views the admin list THEN the system SHALL display all current admins with their access status
4. WHEN an admin list change is made THEN the system SHALL persist the changes across service restarts

### Requirement 3

**User Story:** As the service, I want to automatically process new video links when they arrive in the input queue, so that content can be enriched and prepared for publication.

#### Acceptance Criteria

1. WHEN a new link is added to the input queue THEN the system SHALL automatically trigger processing within 5 minutes
2. WHEN processing a video link THEN the system SHALL extract content information from the source platform
3. WHEN content is successfully extracted THEN the system SHALL generate a concise description (50-150 characters) of the video content
4. WHEN generating content THEN the system SHALL include proper citation of the original source
5. WHEN content is processed THEN the system SHALL generate 2-5 relevant hashtags based on the content
6. WHEN processing is complete THEN the system SHALL move the enriched content to the "readyToPublishQueue"
7. WHEN processing fails THEN the system SHALL log the error and optionally retry up to 3 times

### Requirement 4

**User Story:** As the service, I want to automatically publish content from the ready-to-publish queue according to a configurable schedule, so that content is posted consistently to Instagram.

#### Acceptance Criteria

1. WHEN the scheduled publication time arrives THEN the system SHALL select the oldest item from the readyToPublishQueue
2. WHEN publishing content THEN the system SHALL post to Instagram as both a story and a regular post
3. WHEN a post is successfully published THEN the system SHALL remove the item from the readyToPublishQueue
4. WHEN a post fails to publish THEN the system SHALL retry up to 3 times before marking as failed
5. WHEN the readyToPublishQueue is empty at publication time THEN the system SHALL skip the publication cycle and log the event

### Requirement 5

**User Story:** As a system administrator, I want to configure the publication frequency dynamically, so that I can adjust posting schedules without redeploying the service.

#### Acceptance Criteria

1. WHEN a system administrator sets daily publication THEN the system SHALL publish once per day at the specified time
2. WHEN a system administrator sets multiple daily publications THEN the system SHALL publish at each specified time interval
3. WHEN a system administrator sets publication every X days THEN the system SHALL publish once every X days at the specified time
4. WHEN publication frequency is changed THEN the system SHALL apply the new schedule immediately
5. WHEN no publication frequency is set THEN the system SHALL default to once daily at 9:00 AM

### Requirement 6

**User Story:** As a system administrator, I want the service to be hosted on Vercel's free tier or AWS, so that I can minimize hosting costs while maintaining reliability.

#### Acceptance Criteria

1. WHEN deployed on Vercel free tier THEN the system SHALL operate within Vercel's resource limitations (function timeout, memory, etc.)
2. WHEN deployed on AWS THEN the system SHALL use cost-effective services appropriate for the workload
3. WHEN the service is deployed THEN it SHALL maintain 99% uptime during normal operation
4. WHEN the service encounters platform limitations THEN it SHALL gracefully handle errors and continue operation
5. WHEN scaling is needed THEN the system SHALL support migration between Vercel and AWS hosting options

### Requirement 7

**User Story:** As a system administrator, I want to monitor the service's operation and queue status, so that I can ensure content is being processed and published correctly.

#### Acceptance Criteria

1. WHEN viewing service status THEN the system SHALL display the current count of items in each queue
2. WHEN viewing service logs THEN the system SHALL show recent processing activities and any errors
3. WHEN a critical error occurs THEN the system SHALL log the error with sufficient detail for debugging
4. WHEN queues become backed up THEN the system SHALL provide alerts or notifications
5. WHEN the Instagram API fails THEN the system SHALL log the failure and attempt to retry publication

### Requirement 8

**User Story:** As the service, I want to handle Instagram API authentication and posting, so that content can be automatically published to the target Instagram account.

#### Acceptance Criteria

1. WHEN authenticating with Instagram THEN the system SHALL use valid API credentials and maintain active sessions
2. WHEN posting to Instagram THEN the system SHALL include the generated description, tags, and source citation
3. WHEN creating an Instagram story THEN the system SHALL format content appropriately for story dimensions
4. WHEN creating an Instagram post THEN the system SHALL format content appropriately for feed posts
5. WHEN Instagram API rate limits are reached THEN the system SHALL respect limits and queue posts for later retry
