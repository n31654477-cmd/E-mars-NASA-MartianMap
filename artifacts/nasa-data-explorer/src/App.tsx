import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { Shell } from '@/components/shell';
import Overview from '@/pages/overview';
import Inventory from '@/pages/inventory';
import { LayersIndex, LayerDetail } from '@/pages/layers';
import { DocumentsIndex, DocumentReader } from '@/pages/documents';
import Exports from '@/pages/exports';
import { Rasters, Metadata, Issues } from '@/pages/misc';

const queryClient = new QueryClient();

function Router() {
  return (
    <Shell>
      <RoutedErrorBoundary>
        <Switch>
          <Route path="/" component={Overview} />
          <Route path="/inventory" component={Inventory} />
          <Route path="/layers" component={LayersIndex} />
          <Route path="/layers/:id" component={LayerDetail} />
          <Route path="/documents" component={DocumentsIndex} />
          <Route path="/documents/:idx" component={DocumentReader} />
          <Route path="/rasters" component={Rasters} />
          <Route path="/metadata" component={Metadata} />
          <Route path="/issues" component={Issues} />
          <Route path="/exports" component={Exports} />
          <Route component={NotFound} />
        </Switch>
      </RoutedErrorBoundary>
    </Shell>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
