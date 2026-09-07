export const BREAKPOINTS = {
  desktop: 1280,
  laptop: 1024,
  tablet: 768,
  mobile: 480,
  smallMobile: 360,
};

export const getResponsiveScale = (width: number) => {
  if (width >= BREAKPOINTS.desktop) return 1.35 * 1.5; // Desktop: current 1.5x of 1.35
  if (width >= BREAKPOINTS.laptop) return 1.2 * 1.5;
  if (width >= BREAKPOINTS.tablet) return 1.0 * 1.5;
  if (width >= BREAKPOINTS.mobile) return 0.8 * 1.5;
  return 0.7 * 1.5; // smallMobile
};

export const getExplosionMultiplier = (width: number) => {
  if (width >= BREAKPOINTS.desktop) return 1.0;
  if (width >= BREAKPOINTS.laptop) return 0.8;
  if (width >= BREAKPOINTS.tablet) return 0.6;
  return 0.4;
};

export const getStoryLabelPadding = (width: number) => {
  if (width >= BREAKPOINTS.tablet) return 30;
  return 10;
};

export const getStoryLabelWidth = (width: number) => {
  if (width >= BREAKPOINTS.desktop) return 250;
  if (width >= BREAKPOINTS.laptop) return 200;
  if (width >= BREAKPOINTS.tablet) return 160;
  return 100;
};
