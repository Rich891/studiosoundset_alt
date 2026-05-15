import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Plus, XCircle, RefreshCw, Music2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';

const ZONE_COLORS = ['#6366f1', '#22d3ee', '#f43f5e', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];
const defaultForm = { name: '', description: '', color: '#6366f1', providerId: '', defaultVolume: 50, minVolume: 0, maxVolume: 100, isActive: true };
const providerStatus = (provider) => provider?.status || provider?.authStatus || 'disconnected';

export default function Zones() {
  const [showForm, setShowForm] = useState(false);
  const [editZone, setEditZone] = useState(null);
  const [formData, setFormData] = useState(defaultForm);
  const queryClient = useQueryClient();

  const { data: zones = [], isLoading, error: zoneError } = useQuery({ queryKey: ['zones'], queryFn: () => base44.entities.Zone.list() });
  const { data: providers = [] } = useQuery({ queryKey: ['providers'], queryFn: () => base44.entities.Provider.list() });

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      const payload = {
        name: data.name.trim(),
        description: data.description || '',
        color: data.color || '#6366f1',
        providerId: data.providerId,
        defaultVolume: Number(data.defaultVolume ?? 50),
        minVolume: Number(data.minVolume ?? 0),
        maxVolume: Number(data.maxVolume ?? 100),
        isActive: data.isActive !== false,
        updatedAt: new Date().toISOString(),
      };
      if (!payload.name) throw new Error('Zone Name fehlt.');
      if (!payload.providerId) throw new Error('Spotify Provider fehlt.');
      if (editZone) return base44.entities.Zone.update(editZone.id, payload);
      return base44.entities.Zone.create({ ...payload, createdAt: new Date().toISOString() });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['zones'] }); toast.success(editZone ? 'Zone aktualisiert.' : 'Zone erstellt.'); closeForm(); },
    onError: (error) => toast.error(`Zone konnte nicht gespeichert werden: ${error.message}`),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Zone.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['zones'] }); toast.success('Zone gelöscht.'); },
    onError: (error) => toast.error(`Zone konnte nicht gelöscht werden: ${error.message}`),
  });

  const openCreate = () => { setEditZone(null); setFormData(defaultForm); setShowForm(true); };
  const openEdit = (zone) => { setEditZone(zone); setFormData({ ...defaultForm, ...zone }); setShowForm(true); };
  const closeForm = () => { setShowForm(false); setEditZone(null); setFormData(defaultForm); };
  const upd = (k, v) => setFormData(p => ({ ...p, [k]: v }));

  if (isLoading) return <div className="p-8 flex items-center justify-center gap-3"><RefreshCw className="w-5 h-5 text-primary animate-spin" /><span className="text-muted-foreground">Lade Zonen...</span></div>;

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div><h1 className="text-2xl lg:text-3xl font-black flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center"><MapPin className="w-5 h-5 text-primary" /></div>Zonen</h1><p className="text-sm text-muted-foreground mt-1 ml-14">Bereiche wie Gym, Tennishalle oder weitere Player-Zonen.</p></div>
        <Button className="bg-primary hover:bg-primary/90 h-11 px-6 gap-2 font-semibold" onClick={openCreate}><Plus className="w-4 h-4" /> Zone erstellen</Button>
      </div>

      {zoneError && <div className="bento-panel border-red-500/20 bg-red-500/5 p-4 text-sm text-red-300">Zonen konnten nicht geladen werden: {zoneError.message}</div>}

      {zones.length === 0 ? (
        <div className="bento-panel border-dashed border-primary/20 p-16 text-center"><MapPin className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" /><h3 className="text-xl font-bold mb-2">Noch keine Zonen</h3><p className="text-muted-foreground text-sm mb-6">Erstelle zuerst eine Zone und weise einen Spotify Provider zu.</p><Button className="bg-primary hover:bg-primary/90" onClick={openCreate}><Plus className="w-4 h-4 mr-2" /> Erste Zone erstellen</Button></div>
      ) : (
        <div className="space-y-4"><AnimatePresence>{zones.map((zone, i) => { const provider = providers.find(p => p.id === zone.providerId); return (
          <motion.div key={zone.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <div className="bento-panel border border-border/50 overflow-hidden"><div className="p-5 flex items-center gap-4 flex-wrap"><div className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center" style={{ background: `${zone.color || '#6366f1'}22`, border: `1px solid ${zone.color || '#6366f1'}44` }}><div className="w-3 h-3 rounded-full" style={{ background: zone.color || '#6366f1' }} /></div><div className="flex-1 min-w-0"><div className="flex items-center gap-2"><p className="font-bold text-lg">{zone.name}</p>{zone.isActive !== false ? <span className="text-xs font-semibold text-green-400">● Aktiv</span> : <span className="text-xs font-semibold text-muted-foreground">● Inaktiv</span>}</div><div className="flex items-center gap-3 mt-1 flex-wrap">{provider ? <span className="text-xs text-muted-foreground flex items-center gap-1"><Music2 className="w-3 h-3" />{provider.name || provider.displayName}{providerStatus(provider) === 'connected' ? ' ✓' : ' ✗'}</span> : <span className="text-xs text-yellow-400">⚠ Kein Provider zugewiesen</span>}<span className="text-xs text-muted-foreground">Volume {zone.defaultVolume}%</span></div></div><div className="flex items-center gap-2"><Button variant="ghost" size="sm" onClick={() => openEdit(zone)}>Bearbeiten</Button><Button variant="ghost" size="sm" className="text-destructive/70 hover:text-destructive" onClick={() => deleteMutation.mutate(zone.id)} disabled={deleteMutation.isPending}><XCircle className="w-4 h-4" /></Button></div></div></div>
          </motion.div>
        ); })}</AnimatePresence></div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editZone ? 'Zone bearbeiten' : 'Zone erstellen'}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div><Label className="text-sm font-semibold mb-2 block">Name *</Label><Input value={formData.name} onChange={e => upd('name', e.target.value)} placeholder="z. B. Gym" className="h-11 bg-muted/30" /></div>
            <div><Label className="text-sm font-semibold mb-2 block">Beschreibung</Label><Input value={formData.description || ''} onChange={e => upd('description', e.target.value)} placeholder="Optional" className="h-11 bg-muted/30" /></div>
            <div><Label className="text-sm font-semibold mb-2 block">Farbe</Label><div className="flex gap-2 flex-wrap">{ZONE_COLORS.map(c => <button key={c} onClick={() => upd('color', c)} className="w-8 h-8 rounded-full border-2 transition-all" style={{ background: c, borderColor: formData.color === c ? 'white' : 'transparent' }} />)}</div></div>
            <div><Label className="text-sm font-semibold mb-2 block">Spotify Provider *</Label><Select value={formData.providerId || 'none'} onValueChange={v => upd('providerId', v === 'none' ? '' : v)}><SelectTrigger className="h-11 bg-muted/30"><SelectValue placeholder="Provider wählen" /></SelectTrigger><SelectContent><SelectItem value="none">Kein Provider</SelectItem>{providers.map(p => <SelectItem key={p.id} value={p.id}>{p.name || p.displayName} {providerStatus(p) === 'connected' ? '✓' : '(nicht verbunden)'}</SelectItem>)}</SelectContent></Select></div>
            <div><div className="flex justify-between mb-2"><Label className="text-sm font-semibold">Standard-Lautstärke</Label><span className="text-2xl font-black text-primary">{formData.defaultVolume}%</span></div><Slider value={[formData.defaultVolume]} onValueChange={([v]) => upd('defaultVolume', v)} /></div>
            <div className="grid grid-cols-2 gap-3"><div><Label className="text-sm font-semibold mb-1 block">Min</Label><Input type="number" min={0} max={100} value={formData.minVolume} onChange={e => upd('minVolume', +e.target.value)} className="h-10 bg-muted/30" /></div><div><Label className="text-sm font-semibold mb-1 block">Max</Label><Input type="number" min={0} max={100} value={formData.maxVolume} onChange={e => upd('maxVolume', +e.target.value)} className="h-10 bg-muted/30" /></div></div>
            <div className="flex gap-3"><Button variant="outline" className="flex-1" onClick={closeForm}>Abbrechen</Button><Button className="flex-1 bg-primary hover:bg-primary/90 font-bold" disabled={!formData.name.trim() || !formData.providerId || saveMutation.isPending} onClick={() => saveMutation.mutate(formData)}>{saveMutation.isPending ? 'Speichern...' : 'Speichern'}</Button></div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
