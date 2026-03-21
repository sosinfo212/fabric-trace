-- Fabrication table (declaration / production records)
CREATE TABLE IF NOT EXISTS fabrication (
    id BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    OFID VARCHAR(255) NOT NULL,
    Lot_Jus VARCHAR(255) DEFAULT NULL,
    Valid_date DATETIME DEFAULT NULL,
    effectif_Reel INT(11) DEFAULT NULL,
    date_fabrication DATETIME DEFAULT NULL,
    End_Fab_date DATETIME DEFAULT NULL,
    Pf_Qty INT(11) NOT NULL,
    Sf_Qty INT(11) NOT NULL,
    Set_qty INT(11) NOT NULL,
    Tester_qty INT(11) NOT NULL,
    Comment_chaine TEXT DEFAULT NULL,
    created_by VARCHAR(255) DEFAULT NULL,
    updated_by VARCHAR(255) DEFAULT NULL,
    created_at TIMESTAMP NULL DEFAULT NULL,
    updated_at TIMESTAMP NULL DEFAULT NULL,
    INDEX idx_fabrication_OFID (OFID),
    INDEX idx_fabrication_date_fabrication (date_fabrication)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
