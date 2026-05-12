import { TrendingUp } from 'lucide-react';

function generateSteps(startTime, endTime, startVol, endVol, rampMode) {
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  const startMins = sh * 60 + sm;
  const endMins = eh * 60 + em;
  const totalMins = endMins - startMins;
  if (totalMins <= 0) return [];

  let intervalMins;
  if (rampMode === 'hourly') intervalMins = 60;
  else if (rampMode === 'every_30_min') intervalMins = 30;
  else if (rampMode === 'every_15_min') intervalMins = 15;
  else intervalMins = totalMins; // continuous: just start & end

  const steps = [];
  for (let m = 0; m <= totalMins; m += intervalMins) {
    const progress = totalMins > 0 ? m / totalMins : 0;
    const vol = Math.round(startVol + progress * (endVol - startVol));
    const absMin = startMins + m;
    const h = Math.floor(absMin / 60);
    const min = absMin % 60;
    steps.push({ time: `${String(h).padStart(2,'0')}:${String(min).padStart(2,'0')}`, vol });
  }
  // Ensure end is included
  if (steps.length === 0 || steps[steps.length - 1].time !== endTime) {
    steps.push({ time: endTime, vol: endVol });
  }
  return steps;
}

export default function RampPreview({ startTime, endTime, startVolume, endVolume, rampMode }) {
  const steps = generateSteps(startTime, endTime, startVolume, endVolume, rampMode);
  if (steps.length === 0) return null;

  return (
    <div className="p-3 bg-muted/20 rounded-xl border border-border/30 space-y-3">
      <div className="flex items-center gap-2">
        <TrendingUp className="w-3.5 h-3.5 text-primary" />
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Rampen-Vorschau</span>
      </div>

      {/* Gradient bar */}
      <div className="relative h-3 rounded-full overflow-hidden">
        <div
          className="absolute inset-0 rounded-full"
          style={{ background: 'linear-gradient(to right, hsl(187 96% 47%), hsl(252 87% 67%))' }}
        />
      </div>

      {/* Steps */}
      <div className="space-y-1 max-h-36 overflow-y-auto">
        {steps.map((step, i) => (
          <div key={i} className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground font-mono">{step.time}</span>
            <div className="flex-1 mx-3 h-px bg-border/30" />
            <span className="font-bold text-foreground">{step.vol}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}