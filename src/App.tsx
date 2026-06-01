import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { CurrencyProvider } from "@/contexts/CurrencyContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import { PaymentSuccess, PaymentCancel } from "@/components/PayPalPayment";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import AccountSuspended from "./pages/AccountSuspended";
import Dashboard from "./pages/Dashboard";
import Investments from "./pages/Investments";
import Referrals from "./pages/Referrals";
import Settings from "./pages/Settings";
import Deposit from "./pages/Deposit";
import Withdraw from "./pages/Withdraw";
import Transfer from "./pages/Transfer";
import Cards from "./pages/Cards";
import Activity from "./pages/Activity";
import Savings from "./pages/Savings";
import KYCVerification from "./pages/KYCVerification";
import MyNetwork from "./pages/MyNetwork";
// Admin pages with dedicated AdminLayout
import AdminDashboard from "./pages/AdminDashboard";
import AdminUsers from "./pages/AdminUsers";
import AdminWithdrawals from "./pages/AdminWithdrawals";
import AdminDeposits from "./pages/AdminDeposits";
import AdminBalance from "./pages/AdminBalance";
import AdminSettings from "./pages/AdminSettings";
import AdminFreeze from "./pages/AdminFreeze";
import AdminKYC from "./pages/AdminKYC";
import AdminKYCReview from "./pages/AdminKYCReview";
import AdminTickets from "./pages/AdminTickets";
import AdminStaff from "./pages/AdminStaff";
import AdminLedger from "./pages/AdminLedger";
import AdminFraud from "./pages/AdminFraud";
import AdminRevenue from "./pages/AdminRevenue";
import Notifications from "./pages/Notifications";
// Staff pages with dedicated StaffLayout
import StaffKYC from "./pages/StaffKYC";
import StaffDepositsNew from "./pages/StaffDepositsNew";
import StaffTicketsNew from "./pages/StaffTicketsNew";
import StaffDirectory from "./pages/StaffDirectory";
import StaffUserSupport from "./pages/StaffUserSupport";
import StaffLedger from "./pages/StaffLedger";
// Public pages
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import Support from "./pages/Support";
import NotFound from "./pages/NotFound";
// Marketplace pages
import Marketplace from "./pages/Marketplace";
import MarketplaceProductDetail from "./pages/MarketplaceProductDetail";
import MarketplaceCart from "./pages/MarketplaceCart";
import LoanPolicy from "./pages/LoanPolicy";
import AdminLoans from "./pages/AdminLoans";
import AdminLoanDetail from "./pages/AdminLoanDetail";
import AdminLoanSettings from "./pages/AdminLoanSettings";
import MemberLoans from "./pages/MemberLoans";
import SuretyRequests from "./pages/SuretyRequests";
import AdminRiskMonitor from "./pages/AdminRiskMonitor";
// Blog pages
import BlogPage from "./pages/BlogPage";
import BlogManagement from "./pages/BlogManagement";
import PostDetail from "./pages/PostDetail";
// Seller pages
import SellerApplication from "./pages/SellerApplicationEnhanced";
import SellerDashboard from "./pages/SellerDashboard";
import ListingFeePayment from "./pages/ListingFeePayment";
import TermsOfService from "./pages/TermsOfService";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import MarketplaceRules from "./pages/MarketplaceRules";
import ManageListings from "./pages/ManageListings";
import MarketplaceCreateListing from "./pages/MarketplaceCreateListing";
// Admin pages
import AdminMarketplace from "./pages/AdminMarketplace";
import AdminNotifications from "./pages/AdminNotifications";
import AdminSellerApplications from "./pages/AdminSellerApplications";
import AdminTransactions from "./pages/AdminTransactions";
import AdminEscrow from "./pages/AdminEscrow";
import AdminDisputes from "./pages/AdminDisputes";
import AdminDisputeDetail from "./pages/AdminDisputeDetail";
import { TermsAcceptanceModal } from "./components/TermsAcceptanceModal";

const queryClient = new QueryClient();

