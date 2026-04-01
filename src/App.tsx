import { useEffect } from "react";

import { Toaster } from "@/components/ui/sonner";
import { useAuth } from "@/contexts/AuthContext";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Router, Route, Switch, useLocation } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import ErrorBoundary from "@/components/ErrorBoundary";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ProjectProvider } from "@/contexts/ProjectContext";
import Dashboard from "@/pages/Dashboard";
import GuestsPage from "@/pages/Guests";
import SeatingPage from "@/pages/Seating";
import CheckInPage from "@/pages/CheckIn";
import PrintPage from "@/pages/Print";
import LotteryPage from "@/pages/Lottery";
import SettingsPage from "@/pages/Settings";
import QrPage from "@/pages/Qr";
import KioskPage from "@/pages/Kiosk";
import KioskLockPage, { isKioskLocked } from "@/pages/KioskLock";
import PlatformPage from "@/pages/Platform";
import PlatformVenuesPage from "@/pages/PlatformVenues";
import PlatformAdminPage from "@/pages/PlatformAdmin";
import PlatformLoginPage from "@/pages/PlatformLogin";
import PortalPage from "@/pages/Portal";
import PlatformVenueBilling from "@/pages/PlatformVenueBilling";
import PlatformVenueWalletPage from "@/pages/PlatformVenueWallet";
import VenueWalletPage from "@/pages/VenueWallet";
import HostAuthorizationPage from "@/pages/HostAuthorization";
import AuditLogPage from "@/pages/AuditLog";
import LoginPage from "@/pages/Login";
import ClientPage from "@/pages/Client";
import HostPage from "@/pages/Host";
import HostInvitePage from "@/pages/HostInvite";
import AppShell from "@/components/AppShell";

// Use hash-based routing (/#/) to support opening index.html directly via file:// protocol
// Tolerant routing: unmatched paths are treated as anchor sections (e.g., /#/services → scroll to #services)
// For in-page anchors, use <Link href="/section"> instead of <a href="#section">
function AuthAndLockGuard({ children }: { children: React.ReactNode }) {
  const { ready, profile } = useAuth();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (!ready) return;

    const role = profile?.role || null;
    const hasVenue = !!profile?.venue_id;

    const isPublicRoute = location === "/portal" || location.startsWith("/login") || location === "/platform-login";

    const isHostInviteRoute = location.startsWith("/host-invite");
    const isHostRoute = location === "/host" || location.startsWith("/host/");

    if (isHostInviteRoute) return;

    // Platform guard
    const isPlatformRoute = location.startsWith("/platform-") && location !== "/platform-login";
    if (isPlatformRoute) {
      if (role !== "platform") {
        setLocation("/platform-login");
      }
      return;
    }

    // Host guard
    if (isHostRoute) {
      if (role !== "host_admin" && role !== "host_staff") {
        setLocation("/portal");
      }
      return;
    }

    // Venue guard (app pages)
    if (!isPublicRoute) {
      if (role !== "venue_owner" || !hasVenue) {
        setLocation("/portal");
        return;
      }
    }

    // Kiosk lock guard
    if (isKioskLocked() && location !== "/kiosk-lock") {
      setLocation("/kiosk-lock");
    }
  }, [location, setLocation]);

  return children;
}

