import { Slider } from '@/components/ui/slider';
import { Volume2, VolumeX } from 'lucide-react';

export default function VolumeSlider({ value, onChange, min = 0, max = 100, disabled = false, label }) {
  return (
    <div className="space-y-2">
      {label && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{label}</span>
          <span className="text-lg font-bold text-primary">{value}%</span>
        </div>
      )}
      <div className="flex items-center gap-3">
        <VolumeX className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <Slider
          value={[value]}
          onValueChange={([v]) => onChange(v)}
          min={min}
          max={max}
          step={1}
          disabled={disabled}
          className="flex-1"
        />
        <Volume2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
      </div>
    </div>
  );
}