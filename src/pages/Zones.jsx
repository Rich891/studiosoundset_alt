import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin, Plus, CheckCircle2, XCircle, AlertCircle, RefreshCw,
  Music2, Smartphone, Tablet, Monitor, ChevronRight, FlaskConical
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';
import ZoneTestPanel from '@/components/zones/ZoneTestPanel';

const DEVICE_TYPES = [
  { value: 'ipad', label: 'iPad', icon: Tablet },
  { value: 'android_tablet', label: 'Android Tablet', icon: Tablet },
  { value: 'smartphone', label: 'Smartphone', icon: Smartphone },
  { value: 'desktop', label: 'Desktop / PC', icon: Monitor },
  { value: 'other', label: 'Sonstiges', icon: Monitor },
];

const STATUS_CFG = {
  ready:          { color: 'text-green-400',  bg: 'border-green-500/30 bg-green-500/5',  label: 'Bereit' },
  no_account:     { color: 'text-yellow-400', bg: 'border-yellow-500/30 bg-yellow-500/5', label: 'Kein Account' },
  no_device:      { color: 'text-yellow-400', bg: 'border-yellow-500/30 bg-yellow-500/5', label: 'Kein Gerät' },
  device_offline: { color: 'text-orange-400', bg: 'border-orange-500/30 bg-orange-500/5', label: 'Gerät offline' },
  token_expired:  { color: 'text-red-400',    bg: 'border-red-500/30 bg-red-500/5',       label: 'Token abgelaufen' },
  error:          { color: 'text-red-400',    bg: 'border-red-500/30 bg-red-500/5',       label: 'Fehler' },
  untested:       { color: 'text-muted-foreground', bg: 'border-border',                   label: 'Ungetestet' },
};

