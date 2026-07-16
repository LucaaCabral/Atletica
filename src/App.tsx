import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { ManagementProvider } from '@/contexts/ManagementContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { ErrorBoundary } from '@/components/feedback/ErrorBoundary';
import { ToastViewport } from '@/components/feedback/ToastViewport';
import { AppRoutes } from '@/routes';

export function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <SettingsProvider>
            <ManagementProvider>
              <ToastProvider>
                <BrowserRouter>
                  <AppRoutes />
                  <ToastViewport />
                </BrowserRouter>
              </ToastProvider>
            </ManagementProvider>
          </SettingsProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
