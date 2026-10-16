"use client";

import { Bitcoin, CreditCard } from "lucide-react";
import { motion } from "motion/react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { useTranslation } from "react-i18next";
import { cn } from "./ui/utils";
import { useIsMobile } from "./ui/use-mobile";

/** Matches Rueda Executive service title accent */
const BITCOIN_HEADING_CLASS = "text-[#C47A2C]";

const USDT_SRC = "/brand/payment-usdt.png";
const RGB_SRC = "/brand/payment-rgb.png";

const BITCOIN_RAILS: {
  id: string;
  label: string;
  render: () => ReactNode;
}[] = [
  {
    id: "lightning",
    label: "Lightning",
    render: () => (
      <span className="text-[1.15rem] leading-none" aria-hidden>
        ⚡
      </span>
    ),
  },
  {
    id: "liquid",
    label: "Liquid",
    render: () => (
      <span className="text-[1.05rem] leading-none" aria-hidden>
        💧
      </span>
    ),
  },
  {
    id: "usdt",
    label: "USDT",
    render: () => (
      <img
        src={USDT_SRC}
        alt=""
        width={28}
        height={28}
        className="h-6 w-6 object-contain"
        decoding="async"
      />
    ),
  },
  {
    id: "ark",
    label: "ARK",
    render: () => (
      <span className="text-[1.05rem] leading-none" aria-hidden>
        👾
      </span>
    ),
  },
  {
    id: "cashu",
    label: "Cashu",
    render: () => (
      <span className="text-[1.05rem] leading-none" aria-hidden>
        🥜
      </span>
    ),
  },
  {
    id: "rgb",
    label: "RGB",
    render: () => (
      <img
        src={RGB_SRC}
        alt=""
        width={28}
        height={28}
        className="h-6 w-6 object-contain"
        decoding="async"
      />
    ),
  },
  {
    id: "onchain",
    label: "On-chain",
    render: () => (
      <span className="text-[1.05rem] leading-none" aria-hidden>
        ⛓️‍💥
      </span>
    ),
  },
];

const TRADITIONAL_BRANDS: {
  id: string;
  label: string;
  render: () => ReactNode;
}[] = [
  {
    id: "visa",
    label: "Visa",
    render: () => (
      <span
        className="font-semibold text-[11px] italic tracking-[0.2em] text-white/75"
        aria-hidden
      >
        VISA
      </span>
    ),
  },
  {
    id: "mastercard",
    label: "Mastercard",
    render: () => (
      <div
        className="flex h-8 w-10 items-center justify-center"
        aria-hidden
      >
        <span className="-mr-2 h-5 w-5 rounded-full bg-white/32 ring-1 ring-white/[0.12]" />
        <span className="h-5 w-5 rounded-full bg-white/18 ring-1 ring-white/[0.12]" />
      </div>
    ),
  },
  {
    id: "amex",
    label: "American Express",
    render: () => (
      <span
        className="text-center text-[7px] font-bold leading-tight tracking-wide text-white/68"
        aria-hidden
      >
        AMERICAN
        <br />
        EXPRESS
      </span>
    ),
  },
  {
    id: "discover",
    label: "Discover",
    render: () => (
      <span
        className="text-[9px] font-semibold tracking-widest text-white/72"
        aria-hidden
      >
        DISCOVER
      </span>
    ),
  },
];

const disclosurePanelInner =
  "rounded-sm border border-white/[0.07] bg-[#161616] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]";

const iconShellClass =
  "flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-sm border border-transparent transition-[filter,opacity,border-color] duration-200 hover:brightness-110 hover:opacity-95 md:hover:border-white/10";

function disclosureSurfaceClass(isMobile: boolean, show: boolean): string {
  if (isMobile) {
    return cn(
      "overflow-hidden transition-[max-height,opacity,transform] duration-300 ease-out",
      show
        ? "mt-4 max-h-[640px] translate-y-0 opacity-100"
        : "max-h-0 translate-y-2 opacity-0",
    );
  }
  return cn(
    "overflow-hidden transition-[max-height,opacity,transform] duration-300 ease-out",
    "max-h-0 translate-y-2 opacity-0 pointer-events-none",
    "md:group-hover:pointer-events-auto md:group-hover:mt-4 md:group-hover:max-h-[640px] md:group-hover:translate-y-0 md:group-hover:opacity-100",
  );
}

