import * as React from 'react';
import { useEffect, useState } from 'react';
import { extractColorsFromImage, createGradientFromColors } from './colorUtils';

interface BackgroundGradientProps {
  imageUrl?: string;
  fallbackGradient?: string;
  children: React.ReactNode;
  className?: string;
}

export const BackgroundGradient = React.memo(({ 
  imageUrl, 
  fallbackGradient = 'linear-gradient(135deg, rgb(139, 69, 19) 0%, rgb(255, 105, 180) 50%, rgb(75, 0, 130) 100%)',
  children,
  className = ''
}: BackgroundGradientProps) => {
  const [backgroundStyle, setBackgroundStyle] = useState({ background: fallbackGradient });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!imageUrl) {
      setBackgroundStyle({ background: fallbackGradient });
      return;
    }

    setIsLoading(true);
    
    extractColorsFromImage(imageUrl)
      .then(colors => {
        const gradient = createGradientFromColors(colors);
        setBackgroundStyle({ background: gradient });
      })
      .catch(() => {
        setBackgroundStyle({ background: fallbackGradient });
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [imageUrl, fallbackGradient]);

  return (
    <div 
      className={`transition-all duration-1000 ease-in-out ${className}`}
      style={backgroundStyle}
    >
      {isLoading && imageUrl && (
        <div className="absolute top-4 right-4 z-10">
          <div className="bg-black/20 backdrop-blur-md rounded-lg px-3 py-1">
            <span className="text-white/80 text-sm flex items-center">
              <div className="w-3 h-3 rounded-full bg-white/60 animate-pulse mr-2"></div>
              Generating theme...
            </span>
          </div>
        </div>
      )}
      {children}
    </div>
  );
});

BackgroundGradient.displayName = 'BackgroundGradient';