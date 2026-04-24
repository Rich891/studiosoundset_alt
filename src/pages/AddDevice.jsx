import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, ChevronLeft, Check, RefreshCw, Cpu, MapPin, TestTube, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import InfoTooltip from '@/components/ui/InfoTooltip';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const STEPS = ['Provider wählen', 'API prüfen', 'Geräte laden', 'Gerät wählen', 'Zone zuweisen', 'Testen', 'Speichern'];

export default function AddDevice() {
  const [step, setStep] = useState(0);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [apiStatus, setApiStatus] = useState(null);
  const [remoteDevices, setRemoteDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [manualMode, setManualMode] = useState(false);
  const [selectedZone, setSelectedZone] = useState(null);
  const [createNewZone, setCreateNewZone] = useState(false);
  const [testVolume, setTestVolume] = useState(50);
  const [testStatus, setTestStatus] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    type: 'computer',
    providerDeviceId: '',
    description: '',
    location: '',
    defaultVolume: 50,
    minVolume: 0,
    maxVolume: 100,
    isActive: true,
  });
  const [newZone, setNewZone] = useState({
    name: '',
    color: '#6366f1',
    defaultVolume: 50,
    minVolume: 0,
    maxVolume: 100,
  });

  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: providers = [] } = useQuery({
    queryKey: ['providers'],
    queryFn: () => base44.entities.Provider.list(),
  });

  const { data: zones = [] } = useQuery({
    queryKey: ['zones'],
    queryFn: () => base44.entities.Zone.list(),
  });

  const createDeviceMutation = useMutation({
    mutationFn: async (data) => {
      let zoneId = selectedZone;
      if (createNewZone && newZone.name) {
        const zone = await base44.entities.Zone.create({ ...newZone, isActive: true });
        zoneId = zone.id;
      }
      const device = await base44.entities.Device.create({ ...data, zoneId, isDeleted: false });
      if (zoneId) {
        await base44.entities.Zone.update(zoneId, { assignedDeviceId: device.id });
      }
      await base44.entities.AuditLog.create({
        action: 'Gerät hinzugefügt',
        entityType: 'Device',
        entityId: device.id,
        newValue: device.name,
        status: 'success',
      });
      return device;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      queryClient.invalidateQueries({ queryKey: ['zones'] });
      toast.success('Gerät wurde erfolgreich hinzugefügt!');
      navigate('/devices');
    },
  });

  const update = (key, value) => setFormData(p => ({ ...p, [key]: value }));

  const handleCheckApi = async () => {
    setApiStatus('checking');
    await new Promise(r => setTimeout(r, 1200));
    if (selectedProvider?.connectionStatus === 'connected') {
      setApiStatus('ok');
      toast.success('API-Verbindung ist aktiv!');
    } else {
      setApiStatus('disconnected');
      toast.error('Provider ist nicht verbunden. Bitte zuerst Provider verbinden.');
    }
  };

  const handleLoadDevices = async () => {
    toast.info('Geräte werden geladen...');
    await new Promise(r => setTimeout(r, 1500));
    // Simulated devices
    setRemoteDevices([
      { id: 'web_player_1', name: 'Web Player (Chrome)', type: 'Computer', status: 'active' },
      { id: 'mobile_1', name: 'Smartphone (Spotify)', type: 'Smartphone', status: 'active' },
    ]);
    toast.success('2 Geräte gefunden.');
  };

  const handleTest = async () => {
    setTestStatus('testing');
    toast.info('Sende Testlautstärke...');
    await new Promise(r => setTimeout(r, 1500));
    setTestStatus('success');
    toast.success(`Testlautstärke ${testVolume}% wurde gesendet!`);
  };

  const handleSave = () => {
    const deviceData = manualMode ? formData : {
      ...formData,
      name: formData.name || selectedDevice?.name || 'Neues Gerät',
      providerDeviceId: formData.providerDeviceId || selectedDevice?.id || '',
      type: formData.type || selectedDevice?.type || 'unknown',
      providerId: selectedProvider?.id,
      status: 'unknown',
    };
    if (!deviceData.providerId) deviceData.providerId = selectedProvider?.id;
    createDeviceMutation.mutate(deviceData);
  };

  const canNext = () => {
    if (step === 0) return !!selectedProvider;
    if (step === 3) return manualMode ? !!formData.name : !!selectedDevice;
    if (step === 4) return createNewZone ? !!newZone.name : !!selectedZone;
    return true;
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-2">
        <h1 className="text-2xl font-bold text-foreground">Gerät hinzufügen</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Verbinde ein Wiedergabegerät mit einem Musikprovider und weise es einer Studiozone zu.
        </p>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-1 my-6 overflow-x-auto pb-2">
        {STEPS.map((s, i) => (
          <div key={i} className="flex items-center gap-1 flex-shrink-0">
            <div className={cn(
              'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold',
              i < step ? 'bg-green-500 text-white' :
              i === step ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'
            )}>
              {i < step ? '✓' : i + 1}
            </div>
            <span className={cn('text-xs', i === step ? 'text-primary font-medium' : 'text-muted-foreground hidden sm:inline')}>
              {s}
            </span>
            {i < STEPS.length - 1 && <ChevronRight className="w-3 h-3 text-muted-foreground" />}
          </div>
        ))}
      </div>

      <Card className="glass-card">
        <CardContent className="p-6">
          {/* Step 0: Provider */}
          {step === 0 && (
            <div className="space-y-4">
              <h2 className="font-semibold text-lg">Provider auswählen</h2>
              {providers.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">Bitte verbinde zuerst einen Musikprovider.</p>
                  <Button onClick={() => navigate('/providers/add')} className="bg-primary hover:bg-primary/90">
                    <Plus className="w-4 h-4 mr-2" /> Provider hinzufügen
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {providers.map(p => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedProvider(p)}
                      className={cn(
                        'w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all',
                        selectedProvider?.id === p.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40 bg-muted/30'
                      )}
                    >
                      <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center text-lg">
                        {p.type === 'spotify_demo' ? '🎵' : p.type === 'apple_music' ? '🍎' : '🎶'}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.connectionStatus}</p>
                      </div>
                      {selectedProvider?.id === p.id && <Check className="w-4 h-4 text-primary" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 1: API Check */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="font-semibold text-lg">API-Verbindung prüfen</h2>
              <div className={cn('p-4 rounded-xl border-2', 
                apiStatus === 'ok' ? 'border-green-500/30 bg-green-500/5' :
                apiStatus === 'disconnected' ? 'border-red-500/30 bg-red-500/5' :
                'border-border bg-muted/30'
              )}>
                <p className="font-medium text-sm">{selectedProvider?.name}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Status: {apiStatus === 'ok' ? '✓ Verbunden' : apiStatus === 'disconnected' ? '✗ Nicht verbunden' : selectedProvider?.connectionStatus}
                </p>
              </div>
              <Button onClick={handleCheckApi} disabled={apiStatus === 'checking'} className="w-full bg-primary hover:bg-primary/90">
                {apiStatus === 'checking' ? 'Prüfe...' : 'Verbindung testen'}
              </Button>
            </div>
          )}

          {/* Step 2: Load Devices */}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="font-semibold text-lg">Geräte laden</h2>
              <p className="text-sm text-muted-foreground">
                💡 Damit ein Gerät gefunden wird, muss es eingeschaltet, online und beim jeweiligen Musikdienst aktiv sein.
              </p>
              <Button onClick={handleLoadDevices} className="w-full bg-primary hover:bg-primary/90">
                <RefreshCw className="w-4 h-4 mr-2" /> Geräte vom Provider laden
              </Button>
              {remoteDevices.length > 0 && (
                <div className="space-y-2">
                  {remoteDevices.map(d => (
                    <div key={d.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border">
                      <Cpu className="w-4 h-4 text-primary" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{d.name}</p>
                        <p className="text-xs text-muted-foreground">{d.type} · {d.status}</p>
                      </div>
                    </div>
                  ))}
                  <p className="text-xs text-green-400">{remoteDevices.length} Gerät(e) gefunden</p>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Select Device */}
          {step === 3 && (
            <div className="space-y-4">
              <h2 className="font-semibold text-lg">Gerät auswählen</h2>
              {remoteDevices.length > 0 && !manualMode && (
                <div className="space-y-2">
                  {remoteDevices.map(d => (
                    <button
                      key={d.id}
                      onClick={() => { setSelectedDevice(d); update('name', d.name); update('providerDeviceId', d.id); }}
                      className={cn(
                        'w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all',
                        selectedDevice?.id === d.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40 bg-muted/30'
                      )}
                    >
                      <Cpu className="w-5 h-5 text-primary" />
                      <div className="flex-1">
                        <p className="font-medium text-sm">{d.name}</p>
                        <p className="text-xs text-muted-foreground">{d.type}</p>
                      </div>
                      {selectedDevice?.id === d.id && <Check className="w-4 h-4 text-primary" />}
                    </button>
                  ))}
                </div>
              )}
              <Button variant="outline" onClick={() => setManualMode(!manualMode)} className="w-full">
                {manualMode ? 'Gefundene Geräte nutzen' : 'Gerät manuell hinzufügen'}
              </Button>
              {manualMode && (
                <div className="space-y-3">
                  <div>
                    <Label>Gerätename *</Label>
                    <Input value={formData.name} onChange={e => update('name', e.target.value)} className="mt-1.5 bg-muted/50" />
                  </div>
                  <div>
                    <Label>Gerätetyp</Label>
                    <Input value={formData.type} onChange={e => update('type', e.target.value)} className="mt-1.5 bg-muted/50" placeholder="Computer, Smartphone, Speaker..." />
                  </div>
                  <div>
                    <div className="flex items-center gap-1 mb-1.5">
                      <Label>Provider Device ID</Label>
                      <InfoTooltip text="Die technische Geräte-ID des Musikproviders. Sie wird normalerweise automatisch geladen." />
                    </div>
                    <Input value={formData.providerDeviceId} onChange={e => update('providerDeviceId', e.target.value)} className="bg-muted/50" />
                  </div>
                  <div>
                    <Label>Standort</Label>
                    <Input value={formData.location} onChange={e => update('location', e.target.value)} className="mt-1.5 bg-muted/50" placeholder="z.B. Eingangsbereich" />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Zone */}
          {step === 4 && (
            <div className="space-y-4">
              <h2 className="font-semibold text-lg">Zone zuweisen</h2>
              <div className="flex items-center gap-3 mb-4">
                <Button 
                  variant={!createNewZone ? 'default' : 'outline'} 
                  size="sm"
                  onClick={() => setCreateNewZone(false)}
                >
                  Bestehende Zone
                </Button>
                <Button 
                  variant={createNewZone ? 'default' : 'outline'} 
                  size="sm"
                  onClick={() => setCreateNewZone(true)}
                >
                  <Plus className="w-3 h-3 mr-1" /> Neue Zone
                </Button>
              </div>

              {!createNewZone ? (
                <div className="space-y-2">
                  {zones.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Keine Zonen vorhanden. Erstelle eine neue Zone.</p>
                  ) : (
                    zones.map(z => (
                      <button
                        key={z.id}
                        onClick={() => setSelectedZone(z.id)}
                        className={cn(
                          'w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all',
                          selectedZone === z.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40 bg-muted/30'
                        )}
                      >
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: z.color }} />
                        <p className="font-medium text-sm">{z.name}</p>
                        {selectedZone === z.id && <Check className="w-4 h-4 text-primary ml-auto" />}
                      </button>
                    ))
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <Label>Zonenname *</Label>
                    <Input value={newZone.name} onChange={e => setNewZone(p => ({ ...p, name: e.target.value }))} className="mt-1.5 bg-muted/50" placeholder="z.B. Kraftraum" />
                  </div>
                  <div>
                    <Label>Farbe</Label>
                    <div className="flex gap-2 mt-1.5">
                      {['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'].map(c => (
                        <button key={c} onClick={() => setNewZone(p => ({ ...p, color: c }))}
                          className={cn('w-8 h-8 rounded-lg border-2 transition-all', newZone.color === c ? 'border-white scale-110' : 'border-transparent')}
                          style={{ background: c }}
                        />
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label>Standardlautstärke: {newZone.defaultVolume}%</Label>
                    <Slider value={[newZone.defaultVolume]} onValueChange={([v]) => setNewZone(p => ({ ...p, defaultVolume: v }))} className="mt-2" />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 5: Test */}
          {step === 5 && (
            <div className="space-y-5">
              <h2 className="font-semibold text-lg">Gerät testen</h2>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1">
                      <Label>Testlautstärke</Label>
                      <InfoTooltip text="Sende eine Testlautstärke, um das Gerät zu prüfen." />
                    </div>
                    <span className="text-lg font-bold text-primary">{testVolume}%</span>
                  </div>
                  <Slider value={[testVolume]} onValueChange={([v]) => setTestVolume(v)} className="mb-4" />
                </div>
                <Button onClick={handleTest} disabled={testStatus === 'testing'} className="w-full bg-primary hover:bg-primary/90">
                  <TestTube className="w-4 h-4 mr-2" />
                  {testStatus === 'testing' ? 'Sende...' : 'Testlautstärke senden'}
                </Button>
                {testStatus === 'success' && (
                  <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 text-sm text-green-400">
                    ✓ Gerät hat reagiert! Lautstärke wurde auf {testVolume}% gesetzt.
                  </div>
                )}
                <p className="text-xs text-muted-foreground text-center">Du kannst diesen Schritt auch überspringen.</p>
              </div>
            </div>
          )}

          {/* Step 6: Summary */}
          {step === 6 && (
            <div className="space-y-5">
              <h2 className="font-semibold text-lg">Zusammenfassung</h2>
              <div className="space-y-2">
                {[
                  ['Provider', selectedProvider?.name],
                  ['Gerät', formData.name || selectedDevice?.name],
                  ['Zone', createNewZone ? newZone.name : zones.find(z => z.id === selectedZone)?.name || 'Keine'],
                  ['Standardlautstärke', `${formData.defaultVolume}%`],
                  ['Status', 'Aktiviert'],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                    <span className="text-sm text-muted-foreground">{label}</span>
                    <span className="text-sm font-medium text-foreground">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-6">
        <Button variant="outline" onClick={() => step === 0 ? navigate('/devices') : setStep(s => s - 1)}>
          <ChevronLeft className="w-4 h-4 mr-1" />
          {step === 0 ? 'Abbrechen' : 'Zurück'}
        </Button>
        <div className="flex gap-2">
          {step < STEPS.length - 1 ? (
            <Button onClick={() => setStep(s => s + 1)} disabled={!canNext()} className="bg-primary hover:bg-primary/90">
              Weiter <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <>
              <Button onClick={handleSave} disabled={createDeviceMutation.isPending} className="bg-primary hover:bg-primary/90">
                {createDeviceMutation.isPending ? 'Speichern...' : 'Gerät speichern & aktivieren'}
              </Button>
              <Button variant="outline" onClick={() => {
                update('isActive', false);
                handleSave();
              }} disabled={createDeviceMutation.isPending}>
                Deaktiviert speichern
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}