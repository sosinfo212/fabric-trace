import * as XLSX from 'xlsx';

/** Expected first-row headers (order matters). Client cell must match `clients.designation` (trim, case-insensitive). */
export const FAB_ORDERS_EXCEL_HEADERS = [
  'Client',
  'Commande',
  'OF',
  'Reference',
  'Chaine',
  'Date-Planif',
  'PF-QTE',
  'SET-QTE',
  'TES-Qte',
  'Lot',
  'Commentaire',
] as const;

export type FabOrderImportRowError = {
  /** 1-based row index in the sheet (including header: first data row = 2). */
  excelRow: number;
  message: string;
};

export type FabOrderImportPayload = {
  of_id: string;
  sale_order_id: string;
  client_id: string;
  prod_ref: string | null;
  prod_name: null;
  chaine_id: string;
  date_fabrication: string | undefined;
  pf_qty: number;
  sf_qty: number;
  set_qty: number;
  tester_qty: number;
  lot_set: string;
  instruction: undefined;
  comment: string | null;
  statut_of: 'Planifié';
};

function trimStr(v: unknown): string {
  if (v == null || v === '') return '';
  return String(v).replace(/\u00a0/g, ' ').trim();
}

function normalizeWs(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

/** Match Excel header cells: Unicode hyphens / dashes → ASCII hyphen (strict compare). */
function normalizeExcelHeaderCell(v: unknown): string {
  return trimStr(v)
    .replace(/\uFEFF/g, '')
    .replace(/\u2212/g, '-')
    .replace(/\u2013/g, '-')
    .replace(/\u2014/g, '-');
}

export function validateFabOrdersExcelHeaders(headerRow: unknown[]): string[] {
  const errors: string[] = [];
  const exp = [...FAB_ORDERS_EXCEL_HEADERS];
  if (!headerRow || headerRow.length === 0) {
    errors.push('La première ligne (en-têtes) est vide.');
    return errors;
  }
  for (let i = 0; i < exp.length; i++) {
    const got = normalizeExcelHeaderCell(headerRow[i]);
    if (got !== exp[i]) {
      errors.push(
        `Colonne ${i + 1} : attendu « ${exp[i]} », trouvé « ${got || '(vide)'} ».`
      );
    }
  }
  return errors;
}

/** Excel serial date to JS Date (UTC instant; use UTC calendar parts for the ISO date). */
function excelSerialToDate(serial: number): Date | null {
  if (!Number.isFinite(serial) || serial <= 0) return null;
  const utc = (Math.floor(serial) - 25569) * 86400 * 1000;
  const d = new Date(utc);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isoFromUtcDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** SheetJS builds Date with local calendar (new Date(y,m-1,d)); never use toISOString() — it shifts the day in non-UTC zones. */
function isoFromLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function parseFabOrdersDateCell(value: unknown): { ok: true; iso: string } | { ok: false; reason: string } {
  if (value == null || value === '') {
    return { ok: true, iso: '' };
  }
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return { ok: false, reason: 'Date invalide.' };
    return { ok: true, iso: isoFromLocalDate(value) };
  }
  if (typeof value === 'number' && value > 0) {
    const d = excelSerialToDate(value);
    if (!d) return { ok: false, reason: 'Date Excel invalide.' };
    return { ok: true, iso: isoFromUtcDate(d) };
  }
  const raw = trimStr(value);
  // Excel text cells often include time: "15/06/2025 00:00:00" or ISO "2025-06-15T12:00:00"
  const head = raw.split(/[\sT]/)[0] ?? raw;
  // Allow spaces around separators: "15 / 06 / 2025" → DD/MM/YYYY (day first, month second)
  const s = head.replace(/\s*([/.-])\s*/g, '$1');
  const isoLike = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (isoLike) {
    return { ok: true, iso: `${isoLike[1]}-${isoLike[2]}-${isoLike[3]}` };
  }
  // Numeric string that looks like an Excel serial (e.g. pasted as text)
  if (/^\d+(\.\d+)?$/.test(s)) {
    const n = parseFloat(s);
    if (n > 1 && n < 60000) {
      const d = excelSerialToDate(n);
      if (d) return { ok: true, iso: isoFromUtcDate(d) };
    }
  }
  const dmY = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(s);
  if (dmY) {
    let d = parseInt(dmY[1], 10);
    let m = parseInt(dmY[2], 10);
    let y = parseInt(dmY[3], 10);
    if (y < 100) y += 2000;
    // DD/MM/YYYY: if second part > 12, first token must be month (US-style) — swap to day/month
    if (m > 12 && d <= 12) {
      const t = d;
      d = m;
      m = t;
    }
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
      return { ok: false, reason: `Date non reconnue : « ${raw} ».` };
    }
    const mm = String(m).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    return { ok: true, iso: `${y}-${mm}-${dd}` };
  }
  return {
    ok: false,
    reason: `Format de date non reconnu : « ${raw} » (utilisez JJ/MM/AAAA (DD/MM/YYYY), AAAA-MM-JJ, ou une date Excel).`,
  };
}

