// app/services/color-extraction.server.ts
import fs from 'fs';
import path from 'path';

interface ColorPalette {
  primary: string;
  secondary: string;
  accent: string;
  gradient: string;
}

// Simple color extraction using pixel sampling
export async function extractColorsFromPlaylistCover(playlistId: string): Promise<ColorPalette | null> {
  try {
    // Check for cover image
    const jpegPath = path.join(process.cwd(), "public", "playlist-covers", `${playlistId}.jpg`);
    const webpPath = path.join(process.cwd(), "public", "playlist-covers", `${playlistId}.webp`);
    
    let imagePath: string | null = null;
    if (fs.existsSync(jpegPath)) {
      imagePath = jpegPath;
    } else if (fs.existsSync(webpPath)) {
      imagePath = webpPath;
    }
    
    if (!imagePath) {
      console.log("No cover image found for color extraction");
      return null;
    }
    
    // Try to use Sharp for color analysis
    try {
      const sharp = await import('sharp');
      
      // Get image data for color analysis
      const { data: buffer } = await sharp.default(imagePath)
        .resize(100, 100) // Resize for faster processing
        .raw()
        .toBuffer({ resolveWithObject: true });
      
      // Extract RGB values from the buffer
      const pixels = [];
      
      // Sample pixels from different areas of the image
      for (let i = 0; i < buffer.length; i += 3) {
        if (i + 2 < buffer.length) {
          pixels.push({
            r: buffer[i],
            g: buffer[i + 1], 
            b: buffer[i + 2]
          });
        }
      }
      
      // Get the most dominant colors
      const colorCounts = new Map();
      pixels.forEach(pixel => {
        // Group similar colors together (reduce precision)
        const key = `${Math.floor(pixel.r / 32) * 32},${Math.floor(pixel.g / 32) * 32},${Math.floor(pixel.b / 32) * 32}`;
        colorCounts.set(key, (colorCounts.get(key) || 0) + 1);
      });
      
      // Sort by frequency and get top colors
      const sortedColors = Array.from(colorCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([color]) => {
          const [r, g, b] = color.split(',').map(Number);
          return { r, g, b };
        });
      
      if (sortedColors.length >= 2) {
        const primary = sortedColors[0];
        const secondary = sortedColors[1];
        const accent = sortedColors[2] || secondary;
        
        return {
          primary: `rgb(${primary.r}, ${primary.g}, ${primary.b})`,
          secondary: `rgb(${secondary.r}, ${secondary.g}, ${secondary.b})`,
          accent: `rgb(${accent.r}, ${accent.g}, ${accent.b})`,
          gradient: `linear-gradient(135deg, rgb(${primary.r}, ${primary.g}, ${primary.b}) 0%, rgb(${secondary.r}, ${secondary.g}, ${secondary.b}) 50%, rgb(${accent.r}, ${accent.g}, ${accent.b}) 100%)`
        };
      }
      
    } catch (sharpError) {
      console.log("Sharp not available for color extraction, using Canvas fallback");
      
      // Fallback using Canvas API
      try {
        const { createCanvas, loadImage } = await import('canvas');
        
        const img = await loadImage(imagePath);
        const canvas = createCanvas(100, 100);
        const ctx = canvas.getContext('2d');
        
        // Draw and resize image
        ctx.drawImage(img, 0, 0, 100, 100);
        
        // Sample pixels from different areas
        const samples = [
          ctx.getImageData(25, 25, 1, 1).data,   // Top-left area
          ctx.getImageData(75, 25, 1, 1).data,   // Top-right area
          ctx.getImageData(50, 50, 1, 1).data,   // Center
          ctx.getImageData(25, 75, 1, 1).data,   // Bottom-left area
          ctx.getImageData(75, 75, 1, 1).data    // Bottom-right area
        ];
        
        // Convert to RGB objects
        const colors = samples.map(data => ({
          r: data[0],
          g: data[1],
          b: data[2]
        }));
        
        // Use the sampled colors
        const primary = colors[2]; // Center
        const secondary = colors[0]; // Top-left
        const accent = colors[4]; // Bottom-right
        
        return {
          primary: `rgb(${primary.r}, ${primary.g}, ${primary.b})`,
          secondary: `rgb(${secondary.r}, ${secondary.g}, ${secondary.b})`,
          accent: `rgb(${accent.r}, ${accent.g}, ${accent.b})`,
          gradient: `linear-gradient(135deg, rgb(${primary.r}, ${primary.g}, ${primary.b}) 0%, rgb(${secondary.r}, ${secondary.g}, ${secondary.b}) 50%, rgb(${accent.r}, ${accent.g}, ${accent.b}) 100%)`
        };
        
      } catch (canvasError) {
        console.log("Canvas API not available for color extraction");
      }
    }
    
    // Fallback to default colors if extraction fails
    return generateFallbackColors();
    
  } catch (error) {
    console.error("Error extracting colors:", error);
    return generateFallbackColors();
  }
}

function generateFallbackColors(): ColorPalette {
  // Default gradient colors if extraction fails
  return {
    primary: "rgb(139, 69, 19)",
    secondary: "rgb(255, 105, 180)", 
    accent: "rgb(75, 0, 130)",
    gradient: "linear-gradient(135deg, rgb(139, 69, 19) 0%, rgb(255, 105, 180) 50%, rgb(75, 0, 130) 100%)"
  };
}

// Alternative: Simple color extraction without external libraries
export async function extractColorsSimple(playlistId: string): Promise<ColorPalette | null> {
  try {
    // This is a simplified version that generates colors based on playlist ID
    // In case the advanced extraction fails
    
    const hash = playlistId.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    
    const hue1 = Math.abs(hash) % 360;
    const hue2 = (hue1 + 120) % 360;
    const hue3 = (hue1 + 240) % 360;
    
    return {
      primary: `hsl(${hue1}, 70%, 50%)`,
      secondary: `hsl(${hue2}, 70%, 50%)`,
      accent: `hsl(${hue3}, 70%, 50%)`,
      gradient: `linear-gradient(135deg, hsl(${hue1}, 70%, 50%) 0%, hsl(${hue2}, 70%, 50%) 50%, hsl(${hue3}, 70%, 50%) 100%)`
    };
    
  } catch (error) {
    console.error("Error in simple color extraction:", error);
    return generateFallbackColors();
  }
}