-- Allow multiple stock rows in the same rack/stage/place.
-- The UI should display separate rows instead of merged data.
-- Create a dedicated index for rack_id so dropping the unique composite key
-- does not break the fk_stock_labo_rack foreign key requirement.
CREATE INDEX idx_stock_labo_rack_id
  ON stock_labo (rack_id);

ALTER TABLE stock_labo
  DROP INDEX uq_stock_labo_rack_stage_place;

CREATE INDEX idx_stock_labo_rack_stage_place
  ON stock_labo (rack_id, stage, place);