function parseNonNegativeInt(value: unknown, label: string): { ok: true; n: number } | { ok: false; reason: string } {
  if (value == null || value === '') return { ok: true, n: 0 };
  let n: number;
  if (typeof value === 'number') {
    n = value;
  } else {
    const s = String(value).replace(/\s/g, '').replace(',', '.');
    n = parseFloat(s);
  }
  if (!Number.isFinite(n) || n < 0) {
    return {
      ok: false,
      reason: `${label} doit être un nombre entier ≥ 0 (reçu : « ${trimStr(value)} »).`,
    };
  }
  if (Math.abs(n - Math.round(n)) > 1e-9) {
    return {
      ok: false,
      reason: `${label} doit être un entier (reçu : « ${trimStr(value)} »).`,
    };
  }
  return { ok: true, n: Math.round(n) };
}

export function findClientIdByDesignation(
  cell: string,
  clients: { id: string; name: string; designation: string | null }[]
): { ok: true; clientId: string } | { ok: false; reason: string } {
  const t = normalizeWs(cell);
  if (!t) return { ok: false, reason: 'Client vide.' };
  const lower = t.toLowerCase();
  for (const c of clients) {
    const des = (c.designation ?? '').trim();
    if (des && des.toLowerCase() === lower) {
      return { ok: true, clientId: c.id };
    }
  }
  return {
    ok: false,
    reason: `Aucun client avec la désignation « ${t} » (le fichier doit utiliser la désignation exacte de la fiche client).`,
  };
}

export function findChaineIdByCell(
  cell: string,
  chaines: { id: string; num_chaine: number }[]
): { ok: true; chaineId: string } | { ok: false; reason: string } {
  const t = trimStr(cell);
  if (!t) return { ok: false, reason: 'Chaîne vide.' };
  const m = t.match(/(\d+)/);
  const num = m ? parseInt(m[1], 10) : NaN;
  if (!Number.isFinite(num)) {
    return { ok: false, reason: `Chaîne non reconnue : « ${t} » (indiquez le n° de chaîne, ex. 1 ou « Chaîne 1 »).` };
  }
  const row = chaines.find((c) => Number(c.num_chaine) === num);
  if (!row) {
    return { ok: false, reason: `Aucune chaîne avec le numéro ${num}.` };
  }
  return { ok: true, chaineId: row.id };
}

export function readFabOrdersExcelWorkbook(buffer: ArrayBuffer): {
  headerErrors: string[];
  dataRows: unknown[][];
} {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    return { headerErrors: ['Le classeur ne contient aucune feuille.'], dataRows: [] };
  }
  const ws = wb.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    defval: '',
    raw: true,
  }) as unknown[][];
  if (!matrix.length) {
    return { headerErrors: ['La feuille est vide.'], dataRows: [] };
  }
  const headerErrors = validateFabOrdersExcelHeaders(matrix[0] ?? []);
  const dataRows = matrix.slice(1);
  return { headerErrors, dataRows };
}

