export function getCostFromMsgFlavor(htmlString: string): number | undefined {
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = htmlString;

    // 1. Existing Logic: Check for text in action-glyph span
    const glyphText = tempDiv.querySelector('.action-glyph')?.textContent?.trim();
    if (glyphText && ["1", "2", "3"].includes(glyphText)) {
        return parseInt(glyphText);
    }
    if (glyphText && ["R", "F", "0"].includes(glyphText)) {
        return 0;
    }

    // 2. New Logic: Check for Action Icons (Common in monster/action cards)
    const imgAction = tempDiv.querySelector('img[src*="actions/"]');
    if (imgAction) {
        const src = imgAction.getAttribute('src') || "";
        if (src.includes('OneAction')) return 1;
        if (src.includes('TwoActions')) return 2;
        if (src.includes('ThreeActions')) return 3;
        if (src.includes('FreeAction')) return 0;
        if (src.includes('Reaction')) return 0; // Handled by isReaction flag
    }

    return undefined;
}

export function getIsReaction(item: any, pf2eFlags: any, flavor: string): boolean {
    const checks = [
        item?.system?.time?.value === "reaction",
        pf2eFlags?.context?.type === "reaction",
        pf2eFlags?.context?.options?.includes("action:reaction"),
        pf2eFlags?.context?.options?.includes("trait:reaction"),
        flavor.includes('action-glyph">R<')
    ];

    return checks.some(check => check === true);
}

export function getLabelFromMsgFlavor(htmlString: string): string | undefined {
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = htmlString;

    // 1. Target the header
    const header = tempDiv.querySelector('h4.action, .card-header h3, h3');
    if (!header) return undefined;

    // 2. CLONE the header so we don't mess with the original DOM if it matters
    const cleanHeader = header.cloneNode(true) as HTMLElement;

    // 3. REMOVE the glyph span entirely before grabbing text
    cleanHeader.querySelector('.action-glyph, .pf2-icon')?.remove();

    let title = cleanHeader.querySelector('strong')?.textContent || cleanHeader.textContent;

    if (title) {
        return title
            .replace(/\s+/g, ' ') // Collapse whitespace
            .replace(/[()]/g, '') // Remove parentheses
            .trim();
    }
    return undefined;
}

export function getSlugFromMsgFlavor(htmlString: string): string | undefined {
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = htmlString;

    const header = tempDiv.querySelector('h4.action strong, .card-header h3, h3');
    if (!header) return undefined;

    const cleanHeader = header.cloneNode(true) as HTMLElement;
    // Remove the glyph so it doesn't end up in our slug
    cleanHeader.querySelector('.action-glyph, .pf2-icon')?.remove();

    const title = cleanHeader.textContent;

    if (title) {
        return title
            .toLowerCase()
            .trim()
            .replace(/[()]/g, '')
            .replace(/\s+/g, '-')
            .replace(/^-+|-+$/g, ''); // Remove leading/trailing dashes
    }

    return undefined;
}