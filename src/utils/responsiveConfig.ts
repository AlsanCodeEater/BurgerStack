export const BREAKPOINTS = {
  desktop: 1280,
  laptop: 1024,
  tablet: 768,
  mobile: 480,
  smallMobile: 360,
};

export const PRESENTATION = {
  mobile: {
    hero: { scale: 0.82, y: 1.05, cameraZ: 14.6 },
    story: { scale: 1.16, y: 0.12, cameraZ: 14.2 },
    config: { scale: 0.88, y: -0.25, cameraZ: 12.5 },
  },
  tablet: {
    hero: { scale: 0.98, y: 1.25, cameraZ: 13.5 },
    story: { scale: 1.46, y: 0.06, cameraZ: 13.2 },
    config: { scale: 1.02, y: -0.25, cameraZ: 12.5 },
  },
  desktop: {
    hero: { scale: 1.18, y: 1.38, cameraZ: 12.4 },
    story: { scale: 1.78, y: 0.02, cameraZ: 12.2 },
    config: { scale: 1.16, y: -0.25, cameraZ: 12.5 },
  },
};

export const getResponsiveScale = (width: number) => {
  if (width >= BREAKPOINTS.desktop) return PRESENTATION.desktop.config.scale;
  if (width >= BREAKPOINTS.tablet) return PRESENTATION.tablet.config.scale;
  return PRESENTATION.mobile.config.scale;
};

export const getExplosionMultiplier = (width: number) => {
  if (width >= BREAKPOINTS.desktop) return 1.08;
  if (width >= BREAKPOINTS.tablet) return 0.94;
  return 0.78;
};

export const getStoryLabelPadding = (width: number) => {
  if (width >= BREAKPOINTS.desktop) return 28;
  if (width >= BREAKPOINTS.tablet) return 20;
  return 10;
};

export const getStoryLabelWidth = (width: number) => {
  if (width >= BREAKPOINTS.desktop) return 220;
  if (width >= BREAKPOINTS.laptop) return 190;
  if (width >= BREAKPOINTS.tablet) return 160;
  return 120;
};
