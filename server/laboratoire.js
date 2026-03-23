function parsePositiveInt(value, fallback = 0) {
  const n = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function normalizeStatut(value) {
  const v = String(value || '').trim();
  if (v === 'En_cours') return 'En_cours';
  if (v === 'Cloture') return 'Cloture';
  return 'Planifier';
}

export function registerLaboratoireRoutes(app, pool, authenticateToken) {
  app.get('/api/laboratoire/ordres', authenticateToken, async (_req, res) => {
    try {
      const [rows] = await pool.execute(
        `SELECT id, produit, qty, instruction, statut, created_at AS createdAt, updated_at AS updatedAt
         FROM fabrication_labo
         ORDER BY created_at DESC`
      );
      res.json({ success: true, data: rows || [] });
    } catch (error) {
      console.error('Laboratoire get ordres error:', error);
      res.status(500).json({ success: false, error: 'Erreur lors du chargement des ordres.' });
    }
  });

  app.post('/api/laboratoire/ordres', authenticateToken, async (req, res) => {
    try {
      const produit = String(req.body?.produit || '').trim();
      const qty = parsePositiveInt(req.body?.qty, 0);
      const instruction = req.body?.instruction ? String(req.body.instruction).trim() : null;
      const statut = normalizeStatut(req.body?.statut);
      if (!produit || qty <= 0) {
        return res.status(400).json({ success: false, error: 'Produit et quantité valides requis.' });
      }
      const [result] = await pool.execute(
        'INSERT INTO fabrication_labo (produit, qty, instruction, statut) VALUES (?, ?, ?, ?)',
        [produit, qty, instruction, statut]
      );
      res.json({ success: true, id: result.insertId });
    } catch (error) {
      console.error('Laboratoire create ordre error:', error);
      res.status(500).json({ success: false, error: 'Erreur lors de la création de l’ordre.' });
    }
  });

  app.put('/api/laboratoire/ordres/:id', authenticateToken, async (req, res) => {
    try {
      const id = parsePositiveInt(req.params.id, 0);
      const produit = String(req.body?.produit || '').trim();
      const qty = parsePositiveInt(req.body?.qty, 0);
      const instruction = req.body?.instruction ? String(req.body.instruction).trim() : null;
      const statut = normalizeStatut(req.body?.statut);
      if (!id || !produit || qty <= 0) {
        return res.status(400).json({ success: false, error: 'Données invalides.' });
      }
      await pool.execute(
        `UPDATE fabrication_labo
         SET produit = ?, qty = ?, instruction = ?, statut = ?, updated_at = NOW()
         WHERE id = ?`,
        [produit, qty, instruction, statut, id]
      );
      res.json({ success: true });
    } catch (error) {
      console.error('Laboratoire update ordre error:', error);
      res.status(500).json({ success: false, error: 'Erreur lors de la mise à jour.' });
    }
  });

  app.delete('/api/laboratoire/ordres/:id', authenticateToken, async (req, res) => {
    try {
      const id = parsePositiveInt(req.params.id, 0);
      if (!id) return res.status(400).json({ success: false, error: 'ID invalide.' });
      await pool.execute('DELETE FROM fabrication_labo WHERE id = ?', [id]);
      res.json({ success: true });
    } catch (error) {
      console.error('Laboratoire delete ordre error:', error);
      res.status(500).json({ success: false, error: 'Erreur lors de la suppression.' });
    }
  });

  app.patch('/api/laboratoire/ordres/:id/statut', authenticateToken, async (req, res) => {
    try {
      const id = parsePositiveInt(req.params.id, 0);
      const statut = normalizeStatut(req.body?.statut);
      if (!id) return res.status(400).json({ success: false, error: 'ID invalide.' });
      await pool.execute('UPDATE fabrication_labo SET statut = ?, updated_at = NOW() WHERE id = ?', [statut, id]);
      res.json({ success: true });
    } catch (error) {
      console.error('Laboratoire set statut error:', error);
      res.status(500).json({ success: false, error: 'Erreur lors de la mise à jour du statut.' });
    }
  });

  app.get('/api/laboratoire/declarations', authenticateToken, async (_req, res) => {
    try {
      const [rows] = await pool.execute(
        `SELECT
          f.id, f.produit, f.qty, f.instruction, f.statut, f.created_at AS createdAt, f.updated_at AS updatedAt,
          d.id AS declarationId, d.qty AS declarationQty, d.lot AS declarationLot,
          d.date_debut AS declarationDateDebut, d.date_fin AS declarationDateFin,
          d.commentaire AS declarationCommentaire, d.created_at AS declarationCreatedAt
         FROM fabrication_labo f
         LEFT JOIN declaration_labo d ON d.of_id = f.id
         ORDER BY f.created_at DESC, d.created_at DESC`
      );

      const map = new Map();
      for (const row of rows || []) {
        if (!map.has(row.id)) {
          map.set(row.id, {
            id: row.id,
            produit: row.produit,
            qty: row.qty,
            instruction: row.instruction,
            statut: row.statut,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
            declarations: [],
          });
        }
        if (row.declarationId) {
          map.get(row.id).declarations.push({
            id: row.declarationId,
            qty: row.declarationQty,
            lot: row.declarationLot,
            dateDebut: row.declarationDateDebut,
            dateFin: row.declarationDateFin,
            commentaire: row.declarationCommentaire,
            createdAt: row.declarationCreatedAt,
            produit: row.produit,
          });
        }
      }

      res.json({ success: true, data: Array.from(map.values()) });
    } catch (error) {
      console.error('Laboratoire get declarations error:', error);
      res.status(500).json({ success: false, error: 'Erreur lors du chargement des déclarations.' });
    }
  });

  app.post('/api/laboratoire/declarations', authenticateToken, async (req, res) => {
    const connection = await pool.getConnection();
    try {
      const ofId = parsePositiveInt(req.body?.ofId, 0);
      const produit = String(req.body?.produit || '').trim();
      const qty = parsePositiveInt(req.body?.qty, 0);
      const lot = String(req.body?.lot || '').trim();
      const dateDebutRaw = req.body?.dateDebut;
      const dateFinRaw = req.body?.dateFin;
      const commentaireRaw = req.body?.commentaire;
      const dateDebut = dateDebutRaw ? String(dateDebutRaw).trim() : null;
      const dateFin = dateFinRaw ? String(dateFinRaw).trim() : null;
      const commentaire = commentaireRaw != null ? String(commentaireRaw).trim() : null;
      if (!ofId || !produit || qty <= 0 || !lot) {
        return res.status(400).json({ success: false, error: 'Données de déclaration invalides.' });
      }

      await connection.beginTransaction();
      const [result] = await connection.execute(
        `INSERT INTO declaration_labo (of_id, produit, qty, lot, date_debut, date_fin, commentaire)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [ofId, produit, qty, lot, dateDebut, dateFin, commentaire]
      );

      await connection.execute(
        `UPDATE fabrication_labo
         SET statut = CASE WHEN statut = 'Planifier' THEN 'En_cours' ELSE statut END,
             updated_at = NOW()
         WHERE id = ?`,
        [ofId]
      );
      await connection.commit();
      res.json({ success: true, id: result.insertId });
    } catch (error) {
      await connection.rollback();
      console.error('Laboratoire create declaration error:', error);
      res.status(500).json({ success: false, error: 'Erreur lors de l’ajout de déclaration.' });
    } finally {
      connection.release();
    }
  });

  app.get('/api/laboratoire/declarations/:ofId/historique', authenticateToken, async (req, res) => {
    try {
      const ofId = parsePositiveInt(req.params.ofId, 0);
      if (!ofId) return res.status(400).json({ success: false, error: 'OF invalide.' });
      const [rows] = await pool.execute(
        `SELECT id, produit, qty, lot, date_debut AS dateDebut, date_fin AS dateFin, commentaire, created_at AS createdAt
         FROM declaration_labo
         WHERE of_id = ?
         ORDER BY created_at DESC`,
        [ofId]
      );
      res.json({ success: true, data: rows || [] });
    } catch (error) {
      console.error('Laboratoire historique error:', error);
      res.status(500).json({ success: false, error: 'Erreur lors du chargement de l’historique.' });
    }
  });

  app.get('/api/laboratoire/declarations/all', authenticateToken, async (_req, res) => {
    try {
      const [rows] = await pool.execute(
        `SELECT
          d.id, d.of_id AS ofId, d.produit, d.qty, d.lot, d.date_debut AS dateDebut, d.date_fin AS dateFin,
          d.commentaire, d.created_at AS createdAt,
          f.id AS fabricationId, f.produit AS fabricationProduit, f.qty AS fabricationQty, f.statut AS fabricationStatut
         FROM declaration_labo d
         JOIN fabrication_labo f ON f.id = d.of_id
         ORDER BY d.created_at DESC`
      );
      res.json({ success: true, data: rows || [] });
    } catch (error) {
      console.error('Laboratoire all declarations error:', error);
      res.status(500).json({ success: false, error: 'Erreur lors du chargement des déclarations.' });
    }
  });

  app.get('/api/laboratoire/racks', authenticateToken, async (_req, res) => {
    try {
      const [rows] = await pool.execute(
        'SELECT id, name, stages, places, created_at AS createdAt FROM rack_labo ORDER BY created_at ASC'
      );
      res.json({ success: true, data: rows || [] });
    } catch (error) {
      console.error('Laboratoire get racks error:', error);
      res.status(500).json({ success: false, error: 'Erreur lors du chargement des racks.' });
    }
  });

  app.post('/api/laboratoire/racks', authenticateToken, async (req, res) => {
    try {
      const name = String(req.body?.name || '').trim();
      const stages = parsePositiveInt(req.body?.stages, 0);
      const places = parsePositiveInt(req.body?.places, 0);
      if (!name || !stages || !places) {
        return res.status(400).json({ success: false, error: 'Nom, stages et places requis.' });
      }
      const [result] = await pool.execute(
        'INSERT INTO rack_labo (name, stages, places) VALUES (?, ?, ?)',
        [name, stages, places]
      );
      res.json({ success: true, id: result.insertId });
    } catch (error) {
      console.error('Laboratoire create rack error:', error);
      res.status(500).json({ success: false, error: 'Erreur lors de la création du rack.' });
    }
  });

  app.delete('/api/laboratoire/racks/:id', authenticateToken, async (req, res) => {
    try {
      const id = parsePositiveInt(req.params.id, 0);
      if (!id) return res.status(400).json({ success: false, error: 'ID rack invalide.' });
      await pool.execute('DELETE FROM rack_labo WHERE id = ?', [id]);
      res.json({ success: true });
    } catch (error) {
      console.error('Laboratoire delete rack error:', error);
      res.status(500).json({ success: false, error: 'Erreur lors de la suppression du rack.' });
    }
  });

  app.get('/api/laboratoire/stock/full', authenticateToken, async (_req, res) => {
    try {
      const [rows] = await pool.execute(
        `SELECT
          s.id, s.rack_id AS rackId, s.stage, s.place, s.produit, s.qty, s.lot, s.declaration_id AS declarationId,
          s.created_at AS createdAt, s.updated_at AS updatedAt,
          r.name AS rackName, r.stages AS rackStages, r.places AS rackPlaces
         FROM stock_labo s
         JOIN rack_labo r ON r.id = s.rack_id
         ORDER BY s.rack_id ASC, s.stage ASC, s.place ASC`
      );
      res.json({ success: true, data: rows || [] });
    } catch (error) {
      console.error('Laboratoire get stock full error:', error);
      res.status(500).json({ success: false, error: 'Erreur lors du chargement du stock.' });
    }
  });

  app.get('/api/laboratoire/stock/stage', authenticateToken, async (req, res) => {
    try {
      const rackId = parsePositiveInt(req.query.rackId, 0);
      const stage = parsePositiveInt(req.query.stage, 0);
      if (!rackId || !stage) {
        return res.status(400).json({ success: false, error: 'rackId et stage requis.' });
      }
      const [rows] = await pool.execute(
        `SELECT id, rack_id AS rackId, stage, place, produit, qty, lot, declaration_id AS declarationId, created_at AS createdAt
         FROM stock_labo
         WHERE rack_id = ? AND stage = ?
         ORDER BY place ASC`,
        [rackId, stage]
      );
      res.json({ success: true, data: rows || [] });
    } catch (error) {
      console.error('Laboratoire get stage stock error:', error);
      res.status(500).json({ success: false, error: 'Erreur lors du chargement du stage.' });
    }
  });

  app.post('/api/laboratoire/stock/assign', authenticateToken, async (req, res) => {
    try {
      const rackId = parsePositiveInt(req.body?.rackId, 0);
      const stage = parsePositiveInt(req.body?.stage, 0);
      const place = parsePositiveInt(req.body?.place, 0);
      const produit = String(req.body?.produit || '').trim();
      const qty = parsePositiveInt(req.body?.qty, 0);
      const lot = String(req.body?.lot || '').trim();
      const declarationId = req.body?.declarationId ? parsePositiveInt(req.body.declarationId, 0) : null;
      if (!rackId || !stage || !place || !produit || qty <= 0 || !lot) {
        return res.status(400).json({ success: false, error: 'Données d’affectation invalides.' });
      }

      const [result] = await pool.execute(
        `INSERT INTO stock_labo (rack_id, stage, place, produit, qty, lot, declaration_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [rackId, stage, place, produit, qty, lot, declarationId]
      );
      res.json({ success: true, id: result.insertId });
    } catch (error) {
      if (error?.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ success: false, error: 'Cet emplacement est déjà occupé.' });
      }
      console.error('Laboratoire assign stock error:', error);
      res.status(500).json({ success: false, error: 'Erreur lors de l’affectation au stock.' });
    }
  });

  app.put('/api/laboratoire/stock/:stockId/move', authenticateToken, async (req, res) => {
    try {
      const stockId = parsePositiveInt(req.params.stockId, 0);
      const rackId = parsePositiveInt(req.body?.rackId, 0);
      const stage = parsePositiveInt(req.body?.stage, 0);
      const place = parsePositiveInt(req.body?.place, 0);
      if (!stockId || !rackId || !stage || !place) {
        return res.status(400).json({ success: false, error: 'Données de déplacement invalides.' });
      }
      await pool.execute(
        `UPDATE stock_labo
         SET rack_id = ?, stage = ?, place = ?, updated_at = NOW()
         WHERE id = ?`,
        [rackId, stage, place, stockId]
      );
      res.json({ success: true });
    } catch (error) {
      if (error?.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ success: false, error: 'Cet emplacement est déjà occupé.' });
      }
      console.error('Laboratoire move stock error:', error);
      res.status(500).json({ success: false, error: 'Erreur lors du déplacement.' });
    }
  });

  app.delete('/api/laboratoire/stock/:stockId', authenticateToken, async (req, res) => {
    try {
      const stockId = parsePositiveInt(req.params.stockId, 0);
      if (!stockId) {
        return res.status(400).json({ success: false, error: 'ID stock invalide.' });
      }
      await pool.execute('DELETE FROM stock_labo WHERE id = ?', [stockId]);
      res.json({ success: true });
    } catch (error) {
      console.error('Laboratoire delete stock error:', error);
      res.status(500).json({ success: false, error: 'Erreur lors de la suppression.' });
    }
  });
}

