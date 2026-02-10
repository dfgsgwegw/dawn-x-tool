export async function fetchTweetDetails(url: string) {
  const match = url.match(/status\/(\d+)/);
  if (!match) return null;
  const tweetId = match[1];

  try {
    const res = await fetch(`https://api.fxtwitter.com/status/${tweetId}`, {
      headers: {
        'User-Agent': 'DawnXTool/1.0'
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

    let type: 'video' | 'photo' | 'thread' | 'text' = 'text';
    if (tweet.media?.videos?.length > 0) {
      type = 'video';
    } else if (tweet.media?.photos?.length > 0) {
      type = 'photo';
    }

    return {
      id: tweetId,
      author: tweet.author?.screen_name || 'unknown',
      content: tweet.text || '',
      views: tweet.views ?? 0,
      likes: tweet.likes ?? 0,
      postedAt: tweet.created_at ? new Date(tweet.created_at) : new Date(),
      type,
    };
  } catch (error) {
    console.error(`Error fetching tweet ${tweetId}:`, error);
    return null;
  }
}
