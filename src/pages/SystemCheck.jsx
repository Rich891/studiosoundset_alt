import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { CheckCircle2, AlertCircle, Clock, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import PageHeader from '@/components/ui/PageHeader';
import { calculateTargetVolume } from '@/lib/volumeRamp';
import { toast } from 'sonner';

export default function SystemCheck() {
  const [testBlock, setTestBlock] = useState(null);
  const [testHour, setTestHour] = useState('12');

  const { data: providers = [] } = useQuery({
    queryKey: ['providers'],
    queryFn: () => base44.entities.Provider.list(),
  });
  const { data: devices = [] } = useQuery({
    queryKey: ['devices'],
    queryFn: () => base44.entities.Device.list(),
  });
  const { data: zones = [] } = useQuery({
    queryKey: ['zones'],
    queryFn: () => base44.entities.Zone.list(),
  });
  const { data: blocks = [] } = useQuery({
    queryKey: ['scheduleBlocks'],
    queryFn: () => base44.entities.ScheduleBlock.list(),
  });

  const testMutation = useMutation({
    mutationFn: async (providerId) => {
      const response = await base44.functions.invoke('spotifyTest', { providerId });
      return response.data;
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success('Provider antwortet korrekt!');
      } else {
        toast.error(`Status: ${data.status}`);
      }
    },
    onError: (error) => {
      toast.error('Fehler: ' + error.message);
    },
  });

  const connectedProviders = providers.filter(p => p.connectionStatus === 'connected');
  const onlineDevices = devices.filter(d => d.status === 'online');
  const activeZones = zones.filter(z => z.isActive);
  const ramptBlocks = blocks.filter(b => b.volumeRampEnabled && b.isActive);

  return (
    <div className="p-8 space-y-8 max-w-6xl mx-auto">
      <PageHeader
        title="System Check"
        subtitle="Diagnose und API-Tests"
      />

      {/* Provider Test */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Provider Verbindung</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {providers.length === 0 ? (
            <Card className="glass-card border-yellow-500/30 bg-yellow-500/5">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <AlertCircle className="w-6 h-6 text-yellow-400" />
                  <h3 className="font-semibold">Keine Provider</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-4">Bitte verbinde einen Provider.</p>
              </CardContent>
            </Card>
          ) : (
            providers.map(provider => (
              <Card key={provider.id} className={`glass-card ${provider.connectionStatus === 'connected' ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">{provider.name}</h3>
                    {provider.connectionStatus === 'connected' ? (
                      <CheckCircle2 className="w-5 h-5 text-green-400" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-400" />
                    )}
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Status:</span>
                      <span className="font-medium">{provider.connectionStatus}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Typ:</span>
                      <span className="font-medium">{provider.type}</span>
                    </div>
                    {provider.lastConnectionTestAt && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Letzter Test:</span>
                        <span className="font-medium text-xs">{new Date(provider.lastConnectionTestAt).toLocaleString('de-DE')}</span>
                      </div>
                    )}
                  </div>
                  <Button 
                    size="sm" 
                    className="w-full h-9"
                    onClick={() => testMutation.mutate(provider.id)}
                    disabled={testMutation.isPending}
                  >
                    {testMutation.isPending ? 'Testen...' : 'Verbindung testen'}
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* System Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="glass-card border-purple-500/30 bg-purple-500/5">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-muted-foreground">Provider</p>
              {connectedProviders.length > 0 && <CheckCircle2 className="w-5 h-5 text-green-400" />}
            </div>
            <p className="text-3xl font-bold text-purple-400">{connectedProviders.length}/{providers.length}</p>
            <p className="text-xs text-muted-foreground mt-2">verbunden</p>
          </CardContent>
        </Card>

        <Card className="glass-card border-blue-500/30 bg-blue-500/5">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-muted-foreground">Geräte</p>
              {onlineDevices.length > 0 && <CheckCircle2 className="w-5 h-5 text-green-400" />}
            </div>
            <p className="text-3xl font-bold text-blue-400">{onlineDevices.length}/{devices.length}</p>
            <p className="text-xs text-muted-foreground mt-2">online</p>
          </CardContent>
        </Card>

        <Card className="glass-card border-green-500/30 bg-green-500/5">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-muted-foreground">Zonen</p>
              {activeZones.length > 0 && <CheckCircle2 className="w-5 h-5 text-green-400" />}
            </div>
            <p className="text-3xl font-bold text-green-400">{activeZones.length}</p>
            <p className="text-xs text-muted-foreground mt-2">aktiv</p>
          </CardContent>
        </Card>

        <Card className="glass-card border-orange-500/30 bg-orange-500/5">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-muted-foreground">Rampen</p>
              {ramptBlocks.length > 0 && <CheckCircle2 className="w-5 h-5 text-green-400" />}
            </div>
            <p className="text-3xl font-bold text-orange-400">{ramptBlocks.length}</p>
            <p className="text-xs text-muted-foreground mt-2">aktive</p>
          </CardContent>
        </Card>
      </div>

      {/* Volume Ramp Test */}
      {blocks.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Lautstärkerampen-Test</h2>
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-base">Rampen-Berechnung testen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold mb-2 block">Zeitblock auswählen</label>
                  <Select value={testBlock?.id || ''} onValueChange={(id) => setTestBlock(blocks.find(b => b.id === id))}>
                    <SelectTrigger className="h-10"><SelectValue placeholder="Block wählen" /></SelectTrigger>
                    <SelectContent>
                      {blocks.filter(b => b.volumeRampEnabled).map(b => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.title} ({b.startTime}-{b.endTime})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-semibold mb-2 block">Stunde testen</label>
                  <Select value={testHour} onValueChange={setTestHour}>
                    <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 24 }, (_, i) => i).map(h => (
                        <SelectItem key={h} value={String(h)}>
                          {String(h).padStart(2, '0')}:00 Uhr
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {testBlock && (
                <div className="p-4 bg-muted/30 rounded-lg space-y-3">
                  <div className="flex items-center justify-between p-3 bg-primary/10 rounded">
                    <span className="font-semibold">{testBlock.title}</span>
                    <span className="text-sm text-muted-foreground">{testBlock.startTime}–{testBlock.endTime}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Start-Lautstärke</p>
                      <p className="text-2xl font-bold text-green-400">{testBlock.startVolume}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">End-Lautstärke</p>
                      <p className="text-2xl font-bold text-orange-400">{testBlock.endVolume}%</p>
                    </div>
                  </div>

                  <div className="p-3 bg-blue-500/10 rounded">
                    <p className="text-xs text-muted-foreground mb-2">Ziel-Lautstärke um {String(testHour).padStart(2, '0')}:00</p>
                    {(() => {
                      const testTime = new Date();
                      testTime.setHours(parseInt(testHour), 0, 0, 0);
                      const result = calculateTargetVolume(testBlock, testTime);
                      return (
                        <div className="space-y-1">
                          <p className="text-2xl font-bold text-blue-400">{result.targetVolume}%</p>
                          {result.nextStep && (
                            <p className="text-xs text-muted-foreground">
                              Nächster Schritt: {result.nextStep.time} → {result.nextStep.volume}%
                            </p>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}