const App = () => (
<QueryClientProvider client={queryClient}>
    <AuthProvider>
      <CurrencyProvider>
        <LanguageProvider>
          <TooltipProvider>
          <Toaster />
          <Sonner />
        <BrowserRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/loan-policy" element={<LoanPolicy />} />
            <Route path="/support" element={<Support />} />
            <Route path="/marketplace" element={<Marketplace />} />
            <Route path="/marketplace/:productId" element={<MarketplaceProductDetail />} />
            <Route path="/marketplace/cart" element={<MarketplaceCart />} />
            <Route path="/blog" element={<BlogPage />} />
            <Route path="/blog/:id" element={<PostDetail />} />
            <Route path="/seller/application" element={<SellerApplication />} />
            <Route path="/seller/dashboard" element={<SellerDashboard />} />
            <Route path="/seller/listings" element={<ProtectedRoute requiredRoles={["seller"]}><ManageListings /></ProtectedRoute>} />
            <Route path="/seller/listings/create" element={<ProtectedRoute requiredRoles={["seller"]}><MarketplaceCreateListing /></ProtectedRoute>} />
            <Route path="/seller/listing-fee/:productId" element={<ListingFeePayment />} />
            <Route path="/terms" element={<TermsOfService />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/marketplace-rules" element={<MarketplaceRules />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/account-suspended" element={<AccountSuspended />} />
            
            {/* Member Routes - redirect staff and admin away */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute redirectStaff redirectAdmin>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/investments"
              element={
                <ProtectedRoute redirectStaff redirectAdmin>
                  <Investments />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/referrals"
              element={
                <ProtectedRoute redirectStaff redirectAdmin>
                  <Referrals />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/settings"
              element={
                <ProtectedRoute redirectStaff redirectAdmin>
                  <Settings />
                </ProtectedRoute>
              }
            />
            <Route path="/dashboard/deposit" element={<ProtectedRoute redirectStaff redirectAdmin><Deposit /></ProtectedRoute>} />
            <Route path="/dashboard/withdraw" element={<ProtectedRoute redirectStaff redirectAdmin><Withdraw /></ProtectedRoute>} />
            <Route path="/dashboard/transfer" element={<ProtectedRoute redirectStaff redirectAdmin><Transfer /></ProtectedRoute>} />
            <Route path="/dashboard/cards" element={<ProtectedRoute redirectStaff redirectAdmin><Cards /></ProtectedRoute>} />
            <Route path="/dashboard/activity" element={<ProtectedRoute redirectStaff redirectAdmin><Activity /></ProtectedRoute>} />
            <Route path="/dashboard/savings" element={<ProtectedRoute redirectStaff redirectAdmin><Savings /></ProtectedRoute>} />
            <Route path="/dashboard/kyc" element={<ProtectedRoute redirectStaff redirectAdmin><KYCVerification /></ProtectedRoute>} />
            <Route path="/dashboard/network" element={<ProtectedRoute redirectStaff redirectAdmin><MyNetwork /></ProtectedRoute>} />
            <Route path="/dashboard/loans" element={<ProtectedRoute redirectStaff redirectAdmin><MemberLoans /></ProtectedRoute>} />
            <Route
              path="/notifications"
              element={
                <ProtectedRoute>
                  <Notifications />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/notifications"
              element={
                <ProtectedRoute redirectStaff redirectAdmin>
                  <Notifications />
                </ProtectedRoute>
              }
            />
            <Route path="/dashboard/surety-requests" element={<ProtectedRoute redirectStaff redirectAdmin><SuretyRequests /></ProtectedRoute>} />
            
            {/* PayPal Payment Routes */}
            <Route path="/payment/success" element={<ProtectedRoute><PaymentSuccess /></ProtectedRoute>} />
            <Route path="/payment/cancel" element={<ProtectedRoute><PaymentCancel /></ProtectedRoute>} />
            
            {/* Admin Routes - Admin Only */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute requiredRoles={["admin"]}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/users"
              element={
                <ProtectedRoute requiredRoles={["admin"]}>
                  <AdminUsers />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/withdrawals"
              element={
                <ProtectedRoute requiredRoles={["admin"]}>
                  <AdminWithdrawals />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/deposits"
              element={
                <ProtectedRoute requiredRoles={["admin"]}>
                  <AdminDeposits />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/balance"
              element={
                <ProtectedRoute requiredRoles={["admin"]}>
                  <AdminBalance />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/settings"
              element={
                <ProtectedRoute requiredRoles={["super_admin"]}>
                  <AdminSettings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/freeze"
              element={
                <ProtectedRoute requiredRoles={["admin"]}>
                  <AdminFreeze />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/kyc"
              element={
                <ProtectedRoute requiredRoles={["admin"]}>
                  <AdminKYC />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/kyc-review"
              element={
                <ProtectedRoute requiredRoles={["admin"]}>
                  <AdminKYC />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/tickets"
              element={
                <ProtectedRoute requiredRoles={["admin"]}>
                  <AdminTickets />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/staff"
              element={
                <ProtectedRoute requiredRoles={["admin"]}>
                  <AdminStaff />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/ledger"
              element={
                <ProtectedRoute requiredRoles={["admin"]}>
                  <AdminLedger />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/fraud"
              element={
                <ProtectedRoute requiredRoles={["admin"]}>
                  <AdminFraud />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/revenue"
              element={
                <ProtectedRoute requiredRoles={["admin"]}>
                  <AdminRevenue />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/loans"
              element={
                <ProtectedRoute requiredRoles={["admin"]}>
                  <AdminLoans />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/loans/:loanId"
              element={
                <ProtectedRoute requiredRoles={["admin"]}>
                  <AdminLoanDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/loan-settings"
              element={
                <ProtectedRoute requiredRoles={["admin"]}>
                  <AdminLoanSettings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/risk-monitor"
              element={
                <ProtectedRoute requiredRoles={["admin"]}>
                  <AdminRiskMonitor />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/blog"
              element={
                <ProtectedRoute requiredRoles={["admin", "staff"]}>
                  <BlogManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/seller-applications"
              element={
                <ProtectedRoute requiredRoles={["admin"]}>
                  <AdminSellerApplications />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/marketplace"
              element={
                <ProtectedRoute requiredRoles={["admin"]}>
                  <AdminMarketplace />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/notifications"
              element={
                <ProtectedRoute requiredRoles={["admin"]}>
                  <AdminNotifications />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/transactions"
              element={
                <ProtectedRoute requiredRoles={["admin"]}>
                  <AdminTransactions />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/escrow"
              element={
                <ProtectedRoute requiredRoles={["admin"]}>
                  <AdminEscrow />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/disputes"
              element={
                <ProtectedRoute requiredRoles={["admin"]}>
                  <AdminDisputes />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/disputes/:id"
              element={
                <ProtectedRoute requiredRoles={["admin"]}>
                  <AdminDisputeDetail />
                </ProtectedRoute>
              }
            />
            
            {/* Staff Routes - Staff and Admin */}
            <Route
              path="/staff/kyc"
              element={
                <ProtectedRoute requiredRoles={["admin", "staff"]}>
                  <StaffKYC />
                </ProtectedRoute>
              }
            />
            <Route
              path="/staff/kyc-review"
              element={
                <ProtectedRoute requiredRoles={["admin", "staff"]}>
                  <StaffKYC />
                </ProtectedRoute>
              }
            />
            <Route
              path="/staff/deposits"
              element={
                <ProtectedRoute requiredRoles={["admin", "staff"]}>
                  <StaffDepositsNew />
                </ProtectedRoute>
              }
            />
            <Route
              path="/staff/tickets"
              element={
                <ProtectedRoute requiredRoles={["admin", "staff"]}>
                  <StaffTicketsNew />
                </ProtectedRoute>
              }
            />
            <Route
              path="/staff/directory"
              element={
                <ProtectedRoute requiredRoles={["admin", "staff"]}>
                  <StaffDirectory />
                </ProtectedRoute>
              }
            />
            <Route
              path="/staff/users"
              element={
                <ProtectedRoute requiredRoles={["admin", "staff"]}>
                  <StaffUserSupport />
                </ProtectedRoute>
              }
            />
            <Route
              path="/staff/ledger"
              element={
                <ProtectedRoute requiredRoles={["admin", "staff"]}>
                  <StaffLedger />
                </ProtectedRoute>
              }
            />
            
          <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
        <TermsAcceptanceModal />
          </TooltipProvider>
        </LanguageProvider>
      </CurrencyProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
