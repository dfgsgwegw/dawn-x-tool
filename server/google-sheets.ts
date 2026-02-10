import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { storage } from './storage';
import { getWeekBoundaries, getWeekNumber } from './week-utils';

interface ExportParams {
  topN?: number;
  sortBy?: string;
  typeFilter?: string;
  minViews?: number;
  minAvgViews?: number;
}

export async function exportToSheets(userId: string, params?: ExportParams) {
  const sheetId = await storage.getSetting(userId, 'google_sheet_id');
  const email = await storage.getSetting(userId, 'google_service_account_email');
  const privateKey = await storage.getSetting(userId, 'google_private_key');

  const missing: string[] = [];
  if (!sheetId) missing.push('Google Sheet ID');
  if (!email) missing.push('Service Account Email');
  if (!privateKey) missing.push('Service Account Private Key');
  if (missing.length > 0 || !sheetId || !email || !privateKey) {
    throw new Error(`Missing Google Sheets settings: ${missing.join(', ')}. Please configure them in Settings.`);
  }

  const serviceAccountAuth = new JWT({
    email: email.value,
    key: privateKey.value.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const doc = new GoogleSpreadsheet(sheetId.value, serviceAccountAuth);
  await doc.loadInfo();

  const { weekLabel } = getWeekBoundaries();
  const sheetTitle = `Week ${weekLabel}`;

  let sheet = doc.sheetsByTitle[sheetTitle];
  if (!sheet) {
    sheet = await doc.addSheet({
      title: sheetTitle,
      headerValues: ['Rank', 'Discord Username', 'Total Posts', 'Total Views', 'Avg Views/Post', 'Total Likes']
    });
  } else {
    await sheet.clear();
    await sheet.setHeaderRow(['Rank', 'Discord Username', 'Total Posts', 'Total Views', 'Avg Views/Post', 'Total Likes']);
  }

  const currentWeekNum = getWeekNumber(new Date());
  const allTweets = await storage.getTweets(userId, 'views', 'desc');
  let tweetsList = allTweets.filter(t => t.weekNumber === currentWeekNum);

  if (params?.typeFilter) {
    tweetsList = tweetsList.filter(t => t.type === params.typeFilter);
  }

  const userMap = new Map<string, { totalViews: number; totalLikes: number; count: number }>();
  for (const t of tweetsList) {
    const username = t.author || 'Unknown';
    if (!userMap.has(username)) {
      userMap.set(username, { totalViews: 0, totalLikes: 0, count: 0 });
    }
    const entry = userMap.get(username)!;
    entry.totalViews += t.views || 0;
    entry.totalLikes += t.likes || 0;
    entry.count++;
  }

  let sorted = Array.from(userMap.entries())
    .map(([username, data]) => ({
      username,
      ...data,
      avgViews: data.count > 0 ? Math.round(data.totalViews / data.count) : 0,
    }));

  const sortField = params?.sortBy || 'totalViews';
  sorted.sort((a, b) => {
    switch (sortField) {
      case 'totalViews': return b.totalViews - a.totalViews;
      case 'avgViews': return b.avgViews - a.avgViews;
      case 'totalPosts': return b.count - a.count;
      case 'totalLikes': return b.totalLikes - a.totalLikes;
      case 'username': return a.username.localeCompare(b.username);
      default: return b.totalViews - a.totalViews;
    }
  });

  if (params?.minViews && params.minViews > 0) {
    sorted = sorted.filter(u => u.totalViews >= params.minViews!);
  }
  if (params?.minAvgViews && params.minAvgViews > 0) {
    sorted = sorted.filter(u => u.avgViews >= params.minAvgViews!);
  }

  if (params?.topN && params.topN > 0) {
    sorted = sorted.slice(0, params.topN);
  }

  const rows = sorted.map((u, i) => ({
    'Rank': i + 1,
    'Discord Username': u.username,
    'Total Posts': u.count,
    'Total Views': u.totalViews,
    'Avg Views/Post': u.avgViews,
    'Total Likes': u.totalLikes,
  }));

  await sheet.addRows(rows);
  return `https://docs.google.com/spreadsheets/d/${sheetId.value}`;
}
