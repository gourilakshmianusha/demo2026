export type OpportunityCategory = 'Website Development' | 'SEO' | 'Web Dev + SEO';

export type SocialPlatform =
  | 'Instagram'
  | 'Facebook'
  | 'Google'
  | 'Reddit'
  | 'LinkedIn'
  | 'X (Twitter)'
  | 'Hacker News'
  | 'IndieHackers'
  | 'Other';

export type PipelineStage =
  | 'New Lead'
  | 'Contacted'
  | 'Proposal Sent'
  | 'Interviewing'
  | 'Won'
  | 'Archived';

export type ApplicantSpecialty = 'Website Development' | 'SEO' | 'Full-Stack & SEO';

export type ApplicantStatus =
  | 'Available'
  | 'Shortlisted'
  | 'Interviewing'
  | 'Assigned'
  | 'On Hold';

export interface ContactInfo {
  contactName: string;
  handle: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  preferredChannel: string;
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export type HiringStatus =
  | 'Still Looking'
  | 'Updated Recently'
  | 'Likely Filled'
  | 'Closed'
  | 'Needs Check';

export interface Opportunity {
  id: string;
  title: string;
  platform: SocialPlatform;
  category: OpportunityCategory;
  summary: string;
  requirements: string[];
  budget: string;
  location: string;
  postedDate: string;
  sourceUrl: string;
  contact: ContactInfo;
  stage: PipelineStage;
  assignedApplicantId: string | null;
  notes: string;
  discoveredAt: string;
  isVerifiedSource: boolean;
  hiringStatus: HiringStatus;
  statusCheckedAt: string;
  statusEvidence: string;
  groundingSources: GroundingSource[];
  searchQueries?: string[];
  outreachDraft?: string;
}

export interface Applicant {
  id: string;
  fullName: string;
  specialty: ApplicantSpecialty;
  roleTitle: string;
  skills: string[];
  experienceYears: number;
  hourlyRate: string;
  location: string;
  status: ApplicantStatus;
  email: string;
  phone: string;
  portfolioUrl: string;
  githubOrLinkedIn: string;
  notes: string;
  appliedAt: string;
}

export interface ScanLog {
  id: string;
  scannedAt: string;
  platformFilter: string;
  categoryFilter: string;
  keywords: string;
  foundCount: number;
  addedCount: number;
  groundingSources: GroundingSource[];
  searchQueries?: string[];
}

export interface TrackerStore {
  opportunities: Opportunity[];
  applicants: Applicant[];
  scanHistory: ScanLog[];
}
