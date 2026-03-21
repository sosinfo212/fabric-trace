-- Déclaration Sérigraphie: declarations, quality lines, rebuts (waste)

-- TABLE 1: serigraphie_declaration
CREATE TABLE IF NOT EXISTS serigraphie_declaration (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  OFID        VARCHAR(255) DEFAULT NULL,
  commande    VARCHAR(255) DEFAULT NULL,
  product     VARCHAR(255) DEFAULT NULL,
  client      VARCHAR(255) DEFAULT NULL,
  date_debut  DATE DEFAULT NULL,
  date_fin    DATE DEFAULT NULL,
  qte_fab     INT NOT NULL DEFAULT 0,
  Mat_quality INT NOT NULL DEFAULT 0,
  Mat_prod    INT NOT NULL DEFAULT 0,
  Comment     TEXT,
  created_at  TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_serigraphie_declaration_OFID (OFID),
  INDEX idx_serigraphie_declaration_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- TABLE 2: seri_quality (quality control lines per declaration)
CREATE TABLE IF NOT EXISTS seri_quality (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  ofid            VARCHAR(255) NOT NULL,
  Component_code  VARCHAR(255) DEFAULT NULL,
  Component_name  VARCHAR(255) DEFAULT NULL,
  qty_nc          INT DEFAULT NULL,
  `default`       VARCHAR(255) DEFAULT NULL,
  comment         TEXT,
  created_at      TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_seri_quality_ofid (ofid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- TABLE 3: serigraphie_rebuts (waste/reject declarations)
CREATE TABLE IF NOT EXISTS serigraphie_rebuts (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  OFID             VARCHAR(255) NOT NULL,
  date_declaration DATE NOT NULL,
  quantite         INT NOT NULL,
  composant_id     CHAR(36) DEFAULT NULL,
  defaut_id        CHAR(36) DEFAULT NULL,
  commentaire      TEXT,
  status           TINYINT(1) NOT NULL DEFAULT 1,
  updated_by       VARCHAR(255) DEFAULT NULL,
  created_at       TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_serigraphie_rebuts_OFID (OFID),
  INDEX idx_serigraphie_rebuts_date (date_declaration),
  FOREIGN KEY (composant_id) REFERENCES product_components(id) ON DELETE SET NULL,
  FOREIGN KEY (defaut_id) REFERENCES defaut_list(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
