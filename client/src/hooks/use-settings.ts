import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type Setting, type InsertSetting } from "@shared/routes";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export function useSettings() {
  return useQuery<Setting[]>({
    queryKey: [api.settings.list.path],
    queryFn: async () => {
      const res = await apiRequest("GET", api.settings.list.path);
      return res.json();
    },
  });
}

export function useUpdateSetting() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: InsertSetting) => {
      const res = await apiRequest(api.settings.update.method, api.settings.update.path, data);
      return api.settings.update.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.settings.list.path] });
      toast({
        title: "Settings Saved",
        description: "Configuration has been updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
