"use client";
import { useOpenConcierge } from "./HomeProviders";
import { Header } from "./Header";
import { Hero } from "./Hero";
import { ServiceIntents } from "./ServiceIntents";
import { MedellinSpotlight } from "./MedellinSpotlight";
import { ServiceCards } from "./ServiceCards";
export function HomeHeader() { const open = useOpenConcierge(); return <Header onOpenAiConcierge={() => open()} />; }
export function HomeHero() { const open = useOpenConcierge(); return <Hero onOpenAiConcierge={() => open()} />; }
export function HomeServiceIntents() { const open = useOpenConcierge(); return <ServiceIntents onRequestConciergeLaunch={open} />; }
export function HomeMedellinSpotlight() { const open = useOpenConcierge(); return <MedellinSpotlight onRequestConciergeLaunch={open} />; }
export function HomeServiceCards() { const open = useOpenConcierge(); return <ServiceCards onRequestConciergeLaunch={open} />; }
