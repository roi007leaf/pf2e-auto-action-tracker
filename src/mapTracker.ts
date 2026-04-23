import type { ActionLogEntry } from "./ActionManager";

export function isMapRelevantAction(entry: Partial<ActionLogEntry>): boolean {
    return entry.isMapRelevant === true;
}

export function getMapProfile(entry: Partial<ActionLogEntry>): "standard" | "agile" {
    return entry.mapProfile === "agile" ? "agile" : "standard";
}

export function getCurrentMapState(
    log: Array<Partial<ActionLogEntry>>
): { penalty: 0 | 4 | 5 | 8 | 10, profile: "standard" | "agile" } {
    const attacks = log.filter(isMapRelevantAction);
    if (attacks.length === 0) return { penalty: 0, profile: "standard" };

    const profile = getMapProfile(attacks[attacks.length - 1]);
    if (attacks.length === 1) {
        return { penalty: profile === "agile" ? 4 : 5, profile };
    }

    return { penalty: profile === "agile" ? 8 : 10, profile };
}

export function getMapTier(map: { penalty: 0 | 4 | 5 | 8 | 10 }): 0 | 1 | 2 {
    if (map.penalty === 0) return 0;
    if (map.penalty === 4 || map.penalty === 5) return 1;
    return 2;
}

export function getMapDisplayState(map: { penalty: 0 | 4 | 5 | 8 | 10, profile: "standard" | "agile" }) {
    const tier = getMapTier(map);

    if (tier === 0) {
        return {
            visible: false,
            core: { text: "", inline: false, tooltip: "" },
            compact: { text: "", inline: true, tooltip: "" },
        };
    }

    const range = tier === 1 ? "-4/-5" : "-8/-10";
    const coreText = `MAP ${tier}: ${range}`;

    return {
        visible: true,
        core: { text: coreText, inline: false, tooltip: coreText },
        compact: { text: `M${tier}`, inline: true, tooltip: coreText },
    };
}

export function formatMapLabel(
    map: { penalty: 0 | 4 | 5 | 8 | 10, profile: "standard" | "agile" },
    compact: boolean
): string {
    const displayState = getMapDisplayState(map);
    if (!displayState.visible) return "";
    return compact ? displayState.compact.text : displayState.core.text;
}
