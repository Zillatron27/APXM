/**
 * Converts a PrUn production-line type key (lowerCamelCase, e.g.
 * "smallComponentsAssembly") into the friendly building name APEX shows
 * ("Small Components Assembly"). PrUn sends only the camelCase key on
 * `ProductionLine.type` — there is no separate name field — so the friendly
 * label is derived by splitting on capitals and title-casing the first letter.
 * This produces APEX's exact names ("advancedAppliancesFactory" →
 * "Advanced Appliances Factory").
 */
export function formatBuildingName(type: string): string {
  if (!type) return type;
  const spaced = type.replace(/([A-Z])/g, ' $1').trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
