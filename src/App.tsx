import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import UsersPage from "./pages/admin/Users";
import RolesPage from "./pages/admin/Roles";
import PermissionsPage from "./pages/admin/Permissions";
import BackupsPage from "./pages/admin/Backups";
import ClientsPage from "./pages/entry/Clients";
import DefectsPage from "./pages/entry/Defects";
import ChainsPage from "./pages/entry/Chains";
import ProductsPage from "./pages/entry/Products";
import CommandesPage from "./pages/planning/Commandes";
import FabOrdersPage from "./pages/atelier/FabOrders";
import FabOrderCreatePage from "./pages/atelier/FabOrderCreate";
import FabOrderEditPage from "./pages/atelier/FabOrderEdit";
import FabOrderViewPage from "./pages/atelier/FabOrderView";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/admin/users" element={<UsersPage />} />
            <Route path="/admin/roles" element={<RolesPage />} />
            <Route path="/admin/permissions" element={<PermissionsPage />} />
            <Route path="/admin/backups" element={<BackupsPage />} />
            <Route path="/entry/clients" element={<ClientsPage />} />
            <Route path="/entry/defects" element={<DefectsPage />} />
            <Route path="/entry/chains" element={<ChainsPage />} />
            <Route path="/entry/products" element={<ProductsPage />} />
            <Route path="/planning/orders" element={<CommandesPage />} />
            <Route path="/atelier/fab-orders" element={<FabOrdersPage />} />
            <Route path="/atelier/fab-orders/new" element={<FabOrderCreatePage />} />
            <Route path="/atelier/fab-orders/:id" element={<FabOrderViewPage />} />
            <Route path="/atelier/fab-orders/:id/edit" element={<FabOrderEditPage />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
