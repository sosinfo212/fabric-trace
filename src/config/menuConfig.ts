import { 
  Users, 
  Shield, 
  Key, 
  Database,
  UserCircle,
  AlertTriangle,
  Link,
  Package,
  Download,
  ClipboardList,
  BarChart3,
  FileText,
  Factory,
  FileCheck,
  AlertCircle,
  Calendar,
  FileBarChart,
  Search,
  Printer,
  Layers,
  Trash2,
  Boxes,
  MessageSquare,
  ArrowRightLeft,
  ClipboardCheck,
  PackageCheck,
  Truck,
  ListChecks,
  AlertOctagon,
  Target,
  PieChart,
  Beaker,
  LucideIcon
} from 'lucide-react';
import { AppRole } from '@/types/roles';

export interface MenuItem {
  title: string;
  url: string;
  icon: LucideIcon;
  roles: AppRole[];
}

export interface MenuSection {
  title: string;
  icon: LucideIcon;
  roles: AppRole[];
  items: MenuItem[];
}

export const menuConfig: MenuSection[] = [
  {
    title: 'Administration',
    icon: Shield,
    roles: ['admin'],
    items: [
      { title: 'Utilisateurs', url: '/admin/users', icon: Users, roles: ['admin'] },
      { title: 'Rôles', url: '/admin/roles', icon: Key, roles: ['admin'] },
      { title: 'Permissions', url: '/admin/permissions', icon: Shield, roles: ['admin'] },
      { title: 'Sauvegardes', url: '/admin/backups', icon: Database, roles: ['admin'] },
    ],
  },
  {
    title: 'Éléments d\'Entrée',
    icon: Package,
    roles: ['admin', 'planificatrice', 'responsable_magasin_pf'],
    items: [
      { title: 'Clients', url: '/entry/clients', icon: UserCircle, roles: ['admin', 'planificatrice'] },
      { title: 'Liste des Défauts', url: '/entry/defects', icon: AlertTriangle, roles: ['admin'] },
      { title: 'Chaînes', url: '/entry/chains', icon: Link, roles: ['admin'] },
      { title: 'Produits', url: '/entry/products', icon: Package, roles: ['admin', 'responsable_magasin_pf'] },
    ],
  },
  {
    title: 'Planning',
    icon: Calendar,
    roles: ['admin', 'planificatrice'],
    items: [
      { title: 'Commandes', url: '/planning/orders', icon: ClipboardList, roles: ['admin', 'planificatrice'] },
      { title: 'Planning Gantt', url: '/planning/gantt', icon: BarChart3, roles: ['admin', 'planificatrice'] },
      { title: 'Rapport Commande', url: '/planning/report', icon: FileText, roles: ['admin', 'planificatrice'] },
    ],
  },
  {
    title: 'Atelier',
    icon: Factory,
    roles: ['admin', 'controle', 'chef_de_chaine', 'agent_qualite', 'planificatrice'],
    items: [
      { title: 'Ordre de fabrication', url: '/atelier/fab-orders', icon: FileCheck, roles: ['admin', 'controle', 'chef_chaine', 'chef_de_chaine'] },
      { title: 'Déclaration fabrication', url: '/workshop/declaration', icon: ClipboardCheck, roles: ['chef_de_chaine', 'admin', 'planificatrice', 'controle'] },
      { title: 'Déclaration défaut', url: '/workshop/defects', icon: AlertCircle, roles: ['chef_de_chaine', 'agent_qualite', 'admin', 'controle'] },
      { title: 'Suivi Journalier', url: '/workshop/daily', icon: Calendar, roles: ['admin', 'controle'] },
      { title: 'Rapport fabrication', url: '/workshop/report', icon: FileBarChart, roles: ['admin', 'controle'] },
      { title: 'Traçabilité fabrication', url: '/workshop/traceability', icon: Search, roles: ['admin', 'controle'] },
    ],
  },
  {
    title: 'Sérigraphie',
    icon: Printer,
    roles: ['admin', 'controle', 'chef_equipe_serigraphie', 'responsable_magasin', 'responsable_magasin_pf', 'planificatrice'],
    items: [
      { title: 'Ordre de fabrication', url: '/serigraphie/orders', icon: FileCheck, roles: ['chef_equipe_serigraphie', 'responsable_magasin', 'admin', 'controle'] },
      { title: 'Planning magasin', url: '/serigraphie/warehouse-planning', icon: Calendar, roles: ['chef_equipe_serigraphie', 'responsable_magasin', 'admin', 'controle'] },
      { title: 'Planning sérigraphie', url: '/serigraphie/planning', icon: BarChart3, roles: ['chef_equipe_serigraphie', 'responsable_magasin_pf', 'admin'] },
      { title: 'Déclaration Sérigraphie', url: '/serigraphie/declaration', icon: ClipboardCheck, roles: ['chef_equipe_serigraphie', 'responsable_magasin_pf', 'admin', 'planificatrice'] },
    ],
  },
  {
    title: 'Laquage',
    icon: Layers,
    roles: ['admin'],
    items: [
      { title: 'Ordres de fabrication', url: '/lacquering/orders', icon: FileCheck, roles: ['admin'] },
      { title: 'Déclaration fabrication', url: '/lacquering/declaration', icon: ClipboardCheck, roles: ['admin'] },
      { title: 'Déclaration rebut', url: '/lacquering/waste', icon: Trash2, roles: ['admin'] },
    ],
  },
  {
    title: 'Injection',
    icon: Boxes,
    roles: ['admin', 'agent_qualite', 'planificatrice', 'chef_equipe_injection'],
    items: [
      { title: 'Ordre de fabrication', url: '/injection/orders', icon: FileCheck, roles: ['admin', 'agent_qualite', 'planificatrice'] },
      { title: 'Déclaration fabrication', url: '/injection/declaration', icon: ClipboardCheck, roles: ['admin', 'agent_qualite', 'planificatrice', 'chef_equipe_injection'] },
      { title: 'Déclaration rebut', url: '/injection/waste', icon: Trash2, roles: ['admin', 'agent_qualite', 'planificatrice', 'chef_equipe_injection'] },
    ],
  },
  {
    title: 'Messages',
    icon: MessageSquare,
    roles: ['admin', 'planificatrice', 'responsable_magasin_pf', 'controle', 'agent_qualite', 'chef_equipe_serigraphie', 'responsable_magasin', 'chef_equipe_injection', 'chef_equipe_pf', 'agent_logistique', 'agent_magasin', 'responsable_transport', 'operator'],
    items: [
      { title: 'Chat/Messages', url: '/messages', icon: MessageSquare, roles: ['admin', 'planificatrice', 'responsable_magasin_pf', 'controle', 'agent_qualite', 'chef_equipe_serigraphie', 'responsable_magasin', 'chef_equipe_injection', 'chef_equipe_pf', 'agent_logistique', 'agent_magasin', 'responsable_transport', 'operator'] },
    ],
  },
  {
    title: 'Transfert',
    icon: ArrowRightLeft,
    roles: ['admin', 'chef_equipe_pf', 'agent_logistique', 'agent_magasin', 'responsable_magasin_pf'],
    items: [
      { title: 'Mouvement PF', url: '/transfer/movements', icon: ArrowRightLeft, roles: ['admin', 'chef_equipe_pf', 'agent_logistique', 'agent_magasin', 'responsable_magasin_pf'] },
      { title: 'Rapport PF', url: '/transfer/report', icon: FileBarChart, roles: ['admin', 'chef_equipe_pf', 'agent_logistique', 'agent_magasin', 'responsable_magasin_pf'] },
    ],
  },
  {
    title: 'Gestion Composant',
    icon: PackageCheck,
    roles: ['admin', 'planificatrice', 'controle', 'chef_de_chaine'],
    items: [
      { title: 'Composants alternatifs', url: '/component-changes', icon: Package, roles: ['admin', 'planificatrice', 'controle', 'chef_de_chaine'] },
      { title: 'Rebut hors production', url: '/components/waste', icon: Trash2, roles: ['admin', 'planificatrice', 'controle'] },
      { title: 'Rapport rebut', url: '/components/waste-report', icon: FileBarChart, roles: ['admin', 'planificatrice', 'controle'] },
    ],
  },
  {
    title: 'Laboratoire',
    icon: Beaker,
    roles: ['admin', 'controle', 'planificatrice'],
    items: [
      { title: 'Ordre de fabrication', url: '/laboratoire/ordres', icon: ClipboardList, roles: ['admin', 'controle', 'planificatrice'] },
      { title: 'Déclaration fabrication', url: '/laboratoire/declarations', icon: ClipboardCheck, roles: ['admin', 'controle', 'planificatrice'] },
      { title: 'Stock', url: '/laboratoire/stock', icon: Boxes, roles: ['admin', 'controle', 'planificatrice'] },
      { title: 'Rapport global', url: '/laboratoire/rapport', icon: PieChart, roles: ['admin', 'controle', 'planificatrice'] },
    ],
  },
  {
    title: 'Expédition',
    icon: Truck,
    roles: ['admin', 'responsable_magasin_pf', 'chef_equipe_pf', 'responsable_transport', 'planificatrice'],
    items: [
      { title: 'Listes de colisage', url: '/shipping/packing', icon: ListChecks, roles: ['admin', 'responsable_magasin_pf', 'responsable_transport', 'planificatrice'] },
      { title: 'Rapport préparation', url: '/shipping/preparation', icon: FileBarChart, roles: ['chef_equipe_pf', 'admin', 'responsable_magasin_pf', 'responsable_transport', 'planificatrice'] },
      { title: 'Fiche logistique', url: '/shipping/logistics', icon: ClipboardList, roles: ['chef_equipe_pf', 'admin', 'responsable_magasin_pf', 'responsable_transport'] },
      { title: 'Liste Manquant', url: '/shipping/missing', icon: AlertOctagon, roles: ['chef_equipe_pf', 'admin', 'responsable_magasin_pf', 'responsable_transport'] },
    ],
  },
  {
    title: 'Tâches',
    icon: Target,
    roles: ['admin', 'responsable_magasin_pf', 'responsable_transport'],
    items: [
      { title: 'Plan d\'action', url: '/tasks/action-plan', icon: Target, roles: ['admin', 'responsable_magasin_pf', 'responsable_transport'] },
      { title: 'Synthèse', url: '/tasks/summary', icon: PieChart, roles: ['admin', 'responsable_magasin_pf', 'responsable_transport'] },
    ],
  },
];
