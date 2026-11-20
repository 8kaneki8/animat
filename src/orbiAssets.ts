/**
 * Canonical artwork references for the original OrBi character.
 * Keep the base artwork, outfit skin, and crown accessory as separate assets.
 */
export const ORBI_BASE_ART = `${import.meta.env.BASE_URL}2409c563-7712-439b-bb7c-710fce80312c.png`;
export const ORBI_ARMOR_SKIN = `${import.meta.env.BASE_URL}f1511c5a-e4a1-4d29-9822-e1d9a673e344.png`;

export const ORBI_OFFICIAL_SKINS = [
  {
    id: "orbi-official-armor",
    name: "Official white & purple armor",
    filename: "f1511c5a-e4a1-4d29-9822-e1d9a673e344.png",
    image: ORBI_ARMOR_SKIN,
  },
] as const;
