import { cn } from '@/lib/utils';

const statusMap = {
  connected: { label: 'Verbunden', color: 'bg-status-green status-green' },
  disconnected: { label: 'Getrennt', color: 'bg-status-gray status-gray' },
  error: { label: 'Fehler', color: 'bg-status-red status-red' },
  expired: { label: 'Abgelaufen', color: 'bg-status-yellow status-yellow' },
  pending: { label: 'Ausstehend', color: 'bg-status-blue status-blue' },
  online: { label: 'Online', color: 'bg-status-green status-green' },
  offline: { label: 'Offline', color: 'bg-status-red status-red' },
  warning: { label: 'Warnung', color: 'bg-status-yellow status-yellow' },
  unknown: { label: 'Unbekannt', color: 'bg-status-gray status-gray' },
  active: { label: 'Aktiv', color: 'bg-status-green status-green' },
  inactive: { label: 'Inaktiv', color: 'bg-status-gray status-gray' },
  demo: { label: 'Demo', color: 'bg-status-yellow status-yellow' },
  licensed: { label: 'Lizenziert', color: 'bg-status-green status-green' },
  unlicensed: { label: 'Nicht lizenziert', color: 'bg-status-red status-red' },
  success: { label: 'Erfolgreich', color: 'bg-status-green status-green' },
};

export default function StatusBadge({ status, label, className }) {
  const config = statusMap[status] || statusMap.unknown;
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium',
      config.color,
      className
    )}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
      {label || config.label}
    </span>
  );
}