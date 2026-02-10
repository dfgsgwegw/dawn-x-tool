import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type Tweet } from "@shared/routes";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export function useTweets(sortBy: 'views' | 'likes' | 'postedAt' = 'postedAt', order: 'asc' | 'desc' = 'desc', weekNumber?: number) {
  return useQuery({
    queryKey: [api.tweets.list.path, sortBy, order, weekNumber],
    queryFn: async () => {
      const params = new URLSearchParams({ sortBy, order });
      if (weekNumber !== undefined) {
        params.set('week', String(weekNumber));
      }
      const res = await apiRequest("GET", `${api.tweets.list.path}?${params}`);
      return api.tweets.list.responses[200].parse(await res.json());
    },
  });
}

export function useWeekInfo(weekNumber?: number) {
  return useQuery({
    queryKey: ['/api/week-info', weekNumber],
    queryFn: async () => {
      const params = weekNumber !== undefined ? `?week=${weekNumber}` : '';
      const res = await apiRequest("GET", `/api/week-info${params}`);
      return res.json() as Promise<{ start: string; end: string; weekLabel: string; weekNumber: number }>;
    },
  });
}

export function useAvailableWeeks() {
  return useQuery({
    queryKey: ['/api/available-weeks'],
    queryFn: async () => {
      const res = await apiRequest("GET", '/api/available-weeks');
      return res.json() as Promise<number[]>;
    },
  });
}

export function useSyncTweets() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      const res = await apiRequest(api.tweets.sync.method, api.tweets.sync.path);
      return api.tweets.sync.responses[200].parse(await res.json());
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [api.tweets.list.path] });
      queryClient.invalidateQueries({ queryKey: ['/api/available-weeks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/week-info'] });
      toast({
        title: "Sync Complete",
        description: data.message,
      });
    },
    onError: (error) => {
      toast({
        title: "Sync Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useExportTweets() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      const res = await apiRequest(api.tweets.export.method, api.tweets.export.path);
      return api.tweets.export.responses[200].parse(await res.json());
    },
    onSuccess: (data) => {
      toast({
        title: "Export Successful",
        description: data.message,
      });
      if (data.spreadsheetUrl) {
        window.open(data.spreadsheetUrl, '_blank');
      }
    },
    onError: (error) => {
      toast({
        title: "Export Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
