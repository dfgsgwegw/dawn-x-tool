import { createRequire } from "module"; const require = createRequire(import.meta.url);
var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/vercel.ts
import express from "express";
import { createServer } from "http";

// server/db.ts
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  insertSettingSchema: () => insertSettingSchema,
  insertTweetSchema: () => insertTweetSchema,
  settings: () => settings,
  tweets: () => tweets
});
import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
var tweets = pgTable("tweets", {
  id: serial("id").primaryKey(),
  discordMessageId: text("discord_message_id").notNull().unique(),
  url: text("url").notNull(),
  tweetId: text("tweet_id"),
  author: text("author"),
  content: text("content"),
  type: text("type"),
  // 'video', 'photo', 'thread', 'text'
  views: integer("views").default(0),
  likes: integer("likes").default(0),
  postedAt: timestamp("posted_at"),
  collectedAt: timestamp("collected_at").defaultNow(),
  weekNumber: integer("week_number")
});
var settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull()
});
var insertTweetSchema = createInsertSchema(tweets).omit({
  id: true,
  collectedAt: true
});
var insertSettingSchema = createInsertSchema(settings).omit({
  id: true
});

// server/db.ts
var { Pool } = pg;
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?"
  );
}
var pool = new Pool({ connectionString: process.env.DATABASE_URL });
var db = drizzle(pool, { schema: schema_exports });

// server/storage.ts
import { eq, desc, asc, sql } from "drizzle-orm";
var DatabaseStorage = class {
  async getTweets(sortBy = "postedAt", order = "desc") {
    const orderBy = order === "asc" ? asc : desc;
    let sortColumn = tweets.postedAt;
    if (sortBy === "views") sortColumn = tweets.views;
    if (sortBy === "likes") sortColumn = tweets.likes;
    return await db.select().from(tweets).orderBy(orderBy(sortColumn));
  }
  async createTweet(tweet) {
    const [newTweet] = await db.insert(tweets).values(tweet).returning();
    return newTweet;
  }
  async getTweetByUrl(url) {
    const [tweet] = await db.select().from(tweets).where(eq(tweets.url, url));
    return tweet;
  }
  async updateTweetEngagement(url, engagement) {
    const [updated] = await db.update(tweets).set(engagement).where(eq(tweets.url, url)).returning();
    return updated;
  }
  async createOrUpdateTweet(tweet) {
    const [savedTweet] = await db.insert(tweets).values(tweet).onConflictDoUpdate({
      target: tweets.url,
      set: {
        views: tweet.views,
        likes: tweet.likes,
        type: tweet.type,
        weekNumber: tweet.weekNumber,
        author: tweet.author,
        content: tweet.content
      }
    }).returning();
    return savedTweet;
  }
  async deleteOldTweets(currentWeekNumber) {
    const keepFromWeek = currentWeekNumber - 2;
    await db.delete(tweets).where(sql`${tweets.weekNumber} < ${keepFromWeek}`);
  }
  async getAvailableWeeks() {
    const result = await db.selectDistinct({ weekNumber: tweets.weekNumber }).from(tweets).orderBy(desc(tweets.weekNumber));
    return result.map((r) => r.weekNumber).filter((w) => w !== null);
  }
  async getSettings() {
    return await db.select().from(settings);
  }
  async getSetting(key) {
    const [setting] = await db.select().from(settings).where(eq(settings.key, key));
    return setting;
  }
  async updateSetting(setting) {
    const [updated] = await db.insert(settings).values(setting).onConflictDoUpdate({
      target: settings.key,
      set: { value: setting.value }
    }).returning();
    return updated;
  }
};
var storage = new DatabaseStorage();

