-- Rebut Hors Production: scrap / defects outside normal production process
CREATE TABLE IF NOT EXISTS rebut_hors_prod (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  produit VARCHAR(255) NOT NULL,
  composant VARCHAR(255) NOT NULL,
  qty INT NOT NULL,
  defaut VARCHAR(255) NOT NULL,
  comment TEXT DEFAULT NULL,
  created_by VARCHAR(255) DEFAULT NULL,
  demandeur VARCHAR(255) NOT NULL,
  status BOOLEAN NOT NULL DEFAULT TRUE COMMENT 'true=unlocked, false=locked/validated',
  updated_by VARCHAR(255) DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_rebut_hors_prod_status (status),
  INDEX idx_rebut_hors_prod_created_at (created_at),
  INDEX idx_rebut_hors_prod_produit (produit)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

