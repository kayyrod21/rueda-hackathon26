"use client";

import { Shield, Zap, Coins, Users } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslation } from "react-i18next";

const FEATURE_ICONS = [Shield, Zap, Coins, Users];

export function WhyRueda() {
  const { t } = useTranslation();
  const features = t("whyRueda.features", { returnObjects: true }) as Array<{
    title: string;
    description: string;
  }>;
  return (
    <section className="py-32 px-6 lg:px-12 bg-[#0b0b0b]">
      <div className="max-w-[1400px] mx-auto">
        <motion.div 
          className="text-center mb-6"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div className="w-16 h-[1px] bg-gradient-to-r from-transparent via-[#c0c0c0] to-transparent mb-6 mx-auto" />
          <h2 className="text-4xl md:text-5xl text-white mb-4 tracking-tight">
            {t("whyRueda.title")}
          </h2>
          <p className="text-xl md:text-2xl text-white/60 tracking-tight max-w-[700px] mx-auto">
            {t("whyRueda.subtitle")}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mt-20">
          {features.map((feature, index) => {
            const Icon = FEATURE_ICONS[index];
            return (
              <motion.div 
                key={index} 
                className="text-center"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <div className="inline-flex items-center justify-center w-16 h-16 bg-white/5 border border-white/10 mb-6">
                  <Icon className="w-7 h-7 text-[#c0c0c0]" strokeWidth={1.5} />
                </div>
                
                <h3 className="text-xl text-white mb-3 tracking-tight">
                  {feature.title}
                </h3>
                
                <p className="text-white/50 text-sm tracking-wide leading-relaxed">
                  {feature.description}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}