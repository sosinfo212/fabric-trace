-- Component Changes (Changement de composants): track component swaps in fabrication orders
CREATE TABLE IF NOT EXISTS component_changes (
  id BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  of_id VARCHAR(255) NOT NULL,
  commande VARCHAR(255) NOT NULL,
  nom_du_produit VARCHAR(255) NOT NULL,
  original_product_id VARCHAR(255) NOT NULL COMMENT 'component_code from product_components',
  new_product_id VARCHAR(255) NOT NULL COMMENT 'component_code from product_components',
  qty INT NOT NULL DEFAULT 0,
  status VARCHAR(255) DEFAULT NULL,
  comment TEXT DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_component_changes_of_id (of_id),
  INDEX idx_component_changes_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
