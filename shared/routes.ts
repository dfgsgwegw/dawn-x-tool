import { z } from 'zod';
import { insertTweetSchema, insertSettingSchema, tweets, settings } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export type { Tweet, InsertTweet, Setting, InsertSetting } from './schema';

export const api = {
  tweets: {
    list: {
      method: 'GET' as const,
      path: '/api/tweets',
      input: z.object({
        sortBy: z.enum(['views', 'likes', 'postedAt']).optional(),
        order: z.enum(['asc', 'desc']).optional(),
      }).optional(),
      responses: {
        200: z.array(z.custom<typeof tweets.$inferSelect>()),
      },
    },
    sync: {
      method: 'POST' as const,
      path: '/api/tweets/sync',
      responses: {
        200: z.object({ message: z.string(), count: z.number() }),
        500: errorSchemas.internal,
      },
    },
    export: {
      method: 'POST' as const,
      path: '/api/tweets/export',
      responses: {
        200: z.object({ message: z.string(), spreadsheetUrl: z.string().optional() }),
        500: errorSchemas.internal,
      },
    }
  },
  settings: {
    list: {
      method: 'GET' as const,
      path: '/api/settings',
      responses: {
        200: z.array(z.custom<typeof settings.$inferSelect>()),
      },
    },
    update: {
      method: 'POST' as const,
      path: '/api/settings',
      input: insertSettingSchema,
      responses: {
        200: z.custom<typeof settings.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/settings/:key',
      responses: {
        200: z.custom<typeof settings.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    }
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
