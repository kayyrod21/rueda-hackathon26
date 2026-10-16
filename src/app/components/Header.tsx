"use client";

import { MessageCircle, Menu, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { WHATSAPP_URL } from "../lib/constants";

const MARK_SRC = "/brand/rueda-mark.png";

type HeaderProps = {
  onOpenAiConcierge?: () => void;
};

export function Header({ onOpenAiConcierge }: HeaderProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { t, i18n } = useTranslation();

  const setLanguage = (lng: "en" | "es") => {
    void i18n.changeLanguage(lng);
  };

  return (
    <header className="fixed top-0 right-0 left-0 z-50 border-b border-white/5 bg-[#0b0b0b]/85 backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-[1400px] items-center justify-between px-6 lg:px-12">
        <div className="flex min-w-0 items-center gap-6 md:gap-10 lg:gap-12">
          <a
            href="#top"
            className="flex shrink-0 items-center rounded-sm outline-none transition-[filter] duration-200 hover:brightness-110 focus-visible:ring-2 focus-visible:ring-white/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0b0b]"
            aria-label={t("header.homeAria")}
          >
            <img
              src={MARK_SRC}
              alt={t("header.markAlt")}
              width={36}
              height={36}
              className="h-7 w-auto object-contain md:h-9"
              decoding="async"
            />
          </a>
          <nav className="hidden items-center gap-8 md:flex">
            <a
              href="#services"
              className="text-sm tracking-wide text-white/60 transition-colors hover:text-white"
            >
              {t("header.nav.services")}
            </a>
            <a
              href="#how-it-works"
              className="text-sm tracking-wide text-white/60 transition-colors hover:text-white"
            >
              {t("header.nav.howItWorks")}
            </a>
            <a
              href="#contact"
              className="text-sm tracking-wide text-white/60 transition-colors hover:text-white"
            >
              {t("header.nav.contact")}
            </a>
          </nav>
        </div>
        <div className="flex shrink-0 items-center gap-4">
          <div
            className="hidden items-center rounded-sm border border-white/10 p-0.5 md:flex"
            role="group"
            aria-label={t("header.languageToggleAria")}
          >
            <button
              type="button"
              onClick={() => setLanguage("en")}
              className={`px-2 py-1 text-[0.65rem] tracking-wide transition-colors ${i18n.language.startsWith("en") ? "bg-white/15 text-white" : "text-white/55 hover:text-white"}`}
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => setLanguage("es")}
              className={`px-2 py-1 text-[0.65rem] tracking-wide transition-colors ${i18n.language.startsWith("es") ? "bg-white/15 text-white" : "text-white/55 hover:text-white"}`}
            >
              ES
            </button>
          </div>
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden items-center gap-2 px-4 py-2 text-sm tracking-wide text-white/60 transition-colors hover:text-white sm:flex"
          >
            <MessageCircle className="h-4 w-4" />
            <span>{t("header.whatsapp")}</span>
          </a>
          <button
            type="button"
            onClick={() => onOpenAiConcierge?.()}
            className="hidden border border-white/10 bg-white/10 px-6 py-2.5 text-sm tracking-wide text-white transition-all hover:border-white/20 hover:bg-white/15 md:block"
          >
            {t("header.bookNow")}
          </button>
          <button
            type="button"
            className="text-white/60 transition-colors hover:text-white md:hidden"
            aria-expanded={isMobileMenuOpen}
            aria-label={
              isMobileMenuOpen ? t("header.closeMenu") : t("header.openMenu")
            }
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
        </div>
      </div>

      {isMobileMenuOpen && (
        <div className="border-b border-white/5 bg-[#0b0b0b]/95 backdrop-blur-xl md:hidden">
          <nav className="space-y-4 px-6 py-6">
            <a
              href="#services"
              className="block tracking-wide text-white/60 transition-colors hover:text-white"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              {t("header.nav.services")}
            </a>
            <a
              href="#how-it-works"
              className="block tracking-wide text-white/60 transition-colors hover:text-white"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              {t("header.nav.howItWorks")}
            </a>
            <a
              href="#contact"
              className="block tracking-wide text-white/60 transition-colors hover:text-white"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              {t("header.nav.contact")}
            </a>
            <div
              className="flex items-center rounded-sm border border-white/10 p-0.5"
              role="group"
              aria-label={t("header.languageToggleAria")}
            >
              <button
                type="button"
                onClick={() => setLanguage("en")}
                className={`flex-1 px-2 py-1 text-[0.65rem] tracking-wide transition-colors ${i18n.language.startsWith("en") ? "bg-white/15 text-white" : "text-white/55 hover:text-white"}`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setLanguage("es")}
                className={`flex-1 px-2 py-1 text-[0.65rem] tracking-wide transition-colors ${i18n.language.startsWith("es") ? "bg-white/15 text-white" : "text-white/55 hover:text-white"}`}
              >
                ES
              </button>
            </div>
            <div className="space-y-3 pt-4">
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 border border-white/10 px-4 py-3 tracking-wide text-white/60 transition-colors hover:text-white"
              >
                <MessageCircle className="h-4 w-4" />
                <span>{t("header.bookViaWhatsapp")}</span>
              </a>
              <button
                type="button"
                className="w-full border border-white/10 bg-white/10 px-6 py-3 tracking-wide text-white transition-all hover:border-white/20 hover:bg-white/15"
                onClick={() => {
                  onOpenAiConcierge?.();
                  setIsMobileMenuOpen(false);
                }}
              >
                {t("header.bookWithAi")}
              </button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
