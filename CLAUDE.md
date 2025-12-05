# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Xata Agent is an open-source AI-powered PostgreSQL monitoring and troubleshooting system. It watches logs and metrics, proactively suggests configuration tuning, troubleshoots performance issues, and can notify via Slack.

## Tech Stack

- **Framework**: Next.js 15.5 (full-stack app in `apps/dbagent`)
- **Runtime**: Node.js 22.x
- **Package Manager**: pnpm 10.x with Turbo for monorepo orchestration
- **Database**: PostgreSQL 17 + Drizzle ORM
- **AI/LLM**: Vercel AI SDK with multi-provider support (OpenAI, Anthropic, Google, Deepseek)
- **UI**: React 19, Tailwind CSS 4, shadcn/ui components

## Common Commands

```bash
# Development
pnpm install                    # Install dependencies
pnpm dev                        # Start dev server (port 4001)
pnpm dev-scheduler              # Run background scheduler (separate terminal)

# Database
docker compose up postgres      # Start PostgreSQL
pnpm db:migrate                 # Run Drizzle migrations
pnpm db:generate                # Generate schema changes

# Quality
pnpm lint                       # ESLint
pnpm tsc                        # TypeScript check
pnpm format-write               # Auto-format with Prettier
pnpm test                       # Run all tests
pnpm unit                       # Unit tests only (excludes evals)
pnpm eval                       # LLM evaluation tests

# Production
pnpm build                      # Build for production
docker compose up               # Run full stack via Docker
```

## Architecture

### Directory Structure

```
apps/dbagent/src/
├── app/                    # Next.js app router (pages, API routes)
├── lib/
│   ├── ai/                 # AI agent core
│   │   ├── tools/          # Vercel AI SDK tool definitions
│   │   └── providers/      # LLM provider configurations
│   ├── db/                 # Drizzle ORM schema and queries
│   ├── tools/              # Playbooks and DB query implementations
│   ├── aws/                # AWS RDS/Aurora/CloudWatch integration
│   ├── gcp/                # Google Cloud SQL integration
│   ├── monitoring/         # Metrics collection and scheduling
│   └── targetdb/           # Target PostgreSQL connection utilities
├── components/             # React UI components
└── evals/                  # LLM evaluation test suites
```

### AI Agent System

The agent uses a **tool + playbook** architecture:

- **Tools** (`src/lib/ai/tools/`): TypeScript functions the agent can call to query databases, fetch metrics, analyze logs. Each tool is defined using Vercel AI SDK's `tool()` helper with Zod schemas.

- **Playbooks** (`src/lib/tools/playbooks.ts`): English-language step-by-step guides the agent follows to troubleshoot specific issues (slow queries, high CPU, connection issues, etc.).

### Database Schema

Schema is defined in `src/lib/db/schema.ts` using Drizzle ORM. Key entities:

- `projects` - Monitored database projects
- `connections` - Target PostgreSQL connection strings
- `schedules` - Monitoring schedule configurations
- `awsClusters` / `gcpInstances` - Cloud provider metadata
- `conversations` / `conversationMessages` - Chat history with AI agent

### Path Alias

Use `~/` to import from `src/` directory:

```typescript
import { something } from '~/lib/ai/tools/db';
```

## Code Style

- **Formatting**: Prettier with 120 char width, 2-space indent, single quotes, no trailing commas
- **Imports**: Auto-organized by `prettier-plugin-organize-imports`
- **Tailwind**: Classes auto-sorted by `prettier-plugin-tailwindcss`
- **ESLint Rules**:
  - `no-process-env: error` - Use `~/lib/env/` utilities instead of `process.env`
  - Custom hook imports enforced for `useFeatureFlag`

## Environment Setup

1. Copy `.env.example` to `.env.local`
2. Add LLM API keys (at minimum, OpenAI)
3. For evals: copy `.env.eval.example` to `.env.eval` and set `EVAL=true` in `.env.local`

## Testing

- **Unit tests**: Vitest, run with `pnpm unit`
- **Eval tests**: Separate Vitest config for LLM evaluations, run with `pnpm eval` (requires Docker)
