import { round, score } from './score.js'; 

/**
 * Path to directory containing `_list.json` and all levels
 */
const dir = '/data';

export async function fetchList() {
    const listResult = await fetch(`${dir}/_list.json`);
    try {
        const list = await listResult.json();
        return await Promise.all(
            list.map(async (path, rank) => {
                const levelResult = await fetch(`${dir}/${path}.json`);
                try {
                    const level = await levelResult.json();
                    return [
                        {
                            ...level,
                            path,
                            records: level.records.sort(
                                (a, b) => b.percent - a.percent,
                            ),
                        },
                        null,
                    ];
                } catch {
                    console.error(`Failed to load level #${rank + 1} ${path}.`);
                    return [null, path];
                }
            }),
        );
    } catch {
        console.error(`Failed to load list.`);
        return null;
    }
}

export async function fetchEditors() {
    try {
        const editorsResults = await fetch(`${dir}/_editors.json`);
        const editors = await editorsResults.json();
        return editors;
    } catch {
        return null;
    }
}

export async function fetchPacks() {
    try {
        const packsResult = await fetch(`${dir}/_packs.json`);
        if (!packsResult.ok) return [];
        return await packsResult.json();
    } catch {
        return [];
    }
}

export async function fetchLeaderboard() {
    const [list, packs] = await Promise.all([fetchList(), fetchPacks()]);

    const scoreMap = {};
    const errs = [];
    list.forEach(([level, err], rank) => {
        if (err) {
            errs.push(err);
            return;
        }

        // Verification
        const verifier = Object.keys(scoreMap).find(
            (u) => u.toLowerCase() === level.verifier.toLowerCase(),
        ) || level.verifier;
        scoreMap[verifier] ??= {
            verified: [],
            completed: [],
            progressed: [],
            packs: [],
        };
        const { verified } = scoreMap[verifier];
        verified.push({
            rank: rank + 1,
            level: level.name,
            path: level.path,
            score: score(rank + 1, 100, level.percentToQualify),
            link: level.verification,
        });

        // Records
        level.records.forEach((record) => {
            const user = Object.keys(scoreMap).find(
                (u) => u.toLowerCase() === record.user.toLowerCase(),
            ) || record.user;
            scoreMap[user] ??= {
                verified: [],
                completed: [],
                progressed: [],
                packs: [],
            };
            const { completed, progressed } = scoreMap[user];
            if (record.percent === 100) {
                completed.push({
                    rank: rank + 1,
                    level: level.name,
                    path: level.path,
                    score: score(rank + 1, 100, level.percentToQualify),
                    link: record.link,
                });
                return;
            }

            progressed.push({
                rank: rank + 1,
                level: level.name,
                path: level.path,
                percent: record.percent,
                score: score(rank + 1, record.percent, level.percentToQualify),
                link: record.link,
            });
        });
    });

    // Wrap in extra Object containing the user and total score
    const res = Object.entries(scoreMap).map(([user, scores]) => {
        const { verified, completed, progressed } = scores;

        // Collect all 100% beaten level slugs and names (case-insensitive)
        const beatenSet = new Set(
            [...verified, ...completed]
                .flatMap((l) => [
                    l.path?.trim().toLowerCase(),
                    l.level?.trim().toLowerCase(),
                ])
                .filter(Boolean),
        );

        const completedPacks = [];
        let packTotal = 0;

        for (const pack of packs || []) {
            const packLevels = pack.levels || [];
            if (packLevels.length === 0) continue;

            const hasBeatenAll = packLevels.every((lvl) =>
                beatenSet.has(String(lvl).trim().toLowerCase()),
            );

            if (hasBeatenAll) {
                const packPoints = Number(pack.score ?? pack.points ?? 0);
                packTotal += packPoints;
                completedPacks.push({
                    name: pack.name,
                    colour: pack.colour || '#ffffff',
                    score: packPoints,
                });
            }
        }

        const levelTotal = [verified, completed, progressed]
            .flat()
            .reduce((prev, cur) => prev + cur.score, 0);

        return {
            user,
            total: round(levelTotal + packTotal),
            ...scores,
            packs: completedPacks,
        };
    });

    // Sort by total score
    return [res.sort((a, b) => b.total - a.total), errs];
}