// shared/routes.ts
import { z } from "zod";
var errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional()
  }),
  notFound: z.object({
    message: z.string()
  }),
  internal: z.object({
    message: z.string()
  })
};
var api = {
  tweets: {
    list: {
      method: "GET",
      path: "/api/tweets",
      input: z.object({
        sortBy: z.enum(["views", "likes", "postedAt"]).optional(),
        order: z.enum(["asc", "desc"]).optional()
      }).optional(),
      responses: {
        200: z.array(z.custom())
      }
    },
    sync: {
      method: "POST",
      path: "/api/tweets/sync",
      responses: {
        200: z.object({ message: z.string(), count: z.number() }),
        500: errorSchemas.internal
      }
    },
    export: {
      method: "POST",
      path: "/api/tweets/export",
      responses: {
        200: z.object({ message: z.string(), spreadsheetUrl: z.string().optional() }),
        500: errorSchemas.internal
      }
    }
  },
  settings: {
    list: {
      method: "GET",
      path: "/api/settings",
      responses: {
        200: z.array(z.custom())
      }
    },
    update: {
      method: "POST",
      path: "/api/settings",
      input: insertSettingSchema,
      responses: {
        200: z.custom(),
        400: errorSchemas.validation
      }
    },
    get: {
      method: "GET",
      path: "/api/settings/:key",
      responses: {
        200: z.custom(),
        404: errorSchemas.notFound
      }
    }
  }
};

// server/routes.ts
import { z as z2 } from "zod";

// server/twitter.ts
async function fetchTweetDetails(url) {
  const match = url.match(/status\/(\d+)/);
  if (!match) return null;
  const tweetId = match[1];
  try {
    const res = await fetch(`https://api.fxtwitter.com/status/${tweetId}`, {
      headers: {
        "User-Agent": "DawnXTool/1.0"
      }
    });
    if (!res.ok) {
      console.error(`FxTwitter API returned ${res.status} for tweet ${tweetId}`);
      return null;
    }
    const data = await res.json();
    if (data.code !== 200 || !data.tweet) {
      console.error(`FxTwitter returned unexpected data for ${tweetId}:`, data.message);
      return null;
    }
    const tweet = data.tweet;
    let type = "text";
    if (tweet.media?.videos?.length > 0) {
      type = "video";
    } else if (tweet.media?.photos?.length > 0) {
      type = "photo";
    }
    return {
      id: tweetId,
      author: tweet.author?.screen_name || "unknown",
      content: tweet.text || "",
      views: tweet.views ?? 0,
      likes: tweet.likes ?? 0,
      postedAt: tweet.created_at ? new Date(tweet.created_at) : /* @__PURE__ */ new Date(),
      type
    };
  } catch (error) {
    console.error(`Error fetching tweet ${tweetId}:`, error);
    return null;
  }
}

// server/discord.ts
import { Client, GatewayIntentBits } from "discord.js";

// server/week-utils.ts
function getWeekBoundaries(date = /* @__PURE__ */ new Date()) {
  const d = new Date(date);
  const dayOfWeek = d.getUTCDay();
  const hour = d.getUTCHours();
  let daysBack = (dayOfWeek - 5 + 7) % 7;
  if (daysBack === 0 && hour < 3) {
    daysBack = 7;
  }
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - daysBack, 3, 0, 0, 0));
  const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1e3);
  const startStr = start.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const endStr = end.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const weekLabel = `${startStr} - ${endStr}`;
  return { start, end, weekLabel };
}
function getWeekNumber(d) {
  const { start } = getWeekBoundaries(d);
  const epoch = new Date(Date.UTC(2024, 0, 5, 3, 0, 0));
  return Math.floor((start.getTime() - epoch.getTime()) / (7 * 24 * 60 * 60 * 1e3));
}