type IconDisclosureSlotProps = {
  id: string;
  label: string;
  isMobile: boolean;
  activeId: string | null;
  setActiveId: Dispatch<SetStateAction<string | null>>;
  children: ReactNode;
};

function IconDisclosureSlot({
  id,
  label,
  isMobile,
  activeId,
  setActiveId,
  children,
}: IconDisclosureSlotProps) {
  const tapped = isMobile && activeId === id;

  return (
    <div className="group/slot flex min-h-[3.25rem] flex-col items-center">
      <button
        type="button"
        className={iconShellClass}
        aria-label={label}
        aria-pressed={isMobile ? tapped : undefined}
        onClick={(e) => {
          e.stopPropagation();
          if (isMobile) setActiveId((cur) => (cur === id ? null : id));
        }}
      >
        {children}
      </button>
      <span
        className={cn(
          "mt-1 max-w-[5.5rem] text-center text-[10px] leading-tight tracking-wide text-white/55 transition-all duration-200",
          isMobile
            ? tapped
              ? "translate-y-0 opacity-100"
              : "pointer-events-none h-0 overflow-hidden opacity-0"
            : "translate-y-0.5 opacity-0 md:group-hover/slot:translate-y-0 md:group-hover/slot:opacity-100",
        )}
      >
        {label}
      </span>
    </div>
  );
}

