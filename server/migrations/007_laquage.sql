-- Laquage: production orders, declarations, rebuts (perfume bottle coating workshop)

-- TABLE 1: laquage (production orders)
CREATE TABLE IF NOT EXISTS laquage (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ordre INT NULL,
  client VARCHAR(255) NOT NULL,
  commande VARCHAR(255) NOT NULL,
  OFID VARCHAR(20) NOT NULL,
  designation VARCHAR(500) NOT NULL,
  date_production DATE NULL,
  quantite_planifie INT NOT NULL DEFAULT 1,
  status VARCHAR(50) NOT NULL DEFAULT 'Planifié',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_laquage_ofid (OFID),
  INDEX idx_laquage_status (status),
  INDEX idx_laquage_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- TABLE 2: declarations_laquage (production declarations per order)
CREATE TABLE IF NOT EXISTS declarations_laquage (
  id INT AUTO_INCREMENT PRIMARY KEY,
  laquage_id INT NOT NULL,
  quantite_fabriquee INT NOT NULL DEFAULT 0,
  `day` DATE NULL,
  heure_debut VARCHAR(5) NULL,
  heure_fin VARCHAR(5) NULL,
  commentaire TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (laquage_id) REFERENCES laquage(id) ON DELETE CASCADE,
  INDEX idx_declarations_laquage_laquage_id (laquage_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- TABLE 3: rebut_laquage (scrap/reject declarations)
CREATE TABLE IF NOT EXISTS rebut_laquage (
  id INT AUTO_INCREMENT PRIMARY KEY,
  OFID VARCHAR(20) NOT NULL,
  date_declaration DATE NOT NULL,
  quantite INT NOT NULL DEFAULT 1,
  composant VARCHAR(500) NOT NULL,
  defaut VARCHAR(100) NOT NULL,
  commentaire TEXT NULL,
  status TINYINT(1) NOT NULL DEFAULT 1,
  updated_by VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_rebut_laquage_ofid (OFID),
  INDEX idx_rebut_laquage_date (date_declaration)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
