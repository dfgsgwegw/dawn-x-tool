# Dawn X Tool - Discord X Link Tracker

A full-stack web application that tracks and analyzes tweets (X posts) shared in Discord channels. It automatically syncs tweet URLs from a configured Discord channel, fetches detailed engagement metrics using the free FxTwitter API, and provides a dashboard for viewing and exporting the collected data.

---

## Features

- **Automatic Tweet Collection** - Syncs tweet/X URLs posted in a Discord channel
- **Engagement Metrics** - Fetches views, likes, and tweet type (photo, video, thread, text) via FxTwitter API (free, no API key needed)
- **Weekly Leaderboards** - Groups data by week (Friday 3:00 UTC to Friday 3:00 UTC)
- **User Rankings** - Ranks users by total views, average views per post, likes, or post count
- **Advanced Filtering** - Filter by top N users, minimum total views, minimum average views, and tweet type
- **Multi-Week Navigation** - Browse current and past weeks with arrow navigation
- **CSV Export** - Download leaderboard data as CSV
- **Google Sheets Export** - Push leaderboard data directly to Google Sheets
- **Per-Browser Isolation** - Each browser gets its own independent workspace with separate settings and data
- **Responsive Dashboard** - Clean UI with stats cards, expandable user rows, and tweet details
- **3-Week Data Retention** - Keeps current week + 2 previous weeks of data

## Tech Stack

- **Frontend**: React + TypeScript, Vite, Tailwind CSS, Shadcn/ui, TanStack React Query
- **Backend**: Node.js, Express.js, TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **APIs**: Discord.js, FxTwitter API (free), Google Sheets API
- **Deployment**: Vercel (serverless)

---

## Quick Start

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
```

You need a PostgreSQL database. Free options include [Neon](https://neon.tech), [Supabase](https://supabase.com), or [Railway](https://railway.app).

### 3. Initialize Database

```bash
npm run db:push
```

### 4. Run the App

```bash
npm run dev
```

The app will be available at `http://localhost:5000`.

---

## Discord Bot Setup (Free)

This is the most important part. The bot reads messages from your Discord channel to find tweet links.

### Step 1: Create a Discord Application

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications).
2. Click **"New Application"**.
3. Give it a name (e.g., "Dawn X Tracker") and click **Create**.

### Step 2: Create the Bot and Get the Token

1. In your new application, go to the **"Bot"** tab on the left sidebar.
2. Click **"Reset Token"** to generate a bot token.
3. **Copy the token immediately** and save it somewhere safe. You won't be able to see it again.
4. Keep the bot **private** - make sure "Public Bot" is **unchecked** so only you can add it to servers.

### Step 3: Enable Required Permissions (Important!)

Still on the **Bot** tab, scroll down to **"Privileged Gateway Intents"** and enable:

| Intent | Required? | Why |
|--------|-----------|-----|
| **Message Content Intent** | **YES - Required** | The bot needs this to read message content and find tweet/X links |
| **Server Members Intent** | Optional | Can help with user identification |
| **Presence Intent** | Optional | Not used, but doesn't hurt to enable |

> **If you skip enabling Message Content Intent, the bot will not be able to read any messages and syncing will return 0 results.**

### Step 4: Generate the Bot Invite Link

1. Go to the **"OAuth2"** tab on the left sidebar.
2. Click on **"URL Generator"**.
3. Under **Scopes**, check: `bot`
4. Under **Bot Permissions**, check these two permissions:

| Permission | Why |
|------------|-----|
| **Read Messages / View Channels** | So the bot can see the channel you want to monitor |
| **Read Message History** | So the bot can scroll back through past messages to find tweet links |

5. Copy the **generated URL** at the bottom of the page.

### Step 5: Add the Bot to Your Server

1. Open the copied URL in your browser.
2. Select the Discord server where your tweet channel is.
3. Click **Authorize** and complete the captcha.
4. The bot should now appear in your server's member list (it will show as offline - that's normal, it only connects when syncing).

### Step 6: Get Your Channel ID

1. Open Discord and go to **User Settings** (gear icon next to your username).
2. Go to **Advanced** and turn on **"Developer Mode"**.
3. Close settings, then **right-click on the channel** where tweets are posted.
4. Click **"Copy Channel ID"**.

### Step 7: Enter Credentials in the App

1. Open the Dawn X Tool in your browser.
2. Go to the **Settings** page (gear icon in the sidebar).
3. Paste your **Bot Token** in the Discord Bot Token field.
4. Paste your **Channel ID** in the Discord Channel ID field.
5. Click **"Save Configuration"**.
6. Go back to the **Dashboard** and click the **Sync** button.

---

## How It Works

1. **Sync** - When you click Sync, the bot logs into Discord, scans the configured channel for messages from the current week, and extracts any twitter.com or x.com links.
2. **Enrich** - For each tweet link found, it calls the free FxTwitter API to get engagement metrics (views, likes, tweet type, author, content).
3. **Store** - All data is saved to PostgreSQL, tagged with the current week number and your browser's unique ID.
4. **Display** - The dashboard shows a leaderboard ranking users by their tweet engagement, with expandable rows to see individual tweets.
5. **Rotate** - Data older than 3 weeks is automatically cleaned up during sync.