export function PaymentMethods() {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [bitcoinOpen, setBitcoinOpen] = useState(false);
  const [traditionalOpen, setTraditionalOpen] = useState(false);
  const [bitcoinHover, setBitcoinHover] = useState(false);
  const [traditionalHover, setTraditionalHover] = useState(false);
  const [bitcoinRailActive, setBitcoinRailActive] = useState<string | null>(
    null,
  );
  const [traditionalBrandActive, setTraditionalBrandActive] = useState<
    string | null
  >(null);

  const bitcoinRef = useRef<HTMLDivElement>(null);
  const traditionalRef = useRef<HTMLDivElement>(null);

  const showBitcoin = isMobile ? bitcoinOpen : bitcoinHover;
  const showTraditional = isMobile ? traditionalOpen : traditionalHover;

  useEffect(() => {
    if (!bitcoinOpen) setBitcoinRailActive(null);
  }, [bitcoinOpen]);

  useEffect(() => {
    if (!traditionalOpen) setTraditionalBrandActive(null);
  }, [traditionalOpen]);

  useEffect(() => {
    if (!isMobile) return;

    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!bitcoinRef.current?.contains(t)) setBitcoinOpen(false);
      if (!traditionalRef.current?.contains(t)) setTraditionalOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [isMobile]);

  const toggleBitcoin = useCallback(() => {
    if (isMobile) setBitcoinOpen((o) => !o);
  }, [isMobile]);

  const toggleTraditional = useCallback(() => {
    if (isMobile) setTraditionalOpen((o) => !o);
  }, [isMobile]);

  return (
    <section
      id="payment-methods"
      className="scroll-mt-24 bg-[#0e0e0e] px-6 py-32 md:scroll-mt-28 lg:px-12"
    >
      <div className="mx-auto max-w-[1000px]">
        <motion.div
          className="mb-16 text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div className="mx-auto mb-6 h-px w-16 bg-gradient-to-r from-transparent via-[#c0c0c0] to-transparent" />
          <h2 className="mb-4 text-4xl tracking-tight text-white md:text-5xl">
            {t("payments.title")}
          </h2>
          <p className="mx-auto max-w-[560px] text-lg tracking-wide text-white/55">
            {t("payments.subtitle")}
          </p>
          <p className="mx-auto mt-4 max-w-[520px] text-xs tracking-wide text-white/35">
            {t("payments.marketNote")}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <motion.div
            ref={bitcoinRef}
            className={cn(
              "group relative border border-white/10 bg-[#121212] p-8 transition-all hover:border-white/20",
              isMobile && "cursor-pointer",
              !isMobile && "md:cursor-default",
            )}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            onMouseEnter={() => {
              if (!isMobile) setBitcoinHover(true);
            }}
            onMouseLeave={() => {
              if (!isMobile) setBitcoinHover(false);
            }}
            onClick={toggleBitcoin}
            onKeyDown={(e) => {
              if (isMobile && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault();
                toggleBitcoin();
              }
            }}
            role={isMobile ? "button" : undefined}
            tabIndex={isMobile ? 0 : undefined}
            aria-expanded={isMobile ? bitcoinOpen : undefined}
            aria-controls="bitcoin-payment-disclosure"
          >
            <div className="mb-4 flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center border border-white/10 bg-white/5">
                <Bitcoin className="h-6 w-6 text-[#c0c0c0]" strokeWidth={1.5} />
              </div>
              <h3
                className={cn(
                  "text-2xl tracking-tight",
                  BITCOIN_HEADING_CLASS,
                )}
              >
                Bitcoin
              </h3>
            </div>

            <p className="text-sm leading-relaxed tracking-wide text-white/50">
              {t("payments.bitcoinDescription")}
            </p>

            <div
              id="bitcoin-payment-disclosure"
              className={disclosureSurfaceClass(isMobile, showBitcoin)}
              aria-hidden={!showBitcoin}
              onClick={(e) => isMobile && e.stopPropagation()}
              onPointerDown={(e) => isMobile && e.stopPropagation()}
            >
              <div className={disclosurePanelInner}>
                <p className="mb-4 text-xs tracking-widest text-white/40 uppercase">
                  {t("payments.bitcoinSupported")}
                </p>
                <div className="flex flex-wrap justify-center gap-x-4 gap-y-5 sm:justify-start">
                  {BITCOIN_RAILS.map((rail) => (
                    <IconDisclosureSlot
                      key={rail.id}
                      id={rail.id}
                      label={rail.label}
                      isMobile={isMobile}
                      activeId={bitcoinRailActive}
                      setActiveId={setBitcoinRailActive}
                    >
                      {rail.render()}
                    </IconDisclosureSlot>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            ref={traditionalRef}
            className={cn(
              "group relative border border-white/10 bg-[#121212] p-8 transition-all hover:border-white/20",
              isMobile && "cursor-pointer",
              !isMobile && "md:cursor-default",
            )}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            onMouseEnter={() => {
              if (!isMobile) setTraditionalHover(true);
            }}
            onMouseLeave={() => {
              if (!isMobile) setTraditionalHover(false);
            }}
            onClick={toggleTraditional}
            onKeyDown={(e) => {
              if (isMobile && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault();
                toggleTraditional();
              }
            }}
            role={isMobile ? "button" : undefined}
            tabIndex={isMobile ? 0 : undefined}
            aria-expanded={isMobile ? traditionalOpen : undefined}
            aria-controls="traditional-payment-disclosure"
          >
            <div className="mb-4 flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center border border-white/10 bg-white/5">
                <CreditCard
                  className="h-6 w-6 text-[#c0c0c0]"
                  strokeWidth={1.5}
                />
              </div>
              <h3 className="text-2xl tracking-tight text-white">
                {t("payments.traditionalTitle")}
              </h3>
            </div>

            <p className="text-sm leading-relaxed tracking-wide text-white/50">
              {t("payments.traditionalDescription")}
            </p>

            <div
              id="traditional-payment-disclosure"
              className={disclosureSurfaceClass(isMobile, showTraditional)}
              aria-hidden={!showTraditional}
              onClick={(e) => isMobile && e.stopPropagation()}
              onPointerDown={(e) => isMobile && e.stopPropagation()}
            >
              <div className={disclosurePanelInner}>
                <p className="mb-4 text-xs tracking-widest text-white/40 uppercase">
                  {t("payments.cardTypes")}
                </p>
                <div className="mb-5 flex flex-wrap justify-center gap-x-5 gap-y-5 sm:justify-start">
                  {TRADITIONAL_BRANDS.map((brand) => (
                    <IconDisclosureSlot
                      key={brand.id}
                      id={brand.id}
                      label={brand.label}
                      isMobile={isMobile}
                      activeId={traditionalBrandActive}
                      setActiveId={setTraditionalBrandActive}
                    >
                      {brand.render()}
                    </IconDisclosureSlot>
                  ))}
                </div>
                <p className="text-xs leading-relaxed tracking-wide text-white/35">
                  {t("payments.processingNote")}
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