function AppRouter() {
  return (
    <Router hook={useHashLocation}>
      <AuthAndLockGuard>
        <Switch>
        <Route path="/">
          <AppShell>
            <Dashboard />
          </AppShell>
        </Route>
        <Route path="/guests">
          <AppShell>
            <GuestsPage />
          </AppShell>
        </Route>
        <Route path="/seating">
          <AppShell>
            <SeatingPage />
          </AppShell>
        </Route>
        <Route path="/wallet">
          <AppShell>
            <VenueWalletPage />
          </AppShell>
        </Route>
        <Route path="/host-auth">
          <AppShell>
            <HostAuthorizationPage />
          </AppShell>
        </Route>
        <Route path="/audit">
          <AppShell>
            <AuditLogPage />
          </AppShell>
        </Route>
        <Route path="/checkin">
          <AppShell>
            <CheckInPage />
          </AppShell>
        </Route>
        <Route path="/kiosk">
          <AppShell>
            <KioskPage />
          </AppShell>
        </Route>
        <Route path="/kiosk-lock">
          <KioskLockPage />
        </Route>
        <Route path="/print">
          <AppShell>
            <PrintPage />
          </AppShell>
        </Route>
        <Route path="/lottery">
          <AppShell>
            <LotteryPage />
          </AppShell>
        </Route>
        <Route path="/settings">
          <AppShell>
            <SettingsPage />
          </AppShell>
        </Route>
        <Route path="/qr">
          <AppShell>
            <QrPage />
          </AppShell>
        </Route>
        <Route path="/platform">
          <AppShell>
            <PlatformPage />
          </AppShell>
        </Route>
        <Route path="/portal">
          <PortalPage />
        </Route>
        <Route path="/host-invite/:token">
          <HostInvitePage />
        </Route>
        <Route path="/host">
          <HostPage />
        </Route>
        <Route path="/platform-login">
          <PlatformLoginPage />
        </Route>
        <Route path="/platform-venues">
          <div className="min-h-screen w-full paper-noise">
            <div className="mx-auto max-w-6xl p-6 md:p-10">
              <div className="rounded-2xl bg-card text-card-foreground ledger-border">
                <div className="p-6 md:p-10">
                  <PlatformVenuesPage />
                </div>
              </div>
            </div>
          </div>
        </Route>
        <Route path="/platform-wallet/:venueId">
          <div className="min-h-screen w-full paper-noise">
            <div className="mx-auto max-w-6xl p-6 md:p-10">
              <div className="rounded-2xl bg-card text-card-foreground ledger-border">
                <div className="p-6 md:p-10">
                  <PlatformVenueWalletPage />
                </div>
              </div>
            </div>
          </div>
        </Route>

        <Route path="/platform-billing/:venueId">
          <div className="min-h-screen w-full paper-noise">
            <div className="mx-auto max-w-6xl p-6 md:p-10">
              <div className="rounded-2xl bg-card text-card-foreground ledger-border">
                <div className="p-6 md:p-10">
                  <PlatformVenueBilling />
                </div>
              </div>
            </div>
          </div>
        </Route>

        <Route path="/platform-admin">
          <div className="min-h-screen w-full paper-noise">
            <div className="mx-auto max-w-6xl p-6 md:p-10">
              <div className="rounded-2xl bg-card text-card-foreground ledger-border">
                <div className="p-6 md:p-10">
                  <PlatformAdminPage />
                </div>
              </div>
            </div>
          </div>
        </Route>
        <Route path="/login">
          <LoginPage />
        </Route>
        <Route path="/login/:phone">
          <LoginPage />
        </Route>
        <Route path="/login/:phone/:seed">
          <LoginPage />
        </Route>
        <Route path="/client">
          <div className="min-h-screen w-full paper-noise">
            <div className="mx-auto max-w-6xl p-6 md:p-10">
              <div className="rounded-2xl bg-card text-card-foreground ledger-border">
                <div className="p-6 md:p-10">
                  <ClientPage />
                </div>
              </div>
            </div>
          </div>
        </Route>
        <Route>
          <AppShell>
            <Dashboard />
          </AppShell>
        </Route>
        </Switch>
      </AuthAndLockGuard>
    </Router>
  );
}

// Note on theming:
// - Choose defaultTheme based on your design (light or dark background)
// - Update the color palette in index.css to match
// - If you want switchable themes, add `switchable` prop and use `useTheme` hook

function App() {
  const { profile } = useAuth();

  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <ProjectProvider venueId={profile?.venue_id}>
          <TooltipProvider>
            <Toaster />
            <AppRouter />
          </TooltipProvider>
        </ProjectProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;

