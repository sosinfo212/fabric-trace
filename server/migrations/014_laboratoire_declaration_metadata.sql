ALTER TABLE declaration_labo
  ADD COLUMN date_debut DATETIME NULL AFTER lot,
  ADD COLUMN date_fin DATETIME NULL AFTER date_debut,
  ADD COLUMN commentaire TEXT NULL AFTER date_fin;