const ZONE_COLORS = ['#6366f1', '#22d3ee', '#f43f5e', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

const defaultForm = { name: '', description: '', color: '#6366f1', deviceType: 'other', spotifyAccountId: '', defaultVolume: 50, minVolume: 0, maxVolume: 100 };

export default function Zones() {
  const [showForm, setShowForm] = useState(false);
  const [editZone, setEditZone] = useState(null);
  const [formData, setFormData] = useState(defaultForm);
  const [testingZoneId, setTestingZoneId] = useState(null);
  const queryClient = useQueryClient();

  const { data: zones = [], isLoading } = useQuery({ queryKey: ['zones'], queryFn: () => base44.entities.Zone.list() });
  const { data: accounts = [] } = useQuery({ queryKey: ['spotifyAccounts'], queryFn: () => base44.entities.SpotifyAccount.list() });

  const saveMutation = useMutation({
    mutationFn: (data) => editZone
      ? base44.entities.Zone.update(editZone.id, data)
      : base44.entities.Zone.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['zones'] }); toast.success(editZone ? 'Zone aktualisiert.' : 'Zone erstellt.'); closeForm(); },
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Zone.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['zones'] }); toast.success('Zone gelöscht.'); },
  });

  const openCreate = () => { setEditZone(null); setFormData(defaultForm); setShowForm(true); };
  const openEdit = (zone) => { setEditZone(zone); setFormData(zone); setShowForm(true); };
  const closeForm = () => { setShowForm(false); setEditZone(null); };
  const upd = (k, v) => setFormData(p => ({ ...p, [k]: v }));

  if (isLoading) return <div className="p-8 flex items-center justify-center gap-3"><RefreshCw className="w-5 h-5 text-primary animate-spin" /><span className="text-muted-foreground">Lade Zonen...</span></div>;

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-black flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-primary" />
            </div>
            Zonen
          </h1>
          <p className="text-sm text-muted-foreground mt-1 ml-14">Tennishalle · Gym · Eriks Handy — jede Zone mit eigenem Spotify Account.</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90 h-11 px-6 gap-2 font-semibold" onClick={openCreate}>
          <Plus className="w-4 h-4" /> Zone erstellen
        </Button>
      </div>

      {zones.length === 0 ? (
        <div className="bento-panel border-dashed border-primary/20 p-16 text-center">
          <MapPin className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" />
          <h3 className="text-xl font-bold mb-2">Noch keine Zonen</h3>
          <p className="text-muted-foreground text-sm mb-6">Erstelle die drei Zonen: Tennishalle, Gym und Eriks Handy.</p>
          <Button className="bg-primary hover:bg-primary/90" onClick={openCreate}><Plus className="w-4 h-4 mr-2" /> Erste Zone erstellen</Button>
        </div>
      ) : (
        <div className="space-y-4">
          <AnimatePresence>
            {zones.map((zone, i) => {
              const cfg = STATUS_CFG[zone.currentStatus] || STATUS_CFG.untested;
              const account = accounts.find(a => a.id === zone.spotifyAccountId);
              const DevTypeIcon = DEVICE_TYPES.find(d => d.value === zone.deviceType)?.icon || Monitor;
              const isTestOpen = testingZoneId === zone.id;

              return (
                <motion.div key={zone.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                  <div className={`bento-panel border ${cfg.bg} overflow-hidden`}>
                    <div className="p-5 flex items-center gap-4 flex-wrap">
                      <div className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center" style={{ background: zone.color + '22', border: `1px solid ${zone.color}44` }}>
                        <div className="w-3 h-3 rounded-full" style={{ background: zone.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-lg">{zone.name}</p>
                          <span className={`text-xs font-semibold ${cfg.color} px-2 py-0.5 rounded-full border ${cfg.bg}`}>{cfg.label}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <DevTypeIcon className="w-3 h-3" />{DEVICE_TYPES.find(d => d.value === zone.deviceType)?.label || 'Gerät'}
                          </span>
                          {account ? (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Music2 className="w-3 h-3" />{account.displayName}
                              {account.authStatus === 'connected' ? ' ✓' : ' ✗'}
                            </span>
                          ) : (
                            <span className="text-xs text-yellow-400">⚠ Kein Spotify Account zugewiesen</span>
                          )}
                          <span className="text-xs text-muted-foreground">🔊 {zone.defaultVolume}%</span>
                        </div>
                        {zone.lastError && <p className="text-xs text-red-400 mt-1">{zone.lastError}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setTestingZoneId(isTestOpen ? null : zone.id)}>
                          <FlaskConical className="w-3.5 h-3.5" /> {isTestOpen ? 'Tests schließen' : 'Testen'}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => openEdit(zone)}>Bearbeiten</Button>
                        <Button variant="ghost" size="sm" className="text-destructive/70 hover:text-destructive" onClick={() => deleteMutation.mutate(zone.id)}>
                          <XCircle className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    {isTestOpen && (
                      <div className="border-t border-border/30">
                        <ZoneTestPanel zone={zone} account={account} />
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Zone Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editZone ? 'Zone bearbeiten' : 'Zone erstellen'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label className="text-sm font-semibold mb-2 block">Name *</Label>
              <Input value={formData.name} onChange={e => upd('name', e.target.value)} placeholder="z. B. Tennishalle" className="h-11 bg-muted/30" />
            </div>
            <div>
              <Label className="text-sm font-semibold mb-2 block">Beschreibung</Label>
              <Input value={formData.description || ''} onChange={e => upd('description', e.target.value)} placeholder="Optional" className="h-11 bg-muted/30" />
            </div>
            <div>
              <Label className="text-sm font-semibold mb-2 block">Gerätetyp</Label>
              <Select value={formData.deviceType} onValueChange={v => upd('deviceType', v)}>
                <SelectTrigger className="h-11 bg-muted/30"><SelectValue /></SelectTrigger>
                <SelectContent>{DEVICE_TYPES.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm font-semibold mb-2 block">Farbe</Label>
              <div className="flex gap-2 flex-wrap">
                {ZONE_COLORS.map(c => (
                  <button key={c} onClick={() => upd('color', c)} className="w-8 h-8 rounded-full border-2 transition-all" style={{ background: c, borderColor: formData.color === c ? 'white' : 'transparent' }} />
                ))}
              </div>
            </div>
            <div>
              <Label className="text-sm font-semibold mb-2 block">Spotify Account</Label>
              <Select value={formData.spotifyAccountId || 'none'} onValueChange={v => upd('spotifyAccountId', v === 'none' ? '' : v)}>
                <SelectTrigger className="h-11 bg-muted/30"><SelectValue placeholder="Account wählen" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Kein Account —</SelectItem>
                  {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.displayName} {a.authStatus === 'connected' ? '✓' : '(nicht verbunden)'}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="flex justify-between mb-2">
                <Label className="text-sm font-semibold">Standard-Lautstärke</Label>
                <span className="text-2xl font-black text-primary">{formData.defaultVolume}%</span>
              </div>
              <Slider value={[formData.defaultVolume]} onValueChange={([v]) => upd('defaultVolume', v)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-semibold mb-1 block">Min</Label>
                <Input type="number" min={0} max={100} value={formData.minVolume} onChange={e => upd('minVolume', +e.target.value)} className="h-10 bg-muted/30" />
              </div>
              <div>
                <Label className="text-sm font-semibold mb-1 block">Max</Label>
                <Input type="number" min={0} max={100} value={formData.maxVolume} onChange={e => upd('maxVolume', +e.target.value)} className="h-10 bg-muted/30" />
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={closeForm}>Abbrechen</Button>
              <Button className="flex-1 bg-primary hover:bg-primary/90 font-bold" disabled={!formData.name.trim() || saveMutation.isPending} onClick={() => saveMutation.mutate(formData)}>
                {saveMutation.isPending ? 'Speichern...' : 'Speichern'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}