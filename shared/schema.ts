import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const tweets = pgTable("tweets", {
  id: serial("id").primaryKey(),
  discordMessageId: text("discord_message_id").notNull().unique(),
  url: text("url").notNull(),
  tweetId: text("tweet_id"),
  author: text("author"),
  content: text("content"),
  type: text("type"), // 'video', 'photo', 'thread', 'text'
  views: integer("views").default(0),
  likes: integer("likes").default(0),
  postedAt: timestamp("posted_at"),
  collectedAt: timestamp("collected_at").defaultNow(),
  weekNumber: integer("week_number"),
});

export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
});

export const insertTweetSchema = createInsertSchema(tweets).omit({ 
  id: true, 
  collectedAt: true 
});

export const insertSettingSchema = createInsertSchema(settings).omit({ 
  id: true 
});

export type Tweet = typeof tweets.$inferSelect;
export type InsertTweet = z.infer<typeof insertTweetSchema>;
export type Setting = typeof settings.$inferSelect;
export type InsertSetting = z.infer<typeof insertSettingSchema>;

export type TweetType = 'video' | 'photo' | 'thread' | 'text';
