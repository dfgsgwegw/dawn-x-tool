import { db } from "./db";
import {
  tweets,
  settings,
  type Tweet,
  type InsertTweet,
  type Setting,
  type InsertSetting
} from "../shared/schema";
import { eq, desc, asc, sql } from "drizzle-orm";

export interface IStorage {
  // Tweets
  getTweets(sortBy?: 'views' | 'likes' | 'postedAt', order?: 'asc' | 'desc'): Promise<Tweet[]>;
  createTweet(tweet: InsertTweet): Promise<Tweet>;
  createOrUpdateTweet(tweet: InsertTweet): Promise<Tweet>;
  deleteOldTweets(weekNumber: number): Promise<void>;
  getAvailableWeeks(): Promise<number[]>;
  
  // Settings
  getSettings(): Promise<Setting[]>;
  getSetting(key: string): Promise<Setting | undefined>;
  updateSetting(setting: InsertSetting): Promise<Setting>;
  getTweetByUrl(url: string): Promise<Tweet | undefined>;
  updateTweetEngagement(url: string, engagement: Partial<Tweet>): Promise<Tweet | undefined>;
}

export class DatabaseStorage implements IStorage {
  async getTweets(sortBy: 'views' | 'likes' | 'postedAt' = 'postedAt', order: 'asc' | 'desc' = 'desc'): Promise<Tweet[]> {
    const orderBy = order === 'asc' ? asc : desc;
    let sortColumn: any = tweets.postedAt;
    
    if (sortBy === 'views') sortColumn = tweets.views;
    if (sortBy === 'likes') sortColumn = tweets.likes;

    return await db.select().from(tweets).orderBy(orderBy(sortColumn));
  }

  async createTweet(tweet: InsertTweet): Promise<Tweet> {
    const [newTweet] = await db.insert(tweets).values(tweet).returning();
    return newTweet;
  }

  async getTweetByUrl(url: string): Promise<Tweet | undefined> {
    const [tweet] = await db.select().from(tweets).where(eq(tweets.url, url));
    return tweet;
  }

  async updateTweetEngagement(url: string, engagement: Partial<Tweet>): Promise<Tweet | undefined> {
    const [updated] = await db
      .update(tweets)
      .set(engagement)
      .where(eq(tweets.url, url))
      .returning();
    return updated;
  }

  async createOrUpdateTweet(tweet: InsertTweet): Promise<Tweet> {
    const [savedTweet] = await db.insert(tweets)
      .values(tweet)
      .onConflictDoUpdate({
        target: tweets.url,
        set: {
          views: tweet.views,
          likes: tweet.likes,
          type: tweet.type,
          weekNumber: tweet.weekNumber,
          author: tweet.author,
          content: tweet.content
        }
      })
      .returning();
    return savedTweet;
  }

  async deleteOldTweets(currentWeekNumber: number): Promise<void> {
    const keepFromWeek = currentWeekNumber - 2;
    await db.delete(tweets).where(sql`${tweets.weekNumber} < ${keepFromWeek}`);
  }

  async getAvailableWeeks(): Promise<number[]> {
    const result = await db.selectDistinct({ weekNumber: tweets.weekNumber }).from(tweets).orderBy(desc(tweets.weekNumber));
    return result.map(r => r.weekNumber).filter((w): w is number => w !== null);
  }

  async getSettings(): Promise<Setting[]> {
    return await db.select().from(settings);
  }

  async getSetting(key: string): Promise<Setting | undefined> {
    const [setting] = await db.select().from(settings).where(eq(settings.key, key));
    return setting;
  }

  async updateSetting(setting: InsertSetting): Promise<Setting> {
    const [updated] = await db.insert(settings)
      .values(setting)
      .onConflictDoUpdate({
        target: settings.key,
        set: { value: setting.value }
      })
      .returning();
    return updated;
  }
}

export const storage = new DatabaseStorage();
