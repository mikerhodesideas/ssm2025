// template sheet to copy -> https://docs.google.com/spreadsheets/d/1f_1C2fZneYLfL_7ooDwnEJdL2o_L2J4XC35VGoACjQA/copy

const SHEET_URL  = 'https://docs.google.com/spreadsheets/d/1OA2hH5U_fPLu-PVncf05nnamACJxNtT-ehdpURc3k5Q/edit?gid=712637129#gid=712637129'        // create a copy of the template above first
const CLIENTCODE = 'module2'        // this string will be added to the sheet name 

// ------------------ //   (c) MikeRhodes.com.au   // ------------------- //

function main() {
    Logger.log(`Starting the Free nGram script.`);
    const e = CLIENTCODE || AdsApp.currentAccount().getName(),
          t = SpreadsheetApp.openByUrl(SHEET_URL);
    t.rename(`${e} - Free nGram Analysis - MikeRhodes.com.au (c)`);
    const a = {
        impr: 'metrics.impressions',
        clicks: 'metrics.clicks',
        cost: 'metrics.cost_micros',
        conv: 'metrics.conversions',
        value: 'metrics.conversions_value',
        prodTitle: 'segments.product_title',
        campName: 'campaign.name',
        campId: 'campaign.id',
        catLabel: 'campaign_search_term_insight.category_label',
        chType: 'campaign.advertising_channel_type',
        pmaxOnly: 'campaign.advertising_channel_type = \'PERFORMANCE_MAX\' ',
        last30: 'segments.date DURING LAST_30_DAYS',
        impr0: 'metrics.impressions > 0'
    };
    const c = `SELECT ${[a.prodTitle, a.cost, a.conv, a.value, a.impr, a.clicks, a.campName, a.chType].join(",")}
        FROM shopping_performance_view WHERE ${a.impr0} AND ${a.last30} AND ${a.pmaxOnly}`;
    const r = fetchProductData(c);
    if (!r) return;
    Logger.log(`Starting nGram processing...`);
    const s = extractAndAggregateNGrams(extractSearchTerms(a), 's'),
          n = extractAndAggregateNGrams(r, 't');
    outputDataToSheet(t, "sNgrams", s);
    outputDataToSheet(t, "tNgrams", n);
}

function extractSearchTerms(e) {
    let t = AdsApp.report(`
        SELECT ${[e.campId, e.campName, e.clicks, e.impr, e.conv, e.value].join(",")}
        FROM campaign WHERE campaign.status != 'REMOVED' AND ${e.pmaxOnly} AND ${e.impr0} AND ${e.last30}
        ORDER BY metrics.conversions DESC 
    `).rows(),
        a = [["Campaign Name", "Campaign ID", "Category Label", "Clicks", "Impr", "Conv", "Value", "Bucket", "Distance"]];
    for (; t.hasNext(); ) {
        let c = t.next(),
            r = c["campaign.name"],
            s = c["campaign.id"],
            n = AdsApp.report(` 
                SELECT ${[e.catLabel, e.campId, e.clicks, e.impr, e.conv, e.value].join(",")}
                FROM campaign_search_term_insight WHERE ${e.last30}
                AND ${e.campId} = ${s} ORDER BY ${e.impr} DESC 
            `).rows();
        for (; n.hasNext(); ) {
            let e = n.next(),
                t = (e["campaign_search_term_insight.category_label"] || "blank").toLowerCase();
            t = cleanNGram(t);
            a.push([r, s, t, e["metrics.clicks"], e["metrics.impressions"], e["metrics.conversions"], e["metrics.conversions_value"]]);
        }
    }
    return a;
}

