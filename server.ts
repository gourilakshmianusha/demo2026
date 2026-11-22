import express, { type Request, type Response, type NextFunction } from 'express';
import http from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import type {
  Applicant,
  ApplicantSpecialty,
  ApplicantStatus,
  GroundingSource,
  HiringStatus,
  Opportunity,
  OpportunityCategory,
  PipelineStage,
  ScanLog,
  SocialPlatform,
  TrackerStore,
} from './src/types';

dotenv.config();

const PORT = 3000;
const DATA_DIR = path.resolve(process.cwd(), 'data');
const STORE_PATH = path.resolve(DATA_DIR, 'tracker-store.json');
const AUTH_PATH = path.resolve(DATA_DIR, 'auth-store.json');

const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days
const revokedTokens = new Set<string>();

interface AuthRecord {
  email: string;
  salt: string;
  passwordHash: string;
  createdAt: string;
}

const VALID_PLATFORMS: SocialPlatform[] = [
  'Instagram',
  'Facebook',
  'Google',
  'Reddit',
  'LinkedIn',
  'X (Twitter)',
  'Hacker News',
  'IndieHackers',
  'Other',
];

const VALID_CATEGORIES: OpportunityCategory[] = [
  'Website Development',
  'SEO',
  'Web Dev + SEO',
];

const VALID_STAGES: PipelineStage[] = [
  'New Lead',
  'Contacted',
  'Proposal Sent',
  'Interviewing',
  'Won',
  'Archived',
];

const VALID_APPLICANT_SPECIALTIES: ApplicantSpecialty[] = [
  'Website Development',
  'SEO',
  'Full-Stack & SEO',
];

const VALID_APPLICANT_STATUSES: ApplicantStatus[] = [
  'Available',
  'Shortlisted',
  'Interviewing',
  'Assigned',
  'On Hold',
];

function sanitizeUrl(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
    return '';
  } catch {
    return '';
  }
}

function sanitizeOptionalString(raw: unknown, maxLen = 400): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim().slice(0, maxLen);
  return trimmed.length > 0 ? trimmed : null;
}

function sanitizeRequiredString(raw: unknown, fallback: string, maxLen = 500): string {
  if (typeof raw !== 'string') return fallback;
  const trimmed = raw.trim().slice(0, maxLen);
  return trimmed.length > 0 ? trimmed : fallback;
}