// server/discord.ts
async function fetchDiscordMessages() {
  const token = await storage.getSetting("discord_token");
  const channelId = await storage.getSetting("discord_channel_id");
  if (!token || !channelId || token.value === "********" || channelId.value === "********") {
    throw new Error("Discord credentials not fully configured");
  }
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent
    ]
  });
  return new Promise((resolve, reject) => {
    client.once("ready", async () => {
      console.log(`Discord bot logged in as ${client.user?.tag}`);
      try {
        const channel = await client.channels.fetch(channelId.value);
        if (!channel || !("messages" in channel)) {
          throw new Error("Invalid channel or bot has no access");
        }
        const textChannel = channel;
        const { start: weekStart } = getWeekBoundaries();
        const xLinks = [];
        const xRegex = /https?:\/\/(?:www\.)?(?:x\.com|twitter\.com)\/\w+\/status\/\d+/g;
        let lastMessageId;
        let keepFetching = true;
        let totalFetched = 0;
        while (keepFetching) {
          const options = { limit: 100 };
          if (lastMessageId) {
            options.before = lastMessageId;
          }
          const messages = await textChannel.messages.fetch(options);
          if (messages.size === 0) {
            keepFetching = false;
            break;
          }
          totalFetched += messages.size;
          let reachedOlderThanWeek = false;
          messages.forEach((msg) => {
            if (msg.createdAt < weekStart) {
              reachedOlderThanWeek = true;
              return;
            }
            const content = msg.content;
            const matches = content.match(xRegex);
            if (matches) {
              matches.forEach((url) => {
                xLinks.push(JSON.stringify({
                  url,
                  author: msg.author.username,
                  content: msg.content,
                  postedAt: msg.createdAt.toISOString()
                }));
              });
            }
          });
          if (reachedOlderThanWeek || messages.size < 100) {
            keepFetching = false;
          } else {
            lastMessageId = messages.last()?.id;
          }
        }
        client.destroy();
        const uniqueLinks = Array.from(new Set(xLinks));
        console.log(`Discord sync: scanned ${totalFetched} messages, found ${uniqueLinks.length} tweet links this week.`);
        resolve(uniqueLinks);
      } catch (err) {
        client.destroy();
        reject(err);
      }
    });
    client.login(token.value).catch(reject);
  });
}

// server/google-sheets.ts
import { GoogleSpreadsheet } from "google-spreadsheet";
import { JWT } from "google-auth-library";
async function exportToSheets(params) {
  const sheetId = await storage.getSetting("google_sheet_id");
  const email = await storage.getSetting("google_service_account_email");
  const privateKey = await storage.getSetting("google_private_key");
  const missing = [];
  if (!sheetId) missing.push("Google Sheet ID");
  if (!email) missing.push("Service Account Email");
  if (!privateKey) missing.push("Service Account Private Key");
  if (missing.length > 0 || !sheetId || !email || !privateKey) {
    throw new Error(`Missing Google Sheets settings: ${missing.join(", ")}. Please configure them in Settings.`);
  }
  const serviceAccountAuth = new JWT({
    email: email.value,
    key: privateKey.value.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"]
  });
  const doc = new GoogleSpreadsheet(sheetId.value, serviceAccountAuth);
  await doc.loadInfo();
  const { weekLabel } = getWeekBoundaries();
  const sheetTitle = `Week ${weekLabel}`;
  let sheet = doc.sheetsByTitle[sheetTitle];
  if (!sheet) {
    sheet = await doc.addSheet({
      title: sheetTitle,
      headerValues: ["Rank", "Discord Username", "Total Posts", "Total Views", "Avg Views/Post", "Total Likes"]
    });
  } else {
    await sheet.clear();
    await sheet.setHeaderRow(["Rank", "Discord Username", "Total Posts", "Total Views", "Avg Views/Post", "Total Likes"]);
  }
  const currentWeekNum = getWeekNumber(/* @__PURE__ */ new Date());
  const allTweets = await storage.getTweets("views", "desc");
  let tweetsList = allTweets.filter((t) => t.weekNumber === currentWeekNum);
  if (params?.typeFilter) {
    tweetsList = tweetsList.filter((t) => t.type === params.typeFilter);
  }
  const userMap = /* @__PURE__ */ new Map();
  for (const t of tweetsList) {
    const username = t.author || "Unknown";
    if (!userMap.has(username)) {
      userMap.set(username, { totalViews: 0, totalLikes: 0, count: 0 });
    }
    const entry = userMap.get(username);
    entry.totalViews += t.views || 0;
    entry.totalLikes += t.likes || 0;
    entry.count++;
  }
  let sorted = Array.from(userMap.entries()).map(([username, data]) => ({
    username,
    ...data,
    avgViews: data.count > 0 ? Math.round(data.totalViews / data.count) : 0
  }));
  const sortField = params?.sortBy || "totalViews";
  sorted.sort((a, b) => {
    switch (sortField) {
      case "totalViews":
        return b.totalViews - a.totalViews;
      case "avgViews":
        return b.avgViews - a.avgViews;
      case "totalPosts":
        return b.count - a.count;
      case "totalLikes":
        return b.totalLikes - a.totalLikes;
      case "username":
        return a.username.localeCompare(b.username);
      default:
        return b.totalViews - a.totalViews;
    }
  });
  if (params?.minViews && params.minViews > 0) {
    sorted = sorted.filter((u) => u.totalViews >= params.minViews);
  }
  if (params?.minAvgViews && params.minAvgViews > 0) {
    sorted = sorted.filter((u) => u.avgViews >= params.minAvgViews);
  }
  if (params?.topN && params.topN > 0) {
    sorted = sorted.slice(0, params.topN);
  }
  const rows = sorted.map((u, i) => ({
    "Rank": i + 1,
    "Discord Username": u.username,
    "Total Posts": u.count,
    "Total Views": u.totalViews,
    "Avg Views/Post": u.avgViews,
    "Total Likes": u.totalLikes
  }));
  await sheet.addRows(rows);
  return `https://docs.google.com/spreadsheets/d/${sheetId.value}`;
}