### Week System

- Weeks run from **Friday 3:00 UTC** to **Friday 3:00 UTC**.
- You can navigate between weeks using the left/right arrows on the dashboard.
- The current week is always available even if no data has been synced yet.

### Per-Browser Isolation

- Each browser generates a unique ID on first visit (stored in localStorage).
- All data (settings, tweets, leaderboards) is tied to that browser ID.
- Different browsers or devices will each have their own independent workspace.
- Clearing browser data / localStorage will create a new workspace.

---

## Google Sheets Export (Optional)

If you want to export leaderboard data to Google Sheets:

### Step 1: Create a Google Cloud Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com).
2. Create a new project (or select an existing one).
3. Go to **APIs & Services > Library** and enable the **Google Sheets API**.
4. Go to **IAM & Admin > Service Accounts**.
5. Click **"Create Service Account"**, give it a name, and click **Create**.
6. Skip the optional permissions steps and click **Done**.
7. Click on your new service account, go to the **"Keys"** tab.
8. Click **"Add Key" > "Create new key"** and choose **JSON**.
9. A JSON file will download. Open it and find these two values:
   - `client_email` (looks like `something@project-id.iam.gserviceaccount.com`)
   - `private_key` (starts with `-----BEGIN PRIVATE KEY-----`)

### Step 2: Set Up Your Google Sheet

1. Create a new Google Sheet (or use an existing one).
2. **Share the sheet** with your service account email (the `client_email` from the JSON file). Give it **Editor** access.
3. Copy the **Sheet ID** from the URL: `https://docs.google.com/spreadsheets/d/THIS_IS_THE_SHEET_ID/edit`

### Step 3: Enter Credentials in the App

1. Go to **Settings** in the Dawn X Tool.
2. Enter the **Google Sheet ID**, **Service Account Email**, and **Private Key**.
3. Click **Save Configuration**.
4. On the Dashboard, use the **Export to Sheets** button to push data.

---

## Deployment on Vercel

This app is pre-configured for Vercel deployment.

### Setup

1. Push your code to GitHub.
2. Go to [Vercel](https://vercel.com) and import your GitHub repository.
3. Add the `DATABASE_URL` environment variable in Vercel project settings (use a cloud PostgreSQL like [Neon](https://neon.tech)).
4. Deploy.

### How Vercel Deployment Works

- The frontend is built with Vite and served as static files from `dist/public/`.
- The backend runs as a Vercel serverless function from `api/index.js`.
- The `vercel.json` routes `/api/*` requests to the serverless function and everything else to the frontend.

### Build for Vercel Locally

```bash
node scripts/build-vercel.mjs
```

This will:
1. Build the frontend with Vite
2. Run database migrations
3. Bundle the API into `api/index.js`

---

## Other Deployment Options

| Platform | Free Tier | Database Included | Notes |
|----------|-----------|-------------------|-------|
| [Vercel](https://vercel.com) | Yes | No (use Neon) | Recommended, pre-configured |
| [Railway](https://railway.app) | $5 free credits | Yes (PostgreSQL) | Easiest full-stack |
| [Render](https://render.com) | Yes | Yes (PostgreSQL, 90 days) | Good free option |
| [Fly.io](https://fly.io) | Yes | Yes (PostgreSQL) | More technical setup |
| [Replit](https://replit.com) | Yes | Yes (PostgreSQL) | One-click deployment |

For traditional Node.js platforms, set:
- **Build command**: `npm run build`
- **Start command**: `npm start`
- **Environment variable**: `DATABASE_URL`

---

## Dashboard Features

### Leaderboard
- Users ranked by total views (default), with columns for post count, total views, average views per post, and total likes.
- Click on a user row to expand and see their individual tweets with links, views, likes, and type.

### Filters
- **Top N Users** - Show only the top N users (with custom number input).
- **Min Total Views** - Filter out users below a minimum total view count.
- **Min Avg Views** - Filter out users below a minimum average views per post.
- **Tweet Type** - Filter by tweet type (text, photo, video, thread).

### Export Options
- **CSV** - Downloads a CSV file with the current leaderboard data.
- **Google Sheets** - Pushes data to a configured Google Sheet with the same filter options.

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npm run db:push` | Push database schema changes |
| `npm run check` | Run TypeScript type checking |

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Sync returns 0 tweets | Make sure **Message Content Intent** is enabled in the Discord Developer Portal under Bot > Privileged Gateway Intents |
| Bot can't see the channel | Check that the bot has **Read Messages** and **Read Message History** permissions, and that it's been added to the correct server |
| "Discord credentials not configured" | Go to Settings and enter your Bot Token and Channel ID, then click Save |
| Settings don't persist | Make sure you're not in a private/incognito window (localStorage is needed) |
| Google Sheets export fails | Make sure you shared the spreadsheet with the service account email as Editor |
| Different data in different browsers | This is by design - each browser has its own independent workspace |
| Bot shows offline in Discord | That's normal. The bot only connects briefly when you click Sync, then disconnects |

---

## License

MIT