function extractAndAggregateNGrams(e, t) {
    let a = {};
    e.slice(1).forEach((e) => {
        ("s" === t ? cleanNGram(e[2]) : cleanNGram(e["t"].toLowerCase())).split(" ").forEach((c) => {
            a[c = c || "blank"] || (a[c] = {
                nGram: c,
                clicks: 0,
                impr: 0,
                conv: 0,
                value: 0,
                cost: "t" === t ? 0 : void 0
            });
            a[c].clicks += "s" === t ? Number(e[3]) : e.Clicks;
            a[c].impr += "s" === t ? Number(e[4]) : e.Impr;
            a[c].conv += "s" === t ? Number(e[5]) : e.Conv;
            a[c].value += "s" === t ? Number(e[6]) : e.Value;
            "t" === t && (a[c].cost += e.Cost);
        });
    });
    let c = "s" === t ? [["nGram", "Impr", "Clicks", "Conv", "Value", "CTR", "CvR", "AOV"]] : [["nGram", "Impr", "Clicks", "Cost", "Conv", "Value", "CTR", "CvR", "AOV", "ROAS", "Bucket"]];
    for (let e in a) {
        let r = a[e];
        r.CTR = r.impr > 0 ? r.clicks / r.impr : 0;
        r.CvR = r.clicks > 0 ? r.conv / r.clicks : 0;
        r.AOV = r.conv > 0 ? r.value / r.conv : 0;
        if (t === "t") {
            r.ROAS = r.cost > 0 ? r.value / r.cost : 0;
            r.Bucket = determineBucket(r.cost, r.conv, r.ROAS, (r.cost * 10), (r.ROAS * 2));
        }
        c.push("s" === t ? [r.nGram, r.impr, r.clicks, r.conv, r.value, r.CTR, r.CvR, r.AOV] : [r.nGram, r.impr, r.clicks, r.cost, r.conv, r.value, r.CTR, r.CvR, r.AOV, r.ROAS, r.Bucket]);
    }
    return c.sort(((e, t) => "nGram" === e[0] ? -1 : "nGram" === t[0] ? 1 : t[2] - e[2])), c = c.filter((e) => "blank" !== e[0]), c;
}

function outputDataToSheet(e, t, a) {
    let c = e.getSheetByName(t) || e.insertSheet(t);
    if (c.clearContents(), Array.isArray(a[0])) o = a;
    else {
        const e = Object.keys(a[0]),
              t = a.map((t) => e.map((e) => null !== t[e] && void 0 !== t[e] ? t[e] : ""));
        o = [e].concat(t);
    }
    c.getRange(1, 1, o.length, o[0].length).setValues(o);
}

function flattenObject(e) {
    let t = {};
    for (let a in e) if ("object" == typeof e[a]) {
        let c = flattenObject(e[a]);
        for (let e in c) t[a + "." + e] = c[e];
    } else t[a] = e[a];
    return t;
}

function fetchProductData(e) {
    let t = [],
        a = {};
    const c = AdsApp.search(e);
    for (; c.hasNext(); ) {
        let e = flattenObject(c.next()),
            t = e["segments.productTitle"];
        a[t] || (a[t] = {
            Impr: 0,
            Clicks: 0,
            Cost: 0,
            Conv: 0,
            Value: 0,
            "t": e["segments.productTitle"]
        });
        let r = a[t];
        r.Impr += Number(e["metrics.impressions"]) || 0;
        r.Clicks += Number(e["metrics.clicks"]) || 0;
        r.Cost += Number(e["metrics.costMicros"]) / 1e6 || 0;
        r.Conv += Number(e["metrics.conversions"]) || 0;
        r.Value += Number(e["metrics.conversionsValue"]) || 0;
    }
    for (let e in a) t.push(a[e]);
    return t;
}

function cleanNGram(e) {
    const t = ".,/#!$%^&*;:{}=-_`~()";
    for (; e.length > 0 && t.includes(e[0]); ) e = e.substring(1);
    for (; e.length > 0 && t.includes(e[e.length - 1]); ) e = e.substring(0, e.length - 1);
    return e.length <= 1 ? "" : e;
} 

function determineBucket(cost, conv, roas, tCost, tRoas) {
    if (cost === 0) return 'zombie';
    if (conv === 0) return 'zeroconv';
    if (cost < tCost) return roas < tRoas ? 'meh' : 'flukes';
    return roas < tRoas ? 'costly' : 'profitable';
}

/*
Don't own my full PMax Insights Script yet?
If you just need it for a single account - go here to buy: https://mikerhodes.circle.so/checkout/latest-script  
download the latest version (once purchased): https://mikerhodes.circle.so/c/script/ 

If you want it for multiple accounts, the MCC version makes this much easier. 
Just add the script once & create the Insights Spreadsheet for every client account you choose. 
This means much faster updates when I create new versions. It also means client accounts can’t see the code (great for audits!). 
You also get the single account script included when you buy the MCC version.
For MCC script, go here to buy: 
https://mikerhodes.circle.so/checkout/latest-mcc-script  


Both scripts come with lifetime updates & free support. 
As well as training & documentation, much of which is freely available, 
along with some other scripts here  https://mikerhodes.circle.so/c/free-scripts/ 

In additional, both scripts come with $100 discount voucher for my ‘scripts & sheets mastery’ training.
*/
// (c) MikeRhodes.com.au



// Now hit preview (or run) and let's get this party started!


// PS you're awesome! Thanks for using this script.