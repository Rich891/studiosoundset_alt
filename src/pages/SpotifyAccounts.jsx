import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Music2, Plus, RefreshCw, CheckCircle2, XCircle, AlertCircle,
  Trash2, Link2, Link2Off, ChevronDown, ChevronUp, Pencil
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import AccountDeviceList from '@/components/spotify/AccountDeviceList';

const invoke = (fn, payload) => base44.functions.invoke(fn, payload);

const STATUS_CFG = {
  connected:    { icon: CheckCircle2, color: 'text-green-400',  bg: 'bg-green-500/10 border-green-500/20',  label: 'Verbunden' },
  disconnected: { icon: Link2Off,     color: 'text-muted-foreground', bg: 'bg-muted/20 border-border',        label: 'Nicht verbunden' },
  expired:      { icon: AlertCircle,  color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20', label: 'Token abgelaufen' },
  error:        { icon: XCircle,      color: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/20',       label: 'Fehler' },
};

const EMPTY_FORM = { displayName: '', clientId: '', clientSecret: '', zoneId: '' };

export default function SpotifyAccounts() {
  const [showDialog, setShowDialog] = useState(false);
  const [editAccount, setEditAccount] = useState(null); // null = create mode
  const [form, setForm] = useState(EMPTY_FORM);
  const [expandedId, setExpandedId] = useState(null);
  const queryClient = useQueryClient();

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ['spotifyAccounts'],
    queryFn: () => base44.entities.SpotifyAccount.list('-created_date'),
  });
  const { data: zones = [] } = useQuery({
    queryKey: ['zones'],
    queryFn: () => base44.entities.Zone.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.SpotifyAccount.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spotifyAccounts'] });
      closeDialog();
      toast.success('Account erstellt.');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.SpotifyAccount.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spotifyAccounts'] });
      closeDialog();
      toast.success('Account aktualisiert.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.SpotifyAccount.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['spotifyAccounts'] }); toast.success('Account entfernt.'); },
  });

  const openCreate = () => {
    setEditAccount(null);
    setForm(EMPTY_FORM);
    setShowDialog(true);
  };

  const openEdit = (acc) => {
    setEditAccount(acc);
    setForm({
      displayName: acc.displayName || '',
      clientId: acc.clientId || '',
      clientSecret: '', // never pre-fill secret
      zoneId: acc.zoneId || '',
    });
    setShowDialog(true);
  };

  const closeDialog = () => {
    setShowDialog(false);
    setEditAccount(null);
    setForm(EMPTY_FORM);
  };

  const handleSave = () => {
    const payload = {
      displayName: form.displayName.trim(),
      clientId: form.clientId.trim(),
      zoneId: form.zoneId || undefined,
    };
    // Only include clientSecret if user typed something
    if (form.clientSecret.trim()) payload.clientSecret = form.clientSecret.trim();

    if (editAccount) {
      updateMutation.mutate({ id: editAccount.id, data: payload });
    } else {
      createMutation.mutate({ ...payload, authStatus: 'disconnected', tokenStatus: 'missing' });
    }
  };

  const handleConnect = async (account) => {
    const redirectUri = 'https://fit-sound-flow.base44.app/spotify-callback';
    try {
      const res = await invoke('spotifyAccountControl', { action: 'getAuthUrl', accountId: account.id, redirectUri });
      if (res.data?.url) {
        window.location.href = res.data.url;
      } else {
        toast.error(res.data?.error || 'Auth URL konnte nicht geladen werden.');
      }
    } catch (e) {
      toast.error('Fehler: ' + e.message);
    }
  };

  const handleRefreshDevices = async (account) => {
    try {
      const res = await invoke('spotifyAccountControl', { action: 'getDevices', accountId: account.id });
      if (res.data?.success) {
        toast.success(`${res.data.devices?.length || 0} Geräte geladen.`);
        queryClient.invalidateQueries({ queryKey: ['spotifyDevices', account.id] });
      } else {
        toast.error(res.data?.error || 'Geräte konnten nicht geladen werden.');
      }
    } catch (e) {
      toast.error(e.message);
    }
  };

  const isFormValid = form.displayName.trim() && form.clientId.trim() && (editAccount || form.clientSecret.trim());
  const isSaving = createMutation.isPending || updateMutation.isPending;

  if (isLoading) return (
    <div className="p-8 flex items-center justify-center gap-3">
      <RefreshCw className="w-5 h-5 text-primary animate-spin" />
      <span className="text-muted-foreground">Lade Accounts...</span>
    </div>
  );

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-black flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
              <Music2 className="w-5 h-5 text-green-400" />
            </div>
            Spotify Accounts
          </h1>
          <p className="text-sm text-muted-foreground mt-1 ml-14">
            Jede Zone verbindet sich mit einem eigenen Spotify Premium Account.
          </p>
        </div>
        <Button className="bg-primary hover:bg-primary/90 h-11 px-6 gap-2 font-semibold" onClick={openCreate}>
          <Plus className="w-4 h-4" /> Account hinzufügen
        </Button>
      </div>

      {/* Redirect URI Info */}
      <div className="bento-panel p-4 flex items-start gap-3 border-blue-500/20 bg-blue-500/5">
        <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm space-y-1">
          <p className="font-semibold text-blue-300">Redirect URI im Spotify Developer Dashboard eintragen</p>
          <p className="text-muted-foreground">Gehe zu <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline">developer.spotify.com/dashboard</a>, öffne deine App und trage diese URI ein:</p>
          <code className="block bg-muted/40 rounded-lg px-3 py-2 text-xs text-blue-200 font-mono mt-1">
            https://fit-sound-flow.base44.app/spotify-callback
          </code>
        </div>
      </div>

      {accounts.length === 0 ? (
        <div className="bento-panel border-dashed border-primary/20 p-16 text-center">
          <Music2 className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" />
          <h3 className="text-xl font-bold mb-2">Noch keine Accounts</h3>
          <p className="text-muted-foreground text-sm mb-6">Erstelle einen Eintrag pro Zone (Tennishalle, Gym, Test).</p>
          <Button className="bg-primary hover:bg-primary/90" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" /> Ersten Account erstellen
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {accounts.map((acc, i) => {
              const cfg = STATUS_CFG[acc.authStatus] || STATUS_CFG.disconnected;
              const Icon = cfg.icon;
              const zone = zones.find(z => z.id === acc.zoneId);
              const isExpanded = expandedId === acc.id;

              return (
                <motion.div key={acc.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                  <div className={`bento-panel border ${cfg.bg} overflow-hidden`}>
                    <div className="p-5 flex items-center gap-4 flex-wrap">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.bg}`}>
                        <Icon className={`w-5 h-5 ${cfg.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-lg">{acc.displayName}</p>
                        <div className="flex items-center gap-3 flex-wrap mt-0.5">
                          <span className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>
                          {acc.tokenStatus === 'valid' && <span className="text-xs text-green-400">● Token gültig</span>}
                          {acc.tokenStatus === 'expired' && <span className="text-xs text-yellow-400">⚠ Token abgelaufen</span>}
                          {zone && <span className="text-xs text-muted-foreground px-2 py-0.5 bg-muted/30 rounded-full">Zone: {zone.name}</span>}
                          {acc.spotifyUserEmail && <span className="text-xs text-muted-foreground">{acc.spotifyUserEmail}</span>}
                          {acc.clientId && <span className="text-xs text-muted-foreground font-mono">ID: {acc.clientId.substring(0, 8)}...</span>}
                        </div>
                        {acc.lastError && <p className="text-xs text-red-400 mt-1">⚠ {acc.lastError}</p>}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {acc.authStatus === 'connected' ? (
                          <>
                            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => handleRefreshDevices(acc)}>
                              <RefreshCw className="w-3.5 h-3.5" /> Geräte laden
                            </Button>
                            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => handleConnect(acc)}>
                              <Link2 className="w-3.5 h-3.5" /> Erneut verbinden
                            </Button>
                          </>
                        ) : (
                          <Button className="bg-green-600 hover:bg-green-700 gap-1.5 h-9 px-4 font-semibold" size="sm" onClick={() => handleConnect(acc)}>
                            <Link2 className="w-3.5 h-3.5" /> Mit Spotify verbinden
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" className="gap-1" onClick={() => openEdit(acc)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="gap-1" onClick={() => setExpandedId(isExpanded ? null : acc.id)}>
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          Geräte
                        </Button>
                        <Button variant="ghost" size="sm" className="text-destructive/70 hover:text-destructive" onClick={() => deleteMutation.mutate(acc.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    {isExpanded && <AccountDeviceList account={acc} zones={zones} />}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={closeDialog}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle>{editAccount ? 'Account bearbeiten' : 'Spotify Account hinzufügen'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label className="text-sm font-semibold mb-2 block">Name des Accounts *</Label>
              <Input
                value={form.displayName}
                onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))}
                placeholder="z. B. Tennishalle Account"
                className="h-11 bg-muted/30"
              />
            </div>
            <div className="border border-border/50 rounded-lg p-4 space-y-3 bg-muted/10">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Spotify Developer App Credentials</p>
              <div>
                <Label className="text-sm font-semibold mb-2 block">Client ID *</Label>
                <Input
                  value={form.clientId}
                  onChange={e => setForm(f => ({ ...f, clientId: e.target.value }))}
                  placeholder="z. B. aefead8812d34ebfb862bf497c13326c"
                  className="h-11 bg-muted/30 font-mono text-xs"
                />
              </div>
              <div>
                <Label className="text-sm font-semibold mb-2 block">
                  Client Secret {editAccount ? '(leer lassen = unverändert)' : '*'}
                </Label>
                <Input
                  type="password"
                  value={form.clientSecret}
                  onChange={e => setForm(f => ({ ...f, clientSecret: e.target.value }))}
                  placeholder={editAccount ? '••••••••••••••••••••••••' : 'Dein Spotify Client Secret'}
                  className="h-11 bg-muted/30 font-mono text-xs"
                />
              </div>
              <p className="text-xs text-muted-foreground">Zu finden auf <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noopener noreferrer" className="text-primary underline">developer.spotify.com/dashboard</a></p>
            </div>
            <div>
              <Label className="text-sm font-semibold mb-2 block">Zone zuweisen</Label>
              <Select value={form.zoneId} onValueChange={v => setForm(f => ({ ...f, zoneId: v }))}>
                <SelectTrigger className="h-11 bg-muted/30"><SelectValue placeholder="Zone wählen (optional)" /></SelectTrigger>
                <SelectContent>
                  {zones.map(z => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={closeDialog}>Abbrechen</Button>
              <Button
                className="flex-1 bg-primary hover:bg-primary/90 font-bold"
                disabled={!isFormValid || isSaving}
                onClick={handleSave}
              >
                {isSaving ? 'Speichern...' : editAccount ? 'Speichern' : 'Erstellen'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}