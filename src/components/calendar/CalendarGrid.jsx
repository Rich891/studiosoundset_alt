import { useState, useRef } from 'react';
import { Edit2, Trash2 } from 'lucide-react';

const HOURS = Array.from({ length: 19 }, (_, i) => i + 5);
const DAYS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
const DAY_INDICES = [1, 2, 3, 4, 5, 6, 0];

export default function CalendarGrid({ blocks, zones, onOpenForm, onEdit, onDelete, selectedZone }) {
  const [dragState, setDragState] = useState(null);
  const gridRefs = useRef({});

  // Filter blocks by zone
  const filteredBlocks = selectedZone 
    ? blocks.filter(b => b.zoneId === selectedZone)
    : blocks;

  // Group blocks by day
  const blocksByDay = DAY_INDICES.map(dayIdx => 
    filteredBlocks.filter(b => b.dayOfWeek === dayIdx)
  );

  const getBlockPosition = (block) => {
    const [startHour, startMin] = block.startTime.split(':').map(Number);
    const [endHour, endMin] = block.endTime.split(':').map(Number);
    
    const startTotal = startHour + startMin / 60;
    const endTotal = endHour + endMin / 60;
    
    const topPercent = ((startTotal - 5) / 19) * 100;
    const heightPercent = ((endTotal - startTotal) / 19) * 100;
    
    return { topPercent, heightPercent };
  };

  // Berechne Zeit von Y-Position
  const timeFromY = (grid, clientY) => {
    if (!grid) return null;
    const rect = grid.getBoundingClientRect();
    const y = clientY - rect.top;
    const percent = Math.max(0, Math.min(1, y / rect.height));
    const hourValue = percent * 19 + 5;
    const hour = Math.floor(hourValue);
    const minute = Math.round((hourValue - hour) * 60 / 15) * 15; // Runde auf 15-Min
    return { hour: Math.min(23, hour), minute };
  };

  const handleMouseDown = (e, dayIdx) => {
    if (e.target.closest('button')) return;
    
    const grid = gridRefs.current[dayIdx];
    if (!grid) return;

    const startTime = timeFromY(grid, e.clientY);
    if (!startTime) return;

    setDragState({
      dayIdx,
      startTime,
      currentTime: startTime,
      isDragging: true,
    });
  };

  const handleMouseMove = (e) => {
    if (!dragState?.isDragging) return;

    const grid = gridRefs.current[dragState.dayIdx];
    if (!grid) return;

    const currentTime = timeFromY(grid, e.clientY);
    if (!currentTime) return;

    setDragState(prev => ({
      ...prev,
      currentTime,
    }));
  };

  const handleMouseUp = (e) => {
    if (!dragState?.isDragging) return;

    const { dayIdx, startTime, currentTime } = dragState;

    let start = startTime;
    let end = currentTime;

    // Sortiere so dass start < end
    if (start.hour > end.hour || (start.hour === end.hour && start.minute >= end.minute)) {
      [start, end] = [end, start];
    }

    // Stelle sicher dass mindestens 15 Min Differenz
    if (start.hour === end.hour && start.minute === end.minute) {
      end = { ...end, minute: (end.minute + 15) % 60 };
      if (end.minute < start.minute) {
        end.hour += 1;
      }
    }

    const startStr = `${String(start.hour).padStart(2, '0')}:${String(start.minute).padStart(2, '0')}`;
    const endStr = `${String(end.hour).padStart(2, '0')}:${String(end.minute).padStart(2, '0')}`;

    onOpenForm(DAY_INDICES[dayIdx], startStr, endStr);

    setDragState(null);
  };

  const getDragPreviewStyle = () => {
    if (!dragState?.isDragging) return null;

    const { startTime, currentTime } = dragState;
    let start = startTime;
    let end = currentTime;

    if (start.hour > end.hour || (start.hour === end.hour && start.minute >= end.minute)) {
      [start, end] = [end, start];
    }

    const startTotal = start.hour + start.minute / 60;
    const endTotal = end.hour + end.minute / 60;

    const topPercent = ((startTotal - 5) / 19) * 100;
    const heightPercent = ((endTotal - startTotal) / 19) * 100;

    return {
      top: `${topPercent}%`,
      height: `${heightPercent}%`,
    };
  };

  return (
    <div className="space-y-4" onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
      {/* Legend */}
      <div className="flex items-center gap-2 flex-wrap text-xs">
        <span className="text-muted-foreground">Ziehe über einen Zeitbereich um einen Block zu erstellen</span>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-8 gap-1 bg-muted/20 p-4 rounded-lg border border-border/20">
        {/* Time Column */}
        <div className="col-span-1">
          <div className="text-xs font-semibold text-muted-foreground mb-2">Uhrzeit</div>
          <div className="space-y-0">
            {HOURS.map((hour) => (
              <div key={hour} className="h-20 flex items-center justify-end pr-2">
                <span className="text-xs text-muted-foreground">{String(hour).padStart(2, '0')}:00</span>
              </div>
            ))}
          </div>
        </div>

        {/* Day Columns */}
        {DAYS.map((day, dayIdx) => (
          <div key={dayIdx} className="col-span-1">
            <div className="text-xs font-semibold text-foreground mb-2 text-center">{day}</div>
            <div 
              ref={(el) => { gridRefs.current[dayIdx] = el; }}
              className="relative border border-border/30 rounded bg-card/50 h-[570px] cursor-cell select-none"
              onMouseDown={(e) => handleMouseDown(e, dayIdx)}
            >
              {/* Hour grid */}
              {HOURS.map((hour) => (
                <div key={hour} className="h-20 border-b border-border/20 hover:bg-primary/5 transition-colors pointer-events-none">
                  {/* 15-min subdivisions */}
                  {[0, 15, 30, 45].map((min) => (
                    <div key={min} className="h-5 border-b border-border/10 text-xs px-1" />
                  ))}
                </div>
              ))}

              {/* Blocks */}
              {blocksByDay[dayIdx].map((block) => {
                const zone = zones.find(z => z.id === block.zoneId);
                const { topPercent, heightPercent } = getBlockPosition(block);
                const isRamped = block.volumeRampEnabled;

                return (
                  <div
                    key={block.id}
                    className="absolute left-1 right-1 rounded-lg p-2 text-xs group transition-all hover:shadow-lg hover:z-40 pointer-events-auto"
                    style={{
                      top: `${topPercent}%`,
                      height: `${heightPercent}%`,
                      background: `${zone?.color || '#6366f1'}30`,
                      borderLeft: `3px solid ${zone?.color || '#6366f1'}`,
                    }}
                  >
                    <div className="h-full flex flex-col justify-between">
                      <div className="flex-1 overflow-hidden">
                        <p className="font-semibold truncate text-foreground">{block.title || zone?.name || 'Block'}</p>
                        <p className="text-xs text-muted-foreground truncate">{block.startTime} – {block.endTime}</p>
                        {block.playlistId && <p className="text-xs text-primary mt-0.5">♪ Playlist</p>}
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium">
                          {isRamped ? `${block.startVolume}% → ${block.endVolume}%` : `${block.baseVolume}%`}
                        </span>
                      </div>
                    </div>

                    {/* Hover Actions */}
                    <div className="opacity-0 group-hover:opacity-100 absolute top-1 right-1 transition-opacity flex gap-1 bg-black/50 rounded p-1 pointer-events-auto">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit(block);
                        }}
                        className="p-1 hover:bg-primary/20 rounded text-primary"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(block.id);
                        }}
                        className="p-1 hover:bg-destructive/20 rounded text-destructive"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Drag Preview */}
              {dragState?.isDragging && getDragPreviewStyle() && (
                <div
                  className="absolute left-1 right-1 rounded-lg border-2 border-primary bg-primary/20 pointer-events-none z-50 transition-all"
                  style={getDragPreviewStyle()}
                >
                  <div className="p-2 text-xs font-semibold text-primary">
                    {dragState.startTime.hour}:{String(dragState.startTime.minute).padStart(2, '0')} → {dragState.currentTime.hour}:{String(dragState.currentTime.minute).padStart(2, '0')}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}