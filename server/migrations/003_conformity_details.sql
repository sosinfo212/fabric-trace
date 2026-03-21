-- Conformity details (déclaration défaut) – one row per defect line
CREATE TABLE IF NOT EXISTS conformity_details (
    id CHAR(36) PRIMARY KEY,
    OFID VARCHAR(255) NOT NULL,
    fab_order_id CHAR(36) NULL,
    category_id CHAR(36) NOT NULL COMMENT 'defaut_categories (anomaly)',
    defect_id CHAR(36) NULL COMMENT 'defaut_list (liste défaut)',
    component_name VARCHAR(255) NULL,
    qty_nc INT NOT NULL DEFAULT 0,
    type_product ENUM('PF', 'Tester', 'Set') NOT NULL DEFAULT 'PF',
    resp_defaut ENUM('Main d''oeuvre', 'Machine', 'Fournisseur') NOT NULL DEFAULT 'Main d''oeuvre',
    total_nc INT NULL COMMENT 'Total NC for this declaration header',
    comment TEXT NULL,
    responsable VARCHAR(255) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_conformity_OFID (OFID),
    INDEX idx_conformity_fab_order_id (fab_order_id),
    INDEX idx_conformity_created_at (created_at),
    FOREIGN KEY (category_id) REFERENCES defaut_categories(id) ON DELETE RESTRICT,
    FOREIGN KEY (defect_id) REFERENCES defaut_list(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
