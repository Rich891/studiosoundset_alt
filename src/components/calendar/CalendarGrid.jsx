import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Edit2, Trash2, TrendingUp } from 'lucide-react';

// 05:00 – 24:00 = 19 Stunden
const START_HOUR = 5;
const END_HOUR = 24;
const TOTAL_HOURS = END_HOUR - START_HOUR;
const PX_PER_HOUR = 60;
const TOTAL_PX = TOTAL_HOURS * PX_PER_HOUR;

const HOURS = Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => i + START_HOUR);
const DAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const DAYS_FULL = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
const DAY_INDICES = [1, 2, 3, 4, 5, 6, 0];

function snapTo15(minutes) {
  return Math.round(minutes / 15) * 15;
}

function pxToTime(px) {
  const totalMinutes = (px / PX_PER_HOUR) * 60;
  const rawMinutes = Math.max(0, Math.min(TOTAL_HOURS * 60, totalMinutes));
  const snapped = snapTo15(rawMinutes);
  const absoluteMinutes = START_HOUR * 60 + snapped;
  const h = Math.floor(absoluteMinutes / 60);
  const m = absoluteMinutes % 60;
  return { h: Math.min(23, h), m, str: `${String(Math.min(23, h)).padStart(2, '0')}:${String(m).padStart(2, '0')}` };
}

function timeToPx(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return ((h + m / 60) - START_HOUR) * PX_PER_HOUR;
}

function blockHeightPx(startTime, endTime) {
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  return ((eh + em / 60) - (sh + sm / 60)) * PX_PER_HOUR;
}

