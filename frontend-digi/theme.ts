import {
  createTheme,
  type CSSVariablesResolver,
  type MantineColorsTuple,
} from "@mantine/core";
import { palette } from "./palette";

const dark: MantineColorsTuple = [
  palette.text,
  "#DADCDE",
  palette.muted,
  "#8E9398",
  "#4C5157",
  palette.border,
  palette.elevated,
  palette.surface,
  palette.sidebar,
  palette.background,
];

const lava: MantineColorsTuple = [
  "#FFF0EE",
  "#FFD4CF",
  "#FFA89E",
  "#FF7A6B",
  "#FF6352",
  palette.accent,
  palette.accentFilled,
  "#A82315",
  "#801C17",
  "#4F110D",
];

const sans = "var(--font-dm-sans), ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif";

export const theme = createTheme({
  colors: { dark, lava },
  primaryColor: "lava",
  primaryShade: { light: 6, dark: 6 },
  black: "#141618",
  white: "#FFFFFF",
  fontFamily: sans,
  fontFamilyMonospace: "var(--font-dm-mono), ui-monospace, SFMono-Regular, Menlo, monospace",
  headings: { fontFamily: sans, fontWeight: "600" },
  defaultRadius: "sm",
  radius: { xs: "2px", sm: "4px", md: "6px", lg: "8px" },
  cursorType: "pointer",
  components: {
    Paper: { defaultProps: { bg: "dark.7", withBorder: true, radius: "sm" } },
    Card: { defaultProps: { bg: "dark.7", withBorder: true, radius: "sm" } },
    Badge: { defaultProps: { variant: "light", radius: "xs" } },
    Alert: { defaultProps: { variant: "light", radius: "sm" } },
    Button: { defaultProps: { fw: 500 } },
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
    "--dg-up": palette.up,
  },
  light: {},
  dark: {
    "--mantine-color-body": palette.background,
    "--mantine-color-text": palette.text,
    "--mantine-color-dimmed": palette.muted,
    "--mantine-color-default-border": palette.border,
    "--mantine-color-anchor": "var(--mantine-color-lava-4)",
    "--mantine-color-lava-light-color": "var(--mantine-color-lava-4)",
  },
});
