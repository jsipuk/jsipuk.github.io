/* A deliberately small palette. Everything on screen comes from this list, and
 * the three sides of the picture are separated by value as much as by hue:
 * the zombie side is murky, the wall is warm, the rally is bright.
 */
export const P = {
  // sky / backdrop
  night: '#12102a',
  dusk: '#2b1e4a',
  haze: '#4a3268',
  smog: '#5c4a4a',

  // americana
  flagRed: '#d02b2b',
  flagWhite: '#f4f0e4',
  flagBlue: '#2b3f8c',
  star: '#ffe9a8',
  marble: '#d8d4c4',
  marbleShade: '#a49f90',
  lawn: '#3f7a3a',

  // eagle
  eagleBody: '#5a3b22',
  eagleWing: '#3d2716',
  eagleHead: '#f4f0e4',
  eagleBeak: '#ffc13b',

  // wall tiers 0..3
  tier: [
    { face: '#b4552f', top: '#d9723f', shade: '#7a3418', line: '#5a2510' },
    { face: '#8e8a84', top: '#b3afa8', shade: '#5e5b56', line: '#413f3b' },
    { face: '#6f7f96', top: '#93a4bb', shade: '#4a566a', line: '#333c4a' },
    { face: '#d4a02a', top: '#ffd45c', shade: '#996f10', line: '#6b4c07' },
  ],
  crack: '#2a1408',

  // zombies
  zSkin: '#6f9c4a',
  zSkinDark: '#4a6b31',
  zRot: '#8fae5e',
  zCloth: '#3c3350',
  zClothDark: '#282139',
  zEye: '#ffe14d',
  zBlood: '#7d2b2b',
  bruteSkin: '#8a7f45',
  bruteCloth: '#4a3a22',

  // rally
  cap: '#e02b2b',
  capDark: '#9c1717',
  skinA: '#e8b48a',
  skinB: '#a9714a',
  skinC: '#6b4630',
  shirtA: '#f4f0e4',
  shirtB: '#2b3f8c',
  shirtC: '#d02b2b',
  stand: '#4a3b2a',
  standDark: '#33281c',

  // ground
  dirt: '#463a2c',
  dirtDark: '#2e261c',
  dirtLight: '#5c4c39',

  // ui
  ink: '#0a0812',
  panel: '#1b1730',
  panelEdge: '#453a6b',
  text: '#f4f0e4',
  textDim: '#9a91b8',
  gold: '#ffd45c',
  danger: '#ff4d4d',
  good: '#6ee06e',
  btn: '#2f2750',
  btnLit: '#5b4b94',
  btnEdge: '#6d5cb0',
  white: '#ffffff',
  black: '#000000',
};

/** Rally crowd bodies get picked from these so the stands do not look cloned. */
export const CROWD_SKIN = [P.skinA, P.skinB, P.skinC];
export const CROWD_SHIRT = [P.shirtA, P.shirtB, P.shirtC, P.cap];
