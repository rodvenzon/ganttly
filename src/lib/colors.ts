import type { ColorKey } from "./types";
/** Display names for the colour pickers. */
export const colorLabels: Record<ColorKey, string> = {
  gold: "Gold",
  stone: "Stone",
  graphite: "Graphite",
  sand: "Sand",
  champagne: "Champagne",
  dune: "Dune",
  mist: "Mist",
  pearl: "Pearl",
  coral: "Coral",
  lagoon: "Lagoon",
  harbour: "Harbour",
};
export const colorClasses: Record<ColorKey, string> = {
  gold: "fill-phase-gold stroke-brand-accent",
  stone: "fill-phase-stone stroke-brand-muted",
  graphite: "fill-phase-graphite stroke-brand-ink",
  sand: "fill-phase-sand stroke-brand-accent",
  champagne: "fill-phase-champagne stroke-brand-muted",
  dune: "fill-phase-dune stroke-edge-dune",
  mist: "fill-phase-mist stroke-edge-mist",
  pearl: "fill-phase-pearl stroke-edge-pearl",
  coral: "fill-phase-coral stroke-edge-coral",
  lagoon: "fill-phase-lagoon stroke-edge-lagoon",
  harbour: "fill-phase-harbour stroke-edge-harbour",
};
export const avatarClasses: Record<ColorKey, string> = {
  gold: "bg-phase-gold",
  stone: "bg-phase-stone",
  graphite: "bg-phase-graphite",
  sand: "bg-phase-sand",
  champagne: "bg-phase-champagne",
  dune: "bg-phase-dune",
  mist: "bg-phase-mist",
  pearl: "bg-phase-pearl",
  coral: "bg-phase-coral",
  lagoon: "bg-phase-lagoon",
  harbour: "bg-phase-harbour",
};
