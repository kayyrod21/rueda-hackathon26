export type Service = {
  id: string;
  title: string;
  subtitleKey: string;
  cardSummaryKey: string;
  descriptionKey: string;
  featuresKey: string;
  fleet: string[];
  image: string;
  imageAltKey: string;
  clarityNotesKey?: string;
  tierFootnoteKey?: string;
};

export const SERVICES: Service[] = [
  {
    id: "executive",
    title: "Rueda Executive",
    subtitleKey: "services.data.executive.subtitle",
    cardSummaryKey: "services.data.executive.cardSummary",
    descriptionKey: "services.data.executive.description",
    featuresKey: "services.data.executive.features",
    clarityNotesKey: "services.data.executive.clarityNotes",
    fleet: ["Tesla Model S", "Tesla Model X", "Mercedes S-Class"],
    image:
      "https://images.unsplash.com/photo-1694889649275-6026059d3887?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxUZXNsYSUyMHdoaXRlJTIwaW50ZXJpb3IlMjBsdXh1cnklMjBtaW5pbWFsaXN0fGVufDF8fHx8MTc3NDgxOTMyN3ww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    imageAltKey: "services.data.executive.imageAlt",
  },
  {
    id: "black",
    title: "Rueda Black",
    subtitleKey: "services.data.black.subtitle",
    cardSummaryKey: "services.data.black.cardSummary",
    descriptionKey: "services.data.black.description",
    featuresKey: "services.data.black.features",
    fleet: ["BMW iX", "Tesla Model S Plaid", "Mercedes EQS"],
    clarityNotesKey: "services.data.black.clarityNotes",
    image:
      "https://images.unsplash.com/photo-1642538033755-b5989e65f686?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxibGFjayUyMEJNVyUyMGVsZWN0cmljJTIwbHV4dXJ5JTIwZXhlY3V0aXZlJTIwbmlnaHR8ZW58MXx8fHwxNzc0ODE5MzI4fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    imageAltKey: "services.data.black.imageAlt",
  },
  {
    id: "mobility",
    title: "Rueda Mobility",
    subtitleKey: "services.data.mobility.subtitle",
    cardSummaryKey: "services.data.mobility.cardSummary",
    descriptionKey: "services.data.mobility.description",
    featuresKey: "services.data.mobility.features",
    fleet: ["Tesla Model 3", "Tesla Model Y", "Various EVs"],
    clarityNotesKey: "services.data.mobility.clarityNotes",
    tierFootnoteKey: "services.data.mobility.tierFootnote",
    image:
      "https://images.unsplash.com/photo-1558707673-f32b85d03815?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxUZXNsYSUyMGZsZWV0JTIwbGluZXVwJTIwbXVsdGlwbGUlMjB2ZWhpY2xlc3xlbnwxfHx8fDE3NzQ4MTkzMjh8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    imageAltKey: "services.data.mobility.imageAlt",
  },
];
