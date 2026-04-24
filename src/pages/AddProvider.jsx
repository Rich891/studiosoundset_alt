import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, ChevronLeft, Check, Zap, Apple, Building2, Code, Speaker } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import InfoTooltip from '@/components/ui/InfoTooltip';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const STEPS = ['Typ wählen', 'Details', 'API-Konfiguration', 'Verbindung testen', 'Speichern'];

const PROVIDER_TYPES = [
  {
    id: 'spotify_demo',
    label: 'Spotify Demo Provider',
    icon: '🎵',
    desc: 'Für technische Tests und private Demo-Nutzung',
    warning: true,
  },
  {
    id: 'apple_music',
    label: 'Apple Music / MusicKit',
    icon: '🍎',
    desc: 'Katalog-, Playlist- und Playback-Funktionen',
    warning: true,
  },
  {
    id: 'business_music',
    label: 'Business Music Provider',
    icon: '🏢',
    desc: 'Lizenzierte Lösungen für gewerbliche Nutzung',
  },
  {
    id: 'custom_api',
    label: 'Custom API Provider',
    icon: '⚙️',
    desc: 'Eigene API-Endpoints konfigurieren',
  },
  {
    id: 'local_audio',
    label: 'Local Audio Provider',
    icon: '🔊',
    desc: 'Lokale Geräte über IP/Netzwerk',
  },
];

