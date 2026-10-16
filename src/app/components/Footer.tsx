"use client";

import { Mail, MessageCircle, MapPin } from "lucide-react";
import { useTranslation } from "react-i18next";
import { siteConfig } from "../lib/siteConfig";
import { WHATSAPP_URL } from "../lib/constants";

const FULL_LOGO_SRC = "/brand/rueda-logo-full.png";

export function Footer() {
  const { t } = useTranslation();
  return (
    <footer
      id="contact"
      className="border-t border-white/5 bg-[#0e0e0e] px-6 pt-20 pb-12 lg:px-12 lg:pt-24"
    >
      <div className="mx-auto max-w-[1400px]">
        <div className="mb-20 grid grid-cols-1 gap-14 md:mb-24 md:grid-cols-2 md:gap-16 lg:gap-24">
          <div>
            <h4 className="mb-4 tracking-wide text-white/90">{t("footer.services")}</h4>
            <ul className="space-y-2">
              <li>
                <a
                  href="#services"
                  className="text-sm tracking-wide text-white/40 transition-colors hover:text-white/70"
                >
                  Rueda Executive
                </a>
              </li>
              <li>
                <a
                  href="#services"
                  className="text-sm tracking-wide text-white/40 transition-colors hover:text-white/70"
                >
                  Rueda Black
                </a>
              </li>
              <li>
                <a
                  href="#services"
                  className="text-sm tracking-wide text-white/40 transition-colors hover:text-white/70"
                >
                  Rueda Mobility
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="mb-4 tracking-wide text-white/90">{t("footer.contact")}</h4>
            <ul className="space-y-3">
              <li>
                <a
                  href={`mailto:${siteConfig.contactEmail}`}
                  className="flex items-center gap-2 text-sm tracking-wide text-white/40 transition-colors hover:text-white/70"
                >
                  <Mail className="h-4 w-4 shrink-0" />
                  <span>{siteConfig.contactEmail}</span>
                </a>
              </li>
              <li>
                <a
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm tracking-wide text-white/40 transition-colors hover:text-white/70"
                >
                  <MessageCircle className="h-4 w-4 shrink-0" />
                  <span>{t("header.whatsapp")}</span>
                </a>
              </li>
              <li>
                <div className="flex items-start gap-2 text-sm tracking-wide text-white/40">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    {t("footer.serviceAreas")}
                    <br />
                    {t("footer.serviceAreasValue")}
                  </span>
                </div>
              </li>
            </ul>
          </div>
        </div>

        {/* Brand anchor — full-width statement */}
        <div className="border-t border-white/5 pt-20 pb-20 md:pt-28 md:pb-28">
          <div className="mx-auto flex w-full max-w-[1400px] flex-col items-center px-3 text-center sm:px-4">
            <img
              src={FULL_LOGO_SRC}
              alt={t("footer.logoAlt")}
              width={1024}
              height={320}
              className="mx-auto mt-14 mb-12 h-auto w-full max-w-[94%] object-contain object-center sm:max-w-[92%] md:mt-20 md:mb-16 md:max-w-[90%] lg:max-w-[88%] xl:max-w-6xl"
              decoding="async"
            />
            <p className="max-w-md text-sm leading-relaxed tracking-wide text-white/40 md:max-w-lg">
              {t("footer.brandBody")}
            </p>
            <p className="mt-6 max-w-lg text-xs leading-relaxed tracking-wide text-white/32 md:max-w-xl">
              {t("footer.legalBody")}
            </p>
          </div>
        </div>

        <div className="flex flex-col items-center justify-between gap-6 border-t border-white/5 pt-10 md:flex-row md:items-center">
          <div className="text-center text-xs tracking-wide text-white/30 md:text-left">
            {t("footer.copyright")}
          </div>
          <nav
            className="flex max-w-full flex-wrap justify-center gap-x-5 gap-y-2 md:justify-end"
            aria-label={t("footer.legalAria")}
          >
            <a
              href="#"
              className="text-xs tracking-wide text-white/30 transition-colors hover:text-white/50"
            >
              {t("footer.links.terms")}
            </a>
            <a
              href="#"
              className="text-xs tracking-wide text-white/30 transition-colors hover:text-white/50"
            >
              {t("footer.links.providerTerms")}
            </a>
            <a
              href="#"
              className="text-xs tracking-wide text-white/30 transition-colors hover:text-white/50"
            >
              {t("footer.links.privacy")}
            </a>
            <a
              href="#"
              className="text-xs tracking-wide text-white/30 transition-colors hover:text-white/50"
            >
              {t("footer.links.insurance")}
            </a>
            <a
              href="#"
              className="text-xs tracking-wide text-white/30 transition-colors hover:text-white/50"
            >
              {t("footer.links.disclosures")}
            </a>
            <a
              href="#"
              className="text-xs tracking-wide text-white/30 transition-colors hover:text-white/50"
            >
              {t("footer.links.legal")}
            </a>
          </nav>
        </div>
      </div>
    </footer>
  );
}
