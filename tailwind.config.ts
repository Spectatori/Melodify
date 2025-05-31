import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/{**,.client,.server}/**/*.{js,jsx,ts,tsx}"],
  safelist: [
    // Dynamic text colors
    'text-green-400',
    'text-red-400', 
    'text-blue-400',
    'text-purple-400',
    'text-orange-400',
    'text-yellow-400',
    'text-white/60',
    'text-white/70',
    'text-white/80',
    'text-white/90',
    
    // Dynamic background colors with opacity
    'bg-green-500/20',
    'bg-red-500/20',
    'bg-blue-500/20',
    'bg-purple-500/20',
    'bg-orange-500/20',
    'bg-yellow-500/20',
    'bg-white/10',
    'bg-white/20',
    'bg-white/30',
    'bg-white/40',
    
    // Border colors
    'border-green-500/30',
    'border-red-500/30',
    'border-blue-500/30',
    'border-purple-500/30',
    'border-yellow-500/30',
    
    // Ring colors (for focus states)
    'ring-1',
    'ring-2', 
    'ring-white/30',
    'ring-white/40',
    'ring-green-300/30',
    'ring-blue-300/30',
    'ring-purple-300/30',
    
    // Animation classes
    'animate-pulse',
    'animate-spin',
    'animate-bounce',
    'animate-slide-up',
    'animate-slide-in',
    'animate-fadeIn',
    
    // Scale transforms
    'scale-95',
    'scale-102',
    'scale-105',
    'hover:scale-105',
    'hover:scale-100',
    'disabled:hover:scale-100',
    
    // Opacity classes
    'opacity-0',
    'opacity-50',
    'opacity-100',
    
    // Transition classes
    'transition-all',
    'transition-opacity',
    'transition-transform',
    'transition-colors',
    'duration-200',
    'duration-300',
    'duration-500',
    'ease-out',
    'ease-in-out',
    
    // Backdrop filters
    'backdrop-blur-md',
    'backdrop-blur-sm',
    
    // Shadow classes
    'shadow-lg',
    'shadow-xl',
    'shadow-2xl',
    'shadow-3xl',
    'drop-shadow-lg',
    
    // Hover states for buttons
    'hover:bg-white/10',
    'hover:bg-white/15',
    'hover:bg-white/20',
    'hover:bg-green-500',
    'hover:bg-purple-500',
    'hover:bg-red-500',
    'hover:bg-blue-500',
    
    // Disabled states
    'disabled:opacity-50',
    'disabled:cursor-not-allowed',
    
    // Group hover states
    'group-hover:opacity-100',
    'opacity-0',
    
    // Line clamp
    'line-clamp-2',
    
    // Responsive variants that might be dynamic
    'md:grid-cols-2',
    'lg:grid-cols-3',
    'lg:w-1/3',
    'lg:w-2/3',
  ],
  theme: {
    extend: {
      scale: {
        '102': '1.02',
      },
      keyframes: {
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' }
        },
        slideIn: {
          '0%': { transform: 'translateX(-20px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' }
        },
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        }
      },
      animation: {
        'slide-up': 'slideUp 0.5s ease-out forwards',
        'slide-in': 'slideIn 0.3s ease-out',
        'fadeIn': 'fadeIn 0.4s ease-out forwards'
      },
      colors: {
        primary: "#007f5f",
        secondary: "#b5179e",
        tertiary: "#f72530",
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
          "Apple Color Emoji",
          "Segoe UI Emoji",
          "Segoe UI Symbol",
          "Noto Color Emoji",
        ],
      },
    },
  },
  plugins: [],
} satisfies Config;