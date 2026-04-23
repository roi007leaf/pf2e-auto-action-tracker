const ECONOMY_CONDITION_SLUGS = new Set(["quickened", "slowed", "stunned", "paralyzed"]);

export function isEconomyConditionSlug(slug?: string | null): boolean {
    return !!slug && ECONOMY_CONDITION_SLUGS.has(slug);
}

export function hasEconomyRelevantActorUpdate(updateData: any): boolean {
    return "max" in (updateData?.system?.resources?.reactions ?? {});
}
