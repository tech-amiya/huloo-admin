import { useState, useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { SocialAuthCompleteForm } from "@/components/auth/social-auth-complete-form";
import Dashboard from "@/pages/dashboard";
import Orders from "@/pages/orders";
import Purchases from "@/pages/purchases";
import Inventory from "@/pages/inventory";
import AddProduct from "@/pages/add-product";
import EditProduct from "@/pages/edit-product";
import Shipping from "@/pages/shipping";
import ShippingProfiles from "@/pages/shipping-profiles";
import Addresses from "@/pages/addresses";
import Analytics from "@/pages/analytics";
import LiveShows from "@/pages/live-shows";
import Settings from "@/pages/settings";
import Profile from "@/pages/profile";
import Login from "@/pages/login";
import Signup from "@/pages/signup";
import AdminLogin from "@/pages/admin-login";
import AdminDashboard from "@/pages/admin-dashboard";
import AdminUserDetail from "@/pages/admin-user-detail";
import AdminUserItemDetail from "@/pages/admin-user-item-detail";
import AdminInventory from "@/pages/admin-inventory";
import AdminProductDetail from "@/pages/admin-product-detail";
import AdminOrders from "@/pages/admin-orders";
import AdminOrderDetail from "@/pages/admin-order-detail";
import AdminTransactions from "@/pages/admin-transactions";
import AdminPayouts from "@/pages/admin-payouts";
import AdminShows from "@/pages/admin-shows";
import AdminShowDetail from "@/pages/admin-show-detail";
import AdminSettings from "@/pages/admin-settings";
import AdminProfile from "@/pages/admin-profile";
import AdminApplicationFees from "@/pages/admin-application-fees";
import AdminCategories from "@/pages/admin-categories";
import AdminSubCategories from "@/pages/admin-subcategories";
import AdminDisputes from "@/pages/admin-disputes";
import AdminDisputeDetail from "@/pages/admin-dispute-detail";
import AdminReportedCases from "@/pages/admin-reported-cases";
import AdminEmails from "@/pages/admin-emails";
import NotFound from "@/pages/not-found";
import { cn } from "@/lib/utils";

// Home redirect component based on seller status
function HomeRedirect() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    // Redirect based on seller status
    if (user?.seller) {
      setLocation('/orders');
    } else {
      setLocation('/purchases');
    }
  }, [user?.seller, setLocation]);

  return null;
}

// Admin home redirect
function AdminHomeRedirect() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    setLocation('/admin');
  }, [setLocation]);

  return null;
}

// Login redirect
function LoginRedirect() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    setLocation('/');
  }, [setLocation]);

  return null;
}

function Router() {
  const { isAuthenticated, isLoading, user, pendingSocialAuth, pendingSocialAuthEmail, pendingSocialAuthData, completeSocialAuth } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [location, setLocation] = useLocation();

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  // Handle social auth completion
  const handleSocialAuthComplete = async (data: any) => {
    try {
      await completeSocialAuth(data);
      // Redirect based on seller status after successful completion
      if (user?.seller) {
        setLocation('/orders');
      } else {
        setLocation('/purchases');
      }
    } catch (error) {
      console.error('Social auth completion failed:', error);
      // Error handling is done in the component via toast
    }
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Show social auth completion form if pending
  if (pendingSocialAuth && pendingSocialAuthEmail && pendingSocialAuthData) {
    return (
      <SocialAuthCompleteForm
        userEmail={pendingSocialAuthEmail}
        socialAuthData={pendingSocialAuthData}
        onComplete={handleSocialAuthComplete}
        isLoading={isLoading}
      />
    );
  }

  // Show auth pages if not authenticated
  if (!isAuthenticated) {
    // Allow admin login page without authentication
    if (location === "/admin/login") {
      return <AdminLogin />;
    }
    
    return (
      <Switch>
        <Route path="/signup" component={Signup} />
        <Route path="/admin/login" component={AdminLogin} />
        <Route path="/" component={Login} />
        {/* Fallback to login for any other routes */}
        <Route component={LoginRedirect} />
      </Switch>
    );
  }

  // Show admin pages if user is admin
  if (user?.admin) {
    return (
      <Switch>
        <Route path="/" component={AdminHomeRedirect} />
        <Route path="/admin" component={AdminDashboard} />
        <Route path="/admin/users/:userId/details/:itemType/:itemId" component={AdminUserItemDetail} />
        <Route path="/admin/users/:userId" component={AdminUserDetail} />
        <Route path="/admin/inventory" component={AdminInventory} />
        <Route path="/admin/products/:productId" component={AdminProductDetail} />
        <Route path="/admin/orders/:orderId" component={AdminOrderDetail} />
        <Route path="/admin/orders" component={AdminOrders} />
        <Route path="/admin/disputes/:disputeId" component={AdminDisputeDetail} />
        <Route path="/admin/disputes" component={AdminDisputes} />
        <Route path="/admin/reported-cases" component={AdminReportedCases} />
        <Route path="/admin/transactions" component={AdminTransactions} />
        <Route path="/admin/payouts" component={AdminPayouts} />
        <Route path="/admin/application-fees" component={AdminApplicationFees} />
        <Route path="/admin/categories/:categoryId/subcategories" component={AdminSubCategories} />
        <Route path="/admin/categories" component={AdminCategories} />
        <Route path="/admin/shows/:showId" component={AdminShowDetail} />
        <Route path="/admin/shows" component={AdminShows} />
        <Route path="/admin/emails" component={AdminEmails} />
        <Route path="/admin/settings" component={AdminSettings} />
        <Route path="/admin/profile" component={AdminProfile} />
        <Route component={AdminHomeRedirect} />
      </Switch>
    );
  }

  // Show main app with sidebar if authenticated (non-admin users)
  return (
    <div className="flex h-screen bg-background">
      <Sidebar isCollapsed={sidebarCollapsed} onToggle={toggleSidebar} />
      <div className="flex flex-col flex-1 min-w-0">
        <Header />
        <main className="flex-1 overflow-y-auto focus:outline-none">
          <Switch>
            <Route path="/" component={HomeRedirect} />
            <Route path="/orders" component={Orders} />
            <Route path="/purchases" component={Purchases} />
            <Route path="/inventory" component={Inventory} />
            <Route path="/inventory/add" component={AddProduct} />
            <Route path="/inventory/edit/:id" component={EditProduct} />
            <Route path="/shipping" component={Shipping} />
            <Route path="/shipping-profiles" component={ShippingProfiles} />
            <Route path="/addresses" component={Addresses} />
            <Route path="/profile" component={Profile} />
            <Route path="/admin/login" component={AdminLogin} />
            {/* <Route path="/dashboard" component={Dashboard} />
            <Route path="/analytics" component={Analytics} />
            <Route path="/live-shows" component={LiveShows} />
            <Route path="/settings" component={Settings} /> */}
            <Route component={NotFound} />
          </Switch>
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
