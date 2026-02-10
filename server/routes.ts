import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "../shared/routes";
import { z } from "zod";
import { fetchTweetDetails } from "./twitter";
import { fetchDiscordMessages } from "./discord";
import { getWeekBoundaries, getWeekNumber } from "./week-utils";
import { exportToSheets } from "./google-sheets";

import crypto from 'crypto';

function getUserId(req: any): string {
  const header = req.headers['x-user-id'] as string;
  if (header && header.length > 8) return header;
  return `anon-${crypto.randomUUID()}`;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.get(api.tweets.list.path, async (req, res) => {
    const userId = getUserId(req);
    const sortBy = req.query.sortBy as 'views' | 'likes' | 'postedAt' | undefined;
    const order = req.query.order as 'asc' | 'desc' | undefined;
    const weekParam = req.query.week as string | undefined;
    const parsed = weekParam ? parseInt(weekParam) : NaN;
    const targetWeek = isNaN(parsed) ? getWeekNumber(new Date()) : parsed;
    const allTweets = await storage.getTweets(userId, sortBy, order);
    const weekTweets = allTweets.filter(t => t.weekNumber === targetWeek);
    res.json(weekTweets);
  });

  app.post(api.tweets.sync.path, async (req, res) => {
    const userId = getUserId(req);
    try {
      const linkDataList = await fetchDiscordMessages(userId);
      console.log(`Found ${linkDataList.length} unique items in Discord`);
      
      let syncCount = 0;
      for (const linkJson of linkDataList) {
        try {
          const data = JSON.parse(linkJson);
          const url = data.url;
          const tweetId = url.match(/status\/(\d+)/)?.[1];
          if (!tweetId) continue;

          const postedAt = new Date(data.postedAt);
          const existing = await storage.getTweetByUrl(userId, url);

          let views = 0;
          let likes = 0;
          let tweetType: string = 'text';
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
          } catch (twErr: any) {
            console.error(`Tweet enrichment failed for ${url}:`, twErr.message);
          }

          if (!existing) {
            await storage.createTweet({
              url,
              tweetId,
              userId,
              discordMessageId: `discord-${tweetId}`,
              author: tweetAuthor,
              content: tweetContent,
              likes,
              views,
              type: tweetType,
              weekNumber: getWeekNumber(postedAt),
              postedAt,
            });
            syncCount++;
          } else {
            await storage.updateTweetEngagement(userId, url, {
              likes,
              views,
              type: tweetType,
              author: tweetAuthor,
              content: tweetContent,
            });
          }
        } catch (tweetErr: any) {
          console.error(`Error processing Discord link:`, tweetErr.message);
        }
      }

      await storage.deleteOldTweets(userId, getWeekNumber(new Date()));
      res.json({ message: "Sync successful", count: syncCount });
    } catch (err: any) {
      console.error('Sync error:', err);
      res.status(500).json({ message: err.message });
    }
  });

  app.post(api.tweets.export.path, async (req, res) => {
    const userId = getUserId(req);
    try {
      const topN = req.body.topN as number | undefined;
      const sortBy = req.body.sortBy as string | undefined;
      const typeFilter = req.body.typeFilter as string | undefined;
      const minViews = req.body.minViews as number | undefined;
      const minAvgViews = req.body.minAvgViews as number | undefined;
      const spreadsheetUrl = await exportToSheets(userId, { topN, sortBy, typeFilter, minViews, minAvgViews });
      res.json({ message: "Export successful", spreadsheetUrl });
    } catch (err: any) {
      console.error('Export error:', err);
      res.status(500).json({ message: err.message });
    }
  });

  app.get('/api/week-info', async (req, res) => {
    const weekParam = req.query.week as string | undefined;
    const weekNum = weekParam ? parseInt(weekParam) : NaN;
    if (!isNaN(weekNum)) {
      const epoch = new Date(Date.UTC(2024, 0, 5, 3, 0, 0));
      const start = new Date(epoch.getTime() + weekNum * 7 * 24 * 60 * 60 * 1000);
      const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
      const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
      const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
      res.json({ start: start.toISOString(), end: end.toISOString(), weekLabel: `${startStr} - ${endStr}`, weekNumber: weekNum });
    } else {
      const { start, end, weekLabel } = getWeekBoundaries();
      const weekNumber = getWeekNumber(new Date());
      res.json({ start: start.toISOString(), end: end.toISOString(), weekLabel, weekNumber });
    }
  });

  app.get('/api/available-weeks', async (req, res) => {
    const userId = getUserId(req);
    const currentWeek = getWeekNumber(new Date());
    const weeksWithData = await storage.getAvailableWeeks(userId);
    if (!weeksWithData.includes(currentWeek)) {
      weeksWithData.unshift(currentWeek);
    }
    weeksWithData.sort((a, b) => b - a);
    res.json(weeksWithData);
  });

  // Settings routes

  app.get(api.settings.list.path, async (req, res) => {
    const userId = getUserId(req);
    const settingsList = await storage.getSettings(userId);
    const redacted = settingsList.map(s => ({
      ...s,
      value: s.value ? '••••configured••••' : '',
    }));
    res.json(redacted);
  });

  app.post(api.settings.update.path, async (req, res) => {
    const userId = getUserId(req);
    try {
      const input = api.settings.update.input.parse(req.body);
      const updated = await storage.updateSetting(userId, input);
      res.json({ ...updated, value: '••••configured••••' });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get(api.settings.get.path, async (req, res) => {
    const userId = getUserId(req);
    const key = req.params.key as string;
    const setting = await storage.getSetting(userId, key);
    if (!setting) {
      return res.status(404).json({ message: 'Setting not found' });
    }
    res.json({ ...setting, value: setting.value ? '••••configured••••' : '' });
  });

  return httpServer;
}
