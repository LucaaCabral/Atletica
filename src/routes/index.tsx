import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import type { PermissionKey } from '@/utils/permissions';
import { AppLayout } from '@/layouts/AppLayout';
import { AuthLayout } from '@/layouts/AuthLayout';
import { FullPageSpinner } from '@/components/ui/State';

import { LoginPage } from '@/pages/auth/LoginPage';
import { RegisterPage } from '@/pages/auth/RegisterPage';
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from '@/pages/auth/ResetPasswordPage';

import { DashboardPage } from '@/pages/DashboardPage';
import { ExecutiveDashboardPage } from '@/pages/ExecutiveDashboardPage';
import { PendingItemsPage } from '@/pages/PendingItemsPage';
import { MembersPage } from '@/pages/members/MembersPage';
import { MemberDetailPage } from '@/pages/members/MemberDetailPage';
import { SectorsPage } from '@/pages/sectors/SectorsPage';
import { SectorDetailPage } from '@/pages/sectors/SectorDetailPage';
import { TasksPage } from '@/pages/tasks/TasksPage';
import { EventsPage } from '@/pages/events/EventsPage';
import { EventDetailPage } from '@/pages/events/EventDetailPage';
import { FinancePage } from '@/pages/finance/FinancePage';
import { SportsPage } from '@/pages/sports/SportsPage';
import { AthleteDetailPage } from '@/pages/sports/AthleteDetailPage';
import { MarketingPage } from '@/pages/marketing/MarketingPage';
import { SponsorsPage } from '@/pages/sponsors/SponsorsPage';
import { ClubPage } from '@/pages/club/ClubPage';
import { DocumentsPage } from '@/pages/documents/DocumentsPage';
import { CalendarPage } from '@/pages/CalendarPage';
import { ReportsPage } from '@/pages/ReportsPage';
import { SettingsPage } from '@/pages/settings/SettingsPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { AccessDeniedPage } from '@/pages/AccessDeniedPage';

function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <FullPageSpinner />;
  if (!session) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RequirePermission({ permission, children }: { permission: PermissionKey; children: ReactNode }) {
  const { can, profile } = useAuth();
  if (!profile) return <FullPageSpinner />;
  if (!can(permission)) return <AccessDeniedPage />;
  return <>{children}</>;
}

function RedirectIfAuthed({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <FullPageSpinner />;
  if (session) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AuthLayout />}>
        <Route
          path="/login"
          element={
            <RedirectIfAuthed>
              <LoginPage />
            </RedirectIfAuthed>
          }
        />
        <Route
          path="/cadastro"
          element={
            <RedirectIfAuthed>
              <RegisterPage />
            </RedirectIfAuthed>
          }
        />
        <Route
          path="/recuperar-senha"
          element={
            <RedirectIfAuthed>
              <ForgotPasswordPage />
            </RedirectIfAuthed>
          }
        />
        <Route path="/redefinir-senha" element={<ResetPasswordPage />} />
      </Route>

      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route
          path="/executivo"
          element={
            <RequirePermission permission="executive.view">
              <ExecutiveDashboardPage />
            </RequirePermission>
          }
        />
        <Route
          path="/pendencias"
          element={
            <RequirePermission permission="pending.view">
              <PendingItemsPage />
            </RequirePermission>
          }
        />
        <Route
          path="/membros"
          element={
            <RequirePermission permission="members.view">
              <MembersPage />
            </RequirePermission>
          }
        />
        <Route
          path="/membros/:id"
          element={
            <RequirePermission permission="members.view">
              <MemberDetailPage />
            </RequirePermission>
          }
        />
        <Route path="/setores" element={<SectorsPage />} />
        <Route path="/setores/:id" element={<SectorDetailPage />} />
        <Route
          path="/tarefas"
          element={
            <RequirePermission permission="tasks.view">
              <TasksPage />
            </RequirePermission>
          }
        />
        <Route
          path="/eventos"
          element={
            <RequirePermission permission="events.view">
              <EventsPage />
            </RequirePermission>
          }
        />
        <Route
          path="/eventos/:id"
          element={
            <RequirePermission permission="events.view">
              <EventDetailPage />
            </RequirePermission>
          }
        />
        <Route
          path="/financeiro"
          element={
            <RequirePermission permission="finance.view">
              <FinancePage />
            </RequirePermission>
          }
        />
        <Route
          path="/esportes"
          element={
            <RequirePermission permission="sports.view">
              <SportsPage />
            </RequirePermission>
          }
        />
        <Route
          path="/esportes/atletas/:id"
          element={
            <RequirePermission permission="sports.view">
              <AthleteDetailPage />
            </RequirePermission>
          }
        />
        <Route
          path="/marketing"
          element={
            <RequirePermission permission="marketing.view">
              <MarketingPage />
            </RequirePermission>
          }
        />
        <Route
          path="/patrocinadores"
          element={
            <RequirePermission permission="sponsors.view">
              <SponsorsPage />
            </RequirePermission>
          }
        />
        <Route
          path="/socios"
          element={
            <RequirePermission permission="club.view">
              <ClubPage />
            </RequirePermission>
          }
        />
        <Route
          path="/documentos"
          element={
            <RequirePermission permission="documents.view">
              <DocumentsPage />
            </RequirePermission>
          }
        />
        <Route
          path="/calendario"
          element={
            <RequirePermission permission="calendar.view">
              <CalendarPage />
            </RequirePermission>
          }
        />
        <Route
          path="/relatorios"
          element={
            <RequirePermission permission="reports.view">
              <ReportsPage />
            </RequirePermission>
          }
        />
        <Route
          path="/configuracoes"
          element={
            <RequirePermission permission="settings.manage">
              <SettingsPage />
            </RequirePermission>
          }
        />
        <Route path="/perfil" element={<ProfilePage />} />
        <Route path="/acesso-negado" element={<AccessDeniedPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
