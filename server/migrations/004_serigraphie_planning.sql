-- Sérigraphie planning (ordres de pré-fabrication)
CREATE TABLE IF NOT EXISTS serigraphie_planning (
    id CHAR(36) PRIMARY KEY,
    OFID VARCHAR(255) NOT NULL,
    prod_ref VARCHAR(255) DEFAULT NULL,
    prod_des VARCHAR(500) DEFAULT NULL,
    client VARCHAR(255) DEFAULT NULL,
    date_planifie DATE DEFAULT NULL,
    commande VARCHAR(255) DEFAULT NULL,
    qte_plan INT NOT NULL DEFAULT 0,
    qte_reel INT NOT NULL DEFAULT 0,
    statut VARCHAR(50) NOT NULL DEFAULT 'Planifié',
    Priority INT NOT NULL DEFAULT 0,
    qty_produced INT DEFAULT NULL,
    instruction TEXT DEFAULT NULL,
    comment TEXT DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_ofid (OFID),
    INDEX idx_serigraphie_planning_statut (statut),
    INDEX idx_serigraphie_planning_client (client),
    INDEX idx_serigraphie_planning_commande (commande),
    INDEX idx_serigraphie_planning_date_planifie (date_planifie)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
