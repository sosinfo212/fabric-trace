CREATE TABLE IF NOT EXISTS fabrication_labo (
  id INT AUTO_INCREMENT PRIMARY KEY,
  produit VARCHAR(255) NOT NULL,
  qty INT NOT NULL,
  instruction TEXT NULL,
  statut ENUM('Planifier', 'En_cours', 'Cloture') NOT NULL DEFAULT 'Planifier',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS declaration_labo (
  id INT AUTO_INCREMENT PRIMARY KEY,
  of_id INT NOT NULL,
  produit VARCHAR(255) NOT NULL,
  qty INT NOT NULL,
  lot VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_declaration_labo_of
    FOREIGN KEY (of_id) REFERENCES fabrication_labo(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS rack_labo (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  stages INT NOT NULL,
  places INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stock_labo (
  id INT AUTO_INCREMENT PRIMARY KEY,
  rack_id INT NOT NULL,
  stage INT NOT NULL,
  place INT NOT NULL,
  produit VARCHAR(255) NOT NULL,
  qty INT NOT NULL,
  lot VARCHAR(255) NOT NULL,
  declaration_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT uq_stock_labo_rack_stage_place UNIQUE (rack_id, stage, place),
  CONSTRAINT fk_stock_labo_rack
    FOREIGN KEY (rack_id) REFERENCES rack_labo(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_stock_labo_declaration
    FOREIGN KEY (declaration_id) REFERENCES declaration_labo(id)
    ON DELETE SET NULL
);
