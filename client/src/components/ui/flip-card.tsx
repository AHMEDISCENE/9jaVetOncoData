import { useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { RotateCcw } from "lucide-react";

interface FlipCardProps {
  frontContent: React.ReactNode;
  backContent: React.ReactNode;
  className?: string;
  frontClassName?: string;
  backClassName?: string;
  flipDuration?: number;
}

export function FlipCard({
  frontContent,
  backContent,
  className,
  frontClassName,
  backClassName,
  flipDuration = 0.6,
}: FlipCardProps) {
  const [isFlipped, setIsFlipped] = useState(false);

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  return (
    <div
      className={cn("perspective-1000 cursor-pointer", className)}
      style={{ perspective: "1000px" }}
      onClick={handleFlip}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleFlip();
        }
      }}
      role="button"
      tabIndex={0}
    >
      <motion.div
        className="relative w-full h-full"
        style={{ transformStyle: "preserve-3d" }}
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ duration: flipDuration, ease: "easeInOut" }}
      >
        <div
          className={cn(
            "absolute inset-0 w-full h-full rounded-xl",
            frontClassName
          )}
          style={{ backfaceVisibility: "hidden" }}
        >
          {frontContent}
        </div>
        <div
          className={cn(
            "absolute inset-0 w-full h-full rounded-xl",
            backClassName
          )}
          style={{
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
          }}
        >
          <div className="relative h-full">
            {backContent}
            <div className="absolute bottom-2 right-2 opacity-60">
              <RotateCcw className="h-4 w-4" />
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
