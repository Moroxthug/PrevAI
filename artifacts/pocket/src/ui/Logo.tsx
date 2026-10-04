// Il logotipo PrevAI (il segno a spirale e la scritta): l'immagine del sito ritagliata ai bordi
// (assets/prevai-logo.png, 1158 x 286, sfondo trasparente).
import { Image } from "react-native";

const RATIO = 1158 / 286;

export function Logo({ width = 104, label = "PrevAI" }: { width?: number; label?: string }) {
  return <Image source={require("../../assets/prevai-logo.png")} style={{ width, height: width / RATIO }} resizeMode="contain" accessibilityRole="image" accessibilityLabel={label} />;
}
