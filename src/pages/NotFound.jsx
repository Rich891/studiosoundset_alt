import { useNavigate, Link } from 'react-router-dom';
import { Home, LogIn, LayoutDashboard, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 aurora-bg">
      <div className="max-w-md w-full text-center space-y-6">
        {/* Icon */}
        <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-10 h-10 text-primary" />
        </div>

        {/* Heading */}
        <div>
          <h1 className="text-5xl font-bold text-foreground mb-2">404</h1>
          <h2 className="text-xl font-semibold text-foreground">Seite nicht gefunden</h2>
          <p className="text-muted-foreground mt-2 text-sm">
            Diese Seite existiert nicht oder wurde verschoben.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/dashboard">
            <Button className="w-full sm:w-auto bg-primary hover:bg-primary/90">
              <LayoutDashboard className="w-4 h-4 mr-2" />
              Zum Dashboard
            </Button>
          </Link>
          <Link to="/">
            <Button variant="outline" className="w-full sm:w-auto">
              <Home className="w-4 h-4 mr-2" />
              Startseite
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}