"use client";

import { ImageWithFallback } from './figma/ImageWithFallback';
import { Sparkles, MessageCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslation } from "react-i18next";

type HeroProps = {
  onOpenAiConcierge?: () => void;
};

export function Hero({ onOpenAiConcierge }: HeroProps) {
  const { t } = useTranslation();
  return (
    <section className="relative flex min-h-[86svh] items-start justify-center overflow-hidden bg-[#0b0b0b] pb-4 sm:min-h-[88svh] md:min-h-[90svh] lg:pb-6">
      {/* Background Image */}
      <div className="absolute inset-0">
        <ImageWithFallback 
          src="https://images.unsplash.com/photo-1768352842016-0d7dadc9d998?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjBibGFjayUyMFRlc2xhJTIwZXhlY3V0aXZlJTIwY2FyfGVufDF8fHx8MTc3NDgxODU0NXww&ixlib=rb-4.1.0&q=80&w=1080"
          alt={t("hero.imageAlt")}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0b0b0b]/70 via-[#0b0b0b]/80 to-[#0b0b0b]" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0b0b0b]/50 to-transparent" />
      </div>

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-[1400px] px-6 pt-28 sm:pt-32 lg:px-12 lg:pt-36">
        <motion.div 
          className="max-w-[800px]"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          {/* Metallic accent line */}
          <motion.div 
            className="w-16 h-[1px] bg-gradient-to-r from-[#c0c0c0] to-transparent mb-8"
            initial={{ width: 0 }}
            animate={{ width: 64 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          />
          
          <h1 className="text-5xl md:text-7xl tracking-tight mb-6 text-white leading-[1.1]">
            {t("hero.titleLine1")}<br />
            <span className="text-white/70">{t("hero.titleLine2")}</span>
          </h1>
          
          <p className="text-lg md:text-xl text-white/60 mb-12 max-w-[600px] leading-relaxed tracking-wide">
            {t("hero.description")}
          </p>

          <motion.div 
            className="flex flex-col sm:flex-row gap-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <button
              type="button"
              onClick={() => onOpenAiConcierge?.()}
              className="group flex items-center justify-center gap-3 bg-white px-8 py-4 tracking-wide text-[#0b0b0b] transition-all hover:bg-[#c0c0c0]"
            >
              <Sparkles className="h-5 w-5" />
              <span>{t("hero.ctaAi")}</span>
            </button>
            
            <button className="px-8 py-4 bg-white/10 hover:bg-white/15 text-white transition-all border border-white/20 hover:border-white/30 flex items-center justify-center gap-3 tracking-wide">
              <MessageCircle className="w-5 h-5" />
              <span>{t("hero.ctaWhatsapp")}</span>
            </button>
          </motion.div>

          <div className="mt-4 lg:mt-5">
            <a href="#services" className="text-sm tracking-widest text-white/40 uppercase transition-colors hover:text-white/60">
              {t("hero.exploreServices")}
            </a>
          </div>
        </motion.div>
      </div>

      {/* Bottom gradient fade */}
      <div className="pointer-events-none absolute right-0 bottom-0 left-0 h-16 bg-gradient-to-t from-[#0e0e0e] to-transparent md:h-20" />
    </section>
  );
}