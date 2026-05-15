import { Copy, Globe, Shield, Smartphone, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

function copy(text) {
  navigator.clipboard.writeText(text);
  toast.success('Kopiert.');
}

function CheckRow({ ok, label, detail, fix }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-border/20 last:border-0">
      {ok ? <CheckCircle2 className="w-5 h-5 text-green-400" /> : <AlertCircle className="w-5 h-5 text-yellow-400" />}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-xs text-muted-foreground break-words">{detail}</p>
        {!ok && fix && <p className="text-xs text-yellow-300 mt-1">Fix: {fix}</p>}
      </div>
    </div>
  );
}

export default function NetworkSettings() {
  const origin = window.location.origin;
  const spotifyRedirectUri = `${origin}/spotify-callback`;
  const playerLoginUrl = `${origin}/player-new`;
  const adminUrl = `${origin}/dashboard`;
  const isHttps = origin.startsWith('https://') || origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1');
  const isLocal = origin.includes('localhost') || origin.includes('127.0.0.1') || origin.includes('192.168.');

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl lg:text-3xl font-black flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center"><Globe className="w-5 h-5 text-blue-400" /></div>Network & Deployment</h1>
        <p className="text-sm text-muted-foreground mt-1 ml-14">Public HTTPS URLs, Spotify Redirect URI and remote Player setup.</p>
      </div>

      <div className="bento-panel p-5 space-y-4">
        <h2 className="text-lg font-black flex items-center gap-2"><Shield className="w-5 h-5 text-primary" /> Current URLs</h2>
        {[
          ['Current Origin', origin],
          ['Admin URL', adminUrl],
          ['Player Login URL', playerLoginUrl],
          ['Spotify Redirect URI', spotifyRedirectUri],
        ].map(([label, value]) => (
          <div key={label} className="grid md:grid-cols-[180px_1fr_auto] gap-2 items-center rounded-lg bg-background/40 border border-border/30 p-3">
            <p className="text-sm font-semibold">{label}</p>
            <code className="text-xs text-muted-foreground break-all">{value}</code>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => copy(value)}><Copy className="w-3.5 h-3.5" /> Copy</Button>
          </div>
        ))}
      </div>

      <div className="bento-panel p-5">
        <h2 className="text-lg font-black mb-3 flex items-center gap-2"><Smartphone className="w-5 h-5 text-primary" /> Remote Readiness</h2>
        <CheckRow ok={isHttps} label="HTTPS active" detail={origin} fix="Use the Base44 public HTTPS domain for iPhone/iPad Spotify OAuth." />
        <CheckRow ok={!isLocal || origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')} label="No LAN URL for production OAuth" detail={isLocal ? 'Local/LAN origin detected.' : 'Public origin detected.'} fix="Open the Base44 public HTTPS URL on the Player device." />
        <CheckRow ok={spotifyRedirectUri.startsWith('https://') || spotifyRedirectUri.startsWith('http://127.0.0.1') || spotifyRedirectUri.startsWith('http://localhost')} label="Spotify Redirect URI allowed" detail={spotifyRedirectUri} fix="Add the exact HTTPS redirect URI to Spotify Developer Dashboard." />
      </div>

      <div className="bento-panel border-blue-500/20 bg-blue-500/5 p-5 text-sm space-y-3">
        <p className="font-bold text-blue-300">Spotify Dashboard Checklist</p>
        <p>1. Öffne Spotify Developer Dashboard.</p>
        <p>2. Trage exakt diese Redirect URI ein:</p>
        <code className="block bg-background/50 rounded-lg p-3 text-xs break-all">{spotifyRedirectUri}</code>
        <p>3. Development Mode: Alle Testnutzer unter User Management hinzufügen.</p>
        <p>4. iPhone/iPad: Player über <code>{playerLoginUrl}</code> öffnen, nicht über localhost oder LAN-IP.</p>
        <p className="text-muted-foreground">Admin und Player im selben Browserprofil können sich gegenseitig ausloggen. Für echte Tests getrennte Geräte oder Browserprofile verwenden.</p>
      </div>
    </div>
  );
}
