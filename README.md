# Dawn X Tool - Discord X Link Tracker

A full-stack web application that tracks and analyzes tweets (X posts) shared in Discord channels. It automatically syncs tweet URLs from a configured Discord channel, fetches detailed engagement metrics using the free FxTwitter API, and provides a dashboard for viewing and exporting the collected data.

## Features

- **Automatic Tweet Collection** - Syncs tweet URLs posted in a Discord channel
- **Engagement Metrics** - Fetches views, likes, and tweet type (photo, video, thread, text) via FxTwitter API (free, no API key needed)
- **Weekly Leaderboards** - Groups data by week (Friday 3:00 UTC to Friday 3:00 UTC)
- **User Rankings** - Ranks users by total views, average views per post, likes, or post count
- **Advanced Filtering** - Filter by top N users, minimum total views, minimum average views, and tweet type
- **CSV Export** - Download leaderboard data as CSV
- **Google Sheets Export** - Push leaderboard data directly to Google Sheets
- **Responsive Dashboard** - Clean UI with stats cards, expandable user rows, and tweet details

## Tech Stack

- **Frontend**: React + TypeScript, Vite, Tailwind CSS, Shadcn/ui, TanStack React Query
- **Backend**: Node.js, Express.js, TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **APIs**: Discord.js, FxTwitter API, Google Sheets API

---

## Prerequisites

Before setting up, you need:

1. **Node.js 20+** installed
2. **PostgreSQL** database (local or hosted like Neon, Supabase, Railway)
3. **Discord Bot** (free - setup instructions below)
4. **Google Cloud Service Account** (free - optional, only for Google Sheets export)

---

## Setup Guide

### 1. Clone and Install

```bash
git clone https://github.com/YOUR_USERNAME/dawn-x-tool.git
cd dawn-x-tool
npm install
```

### 2. Environment Variables

Create a `.env` file in the root directory:

```env
DATABASE_URL=postgresql://username:password@host:port/database
PORT=5000
```

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `PORT` | No | Server port (defaults to 5000) |

### 3. Initialize Database

Push the database schema:

```bash
npm run db:push
```

### 4. Run the App

**Development:**
```bash
npm run dev
```

**Production build:**
```bash
npm run build
npm start
```

The app will be available at `http://localhost:5000`.

### 5. Configure Settings (In-App)

Open the app in your browser and go to **Settings** page to enter:

- Discord Bot Token
- Discord Channel ID
- Google Sheets credentials (optional)

---

## Discord Bot Setup (Free)

### Step 1: Create a Discord Application

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **"New Application"** and give it a name (e.g., "Dawn X Tracker")
3. Click **Create**

### Step 2: Create a Bot

1. In your application, go to the **"Bot"** tab on the left sidebar
2. Click **"Add Bot"** and confirm
3. Under the bot's username, click **"Reset Token"** to generate a new token
4. **Copy the token** - you'll need this for the app settings
5. **Important**: Under "Privileged Gateway Intents", enable:
   - **Message Content Intent** (required to read message content)
   - **Server Members Intent** (optional)

### Step 3: Invite the Bot to Your Server

1. Go to the **"OAuth2"** tab, then **"URL Generator"**
2. Under **Scopes**, check: `bot`
3. Under **Bot Permissions**, check:
   - `Read Messages/View Channels`
   - `Read Message History`
4. Copy the generated URL and open it in your browser
5. Select your Discord server and authorize the bot

### Step 4: Get Your Channel ID

1. In Discord, go to **Settings > Advanced** and enable **"Developer Mode"**
2. Right-click on the channel where tweets are posted
3. Click **"Copy Channel ID"**

### Step 5: Enter Credentials in the App

1. Open the Dawn X Tool in your browser
2. Go to the **Settings** page
3. Paste the **Bot Token** and **Channel ID**
4. Click **Save Configuration**

### How the Bot Works

