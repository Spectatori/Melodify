export const extractColorsFromImage = (imageUrl: string): Promise<string[]> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        resolve(['#8B4513', '#FF69B4', '#4B0082']); // fallback
        return;
      }
      
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      
      try {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const colors = extractDominantColors(imageData.data);
        resolve(colors);
      } catch (error) {
        console.warn('Could not extract colors from image:', error);
        resolve(['#8B4513', '#FF69B4', '#4B0082']); // fallback
      }
    };
    
    img.onerror = () => {
      console.warn('Could not load image for color extraction');
      resolve(['#8B4513', '#FF69B4', '#4B0082']); // fallback
    };
    
    img.src = imageUrl;
  });
};

const extractDominantColors = (imageData: Uint8ClampedArray): string[] => {
  const colorCounts: { [key: string]: number } = {};
  const step = 4 * 10; // Sample every 10th pixel for performance
  
  for (let i = 0; i < imageData.length; i += step) {
    const r = imageData[i];
    const g = imageData[i + 1];
    const b = imageData[i + 2];
    const alpha = imageData[i + 3];
    
    // Skip transparent pixels
    if (alpha < 128) continue;
    
    // Group similar colors by reducing precision
    const key = `${Math.floor(r / 32) * 32},${Math.floor(g / 32) * 32},${Math.floor(b / 32) * 32}`;
    colorCounts[key] = (colorCounts[key] || 0) + 1;
  }
  
  // Get top 3 most common colors
  const sortedColors = Object.entries(colorCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([color]) => {
      const [r, g, b] = color.split(',').map(Number);
      return rgbToHex(r, g, b);
    });
  
  // Ensure we have 3 colors
  while (sortedColors.length < 3) {
    sortedColors.push('#4B0082');
  }
  
  return sortedColors;
};

const rgbToHex = (r: number, g: number, b: number): string => {
  return `#${[r, g, b].map(x => {
    const hex = x.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('')}`;
};

export const createGradientFromColors = (colors: string[]): string => {
  if (colors.length < 2) {
    return 'linear-gradient(135deg, #8B4513 0%, #FF69B4 50%, #4B0082 100%)';
  }
  
  if (colors.length === 2) {
    return `linear-gradient(135deg, ${colors[0]} 0%, ${colors[1]} 100%)`;
  }
  
  return `linear-gradient(135deg, ${colors[0]} 0%, ${colors[1]} 50%, ${colors[2]} 100%)`;
};