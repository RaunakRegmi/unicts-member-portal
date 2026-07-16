import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../lib/queryClient';
import { refreshSession } from '../lib/apiClient';
import { useAuthStore } from '../store/authStore';
import ProtectedRoute from './ProtectedRoute';
import PublicLayout from '../components/layouts/PublicLayout';
import MemberLayout from '../components/layouts/MemberLayout';
import AdminLayout from '../components/layouts/AdminLayout';
import { FullPageSpinner } from '../components/ui';

import LandingPage from '../features/landing/LandingPage';
import ApplyPage from '../features/landing/ApplyPage';
import SignupPage from '../features/auth/SignupPage';
import VerifyOtpPage from '../features/auth/VerifyOtpPage';
import LoginPage from '../features/auth/LoginPage';
import ForgotPasswordPage from '../features/auth/ForgotPasswordPage';
import VerifyCardPage from '../features/verify/VerifyCardPage';

import DashboardPage from '../features/dashboard/DashboardPage';
import WizardPage from '../features/membership/WizardPage';
import DocumentsPage from '../features/documents/DocumentsPage';
import CvPage from '../features/cv/CvPage';
import IdCardPage from '../features/idcard/IdCardPage';
import PaymentPage from '../features/payment/PaymentPage';
import CalendarPage from '../features/calendar/CalendarPage';
import EventsPage from '../features/events/EventsPage';
import EventDetailPage from '../features/events/EventDetailPage';
import CertificationsPage from '../features/certifications/CertificationsPage';
import NewslettersPage from '../features/newsletters/NewslettersPage';
import NewsletterDetailPage from '../features/newsletters/NewsletterDetailPage';

import AdminDashboardPage from '../features/admin/AdminDashboardPage';
import AdminApplicationsPage from '../features/admin/AdminApplicationsPage';
import AdminApplicationDetailPage from '../features/admin/AdminApplicationDetailPage';
import AdminMembersPage from '../features/admin/AdminMembersPage';
import AdminMemberDetailPage from '../features/admin/AdminMemberDetailPage';
import AdminAddMembersPage from '../features/admin/AdminAddMembersPage';
import AdminEventsPage from '../features/admin/AdminEventsPage';
import AdminNewslettersPage from '../features/admin/AdminNewslettersPage';
import AdminNotificationsPage from '../features/admin/AdminNotificationsPage';
import AdminCvTemplatesPage from '../features/admin/AdminCvTemplatesPage';

// Module-level guard: StrictMode double-mounts must not fire two refresh
// calls, since refresh-token rotation treats a replay as theft.
let bootstrapStarted = false;

function AuthBootstrap({ children }) {
  const initialized = useAuthStore((s) => s.initialized);

  useEffect(() => {
    if (bootstrapStarted) return;
    bootstrapStarted = true;
    refreshSession()
      .catch(() => {})
      .finally(() => useAuthStore.getState().setInitialized());
  }, []);

  if (!initialized) return <FullPageSpinner />;
  return children;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthBootstrap>
          <Routes>
            <Route element={<PublicLayout />}>
              <Route path="/" element={<LandingPage />} />
              <Route path="/apply" element={<ApplyPage />} />
              <Route path="/signup" element={<SignupPage />} />
              <Route path="/verify-otp" element={<VerifyOtpPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/verify/:cardNumber" element={<VerifyCardPage />} />
            </Route>

            <Route
              element={
                <ProtectedRoute roles={['MEMBER', 'ADMIN', 'SUPER_ADMIN']}>
                  <MemberLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/membership/wizard/:step" element={<WizardPage />} />
              <Route path="/documents" element={<DocumentsPage />} />
              <Route path="/cv" element={<CvPage />} />
              <Route path="/id-card" element={<IdCardPage />} />
              <Route path="/payment" element={<PaymentPage />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/events" element={<EventsPage />} />
              <Route path="/events/:id" element={<EventDetailPage />} />
              <Route path="/certifications" element={<CertificationsPage />} />
              <Route path="/newsletters" element={<NewslettersPage />} />
              <Route path="/newsletters/:id" element={<NewsletterDetailPage />} />
            </Route>

            <Route
              path="/admin"
              element={
                <ProtectedRoute roles={['ADMIN', 'SUPER_ADMIN']}>
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<AdminDashboardPage />} />
              <Route path="applications" element={<AdminApplicationsPage />} />
              <Route path="applications/:id" element={<AdminApplicationDetailPage />} />
              <Route path="members" element={<AdminMembersPage />} />
              <Route path="members/:id" element={<AdminMemberDetailPage />} />
              <Route path="add-members" element={<AdminAddMembersPage />} />
              <Route path="events" element={<AdminEventsPage />} />
              <Route path="newsletters" element={<AdminNewslettersPage />} />
              <Route path="notifications" element={<AdminNotificationsPage />} />
              <Route path="cv-templates" element={<AdminCvTemplatesPage />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthBootstrap>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