- The bot is **not always online** - it only connects when you click "Sync Now"
- Each sync fetches **all messages from the current week** (Friday 3:00 UTC okonward), paginating through as many as needed
- It extracts all `x.com` and `twitter.com` links from messages
- For each tweet URL found, it fetches engagement data from FxTwitter API
- New tweets are saved to the database with the current week number
- Duplicate tweets (same URL) are automatically skipped

---

## Google Sheets Export Setup (Free, Optional)

### Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project (or select existing one)
3. Enable the **Google Sheets API**:
   - Go to **APIs & Services > Library**
   - Search for "Google Sheets API"
   - Click **Enable**

### Step 2: Create a Service Account

1. Go to **APIs & Services > Credentials**
2. Click **"Create Credentials" > "Service Account"**
3. Give it a name (e.g., "dawn-x-sheets")
4. Click **Create and Continue**, then **Done**
5. Click on the service account you just created
6. Go to the **"Keys"** tab
7. Click **"Add Key" > "Create new key"**
8. Select **JSON** and click **Create**
9. A JSON file will download - keep it safe

### Step 3: Create a Google Sheet

1. Create a new Google Sheet at [sheets.google.com](https://sheets.google.com)
2. Copy the **Sheet ID** from the URL: `https://docs.google.com/spreadsheets/d/SHEET_ID_HERE/edit`
3. **Share the sheet** with your service account email (found in the JSON file as `client_email`), give it **Editor** access

### Step 4: Enter Credentials in the App

1. Open the Dawn X Tool **Settings** page
2. Enter:
   - **Google Sheet ID** - the ID from the spreadsheet URL
   - **Service Account Email** - the `client_email` from the JSON key file
   - **Service Account Private Key** - the `private_key` from the JSON key file (starts with `-----BEGIN PRIVATE KEY-----`)
3. Click **Save Configuration**

### How Export Works

- Click **Google Sheets** on the dashboard to open the export dialog
- Choose filters (top N users, minimum views, tweet type, etc.)
- Click **Export** - data is pushed to a new tab in your Google Sheet
- Each week gets its own tab named by the week date range

---

## How the App Works

### Weekly Rotation

- Data is organized by week: **Friday 3:00 UTC to Friday 3:00 UTC**
- The dashboard shows the current week's data by default, with tabs to view the previous 2 weeks
- Data is kept for **3 weeks** (current + 2 previous) - older data is automatically cleaned up during sync

### Syncing Process

When you click **"Sync Now"**:

1. The Discord bot logs in and scans all messages from the current week in the configured channel (paginates through as many as needed, not limited to 100)
2. Tweet URLs (x.com and twitter.com links) are extracted from messages
3. For each new tweet URL, the FxTwitter API is called to fetch:
   - View count
   - Like count
   - Tweet type (photo, video, thread, or text)
   - Author username
   - Tweet content
   - Posted date
4. Data is saved to the database with the current week number
5. Duplicate tweets are automatically skipped

### Dashboard

- **Stats Cards** - Total tweets, views, likes, and unique users for the current week
- **Leaderboard Table** - Users ranked by total views (default)
- **Expandable Rows** - Click a user to see their individual tweets
- **Sorting** - Sort by total views, average views, likes, or posts
- **Filtering** - Filter by tweet type, search by user/content
- **Top N** - Show only top 3, 5, 10, 25, 50, or custom number of users

### FxTwitter API

This app uses the [FxTwitter API](https://github.com/FixTweet/FxTwitter) which is:
- **Completely free** - no API key or authentication required
- **No API key needed** - rate limits may apply for very heavy usage
- Provides tweet views, likes, content, media type, and more
- Alternative to the paid Twitter/X API

---

## Project Structure

```
dawn-x-tool/
├── client/                    # Frontend (React + Vite)
│   ├── index.html             # HTML entry point
│   ├── public/                # Static assets (favicon, etc.)
│   └── src/
│       ├── pages/             # Page components
│       │   ├── Dashboard.tsx   # Main dashboard with leaderboard
│       │   └── Settings.tsx    # Configuration page
│       ├── components/        # Reusable UI components
│       │   ├── Layout.tsx     # App shell with sidebar
│       │   ├── StatsCard.tsx  # Statistics display card
│       │   └── ui/            # Shadcn UI primitives
│       ├── hooks/             # Custom React hooks
│       │   ├── use-tweets.ts  # Tweet data fetching
│       │   ├── use-settings.ts # Settings management
│       │   └── use-toast.ts   # Toast notifications
│       ├── lib/               # Utilities
│       └── App.tsx            # Root component with routing
├── server/                    # Backend (Express.js)
│   ├── index.ts               # Server entry point
│   ├── routes.ts              # API route handlers
│   ├── storage.ts             # Database access layer
│   ├── db.ts                  # PostgreSQL connection
│   ├── discord.ts             # Discord bot integration
│   ├── twitter.ts             # FxTwitter API client
│   ├── google-sheets.ts       # Google Sheets export
│   ├── week-utils.ts          # Week boundary calculations
│   └── vite.ts                # Vite dev server integration
├── shared/                    # Shared between frontend & backend
│   ├── schema.ts              # Database schema (Drizzle ORM)
│   └── routes.ts              # API route type definitions
├── script/
│   └── build.ts               # Production build script
├── scripts/
│   └── build-vercel.mjs       # Vercel-specific build script
├── drizzle.config.ts          # Drizzle ORM configuration
├── tailwind.config.ts         # Tailwind CSS configuration
├── vite.config.ts             # Vite build configuration
├── vercel.json                # Vercel deployment configuration
├── tsconfig.json              # TypeScript configuration
└── package.json               # Dependencies and scripts
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/tweets` | Get all tweets for current week |
| `POST` | `/api/tweets/sync` | Sync tweets from Discord |
| `POST` | `/api/tweets/export` | Export to Google Sheets |
| `GET` | `/api/settings` | Get all settings |
| `POST` | `/api/settings` | Update a setting |
| `GET` | `/api/settings/:key` | Get a single setting |
| `GET` | `/api/week-info` | Get current week boundaries |

---

## Deployment Options

### Vercel (Recommended)

This project includes built-in Vercel support with serverless API functions.

**Steps:**

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com) and import your GitHub repository
3. Vercel will auto-detect the configuration from `vercel.json`
4. Add these **Environment Variables** in the Vercel dashboard:
   - `DATABASE_URL` - Your PostgreSQL connection string (use [Neon](https://neon.tech), [Supabase](https://supabase.com), or [Vercel Postgres](https://vercel.com/docs/storage/vercel-postgres))
5. Click **Deploy**
6. After deploying, run the database schema push:
   ```bash
   # Locally, with your production DATABASE_URL:
   DATABASE_URL="your_production_db_url" npm run db:push
   ```
7. Open your deployed app and configure Discord/Google Sheets credentials in **Settings**

**How it works:**
- Frontend is built with Vite and served as static files
- API routes run as Vercel serverless functions (`api/index.js`)
- The `vercel.json` handles routing between static files and API

### Other Platforms

This app also works on traditional Node.js hosting platforms:

| Platform | Free Tier | Database Included | Notes |
|----------|-----------|-------------------|-------|
| [Railway](https://railway.app) | $5 free credits | Yes (PostgreSQL) | Easiest full-stack deployment |
| [Render](https://render.com) | Yes | Yes (PostgreSQL, 90 days free) | Good free option |
| [Fly.io](https://fly.io) | Yes | Yes (PostgreSQL) | More technical setup |
| [Replit](https://replit.com) | Yes | Yes (PostgreSQL) | One-click deployment |

**For traditional platforms:**

1. Push your code to GitHub
2. Connect your GitHub repo to your chosen platform
3. Set the **build command**: `npm run build`
4. Set the **start command**: `npm start` or `node dist/index.cjs`
5. Add the `DATABASE_URL` environment variable
6. Deploy

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server (frontend + backend with hot reload) |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npm run db:push` | Push database schema changes |
| `npm run check` | Run TypeScript type checking |

---

## License

MIT
