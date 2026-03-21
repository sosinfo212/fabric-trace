import XLSX from 'xlsx';
import PDFDocument from 'pdfkit';

const TYPE_LABELS = {
  laquage: 'Laquage',
  hors_prod: 'Hors Production',
  serigraphie: 'Sérigraphie',
  conformity: 'Atelier',
};

function normalizePositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseBoolean(value, fallback = false) {
  if (value == null) return fallback;
  const s = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(s)) return true;
  if (['0', 'false', 'no', 'off'].includes(s)) return false;
  return fallback;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeCsvValue(value) {
  if (value == null) return '';
  const stringValue = String(value);
  if (/[",\n;]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function buildUnifiedBaseQuery() {
  return `
    SELECT
      CAST(rl.id AS CHAR) AS source_id,
      rl.id AS sort_id,
      rl.OFID AS OFID,
      rl.date_declaration AS date_declaration,
      COALESCE(rl.quantite, 0) AS quantity,
      COALESCE(rl.composant, 'N/A') AS component,
      COALESCE(rl.defaut, 'N/A') AS defect,
      rl.commentaire AS comment,
      'laquage' AS rebut_type,
      'rebut_laquage' AS source_table,
      COALESCE(rl.status, 1) AS status,
      NULL AS created_by,
      rl.updated_by AS updated_by,
      COALESCE(fo.prod_name, p.product_name, 'N/A') AS produit,
      fo.chaine_id AS chaine_id,
      ch.num_chaine AS chaine_num
    FROM rebut_laquage rl
    LEFT JOIN fab_orders fo ON fo.of_id = rl.OFID
    LEFT JOIN products p ON p.id = fo.product_id
    LEFT JOIN chaines ch ON ch.id = fo.chaine_id

    UNION ALL

    SELECT
      CAST(rhp.id AS CHAR) AS source_id,
      rhp.id AS sort_id,
      NULL AS OFID,
      rhp.created_at AS date_declaration,
      COALESCE(rhp.qty, 0) AS quantity,
      COALESCE(rhp.composant, 'N/A') AS component,
      COALESCE(rhp.defaut, 'N/A') AS defect,
      rhp.comment AS comment,
      'hors_prod' AS rebut_type,
      'rebut_hors_prod' AS source_table,
      COALESCE(rhp.status, 1) AS status,
      rhp.created_by AS created_by,
      rhp.updated_by AS updated_by,
      COALESCE(rhp.produit, 'N/A') AS produit,
      NULL AS chaine_id,
      NULL AS chaine_num
    FROM rebut_hors_prod rhp

    UNION ALL

    SELECT
      CAST(sr.id AS CHAR) AS source_id,
      sr.id AS sort_id,
      sr.OFID AS OFID,
      sr.date_declaration AS date_declaration,
      COALESCE(sr.quantite, 0) AS quantity,
      COALESCE(pc.component_name, CAST(sr.composant_id AS CHAR), 'N/A') AS component,
      COALESCE(dl.label, CAST(sr.defaut_id AS CHAR), 'N/A') AS defect,
      sr.commentaire AS comment,
      'serigraphie' AS rebut_type,
      'serigraphie_rebuts' AS source_table,
      COALESCE(sr.status, 1) AS status,
      NULL AS created_by,
      sr.updated_by AS updated_by,
      COALESCE(fo.prod_name, p.product_name, 'N/A') AS produit,
      fo.chaine_id AS chaine_id,
      ch.num_chaine AS chaine_num
    FROM serigraphie_rebuts sr
    LEFT JOIN product_components pc ON pc.id = sr.composant_id
    LEFT JOIN defaut_list dl ON dl.id = sr.defaut_id
    LEFT JOIN fab_orders fo ON fo.of_id = sr.OFID
    LEFT JOIN products p ON p.id = fo.product_id
    LEFT JOIN chaines ch ON ch.id = fo.chaine_id

    UNION ALL

    SELECT
      CAST(cd.id AS CHAR) AS source_id,
      0 AS sort_id,
      cd.OFID AS OFID,
      cd.created_at AS date_declaration,
      COALESCE(cd.qty_nc, 0) AS quantity,
      COALESCE(cd.component_name, 'N/A') AS component,
      COALESCE(dl.label, 'N/A') AS defect,
      cd.comment AS comment,
      'conformity' AS rebut_type,
      'conformity_details' AS source_table,
      1 AS status,
      NULL AS created_by,
      NULL AS updated_by,
      COALESCE(fo.prod_name, p.product_name, 'N/A') AS produit,
      fo.chaine_id AS chaine_id,
      ch.num_chaine AS chaine_num
    FROM conformity_details cd
    LEFT JOIN defaut_list dl ON dl.id = cd.defect_id
    LEFT JOIN fab_orders fo ON fo.of_id = cd.OFID
    LEFT JOIN products p ON p.id = fo.product_id
    LEFT JOIN chaines ch ON ch.id = fo.chaine_id
  `;
}

function buildWhereClause(filters, params) {
  const clauses = [];

  if (!filters.showLocked) {
    clauses.push('COALESCE(u.status, 1) = 1');
  }
  if (filters.startDate) {
    clauses.push('u.date_declaration >= ?');
    params.push(`${filters.startDate} 00:00:00`);
  }
  if (filters.endDate) {
    clauses.push('u.date_declaration <= ?');
    params.push(`${filters.endDate} 23:59:59`);
  }
  if (filters.rebutType) {
    clauses.push('u.rebut_type = ?');
    params.push(filters.rebutType);
  }
  if (filters.chaineId) {
    clauses.push('u.chaine_id = ?');
    params.push(filters.chaineId);
  }
  if (filters.bottleFilter) {
    clauses.push('(LOWER(u.component) LIKE ? OR LOWER(u.component) LIKE ?)');
    params.push('bottle%');
    params.push('%glass bottle%');
  }
  if (filters.searchText) {
    clauses.push(`(
      LOWER(COALESCE(u.OFID, '')) LIKE ?
      OR LOWER(COALESCE(u.produit, '')) LIKE ?
      OR LOWER(COALESCE(u.component, '')) LIKE ?
      OR LOWER(COALESCE(u.defect, '')) LIKE ?
      OR LOWER(COALESCE(u.comment, '')) LIKE ?
    )`);
    const like = `%${filters.searchText.toLowerCase()}%`;
    params.push(like, like, like, like, like);
  }

  return clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
}

async function getUnifiedRows(pool, options) {
  const params = [];
  const where = buildWhereClause(options.filters, params);
  const base = buildUnifiedBaseQuery();

  const sortColumnMap = {
    date_declaration: 'u.date_declaration',
    OFID: 'u.OFID',
    produit: 'u.produit',
    quantity: 'u.quantity',
    component: 'u.component',
    defect: 'u.defect',
    rebut_type: 'u.rebut_type',
  };

  const sortColumn = sortColumnMap[options.sortColumn] ?? 'u.date_declaration';
  const sortDirection = options.sortDirection === 'asc' ? 'ASC' : 'DESC';

  const [countRows] = await pool.execute(
    `SELECT COUNT(*) AS total FROM (${base}) u ${where}`,
    params
  );
  const total = Number(countRows?.[0]?.total ?? 0);

  let dataQuery = `
    SELECT
      u.source_id,
      u.sort_id,
      u.OFID,
      u.date_declaration,
      u.quantity,
      u.component,
      u.defect,
      u.comment,
      u.rebut_type,
      u.source_table,
      u.status,
      u.created_by,
      u.updated_by,
      u.produit,
      u.chaine_id,
      u.chaine_num
    FROM (${base}) u
    ${where}
    ORDER BY ${sortColumn} ${sortDirection}, u.sort_id DESC
  `;

  const queryParams = [...params];
  if (options.pageSize !== -1) {
    const safePageSize = normalizePositiveInt(options.pageSize, 25);
    const safeOffset = Math.max(0, (normalizePositiveInt(options.page, 1) - 1) * safePageSize);
    dataQuery += ` LIMIT ${safePageSize} OFFSET ${safeOffset}`;
  }

  const [rows] = await pool.execute(dataQuery, queryParams);
  return {
    total,
    rows: (rows || []).map((r) => ({
      uniqueId: `${r.rebut_type}:${r.source_id}`,
      sourceId: String(r.source_id),
      OFID: r.OFID,
      dateDeclaration: r.date_declaration,
      quantity: Number(r.quantity || 0),
      component: r.component,
      defect: r.defect,
      comment: r.comment,
      rebutType: r.rebut_type,
      sourceTable: r.source_table,
      status: r.status == null ? true : !!r.status,
      createdBy: r.created_by,
      updatedBy: r.updated_by,
      produit: r.produit,
      chaineId: r.chaine_id,
      chaineNum: r.chaine_num,
    })),
  };
}

async function getComponentCodeMap(pool, components) {
  const values = [...new Set((components || []).map((s) => String(s || '').trim()).filter(Boolean))];
  if (values.length === 0) return new Map();

  const map = new Map();

  // Resolve actual schema at runtime; different deployments expose different columns.
  const [columnsRows] = await pool.execute(
    `
      SELECT TABLE_NAME AS tableName, COLUMN_NAME AS columnName
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME IN ('products', 'product_components')
    `
  );

  const has = (tableName, columnName) =>
    (columnsRows || []).some((r) => r.tableName === tableName && r.columnName === columnName);

  const candidates = [];
  if (has('products', 'component_name') && has('products', 'component_code')) {
    candidates.push({
      sql: `SELECT component_name AS componentName, component_code AS componentCode
            FROM products
            WHERE component_name IN (${values.map(() => '?').join(',')})`,
      params: values,
    });
  }
  if (has('product_components', 'component_name') && has('product_components', 'component_code')) {
    candidates.push({
      sql: `SELECT component_name AS componentName, component_code AS componentCode
            FROM product_components
            WHERE component_name IN (${values.map(() => '?').join(',')})`,
      params: values,
    });
  }

  for (const candidate of candidates) {
    try {
      const [rows] = await pool.execute(candidate.sql, candidate.params);
      for (const row of rows || []) {
        const key = String(row.componentName || '').trim().toLowerCase();
        if (!key || map.has(key)) continue;
        map.set(key, row.componentCode || 'N/A');
      }
    } catch (err) {
      // Skip invalid candidate query for heterogeneous DB schemas.
      console.warn('Unified rebut component code lookup skipped:', err?.message || err);
    }
  }

  return map;
}

function groupForExcel(rows) {
  const grouped = new Map();
  for (const row of rows) {
    const key = String(row.component || 'N/A').trim().toLowerCase();
    if (!grouped.has(key)) {
      grouped.set(key, { ...row });
      continue;
    }
    const existing = grouped.get(key);
    existing.quantity = Number(existing.quantity || 0) + Number(row.quantity || 0);
  }
  return Array.from(grouped.values());
}

async function resolveCreatorsByOfid(pool, rows) {
  const ofids = [...new Set(
    (rows || [])
      .filter((row) => !row.createdBy && row.OFID)
      .map((row) => String(row.OFID).trim())
      .filter(Boolean)
  )];
  if (ofids.length === 0) return new Map();

  try {
    const [resolvedRows] = await pool.execute(
      `
        SELECT
          fo.of_id AS ofid,
          COALESCE(p.full_name, '') AS creator_name
        FROM fab_orders fo
        LEFT JOIN chaines ch ON ch.id = fo.chaine_id
        LEFT JOIN profiles p ON p.id = ch.responsable_qlty_id
        WHERE fo.of_id IN (${ofids.map(() => '?').join(',')})
      `,
      ofids
    );
    const creatorMap = new Map();
    for (const row of resolvedRows || []) {
      const key = String(row.ofid || '').trim();
      if (!key || creatorMap.has(key)) continue;
      creatorMap.set(key, String(row.creator_name || '').trim());
    }
    return creatorMap;
  } catch {
    return new Map();
  }
}

async function resolvePrintedByFullName(pool, userId, fallback) {
  if (!userId) return fallback || 'Utilisateur inconnu';
  try {
    const [rows] = await pool.execute(
      'SELECT COALESCE(full_name, ?) AS full_name FROM profiles WHERE id = ? LIMIT 1',
      [fallback || 'Utilisateur inconnu', userId]
    );
    return rows?.[0]?.full_name || fallback || 'Utilisateur inconnu';
  } catch {
    return fallback || 'Utilisateur inconnu';
  }
}

async function resolveChaineLabel(pool, chaineId) {
  if (!chaineId) return 'Toutes les chaînes';
  try {
    const [rows] = await pool.execute(
      'SELECT num_chaine FROM chaines WHERE id = ? LIMIT 1',
      [chaineId]
    );
    if (rows?.[0]?.num_chaine == null) return `ID ${chaineId}`;
    return `Chaîne ${rows[0].num_chaine}`;
  } catch {
    return `ID ${chaineId}`;
  }
}

async function buildPrintPdfBuffer(pool, rows, filters, printedBy) {
  const creatorMap = await resolveCreatorsByOfid(pool, rows);
  const rowsForPrint = rows.map((row) => ({
    ...row,
    createdBy: row.createdBy || creatorMap.get(String(row.OFID || '').trim()) || '',
  }));

  const chaineLabel = await resolveChaineLabel(pool, filters.chaineId);
  const typeLabel = filters.rebutType
    ? (TYPE_LABELS[filters.rebutType] || filters.rebutType)
    : 'Tous les types';
  const printedAt = new Date().toLocaleString('fr-FR');

  return await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 15, bufferPages: true });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const contentLeft = 20;
    const contentRight = pageWidth - 20;
    const headerTop = 12;
    const headerHeight = 48;
    const tableTop = 78;
    // Keep footer safely inside printable area to avoid implicit page breaks.
    const footerY = pageHeight - 40;
    const rowHeight = 22;

    const colWidths = [95, 245, 80, 130];
    const colX = [
      contentLeft,
      contentLeft + colWidths[0],
      contentLeft + colWidths[0] + colWidths[1],
      contentLeft + colWidths[0] + colWidths[1] + colWidths[2],
    ];

    const drawHeader = () => {
      doc.save();
      doc.rect(contentLeft, headerTop - 2, contentRight - contentLeft, headerHeight).fill('#f8fafc');
      doc.restore();
      doc
        .font('Helvetica-Bold')
        .fontSize(10)
        .fillColor('#111111')
        .text(`Chaîne : ${chaineLabel} | Type : ${typeLabel}`, contentLeft, headerTop, {
          width: contentRight - contentLeft,
          align: 'left',
        });
      doc
        .font('Helvetica-Bold')
        .fontSize(10)
        .fillColor('#111111')
        .text(
          `Imprimé par : ${printedBy || 'Utilisateur inconnu'} — Date d'impression : ${printedAt}`,
          contentLeft,
          headerTop + 17,
          { width: contentRight - contentLeft, align: 'left' }
        );
      doc.moveTo(contentLeft, headerTop + headerHeight).lineTo(contentRight, headerTop + headerHeight).stroke('#dee2e6');
    };

    const drawTableHeader = (y) => {
      const headers = ['Date', 'Composant', 'Quantité', 'Défaut'];
      doc.save();
      doc.rect(contentLeft, y, contentRight - contentLeft, rowHeight).fill('#4472C4');
      doc.restore();

      for (let i = 0; i < headers.length; i += 1) {
        doc.rect(colX[i], y, colWidths[i], rowHeight).stroke('#333333');
        doc
          .font('Helvetica-Bold')
          .fontSize(9)
          .fillColor('#FFFFFF')
          .text(headers[i], colX[i], y + 7, {
            width: colWidths[i],
            align: 'center',
            lineBreak: false,
            ellipsis: true,
            height: rowHeight - 4,
          });
      }
      return y + rowHeight;
    };

    const cleanCellText = (value) =>
      String(value ?? '')
        .replace(/\s*\n+\s*/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim();

    const drawRow = (row, y) => {
      const values = [
        cleanCellText(row.dateDeclaration ? new Date(row.dateDeclaration).toLocaleDateString('fr-FR') : '—'),
        cleanCellText(row.component || 'N/A'),
        cleanCellText(String(row.quantity ?? 0)),
        cleanCellText(row.defect || 'N/A'),
      ];
      for (let i = 0; i < values.length; i += 1) {
        doc.rect(colX[i], y, colWidths[i], rowHeight).stroke('#333333');
        doc
          .font('Helvetica')
          .fontSize(9)
          .fillColor('#111111')
          .text(values[i], colX[i] + 2, y + 7, {
            width: colWidths[i] - 4,
            align: 'center',
            lineBreak: false,
            ellipsis: true,
            height: rowHeight - 4,
          });
      }
      return y + rowHeight;
    };

    drawHeader();
    let y = drawTableHeader(tableTop);
    const maxY = footerY - 8;

    for (const row of rowsForPrint) {
      if (y + rowHeight > maxY) {
        doc.addPage();
        drawHeader();
        y = drawTableHeader(tableTop);
      }
      y = drawRow(row, y);
    }

    const pageRange = doc.bufferedPageRange();
    for (let i = pageRange.start; i < pageRange.start + pageRange.count; i += 1) {
      doc.switchToPage(i);
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#111111')
        .text('Signature : ____________________', contentLeft, footerY, {
          width: (contentRight - contentLeft) / 2,
          align: 'left',
          lineBreak: false,
        });
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#111111')
        .text(`Page ${i - pageRange.start + 1} / ${pageRange.count}`, contentLeft, footerY, {
          width: contentRight - contentLeft,
          align: 'right',
          lineBreak: false,
        });
    }

    doc.end();
  });
}

