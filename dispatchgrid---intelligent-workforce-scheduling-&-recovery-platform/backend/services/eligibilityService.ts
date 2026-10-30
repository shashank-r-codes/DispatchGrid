// Technician Eligibility Filtering Service
// Enforces Hard Constraints: Verification, Skills, Certifications, AC distinction, Hours, Conflicts

import { db } from "../config/database.js";
import { dijkstraService } from "./dijkstraService.js";
import { METRO_NODES } from "../config/roadNetwork.js";

export interface TechnicianCandidate {
  userId: string;
  fullName: string;
  phone: string;
  experienceYears: number;
  serviceCategories: string[];
  verificationStatus: "PENDING" | "APPROVED" | "REJECTED";
  availabilityStatus: "AVAILABLE" | "BUSY" | "UNAVAILABLE" | "ON_BREAK";
  currentLatitude: number;
  currentLongitude: number;
  serviceAreas: string[];
  workingDays: string[];
  shiftStartTime: string;
  shiftEndTime: string;
  reservedEmergencyCapacity: string;
  totalCompletedJobs: number;
  averageRating: number;
  skills: { skillId: string; skillName: string; category: string }[];
  certifications: { certId: string; certName: string; category: string }[];
  activeBookingsCount: number;
}

export interface EligibilityResult {
  technician: TechnicianCandidate;
  isEligible: boolean;
  rejectionReasons: string[];
  travelMinutes: number;
  distanceKm: number;
  pathNodes: string[];
}

export class EligibilityService {
  /**
   * Retrieves all technicians from DB with aggregated skills and certs
   */
  public static getAllTechnicians(): TechnicianCandidate[] {
    const rows = db.prepare(`
      SELECT 
        u.user_id as userId,
        u.full_name as fullName,
        u.phone,
        tp.experience_years as experienceYears,
        tp.service_categories as serviceCategoriesStr,
        tp.verification_status as verificationStatus,
        tp.availability_status as availabilityStatus,
        tp.current_latitude as currentLatitude,
        tp.current_longitude as currentLongitude,
        tp.service_areas as serviceAreasStr,
        tp.working_days as workingDaysStr,
        tp.shift_start_time as shiftStartTime,
        tp.shift_end_time as shiftEndTime,
        tp.reserved_emergency_capacity as reservedEmergencyCapacity,
        tp.total_completed_jobs as totalCompletedJobs,
        tp.average_rating as averageRating
      FROM users u
      JOIN technician_profiles tp ON u.user_id = tp.user_id
    `).all() as any[];

    return rows.map((r) => {
      // Fetch skills
      const skills = db.prepare(`
        SELECT s.skill_id as skillId, s.skill_name as skillName, s.category
        FROM technician_skills ts
        JOIN skills s ON ts.skill_id = s.skill_id
        WHERE ts.technician_id = ?
      `).all(r.userId) as { skillId: string; skillName: string; category: string }[];

      // Fetch certifications
      const certifications = db.prepare(`
        SELECT c.certification_id as certId, c.certification_name as certName, c.category
        FROM technician_certifications tc
        JOIN certifications c ON tc.certification_id = c.certification_id
        WHERE tc.technician_id = ?
      `).all(r.userId) as { certId: string; certName: string; category: string }[];

      // Count active bookings today
      const today = new Date().toISOString().split("T")[0];
      const activeCount = db.prepare(`
        SELECT COUNT(*) as count FROM bookings
        WHERE assigned_technician_id = ?
        AND preferred_date = ?
        AND booking_status IN ('SCHEDULED', 'TECHNICIAN_ACCEPTED', 'ON_THE_WAY', 'IN_PROGRESS')
      `).get(r.userId, today) as { count: number };

      let parsedAreas: string[] = [];
      try {
        parsedAreas = JSON.parse(r.serviceAreasStr);
      } catch {
        parsedAreas = r.serviceAreasStr ? r.serviceAreasStr.split(",").map((s: string) => s.trim()) : [];
      }

      return {
        userId: r.userId,
        fullName: r.fullName,
        phone: r.phone,
        experienceYears: r.experienceYears,
        serviceCategories: r.serviceCategoriesStr.split(",").map((c: string) => c.trim()),
        verificationStatus: r.verificationStatus,
        availabilityStatus: r.availabilityStatus,
        currentLatitude: r.currentLatitude,
        currentLongitude: r.currentLongitude,
        serviceAreas: parsedAreas,
        workingDays: r.workingDaysStr.split(",").map((d: string) => d.trim()),
        shiftStartTime: r.shiftStartTime,
        shiftEndTime: r.shiftEndTime,
        reservedEmergencyCapacity: r.reservedEmergencyCapacity || "11:00-11:30",
        totalCompletedJobs: r.totalCompletedJobs,
        averageRating: r.averageRating,
        skills,
        certifications,
        activeBookingsCount: activeCount.count,
      };
    });
  }

