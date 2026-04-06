# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.1] - 2026-04-06

### Security

- Remove hardcoded JWT secret fallback — `JWT_SECRET` env var now required
- Mask sensitive fields (API keys, passwords, tokens) in settings API responses
- Fix XSS vulnerability in email HTML generation
- Fix CRLF header injection in email subject lines
- Add security headers (X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy)
- Add rate limiting: 5 req/min on auth endpoints, 60 req/min on general API
- Add JWT structure validation in middleware
- Add webhook fetch timeout (10s AbortController)
- Add Zod input validation schemas for all API endpoints

### Added

- Vitest test suite: 177 tests across 15 files (unit, API, middleware, security)
- Structured logger (`src/lib/logger.ts`) with timestamps, levels, and JSON context
- Rate limiting module (`src/lib/rate-limit.ts`) with sliding window algorithm
- Security utilities (`src/lib/security.ts`) for HTML escaping, secret masking, CRLF sanitization
- Input validation schemas (`src/lib/validations.ts`) with Zod for all API endpoints

### Changed

- Replace 79 console.log/console.error calls across 37 files with structured logger
- Add test step to CI pipeline (GitHub Actions)
- Harden next.config.ts: disable X-Powered-By, enable React strict mode

## [0.1.0] - 2026-04-05

### Added

- Multi-channel support: WhatsApp (QR/API), Email (IMAP/SMTP), Phone (Twilio + ElevenLabs + Whisper)
- AI engine with OpenAI GPT integration and function calling
- 6 AI tools: ticket creation, team routing, internal email, customer history, webhooks, follow-ups
- 19-page admin dashboard with unified inbox
- Customer CRM with profiles, notes, tags, and cross-channel history
- Ticket system with priority levels, department assignment, and SLA tracking
- Knowledge base with categories, entries, priority levels, and test mode
- Automation rules engine: auto-route, auto-tag, auto-reply, keyword alerts
- Business hours configuration with weekly schedule and offline messages
- SLA rules with first response and resolution time targets
- Canned responses with keyboard shortcuts and usage tracking
- Analytics dashboard with line, bar, and donut charts (pure CSS/SVG)
- Activity audit log with entity filtering and pagination
- Admin user management with role-based access (admin, editor, viewer)
- API key generation and management
- Webhook management with test functionality
- Interactive API documentation with live request testing
- Customer satisfaction surveys (1-5 star rating)
- Dark mode with persistent theme preference
- Onboarding checklist for guided setup
- JWT authentication with setup wizard
- Docker Compose deployment
- CSV/JSON data export
- Health check endpoint
- GitHub Actions CI pipeline