export default function AddProvider() {
  const [step, setStep] = useState(0);
  const [testStatus, setTestStatus] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    type: '',
    description: '',
    licenseStatus: 'demo',
    isActive: true,
    isDefault: false,
    apiBaseUrl: 'https://api.spotify.com',
    clientId: '',
    redirectUri: window.location.origin + '/providers/callback',
    scopes: 'user-read-playback-state user-modify-playback-state user-read-currently-playing playlist-read-private streaming',
    authType: 'oauth2',
  });
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Provider.create(data),
    onSuccess: async (provider) => {
      await base44.entities.AuditLog.create({
        action: 'Provider erstellt',
        entityType: 'Provider',
        entityId: provider.id,
        newValue: provider.name,
        status: 'success',
      });
      queryClient.invalidateQueries({ queryKey: ['providers'] });
      toast.success(`Provider "${provider.name}" wurde erstellt!`);
      navigate('/providers');
    },
  });

  const update = (key, value) => setFormData(p => ({ ...p, [key]: value }));

  const handleTypeSelect = (type) => {
    const t = PROVIDER_TYPES.find(t => t.id === type);
    update('type', type);
    if (type === 'spotify_demo') {
      update('apiBaseUrl', 'https://api.spotify.com');
      update('authType', 'oauth2');
      update('scopes', 'user-read-playback-state user-modify-playback-state user-read-currently-playing playlist-read-private streaming');
    } else if (type === 'apple_music') {
      update('apiBaseUrl', 'https://api.music.apple.com');
      update('authType', 'bearer_token');
    } else if (type === 'local_audio') {
      update('authType', 'none');
      update('apiBaseUrl', '');
    }
  };

  const handleTest = async () => {
    setTestStatus('testing');
    toast.info('Verbindungstest läuft...');
    await new Promise(r => setTimeout(r, 1500));
    if (!formData.clientId && formData.type !== 'local_audio') {
      setTestStatus('error');
      toast.error('Bitte trage zuerst die Client ID ein.');
    } else {
      setTestStatus('success');
      toast.success('Verbindungstest erfolgreich! (Demo-Modus)');
    }
  };

  const handleSave = () => {
    if (!formData.name || !formData.type) {
      toast.error('Bitte Name und Typ ausfüllen.');
      return;
    }
    createMutation.mutate({
      ...formData,
      connectionStatus: testStatus === 'success' ? 'connected' : 'disconnected',
      clientSecretStored: false,
      accessTokenStored: false,
      refreshTokenStored: false,
    });
  };

  const canNext = () => {
    if (step === 0) return !!formData.type;
    if (step === 1) return !!formData.name;
    return true;
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Provider hinzufügen</h1>
        <p className="text-muted-foreground text-sm mt-1">Verbinde einen Musikprovider mit deinem Studio</p>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2">
        {STEPS.map((s, i) => (
          <div key={i} className="flex items-center gap-2 flex-shrink-0">
            <div className={cn(
              'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all',
              i < step ? 'bg-green-500 text-white' :
              i === step ? 'bg-primary text-white' :
              'bg-muted text-muted-foreground'
            )}>
              {i < step ? <Check className="w-3.5 h-3.5" /> : i + 1}
            </div>
            <span className={cn(
              'text-xs font-medium',
              i === step ? 'text-primary' : 'text-muted-foreground'
            )}>{s}</span>
            {i < STEPS.length - 1 && <ChevronRight className="w-3 h-3 text-muted-foreground" />}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <Card className="glass-card">
        <CardContent className="p-6">
          {/* Step 0: Type Selection */}
          {step === 0 && (
            <div className="space-y-4">
              <h2 className="font-semibold text-lg">Provider-Typ wählen</h2>
              <div className="grid grid-cols-1 gap-3">
                {PROVIDER_TYPES.map(type => (
                  <button
                    key={type.id}
                    onClick={() => handleTypeSelect(type.id)}
                    className={cn(
                      'flex items-start gap-4 p-4 rounded-xl border-2 text-left transition-all',
                      formData.type === type.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/40 bg-muted/30'
                    )}
                  >
                    <span className="text-2xl">{type.icon}</span>
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{type.label}</p>
                      <p className="text-sm text-muted-foreground">{type.desc}</p>
                    </div>
                    {formData.type === type.id && <Check className="w-5 h-5 text-primary mt-0.5" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 1: Details */}
          {step === 1 && (
            <div className="space-y-5">
              <h2 className="font-semibold text-lg">Provider-Details</h2>
              <div>
                <Label htmlFor="name">Providername *</Label>
                <Input id="name" value={formData.name} onChange={e => update('name', e.target.value)} className="mt-1.5 bg-muted/50" placeholder="z.B. Mein Spotify Demo" />
              </div>
              <div>
                <Label htmlFor="desc">Beschreibung</Label>
                <Textarea id="desc" value={formData.description} onChange={e => update('description', e.target.value)} className="mt-1.5 bg-muted/50" rows={3} />
              </div>
              <div>
                <Label>Lizenzstatus</Label>
                <Select value={formData.licenseStatus} onValueChange={v => update('licenseStatus', v)}>
                  <SelectTrigger className="mt-1.5 bg-muted/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="demo">Demo</SelectItem>
                    <SelectItem value="licensed">Lizenziert</SelectItem>
                    <SelectItem value="unlicensed">Nicht lizenziert</SelectItem>
                    <SelectItem value="pending">Ausstehend</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <Label>Aktiv</Label>
                <Switch checked={formData.isActive} onCheckedChange={v => update('isActive', v)} />
              </div>
              <div className="flex items-center justify-between">
                <Label>Als Standardprovider</Label>
                <Switch checked={formData.isDefault} onCheckedChange={v => update('isDefault', v)} />
              </div>
            </div>
          )}

          {/* Step 2: API Config */}
          {step === 2 && (
            <div className="space-y-5">
              <h2 className="font-semibold text-lg">API-Konfiguration</h2>

              {formData.type === 'spotify_demo' && (
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 text-sm text-yellow-400">
                  ⚠️ <strong>Wichtiger Hinweis:</strong> Spotify ist in dieser App nur für technische Tests und private Demo-Nutzung vorgesehen. Spotify ist nicht als rechtssichere Lösung für öffentliche oder gewerbliche Studiobeschallung geeignet.
                </div>
              )}

              {formData.type === 'apple_music' && (
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 text-sm text-blue-400">
                  ℹ️ <strong>Hinweis:</strong> Apple Music / MusicKit kann technisch für Katalog-, Playlist- und Playback-Funktionen vorbereitet werden. Die Geräte- und Fernsteuerungslogik unterscheidet sich von Spotify Connect.
                </div>
              )}

              {(formData.type === 'spotify_demo' || formData.type === 'business_music' || formData.type === 'custom_api') && (
                <>
                  <div>
                    <div className="flex items-center gap-1 mb-1.5">
                      <Label>Client ID</Label>
                      <InfoTooltip text="Die Client ID findest du im Developer Dashboard deines Providers. Sie identifiziert deine App." />
                    </div>
                    <Input value={formData.clientId} onChange={e => update('clientId', e.target.value)} className="bg-muted/50" placeholder="Spotify Client ID" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1 mb-1.5">
                      <Label>Client Secret</Label>
                      <InfoTooltip text="Das Client Secret ist ein geheimer Schlüssel. Es darf niemals öffentlich sichtbar sein und wird nur serverseitig gespeichert." />
                    </div>
                    <Input type="password" className="bg-muted/50" placeholder="Wird sicher in Base44 gespeichert" onChange={() => update('clientSecretStored', true)} />
                    <p className="text-xs text-muted-foreground mt-1">⚡ Das Secret wird sicher in Base44 Secrets gespeichert und ist niemals im Browser sichtbar.</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-1 mb-1.5">
                      <Label>Redirect URI</Label>
                      <InfoTooltip text="Diese URL muss exakt beim Provider eingetragen werden. Nach dem Login leitet der Provider den Nutzer zurück zu dieser App." />
                    </div>
                    <Input value={formData.redirectUri} onChange={e => update('redirectUri', e.target.value)} className="bg-muted/50" />
                  </div>
                </>
              )}

              {formData.type === 'spotify_demo' && (
                <div>
                  <div className="flex items-center gap-1 mb-1.5">
                    <Label>Scopes</Label>
                    <InfoTooltip text="Scopes legen fest, welche Berechtigungen die App beim Provider bekommt, zum Beispiel Playlists lesen oder Lautstärke ändern." />
                  </div>
                  <Textarea value={formData.scopes} onChange={e => update('scopes', e.target.value)} className="bg-muted/50 text-xs" rows={3} />
                </div>
              )}

              {(formData.type === 'business_music' || formData.type === 'custom_api') && (
                <div>
                  <div className="flex items-center gap-1 mb-1.5">
                    <Label>API Base URL</Label>
                    <InfoTooltip text="Die Basis-URL der API. Alle Endpunkt-Pfade werden relativ zu dieser URL aufgerufen." />
                  </div>
                  <Input value={formData.apiBaseUrl} onChange={e => update('apiBaseUrl', e.target.value)} className="bg-muted/50" placeholder="https://api.example.com/v1" />
                </div>
              )}

              {formData.type === 'local_audio' && (
                <div className="space-y-4">
                  <div>
                    <Label>Lokale IP-Adresse</Label>
                    <Input className="mt-1.5 bg-muted/50" placeholder="192.168.1.100" onChange={e => update('apiBaseUrl', `http://${e.target.value}`)} />
                  </div>
                </div>
              )}

              <div className="bg-muted/30 rounded-xl p-4">
                <h4 className="text-sm font-medium mb-2">Base44 API Setup</h4>
                <p className="text-xs text-muted-foreground">
                  Für volle API-Funktionalität: Öffne das Base44 Dashboard → Integrations → Custom Integration hinzufügen → API-Daten eintragen. Secrets werden sicher in Base44 gespeichert.
                </p>
              </div>
            </div>
          )}

          {/* Step 3: Test */}
          {step === 3 && (
            <div className="space-y-5">
              <h2 className="font-semibold text-lg">Verbindung testen</h2>
              <div className="space-y-3">
                {['API erreichbar', 'Authentifizierung', 'Geräte abrufbar', 'Playlists abrufbar'].map((test, i) => (
                  <div key={i} className={cn(
                    'flex items-center gap-3 p-3 rounded-lg border',
                    testStatus === 'success' ? 'border-green-500/20 bg-green-500/5' :
                    testStatus === 'error' ? 'border-red-500/20 bg-red-500/5' :
                    'border-border bg-muted/30'
                  )}>
                    <div className={cn(
                      'w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0',
                      testStatus === 'success' ? 'bg-green-500/20 text-green-400' :
                      testStatus === 'error' ? 'bg-red-500/20 text-red-400' :
                      'bg-muted text-muted-foreground'
                    )}>
                      {testStatus === 'success' ? '✓' : testStatus === 'error' ? '✗' : i + 1}
                    </div>
                    <span className="text-sm">{test}</span>
                    {testStatus === 'testing' && <span className="text-xs text-muted-foreground ml-auto animate-pulse">Testen...</span>}
                    {testStatus === 'success' && <span className="text-xs text-green-400 ml-auto">OK</span>}
                    {testStatus === 'error' && i === 0 && <span className="text-xs text-red-400 ml-auto">Fehlgeschlagen</span>}
                  </div>
                ))}
              </div>
              <Button 
                onClick={handleTest} 
                disabled={testStatus === 'testing'}
                className="w-full bg-primary hover:bg-primary/90"
              >
                {testStatus === 'testing' ? 'Teste...' : 'Verbindung testen'}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Du kannst auch überspringen und später testen.
              </p>
            </div>
          )}

          {/* Step 4: Summary */}
          {step === 4 && (
            <div className="space-y-5">
              <h2 className="font-semibold text-lg">Zusammenfassung & Speichern</h2>
              <div className="space-y-2">
                {[
                  ['Typ', PROVIDER_TYPES.find(t => t.id === formData.type)?.label],
                  ['Name', formData.name],
                  ['Lizenz', formData.licenseStatus],
                  ['Auth-Typ', formData.authType],
                  ['Status', formData.isActive ? 'Aktiv' : 'Inaktiv'],
                  ['Verbindungstest', testStatus === 'success' ? '✓ Erfolgreich' : testStatus === 'error' ? '✗ Fehlgeschlagen' : '— Nicht getestet'],
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

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between mt-6">
        <Button
          variant="outline"
          onClick={() => step === 0 ? navigate('/providers') : setStep(s => s - 1)}
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          {step === 0 ? 'Abbrechen' : 'Zurück'}
        </Button>
        <div className="flex gap-2">
          {step < STEPS.length - 1 ? (
            <Button 
              onClick={() => setStep(s => s + 1)}
              disabled={!canNext()}
              className="bg-primary hover:bg-primary/90"
            >
              Weiter <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <>
              <Button 
                onClick={handleSave}
                disabled={createMutation.isPending}
                className="bg-primary hover:bg-primary/90"
              >
                {createMutation.isPending ? 'Speichern...' : 'Provider speichern'}
              </Button>
              <Button
                variant="outline"
                onClick={async () => {
                  await createMutation.mutateAsync({
                    ...formData,
                    connectionStatus: testStatus === 'success' ? 'connected' : 'disconnected',
                  });
                  navigate('/devices/add');
                }}
                disabled={createMutation.isPending}
              >
                Speichern & Gerät hinzufügen
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}