// server/routes.ts
async function registerRoutes(httpServer, app2) {
  app2.get(api.tweets.list.path, async (req, res) => {
    const sortBy = req.query.sortBy;
    const order = req.query.order;
    const weekParam = req.query.week;
    const parsed = weekParam ? parseInt(weekParam) : NaN;
    const targetWeek = isNaN(parsed) ? getWeekNumber(/* @__PURE__ */ new Date()) : parsed;
    const allTweets = await storage.getTweets(sortBy, order);
    const weekTweets = allTweets.filter((t) => t.weekNumber === targetWeek);
    res.json(weekTweets);
  });
  app2.post(api.tweets.sync.path, async (req, res) => {
    try {
      const linkDataList = await fetchDiscordMessages();
      console.log(`Found ${linkDataList.length} unique items in Discord`);
      let syncCount = 0;
      for (const linkJson of linkDataList) {
        try {
          const data = JSON.parse(linkJson);
          const url = data.url;
          const tweetId = url.match(/status\/(\d+)/)?.[1];
          if (!tweetId) continue;
          const postedAt = new Date(data.postedAt);
          const existing = await storage.getTweetByUrl(url);
          let views = 0;
          let likes = 0;
          let tweetType = "text";
          let tweetAuthor = data.author;
          let tweetContent = data.content;
          try {
            const details = await fetchTweetDetails(url);
            if (details) {
              views = details.views;
              likes = details.likes;
              tweetType = details.type;
              tweetAuthor = details.author;
              tweetContent = details.content;
            }
          } catch (twErr) {
            console.error(`Tweet enrichment failed for ${url}:`, twErr.message);
          }
          if (!existing) {
            await storage.createTweet({
              url,
              tweetId,
              discordMessageId: `discord-${tweetId}`,
              author: tweetAuthor,
              content: tweetContent,
              likes,
              views,
              type: tweetType,
              weekNumber: getWeekNumber(postedAt),
              postedAt
            });
            syncCount++;
          } else {
            await storage.updateTweetEngagement(url, {
              likes,
              views,
              type: tweetType,
              author: tweetAuthor,
              content: tweetContent
            });
          }
        } catch (tweetErr) {
          console.error(`Error processing Discord link:`, tweetErr.message);
        }
      }
      await storage.deleteOldTweets(getWeekNumber(/* @__PURE__ */ new Date()));
      res.json({ message: "Sync successful", count: syncCount });
    } catch (err) {
      console.error("Sync error:", err);
      res.status(500).json({ message: err.message });
    }
  });
  app2.post(api.tweets.export.path, async (req, res) => {
    try {
      const topN = req.body.topN;
      const sortBy = req.body.sortBy;
      const typeFilter = req.body.typeFilter;
      const minViews = req.body.minViews;
      const minAvgViews = req.body.minAvgViews;
      const spreadsheetUrl = await exportToSheets({ topN, sortBy, typeFilter, minViews, minAvgViews });
      res.json({ message: "Export successful", spreadsheetUrl });
    } catch (err) {
      console.error("Export error:", err);
      res.status(500).json({ message: err.message });
    }
  });
  app2.get("/api/week-info", async (req, res) => {
    const weekParam = req.query.week;
    const weekNum = weekParam ? parseInt(weekParam) : NaN;
    if (!isNaN(weekNum)) {
      const epoch = new Date(Date.UTC(2024, 0, 5, 3, 0, 0));
      const start = new Date(epoch.getTime() + weekNum * 7 * 24 * 60 * 60 * 1e3);
      const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1e3);
      const startStr = start.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
      const endStr = end.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
      res.json({ start: start.toISOString(), end: end.toISOString(), weekLabel: `${startStr} - ${endStr}`, weekNumber: weekNum });
    } else {
      const { start, end, weekLabel } = getWeekBoundaries();
      const weekNumber = getWeekNumber(/* @__PURE__ */ new Date());
      res.json({ start: start.toISOString(), end: end.toISOString(), weekLabel, weekNumber });
    }
  });
  app2.get("/api/available-weeks", async (_req, res) => {
    const currentWeek = getWeekNumber(/* @__PURE__ */ new Date());
    const weeksWithData = await storage.getAvailableWeeks();
    if (!weeksWithData.includes(currentWeek)) {
      weeksWithData.unshift(currentWeek);
    }
    weeksWithData.sort((a, b) => b - a);
    res.json(weeksWithData);
  });
  const SENSITIVE_KEYS = ["discord_token", "google_private_key"];
  function maskValue(key, value) {
    if (!value) return value;
    if (SENSITIVE_KEYS.includes(key)) {
      if (value.length <= 8) return "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022";
      return "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" + value.slice(-4);
    }
    return value;
  }
  app2.get(api.settings.list.path, async (req, res) => {
    const settings3 = await storage.getSettings();
    const masked = settings3.map((s) => ({
      ...s,
      value: maskValue(s.key, s.value)
    }));
    res.json(masked);
  });
  app2.post(api.settings.update.path, async (req, res) => {
    try {
      const input = api.settings.update.input.parse(req.body);
      const updated = await storage.updateSetting(input);
      res.json(updated);
    } catch (err) {
      if (err instanceof z2.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join(".")
        });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.get(api.settings.get.path, async (req, res) => {
    const key = req.params.key;
    const setting = await storage.getSetting(key);
    if (!setting) {
      return res.status(404).json({ message: "Setting not found" });
    }
    res.json({ ...setting, value: maskValue(setting.key, setting.value) });
  });
  return httpServer;
}

// server/vercel.ts
var app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
var dummyServer = createServer(app);
registerRoutes(dummyServer, app);
app.use((err, _req, res, _next) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  console.error("Serverless error:", err);
  if (!res.headersSent) {
    res.status(status).json({ message });
  }
});
var vercel_default = app;
export {
  vercel_default as default
};
