const ECONOMY_CONDITION_SLUGS = new Set(["quickened", "slowed", "stunned", "paralyzed"]);

export function isEconomyConditionSlug(slug?: string | null): boolean {
    return !!slug && ECONOMY_CONDITION_SLUGS.has(slug);
}

export function shouldRefreshEconomyImmediatelyForCondition(slug?: string | null): boolean {
    return isEconomyConditionSlug(slug) && slug !== "stunned";
}

export function shouldRefreshEconomyImmediatelyForActor(actor: any, updateData: any): boolean {
    if (!hasEconomyRelevantActorUpdate(updateData)) return false;
    return !actor?.hasCondition?.("stunned");
}

export function hasEconomyRelevantActorUpdate(updateData: any): boolean {
    return "max" in (updateData?.system?.resources?.reactions ?? {});
}
