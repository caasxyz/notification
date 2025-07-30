# Changelog

All notable changes to the Notification System SDK will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial release of the Notification System SDK
- Support for V2 API endpoints
- TypeScript support with full type definitions
- Comprehensive client for all notification operations
- Template management (create, update, delete, list)
- User configuration management
- Notification sending with multiple channels
- Notification logs querying
- Webhook validation utilities
- Automatic retry mechanism with exponential backoff
- Rate limiting support
- Event emitter for tracking SDK events
- Examples for common use cases

### Features
- **NotificationClient**: Main client for sending notifications
- **TemplateService**: Template CRUD operations
- **UserService**: User configuration management
- **LogService**: Query notification logs
- **WebhookService**: Grafana webhook integration
- **Signature validation**: HMAC-SHA256 signature generation and validation
- **Error handling**: Comprehensive error types and handling
- **TypeScript**: Full TypeScript support with strict typing

## [1.0.0] - TBD

### Added
- First stable release
- Production-ready SDK with all features