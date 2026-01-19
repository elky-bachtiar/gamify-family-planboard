import { useAuth } from '../contexts/AuthContext';
import { COLOR_PALETTES, getPaletteColors, PaletteKey } from '../types';

export function useColorPalette() {
  const { family } = useAuth();

  const paletteKey = (family?.color_palette || 'default') as PaletteKey;
  const colors = getPaletteColors(paletteKey);
  const paletteName = COLOR_PALETTES[paletteKey]?.name || 'Default';

  return {
    paletteKey,
    colors,
    paletteName,
  };
}
