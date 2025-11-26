import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export interface Slide {
  title: string;
  value: string | number;
  subtitle?: string;
}

interface SlideCardProps {
  slides: Slide[];
  icon: React.ReactNode;
  colorClass: string; // e.g., "blue", "purple", "amber", "green"
  frontLabel?: string;
  autoPlayInterval?: number; // milliseconds
  onFlip?: () => void;
  isFlipped?: boolean;
  testId?: string;
}

export function SlideCard({
  slides,
  icon,
  colorClass,
  frontLabel = "Click to see breakdown",
  autoPlayInterval = 4000,
  onFlip,
  isFlipped = false,
  testId,
}: SlideCardProps) {
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    if (slides.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, autoPlayInterval);

    return () => clearInterval(interval);
  }, [slides.length, autoPlayInterval]);

  if (slides.length === 0) {
    return (
      <div className={`bg-gradient-to-br from-${colorClass}-50 to-${colorClass}-100 dark:from-${colorClass}-950 dark:to-${colorClass}-900 border border-${colorClass}-200 dark:border-${colorClass}-800 rounded-xl p-6 h-[160px] flex items-center justify-center`}>
        <p className={`text-${colorClass}-600 dark:text-${colorClass}-400`}>No data available</p>
      </div>
    );
  }

  const slide = slides[currentSlide];
  const colorMap: Record<string, { light: string; dark: string; border: string }> = {
    blue: { light: "text-blue-700 dark:text-blue-300", dark: "text-blue-600 dark:text-blue-400", border: "border-blue-200 dark:border-blue-800" },
    purple: { light: "text-purple-700 dark:text-purple-300", dark: "text-purple-600 dark:text-purple-400", border: "border-purple-200 dark:border-purple-800" },
    amber: { light: "text-amber-700 dark:text-amber-300", dark: "text-amber-600 dark:text-amber-400", border: "border-amber-200 dark:border-amber-800" },
    green: { light: "text-green-700 dark:text-green-300", dark: "text-green-600 dark:text-green-400", border: "border-green-200 dark:border-green-800" },
  };

  const colors = colorMap[colorClass] || colorMap.blue;

  return (
    <div
      className="h-[160px] cursor-pointer"
      onClick={onFlip}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && onFlip) {
          e.preventDefault();
          onFlip();
        }
      }}
      role="button"
      tabIndex={0}
      data-testid={testId}
    >
      <motion.div
        className="relative w-full h-full"
        style={{ transformStyle: "preserve-3d" }}
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ duration: 0.6, ease: "easeInOut" }}
      >
        {/* Front */}
        <div
          className={`absolute inset-0 w-full h-full rounded-xl shadow-lg transition-all duration-200 hover:shadow-xl bg-gradient-to-br from-${colorClass}-50 to-${colorClass}-100 dark:from-${colorClass}-950 dark:to-${colorClass}-900 border ${colors.border}`}
          style={{ backfaceVisibility: "hidden" }}
        >
          <div className="p-6 h-full flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm font-medium ${colors.light}`}>{slide.title}</p>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentSlide}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                  >
                    <p className={`text-4xl font-bold ${colors.dark}`} data-testid={`stat-${testId}`}>
                      {slide.value}
                    </p>
                  </motion.div>
                </AnimatePresence>
              </div>
              <div className={`h-14 w-14 bg-${colorClass}-200 dark:bg-${colorClass}-800 rounded-full flex items-center justify-center`}>
                {icon}
              </div>
            </div>
            <div className="space-y-1">
              {slide.subtitle && <p className={`text-xs font-medium ${colors.dark}`}>{slide.subtitle}</p>}
              <div className="flex gap-1">
                {slides.map((_, idx) => (
                  <div
                    key={idx}
                    className={`h-1 flex-1 rounded-full transition-all ${
                      idx === currentSlide ? `bg-${colorClass}-600 dark:bg-${colorClass}-400` : `bg-${colorClass}-300 dark:bg-${colorClass}-700`
                    }`}
                  />
                ))}
              </div>
              <p className={`text-xs font-medium ${colors.dark} mt-1`}>{frontLabel}</p>
            </div>
          </div>
        </div>

        {/* Back - Mirror of front but with chevron to flip back */}
        <div
          className={`absolute inset-0 w-full h-full rounded-xl shadow-lg bg-gradient-to-br from-${colorClass}-100 to-${colorClass}-200 dark:from-${colorClass}-900 dark:to-${colorClass}-950 border ${colors.border}`}
          style={{
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
          }}
        >
          <div className="p-6 h-full flex flex-col justify-between items-center text-center">
            <p className={`text-xs font-bold ${colors.light}`}>Click card to view details</p>
            <div className="text-4xl">↺</div>
            <p className={`text-xs font-medium ${colors.dark}`}>Tap to go back</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