  /**
   * Evaluates eligibility of all technicians for a given job.
   * Hard constraints must NOT be violated!
   */
  public static evaluateCandidates(
    job: {
      category: "Electrical" | "AC" | "Plumbing";
      requiredSkills: string[];
      requiredCertifications: string[];
      nodeId: string;
      latitude: number;
      longitude: number;
      preferredDate: string;
      preferredStartTime: string;
      preferredEndTime: string;
      verifiedPriority?: string;
    }
  ): EligibilityResult[] {
    const technicians = this.getAllTechnicians();
    const results: EligibilityResult[] = [];

    // Parse job day of week (e.g. 'Mon', 'Tue')
    const jobDate = new Date(job.preferredDate);
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const jobDayName = dayNames[jobDate.getDay()];

    const targetNode = METRO_NODES[job.nodeId] || METRO_NODES.NODE_CENTRAL;

    for (const tech of technicians) {
      const reasons: string[] = [];

      // 1. Verification status constraint
      if (tech.verificationStatus !== "APPROVED") {
        reasons.push(`Technician account verification status is ${tech.verificationStatus} (Only APPROVED technicians are eligible)`);
      }

      // 2. Base availability status
      if (tech.availabilityStatus === "UNAVAILABLE") {
        reasons.push("Technician is currently flagged as UNAVAILABLE (e.g. reported sick or on leave)");
      }

      // 3. Category match & distinct AC specialisation enforcement
      if (job.category === "AC") {
        const hasACCategory = tech.serviceCategories.includes("AC");
        if (!hasACCategory) {
          reasons.push("Lacks AC department qualification (Rule: General Electrical technicians do not qualify for AC repair)");
        }
      } else {
        const hasCategory = tech.serviceCategories.includes(job.category);
        if (!hasCategory) {
          reasons.push(`Not listed in the required service department (${job.category})`);
        }
      }

      // 4. Mandatory Skills match
      const techSkillNames = new Set(tech.skills.map((s) => s.skillName.toLowerCase()));
      for (const reqSkill of job.requiredSkills) {
        if (!techSkillNames.has(reqSkill.toLowerCase())) {
          reasons.push(`Missing mandatory skill: "${reqSkill}"`);
        }
      }

      // 5. Mandatory Certifications match
      const techCertNames = new Set(tech.certifications.map((c) => c.certName.toLowerCase()));
      for (const reqCert of job.requiredCertifications) {
        if (!techCertNames.has(reqCert.toLowerCase())) {
          reasons.push(`Missing required professional certification: "${reqCert}"`);
        }
      }

      // 6. Working Days
      if (jobDayName && !tech.workingDays.includes(jobDayName)) {
        reasons.push(`Technician does not work on ${jobDayName} (Scheduled days: ${tech.workingDays.join(", ")})`);
      }

      // 7. Shift Time Constraint
      const jobStartHour = parseInt(job.preferredStartTime.split(":")[0], 10);
      const jobEndHour = parseInt(job.preferredEndTime.split(":")[0], 10);
      const techStartHour = parseInt(tech.shiftStartTime.split(":")[0], 10);
      const techEndHour = parseInt(tech.shiftEndTime.split(":")[0], 10);

      if (jobStartHour < techStartHour || jobEndHour > techEndHour) {
        reasons.push(`Appointment time (${job.preferredStartTime}-${job.preferredEndTime}) falls outside technician's shift (${tech.shiftStartTime}-${tech.shiftEndTime})`);
      }

      // 8. Service Area
      if (targetNode.locality) {
        const matchesArea = tech.serviceAreas.some(
          (area) =>
            area.toLowerCase().includes(targetNode.locality.toLowerCase()) ||
            targetNode.locality.toLowerCase().includes(area.toLowerCase()) ||
            area.toLowerCase().includes("cbd") ||
            area.toLowerCase().includes("central")
        );
        if (!matchesArea && tech.serviceAreas.length > 0) {
          reasons.push(`Target locality "${targetNode.locality}" is not in technician's registered service zones (${tech.serviceAreas.join(", ")})`);
        }
      }

      // 9. Existing Booking Schedule Conflict Check
      const conflictingBookings = db.prepare(`
        SELECT booking_id, booking_reference, preferred_start_time, preferred_end_time, booking_status
        FROM bookings
        WHERE assigned_technician_id = ?
        AND preferred_date = ?
        AND booking_status IN ('SCHEDULED', 'TECHNICIAN_ACCEPTED', 'ON_THE_WAY', 'IN_PROGRESS')
      `).all(tech.userId, job.preferredDate) as any[];

      for (const existing of conflictingBookings) {
        const exStart = existing.preferred_start_time;
        const exEnd = existing.preferred_end_time;
        // Check time overlap: (start1 < end2) and (end1 > start2)
        if (job.preferredStartTime < exEnd && job.preferredEndTime > exStart) {
          // If this is an emergency, check if overlap is with reserved emergency capacity
          if (job.verifiedPriority === "EMERGENCY" && tech.reservedEmergencyCapacity) {
            const [capStart, capEnd] = tech.reservedEmergencyCapacity.split("-");
            if (job.preferredStartTime >= capStart && job.preferredEndTime <= capEnd) {
              // Allowed under reserved emergency capacity window!
              continue;
            }
          }
          reasons.push(`Schedule conflict with existing booking ${existing.booking_reference} (${exStart}-${exEnd})`);
        }
      }

      // 10. Travel Time via Dijkstra
      const dijkstraResult = dijkstraService.calculateTravelBetweenCoords(
        tech.currentLatitude,
        tech.currentLongitude,
        job.latitude,
        job.longitude
      );

      results.push({
        technician: tech,
        isEligible: reasons.length === 0,
        rejectionReasons: reasons,
        travelMinutes: dijkstraResult.travelMinutes,
        distanceKm: dijkstraResult.distanceKm,
        pathNodes: dijkstraResult.path,
      });
    }

    return results;
  }
}
