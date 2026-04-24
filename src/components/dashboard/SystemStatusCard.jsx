import { Card, CardContent } from '@/components/ui/card';

const colorMap = {
  purple: 'text-purple-400 bg-purple-400/10',
  blue: 'text-blue-400 bg-blue-400/10',
  green: 'text-green-400 bg-green-400/10',
  orange: 'text-orange-400 bg-orange-400/10',
};

export default function SystemStatusCard({ icon: Icon, label, value, total, color = 'purple', warning }) {
  const colors = colorMap[color] || colorMap.purple;
  const [iconColor, bgColor] = colors.split(' ');

  return (
    <div className="glass-card rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className={`w-9 h-9 rounded-xl ${bgColor} flex items-center justify-center`}>
          <Icon className={`w-4.5 h-4.5 ${iconColor}`} style={{ width: '18px', height: '18px' }} />
        </div>
        {warning > 0 && (
          <span className="text-xs bg-status-yellow status-yellow px-2 py-0.5 rounded-full">
            {warning} Warn.
          </span>
        )}
      </div>
      <div className="text-2xl font-bold text-foreground">
        {value}
        {total !== undefined && (
          <span className="text-sm font-normal text-muted-foreground ml-1">/ {total}</span>
        )}
      </div>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}