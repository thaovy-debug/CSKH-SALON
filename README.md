<p align="center">
  <img src="public/owly.png" alt="Owly" width="140" height="140" />
</p>

<h1 align="center">Owly</h1>

<p align="center">
  <strong>Open-source AI-powered customer support agent</strong>
</p>

<p align="center">
  Self-hosted, free, and easy to set up.<br/>
  Connect WhatsApp, Email, and Phone to provide 24/7 AI customer support.
</p>

<p align="center">
  <a href="#features">Features</a> &middot;
  <a href="#quick-start">Quick Start</a> &middot;
  <a href="#configuration">Configuration</a> &middot;
  <a href="#api">API</a> &middot;
  <a href="#tech-stack">Tech Stack</a> &middot;
  <a href="#roadmap">Roadmap</a> &middot;
  <a href="#contributing">Contributing</a> &middot;
  <a href="#license">License</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License" />
  <img src="https://img.shields.io/badge/node-%3E%3D20-green.svg" alt="Node" />
  <img src="https://img.shields.io/badge/typescript-5.x-blue.svg" alt="TypeScript" />
  <img src="https://img.shields.io/badge/next.js-14-black.svg" alt="Next.js" />
</p>

---

## What is Owly?

Owly is a self-hosted AI customer support agent that small businesses and individuals can run on their own machines for free. It connects to WhatsApp, Email, and Phone to automatically respond to customer inquiries using AI, with a full-featured admin dashboard to manage everything.

**Why Owly?**
- No monthly fees - you only pay for the AI API usage
- Your data stays on your machine - complete privacy
- Fully customizable - knowledge base, tone, language, and tools
- Easy setup - Docker Compose or npm, setup wizard guides you through

## Features

### Multi-Channel Support
- **WhatsApp** - Connect via WhatsApp Web (QR code) or Business API
- **Email** - IMAP/SMTP with branded HTML response templates
- **Phone** - Twilio Voice + OpenAI Whisper (STT) + ElevenLabs (TTS)

### AI-Powered Conversations
- OpenAI GPT integration with function calling
- Knowledge base-aware responses (RAG)
- Automatic ticket creation and team routing
- Customer history context for personalized support
- Configurable tone (friendly, formal, technical) and auto language detection
- AI tool system: create tickets, route to departments, send internal emails, query customer history, trigger webhooks

### Admin Dashboard
- **Unified Inbox** - All channels in one place with real-time chat view
- **Customer CRM** - Profiles, notes, tags, conversation history across channels
- **Ticket System** - Priority levels, department assignment, SLA tracking
- **Analytics** - Charts, metrics, team performance, satisfaction scores
- **Knowledge Base** - Categorized entries with test mode to verify AI responses
- **Team Management** - Departments, members, expertise, availability

### Automation
- **Auto-Routing** - Route conversations to departments based on keywords
- **Auto-Tagging** - Automatically tag conversations by content
- **Auto-Reply** - Automatic responses for specific patterns
- **Keyword Alerts** - Email notifications for important keywords
- **SLA Rules** - Response time targets with breach tracking
- **Business Hours** - Weekly schedule with offline messages
- **Canned Responses** - Pre-written replies with shortcuts

### Professional Features
- Dark mode with persistent theme
- Onboarding checklist for guided setup
- Activity audit log (who did what, when)
- Multi-admin with role-based access (admin, editor, viewer)
- API key management for external integrations
- Interactive API documentation with live testing
- Webhook management with test functionality
- CSV/JSON data export
- Customer satisfaction surveys (1-5 star rating)
- Error boundaries and toast notifications
- Docker Compose for one-command deployment

## Screenshots

| Dashboard | Conversations | Knowledge Base |
|-----------|--------------|----------------|
| Stat cards, onboarding checklist, recent conversations, channel overview | Unified inbox with chat thread, admin takeover, status management | Categories with entries, inline editing, test mode |

| Analytics | Channels | Settings |
|-----------|----------|----------|
| Line/bar/donut charts, team performance, satisfaction scores | WhatsApp QR, Email SMTP/IMAP, Phone Twilio + ElevenLabs | 6-tab configuration, AI provider, voice, channels |

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 16+

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/owly.git
cd owly

# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your database URL and API keys

# Run database migrations
npx prisma migrate dev

# (Optional) Load sample data
npm run db:seed
# Default admin: username=admin, password=admin123

# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and follow the setup wizard.

### Docker

```bash
# Copy and configure environment
cp .env.example .env

# Start with Docker Compose
docker compose up -d

# The app will be available at http://localhost:3000
```

## Configuration

All configuration is done through the admin dashboard - no config files to edit:

| Setting | Location | Description |
|---------|----------|-------------|
| Business profile | Settings > General | Name, description, welcome message, tone |
| AI provider | Settings > AI Configuration | OpenAI/Claude/Ollama, model, API key |
| Voice | Settings > Voice | ElevenLabs API key and voice selection |
| Phone | Settings > Phone | Twilio Account SID, auth token, number |
| Email | Settings > Email | SMTP and IMAP server configuration |
| WhatsApp | Channels > WhatsApp | QR code or Business API connection |
| Team | Team | Departments, members, expertise areas |
| SLA rules | SLA Rules | Response and resolution time targets |
| Business hours | Business Hours | Weekly schedule, timezone, offline message |
| Automation | Automation | Auto-route, auto-tag, auto-reply rules |
| Canned responses | Canned Responses | Pre-written reply templates |
| Webhooks | Webhooks | External service integrations |

## API

Owly provides a REST API for integration with external systems. Full interactive documentation is available at `/api-docs` in the dashboard.

```bash
# Send a message and get AI response
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your_api_key" \
  -d '{"message": "What are your business hours?", "channel": "api"}'

# Health check
curl http://localhost:3000/api/health
```

### Key Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/chat` | Send message, get AI response |
| GET/POST | `/api/conversations` | List or create conversations |
| GET/POST | `/api/tickets` | List or create tickets |
| GET/POST | `/api/knowledge/categories` | Knowledge base categories |
| GET/POST | `/api/knowledge/entries` | Knowledge base entries |
| POST | `/api/knowledge/test` | Test AI with a question |
| GET/PUT | `/api/settings` | Application settings |
| GET | `/api/analytics` | Analytics data |
| GET | `/api/export` | Export data (CSV/JSON) |
| GET | `/api/health` | Health check |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Database | PostgreSQL + Prisma ORM |
| UI | Tailwind CSS |
| AI | OpenAI GPT (extensible to Claude, Ollama) |
| Voice TTS | ElevenLabs |
| Voice STT | OpenAI Whisper |
| Phone | Twilio Voice API |
| WhatsApp | whatsapp-web.js |
| Auth | JWT + bcrypt |
| Charts | Pure CSS/SVG (no external library) |

## Project Structure

```
owly/
├── prisma/              # Database schema and migrations
├── public/              # Static assets (logo)
├── src/
│   ├── app/
│   │   ├── (auth)/      # Login and setup pages
│   │   ├── (dashboard)/ # All dashboard pages
│   │   └── api/         # REST API routes
│   ├── components/
│   │   ├── layout/      # Sidebar, header
│   │   └── ui/          # Reusable UI components
│   └── lib/
│       ├── ai/          # AI engine, tools, types
│       ├── channels/    # WhatsApp, email, phone handlers
│       └── hooks/       # React hooks (theme)
├── docker-compose.yml
├── Dockerfile
└── .env.example
```

## Roadmap

- [ ] Embeddable live chat widget for websites
- [ ] WebSocket real-time updates
- [ ] Vector embeddings for semantic knowledge search
- [ ] Visual AI tool builder (create tools from UI)
- [ ] Public knowledge base page (self-service)
- [ ] Customer self-service portal
- [ ] Visual workflow builder for advanced automation
- [ ] Telegram, Instagram, SMS channels
- [ ] Shopify / WooCommerce integration
- [ ] Sentiment analysis and emotion detection
- [ ] Multi-language admin UI (i18n)
- [ ] Mobile-responsive admin / PWA
- [ ] Video call support (WebRTC)
- [ ] Multi-tenant / white-label support

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  Built with care by the Owly community
</p>
