export const calculateDimensions = (diagonal: number, ratioW: number, ratioH: number) => {
  const angle = Math.atan(ratioH / ratioW);
  const width = diagonal * Math.cos(angle);
  const height = diagonal * Math.sin(angle);
  return { width, height };
};

export const formatDim = (inches: number): string => {
  const cm = inches * 2.54;
  return `${Math.round(cm * 10) / 10} cm (${Math.round(inches * 10) / 10}")`;
};