/* eslint-disable require-jsdoc */
const hiscoxCodes = [
    {
        "code": "DC0",
        "description": "Legal services (GL and BOP Only)"
    },
    {
        "code": "DC1",
        "description": "Training (business, vocational or life skills)"
    },
    {
        "code": "DC2",
        "description": "Translating/interpreting"
    },
    {
        "code": "DC3",
        "description": "Travel agency"
    },
    {
        "code": "DC4",
        "description": "Accounting"
    },
    {
        "code": "DC5",
        "description": "Actuarial services (GL and BOP Only)"
    },
    {
        "code": "DC6",
        "description": "Credit counseling (GL and BOP Only)"
    },
    {
        "code": "DC7",
        "description": "Financial auditing or consulting (GL Only)"
    },
    {
        "code": "DC9",
        "description": "Investment advice (GL and BOP Only)"
    },
    {
        "code": "DCA",
        "description": "Answering/paging services"
    },
    {
        "code": "DCB",
        "description": "Auctioneering (PL, GL, BOP)"
    },
    {
        "code": "DCC",
        "description": "Bookkeeping"
    },
    {
        "code": "DCD",
        "description": "Business consulting"
    },
    {
        "code": "DCE",
        "description": "Claims adjusting"
    },
    {
        "code": "DCF",
        "description": "Court reporting"
    },
    {
        "code": "DCG",
        "description": "Direct marketing"
    },
    {
        "code": "DCH",
        "description": "Document preparation"
    },
    {
        "code": "DCI",
        "description": "Education consulting"
    },
    {
        "code": "DCJ",
        "description": "Event planning/promotion"
    },
    {
        "code": "DCK",
        "description": "Expert witness services"
    },
    {
        "code": "DCL",
        "description": "Graphic design"
    },
    {
        "code": "DCM",
        "description": "Human resource consulting (HR)"
    },
    {
        "code": "DCN",
        "description": "IT consulting"
    },
    {
        "code": "DCO",
        "description": "Life/career/executive coaching"
    },
    {
        "code": "DCQ",
        "description": "Marketing/media consulting"
    },
    {
        "code": "DCR",
        "description": "Medical billing"
    },
    {
        "code": "DCS",
        "description": "Notary services"
    },
    {
        "code": "DCT",
        "description": "Personal concierge/assistant (PL and GL Only)"
    },
    {
        "code": "DCU",
        "description": "Photography"
    },
    {
        "code": "DCV",
        "description": "Process server"
    },
    {
        "code": "DCW",
        "description": "Public relations"
    },
    {
        "code": "DCX",
        "description": "Recruiting (employment placements)"
    },
    {
        "code": "DCY",
        "description": "Research consultant"
    },
    {
        "code": "DCZ",
        "description": "Talent agency"
    },
    {
        "code": "DD0",
        "description": "Advertising"
    },
    {
        "code": "DD5",
        "description": "Social media consultant"
    },
    {
        "code": "DD6",
        "description": "Digital marketing"
    },
    {
        "code": "DD7",
        "description": "Other marketing/PR services"
    },
    {
        "code": "DDA",
        "description": "Mortgage brokering/banking (GL and BOP Only)"
    },
    {
        "code": "DDB",
        "description": "Stock brokering (GL and BOP Only)"
    },
    {
        "code": "DDD",
        "description": "Trustee (GL and BOP Only)"
    },
    {
        "code": "DDE",
        "description": "Interior design"
    },
    {
        "code": "DDG",
        "description": "Architecture"
    },
    {
        "code": "DDH",
        "description": "Project management (architecture or engineering)"
    },
    {
        "code": "DDJ",
        "description": "Engineering"
    },
    {
        "code": "DDL",
        "description": "Insurance Agent"
    },
    {
        "code": "DDO",
        "description": "Property management"
    },
    {
        "code": "DDP",
        "description": "Real estate/agent broker"
    },
    {
        "code": "DDR",
        "description": "Business manager services"
    },
    {
        "code": "DDS",
        "description": "Tax preparation"
    },
    {
        "code": "DDT",
        "description": "Management consulting"
    },
    {
        "code": "DDU",
        "description": "Resume consultant"
    },
    {
        "code": "DDV",
        "description": "Technology services"
    },
    {
        "code": "DDW",
        "description": "Tutoring (PL and GL Only)"
    },
    {
        "code": "DDY",
        "description": "Executive placement"
    },
    {
        "code": "DEA",
        "description": "Application development"
    },
    {
        "code": "DEB",
        "description": "Application service provider"
    },
    {
        "code": "DED",
        "description": "Brand consultant"
    },
    {
        "code": "DEE",
        "description": "Computer consulting"
    },
    {
        "code": "DEF",
        "description": "Computer programming services"
    },
    {
        "code": "DEG",
        "description": "Software development"
    },
    {
        "code": "DEH",
        "description": "Computer system/network developer"
    },
    {
        "code": "DEI",
        "description": "Data processing"
    },
    {
        "code": "DEJ",
        "description": "Database designer"
    },
    {
        "code": "DEM",
        "description": "Market research"
    },
    {
        "code": "DEO",
        "description": "Project management"
    },
    {
        "code": "DEP",
        "description": "Strategy consultant"
    },
    {
        "code": "DEQ",
        "description": "Value added reseller of computer hardware"
    },
    {
        "code": "DER",
        "description": "Website design"
    },
    {
        "code": "DES",
        "description": "IT project management"
    },
    {
        "code": "DET",
        "description": "IT software/hardware training services"
    },
    {
        "code": "DEU",
        "description": "Other technology services"
    },
    {
        "code": "DEV",
        "description": "Search engine services (SEO/SEM)"
    },
    {
        "code": "DFA",
        "description": "Acupressure services"
    },
    {
        "code": "DFB",
        "description": "Acupuncture services"
    },
    {
        "code": "DFC",
        "description": "Art therapy"
    },
    {
        "code": "DFD",
        "description": "Audiology"
    },
    {
        "code": "DFE",
        "description": "Barber/hair stylist services"
    },
    {
        "code": "DFF",
        "description": "Beautician/cosmetology services"
    },
    {
        "code": "DFG",
        "description": "Dance therapy"
    },
    {
        "code": "DFH",
        "description": "Dietician/nutrition"
    },
    {
        "code": "DFI",
        "description": "Drama therapy"
    },
    {
        "code": "DFJ",
        "description": "Esthetician services"
    },
    {
        "code": "DFK",
        "description": "First aid and CPR training"
    },
    {
        "code": "DFL",
        "description": "Hypnosis"
    },
    {
        "code": "DFM",
        "description": "Marriage and family therapy"
    },
    {
        "code": "DFN",
        "description": "Massage therapy"
    },
    {
        "code": "DFO",
        "description": "Mental health counseling"
    },
    {
        "code": "DFP",
        "description": "Music therapy"
    },
    {
        "code": "DFQ",
        "description": "Nail technician services"
    },
    {
        "code": "DFR",
        "description": "Occupational therapy"
    },
    {
        "code": "DFS",
        "description": "Personal training (health and fitness)"
    },
    {
        "code": "DFT",
        "description": "Psychology"
    },
    {
        "code": "DFU",
        "description": "Social work services"
    },
    {
        "code": "DFV",
        "description": "Speech therapy"
    },
    {
        "code": "DFW",
        "description": "Substance abuse counseling"
    },
    {
        "code": "DFY",
        "description": "Yoga/pilates instruction"
    },
    {
        "code": "DGA",
        "description": "Building inspection"
    },
    {
        "code": "DGB",
        "description": "Civil engineering"
    },
    {
        "code": "DGC",
        "description": "Control systems integration/automation"
    },
    {
        "code": "DGD",
        "description": "Draftsman (including CAD/CAM)"
    },
    {
        "code": "DGE",
        "description": "Electrical engineering"
    },
    {
        "code": "DGF",
        "description": "Environmental engineering"
    },
    {
        "code": "DGG",
        "description": "Industrial engineering"
    },
    {
        "code": "DGH",
        "description": "Landscape architect"
    },
    {
        "code": "DGI",
        "description": "Process engineering"
    },
    {
        "code": "DGJ",
        "description": "Transportation engineering"
    },
    {
        "code": "DHL",
        "description": "Other consulting services"
    },
    {
        "code": "DHM",
        "description": "Home Health Aide (PL and GL Only)"
    },
    {
        "code": "DHN",
        "description": "Personal Care Aide (PL and GL Only)"
    },
    {
        "code": "DS1",
        "description": "Locksmiths"
    },
    {
        "code": "DS2",
        "description": "Clock making/repair"
    },
    {
        "code": "DS3",
        "description": "Air conditioning systems installation and repair"
    },
    {
        "code": "DS4",
        "description": "Appliance and accessories installation and repair"
    },
    {
        "code": "DS5",
        "description": "Carpentry (interior only)"
    },
    {
        "code": "DS6",
        "description": "Door or window installation/repair"
    },
    {
        "code": "DS7",
        "description": "Glass installation/repair (no auto work)"
    },
    {
        "code": "DS8",
        "description": "Interior finishing work"
    },
    {
        "code": "DS9",
        "description": "Carpet, rug, furniture, or upholstery cleaning (customer's premises only)"
    },
    {
        "code": "DSA",
        "description": "Upholstery work"
    },
    {
        "code": "DSB",
        "description": "Exterior cleaning services"
    },
    {
        "code": "DSC",
        "description": "Driveway or sidewalk paving/repaving"
    },
    {
        "code": "DSD",
        "description": "Electrical work (interior only)"
    },
    {
        "code": "DSE",
        "description": "Fence installation/repair"
    },
    {
        "code": "DSF",
        "description": "Floor covering installation(no ceramic tile/stone)"
    },
    {
        "code": "DSG",
        "description": "Handyperson (no roof work)"
    },
    {
        "code": "DSH",
        "description": "Heating/air conditioning install/repair(no LPG)"
    },
    {
        "code": "DSI",
        "description": "Janitorial/cleaning services"
    },
    {
        "code": "DSJ",
        "description": "Landscaping/gardening services"
    },
    {
        "code": "DSK",
        "description": "Lawn care services"
    },
    {
        "code": "DSL",
        "description": "Masonry work"
    },
    {
        "code": "DSM",
        "description": "Painting (interior only)"
    },
    {
        "code": "DSN",
        "description": "Drywall or wallboard installation/repair"
    },
    {
        "code": "DSO",
        "description": "Plastering or stucco work"
    },
    {
        "code": "DSP",
        "description": "Plumbing (commercial/industrial)"
    },
    {
        "code": "DSQ",
        "description": "Plumbing (residential/domestic)"
    },
    {
        "code": "DSR",
        "description": "Sign painting/lettering (interior only)"
    },
    {
        "code": "DSS",
        "description": "Sign painting/lettering (exterior only)"
    },
    {
        "code": "DST",
        "description": "Tile/stone/marble/mosaic/terrazzo work(int. only)"
    },
    {
        "code": "DSU",
        "description": "Window cleaning (nothing above 15 feet)"
    },
    {
        "code": "DSV",
        "description": "Mobile food concessions"
    },
    {
        "code": "DT1",
        "description": "Appliance/electronic stores (Retail)"
    },
    {
        "code": "DT2",
        "description": "Clothing/apparel stores (Retail)"
    },
    {
        "code": "DT3",
        "description": "Florists (Retail)"
    },
    {
        "code": "DT4",
        "description": "Home furnishing stores (Retail)"
    },
    {
        "code": "DT5",
        "description": "Jewelry stores (Retail)"
    },
    {
        "code": "DT6",
        "description": "Other stores (without food/drinks) (Retail)"
    },
    {
        "code": "DT7",
        "description": "Other stores (with food/drinks) (Retail)"
    },
    {
        "code": "DT8",
        "description": "Snow blowing and removal (no auto coverage)"
    }
];

function getList() {
    return hiscoxCodes;
}

function getByCode(hcode) {
    if (!hcode || typeof hcode !== "number") {
        const error = `hiscoxcodesvc: Error: Invalid hcode supplied to getById(). ${__location}`;
        log.error(error);
        return null;
    }

    const hiscoxCode = hiscoxCodes.find(hc => hc.code === hcode);

    if (!hiscoxCode) {
        const error = `hiscoxcodesvc: Error: Could not find hiscox code with matching code. ${__location}`;
        log.error(error);
        return null;
    }
    else {
        return hiscoxCode;
    }
}

function getByDesc(hDesc) {
    if (!hDesc || typeof hDesc !== "number") {
        const error = `hiscoxcodesvc: Error: Invalid hDesc supplied to getById(). ${__location}`;
        log.error(error);
        return null;
    }

    const hiscoxCode = hiscoxCodes.find(hc => hc.description === hDesc);

    if (!hiscoxCode) {
        const error = `hiscoxcodesvc: Error: Could not find hiscox code with matching hDesc. ${__location}`;
        log.error(error);
        return null;
    }
    else {
        return hiscoxCode;
    }
}


module.exports = {
    getList: getList,
    getByCode: getByCode,
    getByDesc: getByDesc
}