"use client";

import React, {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { motion } from "motion/react";
import { useTranslation } from "react-i18next";
import { SERVICES, type Service } from "../data/services";
import { ServiceCard } from "./ServiceCard";
import { ServiceModal } from "./ServiceModal";
import type { UserServicePreference } from "../lib/conciergeMarket";
import { ServiceModelCallout } from "./ServiceModelCallout";

type ServiceCardsProps = {
  /** Opens AI Concierge with a tier preselected (single booking path) */
  onRequestConciergeLaunch?: (launch: {
    initialServicePreference: UserServicePreference;
    source: string;
  }) => void;
};

export function ServiceCards({ onRequestConciergeLaunch }: ServiceCardsProps) {
  const { t } = useTranslation();
  const [activeService, setActiveService] = useState<Service | undefined>();
  const [modalOpen, setModalOpen] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  const handleSelect = useCallback((id: string) => {
    const next = SERVICES.find((s) => s.id === id);
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setActiveService(next);
    setModalOpen(true);
  }, []);

  const handleOpenChange = useCallback((open: boolean) => {
    setModalOpen(open);
    if (!open) {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      closeTimerRef.current = setTimeout(() => {
        setActiveService(undefined);
        closeTimerRef.current = null;
      }, 280);
    }
  }, []);

  return (
    <Fragment>
      <section
        id="service-details"
        className="scroll-mt-24 overflow-visible bg-[#0e0e0e] px-6 pb-10 pt-7 md:scroll-mt-28 md:px-12 md:pb-14 md:pt-9"
      >
        <div className="mx-auto max-w-[1400px]">
          <motion.div
            className="mb-5 md:mb-7"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-24px 0px -60px 0px", amount: 0.2 }}
            transition={{ duration: 0.6 }}
          >
            <div className="mb-3 h-px w-16 bg-gradient-to-r from-[#c0c0c0] to-transparent md:mb-4" />
            <h2 className="mb-0 text-4xl font-normal leading-[1.18] tracking-tight text-white md:text-5xl md:leading-[1.12]">
              {t("services.sectionTitle")}
            </h2>
          </motion.div>

          {/* Mobile / small tablet: horizontal carousel */}
          <div
            className="flex snap-x snap-mandatory gap-4 overflow-x-auto overflow-y-visible scroll-pl-6 pb-3 pl-6 pr-4 [-ms-overflow-style:none] [scrollbar-width:none] md:hidden [&::-webkit-scrollbar]:hidden"
            role="list"
            aria-label={t("services.listAria")}
          >
            {SERVICES.map((service, index) => (
              <div key={service.id} role="listitem">
                <ServiceCard
                  service={service}
                  index={index}
                  onSelect={handleSelect}
                  variant="carousel"
                />
              </div>
            ))}
            <div className="w-1 shrink-0" aria-hidden />
          </div>

          {/* Desktop / tablet grid */}
          <div
            className="hidden grid-cols-3 gap-6 md:grid"
            role="list"
            aria-label={t("services.listAria")}
          >
            {SERVICES.map((service, index) => (
              <div key={service.id} role="listitem">
                <ServiceCard
                  service={service}
                  index={index}
                  onSelect={handleSelect}
                  variant="grid"
                />
              </div>
            ))}
          </div>

          <ServiceModelCallout />
        </div>
      </section>

      <ServiceModal
        service={activeService}
        open={modalOpen}
        onOpenChange={handleOpenChange}
        onBookNow={
          activeService?.id === "executive"
            ? () => {
                onRequestConciergeLaunch?.({
                  initialServicePreference: "executive",
                  source: "executive_detail",
                });
                handleOpenChange(false);
              }
            : activeService?.id === "black"
              ? () => {
                  onRequestConciergeLaunch?.({
                    initialServicePreference: "black",
                    source: "black_detail",
                  });
                  handleOpenChange(false);
                }
              : activeService?.id === "mobility"
                ? () => {
                    onRequestConciergeLaunch?.({
                      initialServicePreference: "mobility",
                      source: "mobility_detail",
                    });
                    handleOpenChange(false);
                  }
                : undefined
        }
        primaryCtaLabel={
          activeService?.id === "executive"
            ? t("services.modal.executiveContinue")
            : undefined
        }
      />
    </Fragment>
  );
}
