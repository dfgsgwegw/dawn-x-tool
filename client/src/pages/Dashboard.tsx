import { useState, useMemo, Fragment } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTweets, useSyncTweets, useWeekInfo, useAvailableWeeks } from "@/hooks/use-tweets";
import { useToast } from "@/hooks/use-toast";
import { Layout } from "@/components/Layout";
import { StatsCard } from "@/components/StatsCard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  RefreshCw,
  Download,
  Eye,
  Heart,
  Video,
  Image as ImageIcon,
  FileText,
  Twitter,
  ExternalLink,
  Calendar,
  Users,
  Search,
  ChevronDown,
  ChevronRight,
  FileDown,
  Sheet,
} from "lucide-react";
import { Tweet } from "@shared/schema";
import { api } from "@shared/routes";

type SortField = 'totalPosts' | 'totalViews' | 'totalLikes' | 'avgViews' | 'username';
type SortOrder = 'asc' | 'desc';

interface UserSummary {
  username: string;
  tweets: Tweet[];
  totalViews: number;
  totalLikes: number;
  avgViews: number;
}

interface BuildOptions {
  typeFilter: string;
  searchQuery: string;
  sortBy: SortField;
  sortOrder: SortOrder;
  topN: string;
  minViews?: number;
  minAvgViews?: number;
}

function buildUserSummaries(tweets: Tweet[], opts: BuildOptions): UserSummary[] {
  let filtered = [...tweets];

  if (opts.typeFilter !== 'all') {
    filtered = filtered.filter(t => t.type === opts.typeFilter);
  }

  if (opts.searchQuery.trim()) {
    const q = opts.searchQuery.toLowerCase();
    filtered = filtered.filter(t =>
      (t.author?.toLowerCase().includes(q)) ||
      (t.content?.toLowerCase().includes(q)) ||
      (t.url?.toLowerCase().includes(q))
    );
  }

  const map = new Map<string, UserSummary>();
  for (const tweet of filtered) {
    const username = tweet.author || 'Unknown';
    if (!map.has(username)) {
      map.set(username, { username, tweets: [], totalViews: 0, totalLikes: 0, avgViews: 0 });
    }
    const entry = map.get(username)!;
    entry.tweets.push(tweet);
    entry.totalViews += tweet.views || 0;
    entry.totalLikes += tweet.likes || 0;
  }

  let summaries = Array.from(map.values());
  summaries.forEach(s => {
    s.avgViews = s.tweets.length > 0 ? Math.round(s.totalViews / s.tweets.length) : 0;
  });

  if (opts.minViews && opts.minViews > 0) {
    summaries = summaries.filter(s => s.totalViews >= opts.minViews!);
  }
  if (opts.minAvgViews && opts.minAvgViews > 0) {
    summaries = summaries.filter(s => s.avgViews >= opts.minAvgViews!);
  }

  summaries.sort((a, b) => {
    let cmp = 0;
    switch (opts.sortBy) {
      case 'username':
        cmp = a.username.localeCompare(b.username);
        break;
      case 'totalPosts':
        cmp = a.tweets.length - b.tweets.length;
        break;
      case 'totalViews':
        cmp = a.totalViews - b.totalViews;
        break;
      case 'totalLikes':
        cmp = a.totalLikes - b.totalLikes;
        break;
      case 'avgViews':
        cmp = a.avgViews - b.avgViews;
        break;
    }
    return opts.sortOrder === 'desc' ? -cmp : cmp;
  });

  const limit = opts.topN === 'all' ? summaries.length : parseInt(opts.topN);
  return summaries.slice(0, limit);
}

