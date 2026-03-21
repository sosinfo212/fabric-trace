/**
 * Hardcoded bottle type list for Laquage rebut composant dropdown.
 * Display labels only; same string is sent to API.
 */
export const REBUT_COMPOSANTS = [
  'Bottle F01 W 100ML /158g',
  'Bottle F01 Opera 100ML /158g',
  'Bottle F01 Water Made W 100ML /158g',
  'Bottle F01 South Beach 100ML /158g',
  'Bottle F08 100ML /154g',
  'Bottle F08 Royale W 100ML /154g',
  'Bottle F02 Summer Cruise 100ML/201g',
  'Bottle F02 Moment Women 100ML (302 old bottle)/201',
  'Bottle F02 Miramar Women 100 ML/201g',
  'Bottle F03 New Alive 100ML',
  'Bottle F03 Luxever 100ml',
  'Bottle F04 Love me 100ml /154g',
  'Bottle F04 Kiss In Spring 100ML /154g',
  'Bottle F05 Clear bottle 100ML/150g',
  'Bottle F05 Ocean Women 100ML/150g',
  'Bottle F06 100ML/154g',
  'Bottle F06 Sentimental 100ML /164g',
  'Bottle F07 Women 100ML/155g',
  'Bottle F07 Influence Women 100ML /153g',
  'Bottle F08 Royale Night Women 100ml/163g',
  'Bottle F04 Purple 100ML /154g',
  'Bottle F06 First Touch 100ML/182g',
  'Bottle F07 Movie Star 100ML /152g',
  'Bottle F08 Sport 100ML/151g',
  'Bottle F08 Royale Night Men /150g',
  'Bottle F09 Water Made Men 100ML/168g',
  'Bottle F09 Black Men 100ML/171g',
  'Bottle F09 Illusion Blue 100ML/168g',
  'Bottle F09 Illusion Red 100ML/157g',
  'Bottle Brown Cuba After Shave M 100ML /Brown Coating /147g',
  'Bottle Cuba 100ML /152g',
  'Bottle Cuba Magnum Gold 130ML /151g',
  'Bottle Cuba 5ML / FL+SERIG+LAQ/3g',
  'Bottle Frosted Glass Cuba After Shave 100ML/147g',
  'Bottle-Glass Tube Transparent Cuba 35ML /22g',
];

/** API value for défaut (DB uses "Temperature") */
export const REBUT_DEFAUTS = ['Poudre', 'Peinture', 'Temperature', 'Casse'] as const;
/** Display label for défaut */
export const REBUT_DEFAUT_LABELS: Record<string, string> = {
  Poudre: 'Poudre',
  Peinture: 'Peinture',
  Temperature: 'Température',
  Casse: 'Casse',
};
