"use client";

import { ArrowRight, MapPin } from "lucide-react";
import { motion } from "motion/react";
import { useTranslation } from "react-i18next";
import { SERVICES } from "../data/services";
import type { UserServicePreference } from "../lib/conciergeMarket";
import { ImageWithFallback } from "./figma/ImageWithFallback";

type MedellinSpotlightProps = {
  onRequestConciergeLaunch?: (launch: {
    initialServicePreference: UserServicePreference;
    source: string;
  }) => void;
};

const EXECUTIVE_IMAGE =
  SERVICES.find((s) => s.id === "executive")?.image ?? "";

export function MedellinSpotlight({
  onRequestConciergeLaunch,
}: MedellinSpotlightProps) {
  const { t } = useTranslation();

  return (
    <section className="bg-[#0e0e0e] px-6 pb-20 md:px-12 md:pb-24">
      <div className="mx-auto max-w-[1400px]">
        <motion.div
          className="relative overflow-hidden border border-white/10"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6 }}
        >
          <div className="relative aspect-[4/5] w-full sm:aspect-[16/9] md:aspect-[21/9]">
            <ImageWithFallback
              src={EXECUTIVE_IMAGE}
              alt={t("medellinSpotlight.imageAlt")}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0b0b0b] via-[#0b0b0b]/60 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#0b0b0b]/55 to-transparent" />
          </div>

          <div className="absolute inset-x-0 bottom-0 flex flex-col items-start gap-3 p-6 md:p-10 lg:p-12">
            <div className="flex items-center gap-2 text-[0.65rem] font-medium uppercase tracking-[0.2em] text-white/55">
              <MapPin className="h-3.5 w-3.5" strokeWidth={1.5} />
              <span>{t("medellinSpotlight.eyebrow")}</span>
            </div>
            <h2 className="text-3xl tracking-tight text-[#C47A2C] md:text-4xl">
              {t("medellinSpotlight.title")}
            </h2>
            <p className="max-w-md text-sm leading-relaxed tracking-wide text-white/72 md:text-base">
              {t("medellinSpotlight.body")}
            </p>
            <button
              type="button"
              onClick={() =>
                onRequestConciergeLaunch?.({
                  initialServicePreference: "executive",
                  source: "medellin_spotlight",
                })
              }
              className="group mt-2 inline-flex items-center gap-3 bg-white px-6 py-3.5 text-sm tracking-wide text-[#0b0b0b] transition-all hover:bg-[#c0c0c0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0b0b]"
            >
              <span>{t("medellinSpotlight.cta")}</span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
