-- Store date + time for Date Début / Date Fin (edit with time picker)
ALTER TABLE serigraphie_declaration
  MODIFY date_debut DATETIME NULL DEFAULT NULL,
  MODIFY date_fin   DATETIME NULL DEFAULT NULL;
