
import { getDay, parse, isWithinInterval } from "date-fns";

interface PriceList {
    id: string;
    name: string;
    adjustment_percentage: number;
    rounding_rule: 'none' | 'nearest_10' | 'nearest_50' | 'nearest_100';
    is_active: boolean;
    schedule: { day: number; start: string; end: string }[] | null;
    excluded_category_ids: string[];
    excluded_product_ids: string[];
    priority: number;
}

function getActivePriceList(lists: PriceList[]): PriceList | null {
    if (!lists.length) return null;
    const now = new Date();
    console.log("Current Time:", now.toString());
    const currentDay = getDay(now); 
    console.log("Current Day Index:", currentDay);
    
    // Sort by priority (higher first)
    const sorted = [...lists].sort((a, b) => (b.priority || 0) - (a.priority || 0));

    for (const list of sorted) {
        if (!list.is_active) {
            console.log(`List ${list.name} skipped (inactive)`);
            continue;
        }
        
        // Always active if no schedule
        if (!list.schedule || list.schedule.length === 0) {
            console.log(`List ${list.name} selected (no schedule - always active)`);
            return list;
        }

        // Check schedule
        console.log(`Checking schedule for ${list.name}...`);
        const rules = list.schedule.filter(r => r.day === currentDay);
        if (rules.length === 0) {
             console.log(`  No rules for today (Day ${currentDay})`);
        }
        
        for (const rule of rules) {
            const start = parse(rule.start, 'HH:mm', now);
            const end = parse(rule.end, 'HH:mm', now);
            console.log(`  Rule: ${rule.start} - ${rule.end}. Parsed: ${start.toLocaleTimeString()} - ${end.toLocaleTimeString()}`);
            
            if (isWithinInterval(now, { start, end })) {
                console.log(`  MATCH!`);
                return list;
            } else {
                console.log(`  No match.`);
            }
        }
    }
    return null;
}

// MOCK DATA
const mockLists: PriceList[] = [
    {
        id: "1",
        name: "Lista Base",
        adjustment_percentage: 0,
        rounding_rule: "none",
        is_active: true,
        schedule: [], // No schedule
        priority: 0,
        excluded_category_ids: [],
        excluded_product_ids: []
    },
    {
        id: "2",
        name: "Happy Hour",
        adjustment_percentage: -10,
        rounding_rule: "none",
        is_active: true,
        schedule: [{ day: new Date().getDay(), start: "00:00", end: "23:59" }], // All day today
        priority: 10,
        excluded_category_ids: [],
        excluded_product_ids: []
    }
];

console.log("--- TEST 1: Priority Match ---");
const active1 = getActivePriceList(mockLists);
console.log("Active List:", active1?.name);

console.log("\n--- TEST 2: Fallback ---");
// Disable Happy Hour
const mockLists2 = JSON.parse(JSON.stringify(mockLists));
mockLists2[1].is_active = false;
const active2 = getActivePriceList(mockLists2);
console.log("Active List:", active2?.name);
