import { Client, GatewayIntentBits, type TextChannel, type Collection, type Message } from 'discord.js';
import { storage } from './storage';
import { getWeekBoundaries } from './week-utils';

export async function fetchDiscordMessages(userId: string) {
  const token = await storage.getSetting(userId, 'discord_token');
  const channelId = await storage.getSetting(userId, 'discord_channel_id');

  if (!token || !channelId || token.value === '********' || channelId.value === '********') {
    throw new Error('Discord credentials not fully configured');
  }

  const client = new Client({ 
    intents: [
      GatewayIntentBits.Guilds, 
      GatewayIntentBits.GuildMessages, 
      GatewayIntentBits.MessageContent
    ] 
  });
  
  return new Promise<string[]>((resolve, reject) => {
    client.once('ready', async () => {
      console.log(`Discord bot logged in as ${client.user?.tag}`);
      try {
        const channel = await client.channels.fetch(channelId.value);
        if (!channel || !('messages' in channel)) {
          throw new Error('Invalid channel or bot has no access');
        }

        const textChannel = channel as TextChannel;
        const { start: weekStart } = getWeekBoundaries();
        const xLinks: string[] = [];
        const xRegex = /https?:\/\/(?:www\.)?(?:x\.com|twitter\.com)\/\w+\/status\/\d+/g;

        let lastMessageId: string | undefined;
        let keepFetching = true;
        let totalFetched = 0;

        while (keepFetching) {
          const options: { limit: number; before?: string } = { limit: 100 };
          if (lastMessageId) {
            options.before = lastMessageId;
          }

          const messages: Collection<string, Message> = await textChannel.messages.fetch(options);

          if (messages.size === 0) {
            keepFetching = false;
            break;
          }

          totalFetched += messages.size;
          let reachedOlderThanWeek = false;

          messages.forEach(msg => {
            if (msg.createdAt < weekStart) {
              reachedOlderThanWeek = true;
              return;
            }

            const content = msg.content;
            const matches = content.match(xRegex);
            if (matches) {
              matches.forEach(url => {
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
