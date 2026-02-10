import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useSettings, useUpdateSetting } from "@/hooks/use-settings";
import { Loader2, Save } from "lucide-react";
import { cn } from "@/lib/utils";

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

export default function SettingsPage() {
  const { data: settings, isLoading } = useSettings();
  const updateSetting = useUpdateSetting();
  
  const { register, handleSubmit, setValue, formState: { isDirty } } = useForm<ConfigFormValues>();

  // Pre-fill form when data loads
  useEffect(() => {
    if (settings) {
      settings.forEach((s) => {
        if (s.key in FIELD_LABELS) {
          setValue(s.key as keyof ConfigFormValues, s.value);
        }
      });
    }
  }, [settings, setValue]);

  const onSubmit = async (data: ConfigFormValues) => {
    const promises = Object.entries(data).map(([key, value]) => {
      if (value && !value.startsWith('••••••••')) {
        return updateSetting.mutateAsync({ key, value });
      }
      return Promise.resolve();
    });

    await Promise.all(promises);
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="h-full flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-display font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground mt-1">Configure your API keys and integration details.</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 animate-in">
          
          {/* Discord Section */}
          <section className="bg-card p-6 rounded-2xl border border-border/50 shadow-sm">
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
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{FIELD_LABELS.discord_channel_id}</label>
                <Input 
                  {...register("discord_channel_id")} 
                  placeholder="123456789..." 
                  className="font-mono text-sm bg-secondary/20 focus:bg-background transition-colors"
                />
              </div>
            </div>
          </section>

          {/* Google Sheets Section */}
          <section className="bg-card p-6 rounded-2xl border border-border/50 shadow-sm">
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
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{FIELD_LABELS.google_service_account_email}</label>
                <Input 
                  {...register("google_service_account_email")} 
                  placeholder="service-account@project.iam.gserviceaccount.com" 
                  className="font-mono text-sm bg-secondary/20 focus:bg-background transition-colors"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{FIELD_LABELS.google_private_key}</label>
                <Textarea 
                  {...register("google_private_key")} 
                  placeholder="-----BEGIN PRIVATE KEY-----..." 
                  className="font-mono text-sm bg-secondary/20 focus:bg-background transition-colors h-32"
                />
              </div>
            </div>
          </section>

          <div className="flex justify-end pt-4">
            <Button 
              type="submit" 
              size="lg"
              disabled={updateSetting.isPending}
              className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/25"
            >
              {updateSetting.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save Configuration
            </Button>
          </div>
        </form>
      </div>
    </Layout>
  );
}
