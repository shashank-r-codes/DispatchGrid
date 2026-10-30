// Priority-Based Job Queue with SLA deadlines and Aging to prevent starvation

export interface SchedulingJob {
  bookingId: string;
  bookingReference: string;
  customerId: string;
  serviceId: string;
  category: "Electrical" | "AC" | "Plumbing";
  requiredSkills: string[];
  requiredCertifications: string[];
  nodeId: string;
  latitude: number;
  longitude: number;
  serviceAddress: string;
  requestedPriority: "NORMAL" | "HIGH" | "EMERGENCY";
  verifiedPriority: "NORMAL" | "HIGH" | "EMERGENCY";
  preferredDate: string;
  preferredStartTime: string;
  preferredEndTime: string;
  preferredTechnicianId?: string | null;
  estimatedDurationMinutes: number;
  createdAt: string;
  queueScore?: number;
  slaDeadlineMinutes?: number;
}

export class PriorityQueue {
  /**
   * Calculates dynamic queue priority score:
   * Higher score = earlier dispatch in queue
   * Factors:
   * - Verified Emergency (Highest priority tier: 10,000 pts)
   * - Verified High Priority (5,000 pts)
   * - Normal Priority (1,000 pts)
   * - Waiting / Aging Time: +5 points per minute waited since creation (prevents starvation)
   * - SLA Deadline: penalty if closer to deadline
   */
  public static calculatePriorityScore(job: SchedulingJob): number {
    let baseScore = 1000;
    if (job.verifiedPriority === "EMERGENCY") {
      baseScore = 10000;
    } else if (job.verifiedPriority === "HIGH") {
      baseScore = 5000;
    }

    const createdTime = new Date(job.createdAt).getTime();
    const now = Date.now();
    const waitedMinutes = Math.max(0, Math.floor((now - createdTime) / (1000 * 60)));

    // Aging factor: 5 points per minute of waiting
    const agingScore = waitedMinutes * 5;

    // SLA urgency: calculate minutes until preferred window
    const targetTime = new Date(`${job.preferredDate}T${job.preferredStartTime}:00Z`).getTime();
    const minutesRemaining = Math.floor((targetTime - now) / (1000 * 60));
    const slaScore = minutesRemaining < 60 ? 1500 : minutesRemaining < 180 ? 500 : 0;

    return baseScore + agingScore + slaScore;
  }

  /**
   * Sorts jobs in descending order of calculated priority
   */
  public static rankJobs(jobs: SchedulingJob[]): SchedulingJob[] {
    return [...jobs]
      .map(j => ({ ...j, queueScore: this.calculatePriorityScore(j) }))
      .sort((a, b) => (b.queueScore || 0) - (a.queueScore || 0));
  }
}
