import type { ActionLogEntry } from "./ActionManager";

export function isMapRelevantAction(entry: Partial<ActionLogEntry>): boolean {
    return entry.isMapRelevant === true && !entry.actionModifiers?.includes("deferMAP");
}

export function getMapProfile(entry: Partial<ActionLogEntry>): "standard" | "agile" {
    return entry.mapProfile === "agile" ? "agile" : "standard";
}

export function getCurrentMapState(
    log: Array<Partial<ActionLogEntry>>
): { attackCount: number, penalty: 0 | 4 | 5 | 8 | 10, profile: "standard" | "agile" } {
    const attacks = log.filter(isMapRelevantAction);
    const attackCount = attacks.length;

    if (attackCount === 0) return { attackCount, penalty: 0, profile: "standard" };

    const profile = getMapProfile(attacks[attacks.length - 1]);
    if (attackCount === 1) {
        return { attackCount, penalty: profile === "agile" ? 4 : 5, profile };
    }

    return { attackCount, penalty: profile === "agile" ? 8 : 10, profile };
}

export function getMapTier(map: { attackCount: number } | { penalty: number }): 0 | 1 | 2 {
    if ("penalty" in map) {
        if (map.penalty <= 0) return 0;
        if (map.penalty === 4 || map.penalty === 5) return 1;
        return 2;
    }

    if (map.attackCount <= 0) return 0;
    if (map.attackCount === 1) return 1;
    return 2;
}

export function getMapDisplayState(map: { attackCount: number, penalty?: number }) {
    const tier = getMapTier(map);

    if (tier === 0) {
        return {
            visible: false,
            core: { text: "", inline: false, tooltip: "" },
            compact: { text: "", inline: true, tooltip: "" },
        };
    }

    const range = map.penalty
        ? `-${map.penalty}`
        : (tier === 1 ? "-4 | -5" : "-8 | -10");
    const coreText = `MAP: ${range}`;
    const tooltip = `MAP ${tier}: ${range}`;
    const compactText = map.penalty ? range : `M${tier}`;

    return {
        visible: true,
        core: { text: coreText, inline: false, tooltip },
        compact: { text: compactText, inline: true, tooltip },
    };
}

export function formatMapLabel(
    map: { attackCount: number, penalty?: number },
    compact: boolean
): string {
    const displayState = getMapDisplayState(map);
    if (!displayState.visible) return "";
    return compact ? displayState.compact.text : displayState.core.text;
}
