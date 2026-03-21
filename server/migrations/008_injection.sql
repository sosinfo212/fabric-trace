-- Injection module: production orders, fabrication declarations, scrap/defect declarations (perfume bottle injection workshop)

-- TABLE 1: Injection_table (ordre de fabrication)
CREATE TABLE IF NOT EXISTS Injection_table (
  `Of` VARCHAR(20) NOT NULL PRIMARY KEY,
  Designation VARCHAR(500) NOT NULL,
  Quantite INT NOT NULL DEFAULT 1,
  Date_planification DATETIME NOT NULL,
  user_name VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_injection_designation (Designation),
  INDEX idx_injection_date (Date_planification)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- TABLE 2: declaration_injection (fabrication declarations per OF)
CREATE TABLE IF NOT EXISTS declaration_injection (
  id INT AUTO_INCREMENT PRIMARY KEY,
  `Of` VARCHAR(20) NOT NULL,
  Designation VARCHAR(500) NOT NULL,
  Quantite INT NOT NULL DEFAULT 0,
  Machine VARCHAR(100) NOT NULL,
  num_moule INT NULL,
  nbr_empreinte INT NULL,
  Date_debut DATETIME NOT NULL,
  Date_fin DATETIME NOT NULL,
  effectif INT NOT NULL DEFAULT 1,
  username VARCHAR(255) NULL,
  commentaire TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`Of`) REFERENCES Injection_table(`Of`) ON DELETE CASCADE,
  INDEX idx_decl_inj_of (`Of`),
  INDEX idx_decl_inj_dates (Date_debut)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- TABLE 3: rebut_inj (scrap/defect declarations)
CREATE TABLE IF NOT EXISTS rebut_inj (
  id INT AUTO_INCREMENT PRIMARY KEY,
  `of` VARCHAR(20) NOT NULL,
  composant VARCHAR(500) NOT NULL,
  defaut VARCHAR(100) NOT NULL,
  cause VARCHAR(100) NOT NULL,
  quantite INT NOT NULL DEFAULT 1,
  username VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_rebut_inj_of (`of`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
