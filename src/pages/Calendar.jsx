import { CalendarDays, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function Calendar() {
  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl lg:text-3xl font-black flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center"><CalendarDays className="w-5 h-5 text-primary" /></div>
          Calendar / Scheduler
        </h1>
        <p className="text-sm text-muted-foreground mt-1 ml-14">Week calendar, schedule blocks and volume ramps.</p>
      </div>

      <div className="bento-panel border-yellow-500/20 bg-yellow-500/5 p-6 flex items-start gap-4">
        <AlertCircle className="w-6 h-6 text-yellow-400 flex-shrink-0 mt-0.5" />
        <div className="space-y-3">
          <h2 className="text-lg font-black text-yellow-300">Scheduler ist noch nicht aktiv</h2>
          <p className="text-sm text-muted-foreground">Diese Base44-Version erstellt aktuell keine automatischen Playback- oder Volume-Commands nach Zeitplan. Deshalb gibt es hier bewusst keine Speicher-Buttons, die einen falschen Erfolg vortäuschen würden.</p>
          <p className="text-sm text-muted-foreground">Der nächste echte Schritt ist ein Scheduler-Worker, der ScheduleBlocks liest, PlayerCommands erstellt und deren Bestätigung überwacht.</p>
        </div>
      </div>

      <div className="bento-panel p-5 space-y-4">
        <h2 className="text-lg font-black">Geplante Architektur</h2>
        <div className="space-y-3 text-sm">
          <div className="flex items-start gap-3"><CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" /><p>Admin legt ScheduleBlock für Player, Playlist, Startzeit, Endzeit und Volume fest.</p></div>
          <div className="flex items-start gap-3"><Clock className="w-5 h-5 text-primary flex-shrink-0" /><p>Scheduler erzeugt zur richtigen Zeit `PLAY_PLAYLIST`, `SET_VOLUME`, `PAUSE` oder Rampen-Commands.</p></div>
          <div className="flex items-start gap-3"><CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" /><p>Player bestätigt jeden Command wie im Live-Command-System. Keine Success States ohne Player-Ack.</p></div>
        </div>
        <div className="flex gap-3 flex-wrap pt-2"><Link to="/now-playing"><Button>Now Playing testen</Button></Link><Link to="/commands"><Button variant="outline">Commands ansehen</Button></Link></div>
      </div>
    </div>
  );
}
