import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, Trash2, Edit2, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import PageHeader from '@/components/ui/PageHeader';
import CalendarGrid from '@/components/calendar/CalendarGrid';
import { toast } from 'sonner';

const DAYS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
const DAY_INDICES = [1, 2, 3, 4, 5, 6, 0];

export default function Calendar() {
  const [selectedZone, setSelectedZone] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editBlock, setEditBlock] = useState(null);
  const [formData, setFormData] = useState({
    zoneId: '', playlistId: '', title: '', dayOfWeek: 1,
    startTime: '08:00', endTime: '10:00', repeatWeekly: true,
    baseVolume: 50, volumeRampEnabled: false, startVolume: 40, endVolume: 60,
    rampMode: 'continuous', isActive: true,
  });
  const queryClient = useQueryClient();

  const { data: blocks = [] } = useQuery({
    queryKey: ['scheduleBlocks'],
    queryFn: () => base44.entities.ScheduleBlock.list(),
  });
  const { data: zones = [] } = useQuery({
    queryKey: ['zones'],
    queryFn: () => base44.entities.Zone.list(),
  });
  const { data: playlists = [] } = useQuery({
    queryKey: ['playlists'],
    queryFn: () => base44.entities.Playlist.list(),
  });

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
    setFormData(prev => ({
      ...prev,
      dayOfWeek,
      startTime,
      endTime,
      zoneId: selectedZone || '',
    }));
    setShowForm(true);
  };

  const editForm = (block) => {
    setEditBlock(block);
    setFormData(block);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditBlock(null);
  };

  const update = (k, v) => setFormData(p => ({ ...p, [k]: v }));

  const filteredBlocks = selectedZone 
    ? blocks.filter(b => b.zoneId === selectedZone)
    : blocks;

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Zeitplaner"
        subtitle="Wöchentliche Automatisierung planen"
        actions={
          <Button className="bg-primary hover:bg-primary/90 h-10 px-6" onClick={() => openForm(1)}>
            <Plus className="w-5 h-5 mr-2" /> Neuer Block
          </Button>
        }
      />

      {/* Zone Filter */}
      {zones.length > 0 && (
        <div className="space-y-3">
          <Label className="text-sm font-semibold">Nach Zone filtern:</Label>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={selectedZone === null ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedZone(null)}
              className="h-9"
            >
              Alle Zonen
            </Button>
            {zones.map(zone => (
              <Button
                key={zone.id}
                variant={selectedZone === zone.id ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedZone(zone.id)}
                className="h-9"
                style={selectedZone !== zone.id ? { borderColor: zone.color, color: zone.color } : {}}
              >
                {zone.name}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Calendar Grid */}
      {zones.length === 0 ? (
        <Card className="glass-card border-dashed border-primary/30">
          <CardContent className="p-12 text-center">
            <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Keine Zonen vorhanden</h3>
            <p className="text-muted-foreground mb-6">Bitte erstelle zuerst eine Zone bei den Geräten.</p>
            <a href="/devices/add"><Button className="bg-primary hover:bg-primary/90">Zur Geräteverwaltung</Button></a>
          </CardContent>
        </Card>
      ) : (
        <CalendarGrid
          blocks={filteredBlocks}
          zones={zones}
          onOpenForm={openForm}
          onEdit={editForm}
          onDelete={(id) => deleteMutation.mutate(id)}
          selectedZone={selectedZone}
        />
      )}

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-2xl">{editBlock ? 'Block bearbeiten' : 'Zeitfenster erstellen'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-6 max-h-96 overflow-y-auto py-6">
            {/* Zone */}
            <div>
              <Label className="text-sm font-semibold">Zone *</Label>
              <Select value={formData.zoneId} onValueChange={v => update('zoneId', v)}>
                <SelectTrigger className="mt-2 h-10 bg-muted/50"><SelectValue placeholder="Zone auswählen" /></SelectTrigger>
                <SelectContent>
                  {zones.map(z => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Wochentag */}
            <div>
              <Label className="text-sm font-semibold">Wochentag</Label>
              <Select value={String(formData.dayOfWeek)} onValueChange={v => update('dayOfWeek', parseInt(v))}>
                <SelectTrigger className="mt-2 h-10 bg-muted/50"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DAYS.map((d, i) => <SelectItem key={i} value={String(DAY_INDICES[i])}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Startzeit */}
            <div>
              <Label className="text-sm font-semibold">Startzeit</Label>
              <Input type="time" value={formData.startTime} onChange={e => update('startTime', e.target.value)} className="mt-2 h-10 bg-muted/50" />
            </div>

            {/* Endzeit */}
            <div>
              <Label className="text-sm font-semibold">Endzeit</Label>
              <Input type="time" value={formData.endTime} onChange={e => update('endTime', e.target.value)} className="mt-2 h-10 bg-muted/50" />
            </div>

            {/* Titel */}
            <div className="col-span-2">
              <Label className="text-sm font-semibold">Titel (optional)</Label>
              <Input value={formData.title} onChange={e => update('title', e.target.value)} placeholder="z.B. Morgentraining" className="mt-2 h-10 bg-muted/50" />
            </div>

            {/* Playlist */}
            <div className="col-span-2">
              <Label className="text-sm font-semibold">Playlist</Label>
              <Select value={formData.playlistId} onValueChange={v => update('playlistId', v)}>
                <SelectTrigger className="mt-2 h-10 bg-muted/50"><SelectValue placeholder="Keine Playlist" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Keine</SelectItem>
                  {playlists.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Basis-Lautstärke */}
            <div className="col-span-2">
              <Label className="text-sm font-semibold">Lautstärke: {formData.baseVolume}%</Label>
              <Slider value={[formData.baseVolume]} onValueChange={([v]) => update('baseVolume', v)} className="mt-3" />
            </div>

            {/* Rampenverlauf */}
            <div className="col-span-2">
              <div className="flex items-center justify-between mb-4">
                <Label className="text-sm font-semibold">Lautstärkerampe aktivieren</Label>
                <Switch checked={formData.volumeRampEnabled} onCheckedChange={v => update('volumeRampEnabled', v)} />
              </div>
              {formData.volumeRampEnabled && (
                <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
                  <div>
                    <Label className="text-sm">Start: {formData.startVolume}%</Label>
                    <Slider value={[formData.startVolume]} onValueChange={([v]) => update('startVolume', v)} className="mt-2" />
                  </div>
                  <div>
                    <Label className="text-sm">Ende: {formData.endVolume}%</Label>
                    <Slider value={[formData.endVolume]} onValueChange={([v]) => update('endVolume', v)} className="mt-2" />
                  </div>
                  <div>
                    <Label className="text-sm font-semibold">Rampenmodus</Label>
                    <Select value={formData.rampMode} onValueChange={v => update('rampMode', v)}>
                      <SelectTrigger className="mt-2 h-10 bg-muted/50"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="continuous">Kontinuierlich</SelectItem>
                        <SelectItem value="hourly">Stündlich</SelectItem>
                        <SelectItem value="every_30_min">Alle 30 Min</SelectItem>
                        <SelectItem value="every_15_min">Alle 15 Min</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>

            {/* Aktiv */}
            <div className="col-span-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Aktiv</Label>
                <Switch checked={formData.isActive} onCheckedChange={v => update('isActive', v)} />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-6 border-t border-border">
            {editBlock && (
              <Button variant="destructive" onClick={() => {
                deleteMutation.mutate(editBlock.id);
                closeForm();
              }}>
                <Trash2 className="w-4 h-4 mr-2" /> Löschen
              </Button>
            )}
            <Button variant="outline" className="flex-1" onClick={closeForm}>Abbrechen</Button>
            <Button 
              className="flex-1 bg-primary hover:bg-primary/90 h-10"
              onClick={() => saveMutation.mutate(formData)}
              disabled={saveMutation.isPending || !formData.zoneId}
            >
              {saveMutation.isPending ? 'Speichern...' : 'Speichern'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}