export default function Dashboard() {
  const [selectedWeek, setSelectedWeek] = useState<number | undefined>(undefined);
  const [sortBy, setSortBy] = useState<SortField>('totalViews');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [topN, setTopN] = useState<string>('all');
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());

  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportTarget, setExportTarget] = useState<'csv' | 'sheets'>('csv');
  const [exportTopN, setExportTopN] = useState<string>('all');
  const [exportCustomTopN, setExportCustomTopN] = useState<string>('');
  const [exportTypeFilter, setExportTypeFilter] = useState<string>('all');
  const [exportSortBy, setExportSortBy] = useState<SortField>('totalViews');
  const [exportSortOrder, setExportSortOrder] = useState<SortOrder>('desc');
  const [exportMinViews, setExportMinViews] = useState<string>('');
  const [exportMinAvgViews, setExportMinAvgViews] = useState<string>('');

  const { data: tweets, isLoading, isError } = useTweets('postedAt', 'desc', selectedWeek);
  const { data: weekInfo } = useWeekInfo(selectedWeek);
  const { data: availableWeeks } = useAvailableWeeks();
  const syncMutation = useSyncTweets();
  const { toast } = useToast();

  const sheetsExportMutation = useMutation({
    mutationFn: async (params: { topN?: number; sortBy?: string; typeFilter?: string; minViews?: number; minAvgViews?: number }) => {
      const res = await fetch(api.tweets.export.path, {
        method: api.tweets.export.method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        const msg = errorData?.message || "Failed to export tweets";
        throw new Error(msg);
      }
      return api.tweets.export.responses[200].parse(await res.json());
    },
    onSuccess: (data) => {
      toast({ title: "Export Successful", description: data.message });
      if (data.spreadsheetUrl) {
        window.open(data.spreadsheetUrl, '_blank');
      }
      setExportDialogOpen(false);
    },
    onError: (error) => {
      toast({ title: "Export Failed", description: error.message, variant: "destructive" });
    },
  });

  const filteredTweets = useMemo(() => {
    if (!tweets) return [];
    let filtered = [...tweets];
    if (typeFilter !== 'all') {
      filtered = filtered.filter(t => t.type === typeFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(t =>
        (t.author?.toLowerCase().includes(q)) ||
        (t.content?.toLowerCase().includes(q)) ||
        (t.url?.toLowerCase().includes(q))
      );
    }
    return filtered;
  }, [tweets, typeFilter, searchQuery]);

  const userSummaries = useMemo(() => {
    if (!tweets) return [];
    return buildUserSummaries(tweets, { typeFilter, searchQuery, sortBy, sortOrder, topN });
  }, [tweets, typeFilter, searchQuery, sortBy, sortOrder, topN]);

  const totalViews = filteredTweets.reduce((acc, t) => acc + (t.views || 0), 0);
  const totalLikes = filteredTweets.reduce((acc, t) => acc + (t.likes || 0), 0);
  const totalTweets = filteredTweets.length;
  const uniqueUsers = new Set(filteredTweets.map(t => t.author || 'Unknown')).size;

  const toggleUser = (username: string) => {
    setExpandedUsers(prev => {
      const next = new Set(prev);
      if (next.has(username)) next.delete(username);
      else next.add(username);
      return next;
    });
  };

  const getTypeIcon = (type: string | null) => {
    switch (type) {
      case 'video': return <Video className="w-3.5 h-3.5 text-blue-500" />;
      case 'photo': return <ImageIcon className="w-3.5 h-3.5 text-purple-500" />;
      case 'thread': return <FileText className="w-3.5 h-3.5 text-green-500" />;
      default: return <Twitter className="w-3.5 h-3.5 text-muted-foreground" />;
    }
  };

  const formatDate = (date: string | Date | null) => {
    if (!date) return '-';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' });
  };

  const openExportDialog = (target: 'csv' | 'sheets') => {
    setExportTarget(target);
    setExportTopN(topN);
    setExportCustomTopN('');
    setExportTypeFilter(typeFilter);
    setExportSortBy(sortBy);
    setExportSortOrder(sortOrder);
    setExportMinViews('');
    setExportMinAvgViews('');
    setExportDialogOpen(true);
  };

  const getEffectiveTopN = (): string => {
    if (exportTopN === 'custom') {
      const val = parseInt(exportCustomTopN);
      return val > 0 ? String(val) : 'all';
    }
    return exportTopN;
  };

  const handleExport = () => {
    const effectiveTopN = getEffectiveTopN();
    const minViews = parseInt(exportMinViews) || 0;
    const minAvgViews = parseInt(exportMinAvgViews) || 0;

    if (exportTarget === 'csv') {
      if (!tweets) return;
      const exportData = buildUserSummaries(tweets, {
        typeFilter: exportTypeFilter,
        searchQuery: '',
        sortBy: exportSortBy,
        sortOrder: exportSortOrder,
        topN: effectiveTopN,
        minViews,
        minAvgViews,
      });
      downloadCSV(exportData);
      setExportDialogOpen(false);
    } else {
      const topNVal = effectiveTopN === 'all' ? undefined : parseInt(effectiveTopN);
      sheetsExportMutation.mutate({
        topN: topNVal,
        sortBy: exportSortBy,
        typeFilter: exportTypeFilter === 'all' ? undefined : exportTypeFilter,
        minViews: minViews || undefined,
        minAvgViews: minAvgViews || undefined,
      });
    }
  };

  const downloadCSV = (data: UserSummary[]) => {
    const headers = ['Rank', 'Discord Username', 'Total Posts', 'Total Views', 'Avg Views/Post', 'Total Likes'];
    const rows = data.map((user, i) => [
      i + 1,
      user.username,
      user.tweets.length,
      user.totalViews,
      user.avgViews,
      user.totalLikes,
    ]);

    const escapeCSV = (value: unknown): string => {
      const str = String(value);
      if (typeof value === 'string') {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const csvContent = [
      headers.map(h => escapeCSV(h)).join(','),
      ...rows.map(r => r.map(v => escapeCSV(v)).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const week = weekInfo?.weekLabel?.replace(/\s/g, '_') || 'export';
    link.download = `tweet_tracker_${week}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const typeLabel = (val: string) => {
    switch (val) {
      case 'all': return 'All Types';
      case 'text': return 'Text';
      case 'video': return 'Video';
      case 'photo': return 'Photo';
      case 'thread': return 'Thread';
      default: return val;
    }
  };

  const sortLabel = (val: SortField) => {
    switch (val) {
      case 'totalViews': return 'Total Views';
      case 'avgViews': return 'Avg Views';
      case 'totalPosts': return 'Total Posts';
      case 'totalLikes': return 'Total Likes';
      case 'username': return 'Username';
    }
  };

  return (
    <>
    <Layout>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground" data-testid="text-page-title">Weekly Tweet Tracker</h1>
          {weekInfo && (
            <div className="flex items-center gap-2 mt-1">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground" data-testid="text-week-range">
                Week: {weekInfo.weekLabel} (Fri 3:00 UTC)
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <Button
            variant="outline"
            onClick={() => openExportDialog('csv')}
            disabled={!tweets || tweets.length === 0}
            data-testid="button-csv"
          >
            <FileDown className="w-4 h-4 mr-2" />
            CSV
          </Button>

          <Button
            variant="outline"
            onClick={() => openExportDialog('sheets')}
            disabled={!tweets || tweets.length === 0}
            data-testid="button-export"
          >
            <Sheet className="w-4 h-4 mr-2" />
            Google Sheets
          </Button>

          <Button
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            data-testid="button-sync"
          >
            {syncMutation.isPending ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Sync Now
          </Button>
        </div>
      </div>

      {availableWeeks && availableWeeks.length > 1 && (
        <div className="flex items-center gap-2 mb-4 flex-wrap" data-testid="week-tabs">
          {availableWeeks.map((wn) => {
            const currentWeek = availableWeeks[0];
            const weeksAgo = currentWeek - wn;
            const isSelected = selectedWeek === undefined ? weeksAgo === 0 : selectedWeek === wn;
            return (
              <Button
                key={wn}
                variant={isSelected ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedWeek(weeksAgo === 0 ? undefined : wn)}
                data-testid={`button-week-${wn}`}
              >
                {weeksAgo === 0 ? "This Week" : weeksAgo === 1 ? "Last Week" : `${weeksAgo} Weeks Ago`}
              </Button>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatsCard title="Total Tweets" value={totalTweets} icon={Twitter} />
        <StatsCard title="Total Views" value={totalViews.toLocaleString()} icon={Eye} />
        <StatsCard title="Total Likes" value={totalLikes.toLocaleString()} icon={Heart} />
        <StatsCard title="Users" value={uniqueUsers} icon={Users} />
      </div>

      <Card className="p-4 mb-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by user or content..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              data-testid="input-search"
            />
          </div>

          <Select value={topN} onValueChange={setTopN}>
            <SelectTrigger className="w-[130px]" data-testid="select-top-n">
              <SelectValue placeholder="Show" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Users</SelectItem>
              <SelectItem value="10">Top 10</SelectItem>
              <SelectItem value="25">Top 25</SelectItem>
              <SelectItem value="50">Top 50</SelectItem>
              <SelectItem value="100">Top 100</SelectItem>
              <SelectItem value="200">Top 200</SelectItem>
            </SelectContent>
          </Select>

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[140px]" data-testid="select-type-filter">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="text">Text</SelectItem>
              <SelectItem value="video">Video</SelectItem>
              <SelectItem value="photo">Photo</SelectItem>
              <SelectItem value="thread">Thread</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortField)}>
            <SelectTrigger className="w-[150px]" data-testid="select-sort-by">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="totalViews">Total Views</SelectItem>
              <SelectItem value="avgViews">Avg Views</SelectItem>
              <SelectItem value="totalPosts">Total Posts</SelectItem>
              <SelectItem value="totalLikes">Total Likes</SelectItem>
              <SelectItem value="username">Username</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="icon"
            onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
            data-testid="button-sort-order"
          >
            <span className="text-xs font-mono">{sortOrder === 'desc' ? 'Z-A' : 'A-Z'}</span>
          </Button>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex flex-col items-center justify-center text-muted-foreground">
            <RefreshCw className="w-8 h-8 animate-spin mb-4 opacity-50" />
            <p>Loading data...</p>
          </div>
        ) : isError ? (
          <div className="p-12 flex flex-col items-center justify-center text-destructive">
            <p>Failed to load tweets. Please try again.</p>
          </div>
        ) : userSummaries.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center text-muted-foreground">
            <Twitter className="w-8 h-8 mb-4 opacity-30" />
            <p>No tweets collected yet. Click Sync Now to fetch from Discord.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px] text-center">#</TableHead>
                  <TableHead className="w-[40px]"></TableHead>
                  <TableHead>Discord User</TableHead>
                  <TableHead className="text-center">Posts</TableHead>
                  <TableHead className="text-right">Views</TableHead>
                  <TableHead className="text-right">Avg/Post</TableHead>
                  <TableHead className="text-right">Likes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {userSummaries.map((user, index) => {
                  const isExpanded = expandedUsers.has(user.username);
                  return (
                    <Fragment key={user.username}>
                      <TableRow
                        className="cursor-pointer"
                        onClick={() => toggleUser(user.username)}
                        data-testid={`row-user-${user.username}`}
                      >
                        <TableCell className="text-center font-mono text-sm text-muted-foreground" data-testid={`text-rank-${index + 1}`}>
                          {index + 1}
                        </TableCell>
                        <TableCell>
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          )}
                        </TableCell>
                        <TableCell className="font-medium" data-testid={`text-username-${user.username}`}>
                          {user.username}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary">{user.tweets.length}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {user.totalViews.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm text-muted-foreground">
                          {user.avgViews.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {user.totalLikes.toLocaleString()}
                        </TableCell>
                      </TableRow>

                      {isExpanded && user.tweets.map((tweet) => (
                        <TableRow
                          key={tweet.id}
                          className="bg-muted/30"
                          data-testid={`row-tweet-${tweet.id}`}
                        >
                          <TableCell></TableCell>
                          <TableCell></TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getTypeIcon(tweet.type)}
                              <a
                                href={tweet.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-sm text-primary hover:underline truncate max-w-[300px] inline-block"
                                onClick={(e) => e.stopPropagation()}
                                data-testid={`link-tweet-${tweet.id}`}
                              >
                                {tweet.url}
                              </a>
                              <ExternalLink className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                            </div>
                          </TableCell>
                          <TableCell className="text-center text-xs text-muted-foreground">
                            {formatDate(tweet.postedAt)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {(tweet.views || 0).toLocaleString()}
                          </TableCell>
                          <TableCell></TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {(tweet.likes || 0).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

    </Layout>

      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-visible flex flex-col">
          <DialogHeader>
            <DialogTitle data-testid="text-export-title">
              Export to {exportTarget === 'csv' ? 'CSV' : 'Google Sheets'}
            </DialogTitle>
            <DialogDescription>
              Choose how many users and which data to include in your export.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2 overflow-y-auto flex-1">
            <div className="flex flex-col gap-1.5">
              <Label>Number of Users</Label>
              <Select value={exportTopN} onValueChange={(v) => { setExportTopN(v); if (v !== 'custom') setExportCustomTopN(''); }}>
                <SelectTrigger data-testid="select-export-top-n">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  <SelectItem value="10">Top 10</SelectItem>
                  <SelectItem value="25">Top 25</SelectItem>
                  <SelectItem value="50">Top 50</SelectItem>
                  <SelectItem value="100">Top 100</SelectItem>
                  <SelectItem value="200">Top 200</SelectItem>
                  <SelectItem value="custom">Custom...</SelectItem>
                </SelectContent>
              </Select>
              {exportTopN === 'custom' && (
                <Input
                  type="number"
                  min="1"
                  placeholder="Enter number of users..."
                  value={exportCustomTopN}
                  onChange={(e) => setExportCustomTopN(e.target.value)}
                  data-testid="input-export-custom-top-n"
                />
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Min Total Views</Label>
              <Input
                type="number"
                min="0"
                placeholder="e.g. 500 (leave empty for no minimum)"
                value={exportMinViews}
                onChange={(e) => setExportMinViews(e.target.value)}
                data-testid="input-export-min-views"
              />
              <p className="text-xs text-muted-foreground">Only include users with this many total views or more</p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Min Avg Views per Post</Label>
              <Input
                type="number"
                min="0"
                placeholder="e.g. 400 (leave empty for no minimum)"
                value={exportMinAvgViews}
                onChange={(e) => setExportMinAvgViews(e.target.value)}
                data-testid="input-export-min-avg-views"
              />
              <p className="text-xs text-muted-foreground">Only include users with this average views per post or more</p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Tweet Type</Label>
              <Select value={exportTypeFilter} onValueChange={setExportTypeFilter}>
                <SelectTrigger data-testid="select-export-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="video">Video</SelectItem>
                  <SelectItem value="photo">Photo</SelectItem>
                  <SelectItem value="thread">Thread</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-3">
              <div className="flex flex-col gap-1.5 flex-1">
                <Label>Sort By</Label>
                <Select value={exportSortBy} onValueChange={(v) => setExportSortBy(v as SortField)}>
                  <SelectTrigger data-testid="select-export-sort">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="totalViews">Total Views</SelectItem>
                    <SelectItem value="avgViews">Avg Views</SelectItem>
                    <SelectItem value="totalPosts">Total Posts</SelectItem>
                    <SelectItem value="totalLikes">Total Likes</SelectItem>
                    <SelectItem value="username">Username</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5 flex-1">
                <Label>Sort Order</Label>
                <Select value={exportSortOrder} onValueChange={(v) => setExportSortOrder(v as SortOrder)}>
                  <SelectTrigger data-testid="select-export-order">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="desc">Highest First</SelectItem>
                    <SelectItem value="asc">Lowest First</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setExportDialogOpen(false)} data-testid="button-export-cancel">
              Cancel
            </Button>
            <Button
              onClick={handleExport}
              disabled={sheetsExportMutation.isPending}
              data-testid="button-export-confirm"
            >
              {sheetsExportMutation.isPending ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : exportTarget === 'csv' ? (
                <FileDown className="w-4 h-4 mr-2" />
              ) : (
                <Sheet className="w-4 h-4 mr-2" />
              )}
              {exportTarget === 'csv' ? 'Download CSV' : 'Export to Sheets'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
