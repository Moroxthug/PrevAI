import { useColorScheme } from "react-native";

import colors from "@/constants/colors";

type ColorPalette = typeof colors.light;

export function useColors(): ColorPalette & { radius: number } {
  const scheme = useColorScheme();
  const palette: ColorPalette =
    scheme === "dark" && "dark" in colors
      ? (colors.dark as ColorPalette)
      : colors.light;
  return { ...palette, radius: colors.radius };
}
