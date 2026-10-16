"use client";

import { Network } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslation } from "react-i18next";

export function AISection() {
  const { t } = useTranslation();
  return (
    <section
      id="ai-coordination"
      className="relative scroll-mt-24 overflow-hidden bg-[#0e0e0e] px-6 py-32 md:scroll-mt-28 lg:px-12"
    >
      {/* Subtle grid pattern */}
      <div className="absolute inset-0 opacity-[0.02]" style={{
        backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
        backgroundSize: '50px 50px'
      }} />
      
      <div className="max-w-[900px] mx-auto relative z-10">
        <motion.div 
          className="text-center mb-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white/5 border border-white/10 mb-8">
            <Network className="w-10 h-10 text-[#c0c0c0]" strokeWidth={1.5} />
          </div>
          
          <h2 className="text-4xl md:text-5xl text-white mb-6 tracking-tight">
            {t("aiSection.title")}
          </h2>
        </motion.div>

        <motion.div 
          className="border border-white/10 bg-[#121212] p-12"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <p className="text-white/70 text-lg leading-relaxed tracking-wide text-center max-w-[700px] mx-auto">
            {t("aiSection.body")}
          </p>
        </motion.div>
      </div>
    </section>
  );
}