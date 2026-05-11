import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, Trash2, Edit, GripVertical, Clock, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
const HOURS = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);

export default function Calendar() {
  const [selectedZone, setSelectedZone] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editBlock, setEditBlock] = useState(null);
  const [newBlockDay, setNewBlockDay] = useState(null);
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
      setNewBlockDay(null);
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
    setNewBlockDay(null);
    setFormData({ ...block });
    setShowForm(true);
  };

  const openNewBlock = (dayOfWeek, startHour) => {
    setEditBlock(null);
    setNewBlockDay(dayOfWeek);
    setFormData({
      zoneId: selectedZone || '', playlistId: '', title: '', dayOfWeek,
      startTime: `${String(startHour).padStart(2, '0')}:00`,
      endTime: `${String((startHour + 1) % 24).padStart(2, '0')}:00`,
      repeatWeekly: true,
      baseVolume: 50, volumeRampEnabled: false, startVolume: 40, endVolume: 60,
      rampMode: 'continuous', isActive: true,
    });
    setShowForm(true);
  };

  const update = (k, v) => setFormData(p => ({ ...p, [k]: v }));

  // Filter blocks by selected zone
  const filteredBlocks = selectedZone ? blocks.filter(b => b.zoneId === selectedZone) : blocks;
  const blocksByDay = DAYS.map((_, i) => filteredBlocks.filter(b => b.dayOfWeek === i));

  const handleDragEnd = async (result) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;

    const fromDay = parseInt(source.droppableId);
    const toDay = parseInt(destination.droppableId);

    if (fromDay === toDay && source.index === destination.index) return;

    try {
      await base44.entities.ScheduleBlock.update(draggableId, { dayOfWeek: toDay });
      queryClient.invalidateQueries({ queryKey: ['scheduleBlocks'] });
      toast.success('Block verschoben!');
    } catch (e) {
      toast.error('Fehler: ' + e.message);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Kalender"
        subtitle="Playlists und Lautstärke automatisieren"
        actions={
          <Button className="bg-primary hover:bg-primary/90" onClick={() => {
            setEditBlock(null);
            setNewBlockDay(null);
            setFormData({
              zoneId: selectedZone || '', playlistId: '', title: '', dayOfWeek: 1,
              startTime: '08:00', endTime: '10:00', repeatWeekly: true,
              baseVolume: 50, volumeRampEnabled: false, startVolume: 40, endVolume: 60,
              rampMode: 'continuous', isActive: true,
            });
            setShowForm(true);
          }}>
            <Plus className="w-4 h-4 mr-2" /> Block erstellen
          </Button>
        }
      />

      {/* Zone Selector */}
      {zones.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-muted-foreground mb-3">Nach Zone filtern:</p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={selectedZone === null ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedZone(null)}
              className={selectedZone === null ? 'bg-primary' : ''}
            >
              Alle Zonen
            </Button>
            {zones.map(zone => (
              <Button
                key={zone.id}
                variant={selectedZone === zone.id ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedZone(zone.id)}
                style={selectedZone === zone.id ? {} : { borderColor: zone.color, color: zone.color }}
                className={selectedZone === zone.id ? '' : 'hover:bg-transparent'}
              >
                {zone.name}
              </Button>
            ))}
          </div>
        </div>
      )}

      {filteredBlocks.length === 0 ? (
        <Card className="glass-card border-dashed border-primary/30">
          <CardContent className="p-12 text-center">
            <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Noch keine Blöcke</h3>
            <p className="text-muted-foreground text-sm mb-6 max-w-sm mx-auto">
              {selectedZone ? 'Keine Blöcke für diese Zone.' : 'Erstelle Blöcke für automatische Playlist- und Lautstärkeverwaltung.'}
            </p>
            <Button className="bg-primary hover:bg-primary/90" onClick={() => {
              setEditBlock(null);
              setNewBlockDay(null);
              setFormData({
                zoneId: selectedZone || '', playlistId: '', title: '', dayOfWeek: 1,
                startTime: '08:00', endTime: '10:00', repeatWeekly: true,
                baseVolume: 50, volumeRampEnabled: false, startVolume: 40, endVolume: 60,
                rampMode: 'continuous', isActive: true,
              });
              setShowForm(true);
            }}>
              <Plus className="w-4 h-4 mr-2" /> Ersten Block erstellen
            </Button>
          </CardContent>
        </Card>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2">
            {DAYS.map((day, dayIdx) => (
              <Droppable key={dayIdx} droppableId={String(dayIdx)}>
                {(provided, snapshot) => (
                  <div
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className={`glass-card rounded-lg overflow-hidden transition-all min-h-96 flex flex-col ${
                      snapshot.isDraggingOver ? 'bg-primary/10 border-primary/50' : ''
                    }`}
                  >
                    {/* Day Header */}
                    <div className="sticky top-0 px-3 py-2.5 bg-card/50 border-b border-border">
                      <p className="text-xs font-bold text-primary">{DAYS_SHORT[dayIdx]}</p>
                      <p className="text-xs text-muted-foreground">{day}</p>
                    </div>

                    {/* Blocks Container */}
                    <div className="flex-1 p-2 space-y-1.5 overflow-y-auto">
                      {blocksByDay[dayIdx].length === 0 ? (
                        <div className="h-full flex items-center justify-center text-xs text-muted-foreground text-center">
                          <p>Keine Blöcke</p>
                        </div>
                      ) : (
                        blocksByDay[dayIdx].map((block, index) => {
                          const zone = zones.find(z => z.id === block.zoneId);
                          return (
                            <Draggable key={block.id} draggableId={block.id} index={index}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  className={`p-2 rounded-lg text-xs cursor-move hover:opacity-90 transition-all group relative ${
                                    snapshot.isDragging ? 'shadow-lg scale-105 z-50' : ''
                                  }`}
                                  style={{
                                    background: `${zone?.color || '#6366f1'}18`,
                                    borderLeft: `3px solid ${zone?.color || '#6366f1'}`,
                                    ...provided.draggableProps.style,
                                  }}
                                >
                                  <div className="flex items-start gap-2 opacity-0 group-hover:opacity-100 absolute top-1 right-1 transition-opacity z-10">
                                    <button
                                      onClick={() => openEdit(block)}
                                      className="p-1 hover:bg-primary/20 rounded"
                                      title="Bearbeiten"
                                    >
                                      <Edit className="w-3 h-3 text-primary" />
                                    </button>
                                    <button
                                      onClick={() => deleteMutation.mutate(block.id)}
                                      className="p-1 hover:bg-destructive/20 rounded"
                                      title="Löschen"
                                    >
                                      <Trash2 className="w-3 h-3 text-destructive" />
                                    </button>
                                  </div>
                                  <div className="flex items-start gap-2 pr-12">
                                    <div {...provided.dragHandleProps} className="mt-0.5 flex-shrink-0">
                                      <GripVertical className="w-3 h-3 text-muted-foreground/40" />
                                    </div>
                                    <div className="flex-1 min-w-0 cursor-pointer hover:opacity-70" onClick={() => openEdit(block)}>
                                      <p className="font-semibold truncate">{block.title || zone?.name}</p>
                                      <p className="text-muted-foreground text-xs">{block.startTime}–{block.endTime}</p>
                                      <p className="text-foreground text-xs mt-0.5">🔊 {block.baseVolume}%</p>
                                      {!block.isActive && <p className="text-orange-400 text-xs">inaktiv</p>}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          );
                        })
                      )}
                      {provided.placeholder}
                    </div>

                    {/* Add Block Button */}
                    <div className="px-2 py-1.5 border-t border-border/50">
                      <button
                        onClick={() => openNewBlock(dayIdx, 8)}
                        className="w-full text-xs py-1 rounded bg-primary/10 hover:bg-primary/20 text-primary transition-colors flex items-center justify-center gap-1"
                      >
                        <Plus className="w-3 h-3" /> Block
                      </button>
                    </div>
                  </div>
                )}
              </Droppable>
            ))}
          </div>
        </DragDropContext>
      )}

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg bg-card border-border">
          <DialogHeader>
            <DialogTitle>{editBlock ? 'Block bearbeiten' : 'Neuen Block erstellen'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-96 overflow-y-auto">
            <div>
              <Label className="text-sm">Zone *</Label>
              <Select value={formData.zoneId} onValueChange={v => update('zoneId', v)}>
                <SelectTrigger className="mt-1.5 bg-muted/50"><SelectValue placeholder="Zone auswählen" /></SelectTrigger>
                <SelectContent>
                  {zones.map(z => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm">Titel (optional)</Label>
              <Input value={formData.title} onChange={e => update('title', e.target.value)} className="mt-1.5 bg-muted/50" placeholder="z.B. Morgentraining" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm">Wochentag</Label>
                <Select value={String(formData.dayOfWeek)} onValueChange={v => update('dayOfWeek', parseInt(v))}>
                  <SelectTrigger className="mt-1.5 bg-muted/50"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DAYS.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm">Playlist (optional)</Label>
                <Select value={formData.playlistId} onValueChange={v => update('playlistId', v)}>
                  <SelectTrigger className="mt-1.5 bg-muted/50"><SelectValue placeholder="Keine" /></SelectTrigger>
                  <SelectContent>
                    {playlists.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm">Start</Label>
                <Input type="time" value={formData.startTime} onChange={e => update('startTime', e.target.value)} className="mt-1.5 bg-muted/50" />
              </div>
              <div>
                <Label className="text-sm">Ende</Label>
                <Input type="time" value={formData.endTime} onChange={e => update('endTime', e.target.value)} className="mt-1.5 bg-muted/50" />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm">Lautstärke: {formData.baseVolume}%</Label>
              </div>
              <Slider value={[formData.baseVolume]} onValueChange={([v]) => update('baseVolume', v)} />
            </div>
            <div className="flex items-center justify-between pt-2">
              <Label className="text-sm">Aktiv</Label>
              <Switch checked={formData.isActive} onCheckedChange={v => update('isActive', v)} />
            </div>
          </div>
          <div className="flex gap-2 pt-4 border-t border-border">
            {editBlock && (
              <Button variant="destructive" size="sm" onClick={() => { deleteMutation.mutate(editBlock.id); setShowForm(false); }}>
                Löschen
              </Button>
            )}
            <Button variant="outline" className="flex-1" onClick={() => setShowForm(false)}>Abbrechen</Button>
            <Button className="flex-1 bg-primary hover:bg-primary/90" onClick={() => saveMutation.mutate(formData)} disabled={saveMutation.isPending || !formData.zoneId}>
              {saveMutation.isPending ? 'Speichern...' : 'Speichern'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}