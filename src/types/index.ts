// DispatchGrid Frontend Type Definitions

export type UserRole = "CUSTOMER" | "TECHNICIAN" | "ADMIN";
export type ServiceCategory = "Electrical" | "AC" | "Plumbing";
export type PriorityLevel = "NORMAL" | "HIGH" | "EMERGENCY";

export type BookingStatus =
  | "PENDING"
  | "OFFERED"
  | "ASSIGNED"
  | "ON_THE_WAY"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED"
  | "UNASSIGNED"
  | "REQUESTED"
  | "UNDER_REVIEW"
  | "ACCEPTED"
  | "SCHEDULED"
  | "TECHNICIAN_ACCEPTED"
  | "REJECTED";

export interface User {
  userId: string;
  username?: string;
  fullName: string;
  email: string;
  phone: string;
  role: UserRole;
  accountStatus: "PENDING" | "ACTIVE" | "SUSPENDED" | "REJECTED";
  profilePictureUrl?: string;
  addresses?: CustomerAddress[];
  skills?: TechnicianSkill[];
  certifications?: TechnicianCert[];
  serviceAreas?: string[];
  averageRating?: number;
  totalCompletedJobs?: number;
  availabilityStatus?: string;
  shiftStartTime?: string;
  shiftEndTime?: string;
}

export interface CustomerAddress {
  address_id: string;
  customer_id: string;
  label: string;
  address_line: string;
  city: string;
  state: string;
  pincode: string;
  latitude: number;
  longitude: number;
  is_default: number;
}

export interface TechnicianSkill {
  skill_id: string;
  skill_name: string;
  category: ServiceCategory;
  years_experience?: number;
}

export interface TechnicianCert {
  certification_id: string;
  certification_name: string;
  issuing_authority?: string;
  certificate_number?: string;
}

export interface Technician {
  userId: string;
  username?: string;
  fullName: string;
  email: string;
  phone: string;
  accountStatus: string;
  experienceYears: number;
  serviceCategories: string[];
  verificationStatus: "PENDING" | "APPROVED" | "REJECTED";
  verificationNotes?: string;
  verifiedAt?: string;
  residentialAddress: string;
  city: string;
  pincode: string;
  currentLatitude: number;
  currentLongitude: number;
  serviceAreas: string[];
  availabilityStatus: "AVAILABLE" | "BUSY" | "UNAVAILABLE" | "ON_BREAK";
  workingDays: string[];
  shiftStartTime: string;
  shiftEndTime: string;
  reservedEmergencyCapacity: string;
  totalCompletedJobs: number;
  averageRating: number;
  skills: { skillId: string; skillName: string; category: string }[];
  certifications: { certId: string; certName: string; category: string; certNumber?: string }[];
  activeBookingsCount?: number;
}

export interface ServiceItem {
  serviceId: string;
  serviceName: string;
  category: ServiceCategory;
  description: string;
  estimatedDurationMinutes: number;
  indicativePrice: number;
  requiredSkills: string[];
  requiredCertifications: string[];
  isActive: boolean;
}

export interface Booking {
  bookingId: string;
  bookingReference: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  serviceId: string;
  serviceName?: string;
  category?: ServiceCategory;
  indicativePrice?: number;
  estimatedDurationMinutes?: number;
  assignedTechnicianId?: string | null;
  assignedTechnicianName?: string;
  assignedTechnicianPhone?: string;
  assignedTechnicianRating?: number;
  requestedPriority: PriorityLevel;
  verifiedPriority: PriorityLevel;
  bookingStatus: BookingStatus;
  problemDescription: string;
  notes?: string;
  unassignedReason?: string;
  photoUrl?: string;
  serviceAddress: string;
  latitude: number;
  longitude: number;
  nodeId: string;
  preferredDate: string;
  preferredStartTime: string;
  preferredEndTime: string;
  preferredTechnicianId?: string;
  preferredTechnicianName?: string;
  confirmedStartTime?: string;
  confirmedEndTime?: string;
  estimatedTravelTimeMinutes?: number;
  actualStartTime?: string;
  actualEndTime?: string;
  completionNotes?: string;
  cancellationReason?: string;
  createdAt: string;
  customerRating?: number;
  customerReview?: string;
  route?: any;
  distanceKm?: number;
  travelMinutes?: number;
  estimatedArrivalTime?: string;
  isSimulatedTracking?: boolean;
}

export interface JobOffer {
  offerId: string;
  bookingId: string;
  technicianId?: string;
  technicianName?: string;
  technicianUsername?: string;
  bookingReference: string;
  serviceName: string;
  category: ServiceCategory;
  problemDescription: string;
  serviceAddress: string;
  customerLat?: number;
  customerLng?: number;
  preferredDate: string;
  preferredStartTime: string;
  preferredEndTime: string;
  requestedPriority: PriorityLevel;
  verifiedPriority: PriorityLevel;
  estimatedDurationMinutes: number;
  price?: number;
  travelMinutes: number;
  distanceKm: number;
  score?: number;
  offerStatus: "OFFERED" | "ACCEPTED" | "REJECTED" | "EXPIRED" | "WITHDRAWN";
  rejectionReason?: string;
  offeredAt: string;
  respondedAt?: string;
}

export interface AssignmentRecord {
  record_id: string;
  scheduling_run_id: string;
  booking_id: string;
  booking_reference?: string;
  assigned_technician_id: string;
  technician_name?: string;
  calculated_travel_time_minutes: number;
  assignment_score: number;
  selection_reason: string;
  evaluatedCandidates: {
    technicianId: string;
    fullName: string;
    phone: string;
    travelMinutes: number;
    distanceKm: number;
    activeJobsCount: number;
    rating: number;
    assignmentCost: number;
    isPreferredByCustomer: boolean;
    scoreBreakdown: {
      travelScore: number;
      slaScore: number;
      workloadScore: number;
      disruptionScore: number;
    };
  }[];
  rejectedAlternatives: {
    technicianId: string;
    fullName: string;
    reasons: string[];
  }[];
  assigned_at: string;
}

export interface RecoveryAuditLog {
  recovery_id: string;
  disruption_type: string;
  affected_technician_id?: string;
  affected_technician_name?: string;
  affectedBookingIds: string[];
  previousAssignments: Record<string, string>;
  revisedAssignments: Record<string, string>;
  reason: string;
  execution_time_ms: number;
  status: "SUCCESS" | "PARTIAL" | "FAILED";
  notificationsSent: { recipientId: string; message: string }[];
  timestamp: string;
}

export interface RoadNode {
  id: string;
  name: string;
  lat: number;
  lng: number;
  locality: string;
}

export interface RoadEdge {
  from: string;
  to: string;
  travelMinutes: number;
  distanceKm: number;
  roadName: string;
}

export interface BenchmarkMetrics {
  tier: string;
  jobsCount: number;
  techniciansCount: number;
  assignedCount: number;
  unassignedCount: number;
  coveragePercent: number;
  totalTravelMinutes: number;
  averageTravelMinutes: number;
  slaViolations: number;
  unassignedHighPriorityJobs: number;
  workloadImbalanceStdDev: number;
  overtimeMinutes: number;
  schedulingExecutionTimeMs: number;
  recoveryExecutionTimeMs: number;
  constraintViolations: number;
}
