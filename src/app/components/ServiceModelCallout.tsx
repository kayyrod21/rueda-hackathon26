import { motion } from "motion/react";
import { Trans, useTranslation } from "react-i18next";

export function ServiceModelCallout() {
  const { t } = useTranslation();
  return (
    <motion.div
      className="mt-10 border border-white/[0.06] bg-[#121212]/80 px-6 py-8 md:mt-14 md:px-9 md:py-10"
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px 0px" }}
      transition={{ duration: 0.55 }}
    >
      <p className="mb-3 text-[0.65rem] font-medium uppercase tracking-[0.2em] text-white/35">
        {t("services.callout.title")}
      </p>
      <p className="max-w-3xl text-sm leading-relaxed tracking-wide text-white/55 md:text-[0.9375rem]">
        <Trans
          i18nKey="services.callout.body"
          components={{ strong: <span className="text-white/70" /> }}
        />
      </p>
    </motion.div>
  );
}
