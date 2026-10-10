import {
  createTheme,
  type CSSVariablesResolver,
  type MantineColorsTuple,
} from "@mantine/core";
import { palette } from "./palette";

const dark: MantineColorsTuple = [
  palette.text,
  "#D2D2C8",
  palette.muted,
  "#8C8F84",
  "#4A5045",
  palette.border,
  palette.elevated,
  palette.surface,
  palette.sidebar,
  palette.background,
];

const signal: MantineColorsTuple = [
  "#FCEFE7",
  "#F6D8C6",
  "#EEB89A",
  "#E6996F",
  palette.accent,
  "#C8642F",
  "#A85226",
  "#86411F",
  "#653118",
  "#452110",
];

export const theme = createTheme({
  colors: { dark, signal },
  primaryColor: "signal",
  primaryShade: { light: 6, dark: 4 },
  autoContrast: true,
  luminanceThreshold: 0.2,
  black: "#141511",
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
  defaultRadius: "sm",
  radius: { xs: "2px", sm: "4px", md: "6px", lg: "8px" },
  cursorType: "pointer",
  components: {
    Paper: { defaultProps: { bg: "dark.7", withBorder: true, radius: "sm" } },
    Card: { defaultProps: { bg: "dark.7", withBorder: true, radius: "sm" } },
    Badge: { defaultProps: { variant: "light", radius: "xs" } },
    Alert: { defaultProps: { variant: "light", radius: "sm" } },
    Modal: { defaultProps: { radius: "sm" } },
    Popover: { defaultProps: { radius: "sm" } },
  },
});

export const cssVariablesResolver: CSSVariablesResolver = () => ({
  variables: {
    "--dg-surface": palette.surface,
    "--dg-elevated": palette.elevated,
    "--dg-rule": palette.border,
    "--dg-accent": palette.accent,
  },
  light: {},
  dark: {
    "--mantine-color-body": palette.background,
    "--mantine-color-text": palette.text,
    "--mantine-color-dimmed": palette.muted,
    "--mantine-color-default-border": palette.border,
    "--mantine-color-anchor": palette.accent,
  },
});