export default function CalendarGrid({ blocks, playerDevices, onOpenForm, onEdit, onDelete }) {
  const [drag, setDrag] = useState(null); // { dayIdx, startPx, currentPx }
  const [draggingBlock, setDraggingBlock] = useState(null); // { block, offsetPx, dayIdx }
  const columnRefs = useRef({});

  const getRelativeY = useCallback((colEl, clientY) => {
    if (!colEl) return 0;
    const rect = colEl.getBoundingClientRect();
    return Math.max(0, Math.min(TOTAL_PX, clientY - rect.top));
  }, []);

  // ── New block drag ──
  const handleColumnMouseDown = (e, dayIdx) => {
    if (e.button !== 0) return;
    if (e.target.closest('[data-block]')) return;
    e.preventDefault();
    const col = columnRefs.current[dayIdx];
    const y = getRelativeY(col, e.clientY);
    setDrag({ dayIdx, startPx: y, currentPx: y });
  };

  const handleMouseMove = (e) => {
    if (drag) {
      const col = columnRefs.current[drag.dayIdx];
      const y = getRelativeY(col, e.clientY);
      setDrag(prev => ({ ...prev, currentPx: y }));
    }
    if (draggingBlock) {
      const col = columnRefs.current[draggingBlock.dayIdx];
      const y = getRelativeY(col, e.clientY) - draggingBlock.offsetPx;
      const clamped = Math.max(0, Math.min(TOTAL_PX - blockHeightPx(draggingBlock.block.startTime, draggingBlock.block.endTime), y));
      setDraggingBlock(prev => ({ ...prev, currentPx: clamped }));
    }
  };

  const handleMouseUp = () => {
    if (drag) {
      const { dayIdx, startPx, currentPx } = drag;
      let top = Math.min(startPx, currentPx);
      let bot = Math.max(startPx, currentPx);
      if (bot - top < 15) bot = top + 15;
      const start = pxToTime(top);
      const end = pxToTime(bot);
      if (start.str !== end.str) {
        onOpenForm(DAY_INDICES[dayIdx], start.str, end.str);
      }
      setDrag(null);
    }
    if (draggingBlock) {
      const { block, currentPx, dayIdx } = draggingBlock;
      const height = blockHeightPx(block.startTime, block.endTime);
      const startT = pxToTime(currentPx);
      const endMinutes = (startT.h * 60 + startT.m) + height;
      const endH = Math.floor(endMinutes / 60);
      const endM = snapTo15(endMinutes % 60);
      const endStr = `${String(Math.min(23, endH)).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
      onEdit({ ...block, startTime: startT.str, endTime: endStr });
      setDraggingBlock(null);
    }
  };

  const getDragPreview = () => {
    if (!drag) return null;
    const { startPx, currentPx } = drag;
    const top = Math.min(startPx, currentPx);
    const height = Math.max(15, Math.abs(currentPx - startPx));
    const start = pxToTime(top);
    const end = pxToTime(top + height);
    return { top, height, startStr: start.str, endStr: end.str };
  };

  const preview = getDragPreview();

  return (
    <div
      className="select-none"
      style={{ cursor: drag ? 'crosshair' : draggingBlock ? 'grabbing' : 'default' }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Legend */}
      <p className="text-xs text-muted-foreground mb-3 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-primary/60 inline-block" />
        Klicken & Ziehen zum Erstellen · Blöcke verschiebbar · Klick zum Bearbeiten
      </p>

      {/* Scrollable grid */}
      <div className="overflow-x-auto rounded-xl border border-border/30">
        <div style={{ minWidth: '700px' }}>
          {/* Day headers */}
          <div className="grid border-b border-border/30" style={{ gridTemplateColumns: '52px repeat(7, 1fr)' }}>
            <div className="p-2" />
            {DAYS.map((d, i) => (
              <div key={i} className="p-2 text-center">
                <span className="text-xs font-bold text-foreground hidden md:block">{DAYS_FULL[i]}</span>
                <span className="text-xs font-bold text-foreground md:hidden">{d}</span>
              </div>
            ))}
          </div>

          {/* Body */}
          <div className="grid" style={{ gridTemplateColumns: '52px repeat(7, 1fr)' }}>
            {/* Time column */}
            <div className="relative" style={{ height: `${TOTAL_PX}px` }}>
              {HOURS.map((h, idx) => (
                <div
                  key={h}
                  className="absolute right-2 flex items-center"
                  style={{ top: `${idx * PX_PER_HOUR - 8}px`, height: '16px' }}
                >
                  <span className="text-[10px] text-muted-foreground font-mono tabular-nums">
                    {String(h).padStart(2, '0')}:00
                  </span>
                </div>
              ))}
            </div>

            {/* Day columns */}
            {DAY_INDICES.map((dayIdx, colIdx) => {
              const dayBlocks = blocks.filter(b => b.dayOfWeek === dayIdx);
              const isDraggingHere = drag?.dayIdx === colIdx;

              return (
                <div
                  key={colIdx}
                  ref={el => { columnRefs.current[colIdx] = el; }}
                  className="relative border-l border-border/20 cursor-crosshair"
                  style={{ height: `${TOTAL_PX}px` }}
                  onMouseDown={e => handleColumnMouseDown(e, colIdx)}
                >
                  {/* Hour lines */}
                  {HOURS.map((h, idx) => (
                    <div
                      key={h}
                      className="absolute left-0 right-0 border-t border-white/5"
                      style={{ top: `${idx * PX_PER_HOUR}px` }}
                    >
                      {/* 15-min lines */}
                      {[15, 30, 45].map(min => (
                        <div
                          key={min}
                          className="absolute left-0 right-0 border-t border-white/[0.025]"
                          style={{ top: `${(min / 60) * PX_PER_HOUR}px` }}
                        />
                      ))}
                    </div>
                  ))}

                  {/* Hover tint */}
                  {isDraggingHere && (
                    <div className="absolute inset-0 bg-primary/3 pointer-events-none" />
                  )}

                  {/* Blocks */}
                  <AnimatePresence>
                    {dayBlocks.map(block => {
                      const device = playerDevices.find(d => d.id === block.playerDeviceId);
                      const color = '#7C3AED';
                      const topPx = timeToPx(block.startTime);
                      const heightPx = Math.max(28, blockHeightPx(block.startTime, block.endTime));
                      const isBeingDragged = draggingBlock?.block?.id === block.id;
                      const currentTop = isBeingDragged ? (draggingBlock.currentPx ?? topPx) : topPx;

                      return (
                        <motion.div
                          key={block.id}
                          data-block="true"
                          initial={{ opacity: 0, scaleY: 0.8 }}
                          animate={{ opacity: 1, scaleY: 1 }}
                          exit={{ opacity: 0, scaleY: 0.8 }}
                          className="absolute left-1 right-1 rounded-lg group z-10 transition-shadow"
                          style={{
                            top: `${currentTop}px`,
                            height: `${heightPx}px`,
                            background: `${color}22`,
                            borderLeft: `3px solid ${color}`,
                            boxShadow: isBeingDragged ? `0 8px 25px ${color}40` : undefined,
                            cursor: 'grab',
                          }}
                          onMouseDown={e => {
                            if (e.target.closest('button')) return;
                            e.stopPropagation();
                            const col = columnRefs.current[colIdx];
                            const rect = col?.getBoundingClientRect();
                            const clickY = e.clientY - (rect?.top || 0);
                            setDraggingBlock({ block, offsetPx: clickY - topPx, dayIdx: colIdx, currentPx: topPx });
                          }}
                          onClick={e => {
                            if (draggingBlock) return;
                            onEdit(block);
                          }}
                        >
                          <div className="h-full flex flex-col justify-between p-1.5 overflow-hidden">
                            <div className="overflow-hidden">
                              <p className="text-[11px] font-bold truncate leading-tight" style={{ color }}>
                                {block.title || device?.name || 'Block'}
                              </p>
                              {heightPx > 40 && (
                                <p className="text-[10px] text-white/50 leading-tight">
                                  {block.startTime}–{block.endTime}
                                </p>
                              )}
                            </div>
                            {heightPx > 55 && (
                              <div className="flex items-center gap-1">
                                {block.rampEnabled
                                  ? <span className="text-[10px] font-semibold" style={{ color }}>{block.startVolume}%→{block.endVolume}%</span>
                                  : <span className="text-[10px] font-semibold" style={{ color }}>{block.baseVolume}%</span>
                                }
                                {block.rampEnabled && <TrendingUp className="w-2.5 h-2.5" style={{ color }} />}
                              </div>
                            )}
                          </div>

                          {/* Action buttons */}
                          <div className="opacity-0 group-hover:opacity-100 absolute top-1 right-1 flex gap-0.5 bg-black/60 rounded-md p-0.5 transition-opacity pointer-events-auto">
                            <button
                              onClick={e => { e.stopPropagation(); onEdit(block); }}
                              className="p-1 hover:bg-primary/20 rounded text-primary/80 hover:text-primary"
                            >
                              <Edit2 className="w-2.5 h-2.5" />
                            </button>
                            <button
                              onClick={e => { e.stopPropagation(); onDelete(block.id); }}
                              className="p-1 hover:bg-destructive/20 rounded text-destructive/80 hover:text-destructive"
                            >
                              <Trash2 className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>

                  {/* Drag preview */}
                  {isDraggingHere && preview && (
                    <div
                      className="absolute left-1 right-1 rounded-lg border-2 border-dashed border-primary bg-primary/15 pointer-events-none z-20 flex flex-col justify-between p-2"
                      style={{ top: `${preview.top}px`, height: `${preview.height}px` }}
                    >
                      <p className="text-[11px] font-bold text-primary">
                        {preview.startStr} → {preview.endStr}
                      </p>
                      <p className="text-[10px] text-primary/60">Loslassen zum Erstellen</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}