export function validateFabOrdersDataRows(
  dataRows: unknown[][],
  context: {
    clients: { id: string; name: string; designation: string | null }[];
    chaines: { id: string; num_chaine: number }[];
    existingOfIds: Set<string>;
  }
): { rowErrors: FabOrderImportRowError[]; payloads: FabOrderImportPayload[] } {
  const rowErrors: FabOrderImportRowError[] = [];
  const payloads: FabOrderImportPayload[] = [];
  const ofInFile = new Set<string>();

  for (let i = 0; i < dataRows.length; i++) {
    const excelRow = i + 2;
    const row = dataRows[i] ?? [];
    const ofId = trimStr(row[2]);
    const commande = trimStr(row[1]);
    const clientCell = trimStr(row[0]);
    const ref = trimStr(row[3]);
    const chaineCell = trimStr(row[4]);
    const lot = trimStr(row[9]);
    const comment = trimStr(row[10]);

    const rowEmpty =
      !clientCell &&
      !commande &&
      !ofId &&
      !ref &&
      !chaineCell &&
      (row[5] == null || row[5] === '') &&
      (row[6] == null || row[6] === '') &&
      (row[7] == null || row[7] === '') &&
      (row[8] == null || row[8] === '') &&
      !lot &&
      !comment;
    if (rowEmpty) continue;

    if (!ofId) {
      rowErrors.push({ excelRow, message: 'OF manquant.' });
      continue;
    }
    if (!commande) {
      rowErrors.push({ excelRow, message: 'Commande manquante.' });
      continue;
    }

    if (ofInFile.has(ofId)) {
      rowErrors.push({ excelRow, message: `OF en double dans le fichier : « ${ofId} ».` });
      continue;
    }
    ofInFile.add(ofId);

    if (context.existingOfIds.has(ofId)) {
      rowErrors.push({
        excelRow,
        message: `L’OF « ${ofId} » existe déjà dans l’application.`,
      });
      continue;
    }

    const clientRes = findClientIdByDesignation(clientCell, context.clients);
    if (!clientRes.ok) {
      rowErrors.push({ excelRow, message: clientRes.reason });
      continue;
    }

    const chaineRes = findChaineIdByCell(chaineCell, context.chaines);
    if (!chaineRes.ok) {
      rowErrors.push({ excelRow, message: chaineRes.reason });
      continue;
    }

    const dateRes = parseFabOrdersDateCell(row[5]);
    if (!dateRes.ok) {
      rowErrors.push({ excelRow, message: dateRes.reason });
      continue;
    }

    const pf = parseNonNegativeInt(row[6], 'PF-QTE');
    if (!pf.ok) {
      rowErrors.push({ excelRow, message: pf.reason });
      continue;
    }
    const setQ = parseNonNegativeInt(row[7], 'SET-QTE');
    if (!setQ.ok) {
      rowErrors.push({ excelRow, message: setQ.reason });
      continue;
    }
    const tes = parseNonNegativeInt(row[8], 'TES-Qte');
    if (!tes.ok) {
      rowErrors.push({ excelRow, message: tes.reason });
      continue;
    }

    payloads.push({
      of_id: ofId,
      sale_order_id: commande,
      client_id: clientRes.clientId,
      prod_ref: ref || null,
      prod_name: null,
      chaine_id: chaineRes.chaineId,
      date_fabrication: dateRes.iso ? `${dateRes.iso}T12:00:00.000Z` : undefined,
      pf_qty: pf.n,
      sf_qty: 0,
      set_qty: setQ.n,
      tester_qty: tes.n,
      lot_set: lot,
      instruction: undefined,
      comment: comment || null,
      statut_of: 'Planifié',
    });
  }

  rowErrors.sort((a, b) => a.excelRow - b.excelRow);
  return { rowErrors, payloads };
}

export function downloadFabOrdersImportTemplate(): void {
  const exampleRow = [
    'Désignation client (exemple)',
    'CMD-1001',
    'OF-2025-001',
    'REF-ABC',
    '1',
    '2025-06-15',
    10,
    2,
    1,
    'LOT-01',
    'Commentaire optionnel',
  ];
  const ws = XLSX.utils.aoa_to_sheet([[...FAB_ORDERS_EXCEL_HEADERS], exampleRow]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Import');
  XLSX.writeFile(wb, `modele_import_ordres_fabrication.xlsx`);
}
