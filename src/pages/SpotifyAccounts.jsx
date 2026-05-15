import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import { Music2, Plus, RefreshCw, CheckCircle2, XCircle, AlertCircle, Trash2, Link2, Link2Off, Pencil, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import AccountDeviceList from '@/components/spotify/AccountDeviceList';
import { buildSpotifyAuthorizeUrl, getSpotifyRedirectUri } from '@/lib/spotifyPkceAuth';

const STATUS_CFG = {
  connected: { icon: CheckCircle2, color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20', label: 'Verbunden' },
  disconnected: { icon: Link2Off, color: 'text-muted-foreground', bg: 'bg-muted/20 border-border', label: 'Nicht verbunden' },
  expired: { icon: AlertCircle, color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20', label: 'Token abgelaufen' },
  error: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20', label: 'Fehler' },
};

const EMPTY_FORM = { displayName: '', clientId: '', clientSecret: '' };
const providerStatus = (provider) => provider?.status || provider?.authStatus || 'disconnected';

function sanitizeProviderForm(form, editProvider) {
  const name = form.displayName.trim();
  const clientId = form.clientId.trim();
  const clientSecret = form.clientSecret.trim();
  if (!name) throw new Error('Provider Name fehlt.');
  if (!clientId) throw new Error('Spotify Client ID fehlt.');

  const data = {
    name,
    displayName: name,
    clientId,
    status: editProvider?.status || editProvider?.authStatus || 'disconnected',
    authStatus: editProvider?.authStatus || editProvider?.status || 'disconnected',
    providerType: 'spotify',
    oauthFlow: 'pkce',
    updatedAt: new Date().toISOString(),
  };
  if (clientSecret) data.clientSecret = clientSecret;
  if (!editProvider) data.createdAt = new Date().toISOString();
  return data;
}

function ActionMessage({ message }) {
  if (!message) return null;
  const tone = message.type === 'error' ? 'border-red-500/20 bg-red-500/5 text-red-300' : message.type === 'success' ? 'border-green-500/20 bg-green-500/5 text-green-300' : 'border-blue-500/20 bg-blue-500/5 text-blue-300';
  return (
    <div className={`bento-panel p-4 text-sm border ${tone}`}>
      <p className="font-bold">{message.title}</p>
      {message.body && <p className="mt-1 text-current/80 break-words whitespace-pre-wrap">{message.body}</p>}
      {message.details && <pre className="mt-2 text-xs text-current/70 whitespace-pre-wrap break-words bg-background/40 rounded-lg p-2">{message.details}</pre>}
    </div>
  );
}

export default function SpotifyAccounts() {
  const [showDialog, setShowDialog] = useState(false);
  const [editAccount, setEditAccount] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [expandedId, setExpandedId] = useState(null);
  const [actionMessage, setActionMessage] = useState(null);
  const [connectingId, setConnectingId] = useState(null);
  const queryClient = useQueryClient();
  const redirectUri = getSpotifyRedirectUri();
  const isHttps = redirectUri.startsWith('https://') || redirectUri.startsWith('http://127.0.0.1') || redirectUri.startsWith('http://localhost');

  const { data: providers = [], isLoading, error: loadError } = useQuery({ queryKey: ['providers'], queryFn: () => base44.entities.Provider.list('-created_date') });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Provider.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['providers'] }); closeDialog(); const msg = { type: 'success', title: 'Provider erstellt', body: 'Jetzt kannst du auf “Mit Spotify verbinden” klicken.' }; setActionMessage(msg); toast.success(msg.title); },
    onError: (error) => { const msg = { type: 'error', title: 'Provider konnte nicht erstellt werden', body: error.message }; setActionMessage(msg); toast.error(msg.title); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Provider.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['providers'] }); closeDialog(); const msg = { type: 'success', title: 'Provider aktualisiert', body: 'Credentials wurden gespeichert.' }; setActionMessage(msg); toast.success(msg.title); },
    onError: (error) => { const msg = { type: 'error', title: 'Provider konnte nicht gespeichert werden', body: error.message }; setActionMessage(msg); toast.error(msg.title); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Provider.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['providers'] }); const msg = { type: 'success', title: 'Provider entfernt' }; setActionMessage(msg); toast.success(msg.title); },
    onError: (error) => { const msg = { type: 'error', title: 'Provider konnte nicht gelöscht werden', body: error.message }; setActionMessage(msg); toast.error(msg.title); },
  });

  const openCreate = () => { setEditAccount(null); setForm(EMPTY_FORM); setShowDialog(true); };
  const openEdit = (provider) => {
    setEditAccount(provider);
    setForm({ displayName: provider.name || provider.displayName || '', clientId: provider.clientId || '', clientSecret: '' });
    setShowDialog(true);
  };
  const closeDialog = () => { setShowDialog(false); setEditAccount(null); setForm(EMPTY_FORM); };

  const handleSave = () => {
    try {
      setActionMessage({ type: 'info', title: editAccount ? 'Speichere Provider...' : 'Erstelle Provider...' });
      const payload = sanitizeProviderForm(form, editAccount);
      if (editAccount) updateMutation.mutate({ id: editAccount.id, data: payload });
      else createMutation.mutate(payload);
    } catch (error) {
      const msg = { type: 'error', title: 'Eingaben unvollständig', body: error.message };
      setActionMessage(msg);
      toast.error(msg.body);
    }
  };

  const handleConnect = async (provider) => {
    setConnectingId(provider.id);
    setActionMessage({ type: 'info', title: 'Spotify Connect startet...', body: `Provider: ${provider.name || provider.displayName}\nRedirect URI: ${redirectUri}\nOAuth Flow: PKCE direkt im Browser` });

    if (!provider.clientId) {
      const msg = { type: 'error', title: 'Spotify Client ID fehlt', body: 'Öffne den Provider mit dem Stift, trage die Client ID ein und speichere.' };
      setActionMessage(msg);
      toast.error(msg.title);
      setConnectingId(null);
      openEdit(provider);
      return;
    }

    try {
      await base44.entities.Provider.update(provider.id, { lastError: '', redirectUri, oauthFlow: 'pkce', updatedAt: new Date().toISOString() });
      const url = await buildSpotifyAuthorizeUrl({ provider, redirectUri });
      setActionMessage({ type: 'success', title: 'Spotify Auth URL erstellt', body: 'Du wirst jetzt zu Spotify weitergeleitet.', details: url });
      window.location.assign(url);
    } catch (e) {
      await base44.entities.Provider.update(provider.id, { status: 'error', authStatus: 'error', lastError: e.message }).catch(() => {});
      setActionMessage({ type: 'error', title: 'Spotify Connect Fehler', body: e.message, details: e.stack || '' });
      toast.error('Spotify Connect Fehler: ' + e.message);
      setConnectingId(null);
    }
  };

  const copyRedirect = () => { navigator.clipboard.writeText(redirectUri); setActionMessage({ type: 'success', title: 'Redirect URI kopiert', body: redirectUri }); toast.success('Redirect URI kopiert.'); };
  const isFormValid = form.displayName.trim() && form.clientId.trim();
  const isSaving = createMutation.isPending || updateMutation.isPending;

  if (isLoading) return <div className="p-8 flex items-center justify-center gap-3"><RefreshCw className="w-5 h-5 text-primary animate-spin" /><span className="text-muted-foreground">Lade Provider...</span></div>;

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div><h1 className="text-2xl lg:text-3xl font-black flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center"><Music2 className="w-5 h-5 text-green-400" /></div>Spotify Provider</h1><p className="text-sm text-muted-foreground mt-1 ml-14">Verbinde Spotify Premium Accounts. Jeder Provider kann Player/Zonen steuern.</p></div>
        <Button type="button" className="bg-primary hover:bg-primary/90 h-11 px-6 gap-2 font-semibold" onClick={openCreate}><Plus className="w-4 h-4" /> Provider hinzufügen</Button>
      </div>

      <ActionMessage message={actionMessage} />
      {loadError && <div className="bento-panel border-red-500/20 bg-red-500/5 p-4 text-sm text-red-300">Provider konnten nicht geladen werden: {loadError.message}</div>}

      <div className="bento-panel p-4 flex items-start gap-3 border-blue-500/20 bg-blue-500/5">
        <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm space-y-2 flex-1">
          <p className="font-semibold text-blue-300">Exakte Redirect URI für Spotify</p>
          <p className="text-muted-foreground">Diese URI muss exakt im Spotify Developer Dashboard stehen. Keine LAN-IP, kein localhost für iPhone/iPad. Für diese Base44-Version wird PKCE verwendet, daher reicht die Client ID.</p>
          <div className="flex gap-2 items-center"><code className="block bg-muted/40 rounded-lg px-3 py-2 text-xs text-blue-200 font-mono flex-1 break-all">{redirectUri}</code><Button type="button" variant="outline" size="sm" onClick={copyRedirect} className="gap-2"><Copy className="w-3.5 h-3.5" /> Kopieren</Button></div>
          {!isHttps && <p className="text-xs text-red-300">Spotify OAuth benötigt HTTPS, außer bei localhost/127.0.0.1 Development.</p>}
        </div>
      </div>

      {providers.length === 0 ? (
        <div className="bento-panel border-dashed border-primary/20 p-16 text-center"><Music2 className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" /><h3 className="text-xl font-bold mb-2">Noch keine Provider</h3><p className="text-muted-foreground text-sm mb-6">Lege zuerst einen Spotify Provider an. Danach kannst du OAuth verbinden.</p><Button type="button" className="bg-primary hover:bg-primary/90" onClick={openCreate}><Plus className="w-4 h-4 mr-2" /> Ersten Provider erstellen</Button></div>
      ) : (
        <div className="space-y-3"><AnimatePresence>{providers.map((provider, i) => { const status = providerStatus(provider); const cfg = STATUS_CFG[status] || STATUS_CFG.disconnected; const Icon = cfg.icon; const isExpanded = expandedId === provider.id; return (
          <motion.div key={provider.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <div className={`bento-panel border ${cfg.bg} overflow-hidden`}>
              <div className="p-5 flex items-center gap-4 flex-wrap">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.bg}`}><Icon className={`w-5 h-5 ${cfg.color}`} /></div>
                <div className="flex-1 min-w-0"><p className="font-bold text-lg">{provider.name || provider.displayName}</p><div className="flex items-center gap-3 flex-wrap mt-0.5"><span className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>{provider.spotifyUserEmail && <span className="text-xs text-muted-foreground">{provider.spotifyUserEmail}</span>}{provider.clientId && <span className="text-xs text-muted-foreground font-mono">ID: {provider.clientId.substring(0, 8)}...</span>}{provider.oauthFlow && <span className="text-xs text-muted-foreground">OAuth: {provider.oauthFlow}</span>}</div>{provider.lastError && <p className="text-xs text-red-400 mt-1 break-words">⚠ {provider.lastError}</p>}</div>
                <div className="flex items-center gap-2 flex-wrap"><Button type="button" size="sm" className="gap-1.5 bg-green-600 hover:bg-green-700 text-white font-semibold" onClick={() => handleConnect(provider)} disabled={connectingId === provider.id}>{connectingId === provider.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />} {status === 'connected' ? 'Erneut verbinden' : 'Mit Spotify verbinden'}</Button><Button type="button" variant="ghost" size="sm" className="gap-1" onClick={() => openEdit(provider)}><Pencil className="w-4 h-4" /></Button><Button type="button" variant="ghost" size="sm" className="text-destructive/70 hover:text-destructive" onClick={() => deleteMutation.mutate(provider.id)} disabled={deleteMutation.isPending}><Trash2 className="w-4 h-4" /></Button></div>
              </div>
              <AccountDeviceList account={provider} expanded={isExpanded} onToggle={() => setExpandedId(isExpanded ? null : provider.id)} />
            </div>
          </motion.div>
        ); })}</AnimatePresence></div>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader><DialogTitle>{editAccount ? 'Provider bearbeiten' : 'Spotify Provider hinzufügen'}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div><Label className="text-sm font-semibold mb-2 block">Provider Name *</Label><Input value={form.displayName} onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))} placeholder="z. B. Studio Spotify" className="h-11 bg-muted/30" /></div>
            <div className="border border-border/50 rounded-lg p-4 space-y-3 bg-muted/10">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Spotify Developer App</p>
              <div><Label className="text-sm font-semibold mb-2 block">Client ID *</Label><Input value={form.clientId} onChange={e => setForm(f => ({ ...f, clientId: e.target.value }))} placeholder="Client ID" className="h-11 bg-muted/30 font-mono text-xs" /></div>
              <div><Label className="text-sm font-semibold mb-2 block">Client Secret optional</Label><Input type="password" value={form.clientSecret} onChange={e => setForm(f => ({ ...f, clientSecret: e.target.value }))} placeholder="Optional, PKCE benötigt kein Secret" className="h-11 bg-muted/30 font-mono text-xs" /></div>
              <p className="text-xs text-muted-foreground">Zu finden auf <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noopener noreferrer" className="text-primary underline">developer.spotify.com/dashboard</a></p>
            </div>
            <div className="flex gap-3"><Button type="button" variant="outline" className="flex-1" onClick={closeDialog}>Abbrechen</Button><Button type="button" className="flex-1 bg-primary hover:bg-primary/90 font-bold" disabled={!isFormValid || isSaving} onClick={handleSave}>{isSaving ? 'Speichern...' : editAccount ? 'Speichern' : 'Erstellen'}</Button></div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
