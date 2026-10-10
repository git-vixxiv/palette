import { ColorItem, HarmonyMode } from "./utils/colorUtils";

export interface Palette {
  id: string;
  name: string;
  colors: ColorItem[];
  harmonyMode: HarmonyMode;
  userId: string;
  createdAt: any;
  updatedAt: any;
}

export type { ColorItem, ColorRole, HarmonyMode } from "./utils/colorUtils";