async function validateByType(pool, userName, rebutType, sourceId) {
  if (rebutType === 'conformity') {
    return { ok: false, message: 'Les entrées Atelier ne sont pas validables depuis ce rapport.' };
  }

  const tableMap = {
    laquage: 'rebut_laquage',
    hors_prod: 'rebut_hors_prod',
    serigraphie: 'serigraphie_rebuts',
  };
  const table = tableMap[rebutType];
  if (!table) {
    return { ok: false, message: `Type invalide: ${rebutType}` };
  }

  const [result] = await pool.execute(
    `UPDATE ${table}
     SET status = 0, updated_by = ?, updated_at = NOW()
     WHERE id = ? AND COALESCE(status, 1) = 1`,
    [userName, sourceId]
  );

  if ((result?.affectedRows ?? 0) > 0) return { ok: true, message: 'Entrée validée.' };
  return { ok: false, message: 'Entrée introuvable ou déjà validée.' };
}

export function registerUnifiedRebutReportRoutes(app, pool, authenticateToken) {
  app.get('/api/components/waste-report/types', authenticateToken, (_req, res) => {
    res.json({
      data: [
        { value: '', label: 'Tous les types' },
        { value: 'conformity', label: 'Atelier' },
        { value: 'serigraphie', label: 'Sérigraphie' },
        { value: 'laquage', label: 'Laquage' },
        { value: 'hors_prod', label: 'Hors Production' },
      ],
    });
  });

  app.get('/api/components/waste-report/chaines', authenticateToken, async (_req, res) => {
    try {
      const [rows] = await pool.execute(
        'SELECT id, num_chaine FROM chaines ORDER BY num_chaine ASC'
      );
      res.json({ data: rows || [] });
    } catch (err) {
      console.error('Unified rebut chaines error:', err);
      res.status(500).json({ error: 'Erreur lors du chargement des chaînes.', data: [] });
    }
  });

  app.get('/api/components/waste-report/data', authenticateToken, async (req, res) => {
    try {
      const page = normalizePositiveInt(req.query.page, 1);
      const pageSizeRaw = Number.parseInt(String(req.query.pageSize ?? '25'), 10);
      const pageSize = pageSizeRaw === -1 ? -1 : Math.min(Math.max(pageSizeRaw || 25, 1), 200);

      const filters = {
        startDate: req.query.startDate ? String(req.query.startDate) : '',
        endDate: req.query.endDate ? String(req.query.endDate) : '',
        rebutType: req.query.rebutType ? String(req.query.rebutType) : '',
        chaineId: req.query.chaineId ? String(req.query.chaineId) : '',
        bottleFilter: parseBoolean(req.query.bottleFilter, false),
        searchText: req.query.searchText ? String(req.query.searchText) : '',
        showLocked: parseBoolean(req.query.showLocked, false),
      };

      const { rows, total } = await getUnifiedRows(pool, {
        page,
        pageSize,
        sortColumn: req.query.sortColumn ? String(req.query.sortColumn) : 'date_declaration',
        sortDirection: req.query.sortDirection ? String(req.query.sortDirection) : 'desc',
        filters,
      });

      res.json({
        data: rows,
        recordsTotal: total,
        recordsFiltered: total,
        page,
        pageSize,
      });
    } catch (err) {
      console.error('Unified rebut data error:', err);
      res.status(500).json({
        error: 'Erreur lors du chargement du rapport rebut.',
        data: [],
        recordsTotal: 0,
        recordsFiltered: 0,
      });
    }
  });

  app.post('/api/components/waste-report/validate-single', authenticateToken, async (req, res) => {
    try {
      const sourceId = req.body?.id != null ? String(req.body.id) : '';
      const rebutType = req.body?.type != null ? String(req.body.type) : '';
      if (!sourceId || !rebutType) {
        return res.status(400).json({ success: false, message: 'Paramètres id/type requis.' });
      }

      const userName = req.user?.name || req.user?.email || 'system';
      const result = await validateByType(pool, userName, rebutType, sourceId);
      if (!result.ok) {
        return res.status(400).json({ success: false, message: result.message });
      }
      res.json({ success: true, message: result.message });
    } catch (err) {
      console.error('Unified rebut validate-single error:', err);
      res.status(500).json({ success: false, message: 'Erreur lors de la validation.' });
    }
  });

  app.post('/api/components/waste-report/bulk-validate', authenticateToken, async (req, res) => {
    const connection = await pool.getConnection();
    try {
      const entries = Array.isArray(req.body?.entries) ? req.body.entries : [];
      if (entries.length === 0) {
        return res.status(400).json({ success: false, message: 'Aucune entrée à valider.', validated: 0, errors: [] });
      }
      const userName = req.user?.name || req.user?.email || 'system';
      const errors = [];
      let validated = 0;

      await connection.beginTransaction();
      for (const entry of entries) {
        const sourceId = entry?.id != null ? String(entry.id) : '';
        const rebutType = entry?.type != null ? String(entry.type) : '';
        if (!sourceId || !rebutType) {
          errors.push('Entrée invalide ignorée.');
          continue;
        }
        const result = await validateByType(connection, userName, rebutType, sourceId);
        if (result.ok) validated += 1;
        else errors.push(`${rebutType}:${sourceId} - ${result.message}`);
      }
      await connection.commit();

      res.json({
        success: true,
        validated,
        errors,
        message: `${validated} entrée(s) validée(s).`,
      });
    } catch (err) {
      await connection.rollback();
      console.error('Unified rebut bulk-validate error:', err);
      res.status(500).json({ success: false, message: 'Erreur lors de la validation en masse.', validated: 0, errors: [] });
    } finally {
      connection.release();
    }
  });

  app.get('/api/components/waste-report/export-all', authenticateToken, async (req, res) => {
    try {
      const format = String(req.query.format || 'excel').toLowerCase();
      const filters = {
        startDate: req.query.startDate ? String(req.query.startDate) : '',
        endDate: req.query.endDate ? String(req.query.endDate) : '',
        rebutType: req.query.rebutType ? String(req.query.rebutType) : '',
        chaineId: req.query.chaineId ? String(req.query.chaineId) : '',
        bottleFilter: parseBoolean(req.query.bottleFilter, false),
        searchText: req.query.searchText ? String(req.query.searchText) : '',
        showLocked: parseBoolean(req.query.showLocked, false),
      };

      const { rows } = await getUnifiedRows(pool, {
        page: 1,
        pageSize: -1,
        sortColumn: 'date_declaration',
        sortDirection: 'desc',
        filters,
      });

      if (format === 'copy') {
        const header = ['Type', 'Date', 'OFID', 'Produit', 'Quantité', 'Composant', 'Défaut', 'Commentaire'];
        const lines = [header.map(escapeCsvValue).join(';')];
        for (const row of rows) {
          lines.push([
            TYPE_LABELS[row.rebutType] || row.rebutType,
            row.dateDeclaration ? new Date(row.dateDeclaration).toISOString().slice(0, 10) : '',
            row.OFID || 'N/A',
            row.produit || 'N/A',
            row.quantity,
            row.component || 'N/A',
            row.defect || 'N/A',
            row.comment || '',
          ].map(escapeCsvValue).join(';'));
        }
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        return res.send(lines.join('\n'));
      }

      if (format === 'print') {
        const fallbackName = req.user?.full_name || 'Utilisateur inconnu';
        const printedBy = await resolvePrintedByFullName(pool, req.user?.id, fallbackName);
        const pdfBuffer = await buildPrintPdfBuffer(pool, rows, filters, printedBy);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="rebuts_unifies_${Date.now()}.pdf"`);
        return res.send(pdfBuffer);
      }

      // Excel by default: grouped by component with qty sum
      const grouped = groupForExcel(rows);
      const codeMap = await getComponentCodeMap(pool, grouped.map((r) => r.component));
      const excelRows = grouped.map((row) => {
        const codeKey = String(row.component || '').trim().toLowerCase();
        const reference = codeMap.get(codeKey) || 'N/A';
        return {
          Type: TYPE_LABELS[row.rebutType] || row.rebutType,
          Date: row.dateDeclaration ? new Date(row.dateDeclaration).toISOString().slice(0, 10) : '',
          Reference: reference,
          Quantité: row.quantity,
          Composant: row.component || 'N/A',
          Défaut: row.defect || 'N/A',
          Commentaire: row.comment || '',
          Statut: row.status ? 'Déverrouillé' : 'Verrouillé',
          'Créé par': row.createdBy || '',
          'Modifié par': row.updatedBy || '',
        };
      });

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([
        ['Rapport rebut unifié'],
        [`Généré le: ${new Date().toLocaleString('fr-FR')}`],
        [],
      ]);
      XLSX.utils.sheet_add_json(ws, excelRows, { origin: 'A4' });

      const headerRow = 4;
      const lastRow = headerRow + excelRows.length;
      ws['!cols'] = [
        { wch: 18 }, // Type
        { wch: 12 }, // Date
        { wch: 16 }, // Reference
        { wch: 10 }, // Quantité
        { wch: 36 }, // Composant
        { wch: 28 }, // Défaut
        { wch: 42 }, // Commentaire
        { wch: 14 }, // Statut
        { wch: 20 }, // Créé par
        { wch: 20 }, // Modifié par
      ];
      ws['!autofilter'] = { ref: `A${headerRow}:J${Math.max(headerRow, lastRow)}` };

      XLSX.utils.book_append_sheet(wb, ws, 'Rapport');
      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xls' });

      res.setHeader('Content-Type', 'application/vnd.ms-excel');
      res.setHeader('Content-Disposition', `attachment; filename="rebuts_unifies_${Date.now()}.xls"`);
      res.send(buffer);
    } catch (err) {
      console.error('Unified rebut export error:', err);
      res.status(500).json({ error: 'Erreur lors de l’export.' });
    }
  });
}

