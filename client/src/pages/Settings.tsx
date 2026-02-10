import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useSettings, useUpdateSetting } from "@/hooks/use-settings";
import { Loader2, Save, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type ConfigFormValues = {
  discord_token: string;
  discord_channel_id: string;
  google_sheet_id: string;
  google_service_account_email: string;
  google_private_key: string;
};

const FIELD_LABELS: Record<keyof ConfigFormValues, string> = {
  discord_token: "Discord Bot Token",
  discord_channel_id: "Discord Channel ID",
  google_sheet_id: "Google Sheet ID",
  google_service_account_email: "Service Account Email",
  google_private_key: "Service Account Private Key",
};

const LOCAL_STORAGE_KEY = "dawn-x-settings";

function loadLocalSettings(): Partial<ConfigFormValues> {
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function saveLocalSettings(data: Partial<ConfigFormValues>) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

export default function SettingsPage() {
  const { data: serverSettings, isLoading } = useSettings();
  const updateSetting = useUpdateSetting();
  const { toast } = useToast();
  const [saved, setSaved] = useState(false);

  const { register, handleSubmit, setValue, getValues } = useForm<ConfigFormValues>({
    defaultValues: {
      discord_token: "",
      discord_channel_id: "",
      google_sheet_id: "",
      google_service_account_email: "",
      google_private_key: "",
    },
  });

  useEffect(() => {
    const local = loadLocalSettings();
    (Object.keys(FIELD_LABELS) as (keyof ConfigFormValues)[]).forEach((key) => {
      if (local[key]) {
        setValue(key, local[key]!);
      }
    });
  }, [setValue]);

  const onSubmit = async (data: ConfigFormValues) => {
    const promises = Object.entries(data).map(([key, value]) => {
      if (value && value.trim()) {
        return updateSetting.mutateAsync({ key, value });
      }
      return Promise.resolve();
    });

    try {
      await Promise.all(promises);
      saveLocalSettings(data);
      setSaved(true);
      toast({ title: "Settings saved", description: "Your configuration has been saved to this browser." });
      setTimeout(() => setSaved(false), 2000);
    } catch {
      toast({ title: "Error", description: "Failed to save settings.", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="h-full flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" data-testid="loader-settings" />
        </div>
      </Layout>
    );
  }

  const configuredKeys = new Set(
    (serverSettings || []).filter(s => s.value && !s.value.startsWith('••••')).map(s => s.key)
  );

  return (
    <Layout>
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-display font-bold text-foreground" data-testid="text-settings-title">Settings</h1>
          <p className="text-muted-foreground mt-1">Configure your API keys and integration details. Values are saved locally in your browser for security.</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 animate-in" data-testid="form-settings">

          <section className="bg-card p-6 rounded-md border border-border/50 shadow-sm">
            <h2 className="text-lg font-semibold mb-4 text-foreground flex items-center gap-2">
              <span className="w-1 h-6 bg-[#5865F2] rounded-full block"></span>
              Discord Configuration
            </h2>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">{FIELD_LABELS.discord_token}</label>
                <Input
                  {...register("discord_token")}
                  type="password"
                  placeholder="Bot Token..."
                  className="font-mono text-sm bg-secondary/20 focus:bg-background transition-colors"
                  data-testid="input-discord-token"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{FIELD_LABELS.discord_channel_id}</label>
                <Input
                  {...register("discord_channel_id")}
                  placeholder="123456789..."
                  className="font-mono text-sm bg-secondary/20 focus:bg-background transition-colors"
                  data-testid="input-discord-channel-id"
                />
              </div>
            </div>
          </section>

          <section className="bg-card p-6 rounded-md border border-border/50 shadow-sm">
            <h2 className="text-lg font-semibold mb-4 text-foreground flex items-center gap-2">
              <span className="w-1 h-6 bg-[#0F9D58] rounded-full block"></span>
              Google Sheets Configuration
            </h2>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">{FIELD_LABELS.google_sheet_id}</label>
                <Input
                  {...register("google_sheet_id")}
                  placeholder="Spreadsheet ID from URL..."
                  className="font-mono text-sm bg-secondary/20 focus:bg-background transition-colors"
                  data-testid="input-google-sheet-id"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{FIELD_LABELS.google_service_account_email}</label>
                <Input
                  {...register("google_service_account_email")}
                  placeholder="service-account@project.iam.gserviceaccount.com"
                  className="font-mono text-sm bg-secondary/20 focus:bg-background transition-colors"
                  data-testid="input-google-email"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{FIELD_LABELS.google_private_key}</label>
                <Textarea
                  {...register("google_private_key")}
                  placeholder="-----BEGIN PRIVATE KEY-----..."
                  className="font-mono text-sm bg-secondary/20 focus:bg-background transition-colors h-32"
                  data-testid="input-google-private-key"
                />
              </div>
            </div>
          </section>

          <div className="flex justify-end pt-4">
            <Button
              type="submit"
              size="lg"
              disabled={updateSetting.isPending}
              data-testid="button-save-settings"
            >
              {updateSetting.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : saved ? (
                <Check className="w-4 h-4 mr-2" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              {saved ? "Saved" : "Save Configuration"}
            </Button>
          </div>
        </form>
      </div>
    </Layout>
  );
}
