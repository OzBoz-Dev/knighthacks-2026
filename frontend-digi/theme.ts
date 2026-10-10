import {
  createTheme,
  type CSSVariablesResolver,
  type MantineColorsTuple,
} from "@mantine/core";
import { palette } from "./palette";

const dark: MantineColorsTuple = [
  palette.text,
  "#CAD3D8",
  palette.muted,
  "#76858E",
  "#35434C",
  palette.border,
  palette.elevated,
  palette.surface,
  palette.sidebar,
  palette.background,
];

const cyan: MantineColorsTuple = [
  "#ECFEFF",
  "#CFFAFE",
  "#A5F3FC",
  "#67E8F9",
  palette.accent,
  "#06B6D4",
  "#0891B2",
  "#0E7490",
  "#155E75",
  "#164E63",
];

export const theme = createTheme({
  colors: { dark, cyan },
  primaryColor: "cyan",
  primaryShade: { light: 6, dark: 4 },
  autoContrast: true,
  luminanceThreshold: 0.3,
  black: "#061014",
  white: "#FFFFFF",
  fontFamily:
    "var(--font-geist-sans), ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
  fontFamilyMonospace:
    "var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, monospace",
  headings: {
    fontFamily:
      "var(--font-geist-sans), ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
    fontWeight: "600",
  },
  defaultRadius: "md",
  radius: { sm: "6px", md: "8px", lg: "10px" },
  cursorType: "pointer",
  components: {
    Paper: { defaultProps: { bg: "dark.7", withBorder: true } },
    Card: { defaultProps: { bg: "dark.7", withBorder: true } },
    Badge: { defaultProps: { variant: "light", radius: "sm" } },
    Alert: { defaultProps: { variant: "light" } },
  },
});

export const cssVariablesResolver: CSSVariablesResolver = () => ({
  variables: {},
  light: {},
  dark: {
    "--mantine-color-body": palette.background,
    "--mantine-color-text": palette.text,
    "--mantine-color-dimmed": palette.muted,
    "--mantine-color-default-border": palette.border,
    "--mantine-color-anchor": palette.accent,
  },
});
