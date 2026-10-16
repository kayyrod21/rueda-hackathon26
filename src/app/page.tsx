import type { Metadata } from "next";
import { HomeProviders } from "./components/HomeProviders";
import { HomeHeader, HomeHero, HomeServiceIntents, HomeMedellinSpotlight, HomeServiceCards } from "./components/HomeControls";
import { HowItWorks } from "./components/HowItWorks";
import { WhyRueda } from "./components/WhyRueda";
import { PaymentMethods } from "./components/PaymentMethods";
import { AISection } from "./components/AISection";
import { Footer } from "./components/Footer";

export const metadata: Metadata = { alternates: { canonical: "/" } };

export default function HomePage() {
  return (
    <div id="top" className="min-h-screen bg-[#0b0b0b]">
      <HomeProviders>
        <HomeHeader />
        <main>
          <HomeHero />
          <HomeServiceIntents />
          <HomeMedellinSpotlight />
          <HowItWorks />
          <WhyRueda />
          <HomeServiceCards />
          <PaymentMethods />
          <AISection />
        </main>
        <Footer />
      </HomeProviders>
    </div>
  );
}
