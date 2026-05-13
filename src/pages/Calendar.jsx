import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Clock, CalendarDays, TrendingUp, Save, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import CalendarGrid from '@/components/calendar/CalendarGrid';
import RampPreview from '@/components/calendar/RampPreview';
import { toast } from 'sonner';

const DAYS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
const DAY_INDICES = [1, 2, 3, 4, 5, 6, 0];

const defaultForm = {
  playerDeviceId: '', playlistId: '', title: '', dayOfWeek: 1,
  startTime: '08:00', endTime: '10:00', repeatWeekly: true,
  baseVolume: 50, rampEnabled: false, startVolume: 40, endVolume: 60,
  rampMode: 'continuous', isActive: true,
};

export default function Calendar() {
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editBlock, setEditBlock] = useState(null);
  const [formData, setFormData] = useState(defaultForm);
  const queryClient = useQueryClient();

  const { data: blocks = [] }       = useQuery({ queryKey: ['scheduleBlocks'], queryFn: () => base44.entities.ScheduleBlock.list() });
  const { data: allPlayerDevices = [] } = useQuery({ queryKey: ['playerDevices'], queryFn: () => base44.entities.PlayerDevice.list() });
  const { data: playlists = [] }     = useQuery({ queryKey: ['playlists'],      queryFn: () => base44.entities.Playlist.list() });

  // Nur gekoppelte Geräte zeigen
  const playerDevices = allPlayerDevices.filter(d => d.isPaired);

  const saveMutation = useMutation({
    mutationFn: (data) => editBlock
      ? base44.entities.ScheduleBlock.update(editBlock.id, data)
      : base44.entities.ScheduleBlock.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduleBlocks'] });
      toast.success(editBlock ? 'Block aktualisiert.' : 'Block erstellt.');
      closeForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ScheduleBlock.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduleBlocks'] });
      toast.success('Block gelöscht.');
    },
  });

  const openForm = (dayOfWeek, startTime = '08:00', endTime = '10:00') => {
    setEditBlock(null);
    setFormData({ ...defaultForm, dayOfWeek, startTime, endTime, playerDeviceId: selectedDevice || '' });
    setShowForm(true);
  };

  const editForm = (block) => {
    setEditBlock(block);
    setFormData(block);
    setShowForm(true);
  };

  const closeForm = () => { setShowForm(false); setEditBlock(null); };
  const upd = (k, v) => setFormData(p => ({ ...p, [k]: v }));

  const filteredBlocks = selectedDevice ? blocks.filter(b => b.playerDeviceId === selectedDevice) : blocks;

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-black text-foreground flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <CalendarDays className="w-5 h-5 text-primary" />
            </div>
            Zeitplaner
          </h1>
          <p className="text-sm text-muted-foreground mt-1 ml-14">Wöchentliche Automatisierung planen</p>
        </div>
        <Button
          className="bg-primary hover:bg-primary/90 h-11 px-6 gap-2 font-semibold"
          onClick={() => openForm(1)}
        >
          <Plus className="w-4 h-4" /> Neuer Block
        </Button>
      </div>

      {/* Player Device Filter */}
      {playerDevices.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedDevice(null)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all duration-150 ${
              selectedDevice === null
                ? 'bg-primary text-white border-primary shadow-[0_0_15px_hsl(var(--primary)/0.4)]'
                : 'border-border/40 text-muted-foreground hover:border-border hover:text-foreground'
            }`}
          >
            Alle Geräte
          </button>
          {playerDevices.map(device => (
            <button
              key={device.id}
              onClick={() => setSelectedDevice(device.id)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all duration-150 ${
                selectedDevice === device.id
                  ? 'bg-primary text-white border-primary'
                  : 'border-border/40 text-muted-foreground hover:border-border hover:text-foreground'
              }`}
            >
              {device.name}
            </button>
          ))}
        </div>
      )}

      {/* Calendar or Empty */}
      {playerDevices.length === 0 ? (
        <div className="bento-panel border-dashed border-primary/20 p-16 text-center">
          <Clock className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-xl font-bold mb-2">Keine Player vorhanden</h3>
          <p className="text-muted-foreground mb-6">Erstelle zuerst einen Player in der Geräteverwaltung.</p>
          <a href="/manage-players">
            <Button className="bg-primary hover:bg-primary/90 h-11 px-6">Zur Player-Verwaltung</Button>
          </a>
        </div>
      ) : (
        <CalendarGrid
          blocks={filteredBlocks}
          playerDevices={playerDevices}
          onOpenForm={openForm}
          onEdit={editForm}
          onDelete={(id) => deleteMutation.mutate(id)}
        />
      )}

      {/* Block Form Dialog */}
      <AnimatePresence>
        {showForm && (
          <Dialog open={showForm} onOpenChange={setShowForm}>
            <DialogContent className="max-w-3xl bg-card border-border max-h-[92vh] overflow-y-auto">
              <DialogHeader className="pb-4 border-b border-border">
                <DialogTitle className="text-xl font-black flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                    <CalendarDays className="w-4 h-4 text-primary" />
                  </div>
                  {editBlock ? 'Block bearbeiten' : 'Zeitfenster erstellen'}
                </DialogTitle>
              </DialogHeader>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
                {/* Left column */}
                <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Zeitfenster</h3>

                  <div>
                    <Label className="text-sm font-semibold mb-2 block">Player *</Label>
                    <Select value={formData.playerDeviceId} onValueChange={v => upd('playerDeviceId', v)}>
                      <SelectTrigger className="h-11 bg-muted/30">
                        <SelectValue placeholder="Player auswählen" />
                      </SelectTrigger>
                      <SelectContent>
                        {playerDevices.map(d => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-sm font-semibold mb-2 block">Wochentag</Label>
                    <Select value={String(formData.dayOfWeek)} onValueChange={v => upd('dayOfWeek', parseInt(v))}>
                      <SelectTrigger className="h-11 bg-muted/30"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {DAYS.map((d, i) => <SelectItem key={i} value={String(DAY_INDICES[i])}>{d}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-sm font-semibold mb-2 block">Startzeit</Label>
                      <Input type="time" value={formData.startTime} onChange={e => upd('startTime', e.target.value)} className="h-11 bg-muted/30 font-mono text-base" />
                    </div>
                    <div>
                      <Label className="text-sm font-semibold mb-2 block">Endzeit</Label>
                      <Input type="time" value={formData.endTime} onChange={e => upd('endTime', e.target.value)} className="h-11 bg-muted/30 font-mono text-base" />
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-semibold mb-2 block">Titel (optional)</Label>
                    <Input value={formData.title} onChange={e => upd('title', e.target.value)} placeholder="z.B. Morgentraining" className="h-11 bg-muted/30" />
                  </div>

                  <div>
                    <Label className="text-sm font-semibold mb-2 block">Playlist</Label>
                    <Select value={formData.playlistId || 'none'} onValueChange={v => upd('playlistId', v === 'none' ? '' : v)}>
                      <SelectTrigger className="h-11 bg-muted/30"><SelectValue placeholder="Keine Playlist" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— Keine Playlist —</SelectItem>
                        {playlists.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-muted/20 rounded-xl">
                    <Label className="text-sm font-semibold">Wöchentlich wiederholen</Label>
                    <Switch checked={formData.repeatWeekly} onCheckedChange={v => upd('repeatWeekly', v)} />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-muted/20 rounded-xl">
                    <Label className="text-sm font-semibold">Block aktiv</Label>
                    <Switch checked={formData.isActive} onCheckedChange={v => upd('isActive', v)} />
                  </div>
                </div>

                {/* Right column: Volume */}
                <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Lautstärke</h3>

                  <div className="p-4 bg-muted/20 rounded-xl space-y-4">
                    <div className="flex items-center justify-between">
                       <div className="flex items-center gap-2">
                         <TrendingUp className="w-4 h-4 text-primary" />
                         <Label className="text-sm font-bold">Lautstärke-Rampe</Label>
                       </div>
                       <Switch checked={formData.rampEnabled} onCheckedChange={v => upd('rampEnabled', v)} />
                     </div>

                     {!formData.rampEnabled ? (
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <Label className="text-sm font-semibold">Grundlautstärke</Label>
                          <span className="text-3xl font-black text-primary">{formData.baseVolume}%</span>
                        </div>
                        <Slider
                          value={[formData.baseVolume]}
                          onValueChange={([v]) => upd('baseVolume', v)}
                          className="mt-2"
                        />
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <Label className="text-sm font-semibold">Startlautstärke</Label>
                            <span className="text-2xl font-black text-cyan-400">{formData.startVolume}%</span>
                          </div>
                          <Slider value={[formData.startVolume]} onValueChange={([v]) => upd('startVolume', v)} />
                        </div>

                        <div className="flex items-center justify-center">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <span className="text-lg font-black text-cyan-400">{formData.startVolume}%</span>
                            <TrendingUp className="w-5 h-5 text-primary" />
                            <span className="text-lg font-black text-violet-400">{formData.endVolume}%</span>
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <Label className="text-sm font-semibold">Endlautstärke</Label>
                            <span className="text-2xl font-black text-violet-400">{formData.endVolume}%</span>
                          </div>
                          <Slider value={[formData.endVolume]} onValueChange={([v]) => upd('endVolume', v)} />
                        </div>

                        <div>
                          <Label className="text-sm font-semibold mb-2 block">Rampenmodus</Label>
                          <Select value={formData.rampMode} onValueChange={v => upd('rampMode', v)}>
                            <SelectTrigger className="h-10 bg-muted/30"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="continuous">Kontinuierlich</SelectItem>
                              <SelectItem value="hourly">Stündlich</SelectItem>
                              <SelectItem value="every_30_min">Alle 30 Minuten</SelectItem>
                              <SelectItem value="every_15_min">Alle 15 Minuten</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Ramp Preview */}
                   {formData.rampEnabled && formData.startTime && formData.endTime && (
                    <RampPreview
                      startTime={formData.startTime}
                      endTime={formData.endTime}
                      startVolume={formData.startVolume}
                      endVolume={formData.endVolume}
                      rampMode={formData.rampMode}
                    />
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-border">
                {editBlock && (
                  <Button
                    variant="destructive"
                    className="gap-2"
                    onClick={() => { deleteMutation.mutate(editBlock.id); closeForm(); }}
                  >
                    <Trash2 className="w-4 h-4" /> Löschen
                  </Button>
                )}
                <Button variant="outline" className="flex-1 h-11 gap-2" onClick={closeForm}>
                  <X className="w-4 h-4" /> Abbrechen
                </Button>
                <Button
                   className="flex-1 h-11 bg-primary hover:bg-primary/90 gap-2 font-bold"
                   onClick={() => saveMutation.mutate(formData)}
                   disabled={saveMutation.isPending || !formData.playerDeviceId}
                 >
                  <Save className="w-4 h-4" />
                  {saveMutation.isPending ? 'Wird gespeichert...' : 'Speichern'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </AnimatePresence>
    </div>
  );
}