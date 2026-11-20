/**
 * Canonical artwork references for the original OrBi character.
 * Prefer the GitHub Pages base path, then try root/relative fallbacks for alternate hosts.
 */
const BASE_ART_FILE = "2409c563-7712-439b-bb7c-710fce80312c.png";
const ARMOR_FILE = "f1511c5a-e4a1-4d29-9822-e1d9a673e344.png";
const basePath = import.meta.env.BASE_URL.endsWith("/") ? import.meta.env.BASE_URL : import.meta.env.BASE_URL + "/";

export const ORBI_BASE_ART = basePath + BASE_ART_FILE;
export const ORBI_BASE_ART_CANDIDATES = [...new Set([ORBI_BASE_ART, "/" + BASE_ART_FILE, "./" + BASE_ART_FILE])];
export const ORBI_ARMOR_SKIN = basePath + ARMOR_FILE;
export const ORBI_ARMOR_SKIN_CANDIDATES = [...new Set([ORBI_ARMOR_SKIN, "/" + ARMOR_FILE, "./" + ARMOR_FILE])];

export const ORBI_OFFICIAL_SKINS = [
  {
    id: "orbi-official-armor",
    name: "Official white & purple armor",
    filename: ARMOR_FILE,
    image: ORBI_ARMOR_SKIN,
  },
] as const;
