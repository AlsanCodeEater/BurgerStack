export const BREAKPOINTS = {
  desktop: 1280,
  laptop: 1024,
  tablet: 768,
  mobile: 480,
  smallMobile: 360,
};

export const PRESENTATION = {
  mobile: {
    hero: {
      scale: 0.80,
      y: 1.38,
      cameraZ: 12.4,
    },
    story: {
      scale: 1.08,
      y: 0.16,
      cameraZ: 14.6,
    },
    config: {
      scale: 0.88,
      y: -0.25,
      cameraZ: 12.5,
    },
  },

  tablet: {
    hero: {
      scale: 0.96,
      y: 1.66,
      cameraZ: 12.1,
    },
    story: {
      scale: 1.38,
      y: 0.06,
      cameraZ: 13.2,
    },
    config: {
      scale: 1.02,
      y: -0.25,
      cameraZ: 12.5,
    },
  },

  desktop: {
    hero: {
      scale: 1.18,
      y: 1.72,
      cameraZ: 12.0,
    },
    story: {
      // Larger explosion + larger rebuilt Story burger.
      scale: 1.72,
      y: 0.02,
      cameraZ: 12.25,
    },
    config: {
      scale: 1.16,
      y: -0.25,
      cameraZ: 12.5,
    },
  },
};

export const getResponsiveScale = (
  width: number,
) => {
  if (
    width >=
    BREAKPOINTS.desktop
  ) {
    return PRESENTATION.desktop.config.scale;
  }

  if (
    width >=
    BREAKPOINTS.tablet
  ) {
    return PRESENTATION.tablet.config.scale;
  }

  return PRESENTATION.mobile.config.scale;
};

export const getExplosionMultiplier = (
  width: number,
) => {
  if (
    width >=
    BREAKPOINTS.desktop
  ) {
    return 1.12;
  }

  if (
    width >=
    BREAKPOINTS.tablet
  ) {
    return 1.0;
  }

  return 0.82;
};

export const getStoryLabelPadding = (
  width: number,
) => {
  if (
    width >=
    BREAKPOINTS.tablet
  ) {
    return 18;
  }

  return 10;
};

export const getStoryLabelWidth = (
  width: number,
) => {
  if (
    width >=
    BREAKPOINTS.desktop
  ) {
    return 220;
  }

  if (
    width >=
    BREAKPOINTS.laptop
  ) {
    return 190;
  }

  if (
    width >=
    BREAKPOINTS.tablet
  ) {
    return 160;
  }

  return 126;
};
