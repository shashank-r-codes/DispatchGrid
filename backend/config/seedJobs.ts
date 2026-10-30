// 105+ Diverse Service Jobs Seed Dataset Definition for DispatchGrid
// Covers Electrical, AC (distinct specialization), and Plumbing with varying priorities,
// SLA deadlines, conflicting time windows, unassignables, and disruption scenarios.

export interface SeedJobDef {
  bookingId: string;
  bookingReference: string;
  customerName: string;
  customerPhone: string;
  serviceId: string; // References services
  category: "Electrical" | "AC" | "Plumbing";
  problemDescription: string;
  serviceAddress: string;
  lat: number;
  lng: number;
  nodeId: string;
  preferredDate: string;
  preferredStartTime: string;
  preferredEndTime: string;
  requestedPriority: "NORMAL" | "HIGH" | "EMERGENCY";
  verifiedPriority: "NORMAL" | "HIGH" | "EMERGENCY";
  bookingStatus: "PENDING" | "OFFERED" | "ASSIGNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "UNASSIGNED";
  assignedTechUsername?: string; // e.g. electrician1
  travelMinutes?: number;
  unassignedReason?: string;
  notes?: string;
  customerReview?: {
    rating: number;
    comment: string;
    tags: string;
  };
}

export function generateSeedJobs(baseDate: string): SeedJobDef[] {
  const jobs: SeedJobDef[] = [];
  let idCounter = 101;

  const zones = [
    { node: "NODE_CENTRAL", name: "CBD / Central", lat: 12.9716, lng: 77.5946, addr: "MG Road Promenade, Central Bengaluru" },
    { node: "NODE_NORTH", name: "Hebbal / North", lat: 13.0358, lng: 77.5970, addr: "Bellary Road, Hebbal Flyover, Bengaluru" },
    { node: "NODE_EAST", name: "Indiranagar / East", lat: 12.9840, lng: 77.6632, addr: "100ft Road, Indiranagar, Bengaluru" },
    { node: "NODE_SOUTH", name: "Jayanagar / South", lat: 12.9250, lng: 77.5938, addr: "4th Block Commercial Complex, Jayanagar, Bengaluru" },
    { node: "NODE_WEST", name: "Rajajinagar / West", lat: 12.9780, lng: 77.5450, addr: "Dr Rajkumar Road, Rajajinagar, Bengaluru" },
    { node: "NODE_SOUTHEAST", name: "Koramangala", lat: 12.9352, lng: 77.6245, addr: "80ft Road, Koramangala 4th Block, Bengaluru" },
    { node: "NODE_NORTHEAST", name: "Kalyan Nagar", lat: 13.0068, lng: 77.6520, addr: "HRBR Layout, Kalyan Nagar, Bengaluru" },
    { node: "NODE_SOUTHWEST", name: "Banashankari", lat: 12.9120, lng: 77.5560, addr: "Banashankari 2nd Stage, Bengaluru" },
    { node: "NODE_WHITEFIELD", name: "Whitefield Outer", lat: 12.9698, lng: 77.7499, addr: "EPIP Zone, Whitefield, Bengaluru" },
    { node: "NODE_ELECTRONIC_CITY", name: "Electronic City South", lat: 12.8452, lng: 77.6602, addr: "Phase 1 Tollway, Electronic City, Bengaluru" },
  ];

  const customerNames = [
    { name: "Aarav Sharma", phone: "+91-98450-21001" },
    { name: "Sneha Patel", phone: "+91-98450-21002" },
    { name: "Rohan Iyer", phone: "+91-98450-21003" },
    { name: "Ananya Deshmukh", phone: "+91-98450-21004" },
    { name: "Vikram Malhotra", phone: "+91-98450-21005" },
    { name: "Pooja Hegde", phone: "+91-98450-21006" },
    { name: "Kavita Nair", phone: "+91-98450-21007" },
    { name: "Arjun Singhal", phone: "+91-98450-21008" },
    { name: "Meera Sen", phone: "+91-98450-21009" },
    { name: "Aditya Roy", phone: "+91-98450-21010" },
    { name: "Divya Joshi", phone: "+91-98450-21011" },
    { name: "Nikhil Kulkarni", phone: "+91-98450-21012" },
    { name: "Tanvi Rao", phone: "+91-98450-21013" },
    { name: "Rahul Verma", phone: "+91-98450-21014" },
    { name: "Sangeeta Menon", phone: "+91-98450-21015" },
  ];

  // 1. COMPLETED JOBS (25 Jobs) - with reviews
  const completedServices = [
    { sId: "SRV_E_02", cat: "Electrical", desc: "Kitchen switchboard sparking and modular switches repaired.", tech: "electrician1", time: "08:00", end: "09:00" },
    { sId: "SRV_AC_02", cat: "AC", desc: "Chemical jet deep servicing completed for split AC unit.", tech: "electrician2", time: "08:00", end: "09:30" },
    { sId: "SRV_P_02", cat: "Plumbing", desc: "Designer mixer tap replaced with new ceramic cartridge seating.", tech: "electrician3", time: "08:30", end: "09:15" },
    { sId: "SRV_E_05", cat: "Electrical", desc: "BLDC high-efficiency ceiling fan installation and speed regulator setup.", tech: "electrician5", time: "08:00", end: "08:45" },
    { sId: "SRV_AC_03", cat: "AC", desc: "R32 pure refrigerant vacuum leak test and gas top-up executed.", tech: "electrician6", time: "08:30", end: "09:45" },
    { sId: "SRV_P_01", cat: "Plumbing", desc: "Concealed wall pipe leak sealed and acoustic pressure checked.", tech: "electrician7", time: "08:00", end: "09:00" },
    { sId: "SRV_E_03", cat: "Electrical", desc: "Heavy duty RCCB trip switch installed on main distribution board.", tech: "electrician8", time: "09:00", end: "10:00" },
    { sId: "SRV_AC_06", cat: "AC", desc: "Seasonal preventive maintenance and drainage line unclogging.", tech: "electrician9", time: "08:00", end: "09:00" },
    { sId: "SRV_P_03", cat: "Plumbing", desc: "Hydro-jet clearing of choked kitchen grease trap drainage.", tech: "electrician11", time: "07:30", end: "08:45" },
    { sId: "SRV_E_06", cat: "Electrical", desc: "Architectural warm LED track profile lighting installed in studio.", tech: "electrician13", time: "08:30", end: "09:30" },
    { sId: "SRV_AC_02", cat: "AC", desc: "Filter deep sanitization and antimicrobial evaporator spray wash.", tech: "electrician12", time: "09:00", end: "10:00" },
    { sId: "SRV_P_04", cat: "Plumbing", desc: "Submersible pump starter capacitor and float switch overhaul.", tech: "electrician15", time: "08:00", end: "09:30" },
    { sId: "SRV_E_01", cat: "Electrical", desc: "Full apartment heavy duty copper conduit rewiring with earth check.", tech: "electrician4", time: "08:00", end: "09:30" },
    { sId: "SRV_AC_04", cat: "AC", desc: "Cooling drop sensor calibration and inverter PCB test.", tech: "electrician14", time: "08:00", end: "09:00" },
    { sId: "SRV_P_02", cat: "Plumbing", desc: "Installed brass angle stop cocks and flexible braided connectors.", tech: "electrician19", time: "08:00", end: "08:45" },
    { sId: "SRV_E_04", cat: "Electrical", desc: "Tripping MCB isolated; burnt wire in junction box replaced safely.", tech: "electrician17", time: "08:00", end: "09:00" },
    { sId: "SRV_AC_02", cat: "AC", desc: "Multi-split AC chemical foam coil cleaning and temperature test.", tech: "electrician18", time: "08:30", end: "09:30" },
    { sId: "SRV_P_01", cat: "Plumbing", desc: "Sink P-trap leak repaired with waterproof silicon gasket seating.", tech: "electrician10", time: "08:00", end: "09:00" },
    { sId: "SRV_E_05", cat: "Electrical", desc: "Exhaust fan ducting and anti-vibration rubber mount fix.", tech: "electrician16", time: "08:00", end: "08:45" },
    { sId: "SRV_AC_01", cat: "AC", desc: "New 1.5 ton 5-star inverter AC mounted with copper tubing flare test.", tech: "electrician20", time: "08:00", end: "10:00" },
    { sId: "SRV_E_02", cat: "Electrical", desc: "Bedroom 2-way switch setup and bedroom bed-lamp point.", tech: "electrician1", time: "09:15", end: "10:00" },
    { sId: "SRV_AC_03", cat: "AC", desc: "Gas top-up and pressure differential valve calibration.", tech: "electrician2", time: "09:45", end: "11:00" },
    { sId: "SRV_P_05", cat: "Plumbing", desc: "Rooftop overhead tank PVC manifold piping layout extension.", tech: "electrician3", time: "09:30", end: "11:30" },
    { sId: "SRV_E_06", cat: "Electrical", desc: "Chandelier assembly and reinforced ceiling hook anchor testing.", tech: "electrician5", time: "09:00", end: "10:00" },
    { sId: "SRV_AC_05", cat: "AC", desc: "Compressor run capacitor and dual-pole contactor replacement.", tech: "electrician6", time: "10:00", end: "12:00" },
  ];

  for (let i = 0; i < completedServices.length; i++) {
    const s = completedServices[i];
    const z = zones[i % zones.length];
    const c = customerNames[i % customerNames.length];
    const bId = `BK_${idCounter}`;
    const ref = `DG-2026-${idCounter}`;
    idCounter++;

    jobs.push({
      bookingId: bId,
      bookingReference: ref,
      customerName: c.name,
      customerPhone: c.phone,
      serviceId: s.sId,
      category: s.cat as any,
      problemDescription: s.desc,
      serviceAddress: `${100 + i}, ${z.addr}`,
      lat: Number((z.lat + (i * 0.002 - 0.005)).toFixed(6)),
      lng: Number((z.lng + (i * 0.002 - 0.005)).toFixed(6)),
      nodeId: z.node,
      preferredDate: baseDate,
      preferredStartTime: s.time,
      preferredEndTime: s.end,
      requestedPriority: "NORMAL",
      verifiedPriority: "NORMAL",
      bookingStatus: "COMPLETED",
      assignedTechUsername: s.tech,
      travelMinutes: 12 + (i % 8),
      customerReview: {
        rating: 5 - (i % 2 === 0 ? 0 : 1),
        comment: `Excellent service! ${s.tech} arrived on time, was certified and courteous. Problem solved cleanly.`,
        tags: "Punctual,Clean Worksite,Expert Specialist",
      },
    });
  }

  // 2. IN_PROGRESS JOBS (15 Jobs) - Active right now
  const inProgressServices = [
    { sId: "SRV_E_04", cat: "Electrical", desc: "Severe circuit short-circuit diagnosis in residential villa.", tech: "electrician1", time: "10:30", end: "11:30", prio: "HIGH" },
    { sId: "SRV_AC_01", cat: "AC", desc: "Living room multi-split inverter AC installation and vacuuming.", tech: "electrician2", time: "11:15", end: "13:15", prio: "NORMAL" },
    { sId: "SRV_P_04", cat: "Plumbing", desc: "Automatic water booster pump pressure regulator overhaul.", tech: "electrician3", time: "11:45", end: "13:15", prio: "NORMAL" },
    { sId: "SRV_E_01", cat: "Electrical", desc: "Dedicated 32A power point wiring for EV home charger.", tech: "electrician4", time: "10:00", end: "11:30", prio: "NORMAL" },
    { sId: "SRV_E_02", cat: "Electrical", desc: "Sparking main DB panel switch replacement and cable dress.", tech: "electrician5", time: "10:15", end: "11:00", prio: "HIGH" },
    { sId: "SRV_AC_04", cat: "AC", desc: "AC indoor unit leaking water onto wooden flooring and low cooling.", tech: "electrician6", time: "12:15", end: "13:15", prio: "NORMAL" },
    { sId: "SRV_P_03", cat: "Plumbing", desc: "Main bathroom sewer line jet rodding and blockage elimination.", tech: "electrician7", time: "09:30", end: "10:45", prio: "HIGH" },
    { sId: "SRV_E_03", cat: "Electrical", desc: "Three-phase surge arrester installation for home office server.", tech: "electrician8", time: "10:30", end: "11:30", prio: "NORMAL" },
    { sId: "SRV_AC_05", cat: "AC", desc: "Compressor terminal burn repair and dual capacitor upgrade.", tech: "electrician9", time: "09:30", end: "11:30", prio: "HIGH" },
    { sId: "SRV_P_01", cat: "Plumbing", desc: "Under-sink RO filtration line puncture repair and shutoff valve.", tech: "electrician10", time: "09:30", end: "10:30", prio: "NORMAL" },
    { sId: "SRV_P_05", cat: "Plumbing", desc: "New solar water heater inlet-outlet CPVC loop connection.", tech: "electrician11", time: "09:00", end: "11:00", prio: "NORMAL" },
    { sId: "SRV_AC_02", cat: "AC", desc: "Chemical foam wash of heavy grease coated kitchen AC.", tech: "electrician12", time: "10:15", end: "11:15", prio: "NORMAL" },
    { sId: "SRV_E_06", cat: "Electrical", desc: "Staircase recessed sensor spotlights wiring and testing.", tech: "electrician13", time: "10:00", end: "11:00", prio: "NORMAL" },
    { sId: "SRV_AC_03", cat: "AC", desc: "R410A refrigerant charge with vacuum manifold pressure hold.", tech: "electrician14", time: "08:30", end: "09:45", prio: "NORMAL" },
    { sId: "SRV_P_02", cat: "Plumbing", desc: "Concealed wall diverter body installation for walk-in shower.", tech: "electrician15", time: "10:00", end: "10:45", prio: "NORMAL" },
  ];

  for (let i = 0; i < inProgressServices.length; i++) {
    const s = inProgressServices[i];
    const z = zones[(i + 3) % zones.length];
    const c = customerNames[(i + 2) % customerNames.length];
    const bId = `BK_${idCounter}`;
    const ref = `DG-2026-${idCounter}`;
    idCounter++;

    jobs.push({
      bookingId: bId,
      bookingReference: ref,
      customerName: c.name,
      customerPhone: c.phone,
      serviceId: s.sId,
      category: s.cat as any,
      problemDescription: s.desc,
      serviceAddress: `${200 + i}, ${z.addr}`,
      lat: Number((z.lat + (i * 0.003 - 0.008)).toFixed(6)),
      lng: Number((z.lng + (i * 0.003 - 0.008)).toFixed(6)),
      nodeId: z.node,
      preferredDate: baseDate,
      preferredStartTime: s.time,
      preferredEndTime: s.end,
      requestedPriority: s.prio as any,
      verifiedPriority: s.prio as any,
      bookingStatus: "IN_PROGRESS",
      assignedTechUsername: s.tech,
      travelMinutes: 14 + (i % 7),
      notes: "Ongoing work: strictly protected against interruption during re-optimization.",
    });
  }

  // 3. ASSIGNED / SCHEDULED JOBS (30 Jobs) - Confirmed for upcoming slots today
  const assignedServices = [
    { sId: "SRV_E_05", cat: "Electrical", desc: "Living room smart BLDC fan mounting with wireless remote.", tech: "electrician1", time: "12:00", end: "12:45", prio: "NORMAL" },
    { sId: "SRV_AC_06", cat: "AC", desc: "Preventive seasonal maintenance for dual split units.", tech: "electrician2", time: "13:30", end: "14:30", prio: "NORMAL" },
    { sId: "SRV_P_02", cat: "Plumbing", desc: "Quarter-turn ceramic wall sink bib cock installation.", tech: "electrician3", time: "13:30", end: "14:15", prio: "NORMAL" },
    { sId: "SRV_AC_03", cat: "AC", desc: "Dual refrigerant pressure gauge testing and top-up.", tech: "electrician4", time: "12:00", end: "13:15", prio: "NORMAL" },
    { sId: "SRV_E_04", cat: "Electrical", desc: "Inverter backup battery terminal spark and fuse check.", tech: "electrician5", time: "11:30", end: "12:30", prio: "HIGH" },
    { sId: "SRV_AC_02", cat: "AC", desc: "Eco chemical wash and antimicrobial blower cleaning.", tech: "electrician6", time: "13:30", end: "14:30", prio: "NORMAL" },
    { sId: "SRV_P_01", cat: "Plumbing", desc: "Washing machine inlet vibration hose leak replacement.", tech: "electrician7", time: "11:30", end: "12:30", prio: "NORMAL" },
    { sId: "SRV_E_01", cat: "Electrical", desc: "Balcony garden waterproof lighting conduit wire feed.", tech: "electrician8", time: "12:00", end: "13:30", prio: "NORMAL" },
    { sId: "SRV_AC_04", cat: "AC", desc: "Strange screeching noise and thermal cutout trip in bedroom AC.", tech: "electrician9", time: "12:00", end: "13:00", prio: "NORMAL" },
    { sId: "SRV_P_04", cat: "Plumbing", desc: "Pressure tank air bladder re-inflation and pressure gauge check.", tech: "electrician10", time: "11:00", end: "12:30", prio: "NORMAL" },
    { sId: "SRV_P_03", cat: "Plumbing", desc: "Choked floor drain trap remediation with mechanical auger.", tech: "electrician11", time: "11:30", end: "12:45", prio: "HIGH" },
    { sId: "SRV_AC_06", cat: "AC", desc: "Seasonal AC deep cleaning before summer peak.", tech: "electrician12", time: "11:30", end: "12:30", prio: "NORMAL" },
    { sId: "SRV_E_02", cat: "Electrical", desc: "Kitchen modular switch plate replacement and GFCI socket.", tech: "electrician13", time: "11:30", end: "12:15", prio: "NORMAL" },
    { sId: "SRV_AC_01", cat: "AC", desc: "Split AC indoor unit wall relocation 2 meters to the right.", tech: "electrician14", time: "10:15", end: "12:15", prio: "NORMAL" },
    { sId: "SRV_P_01", cat: "Plumbing", desc: "Bathroom flush valve continuous running water repair.", tech: "electrician15", time: "11:15", end: "12:15", prio: "NORMAL" },
    { sId: "SRV_E_04", cat: "Electrical", desc: "Main breaker intermittent tripping under air fryer load.", tech: "electrician16", time: "09:30", end: "10:30", prio: "HIGH" },
    { sId: "SRV_E_03", cat: "Electrical", desc: "Heavy industrial RCCB sensitivity calibration for workshop.", tech: "electrician17", time: "09:30", end: "10:30", prio: "NORMAL" },
    { sId: "SRV_AC_04", cat: "AC", desc: "AC running but no temperature drop; sensor diagnostic required.", tech: "electrician18", time: "10:00", end: "11:00", prio: "NORMAL" },
    { sId: "SRV_P_04", cat: "Plumbing", desc: "Water pump automatic water level controller dry-run trip.", tech: "electrician19", time: "09:30", end: "11:00", prio: "NORMAL" },
    { sId: "SRV_E_01", cat: "Electrical", desc: "Terrace pergola outdoor waterproof cabling and junction boxes.", tech: "electrician20", time: "10:30", end: "12:00", prio: "NORMAL" },
    { sId: "SRV_E_02", cat: "Electrical", desc: "Dining area dimmer switch buzzing sound and light flicker.", tech: "electrician1", time: "13:15", end: "14:00", prio: "NORMAL" },
    { sId: "SRV_AC_05", cat: "AC", desc: "Inverter compressor PCB board replacement and calibration.", tech: "electrician2", time: "15:00", end: "17:00", prio: "HIGH" },
    { sId: "SRV_P_05", cat: "Plumbing", desc: "Fresh CPVC piping feed for new utility washing machine area.", tech: "electrician3", time: "14:45", end: "16:45", prio: "NORMAL" },
    { sId: "SRV_AC_01", cat: "AC", desc: "New 2-ton cassette AC installation in office conference room.", tech: "electrician4", time: "14:00", end: "16:00", prio: "NORMAL" },
    { sId: "SRV_E_06", cat: "Electrical", desc: "Track lighting hanging fixtures aligned with dining table.", tech: "electrician5", time: "13:00", end: "14:00", prio: "NORMAL" },
    { sId: "SRV_AC_03", cat: "AC", desc: "Compressor flare nut micro-leak detection with electronic sniffer.", tech: "electrician6", time: "15:00", end: "16:15", prio: "HIGH" },
    { sId: "SRV_P_02", cat: "Plumbing", desc: "Sink basin counter-top pop-up waste coupling replacement.", tech: "electrician7", time: "13:00", end: "13:45", prio: "NORMAL" },
    { sId: "SRV_E_04", cat: "Electrical", desc: "Neutral wire burn in external meter cabinet causing voltage surge.", tech: "electrician8", time: "14:00", end: "15:00", prio: "EMERGENCY" },
    { sId: "SRV_AC_02", cat: "AC", desc: "Indoor coil foam decontamination and drain tray antimicrobial tab.", tech: "electrician9", time: "13:30", end: "14:30", prio: "NORMAL" },
    { sId: "SRV_P_01", cat: "Plumbing", desc: "Concealed wall acoustic leak finding behind tiled shower.", tech: "electrician10", time: "13:00", end: "14:00", prio: "HIGH" },
  ];

  for (let i = 0; i < assignedServices.length; i++) {
    const s = assignedServices[i];
    const z = zones[(i + 5) % zones.length];
    const c = customerNames[(i + 4) % customerNames.length];
    const bId = `BK_${idCounter}`;
    const ref = `DG-2026-${idCounter}`;
    idCounter++;

    jobs.push({
      bookingId: bId,
      bookingReference: ref,
      customerName: c.name,
      customerPhone: c.phone,
      serviceId: s.sId,
      category: s.cat as any,
      problemDescription: s.desc,
      serviceAddress: `${300 + i}, ${z.addr}`,
      lat: Number((z.lat + (i * 0.002 - 0.004)).toFixed(6)),
      lng: Number((z.lng + (i * 0.002 - 0.004)).toFixed(6)),
      nodeId: z.node,
      preferredDate: baseDate,
      preferredStartTime: s.time,
      preferredEndTime: s.end,
      requestedPriority: s.prio as any,
      verifiedPriority: s.prio as any,
      bookingStatus: "ASSIGNED",
      assignedTechUsername: s.tech,
      travelMinutes: 10 + (i % 12),
      notes: "Confirmed scheduled appointment.",
    });
  }

  // 4. ACTIVE OFFERS (8 Jobs) - Waiting for technician accept/reject
  const offeredServices = [
    { sId: "SRV_AC_01", cat: "AC", desc: "Split AC installation on 3rd floor balcony wall.", tech: "electrician2", time: "17:15", end: "18:00", prio: "NORMAL" },
    { sId: "SRV_E_04", cat: "Electrical", desc: "Tripping MCB in garage causing power loss.", tech: "electrician1", time: "14:15", end: "15:15", prio: "NORMAL" },
    { sId: "SRV_P_03", cat: "Plumbing", desc: "Kitchen drain gurgling and backing up dirty water.", tech: "electrician3", time: "17:00", end: "18:00", prio: "HIGH" },
    { sId: "SRV_AC_03", cat: "AC", desc: "Cooling gas low, AC blowing warm room air.", tech: "electrician4", time: "16:30", end: "17:45", prio: "NORMAL" },
    { sId: "SRV_E_02", cat: "Electrical", desc: "Bathroom heater switch sparks when pressed.", tech: "electrician5", time: "14:30", end: "15:15", prio: "HIGH" },
    { sId: "SRV_AC_02", cat: "AC", desc: "Deep jet chemical wash for 2 indoor blower units.", tech: "electrician6", time: "16:30", end: "17:30", prio: "NORMAL" },
    { sId: "SRV_P_01", cat: "Plumbing", desc: "Continuous drip from main stopcock valve.", tech: "electrician7", time: "14:00", end: "15:00", prio: "NORMAL" },
    { sId: "SRV_E_06", cat: "Electrical", desc: "Install 4 surface LED panel lights in hallway.", tech: "electrician13", time: "13:00", end: "14:00", prio: "NORMAL" },
  ];

  for (let i = 0; i < offeredServices.length; i++) {
    const s = offeredServices[i];
    const z = zones[(i + 1) % zones.length];
    const c = customerNames[(i + 6) % customerNames.length];
    const bId = `BK_${idCounter}`;
    const ref = `DG-2026-${idCounter}`;
    idCounter++;

    jobs.push({
      bookingId: bId,
      bookingReference: ref,
      customerName: c.name,
      customerPhone: c.phone,
      serviceId: s.sId,
      category: s.cat as any,
      problemDescription: s.desc,
      serviceAddress: `${400 + i}, ${z.addr}`,
      lat: Number((z.lat + (i * 0.002 - 0.003)).toFixed(6)),
      lng: Number((z.lng + (i * 0.002 - 0.003)).toFixed(6)),
      nodeId: z.node,
      preferredDate: baseDate,
      preferredStartTime: s.time,
      preferredEndTime: s.end,
      requestedPriority: s.prio as any,
      verifiedPriority: s.prio as any,
      bookingStatus: "OFFERED",
      assignedTechUsername: s.tech,
      travelMinutes: 15,
      notes: "Job offer dispatched to technician; awaiting acceptance or rejection.",
    });
  }

  // 5. PENDING FEASIBLE JOBS (15 Jobs) - Ready to be automatically allotted by engine
  const pendingServices = [
    { sId: "SRV_E_04", cat: "Electrical", desc: "Sudden blackout in kids room, breakers not engaging.", prio: "HIGH", time: "15:00", end: "16:00" },
    { sId: "SRV_AC_02", cat: "AC", desc: "Musty odor and dust blowing from study AC unit.", prio: "NORMAL", time: "14:00", end: "15:00" },
    { sId: "SRV_P_01", cat: "Plumbing", desc: "Pipe connector dripping under washbasin cabinet.", prio: "NORMAL", time: "15:30", end: "16:30" },
    { sId: "SRV_E_05", cat: "Electrical", desc: "Dining fan regulator sparking and stuck at low speed.", prio: "NORMAL", time: "16:00", end: "16:45" },
    { sId: "SRV_AC_04", cat: "AC", desc: "AC unit cutting out every 10 minutes with error E4.", prio: "HIGH", time: "16:00", end: "17:00" },
    { sId: "SRV_P_02", cat: "Plumbing", desc: "Kitchen sink swan-neck tap wobbling and leaking at base.", prio: "NORMAL", time: "14:30", end: "15:15" },
    { sId: "SRV_E_01", cat: "Electrical", desc: "Wiring replacement for outdoor weatherproof garden lights.", prio: "NORMAL", time: "16:30", end: "18:00" },
    { sId: "SRV_AC_03", cat: "AC", desc: "Refrigerant low; freezing frost forming on indoor evaporator.", prio: "HIGH", time: "15:30", end: "16:45" },
    { sId: "SRV_P_04", cat: "Plumbing", desc: "Overhead tank float switch stuck; tank overflowing onto roof.", prio: "EMERGENCY", time: "11:00", end: "11:30" },
    { sId: "SRV_E_03", cat: "Electrical", desc: "Install 63A double pole isolator switch for solar inverter.", prio: "NORMAL", time: "14:30", end: "15:30" },
    { sId: "SRV_AC_06", cat: "AC", desc: "Comprehensive preventive servicing before family gathering.", prio: "NORMAL", time: "15:00", end: "16:00" },
    { sId: "SRV_P_03", cat: "Plumbing", desc: "Heavy drainage clog in utility sink causing slow drain.", prio: "NORMAL", time: "16:00", end: "17:15" },
    { sId: "SRV_E_02", cat: "Electrical", desc: "Living room TV wall socket burnt and loose.", prio: "NORMAL", time: "15:00", end: "15:45" },
    { sId: "SRV_AC_01", cat: "AC", desc: "Daikin split AC copper pipe installation and wall mounting.", prio: "NORMAL", time: "14:00", end: "16:00" },
    { sId: "SRV_P_01", cat: "Plumbing", desc: "Bathroom wall shower mixer leaking continuous trickle.", prio: "NORMAL", time: "16:30", end: "17:30" },
  ];

  for (let i = 0; i < pendingServices.length; i++) {
    const s = pendingServices[i];
    const z = zones[(i + 7) % zones.length];
    const c = customerNames[(i + 8) % customerNames.length];
    const bId = `BK_${idCounter}`;
    const ref = `DG-2026-${idCounter}`;
    idCounter++;

    jobs.push({
      bookingId: bId,
      bookingReference: ref,
      customerName: c.name,
      customerPhone: c.phone,
      serviceId: s.sId,
      category: s.cat as any,
      problemDescription: s.desc,
      serviceAddress: `${500 + i}, ${z.addr}`,
      lat: Number((z.lat + (i * 0.002 - 0.005)).toFixed(6)),
      lng: Number((z.lng + (i * 0.002 - 0.005)).toFixed(6)),
      nodeId: z.node,
      preferredDate: baseDate,
      preferredStartTime: s.time,
      preferredEndTime: s.end,
      requestedPriority: s.prio as any,
      verifiedPriority: s.prio as any,
      bookingStatus: "PENDING",
      notes: "Newly submitted booking, queued for automated matching.",
    });
  }

  // 6. UNASSIGNABLE JOBS (7 Jobs) - With explicit, actionable unassignment reasons
  const unassignableCases = [
    {
      sId: "SRV_AC_05",
      cat: "AC",
      desc: "Industrial VRV chiller compressor rebuild requiring Class 5 Nuclear/Industrial HVAC accreditation.",
      prio: "HIGH",
      time: "10:00",
      end: "12:00",
      reason: "Technician lacks the required specialized industrial AC certification (Class 5 Substation HVAC).",
    },
    {
      sId: "SRV_E_04",
      cat: "Electrical",
      desc: "Midnight power restoration at 23:30 - 00:30 outside regular shift bounds.",
      prio: "EMERGENCY",
      time: "23:30",
      end: "00:30",
      reason: "Appointment time (23:30-00:30) falls strictly outside all registered technician shift working hours (08:00-18:00).",
    },
    {
      sId: "SRV_P_03",
      cat: "Plumbing",
      desc: "Emergency sewer drain jetting at remote rural highway junction 45km outside city limits.",
      prio: "NORMAL",
      time: "14:00",
      end: "15:15",
      reason: "Job location is outside all 10 registered urban service coverage zones.",
    },
    {
      sId: "SRV_AC_01",
      cat: "AC",
      desc: "Commercial central AC installation during peak shift where all certified AC specialists are already fully booked.",
      prio: "HIGH",
      time: "10:30",
      end: "12:30",
      reason: "Schedule conflict: All AC certified specialists (Amit Patel, Karan Malhotra, etc.) have confirmed concurrent assignments during 10:30-12:30.",
    },
    {
      sId: "SRV_E_01",
      cat: "Electrical",
      desc: "Entire apartment building main busbar rewire requiring 3 simultaneous master contractors.",
      prio: "NORMAL",
      time: "09:00",
      end: "11:00",
      reason: "Insufficient travel time to meet strict 15-minute SLA buffer from available technician depot.",
    },
    {
      sId: "SRV_P_04",
      cat: "Plumbing",
      desc: "High rise building multi-stage fire booster pump motor rewind.",
      prio: "HIGH",
      time: "11:00",
      end: "12:30",
      reason: "All suitable plumbing technicians declined the job offer due to heavy tool requirements.",
    },
    {
      sId: "SRV_E_03",
      cat: "Electrical",
      desc: "Substation heavy breaker installation at 06:00 AM before shifts begin.",
      prio: "NORMAL",
      time: "06:00",
      end: "07:00",
      reason: "Requested appointment (06:00-07:00) is before technician shift start time (08:00).",
    },
  ];

  for (let i = 0; i < unassignableCases.length; i++) {
    const s = unassignableCases[i];
    const z = zones[i % zones.length];
    const c = customerNames[(i + 10) % customerNames.length];
    const bId = `BK_${idCounter}`;
    const ref = `DG-2026-${idCounter}`;
    idCounter++;

    jobs.push({
      bookingId: bId,
      bookingReference: ref,
      customerName: c.name,
      customerPhone: c.phone,
      serviceId: s.sId,
      category: s.cat as any,
      problemDescription: s.desc,
      serviceAddress: `${600 + i}, ${z.addr}`,
      lat: Number((z.lat + 0.015).toFixed(6)),
      lng: Number((z.lng + 0.015).toFixed(6)),
      nodeId: z.node,
      preferredDate: baseDate,
      preferredStartTime: s.time,
      preferredEndTime: s.end,
      requestedPriority: s.prio as any,
      verifiedPriority: s.prio as any,
      bookingStatus: "UNASSIGNED",
      unassignedReason: s.reason,
      notes: "Actionable explanation stored; system alerted dispatch supervisor.",
    });
  }

  // 7. CANCELLED / DISRUPTED JOBS (5 Jobs)
  const cancelledServices = [
    { sId: "SRV_E_02", cat: "Electrical", desc: "Customer called to cancel: landlord had already fixed the light switch.", prio: "NORMAL", time: "11:00", end: "11:45" },
    { sId: "SRV_AC_02", cat: "AC", desc: "Customer rescheduled to next week due to sudden business travel.", prio: "NORMAL", time: "14:00", end: "15:00" },
    { sId: "SRV_P_01", cat: "Plumbing", desc: "Duplicate booking submitted by tenant and building manager.", prio: "NORMAL", time: "10:00", end: "11:00" },
    { sId: "SRV_E_05", cat: "Electrical", desc: "Cancelled after false alarm regarding fan noise.", prio: "NORMAL", time: "12:00", end: "12:45" },
    { sId: "SRV_AC_04", cat: "AC", desc: "Old AC unit replaced with new warranty unit directly by brand.", prio: "NORMAL", time: "16:00", end: "17:00" },
  ];

  for (let i = 0; i < cancelledServices.length; i++) {
    const s = cancelledServices[i];
    const z = zones[(i + 2) % zones.length];
    const c = customerNames[(i + 12) % customerNames.length];
    const bId = `BK_${idCounter}`;
    const ref = `DG-2026-${idCounter}`;
    idCounter++;

    jobs.push({
      bookingId: bId,
      bookingReference: ref,
      customerName: c.name,
      customerPhone: c.phone,
      serviceId: s.sId,
      category: s.cat as any,
      problemDescription: s.desc,
      serviceAddress: `${700 + i}, ${z.addr}`,
      lat: Number((z.lat - 0.005).toFixed(6)),
      lng: Number((z.lng - 0.005).toFixed(6)),
      nodeId: z.node,
      preferredDate: baseDate,
      preferredStartTime: s.time,
      preferredEndTime: s.end,
      requestedPriority: s.prio as any,
      verifiedPriority: s.prio as any,
      bookingStatus: "CANCELLED",
      notes: "Customer cancelled booking. Technician slot safely freed.",
    });
  }

  return jobs;
}
