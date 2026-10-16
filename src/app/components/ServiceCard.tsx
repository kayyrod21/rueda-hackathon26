import { ImageWithFallback } from "./figma/ImageWithFallback";
import { ArrowRight } from "lucide-react";
import { motion } from "motion/react";
import { useTranslation } from "react-i18next";
import type { Service } from "../data/services";
import { cn } from "./ui/utils";

export type ServiceCardProps = {
  service: Service;
  index: number;
  onSelect: (id: string) => void;
  /** Wider min-width for horizontal carousel slides */
  variant?: "grid" | "carousel";
};

export function ServiceCard({
  service,
  index,
  onSelect,
  variant = "grid",
}: ServiceCardProps) {
  const { t } = useTranslation();
  const isCarousel = variant === "carousel";
  const isBlack = service.id === "black";
  const isExecutive = service.id === "executive";
  const isMobility = service.id === "mobility";

  return (
    <motion.div
      className={cn(isCarousel && "snap-center shrink-0 w-[82vw] max-w-md")}
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, delay: index * 0.08 }}
    >
      <button
        type="button"
        onClick={() => onSelect(service.id)}
        className={cn(
          "group relative w-full overflow-hidden rounded-none text-left transition-all duration-500",
          !isBlack &&
            "border border-white/5 bg-[#121212] hover:border-white/25 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.08)] focus-visible:ring-2 focus-visible:ring-white/30",
          isBlack &&
            "border border-neutral-200/90 bg-white shadow-[0_1px_0_rgba(0,0,0,0.04)] hover:border-neutral-300 hover:shadow-[0_12px_40px_rgba(0,0,0,0.07)] focus-visible:ring-2 focus-visible:ring-neutral-400/60",
          "focus-visible:outline-none focus-visible:ring-offset-2 focus-visible:ring-offset-[#0e0e0e]",
          "active:scale-[0.99] md:active:scale-100",
        )}
        aria-label={`${service.title}: ${t(service.cardSummaryKey)}. ${t("services.viewDetails")}.`}
      >
        <div
          className={cn(
            "relative overflow-hidden",
            isCarousel ? "aspect-[3/4] min-h-[200px]" : "aspect-[4/3]",
          )}
        >
          <ImageWithFallback
            src={service.image}
            alt={t(service.imageAltKey)}
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
          <div
            className={cn(
              "absolute inset-0 bg-gradient-to-t to-transparent",
              isBlack
                ? "from-white via-white/55"
                : "from-[#121212] via-[#121212]/45",
            )}
          />
        </div>

        <div className={cn("p-6", isCarousel && "p-7")}>
          <h3
            className={cn(
              "mb-1.5 text-xl tracking-tight md:text-2xl",
              isExecutive && "text-[#C47A2C]",
              isMobility && "text-[#3FAF7A]",
              isBlack && "text-[#111111]",
              !isExecutive && !isMobility && !isBlack && "text-white",
            )}
          >
            {service.title}
          </h3>
          <p
            className={cn(
              "mb-5 text-sm tracking-wide md:text-base",
              isBlack ? "text-[#444444]" : "text-white/50",
            )}
          >
            {t(service.cardSummaryKey)}
          </p>
          <span
            className={cn(
              "inline-flex items-center gap-2 text-sm tracking-wide transition-colors",
              isBlack
                ? "text-[#111111]/70 group-hover:text-[#111111]"
                : "text-white/65 group-hover:text-white",
            )}
          >
            <span>{t("services.viewDetails")}</span>
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </span>
        </div>
      </button>
    </motion.div>
  );
}