function decodeHtmlAndStripTags(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<p>/gi, '\n')
    .replace(/<a[^>]*href=["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi, '$2 ($1)')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x2F;/g, '/')
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function extractContactFieldsFromText(text: string): {
  email: string | null;
  website: string | null;
  phone: string | null;
  budget: string | null;
} {
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  const urlMatches = text.match(/https?:\/\/[^\s)>"',]+/g) || [];
  const website =
    urlMatches.find(
      (u) =>
        !u.includes('news.ycombinator.com') &&
        !u.includes('mastodon.social') &&
        !u.includes('fosstodon.org') &&
        !u.includes('remotive.com') &&
        !u.includes('weworkremotely.com')
    ) || null;
  const phoneMatch = text.match(/(?:\+\d{1,3}[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/);
  const budgetMatch = text.match(
    /(?:\$|USD\s?|EUR\s?|€|£)\s?\d{2,6}(?:[,\d]*)?(?:\s?-\s?(?:\$|USD\s?|EUR\s?|€|£)?\s?\d{2,6}(?:[,\d]*)?)?(?:\s?\/?\s?(?:hr|hour|mo|month|project|fixed|yr|year))?/i
  );

  return {
    email: emailMatch ? emailMatch[0] : null,
    website: website ? sanitizeUrl(website) || null : null,
    phone: phoneMatch ? phoneMatch[0].trim() : null,
    budget: budgetMatch ? budgetMatch[0].trim() : null,
  };
}

function extractTechSkillsFromText(text: string): string[] {
  const known = [
    'React',
    'Next.js',
    'TypeScript',
    'JavaScript',
    'WordPress',
    'Shopify',
    'Webflow',
    'WooCommerce',
    'Tailwind CSS',
    'Node.js',
    'HTML',
    'CSS',
    'PHP',
    'Laravel',
    'Technical SEO',
    'Local SEO',
    'On-Page SEO',
    'SEO',
    'Google Search Console',
    'Core Web Vitals',
    'Schema Markup',
    'Link Building',
    'GA4',
  ];
  const lower = text.toLowerCase();
  const found: string[] = [];
  for (const skill of known) {
    const token = skill.toLowerCase();
    if (token === 'seo' && found.some((s) => s.includes('SEO'))) continue;
    if (lower.includes(token)) {
      found.push(skill);
    }
    if (found.length >= 6) break;
  }
  return found;
}

function isSeekingFreelancerPost(text: string): boolean {
  const lower = text.toLowerCase();
  const selfPromoSignals = [
    'seeking work',
    'for hire',
    '[for hire]',
    'available for hire',
    'available for freelance',
    'looking for a new role',
    'looking for freelance work',
    'i am a freelance',
    "i'm a freelance",
    'my portfolio',
    'hire me',
    'open to work',
  ];
  for (const sig of selfPromoSignals) {
    if (lower.startsWith(sig) || lower.includes(sig)) {
      // Allow only if explicitly also stating "seeking freelancer" or "hiring"
      if (!lower.includes('seeking freelancer') && !lower.includes('[hiring]')) {
        return false;
      }
    }
  }
  const hiringSignals = [
    'seeking freelancer',
    'seeking a freelancer',
    'looking for a',
    'looking for an',
    'looking to hire',
    'we are hiring',
    "we're hiring",
    'hiring',
    'need a website',
    'need a web developer',
    'need an seo',
    'need seo',
    'freelance web',
    'contract',
    '[hiring]',
  ];
  return hiringSignals.some((sig) => lower.includes(sig));
}

function formatReadableApiError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err || '');
  const lower = raw.toLowerCase();
  if (lower.includes('resource_exhausted') || lower.includes('429') || lower.includes('quota')) {
    return 'Gemini API quota is currently exhausted for Google Search Grounding. Live direct feeds (WordPress Jobs, Freelancer.com, Hacker News, and Mastodon) remain available; you can upgrade your Gemini API key in Settings > Secrets.';
  }
  if (lower.includes('api_key_invalid') || lower.includes('permission_denied') || lower.includes('not configured')) {
    return 'Gemini API key is unavailable or invalid in Settings > Secrets. Live direct feeds are still active.';
  }
  return raw.length > 220 ? `${raw.slice(0, 220)}...` : raw || 'Request could not be completed.';
}

// --- Auth Persistence & Session Helpers ---

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readAuthRecord(): AuthRecord | null {
  if (!fs.existsSync(AUTH_PATH)) return null;
  try {
    const raw = fs.readFileSync(AUTH_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<AuthRecord>;
    if (parsed.email && parsed.salt && parsed.passwordHash) {
      return parsed as AuthRecord;
    }
    return null;
  } catch {
    return null;
  }
}

function writeAuthRecord(record: AuthRecord): void {
  ensureDataDir();
  const tmpPath = path.resolve(DATA_DIR, `auth-store.${crypto.randomUUID()}.tmp`);
  fs.writeFileSync(tmpPath, JSON.stringify(record, null, 2), 'utf-8');
  fs.renameSync(tmpPath, AUTH_PATH);
}

function isEnvAuthConfigured(): boolean {
  const pw = process.env.ADMIN_PASSWORD?.trim();
  return Boolean(pw && pw.length > 0);
}

function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function timingSafeMatchString(a: string, b: string): boolean {
  const hashA = crypto.createHash('sha256').update(a).digest();
  const hashB = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

function signSessionToken(email: string): string {
  const payload = Buffer.from(
    JSON.stringify({
      email,
      iat: Date.now(),
      exp: Date.now() + SESSION_TTL_MS,
      jti: crypto.randomUUID(),
    })
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifySessionToken(token: string): { email: string } | null {
  if (!token || revokedTokens.has(token)) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payload)
    .digest('base64url');
  if (!timingSafeMatchString(sig, expectedSig)) return null;
  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8')) as {
      email?: string;
      exp?: number;
    };
    if (!decoded.email || !decoded.exp || decoded.exp < Date.now()) {
      return null;
    }
    return { email: decoded.email };
  } catch {
    return null;
  }
}

function extractBearerToken(req: Request): string {
  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  return '';
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = extractBearerToken(req);
  const verified = verifySessionToken(token);
  if (!verified) {
    return res.status(401).json({ error: 'Authentication required. Please sign in.' });
  }
  (req as Request & { userEmail?: string }).userEmail = verified.email;
  next();
}

// --- Tracker Store Helpers ---

function ensureStore(): TrackerStore {
  ensureDataDir();
  if (!fs.existsSync(STORE_PATH)) {
    const initial: TrackerStore = {
      opportunities: [],
      applicants: [],
      scanHistory: [],
    };
    fs.writeFileSync(STORE_PATH, JSON.stringify(initial, null, 2), 'utf-8');
    return initial;
  }
  try {
    const raw = fs.readFileSync(STORE_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<TrackerStore>;
    const rawOpps = Array.isArray(parsed.opportunities) ? parsed.opportunities : [];
    const normalizedOpps: Opportunity[] = rawOpps.map((o) => ({
      ...o,
      hiringStatus: o.hiringStatus || 'Needs Check',
      statusCheckedAt: o.statusCheckedAt || o.discoveredAt || new Date().toISOString(),
      statusEvidence: o.statusEvidence || 'Imported record — click Check Status to verify live.',
    }));
    return {
      opportunities: normalizedOpps,
      applicants: Array.isArray(parsed.applicants) ? parsed.applicants : [],
      scanHistory: Array.isArray(parsed.scanHistory) ? parsed.scanHistory : [],
    };
  } catch {
    return { opportunities: [], applicants: [], scanHistory: [] };
  }
}

function writeStore(store: TrackerStore): void {
  ensureDataDir();
  const tmpPath = path.resolve(DATA_DIR, `tracker-store.${crypto.randomUUID()}.tmp`);
  fs.writeFileSync(tmpPath, JSON.stringify(store, null, 2), 'utf-8');
  fs.renameSync(tmpPath, STORE_PATH);
}

function getAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function extractJsonPayload(text: string): unknown {
  const trimmed = text.trim();
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch ? fencedMatch[1].trim() : trimmed;
  try {
    return JSON.parse(candidate);
  } catch {
    const firstBrace = candidate.indexOf('{');
    const lastBrace = candidate.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      return JSON.parse(candidate.slice(firstBrace, lastBrace + 1));
    }
    throw new Error('Could not parse structured JSON from search discovery output.');
  }
}

function normalizePlatform(value: unknown, sourceUrl: string): SocialPlatform {
  const raw = typeof value === 'string' ? value.toLowerCase() : '';
  const urlLower = sourceUrl.toLowerCase();
  if (
    raw.includes('instagram') ||
    urlLower.includes('instagram.com') ||
    urlLower.includes('instagr.am')
  )
    return 'Instagram';
  if (
    raw.includes('facebook') ||
    urlLower.includes('facebook.com') ||
    urlLower.includes('fb.com') ||
    urlLower.includes('fb.watch')
  )
    return 'Facebook';
  if (raw.includes('reddit') || urlLower.includes('reddit.com')) return 'Reddit';
  if (raw.includes('linkedin') || urlLower.includes('linkedin.com')) return 'LinkedIn';
  if (
    raw.includes('twitter') ||
    raw === 'x' ||
    raw.includes('x (') ||
    urlLower.includes('x.com') ||
    urlLower.includes('twitter.com')
  )
    return 'X (Twitter)';
  if (raw.includes('hacker') || raw.includes('hn') || urlLower.includes('ycombinator.com'))
    return 'Hacker News';
  if (raw.includes('indiehackers') || urlLower.includes('indiehackers.com'))
    return 'IndieHackers';
  if (
    raw === 'google' ||
    raw.includes('google') ||
    urlLower.includes('google.com') ||
    urlLower.includes('sites.google.com') ||
    urlLower.includes('business.google.com')
  )
    return 'Google';
  if (VALID_PLATFORMS.includes(value as SocialPlatform)) return value as SocialPlatform;
  return 'Other';
}

function normalizeCategory(value: unknown, textContext: string): OpportunityCategory | null {
  const raw = typeof value === 'string' ? value.toLowerCase() : '';
  const ctx = `${raw} ${textContext}`.toLowerCase();
  const hasWeb =
    raw.includes('web') ||
    raw.includes('site') ||
    ctx.includes('website') ||
    ctx.includes('web dev') ||
    ctx.includes('web developer') ||
    ctx.includes('wordpress') ||
    ctx.includes('shopify') ||
    ctx.includes('webflow') ||
    ctx.includes('react') ||
    ctx.includes('next.js') ||
    ctx.includes('frontend') ||
    ctx.includes('full-stack') ||
    ctx.includes('landing page') ||
    ctx.includes('ecommerce') ||
    ctx.includes('e-commerce');
  const hasSeo =
    raw.includes('seo') ||
    ctx.includes('seo') ||
    ctx.includes('search engine optimization') ||
    ctx.includes('core web vitals') ||
    ctx.includes('organic traffic') ||
    ctx.includes('backlink') ||
    ctx.includes('schema markup');

  if (!hasWeb && !hasSeo) return null;
  if (raw.includes('web dev + seo') || (hasWeb && hasSeo)) return 'Web Dev + SEO';
  if (raw === 'seo' || (hasSeo && !hasWeb)) return 'SEO';
  return 'Website Development';
}

const MAX_POST_AGE_DAYS = 14;

function isPublicExternalUrl(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
    const host = u.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host === '::1' ||
      host.endsWith('.local') ||
      host.startsWith('169.254.') ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function assessPostStatus(
  text: string,
  createdAtIso?: string
): { hiringStatus: HiringStatus; statusEvidence: string } {
  const lower = text.toLowerCase();
  const closedSignals = [
    'position filled',
    'role filled',
    'no longer looking',
    'already hired',
    'hired someone',
    'found someone',
    '[closed]',
    '[filled]',
    'applications closed',
    'this job has expired',
    'listing has expired',
  ];
  const matchedClosed = closedSignals.find((s) => lower.includes(s));
  if (matchedClosed) {
    return {
      hiringStatus: 'Closed',
      statusEvidence: `Post contains closed marker ("${matchedClosed}").`,
    };
  }

  let ageLabel = 'Recent post';
  let ageDays: number | null = null;
  if (createdAtIso) {
    const ms = new Date(createdAtIso).getTime();
    if (!Number.isNaN(ms)) {
      ageDays = Math.max(0, Math.floor((Date.now() - ms) / 86400_000));
      ageLabel = ageDays === 0 ? 'Posted today' : `Posted ${ageDays}d ago`;
    }
  }

  if (lower.includes('still looking') || lower.includes('update:') || lower.includes('repost')) {
    return {
      hiringStatus: 'Updated Recently',
      statusEvidence: `${ageLabel} · Explicitly mentions still looking / recently updated.`,
    };
  }

  if (ageDays !== null && ageDays <= MAX_POST_AGE_DAYS) {
    return {
      hiringStatus: 'Still Looking',
      statusEvidence: `${ageLabel} (within ${MAX_POST_AGE_DAYS}d window) · Actively seeking freelancer, no closed markers.`,
    };
  }

  return {
    hiringStatus: 'Needs Check',
    statusEvidence: `${ageLabel} · Verify source link for latest replies.`,
  };
}

function normalizeHiringStatus(raw: unknown, fallback: HiringStatus): HiringStatus {
  if (typeof raw !== 'string') return fallback;
  const lower = raw.toLowerCase();
  if (lower.includes('closed') || lower.includes('expired')) return 'Closed';
  if (lower.includes('filled')) return 'Likely Filled';
  if (lower.includes('updated')) return 'Updated Recently';
  if (lower.includes('still looking') || lower.includes('open') || lower.includes('active'))
    return 'Still Looking';
  return fallback;
}

// --- Direct Live Social & Community Fetchers (Strict 14-day freshness, freelance-only) ---

async function fetchHackerNewsLeads(
  categoryFilter: string,
  keywords: string
): Promise<{ opportunities: Omit<Opportunity, 'id' | 'discoveredAt'>[]; sources: GroundingSource[] }> {
  const results: Omit<Opportunity, 'id' | 'discoveredAt'>[] = [];
  const sources: GroundingSource[] = [];
  const cutoffEpoch = Math.floor((Date.now() - MAX_POST_AGE_DAYS * 86400_000) / 1000);

  try {
    const queryCandidates =
      categoryFilter === 'SEO'
        ? [keywords ? `SEO ${keywords}` : 'SEEKING FREELANCER', 'looking for SEO']
        : categoryFilter === 'Website Development'
          ? [
              keywords ? `website ${keywords}` : 'SEEKING FREELANCER',
              'looking for website',
              'need a website',
            ]
          : [
              keywords ? `website ${keywords}` : 'SEEKING FREELANCER',
              'looking for website',
              'looking for SEO',
            ];

    const responses = await Promise.all(
      queryCandidates.map(async (q) => {
        try {
          const url = `https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(
            q
          )}&tags=comment&numericFilters=created_at_i>${cutoffEpoch}&hitsPerPage=20`;
          const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
          if (!res.ok) return [];
          const parsed = (await res.json()) as {
            hits?: Array<{
              objectID: string;
              author?: string;
              comment_text?: string;
              created_at?: string;
              story_title?: string;
            }>;
          };
          return Array.isArray(parsed.hits) ? parsed.hits : [];
        } catch {
          return [];
        }
      })
    );

    const data = { hits: responses.flat() };

    const seenIds = new Set<string>();
    const nowIso = new Date().toISOString();

    for (const hit of data.hits || []) {
      if (!hit.objectID || seenIds.has(hit.objectID)) continue;
      seenIds.add(hit.objectID);

      // Exclude old monthly "Who is hiring" / "Seeking freelancer" roundup titles from prior months
      const storyTitle = (hit.story_title || '').toLowerCase();
      if (storyTitle.includes('who is hiring') && !storyTitle.includes('november 2026')) {
        continue;
      }

      const plainText = decodeHtmlAndStripTags(hit.comment_text || '');
      if (plainText.length < 40) continue;
      if (!isSeekingFreelancerPost(plainText)) continue;

      const category = normalizeCategory('', plainText);
      if (!category) continue;
      if (categoryFilter === 'Website Development' && category === 'SEO') continue;
      if (categoryFilter === 'SEO' && category === 'Website Development') continue;

      const statusAssessment = assessPostStatus(plainText, hit.created_at);
      if (statusAssessment.hiringStatus === 'Closed') continue;

      const contactInfo = extractContactFieldsFromText(plainText);
      const skills = extractTechSkillsFromText(plainText);
      const author = hit.author || 'hn_poster';
      const sourceUrl = `https://news.ycombinator.com/item?id=${hit.objectID}`;

      const firstLine = plainText
        .split('\n')[0]
        .replace(/^(SEEKING FREELANCER\s*[-|:]?\s*)/i, '')
        .trim();
      const title =
        firstLine.length > 10 && firstLine.length <= 120
          ? firstLine
          : `${category} Freelance Role via ${author}`;

      const postedDate = hit.created_at
        ? new Date(hit.created_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })
        : 'Recent';

      const sourceEntry: GroundingSource = {
        title: `Hacker News · ${hit.story_title || title}`,
        uri: sourceUrl,
      };
      sources.push(sourceEntry);

      results.push({
        title: title.slice(0, 150),
        platform: 'Hacker News',
        category,
        summary: plainText.slice(0, 480) + (plainText.length > 480 ? '...' : ''),
        requirements: skills,
        budget: contactInfo.budget || 'Not specified in post',
        location: plainText.toLowerCase().includes('remote') ? 'Remote' : 'Check post',
        postedDate,
        sourceUrl,
        contact: {
          contactName: author,
          handle: `hn:${author}`,
          email: contactInfo.email,
          phone: contactInfo.phone,
          website: contactInfo.website,
          preferredChannel: contactInfo.email
            ? `Email (${contactInfo.email})`
            : `Reply to ${author} on Hacker News`,
        },
        stage: 'New Lead',
        assignedApplicantId: null,
        notes: '',
        isVerifiedSource: true,
        hiringStatus: statusAssessment.hiringStatus,
        statusCheckedAt: nowIso,
        statusEvidence: statusAssessment.statusEvidence,
        groundingSources: [sourceEntry],
      });

      if (results.length >= 6) break;
    }
  } catch (err) {
    console.warn('HN live fetch error:', err instanceof Error ? err.message : err);
  }

  return { opportunities: results, sources };
}

async function fetchMastodonLeads(
  categoryFilter: string,
  keywords: string
): Promise<{ opportunities: Omit<Opportunity, 'id' | 'discoveredAt'>[]; sources: GroundingSource[] }> {
  const results: Omit<Opportunity, 'id' | 'discoveredAt'>[] = [];
  const sources: GroundingSource[] = [];
  const cutoffMs = Date.now() - MAX_POST_AGE_DAYS * 86400_000;
  const nowIso = new Date().toISOString();

  const tags =
    categoryFilter === 'SEO'
      ? ['seo', 'hiring']
      : categoryFilter === 'Website Development'
        ? ['webdev', 'hiring', 'wordpress']
        : ['hiring', 'webdev', 'seo'];

  const instances = ['https://mastodon.social', 'https://fosstodon.org'];

  try {
    const tagRequests = instances.flatMap((instance) =>
      tags.map(async (tag) => {
        try {
          const res = await fetch(`${instance}/api/v1/timelines/tag/${tag}?limit=20`, {
            signal: AbortSignal.timeout(4000),
          });
          if (!res.ok) return [];
          const posts = (await res.json()) as Array<{
            id: string;
            url?: string;
            created_at?: string;
            content?: string;
            language?: string;
            account?: {
              username?: string;
              acct?: string;
              display_name?: string;
              url?: string;
            };
          }>;
          return Array.isArray(posts) ? posts : [];
        } catch {
          return [];
        }
      })
    );

    const allMastodonBatches = await Promise.all(tagRequests);
    const seenPostUrls = new Set<string>();

    for (const posts of allMastodonBatches) {
      for (const post of posts) {
        if (!post.url || seenPostUrls.has(post.url)) continue;
        seenPostUrls.add(post.url);
          if (post.language && post.language !== 'en') continue;
          if (post.created_at && new Date(post.created_at).getTime() < cutoffMs) continue;

          const plain = decodeHtmlAndStripTags(post.content || '');
          if (plain.length < 35) continue;
          if (!isSeekingFreelancerPost(plain)) continue;
          if (keywords) {
            const kwLower = keywords.toLowerCase();
            if (!plain.toLowerCase().includes(kwLower)) continue;
          }

          const category = normalizeCategory('', plain);
          if (!category) continue;
          if (categoryFilter === 'Website Development' && category === 'SEO') continue;
          if (categoryFilter === 'SEO' && category === 'Website Development') continue;

          const statusAssessment = assessPostStatus(plain, post.created_at);
          if (statusAssessment.hiringStatus === 'Closed') continue;

          const sourceUrl = sanitizeUrl(post.url);
          if (!sourceUrl) continue;

          const contactInfo = extractContactFieldsFromText(plain);
          const skills = extractTechSkillsFromText(plain);
          const handle = post.account?.acct
            ? `@${post.account.acct}`
            : post.account?.username
              ? `@${post.account.username}`
              : null;
          const displayName =
            post.account?.display_name || post.account?.username || 'Social Poster';
          const postedDate = post.created_at
            ? new Date(post.created_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })
            : 'Recent';

          const firstSentence = plain.split(/[.!\n]/)[0].trim();
          const title =
            firstSentence.length > 12 && firstSentence.length <= 120
              ? firstSentence
              : `${category} opportunity from ${displayName}`;

          const src: GroundingSource = {
            title: `${displayName} (${handle || 'Social Post'})`,
            uri: sourceUrl,
          };
          sources.push(src);

          results.push({
            title: title.slice(0, 150),
            platform: 'Other',
            category,
            summary: plain.slice(0, 480) + (plain.length > 480 ? '...' : ''),
            requirements: skills,
            budget: contactInfo.budget || 'Not specified in post',
            location: plain.toLowerCase().includes('remote') ? 'Remote' : 'Check post',
            postedDate,
            sourceUrl,
            contact: {
              contactName: displayName,
              handle,
              email: contactInfo.email,
              phone: contactInfo.phone,
              website: contactInfo.website || sanitizeUrl(post.account?.url) || null,
              preferredChannel: contactInfo.email
                ? `Email (${contactInfo.email})`
                : `Direct mention to ${handle || displayName}`,
            },
            stage: 'New Lead',
            assignedApplicantId: null,
            notes: '',
            isVerifiedSource: true,
            hiringStatus: statusAssessment.hiringStatus,
            statusCheckedAt: nowIso,
            statusEvidence: statusAssessment.statusEvidence,
            groundingSources: [src],
          });

          if (results.length >= 4) break;
        }
        if (results.length >= 4) break;
      }
  } catch (err) {
    console.warn('Mastodon live fetch error:', err instanceof Error ? err.message : err);
  }

  return { opportunities: results, sources };
}

async function fetchRemotiveLeads(
  categoryFilter: string,
  keywords: string
): Promise<{ opportunities: Omit<Opportunity, 'id' | 'discoveredAt'>[]; sources: GroundingSource[] }> {
  const results: Omit<Opportunity, 'id' | 'discoveredAt'>[] = [];
  const sources: GroundingSource[] = [];
  const cutoffMs = Date.now() - MAX_POST_AGE_DAYS * 86400_000;
  const nowIso = new Date().toISOString();

  try {
    const queryParts: string[] = [];
    if (categoryFilter === 'SEO') queryParts.push('seo');
    else if (categoryFilter === 'Website Development') queryParts.push('web developer');
    else queryParts.push('wordpress');
    if (keywords) queryParts.push(keywords);

    const url = `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(
      queryParts.join(' ')
    )}&limit=20`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return { opportunities: results, sources };

    const data = (await res.json()) as {
      jobs?: Array<{
        id: number;
        url?: string;
        title?: string;
        company_name?: string;
        category?: string;
        job_type?: string;
        publication_date?: string;
        candidate_required_location?: string;
        salary?: string;
        description?: string;
      }>;
    };

    for (const job of data.jobs || []) {
      if (job.publication_date && new Date(job.publication_date).getTime() < cutoffMs) {
        continue;
      }
      const title = (job.title || '').trim();
      const lowerTitle = title.toLowerCase();
      if (lowerTitle.includes('content reviewer') || lowerTitle.includes('data annotator')) {
        continue;
      }
      const plainDesc = decodeHtmlAndStripTags(job.description || '');
      const combined = `${title} ${plainDesc}`;

      const isFreelanceContract =
        job.job_type === 'freelance' ||
        job.job_type === 'contract' ||
        /\b(freelance|freelancer|contractor|contract-based|project-based)\b/i.test(combined);
      if (!isFreelanceContract) continue;

      const category = normalizeCategory('', title + ' ' + (job.category || ''));
      if (!category) continue;
      if (categoryFilter === 'Website Development' && category === 'SEO') continue;
      if (categoryFilter === 'SEO' && category === 'Website Development') continue;

      const statusAssessment = assessPostStatus(combined, job.publication_date);
      if (statusAssessment.hiringStatus === 'Closed') continue;

      const sourceUrl = sanitizeUrl(job.url);
      if (!sourceUrl) continue;

      const contactInfo = extractContactFieldsFromText(plainDesc);
      const skills = extractTechSkillsFromText(combined);
      const company = (job.company_name || 'Hiring Company').trim();
      const postedDate = job.publication_date
        ? new Date(job.publication_date).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })
        : 'Recent';

      const src: GroundingSource = {
        title: `${company} — ${title}`,
        uri: sourceUrl,
      };
      sources.push(src);

      results.push({
        title: `${title} (${company})`.slice(0, 150),
        platform: 'Other',
        category,
        summary: plainDesc.slice(0, 440) + (plainDesc.length > 440 ? '...' : ''),
        requirements: skills,
        budget:
          (job.salary && job.salary.trim()) || contactInfo.budget || 'Not specified in listing',
        location: (job.candidate_required_location || 'Remote').trim(),
        postedDate,
        sourceUrl,
        contact: {
          contactName: company,
          handle: job.job_type ? job.job_type.replace(/_/g, ' ') : null,
          email: contactInfo.email,
          phone: contactInfo.phone,
          website: contactInfo.website,
          preferredChannel: contactInfo.email
            ? `Email (${contactInfo.email})`
            : 'Apply via verified listing URL',
        },
        stage: 'New Lead',
        assignedApplicantId: null,
        notes: '',
        isVerifiedSource: true,
        hiringStatus: statusAssessment.hiringStatus,
        statusCheckedAt: nowIso,
        statusEvidence: statusAssessment.statusEvidence,
        groundingSources: [src],
      });

      if (results.length >= 4) break;
    }
  } catch (err) {
    console.warn('Remotive live fetch error:', err instanceof Error ? err.message : err);
  }

  return { opportunities: results, sources };
}

async function fetchFreelancerLeads(
  categoryFilter: string,
  keywords: string
): Promise<{ opportunities: Omit<Opportunity, 'id' | 'discoveredAt'>[]; sources: GroundingSource[] }> {
  const results: Omit<Opportunity, 'id' | 'discoveredAt'>[] = [];
  const sources: GroundingSource[] = [];
  const cutoffMs = Date.now() - MAX_POST_AGE_DAYS * 86400_000;
  const nowIso = new Date().toISOString();
  const currencyMap: Record<number, string> = {
    1: '$',
    2: 'NZ$',
    3: 'AU$',
    4: '£',
    5: 'HK$',
    6: 'SGD ',
    8: '€',
    9: 'CA$',
    11: '₹',
  };

  try {
    const kwParam = keywords ? `&query=${encodeURIComponent(keywords)}` : '';
    const urls =
      categoryFilter === 'SEO'
        ? [
            `https://www.freelancer.com/api/projects/0.1/projects/active/?jobs[]=38${kwParam}&limit=12&full_description=true&job_details=true`,
          ]
        : categoryFilter === 'Website Development'
          ? [
              `https://www.freelancer.com/api/projects/0.1/projects/active/?jobs[]=3&jobs[]=17&jobs[]=69&jobs[]=335&jobs[]=1657${kwParam}&limit=12&full_description=true&job_details=true`,
            ]
          : [
              `https://www.freelancer.com/api/projects/0.1/projects/active/?jobs[]=3&jobs[]=17&jobs[]=69&jobs[]=335&jobs[]=1657${kwParam}&limit=10&full_description=true&job_details=true`,
              `https://www.freelancer.com/api/projects/0.1/projects/active/?jobs[]=38${kwParam}&limit=10&full_description=true&job_details=true`,
            ];

    const seenIds = new Set<number>();
    const batches = await Promise.all(
      urls.map(async (url) => {
        try {
          const res = await fetch(url, { signal: AbortSignal.timeout(4500) });
          if (!res.ok) return [];
          const data = (await res.json()) as {
            result?: {
              projects?: Array<{
                id: number;
                title?: string;
                status?: string;
                seo_url?: string;
                description?: string;
                preview_description?: string;
                time_submitted?: number;
                currency?: { id?: number; sign?: string; code?: string };
                budget?: { minimum?: number; maximum?: number };
                bid_stats?: { bid_count?: number };
                jobs?: Array<{ name?: string }>;
              }>;
            };
          };
          return data.result?.projects || [];
        } catch {
          return [];
        }
      })
    );

    for (const projects of batches) {
      for (const proj of projects) {
        if (!proj.id || seenIds.has(proj.id)) continue;
        seenIds.add(proj.id);

        if (proj.status && proj.status !== 'active') continue;
        const submittedMs = proj.time_submitted ? proj.time_submitted * 1000 : Date.now();
        if (submittedMs < cutoffMs) continue;

        const title = sanitizeRequiredString(proj.title, '', 160);
        const description = (proj.description || proj.preview_description || '').trim();
        if (!title || description.length < 30) continue;

        const jobSkills = (proj.jobs || [])
          .map((j) => (j.name || '').trim())
          .filter(Boolean);
        const skillStr = jobSkills.join(' ');

        // Exclude pure copywriting/video editing/scraping gigs unrelated to building websites or SEO
        const lowerTitleSkills = `${title} ${skillStr}`.toLowerCase();
        if (
          /\b(video editing|after effects|testimonial|copywriting|blog writing|data scraping|web scraping|ghostwriting)\b/i.test(
            title.toLowerCase()
          )
        ) {
          continue;
        }

        const hasStrictWebOrSeoSkill = jobSkills.some((s) =>
          /^(web development|website design|wordpress|shopify|shopify templates|webflow|woocommerce|html|css|react|next\.js|php|laravel|seo|search engine optimization|local seo|technical seo)$/i.test(
            s
          )
        );
        if (!hasStrictWebOrSeoSkill) continue;

        const category = normalizeCategory('', `${title} ${skillStr}`);
        if (!category) continue;
        if (categoryFilter === 'Website Development' && category === 'SEO') continue;
        if (categoryFilter === 'SEO' && category === 'Website Development') continue;

        if (!proj.seo_url) continue;
        const sourceUrl = sanitizeUrl(`https://www.freelancer.com/projects/${proj.seo_url}`);
        if (!sourceUrl) continue;

        const sign = proj.currency?.sign || (proj.currency?.id ? currencyMap[proj.currency.id] : '') || '$';
        const budget =
          proj.budget?.minimum && proj.budget?.maximum
            ? `${sign}${proj.budget.minimum} - ${sign}${proj.budget.maximum}${
                proj.currency?.code ? ` ${proj.currency.code}` : ''
              }`
            : 'Open for bids';

        const contactInfo = extractContactFieldsFromText(description);
        const extractedSkills = extractTechSkillsFromText(`${title} ${description} ${skillStr}`);
        const requirements = (extractedSkills.length > 0 ? extractedSkills : jobSkills).slice(0, 6);

        const postedDate = new Date(submittedMs).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
        const bidCount = proj.bid_stats?.bid_count ?? 0;

        const src: GroundingSource = {
          title: `Freelancer.com · ${title}`,
          uri: sourceUrl,
        };
        sources.push(src);

        results.push({
          title,
          platform: 'Other',
          category,
          summary: description.slice(0, 480) + (description.length > 480 ? '...' : ''),
          requirements,
          budget,
          location: 'Remote',
          postedDate,
          sourceUrl,
          contact: {
            contactName: 'Verified Freelancer.com Client',
            handle: `project-${proj.id}`,
            email: contactInfo.email,
            phone: contactInfo.phone,
            website: contactInfo.website,
            preferredChannel: contactInfo.email
              ? `Email (${contactInfo.email})`
              : 'Direct proposal on Freelancer.com listing',
          },
          stage: 'New Lead',
          assignedApplicantId: null,
          notes: '',
          isVerifiedSource: true,
          hiringStatus: 'Still Looking',
          statusCheckedAt: nowIso,
          statusEvidence: `Live active project on Freelancer.com · ${bidCount} bid${
            bidCount === 1 ? '' : 's'
          } · Posted ${postedDate}`,
          groundingSources: [src],
        });

        if (results.length >= 6) break;
      }
      if (results.length >= 6) break;
    }
  } catch (err) {
    console.warn('Freelancer live fetch error:', err instanceof Error ? err.message : err);
  }

  return { opportunities: results, sources };
}

async function fetchWordPressJobsLeads(
  categoryFilter: string,
  keywords: string
): Promise<{ opportunities: Omit<Opportunity, 'id' | 'discoveredAt'>[]; sources: GroundingSource[] }> {
  const results: Omit<Opportunity, 'id' | 'discoveredAt'>[] = [];
  const sources: GroundingSource[] = [];
  const cutoffMs = Date.now() - MAX_POST_AGE_DAYS * 86400_000;
  const nowIso = new Date().toISOString();

  try {
    const res = await fetch('https://jobs.wordpress.net/feed/', {
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return { opportunities: results, sources };
    const xml = await res.text();
    const rawItems = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => m[1]);

    for (const itemXml of rawItems.slice(0, 10)) {
      const rawTitle = (itemXml.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '';
      const rawLink = (itemXml.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || '';
      const rawPubDate = (itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || '';
      const rawDesc = (itemXml.match(/<description>([\s\S]*?)<\/description>/) || [])[1] || '';

      if (rawPubDate) {
        const pubMs = new Date(rawPubDate).getTime();
        if (!Number.isNaN(pubMs) && pubMs < cutoffMs) continue;
      }

      const title = decodeHtmlAndStripTags(
        rawTitle.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
      ).slice(0, 150);
      const desc = decodeHtmlAndStripTags(
        rawDesc.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
      );
      const sourceUrl = sanitizeUrl(rawLink.trim());
      if (!title || !sourceUrl || !isPublicExternalUrl(sourceUrl)) continue;

      if (keywords && !`${title} ${desc}`.toLowerCase().includes(keywords.toLowerCase())) {
        continue;
      }

      const category = normalizeCategory('', `${title} ${desc}`);
      if (!category) continue;
      if (categoryFilter === 'Website Development' && category === 'SEO') continue;
      if (categoryFilter === 'SEO' && category === 'Website Development') continue;

      // Fetch listing page to extract verified client email/contact & full scope
      let pagePlain = desc;
      let pageEmails: string[] = [];
      try {
        const pageRes = await fetch(sourceUrl, { signal: AbortSignal.timeout(4500) });
        if (pageRes.ok) {
          const html = await pageRes.text();
          const emailMatches = html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
          pageEmails = [
            ...new Set(
              emailMatches.filter(
                (e) =>
                  !e.toLowerCase().includes('wordpress.net') &&
                  !e.toLowerCase().includes('wordpress.org') &&
                  !e.toLowerCase().includes('example.com')
              )
            ),
          ];
          const stripped = decodeHtmlAndStripTags(html);
          if (stripped.length > desc.length) {
            pagePlain = stripped;
          }
        }
      } catch {
        // Keep RSS description fallback
      }

      const statusAssessment = assessPostStatus(pagePlain, rawPubDate || undefined);
      if (statusAssessment.hiringStatus === 'Closed') continue;

      const contactInfo = extractContactFieldsFromText(pagePlain);
      const email = pageEmails[0] || contactInfo.email;
      const skills = extractTechSkillsFromText(`${title} ${desc} WordPress`);
      const postedDate = rawPubDate
        ? new Date(rawPubDate).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })
        : 'Recent';

      const src: GroundingSource = {
        title: `WordPress Jobs · ${title}`,
        uri: sourceUrl,
      };
      sources.push(src);

      results.push({
        title,
        platform: 'Other',
        category,
        summary: desc.slice(0, 460) + (desc.length > 460 ? '...' : ''),
        requirements: skills.length > 0 ? skills : ['WordPress'],
        budget: contactInfo.budget || 'Check listing / negotiable',
        location: `${title} ${desc}`.toLowerCase().includes('remote') ? 'Remote' : 'Check listing',
        postedDate,
        sourceUrl,
        contact: {
          contactName: email ? email.split('@')[1]?.split('.')[0] || 'WordPress Jobs Client' : 'WordPress Jobs Client',
          handle: null,
          email: email || null,
          phone: contactInfo.phone,
          website: contactInfo.website,
          preferredChannel: email ? `Email (${email})` : 'Apply via WordPress Jobs listing',
        },
        stage: 'New Lead',
        assignedApplicantId: null,
        notes: '',
        isVerifiedSource: true,
        hiringStatus: statusAssessment.hiringStatus,
        statusCheckedAt: nowIso,
        statusEvidence: email
          ? `Live WordPress Jobs listing (${postedDate}) · Verified email: ${email}`
          : statusAssessment.statusEvidence,
        groundingSources: [src],
      });

      if (results.length >= 4) break;
    }
  } catch (err) {
    console.warn('WordPress Jobs RSS fetch error:', err instanceof Error ? err.message : err);
  }

  return { opportunities: results, sources };
}

async function fetchGeminiGroundedSocialLeads(
  platformFilter: string,
  categoryFilter: string,
  keywords: string
): Promise<{
  opportunities: Omit<Opportunity, 'id' | 'discoveredAt'>[];
  sources: GroundingSource[];
  searchQueries: string[];
  warning?: string;
}> {
  const ai = getAiClient();
  if (!ai) {
    return {
      opportunities: [],
      sources: [],
      searchQueries: [],
    };
  }

  const todayIso = new Date().toISOString().slice(0, 10);
  const cutoffIso = new Date(Date.now() - MAX_POST_AGE_DAYS * 86400_000)
    .toISOString()
    .slice(0, 10);

  let platformQueryHint =
    'Instagram (site:instagram.com), Facebook (site:facebook.com), Google (Google-indexed client hiring posts & business web requests), Reddit (r/forhire, r/freelance_forhire, r/webdev), LinkedIn, X/Twitter, and IndieHackers';
  let platformSearchDetail =
    'Include public posts across Instagram, Facebook, Google Search web results, Reddit, LinkedIn, X/Twitter, and IndieHackers.';

  if (platformFilter === 'Instagram') {
    platformQueryHint = 'Instagram (site:instagram.com public posts, reels captions, and business profiles)';
    platformSearchDetail =
      'Search specifically using site:instagram.com for recent Instagram posts, captions, and business accounts looking to hire a freelance website developer or SEO specialist. Extract the poster @instagram_handle, bio/caption email, phone or WhatsApp number, website URL, and exact instagram.com post/profile URL.';
  } else if (platformFilter === 'Facebook') {
    platformQueryHint = 'Facebook (site:facebook.com public posts, groups, and business pages)';
    platformSearchDetail =
      'Search specifically using site:facebook.com for recent Facebook posts, group requests, and business pages looking to hire a freelance website developer or SEO specialist. Extract the poster/page name, Facebook handle or profile URL, email, phone or WhatsApp number, Messenger preference, and exact facebook.com post URL.';
  } else if (platformFilter === 'Google') {
    platformQueryHint = 'Google (Google Search indexed client project requests, RFPs, Google Business posts, and company hiring pages)';
    platformSearchDetail =
      'Search Google for recent web pages, Google Business posts, and client project/RFP listings where businesses are actively seeking a freelance website developer or SEO specialist (set platform to "Google" for direct web/Google listings). Extract verified business contact name, email, phone/WhatsApp, website, and exact source URL.';
  } else if (platformFilter !== 'All Platforms') {
    platformQueryHint = platformFilter;
    platformSearchDetail = `Focus specifically on ${platformFilter} posts and extract all visible contact details.`;
  }

  const categoryInstruction =
    categoryFilter === 'Website Development'
      ? 'ONLY freelance Website Development projects (React, Next.js, WordPress, Shopify, Webflow, custom websites, landing pages, web apps).'
      : categoryFilter === 'SEO'
        ? 'ONLY freelance SEO projects (Technical SEO, Local SEO, On-page/Off-page SEO, SEO audits, Core Web Vitals, search ranking optimization).'
        : 'ONLY freelance Website Development and/or SEO projects.';

  const prompt = `Today's date is ${todayIso}. You are a live market researcher for HK Surya Website Development.
Use Google Search to find REAL, RECENTLY UPDATED posts published between ${cutoffIso} and ${todayIso} (within the last ${MAX_POST_AGE_DAYS} days — DO NOT return past monthly threads or old posts from previous months!) on ${platformQueryHint} where clients, founders, or businesses are actively LOOKING FOR A FREELANCER (not freelancers looking for work, and not stale full-time W2 jobs).

${platformSearchDetail}

STRICT RULES:
1. ${categoryInstruction} EXCLUDE non-web/non-SEO roles.
2. FRESHNESS & ACTIVE STATUS: Only include posts from the last ${MAX_POST_AGE_DAYS} days (${cutoffIso} to ${todayIso}). Check whether the post or replies indicate they are STILL LOOKING for that freelance role (exclude or clearly mark posts edited with "filled", "closed", "hired", or "no longer looking").
3. ACCURACY & ZERO FABRICATION: Every item MUST come directly from Google Search results. Do NOT invent fake posts, fake emails, fake phone numbers, fake budgets, or guessed URLs.
4. FULL CONTACT DETAILS: Extract ONLY real contact info explicitly visible in the post, caption, bio, or Google Search snippet (contactName, @handle, email, phone or WhatsApp number in contact.phone, website URL, and preferredChannel). Set email/phone/website/handle to null if not explicitly present.
5. SOURCE URL: Provide the exact post or page URL from your Google Search results.
${keywords ? `6. FOCUS KEYWORDS: "${keywords}"` : ''}

Return ONLY a JSON object in this exact shape:
{
  "opportunities": [
    {
      "title": "Concise accurate project title",
      "platform": "Instagram | Facebook | Google | Reddit | LinkedIn | X (Twitter) | Hacker News | IndieHackers | Other",
      "category": "Website Development | SEO | Web Dev + SEO",
      "summary": "2-3 sentence accurate summary of project scope and deliverables",
      "requirements": ["Skill 1", "Skill 2"],
      "budget": "Exact budget stated in post, or 'Not specified in post'",
      "location": "Remote or stated city/country",
      "postedDate": "Exact date or recency from Google result (e.g. 'Nov 19, 2026' or '2 days ago')",
      "hiringStatus": "Still Looking | Updated Recently | Likely Filled | Closed",
      "statusEvidence": "Brief evidence from Google result showing why they are still looking or updated",
      "sourceUrl": "https://...",
      "contact": {
        "contactName": "Poster name, business, or handle",
        "handle": "@handle or profile slug or null",
        "email": "exact email if found or null",
        "phone": "exact phone or WhatsApp number if found or null",
        "website": "https://... if found or null",
        "preferredChannel": "Exact way to contact based on post (e.g. Instagram DM @handle, WhatsApp, Email, Facebook Messenger)"
      }
    }
  ]
}`;

  const modelsToTry = ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'];
  let lastError: unknown = null;

  for (const modelName of modelsToTry) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      const rawText = response.text ?? '';
      const metadata = response.candidates?.[0]?.groundingMetadata;
      const chunks = metadata?.groundingChunks ?? [];
      const searchQueries = Array.isArray(metadata?.webSearchQueries)
        ? metadata.webSearchQueries.filter((q): q is string => typeof q === 'string')
        : [];
      const groundingSources: GroundingSource[] = [];
      const seenUris = new Set<string>();

      for (const chunk of chunks) {
        const uri = sanitizeUrl(chunk?.web?.uri);
        const title = sanitizeRequiredString(chunk?.web?.title, uri, 200);
        if (uri && !seenUris.has(uri)) {
          seenUris.add(uri);
          groundingSources.push({ title, uri });
        }
      }

      const parsed = extractJsonPayload(rawText) as { opportunities?: unknown[] };
      const rawItems = Array.isArray(parsed?.opportunities) ? parsed.opportunities : [];
      const opportunities: Omit<Opportunity, 'id' | 'discoveredAt'>[] = [];
      const nowIso = new Date().toISOString();

      for (const item of rawItems) {
        if (!item || typeof item !== 'object') continue;
        const record = item as Record<string, unknown>;
        const sourceUrl = sanitizeUrl(record.sourceUrl);
        if (!sourceUrl) continue;

        const title = sanitizeRequiredString(record.title, '', 180);
        const summary = sanitizeRequiredString(record.summary, '', 800);
        if (!title || !summary) continue;

        const requirements = Array.isArray(record.requirements)
          ? record.requirements
              .filter((r): r is string => typeof r === 'string' && r.trim().length > 0)
              .map((r) => r.trim().slice(0, 60))
              .slice(0, 8)
          : [];

        const normalizedCategory = normalizeCategory(
          record.category,
          `${title} ${summary} ${requirements.join(' ')}`
        );
        if (!normalizedCategory) continue;

        if (categoryFilter === 'Website Development' && normalizedCategory === 'SEO') continue;
        if (categoryFilter === 'SEO' && normalizedCategory === 'Website Development') continue;

        const textCheck = assessPostStatus(`${title} ${summary}`);
        const hiringStatus = normalizeHiringStatus(record.hiringStatus, textCheck.hiringStatus);
        if (hiringStatus === 'Closed') continue;

        const statusEvidence = sanitizeRequiredString(
          record.statusEvidence,
          `Google Search (${record.postedDate || 'recent'}) · ${textCheck.statusEvidence}`,
          220
        );

        const rawContact =
          record.contact && typeof record.contact === 'object'
            ? (record.contact as Record<string, unknown>)
            : {};

        const platform = normalizePlatform(record.platform, sourceUrl);
        const contactName = sanitizeRequiredString(
          rawContact.contactName,
          sanitizeOptionalString(rawContact.handle, 80) || 'Poster on Platform',
          120
        );

        opportunities.push({
          title,
          platform,
          category: normalizedCategory,
          summary,
          requirements,
          budget: sanitizeRequiredString(record.budget, 'Not specified in post', 100),
          location: sanitizeRequiredString(record.location, 'Remote', 100),
          postedDate: sanitizeRequiredString(record.postedDate, 'Recent', 60),
          sourceUrl,
          contact: {
            contactName,
            handle: sanitizeOptionalString(rawContact.handle, 100),
            email: sanitizeOptionalString(rawContact.email, 160),
            phone: sanitizeOptionalString(rawContact.phone, 50),
            website: sanitizeUrl(rawContact.website) || null,
            preferredChannel: sanitizeRequiredString(
              rawContact.preferredChannel,
              `Contact via ${platform} post`,
              160
            ),
          },
          stage: 'New Lead',
          assignedApplicantId: null,
          notes: '',
          isVerifiedSource: groundingSources.length > 0,
          hiringStatus,
          statusCheckedAt: nowIso,
          statusEvidence,
          groundingSources: groundingSources.slice(0, 6),
          searchQueries: searchQueries.slice(0, 5),
        });
      }

      return { opportunities, sources: groundingSources, searchQueries };
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message.toLowerCase() : '';
      if (msg.includes('429') || msg.includes('resource_exhausted') || msg.includes('quota')) {
        continue;
      }
      break;
    }
  }

  return {
    opportunities: [],
    sources: [],
    searchQueries: [],
    warning: formatReadableApiError(lastError),
  };
}

async function verifyLiveOpportunityStatus(opp: Opportunity): Promise<{
  hiringStatus: HiringStatus;
  statusEvidence: string;
  statusCheckedAt: string;
  groundingSources?: GroundingSource[];
}> {
  const nowIso = new Date().toISOString();
  let httpEvidence = '';
  let textAssessment = assessPostStatus(`${opp.title} ${opp.summary}`);

  // 1. Safe live HTTP check on public sourceUrl (SSRF-guarded)
  if (opp.sourceUrl && isPublicExternalUrl(opp.sourceUrl)) {
    try {
      const res = await fetch(opp.sourceUrl, {
        method: 'GET',
        headers: { 'User-Agent': 'HKSuryaLeadVerifier/1.0' },
        signal: AbortSignal.timeout(5000),
      });
      if (res.status === 404 || res.status === 410) {
        return {
          hiringStatus: 'Closed',
          statusEvidence: `Source post returned HTTP ${res.status} (removed or expired).`,
          statusCheckedAt: nowIso,
        };
      }
      if (res.ok) {
        const html = await res.text();
        const plain = decodeHtmlAndStripTags(html).slice(0, 12000);
        const liveCheck = assessPostStatus(plain);
        if (liveCheck.hiringStatus === 'Closed') {
          return {
            hiringStatus: 'Closed',
            statusEvidence: `Live URL check: ${liveCheck.statusEvidence}`,
            statusCheckedAt: nowIso,
          };
        }
        httpEvidence = `Source URL live (HTTP ${res.status})`;
      }
    } catch {
      httpEvidence = 'Source URL unreachable directly; checking via Google Search';
    }
  }

  // 2. Google Search Grounding check (if Gemini quota available)
  const ai = getAiClient();
  if (ai) {
    const models = ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'];
    for (const modelName of models) {
      try {
        const checkPrompt = `Use Google Search to verify whether the client is STILL LOOKING for a freelancer for this specific posting:
Title: ${opp.title}
Platform: ${opp.platform}
Source URL: ${opp.sourceUrl || 'N/A'}
Contact: ${opp.contact.contactName} (${opp.contact.handle || ''})

Check if there are any recent updates, "[Filled]" / "[Closed]" edits, or newer comments saying the role is filled or closed.
Return ONLY JSON:
{
  "hiringStatus": "Still Looking | Updated Recently | Likely Filled | Closed | Needs Check",
  "statusEvidence": "1 concise sentence citing what Google Search found today"
}`;
        const response = await ai.models.generateContent({
          model: modelName,
          contents: checkPrompt,
          config: { tools: [{ googleSearch: {} }] },
        });
        const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
        const extraSources: GroundingSource[] = [];
        for (const c of chunks) {
          const uri = sanitizeUrl(c?.web?.uri);
          if (uri) extraSources.push({ title: sanitizeRequiredString(c?.web?.title, uri, 200), uri });
        }
        const parsed = extractJsonPayload(response.text ?? '') as {
          hiringStatus?: string;
          statusEvidence?: string;
        };
        const status = normalizeHiringStatus(parsed.hiringStatus, textAssessment.hiringStatus);
        const evidence = sanitizeRequiredString(
          parsed.statusEvidence,
          httpEvidence || textAssessment.statusEvidence,
          240
        );
        return {
          hiringStatus: status,
          statusEvidence: httpEvidence ? `${httpEvidence} · ${evidence}` : evidence,
          statusCheckedAt: nowIso,
          groundingSources: extraSources.length > 0 ? extraSources.slice(0, 6) : undefined,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message.toLowerCase() : '';
        if (msg.includes('429') || msg.includes('resource_exhausted') || msg.includes('quota')) {
          continue;
        }
        break;
      }
    }
  }

  return {
    hiringStatus: httpEvidence ? 'Still Looking' : textAssessment.hiringStatus,
    statusEvidence: httpEvidence
      ? `${httpEvidence} · No closed or filled markers detected.`
      : textAssessment.statusEvidence,
    statusCheckedAt: nowIso,
  };
}

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  // --- Auth Endpoints ---

  app.get('/api/auth/status', (req, res) => {
    const envConfigured = isEnvAuthConfigured();
    const claimedRecord = readAuthRecord();
    const token = extractBearerToken(req);
    const verified = verifySessionToken(token);

    res.json({
      initialized: envConfigured || Boolean(claimedRecord),
      configuredViaEnv: envConfigured,
      authenticated: Boolean(verified),
      user: verified ? { email: verified.email } : null,
    });
  });

  app.post('/api/auth/setup', (req, res) => {
    if (isEnvAuthConfigured() || readAuthRecord()) {
      return res.status(403).json({
        error: 'Admin account is already configured. Please sign in instead.',
      });
    }

    const email = sanitizeRequiredString(req.body?.email, '', 160).toLowerCase();
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }
    if (password.length < 6 || password.length > 128) {
      return res.status(400).json({ error: 'Password must be between 6 and 128 characters.' });
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = hashPassword(password, salt);

    writeAuthRecord({
      email,
      salt,
      passwordHash,
      createdAt: new Date().toISOString(),
    });

    const token = signSessionToken(email);
    res.status(201).json({
      token,
      user: { email },
    });
  });

  app.post('/api/auth/login', (req, res) => {
    const email = sanitizeRequiredString(req.body?.email, '', 160).toLowerCase();
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    if (isEnvAuthConfigured()) {
      const expectedPassword = process.env.ADMIN_PASSWORD!.trim();
      const expectedEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();

      const passwordOk = timingSafeMatchString(password, expectedPassword);
      const emailOk = expectedEmail ? timingSafeMatchString(email, expectedEmail) : true;

      if (!passwordOk || !emailOk) {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }

      const token = signSessionToken(email);
      return res.json({ token, user: { email } });
    }

    const record = readAuthRecord();
    if (!record) {
      return res.status(400).json({
        error: 'Workspace admin is not set up yet. Please create your admin login first.',
      });
    }

    const emailOk = timingSafeMatchString(email, record.email.toLowerCase());
    const attemptedHash = hashPassword(password, record.salt);
    const passwordOk = timingSafeMatchString(attemptedHash, record.passwordHash);

    if (!emailOk || !passwordOk) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = signSessionToken(record.email);
    res.json({ token, user: { email: record.email } });
  });

  app.post('/api/auth/logout', (req, res) => {
    const token = extractBearerToken(req);
    if (token) {
      revokedTokens.add(token);
    }
    res.json({ ok: true });
  });

  // --- Protected Dashboard APIs ---

  app.get('/api/data', requireAuth, (_req, res) => {
    const store = ensureStore();
    res.json(store);
  });

  app.post('/api/discover', requireAuth, async (req, res) => {
    try {
      const platformFilter = sanitizeRequiredString(req.body?.platform, 'All Platforms', 60);
      const categoryFilter = sanitizeRequiredString(
        req.body?.category,
        'Website Development & SEO',
        60
      );
      const keywords = sanitizeOptionalString(req.body?.keywords, 120) || '';

      const fetchPromises: Array<
        Promise<{
          opportunities: Omit<Opportunity, 'id' | 'discoveredAt'>[];
          sources: GroundingSource[];
          searchQueries?: string[];
          warning?: string;
        }>
      > = [];

      // Always query Google Search Grounding for fresh social & Google posts (Instagram, Facebook, Google, Reddit, LinkedIn, X, IndieHackers)
      fetchPromises.push(fetchGeminiGroundedSocialLeads(platformFilter, categoryFilter, keywords));

      // Also run strict 14-day live direct connectors (Freelancer.com, WordPress Jobs, Hacker News, Mastodon, Remotive)
      if (platformFilter === 'All Platforms' || platformFilter === 'Hacker News') {
        fetchPromises.push(fetchHackerNewsLeads(categoryFilter, keywords));
      }
      if (platformFilter === 'All Platforms' || platformFilter === 'Other') {
        fetchPromises.push(fetchFreelancerLeads(categoryFilter, keywords));
        fetchPromises.push(fetchWordPressJobsLeads(categoryFilter, keywords));
        fetchPromises.push(fetchMastodonLeads(categoryFilter, keywords));
        fetchPromises.push(fetchRemotiveLeads(categoryFilter, keywords));
      }

      const settled = await Promise.all(fetchPromises);
      const candidates: Omit<Opportunity, 'id' | 'discoveredAt'>[] = [];
      const groundingSources: GroundingSource[] = [];
      const searchQueries: string[] = [];
      const seenSourceUris = new Set<string>();
      const warnings: string[] = [];

      for (const batch of settled) {
        if (batch.warning) warnings.push(batch.warning);
        if (Array.isArray(batch.searchQueries)) {
          for (const q of batch.searchQueries) {
            if (!searchQueries.includes(q)) searchQueries.push(q);
          }
        }
        for (const src of batch.sources) {
          if (src.uri && !seenSourceUris.has(src.uri)) {
            seenSourceUris.add(src.uri);
            groundingSources.push(src);
          }
        }
        candidates.push(...batch.opportunities);
      }

      // Removed redundant sequential fallback since All Platforms and Other already run all direct connectors concurrently above.

      const store = ensureStore();
      const existingUrlSet = new Set(
        store.opportunities.map((o) => o.sourceUrl.toLowerCase().replace(/\/+$/, ''))
      );
      const existingTitleSet = new Set(
        store.opportunities.map(
          (o) => `${o.title.toLowerCase()}::${(o.contact.handle || '').toLowerCase()}`
        )
      );

      const nowIso = new Date().toISOString();
      const addedOpportunities: Opportunity[] = [];

      for (const item of candidates) {
        const normalizedUrl = item.sourceUrl.toLowerCase().replace(/\/+$/, '');
        const dedupKey = `${item.title.toLowerCase()}::${(item.contact.handle || '').toLowerCase()}`;
        if (existingUrlSet.has(normalizedUrl) || existingTitleSet.has(dedupKey)) {
          continue;
        }
        existingUrlSet.add(normalizedUrl);
        existingTitleSet.add(dedupKey);

        addedOpportunities.push({
          ...item,
          id: crypto.randomUUID(),
          discoveredAt: nowIso,
        });
      }

      if (addedOpportunities.length > 0) {
        store.opportunities = [...addedOpportunities, ...store.opportunities];
      }

      const scanLog: ScanLog = {
        id: crypto.randomUUID(),
        scannedAt: nowIso,
        platformFilter,
        categoryFilter,
        keywords,
        foundCount: candidates.length,
        addedCount: addedOpportunities.length,
        groundingSources: groundingSources.slice(0, 12),
        searchQueries: searchQueries.slice(0, 8),
      };

      store.scanHistory = [scanLog, ...store.scanHistory].slice(0, 25);
      writeStore(store);

      res.json({
        added: addedOpportunities,
        opportunities: store.opportunities,
        scanLog,
        groundingSources,
        searchQueries,
        warning: candidates.length === 0 && warnings.length > 0 ? warnings[0] : undefined,
        notice: candidates.length > 0 && warnings.length > 0 ? warnings[0] : undefined,
      });
    } catch (err) {
      res.status(500).json({ error: formatReadableApiError(err) });
    }
  });

  app.post('/api/opportunities', requireAuth, (req, res) => {
    const body = req.body || {};
    const title = sanitizeRequiredString(body.title, '', 180);
    const summary = sanitizeRequiredString(body.summary, '', 1200);
    const sourceUrl = sanitizeUrl(body.sourceUrl);
    if (!title || !summary) {
      return res.status(400).json({ error: 'Project title and summary are required.' });
    }

    const category: OpportunityCategory = VALID_CATEGORIES.includes(body.category)
      ? body.category
      : 'Website Development';
    const platform: SocialPlatform = VALID_PLATFORMS.includes(body.platform)
      ? body.platform
      : 'LinkedIn';
    const stage: PipelineStage = VALID_STAGES.includes(body.stage) ? body.stage : 'New Lead';

    const requirements = Array.isArray(body.requirements)
      ? body.requirements
          .filter((r: unknown): r is string => typeof r === 'string' && r.trim().length > 0)
          .map((r: string) => r.trim().slice(0, 60))
      : [];

    const rawContact = body.contact && typeof body.contact === 'object' ? body.contact : {};
    const opportunity: Opportunity = {
      id: crypto.randomUUID(),
      title,
      platform,
      category,
      summary,
      requirements,
      budget: sanitizeRequiredString(body.budget, 'Not specified', 100),
      location: sanitizeRequiredString(body.location, 'Remote', 100),
      postedDate: sanitizeRequiredString(
        body.postedDate,
        new Date().toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }),
        60
      ),
      sourceUrl: sourceUrl || '',
      contact: {
        contactName: sanitizeRequiredString(rawContact.contactName, 'Direct Client', 120),
        handle: sanitizeOptionalString(rawContact.handle, 100),
        email: sanitizeOptionalString(rawContact.email, 160),
        phone: sanitizeOptionalString(rawContact.phone, 50),
        website: sanitizeUrl(rawContact.website) || null,
        preferredChannel: sanitizeRequiredString(
          rawContact.preferredChannel,
          'Direct Outreach',
          160
        ),
      },
      stage,
      assignedApplicantId: sanitizeOptionalString(body.assignedApplicantId, 64),
      notes: sanitizeRequiredString(body.notes, '', 1500),
      discoveredAt: new Date().toISOString(),
      isVerifiedSource: Boolean(sourceUrl),
      hiringStatus: 'Still Looking',
      statusCheckedAt: new Date().toISOString(),
      statusEvidence: 'Manually logged lead.',
      groundingSources: sourceUrl ? [{ title, uri: sourceUrl }] : [],
    };

    const store = ensureStore();
    store.opportunities = [opportunity, ...store.opportunities];
    writeStore(store);
    res.status(201).json(opportunity);
  });

  app.post('/api/opportunities/:id/verify-status', requireAuth, async (req, res) => {
    try {
      const store = ensureStore();
      const index = store.opportunities.findIndex((o) => o.id === req.params.id);
      if (index === -1) {
        return res.status(404).json({ error: 'Opportunity not found.' });
      }
      const current = store.opportunities[index];
      const result = await verifyLiveOpportunityStatus(current);
      const updated: Opportunity = {
        ...current,
        hiringStatus: result.hiringStatus,
        statusCheckedAt: result.statusCheckedAt,
        statusEvidence: result.statusEvidence,
        groundingSources: result.groundingSources
          ? [...result.groundingSources, ...current.groundingSources].slice(0, 8)
          : current.groundingSources,
      };
      store.opportunities[index] = updated;
      writeStore(store);
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: formatReadableApiError(err) });
    }
  });

  app.patch('/api/opportunities/:id', requireAuth, (req, res) => {
    const store = ensureStore();
    const index = store.opportunities.findIndex((o) => o.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ error: 'Opportunity not found.' });
    }

    const current = store.opportunities[index];
    const body = req.body || {};

    const nextStage: PipelineStage = VALID_STAGES.includes(body.stage)
      ? body.stage
      : current.stage;
    const nextAssigned =
      body.assignedApplicantId === null
        ? null
        : typeof body.assignedApplicantId === 'string'
          ? body.assignedApplicantId
          : current.assignedApplicantId;

    const updated: Opportunity = {
      ...current,
      stage: nextStage,
      assignedApplicantId: nextAssigned,
      notes: typeof body.notes === 'string' ? body.notes.slice(0, 2000) : current.notes,
      budget:
        typeof body.budget === 'string' && body.budget.trim()
          ? body.budget.trim().slice(0, 100)
          : current.budget,
      outreachDraft:
        typeof body.outreachDraft === 'string'
          ? body.outreachDraft.slice(0, 3000)
          : current.outreachDraft,
      contact:
        body.contact && typeof body.contact === 'object'
          ? {
              contactName: sanitizeRequiredString(
                body.contact.contactName,
                current.contact.contactName,
                120
              ),
              handle:
                body.contact.handle !== undefined
                  ? sanitizeOptionalString(body.contact.handle, 100)
                  : current.contact.handle,
              email:
                body.contact.email !== undefined
                  ? sanitizeOptionalString(body.contact.email, 160)
                  : current.contact.email,
              phone:
                body.contact.phone !== undefined
                  ? sanitizeOptionalString(body.contact.phone, 50)
                  : current.contact.phone,
              website:
                body.contact.website !== undefined
                  ? sanitizeUrl(body.contact.website) || null
                  : current.contact.website,
              preferredChannel: sanitizeRequiredString(
                body.contact.preferredChannel,
                current.contact.preferredChannel,
                160
              ),
            }
          : current.contact,
    };

    store.opportunities[index] = updated;
    writeStore(store);
    res.json(updated);
  });

  app.delete('/api/opportunities/:id', requireAuth, (req, res) => {
    const store = ensureStore();
    const before = store.opportunities.length;
    store.opportunities = store.opportunities.filter((o) => o.id !== req.params.id);
    if (store.opportunities.length === before) {
      return res.status(404).json({ error: 'Opportunity not found.' });
    }
    writeStore(store);
    res.json({ deleted: true });
  });

  app.post('/api/applicants', requireAuth, (req, res) => {
    const body = req.body || {};
    const fullName = sanitizeRequiredString(body.fullName, '', 120);
    const email = sanitizeRequiredString(body.email, '', 160);
    if (!fullName || !email) {
      return res.status(400).json({ error: 'Applicant full name and email are required.' });
    }

    const specialty: ApplicantSpecialty = VALID_APPLICANT_SPECIALTIES.includes(body.specialty)
      ? body.specialty
      : 'Website Development';
    const status: ApplicantStatus = VALID_APPLICANT_STATUSES.includes(body.status)
      ? body.status
      : 'Available';

    const skills = Array.isArray(body.skills)
      ? body.skills
          .filter((s: unknown): s is string => typeof s === 'string' && s.trim().length > 0)
          .map((s: string) => s.trim().slice(0, 50))
      : [];

    const experienceNum = Number(body.experienceYears);
    const applicant: Applicant = {
      id: crypto.randomUUID(),
      fullName,
      specialty,
      roleTitle: sanitizeRequiredString(body.roleTitle, specialty, 120),
      skills,
      experienceYears:
        Number.isFinite(experienceNum) && experienceNum >= 0
          ? Math.min(experienceNum, 50)
          : 2,
      hourlyRate: sanitizeRequiredString(body.hourlyRate, 'Negotiable', 60),
      location: sanitizeRequiredString(body.location, 'Remote', 100),
      status,
      email,
      phone: sanitizeRequiredString(body.phone, '', 50),
      portfolioUrl: sanitizeUrl(body.portfolioUrl) || '',
      githubOrLinkedIn: sanitizeUrl(body.githubOrLinkedIn) || '',
      notes: sanitizeRequiredString(body.notes, '', 1500),
      appliedAt: new Date().toISOString(),
    };

    const store = ensureStore();
    store.applicants = [applicant, ...store.applicants];
    writeStore(store);
    res.status(201).json(applicant);
  });

  app.patch('/api/applicants/:id', requireAuth, (req, res) => {
    const store = ensureStore();
    const index = store.applicants.findIndex((a) => a.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ error: 'Applicant not found.' });
    }

    const current = store.applicants[index];
    const body = req.body || {};

    const updated: Applicant = {
      ...current,
      fullName: sanitizeRequiredString(body.fullName, current.fullName, 120),
      specialty: VALID_APPLICANT_SPECIALTIES.includes(body.specialty)
        ? body.specialty
        : current.specialty,
      roleTitle: sanitizeRequiredString(body.roleTitle, current.roleTitle, 120),
      skills: Array.isArray(body.skills)
        ? body.skills
            .filter((s: unknown): s is string => typeof s === 'string' && s.trim().length > 0)
            .map((s: string) => s.trim().slice(0, 50))
        : current.skills,
      experienceYears:
        body.experienceYears !== undefined && Number.isFinite(Number(body.experienceYears))
          ? Math.max(0, Math.min(50, Number(body.experienceYears)))
          : current.experienceYears,
      hourlyRate: sanitizeRequiredString(body.hourlyRate, current.hourlyRate, 60),
      location: sanitizeRequiredString(body.location, current.location, 100),
      status: VALID_APPLICANT_STATUSES.includes(body.status) ? body.status : current.status,
      email: sanitizeRequiredString(body.email, current.email, 160),
      phone: typeof body.phone === 'string' ? body.phone.trim().slice(0, 50) : current.phone,
      portfolioUrl:
        body.portfolioUrl !== undefined
          ? sanitizeUrl(body.portfolioUrl) || ''
          : current.portfolioUrl,
      githubOrLinkedIn:
        body.githubOrLinkedIn !== undefined
          ? sanitizeUrl(body.githubOrLinkedIn) || ''
          : current.githubOrLinkedIn,
      notes: typeof body.notes === 'string' ? body.notes.slice(0, 1500) : current.notes,
    };

    store.applicants[index] = updated;
    writeStore(store);
    res.json(updated);
  });

  app.delete('/api/applicants/:id', requireAuth, (req, res) => {
    const store = ensureStore();
    const before = store.applicants.length;
    store.applicants = store.applicants.filter((a) => a.id !== req.params.id);
    if (store.applicants.length === before) {
      return res.status(404).json({ error: 'Applicant not found.' });
    }
    store.opportunities = store.opportunities.map((o) =>
      o.assignedApplicantId === req.params.id ? { ...o, assignedApplicantId: null } : o
    );
    writeStore(store);
    res.json({ deleted: true });
  });

  app.post('/api/draft-outreach', requireAuth, async (req, res) => {
    try {
      const opportunityId = sanitizeRequiredString(req.body?.opportunityId, '', 80);
      const store = ensureStore();
      const opportunity = store.opportunities.find((o) => o.id === opportunityId);
      if (!opportunity) {
        return res.status(404).json({ error: 'Opportunity not found.' });
      }
      const assignedApplicant = opportunity.assignedApplicantId
        ? store.applicants.find((a) => a.id === opportunity.assignedApplicantId) || null
        : null;

      const ai = getAiClient();
      if (!ai) {
        return res.status(400).json({
          error: 'Gemini API key is not configured in Settings > Secrets.',
        });
      }

      const prompt = `Write a concise, professional, tailored freelance proposal/outreach message on behalf of HK Surya Website Development (specializing in Website Development & SEO) for the following verified client opportunity.

Opportunity Details:
- Title: ${opportunity.title}
- Platform: ${opportunity.platform}
- Category: ${opportunity.category}
- Client / Contact: ${opportunity.contact.contactName} (${opportunity.contact.handle || opportunity.contact.preferredChannel})
- Budget: ${opportunity.budget}
- Requirements: ${opportunity.requirements.join(', ') || 'Website Development & SEO'}
- Summary: ${opportunity.summary}
${
  assignedApplicant
    ? `- Assigned HK Surya Specialist: ${assignedApplicant.fullName} (${assignedApplicant.roleTitle}, ${assignedApplicant.experienceYears} yrs exp, skills: ${assignedApplicant.skills.join(', ')}, portfolio: ${assignedApplicant.portfolioUrl || 'Available upon request'})`
    : ''
}

Keep it direct, respectful, under 150 words, focused strictly on how HK Surya can deliver their website development / SEO scope cleanly, and include a clear call to action.`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
      });

      const draft = (response.text ?? '').trim();
      const oppIdx = store.opportunities.findIndex((o) => o.id === opportunity.id);
      if (oppIdx !== -1 && draft) {
        store.opportunities[oppIdx] = { ...store.opportunities[oppIdx], outreachDraft: draft };
        writeStore(store);
      }

      res.json({ draft });
    } catch (err) {
      res.status(429).json({ error: formatReadableApiError(err) });
    }
  });

  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        ws: { server: httpServer },
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`HK Surya Tracker running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
