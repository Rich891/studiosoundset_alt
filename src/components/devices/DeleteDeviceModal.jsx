import { useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { AlertTriangle } from 'lucide-react';

export default function DeleteDeviceModal({ device, onClose, onDeleted }) {
  const deleteMutation = useMutation({
    mutationFn: async (mode) => {
      if (mode === 'soft') {
        await base44.entities.Device.update(device.id, { isActive: false, isDeleted: true });
      } else {
        await base44.entities.Device.update(device.id, { isDeleted: true, isActive: false });
      }
      await base44.entities.AuditLog.create({
        action: mode === 'soft' ? 'Gerät deaktiviert' : 'Gerät gelöscht',
        entityType: 'Device',
        entityId: device.id,
        oldValue: device.name,
        status: 'success',
      });
    },
    onSuccess: (_, mode) => {
      toast.success(mode === 'soft' ? 'Gerät wurde deaktiviert.' : 'Gerät wurde gelöscht.');
      onDeleted();
      onClose();
    },
  });

  if (!device) return null;

  return (
    <AlertDialog open={!!device} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            Gerät löschen?
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              "{device.name}" wird aus der App entfernt. Bestehende Logs bleiben erhalten. 
              Kalenderblöcke werden nicht gelöscht, aber die Zone hat danach möglicherweise kein aktives Wiedergabegerät mehr.
            </p>
            {device.isActive && device.status === 'online' && (
              <p className="text-yellow-400 font-medium">
                ⚠️ Dieses Gerät ist aktuell aktiv.
              </p>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
          <Button
            variant="outline"
            onClick={() => deleteMutation.mutate('soft')}
            disabled={deleteMutation.isPending}
          >
            Nur deaktivieren
          </Button>
          <AlertDialogAction
            className="bg-destructive hover:bg-destructive/90"
            onClick={() => deleteMutation.mutate('delete')}
            disabled={deleteMutation.isPending}
          >
            Endgültig löschen
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}