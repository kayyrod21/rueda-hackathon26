"use client";

import { MessageSquare, Cpu, Zap, CheckCircle2 } from "lucide-react";
import { motion } from "motion/react";
import { useTranslation } from "react-i18next";
import { cn } from "./ui/utils";

const STEP_ICONS = [MessageSquare, Cpu, Zap, CheckCircle2];

const stepCardClass =
  "group relative border border-white/5 bg-[#121212] p-8 transition-all hover:border-white/20";

function scrollToAiCoordination() {
  document
    .getElementById("ai-coordination")
    ?.scrollIntoView({ behavior: "smooth" });
}

function scrollToPaymentMethods() {
  document
    .getElementById("payment-methods")
    ?.scrollIntoView({ behavior: "smooth" });
}

export function HowItWorks() {
  const { t } = useTranslation();
  const steps = t("howItWorks.steps", { returnObjects: true }) as Array<{
    title: string;
    description: string;
  }>;

  return (
    <section id="how-it-works" className="bg-[#0e0e0e] px-6 py-32 lg:px-12">
      <div className="mx-auto max-w-[1400px]">
        <motion.div
          className="mb-20 text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div className="mx-auto mb-6 h-px w-16 bg-gradient-to-r from-transparent via-[#c0c0c0] to-transparent" />
          <h2 className="mb-4 text-4xl tracking-tight text-white md:text-5xl">
            {t("howItWorks.title")}
          </h2>
          <p className="text-lg tracking-wide text-white/50">
            {t("howItWorks.subtitle")}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => {
            const Icon = STEP_ICONS[index];
            const isAiStep = index === 1;
            const isPaymentStep = index === 2;

            const cardBody = (
              <>
                <div className="absolute -top-3 -left-3 flex h-6 w-6 items-center justify-center bg-[#c0c0c0] text-sm font-medium text-[#0b0b0b]">
                  {index + 1}
                </div>

                <div className="mb-6">
                  <Icon
                    className="h-10 w-10 text-[#c0c0c0]"
                    strokeWidth={1.5}
                  />
                </div>

                <h3 className="mb-3 text-xl tracking-tight text-white">
                  {step.title}
                </h3>

                <p className="text-sm leading-relaxed tracking-wide text-white/50">
                  {step.description}
                </p>
              </>
            );

            return (
              <motion.div
                key={index}
                className="relative"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                {index < steps.length - 1 && (
                  <div className="absolute top-12 left-[calc(50%+2rem)] hidden h-px w-[calc(100%-4rem)] bg-gradient-to-r from-white/20 to-white/5 lg:block" />
                )}

                {isAiStep || isPaymentStep ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (isAiStep) scrollToAiCoordination();
                      else scrollToPaymentMethods();
                    }}
                    className={cn(
                      stepCardClass,
                      "w-full cursor-pointer text-left transition-opacity hover:opacity-[0.92] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0e0e0e]",
                    )}
                  >
                    {cardBody}
                  </button>
                ) : (
                  <div className={stepCardClass}>{cardBody}</div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
