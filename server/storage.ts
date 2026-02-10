import { db } from "./db";
import {
  tweets,
  settings,
  type Tweet,
  type InsertTweet,
  type Setting,
  type InsertSetting
} from "../shared/schema";
import { eq, desc, asc, sql, and } from "drizzle-orm";

export interface IStorage {
  getTweets(userId: string, sortBy?: 'views' | 'likes' | 'postedAt', order?: 'asc' | 'desc'): Promise<Tweet[]>;
  createTweet(tweet: InsertTweet): Promise<Tweet>;
  createOrUpdateTweet(tweet: InsertTweet): Promise<Tweet>;
  deleteOldTweets(userId: string, weekNumber: number): Promise<void>;
  getAvailableWeeks(userId: string): Promise<number[]>;
  getSettings(userId: string): Promise<Setting[]>;
  getSetting(userId: string, key: string): Promise<Setting | undefined>;
  updateSetting(userId: string, setting: InsertSetting): Promise<Setting>;
  getTweetByUrl(userId: string, url: string): Promise<Tweet | undefined>;
  updateTweetEngagement(userId: string, url: string, engagement: Partial<Tweet>): Promise<Tweet | undefined>;
}

export class DatabaseStorage implements IStorage {
  async getTweets(userId: string, sortBy: 'views' | 'likes' | 'postedAt' = 'postedAt', order: 'asc' | 'desc' = 'desc'): Promise<Tweet[]> {
    const orderBy = order === 'asc' ? asc : desc;
    let sortColumn: any = tweets.postedAt;
    if (sortBy === 'views') sortColumn = tweets.views;
    if (sortBy === 'likes') sortColumn = tweets.likes;
    return await db.select().from(tweets).where(eq(tweets.userId, userId)).orderBy(orderBy(sortColumn));
  }

  async createTweet(tweet: InsertTweet): Promise<Tweet> {
    const [newTweet] = await db.insert(tweets).values(tweet).returning();
    return newTweet;
  }

  async getTweetByUrl(userId: string, url: string): Promise<Tweet | undefined> {
    const [tweet] = await db.select().from(tweets).where(and(eq(tweets.userId, userId), eq(tweets.url, url)));
    return tweet;
  }

  async updateTweetEngagement(userId: string, url: string, engagement: Partial<Tweet>): Promise<Tweet | undefined> {
    const [updated] = await db
      .update(tweets)
      .set(engagement)
      .where(and(eq(tweets.userId, userId), eq(tweets.url, url)))
      .returning();
    return updated;
  }

  async createOrUpdateTweet(tweet: InsertTweet): Promise<Tweet> {
    const existing = await this.getTweetByUrl(tweet.userId || 'default', tweet.url);
    if (existing) {
      const [updated] = await db.update(tweets)
        .set({
          views: tweet.views,
          likes: tweet.likes,
          type: tweet.type,
          weekNumber: tweet.weekNumber,
          author: tweet.author,
          content: tweet.content
        })
        .where(eq(tweets.id, existing.id))
        .returning();
      return updated;
    }
    const [newTweet] = await db.insert(tweets).values(tweet).returning();
    return newTweet;
  }

  async deleteOldTweets(userId: string, currentWeekNumber: number): Promise<void> {
    const keepFromWeek = currentWeekNumber - 2;
    await db.delete(tweets).where(and(eq(tweets.userId, userId), sql`${tweets.weekNumber} < ${keepFromWeek}`));
  }

  async getAvailableWeeks(userId: string): Promise<number[]> {
    const result = await db.selectDistinct({ weekNumber: tweets.weekNumber }).from(tweets).where(eq(tweets.userId, userId)).orderBy(desc(tweets.weekNumber));
    return result.map(r => r.weekNumber).filter((w): w is number => w !== null);
  }

  async getSettings(userId: string): Promise<Setting[]> {
    return await db.select().from(settings).where(eq(settings.userId, userId));
  }

  async getSetting(userId: string, key: string): Promise<Setting | undefined> {
    const [setting] = await db.select().from(settings).where(and(eq(settings.userId, userId), eq(settings.key, key)));
    return setting;
  }

  async updateSetting(userId: string, setting: InsertSetting): Promise<Setting> {
    const existing = await this.getSetting(userId, setting.key);
    if (existing) {
      const [updated] = await db.update(settings)
        .set({ value: setting.value })
        .where(eq(settings.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(settings).values({ ...setting, userId }).returning();
    return created;
  }
}

export const storage = new DatabaseStorage();
