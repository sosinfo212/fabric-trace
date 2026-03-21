-- Transfert Fabrication: movements between Atelier and Magasin
CREATE TABLE IF NOT EXISTS transfert_fabrication (
    id INT AUTO_INCREMENT PRIMARY KEY,
    Num_comm VARCHAR(255) NOT NULL,
    client VARCHAR(255) NOT NULL,
    product VARCHAR(255) NOT NULL,
    prod_ref VARCHAR(255) NULL,
    Qty_Box INT NOT NULL DEFAULT 0,
    unit_perbox INT NULL,
    qty_unit INT NOT NULL DEFAULT 0,
    total_qty INT NULL,
    Num_pal INT NOT NULL DEFAULT 1,
    mouvement VARCHAR(50) NOT NULL COMMENT 'A->M or M->A',
    statut VARCHAR(50) NOT NULL DEFAULT 'Envoyé' COMMENT 'Envoyé, Récéptionné, Annulé',
    comment TEXT NULL,
    created_by VARCHAR(255) NULL,
    updated_by VARCHAR(255) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_transfert_created_at (created_at),
    INDEX idx_transfert_statut (statut),
    INDEX idx_transfert_mouvement (mouvement),
    INDEX idx_transfert_num_comm (Num_comm)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
