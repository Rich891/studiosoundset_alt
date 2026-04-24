import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Settings as SettingsIcon, Save, User, Globe, Bell, Shield } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import PageHeader from '@/components/ui/PageHeader';
import { toast } from 'sonner';

export default function Settings() {
  const queryClient = useQueryClient();
  const { data: studio } = useQuery({
    queryKey: ['studio'],
    queryFn: async () => {
      const studios = await base44.entities.Studio.list();
      return studios[0] || null;
    },
  });
  const [studioForm, setStudioForm] = useState({ name: '', address: '', timezone: 'Europe/Berlin', defaultLanguage: 'de' });

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (studio?.id) {
        return base44.entities.Studio.update(studio.id, data);
      } else {
        return base44.entities.Studio.create(data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['studio'] });
      toast.success('Einstellungen gespeichert.');
    },
  });

  const form = { ...{ name: '', address: '', timezone: 'Europe/Berlin', defaultLanguage: 'de' }, ...studio, ...studioForm };

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <PageHeader title="Einstellungen" subtitle="Studio-Konfiguration und App-Einstellungen" />

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="w-4 h-4 text-primary" /> Studio-Konfiguration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Studioname</Label>
            <Input
              value={form.name}
              onChange={e => setStudioForm(p => ({ ...p, name: e.target.value }))}
              className="mt-1.5 bg-muted/50"
              placeholder="Mein Fitnessstudio"
            />
          </div>
          <div>
            <Label>Adresse</Label>
            <Input
              value={form.address}
              onChange={e => setStudioForm(p => ({ ...p, address: e.target.value }))}
              className="mt-1.5 bg-muted/50"
              placeholder="Musterstraße 1, 12345 Berlin"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Zeitzone</Label>
              <Select value={form.timezone} onValueChange={v => setStudioForm(p => ({ ...p, timezone: v }))}>
                <SelectTrigger className="mt-1.5 bg-muted/50"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Europe/Berlin">Europe/Berlin</SelectItem>
                  <SelectItem value="Europe/Vienna">Europe/Vienna</SelectItem>
                  <SelectItem value="Europe/Zurich">Europe/Zurich</SelectItem>
                  <SelectItem value="UTC">UTC</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Sprache</Label>
              <Select value={form.defaultLanguage} onValueChange={v => setStudioForm(p => ({ ...p, defaultLanguage: v }))}>
                <SelectTrigger className="mt-1.5 bg-muted/50"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="de">Deutsch</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button
            className="w-full bg-primary hover:bg-primary/90"
            onClick={() => saveMutation.mutate({ name: form.name, address: form.address, timezone: form.timezone, defaultLanguage: form.defaultLanguage })}
            disabled={saveMutation.isPending}
          >
            <Save className="w-4 h-4 mr-2" />
            {saveMutation.isPending ? 'Speichern...' : 'Einstellungen speichern'}
          </Button>
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" /> App-Informationen
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            {[
              ['Version', 'v1.0.0'],
              ['Plattform', 'Base44'],
              ['Datenbankstatus', 'Verbunden'],
              ['Auth-Provider', 'Base44 Auth'],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between py-1.5 border-b border-border/40 last:border-0">
                <span className="text-muted-foreground">{k}</span>
                <span className="text-foreground font-medium">{v}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}