import { Platform } from "react-native";

export const colors = {
  surface: "#FDF6EC",
  surfaceSecondary: "#F5E8D3",
  surfaceTertiary: "#E8D5B5",
  surfaceInverse: "#2B1810",
  onSurface: "#2B1810",
  onSurfaceInverse: "#FDF6EC",
  brand: "#7A1F2B",
  brandDark: "#5c1720",
  onBrand: "#FDF6EC",
  saffron: "#D4A017",
  onSaffron: "#2B1810",
  success: "#3F7D4A",
  error: "#B23A2E",
  muted: "#7a6a55",
  border: "#E8D5B5",
  borderStrong: "#2B1810",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

export const radius = {
  sm: 4,
  md: 12,
  lg: 16,
  pill: 999,
};

// Slab-like display font for headers (stamped, hand-signed feel) and geometric sans for body.
export const font = {
  display: Platform.select({ ios: "Georgia", android: "serif", default: "Georgia" })!,
  body: Platform.select({ ios: "System", android: "sans-serif", default: "System" })!,
  displayWeight: "800" as const,
  bodyWeight: "500" as const,
};

export const shadow = {
  card: {
    shadowColor: "#2B1810",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  strong: {
    shadowColor: "#2B1810",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 6,
  },
};

export const rupee = (n: number) => `₹${Math.round(n)}`;
