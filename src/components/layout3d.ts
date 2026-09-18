import { createContext } from 'react';
import type { LayoutMap } from '../characters/types';

export interface Layout3D {
  layout: LayoutMap;
  selected: string | null;
  /** The child may drag parts around; off in the gallery and on the home cards. */
  editable: boolean;
  onSelect?: (categoryId: string | null) => void;
  onMove?: (categoryId: string, dx: number, dy: number, dz: number) => void;
}

/**
 * The same offsets the child gives a part on the paper sheet, handed to the 3D scene.
 * Kept in context so every character can wrap its parts without threading props through
 * each little component. It lives in its own file so editing a character during
 * development does not hand the scene a second, unrelated context.
 */
export const Layout3DContext = createContext<Layout3D | null>(null);
