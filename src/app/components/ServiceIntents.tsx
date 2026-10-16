"use client";

import { ArrowRight, Car, CarTaxiFront } from "lucide-react";
import { motion } from "motion/react";
import { useTranslation } from "react-i18next";
import type { UserServicePreference } from "../lib/conciergeMarket";

type ServiceIntentsProps = {
  onRequestConciergeLaunch?: (launch: {
    initialServicePreference: UserServicePreference;
    source: string;
  }) => void;
};

const INTENTS: {
  id: "private" | "rental";
  Icon: typeof Car;
  preference: UserServicePreference;
  source: string;
}[] = [
  {
    id: "private",
    Icon: CarTaxiFront,
    preference: "executive",
    source: "intent_private_driver",
  },
  {
    id: "rental",
    Icon: Car,
    preference: "black",
    source: "intent_vehicle_rental",
  },
];

export function ServiceIntents({
  onRequestConciergeLaunch,
}: ServiceIntentsProps) {
  const { t } = useTranslation();

  return (
    <section
      id="services"
      className="scroll-mt-24 bg-[#0e0e0e] px-6 py-20 md:scroll-mt-28 md:px-12 md:py-24"
    >
      <div className="mx-auto max-w-[1400px]">
        <motion.div
          className="mb-12 text-center md:mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div className="mx-auto mb-6 h-px w-16 bg-gradient-to-r from-transparent via-[#c0c0c0] to-transparent" />
          <h2 className="mb-4 text-4xl tracking-tight text-white md:text-5xl">
            {t("serviceIntents.title")}
          </h2>
          <p className="mx-auto max-w-[600px] text-lg tracking-wide text-white/55">
            {t("serviceIntents.subtitle")}
          </p>
        </motion.div>

        <div
          className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8"
          role="list"
          aria-label={t("serviceIntents.title")}
        >
          {INTENTS.map((intent, index) => {
            const Icon = intent.Icon;
            return (
              <motion.div
                key={intent.id}
                role="listitem"
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <button
                  type="button"
                  onClick={() =>
                    onRequestConciergeLaunch?.({
                      initialServicePreference: intent.preference,
                      source: intent.source,
                    })
                  }
                  className="group relative flex w-full flex-col items-start gap-4 border border-white/5 bg-[#121212] p-8 text-left transition-all duration-500 hover:border-white/25 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0e0e0e] active:scale-[0.99] md:p-10 md:active:scale-100"
                >
                  <div className="flex h-14 w-14 items-center justify-center border border-white/10 bg-white/5">
                    <Icon
                      className="h-6 w-6 text-[#c0c0c0]"
                      strokeWidth={1.5}
                    />
                  </div>
                  <h3 className="text-2xl tracking-tight text-white">
                    {t(`serviceIntents.${intent.id}.title`)}
                  </h3>
                  <p className="text-sm leading-relaxed tracking-wide text-white/55 md:text-base">
                    {t(`serviceIntents.${intent.id}.description`)}
                  </p>
                  <span className="mt-2 inline-flex items-center gap-2 text-sm tracking-wide text-white/65 transition-colors group-hover:text-white">
                    <span>{t("serviceIntents.action")}</span>
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </span>
                </button>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
