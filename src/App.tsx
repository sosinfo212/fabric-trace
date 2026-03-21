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
import PlanningReportPage from "./pages/planning/PlanningReport";
import FabOrdersPage from "./pages/atelier/FabOrders";
import FabOrderCreatePage from "./pages/atelier/FabOrderCreate";
import FabOrderEditPage from "./pages/atelier/FabOrderEdit";
import FabOrderViewPage from "./pages/atelier/FabOrderView";
import DeclarationPage from "./pages/workshop/Declaration";
import DeclarationAddPage from "./pages/workshop/DeclarationAdd";
import DeclarationHistoryPage from "./pages/workshop/DeclarationHistory";
import DeclarationDefectsPage from "./pages/workshop/Defects";
import DailyFollowUpPage from "./pages/workshop/DailyFollowUp";
import WorkshopReportPage from "./pages/workshop/WorkshopReport";
import TraceabilityPage from "./pages/workshop/Traceability";
import SerigraphieOrdersPage from "./pages/serigraphie/SerigraphieOrders";
import SerigraphiePlanningPage from "./pages/serigraphie/Planning";
import SerigraphieDeclarationPage from "./pages/serigraphie/Declaration";
import SerigraphieDeclarationCreatePage from "./pages/serigraphie/DeclarationCreate";
import WarehousePlanningPage from "./pages/serigraphie/WarehousePlanning";
import QualityCreatePage from "./pages/quality/QualityCreate";
import QualityChartsPage from "./pages/quality/QualityCharts";
import LaquageOrdersPage from "./pages/laquage/LaquageOrders";
import LaquageDeclarationsPage from "./pages/laquage/LaquageDeclarations";
import LaquageRebutsPage from "./pages/laquage/LaquageRebuts";
import InjectionOrdersPage from "./pages/injection/InjectionOrders";
import InjectionDeclarationsPage from "./pages/injection/InjectionDeclarations";
import InjectionRebutsPage from "./pages/injection/InjectionRebuts";
import MovementsPage from "./pages/transfer/MovementsPage";
import MovementsCreatePage from "./pages/transfer/MovementsCreatePage";
import MovementsEditPage from "./pages/transfer/MovementsEditPage";
import TransferReportPage from "./pages/transfer/TransferReportPage";
import ComponentChangesPage from "./pages/componentChanges/ComponentChangesPage";
import WasteHorsProdIndex from "./pages/waste/WasteHorsProdIndex";
import WasteHorsProdCreate from "./pages/waste/WasteHorsProdCreate";
import WasteHorsProdDetail from "./pages/waste/WasteHorsProdDetail";
import WasteHorsProdEdit from "./pages/waste/WasteHorsProdEdit";
import UnifiedRebutReportPage from "./pages/wasteReport/UnifiedRebutReportPage";
import LaboratoireRedirectPage from "./pages/laboratoire/LaboratoireRedirectPage";
import LaboratoireOrdresPage from "./pages/laboratoire/OrdresPage";
import LaboratoireDeclarationsPage from "./pages/laboratoire/DeclarationsPage";
import LaboratoireStockPage from "./pages/laboratoire/StockPage";
import LaboratoireStockViewPage from "./pages/laboratoire/StockViewPage";
import LaboratoireRapportPage from "./pages/laboratoire/RapportPage";
import PackingIndexPage from "./pages/shipping/PackingIndexPage";
import PackingShowPage from "./pages/shipping/PackingShowPage";
import PackingEditPage from "./pages/shipping/PackingEditPage";
import PackingPrintPage from "./pages/shipping/PackingPrintPage";

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
            <Route path="/planning/report" element={<PlanningReportPage />} />
            <Route path="/atelier/fab-orders" element={<FabOrdersPage />} />
            <Route path="/atelier/fab-orders/new" element={<FabOrderCreatePage />} />
            <Route path="/atelier/fab-orders/:id" element={<FabOrderViewPage />} />
            <Route path="/atelier/fab-orders/:id/edit" element={<FabOrderEditPage />} />
            <Route path="/workshop/declaration" element={<DeclarationPage />} />
            <Route path="/workshop/declaration/:orderId/add" element={<DeclarationAddPage />} />
            <Route path="/workshop/declaration/history/:ofId" element={<DeclarationHistoryPage />} />
            <Route path="/workshop/defects" element={<DeclarationDefectsPage />} />
            <Route path="/workshop/daily" element={<DailyFollowUpPage />} />
            <Route path="/workshop/report" element={<WorkshopReportPage />} />
            <Route path="/workshop/traceability" element={<TraceabilityPage />} />
            <Route path="/serigraphie/orders" element={<SerigraphieOrdersPage />} />
            <Route path="/serigraphie/planning" element={<SerigraphiePlanningPage />} />
            <Route path="/serigraphie/declaration" element={<SerigraphieDeclarationPage />} />
            <Route path="/serigraphie/declaration/create/:encodedOFID" element={<SerigraphieDeclarationCreatePage />} />
            <Route path="/serigraphie/warehouse-planning" element={<WarehousePlanningPage />} />
            <Route path="/quality/create" element={<QualityCreatePage />} />
            <Route path="/quality/charts" element={<QualityChartsPage />} />
            <Route path="/lacquering/orders" element={<LaquageOrdersPage />} />
            <Route path="/lacquering/declaration" element={<LaquageDeclarationsPage />} />
            <Route path="/lacquering/waste" element={<LaquageRebutsPage />} />
            <Route path="/injection/orders" element={<InjectionOrdersPage />} />
            <Route path="/injection/declaration" element={<InjectionDeclarationsPage />} />
            <Route path="/injection/waste" element={<InjectionRebutsPage />} />
            <Route path="/transfer/movements" element={<MovementsPage />} />
            <Route path="/transfer/movements/create" element={<MovementsCreatePage />} />
            <Route path="/transfer/movements/:id/edit" element={<MovementsEditPage />} />
            <Route path="/transfer/report" element={<TransferReportPage />} />
            <Route path="/component-changes" element={<ComponentChangesPage />} />
            <Route path="/components/waste" element={<WasteHorsProdIndex />} />
            <Route path="/components/waste/create" element={<WasteHorsProdCreate />} />
            <Route path="/components/waste/:id/edit" element={<WasteHorsProdEdit />} />
            <Route path="/components/waste/:id" element={<WasteHorsProdDetail />} />
            <Route path="/components/waste-report" element={<UnifiedRebutReportPage />} />
            <Route path="/laboratoire" element={<LaboratoireRedirectPage />} />
            <Route path="/laboratoire/ordres" element={<LaboratoireOrdresPage />} />
            <Route path="/laboratoire/declarations" element={<LaboratoireDeclarationsPage />} />
            <Route path="/laboratoire/stock" element={<LaboratoireStockPage />} />
            <Route path="/laboratoire/stock/view" element={<LaboratoireStockViewPage />} />
            <Route path="/laboratoire/rapport" element={<LaboratoireRapportPage />} />
            <Route path="/shipping/packing" element={<PackingIndexPage />} />
            <Route path="/shipping/packing/:id" element={<PackingShowPage />} />
            <Route path="/shipping/packing/:id/edit" element={<PackingEditPage />} />
            <Route path="/shipping/packing/:id/print" element={<PackingPrintPage />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
