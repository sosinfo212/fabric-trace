export type AppRole = 
  | 'admin'
  | 'planificatrice'
  | 'responsable_magasin_pf'
  | 'controle'
  | 'chef_de_chaine'
  | 'agent_qualite'
  | 'chef_equipe_serigraphie'
  | 'responsable_magasin'
  | 'chef_equipe_injection'
  | 'chef_equipe_pf'
  | 'agent_logistique'
  | 'agent_magasin'
  | 'responsable_transport'
  | 'operator';

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: 'Administrateur',
  planificatrice: 'Planificatrice',
  responsable_magasin_pf: 'Responsable Magasin PF',
  controle: 'Contrôle',
  chef_de_chaine: 'Chef de Chaîne',
  agent_qualite: 'Agent Qualité',
  chef_equipe_serigraphie: 'Chef d\'équipe Sérigraphie',
  responsable_magasin: 'Responsable Magasin',
  chef_equipe_injection: 'Chef d\'équipe Injection',
  chef_equipe_pf: 'Chef d\'équipe PF',
  agent_logistique: 'Agent Logistique',
  agent_magasin: 'Agent Magasin',
  responsable_transport: 'Responsable Transport',
  operator: 'Opérateur',
};
