import { ColorItem, HarmonyMode } from "./utils/colorUtils";

export interface UserSubscription {
  tier: "free" | "pro-monthly" | "pro-annual" | "pro-lifetime";
  subscriptionId?: string;
  subscriptionStatus?: "active" | "cancelled" | "canceling" | "past_due" | "deactivated";
  squareCustomerId?: string;
  squareCardId?: string;
  premiumExpires?: string; // ISO string
  pricingPlan?: string;
  updatedAt: any;
}

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

