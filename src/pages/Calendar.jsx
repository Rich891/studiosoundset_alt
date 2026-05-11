import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, Calendar as CalendarIcon, Trash2, Edit, Clock, GripVertical } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import PageHeader from '@/components/ui/PageHeader';
import { toast } from 'sonner';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

const DAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const DAYS_SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

export default function Calendar() {
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
      setShowForm(false);
      setEditBlock(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ScheduleBlock.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduleBlocks'] });
      toast.success('Block gelöscht.');
    },
  });

  const openEdit = (block) => {
    setEditBlock(block);
    setFormData({ ...block });
    setShowForm(true);
  };

  const openNew = () => {
    setEditBlock(null);
    setFormData({
      zoneId: '', playlistId: '', title: '', dayOfWeek: 1,
      startTime: '08:00', endTime: '10:00', repeatWeekly: true,
      baseVolume: 50, volumeRampEnabled: false, startVolume: 40, endVolume: 60,
      rampMode: 'continuous', isActive: true,
    });
    setShowForm(true);
  };

  const update = (k, v) => setFormData(p => ({ ...p, [k]: v }));

  const blocksByDay = DAYS.map((_, i) => blocks.filter(b => b.dayOfWeek === i));

  const handleDragEnd = async (result) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;

    const fromDay = parseInt(source.droppableId);
    const toDay = parseInt(destination.droppableId);
    const blockId = draggableId;

    if (fromDay === toDay && source.index === destination.index) return;

    try {
      await base44.entities.ScheduleBlock.update(blockId, { dayOfWeek: toDay });
      queryClient.invalidateQueries({ queryKey: ['scheduleBlocks'] });
      toast.success('Block verschoben!');
    } catch (e) {
      toast.error('Fehler beim Verschieben: ' + e.message);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Kalender"
        subtitle="Zeitgesteuerte Playlist- und Lautstärkeautomatisierung"
        actions={
          <Button className="bg-primary hover:bg-primary/90" onClick={openNew}>
            <Plus className="w-4 h-4 mr-2" /> Zeitblock erstellen
          </Button>
        }
      />

      {blocks.length === 0 ? (
        <Card className="glass-card border-dashed border-primary/30">
          <CardContent className="p-12 text-center">
            <CalendarIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Noch keine Zeitfenster geplant</h3>
            <p className="text-muted-foreground text-sm mb-6">
              Erstelle Zeitblöcke, um automatisch Playlists und Lautstärken zu steuern.
            </p>
            <Button className="bg-primary hover:bg-primary/90" onClick={openNew}>
              <Plus className="w-4 h-4 mr-2" /> Zeitfenster erstellen
            </Button>
          </CardContent>
        </Card>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
            {DAYS.map((day, dayIdx) => (
              <Droppable key={dayIdx} droppableId={String(dayIdx)}>
                {(provided, snapshot) => (
                  <div
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className={`glass-card rounded-xl overflow-hidden transition-colors ${
                      snapshot.isDraggingOver ? 'bg-primary/10 border-primary/50' : ''
                    }`}
                  >
                    <div className="px-3 py-2 border-b border-border">
                      <p className="text-xs font-bold text-primary">{DAYS_SHORT[dayIdx]}</p>
                      <p className="text-xs text-muted-foreground">{day}</p>
                    </div>
                    <div className="p-2 space-y-2 min-h-24">
                      {blocksByDay[dayIdx].map((block, index) => {
                        const zone = zones.find(z => z.id === block.zoneId);
                        return (
                          <Draggable key={block.id} draggableId={block.id} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className={`p-2 rounded-lg text-xs cursor-move hover:opacity-80 transition-all group relative ${
                                  snapshot.isDragging ? 'shadow-lg scale-105' : ''
                                }`}
                                style={{
                                  background: `${zone?.color || '#6366f1'}20`,
                                  borderLeft: `3px solid ${zone?.color || '#6366f1'}`,
                                  ...provided.draggableProps.style,
                                }}
                              >
                                <div className="flex items-start gap-2">
                                  <div {...provided.dragHandleProps} className="mt-0.5 flex-shrink-0">
                                    <GripVertical className="w-3 h-3 text-muted-foreground/50" />
                                  </div>
                                  <div className="flex-1 min-w-0" onClick={() => openEdit(block)}>
                                    <p className="font-medium truncate">{block.title || zone?.name || 'Block'}</p>
                                    <p className="text-muted-foreground">{block.startTime}–{block.endTime}</p>
                                    <div className="flex items-center gap-1 mt-1">
                                      <span className="text-muted-foreground">🔊 {block.baseVolume}%</span>
                                      {!block.isActive && <span className="text-orange-400">inaktiv</span>}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}
                    </div>
                  </div>
                )}
              </Droppable>
            ))}
          </div>
        </DragDropContext>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg bg-card border-border">
          <DialogHeader>
            <DialogTitle>{editBlock ? 'Block bearbeiten' : 'Neuen Zeitblock erstellen'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Titel</Label>
              <Input value={formData.title} onChange={e => update('title', e.target.value)} className="mt-1 bg-muted/50" placeholder="z.B. Morgentraining" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Wochentag</Label>
                <Select value={String(formData.dayOfWeek)} onValueChange={v => update('dayOfWeek', parseInt(v))}>
                  <SelectTrigger className="mt-1 bg-muted/50"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DAYS.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Zone</Label>
                <Select value={formData.zoneId} onValueChange={v => update('zoneId', v)}>
                  <SelectTrigger className="mt-1 bg-muted/50"><SelectValue placeholder="Zone wählen" /></SelectTrigger>
                  <SelectContent>
                    {zones.map(z => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Startzeit</Label>
                <Input type="time" value={formData.startTime} onChange={e => update('startTime', e.target.value)} className="mt-1 bg-muted/50" />
              </div>
              <div>
                <Label>Endzeit</Label>
                <Input type="time" value={formData.endTime} onChange={e => update('endTime', e.target.value)} className="mt-1 bg-muted/50" />
              </div>
            </div>
            <div>
              <Label>Playlist</Label>
              <Select value={formData.playlistId} onValueChange={v => update('playlistId', v)}>
                <SelectTrigger className="mt-1 bg-muted/50"><SelectValue placeholder="Playlist wählen (optional)" /></SelectTrigger>
                <SelectContent>
                  {playlists.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Lautstärke: {formData.baseVolume}%</Label>
              </div>
              <Slider value={[formData.baseVolume]} onValueChange={([v]) => update('baseVolume', v)} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Lautstärke-Rampe</Label>
              <Switch checked={formData.volumeRampEnabled} onCheckedChange={v => update('volumeRampEnabled', v)} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Wöchentlich wiederholen</Label>
              <Switch checked={formData.repeatWeekly} onCheckedChange={v => update('repeatWeekly', v)} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Aktiv</Label>
              <Switch checked={formData.isActive} onCheckedChange={v => update('isActive', v)} />
            </div>
            <div className="flex gap-2 pt-2">
              {editBlock && (
                <Button variant="destructive" size="sm" onClick={() => { deleteMutation.mutate(editBlock.id); setShowForm(false); }}>
                  Löschen
                </Button>
              )}
              <Button variant="outline" className="flex-1" onClick={() => setShowForm(false)}>Abbrechen</Button>
              <Button className="flex-1 bg-primary hover:bg-primary/90" onClick={() => saveMutation.mutate(formData)} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Speichern...' : 'Speichern'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}