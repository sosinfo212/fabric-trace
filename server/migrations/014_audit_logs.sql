-- Migration 016: Audit Logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     VARCHAR(36)  DEFAULT NULL,
  user_email  VARCHAR(255) DEFAULT NULL,
  action      ENUM('CREATE','UPDATE','DELETE') NOT NULL,
  table_name  VARCHAR(100) NOT NULL,
  record_id   VARCHAR(100) DEFAULT NULL,
  new_data    JSON         DEFAULT NULL,
  ip_address  VARCHAR(45)  DEFAULT NULL,
  endpoint    VARCHAR(500) DEFAULT NULL,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_action     (action),
  INDEX idx_table_name (table_name),
  INDEX idx_user_id    (user_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
