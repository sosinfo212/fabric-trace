-- MySQL Migration Script for Fabrication Tracker
-- Converted from PostgreSQL/Supabase schema

-- Create database if not exists (run this separately if needed)
-- CREATE DATABASE IF NOT EXISTS pcd_db;
-- USE pcd_db;

-- ============================================
-- 1. PROFILES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
    id CHAR(36) PRIMARY KEY,
    email VARCHAR(255),
    full_name TEXT,
    password_hash VARCHAR(255) NOT NULL, -- Added for MySQL auth
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_profiles_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 2. USER ROLES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS user_roles (
    id CHAR(36) PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    role ENUM(
        'admin',
        'planificatrice',
        'responsable_magasin_pf',
        'controle',
        'chef_de_chaine',
        'agent_qualite',
        'chef_equipe_serigraphie',
        'responsable_magasin',
        'chef_equipe_injection',
        'chef_equipe_pf',
        'agent_logistique',
        'agent_magasin',
        'responsable_transport',
        'operator'
    ) NOT NULL DEFAULT 'operator',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_user_role (user_id, role),
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
    INDEX idx_user_roles_user_id (user_id),
    INDEX idx_user_roles_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 3. CLIENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS clients (
    id CHAR(36) PRIMARY KEY,
    name TEXT NOT NULL,
    designation TEXT,
    instruction TEXT,
    instruction_logistique TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 4. PRODUCTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS products (
    id CHAR(36) PRIMARY KEY,
    ref_id VARCHAR(50) NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    image_url VARCHAR(500),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_products_ref_id (ref_id),
    INDEX idx_products_name (product_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 5. PRODUCT COMPONENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS product_components (
    id CHAR(36) PRIMARY KEY,
    product_id CHAR(36) NOT NULL,
    component_name VARCHAR(255),
    component_code VARCHAR(255),
    quantity DOUBLE NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    INDEX idx_product_components_product_id (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 6. COMMANDES TABLE (Orders)
-- ============================================
CREATE TABLE IF NOT EXISTS commandes (
    id CHAR(36) PRIMARY KEY,
    num_commande VARCHAR(255) NOT NULL,
    client_id CHAR(36),
    date_planifiee DATE,
    date_debut DATE,
    date_fin DATE,
    instruction TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL,
    INDEX idx_commandes_client_id (client_id),
    INDEX idx_commandes_num_commande (num_commande)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 7. CHAINES TABLE (Production Chains)
-- ============================================
CREATE TABLE IF NOT EXISTS chaines (
    id CHAR(36) PRIMARY KEY,
    num_chaine INT NOT NULL UNIQUE,
    responsable_qlty_id CHAR(36),
    chef_de_chaine_id CHAR(36),
    nbr_operateur INT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (responsable_qlty_id) REFERENCES profiles(id) ON DELETE SET NULL,
    FOREIGN KEY (chef_de_chaine_id) REFERENCES profiles(id) ON DELETE SET NULL,
    INDEX idx_chaines_responsable_qlty (responsable_qlty_id),
    INDEX idx_chaines_chef_de_chaine (chef_de_chaine_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 8. DEFECT CATEGORIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS defaut_categories (
    id CHAR(36) PRIMARY KEY,
    category_name TEXT NOT NULL,
    description TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_category_name (category_name(255))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 9. DEFECT LIST TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS defaut_list (
    id CHAR(36) PRIMARY KEY,
    category_id CHAR(36) NOT NULL,
    label TEXT NOT NULL,
    description TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES defaut_categories(id) ON DELETE CASCADE,
    INDEX idx_defaut_list_category_id (category_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 10. ROLE PERMISSIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS role_permissions (
    id CHAR(36) PRIMARY KEY,
    role ENUM(
        'admin',
        'planificatrice',
        'responsable_magasin_pf',
        'controle',
        'chef_de_chaine',
        'agent_qualite',
        'chef_equipe_serigraphie',
        'responsable_magasin',
        'chef_equipe_injection',
        'chef_equipe_pf',
        'agent_logistique',
        'agent_magasin',
        'responsable_transport',
        'operator'
    ) NOT NULL,
    menu_path TEXT NOT NULL,
    can_access BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_role_menu (role, menu_path(255)),
    INDEX idx_role_permissions_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 11. CUSTOM ROLES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS custom_roles (
    id CHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    label VARCHAR(255) NOT NULL,
    description TEXT,
    is_system BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_custom_roles_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 12. FAB ORDERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS fab_orders (
    id CHAR(36) PRIMARY KEY,
    of_id VARCHAR(255) NOT NULL UNIQUE,
    product_id VARCHAR(255), -- Changed to VARCHAR as per migration
    prod_ref VARCHAR(255),
    prod_name VARCHAR(255),
    chaine_id CHAR(36) NOT NULL,
    sale_order_id VARCHAR(255) NOT NULL,
    client_id VARCHAR(255) NOT NULL, -- Changed to VARCHAR as per migration
    creation_date_of DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    date_fabrication DATETIME,
    pf_qty INT NOT NULL DEFAULT 0,
    sf_qty INT NOT NULL DEFAULT 0,
    set_qty INT NOT NULL DEFAULT 0,
    tester_qty INT NOT NULL DEFAULT 0,
    lot_set VARCHAR(255) NOT NULL DEFAULT '',
    instruction TEXT,
    comment_chaine TEXT,
    end_prod DATETIME,
    statut_of ENUM('Planifié', 'En cours', 'Réalisé', 'Cloturé', 'Suspendu') NOT NULL DEFAULT 'Planifié',
    comment TEXT,
    order_prod VARCHAR(255),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (chaine_id) REFERENCES chaines(id) ON DELETE CASCADE,
    INDEX idx_fab_orders_chaine_id (chaine_id),
    INDEX idx_fab_orders_of_id (of_id),
    INDEX idx_fab_orders_statut (statut_of)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- INSERT DEFAULT CUSTOM ROLES
-- ============================================
INSERT INTO custom_roles (id, name, label, description, is_system) VALUES
(UUID(), 'admin', 'Administrateur', 'Accès complet à toutes les fonctionnalités du système', TRUE),
(UUID(), 'planificatrice', 'Planificatrice', 'Gestion du planning, commandes et déclarations', TRUE),
(UUID(), 'responsable_magasin_pf', 'Responsable Magasin PF', 'Gestion des produits finis et expédition', TRUE),
(UUID(), 'controle', 'Contrôle', 'Suivi de production et contrôle qualité', TRUE),
(UUID(), 'chef_de_chaine', 'Chef de Chaîne', 'Gestion de la chaîne de production', TRUE),
(UUID(), 'agent_qualite', 'Agent Qualité', 'Déclaration des défauts et contrôle qualité', TRUE),
(UUID(), 'chef_equipe_serigraphie', 'Chef d''équipe Sérigraphie', 'Gestion de l''équipe sérigraphie', TRUE),
(UUID(), 'responsable_magasin', 'Responsable Magasin', 'Gestion du magasin et stocks', TRUE),
(UUID(), 'chef_equipe_injection', 'Chef d''équipe Injection', 'Gestion de l''équipe injection', TRUE),
(UUID(), 'chef_equipe_pf', 'Chef d''équipe PF', 'Gestion de l''équipe produits finis', TRUE),
(UUID(), 'agent_logistique', 'Agent Logistique', 'Gestion des transferts et mouvements', TRUE),
(UUID(), 'agent_magasin', 'Agent Magasin', 'Opérations magasin et transferts', TRUE),
(UUID(), 'responsable_transport', 'Responsable Transport', 'Gestion du transport et expédition', TRUE),
(UUID(), 'operator', 'Opérateur', 'Accès limité aux fonctionnalités de base', TRUE)
ON DUPLICATE KEY UPDATE name=name;
