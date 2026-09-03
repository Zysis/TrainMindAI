--
-- PostgreSQL database dump
--

\restrict fZepCIXiLwgnPpo2tEgP7aSQWbE2cCzwmGf2oacE7aQmFUkEfMyctkYY4qlSnQm

-- Dumped from database version 16.13
-- Dumped by pg_dump version 16.13

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: trainmind
--

-- *not* creating schema, since initdb creates it


ALTER SCHEMA public OWNER TO trainmind;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: trainmind
--

COMMENT ON SCHEMA public IS '';


--
-- Name: AiOperation; Type: TYPE; Schema: public; Owner: trainmind
--

CREATE TYPE public."AiOperation" AS ENUM (
    'CHAT',
    'COACH',
    'GENERATE',
    'WELLNESS',
    'RTP',
    'REPORT'
);


ALTER TYPE public."AiOperation" OWNER TO trainmind;

--
-- Name: InjuryStatus; Type: TYPE; Schema: public; Owner: trainmind
--

CREATE TYPE public."InjuryStatus" AS ENUM (
    'ACTIVE',
    'RECOVERING',
    'RESOLVED'
);


ALTER TYPE public."InjuryStatus" OWNER TO trainmind;

--
-- Name: IntensityLevel; Type: TYPE; Schema: public; Owner: trainmind
--

CREATE TYPE public."IntensityLevel" AS ENUM (
    'VERY_LOW',
    'LOW',
    'MODERATE',
    'HIGH',
    'VERY_HIGH'
);


ALTER TYPE public."IntensityLevel" OWNER TO trainmind;

--
-- Name: InviteStatus; Type: TYPE; Schema: public; Owner: trainmind
--

CREATE TYPE public."InviteStatus" AS ENUM (
    'PENDING',
    'ACCEPTED',
    'EXPIRED',
    'REVOKED'
);


ALTER TYPE public."InviteStatus" OWNER TO trainmind;

--
-- Name: MesocyclePhase; Type: TYPE; Schema: public; Owner: trainmind
--

CREATE TYPE public."MesocyclePhase" AS ENUM (
    'PREPARATION',
    'SPECIFIC',
    'COMPETITION',
    'TRANSITION',
    'TAPER',
    'RECOVERY'
);


ALTER TYPE public."MesocyclePhase" OWNER TO trainmind;

--
-- Name: OrganizationTier; Type: TYPE; Schema: public; Owner: trainmind
--

CREATE TYPE public."OrganizationTier" AS ENUM (
    'STARTER',
    'PROFESSIONAL',
    'ULTRA'
);


ALTER TYPE public."OrganizationTier" OWNER TO trainmind;

--
-- Name: PeriodizationType; Type: TYPE; Schema: public; Owner: trainmind
--

CREATE TYPE public."PeriodizationType" AS ENUM (
    'LINEAR',
    'UNDULATING',
    'BLOCK',
    'REVERSE_LINEAR',
    'CONJUGATE'
);


ALTER TYPE public."PeriodizationType" OWNER TO trainmind;

--
-- Name: RTPPhase; Type: TYPE; Schema: public; Owner: trainmind
--

CREATE TYPE public."RTPPhase" AS ENUM (
    'PHASE_1',
    'PHASE_2',
    'PHASE_3',
    'PHASE_4',
    'PHASE_5',
    'PHASE_6',
    'CLEARED'
);


ALTER TYPE public."RTPPhase" OWNER TO trainmind;

--
-- Name: ReportAudience; Type: TYPE; Schema: public; Owner: trainmind
--

CREATE TYPE public."ReportAudience" AS ENUM (
    'STAFF',
    'MEDICAL',
    'TRAINER'
);


ALTER TYPE public."ReportAudience" OWNER TO trainmind;

--
-- Name: ReportFormat; Type: TYPE; Schema: public; Owner: trainmind
--

CREATE TYPE public."ReportFormat" AS ENUM (
    'JSON',
    'PDF',
    'DOCX'
);


ALTER TYPE public."ReportFormat" OWNER TO trainmind;

--
-- Name: ReportScheduleStatus; Type: TYPE; Schema: public; Owner: trainmind
--

CREATE TYPE public."ReportScheduleStatus" AS ENUM (
    'SUCCESS',
    'FAILED',
    'SKIPPED'
);


ALTER TYPE public."ReportScheduleStatus" OWNER TO trainmind;

--
-- Name: SessionStatus; Type: TYPE; Schema: public; Owner: trainmind
--

CREATE TYPE public."SessionStatus" AS ENUM (
    'PLANNED',
    'IN_PROGRESS',
    'COMPLETED',
    'CANCELLED'
);


ALTER TYPE public."SessionStatus" OWNER TO trainmind;

--
-- Name: UserRole; Type: TYPE; Schema: public; Owner: trainmind
--

CREATE TYPE public."UserRole" AS ENUM (
    'ADMIN',
    'TRAINER',
    'MEDICAL',
    'VIEWER',
    'ATHLETE'
);


ALTER TYPE public."UserRole" OWNER TO trainmind;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: trainmind
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public._prisma_migrations OWNER TO trainmind;

--
-- Name: ai_usage_logs; Type: TABLE; Schema: public; Owner: trainmind
--

CREATE TABLE public.ai_usage_logs (
    id text NOT NULL,
    "organizationId" text NOT NULL,
    "userId" text,
    operation public."AiOperation" NOT NULL,
    endpoint text NOT NULL,
    model text NOT NULL,
    provider text DEFAULT 'openai'::text NOT NULL,
    "promptTokens" integer DEFAULT 0 NOT NULL,
    "completionTokens" integer DEFAULT 0 NOT NULL,
    "totalTokens" integer DEFAULT 0 NOT NULL,
    "costUsd" numeric(12,8) DEFAULT 0 NOT NULL,
    "creditsCharged" integer DEFAULT 0 NOT NULL,
    success boolean DEFAULT true NOT NULL,
    "errorCode" text,
    "durationMs" integer,
    estimated boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.ai_usage_logs OWNER TO trainmind;

--
-- Name: alert_rules; Type: TABLE; Schema: public; Owner: trainmind
--

CREATE TABLE public.alert_rules (
    id text NOT NULL,
    "organizationId" text NOT NULL,
    "userId" text NOT NULL,
    name text NOT NULL,
    description text,
    type text NOT NULL,
    condition jsonb NOT NULL,
    severity text DEFAULT 'warning'::text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "athleteId" text,
    "cooldownMinutes" integer DEFAULT 1440 NOT NULL,
    "lastTriggeredAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.alert_rules OWNER TO trainmind;

--
-- Name: athlete_invites; Type: TABLE; Schema: public; Owner: trainmind
--

CREATE TABLE public.athlete_invites (
    id text NOT NULL,
    "athleteId" text NOT NULL,
    email text NOT NULL,
    token text NOT NULL,
    status public."InviteStatus" DEFAULT 'PENDING'::public."InviteStatus" NOT NULL,
    "invitedById" text NOT NULL,
    "organizationId" text NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "acceptedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.athlete_invites OWNER TO trainmind;

--
-- Name: athlete_teams; Type: TABLE; Schema: public; Owner: trainmind
--

CREATE TABLE public.athlete_teams (
    id text NOT NULL,
    "athleteId" text NOT NULL,
    "teamId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.athlete_teams OWNER TO trainmind;

--
-- Name: athletes; Type: TABLE; Schema: public; Owner: trainmind
--

CREATE TABLE public.athletes (
    id text NOT NULL,
    "firstName" text NOT NULL,
    "lastName" text NOT NULL,
    "dateOfBirth" timestamp(3) without time zone NOT NULL,
    "position" text NOT NULL,
    "jerseyNumber" integer,
    height double precision,
    weight double precision,
    "photoUrl" text,
    "isActive" boolean DEFAULT true NOT NULL,
    "organizationId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    team text,
    email text
);


ALTER TABLE public.athletes OWNER TO trainmind;

--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: trainmind
--

CREATE TABLE public.audit_logs (
    id text NOT NULL,
    "userId" text,
    "organizationId" text,
    action text NOT NULL,
    "resourceType" text NOT NULL,
    "resourceId" text,
    method text NOT NULL,
    path text NOT NULL,
    "statusCode" integer NOT NULL,
    "ipAddress" text,
    "userAgent" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.audit_logs OWNER TO trainmind;

--
-- Name: calendar_events; Type: TABLE; Schema: public; Owner: trainmind
--

CREATE TABLE public.calendar_events (
    id text NOT NULL,
    title text NOT NULL,
    description text,
    "startTime" timestamp(3) without time zone NOT NULL,
    "endTime" timestamp(3) without time zone NOT NULL,
    "allDay" boolean DEFAULT false NOT NULL,
    type text NOT NULL,
    color text,
    "userId" text NOT NULL,
    "athleteId" text,
    "sessionId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "teamId" text,
    opponent text,
    "isHome" boolean,
    venue text,
    "organizationId" text NOT NULL
);


ALTER TABLE public.calendar_events OWNER TO trainmind;

--
-- Name: chat_conversations; Type: TABLE; Schema: public; Owner: trainmind
--

CREATE TABLE public.chat_conversations (
    id text NOT NULL,
    "userId" text NOT NULL,
    title text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.chat_conversations OWNER TO trainmind;

--
-- Name: chat_messages; Type: TABLE; Schema: public; Owner: trainmind
--

CREATE TABLE public.chat_messages (
    id text NOT NULL,
    "conversationId" text NOT NULL,
    role text NOT NULL,
    content text NOT NULL,
    sources jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.chat_messages OWNER TO trainmind;

--
-- Name: clearance_criteria; Type: TABLE; Schema: public; Owner: trainmind
--

CREATE TABLE public.clearance_criteria (
    id text NOT NULL,
    "rtpProtocolId" text NOT NULL,
    phase public."RTPPhase" NOT NULL,
    description text NOT NULL,
    "isMet" boolean DEFAULT false NOT NULL,
    "metAt" timestamp(3) without time zone,
    "metById" text,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "testCode" text,
    comparator text,
    "targetValue" double precision,
    unit text,
    "measuredValue" double precision,
    mandatory boolean DEFAULT true NOT NULL,
    "order" integer DEFAULT 0 NOT NULL
);


ALTER TABLE public.clearance_criteria OWNER TO trainmind;

--
-- Name: consent_records; Type: TABLE; Schema: public; Owner: trainmind
--

CREATE TABLE public.consent_records (
    id text NOT NULL,
    "userId" text NOT NULL,
    "docType" text NOT NULL,
    "docVersion" text NOT NULL,
    "acceptedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "ipAddress" text,
    "userAgent" text,
    language text,
    metadata jsonb,
    "revokedAt" timestamp(3) without time zone,
    "revokeReason" text
);


ALTER TABLE public.consent_records OWNER TO trainmind;

--
-- Name: daily_report_entries; Type: TABLE; Schema: public; Owner: trainmind
--

CREATE TABLE public.daily_report_entries (
    id text NOT NULL,
    "dailyReportId" text NOT NULL,
    "athleteId" text NOT NULL,
    date date NOT NULL,
    status integer NOT NULL,
    note text,
    "orderIndex" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "nextTraining" text,
    "injuryType" text,
    "bodyPart" text,
    side text,
    "clinicalStatus" text,
    taping text,
    treatment text,
    "trainingType" text,
    forecast text
);


ALTER TABLE public.daily_report_entries OWNER TO trainmind;

--
-- Name: daily_reports; Type: TABLE; Schema: public; Owner: trainmind
--

CREATE TABLE public.daily_reports (
    id text NOT NULL,
    "organizationId" text NOT NULL,
    "teamId" text NOT NULL,
    date date NOT NULL,
    activities jsonb DEFAULT '[]'::jsonb NOT NULL,
    "teamLines" text,
    "createdById" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.daily_reports OWNER TO trainmind;

--
-- Name: exercises; Type: TABLE; Schema: public; Owner: trainmind
--

CREATE TABLE public.exercises (
    id text NOT NULL,
    name text NOT NULL,
    category text NOT NULL,
    description text,
    "muscleGroups" text[],
    equipment text[],
    "videoUrl" text,
    "organizationId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "isDefault" boolean DEFAULT false NOT NULL
);


ALTER TABLE public.exercises OWNER TO trainmind;

--
-- Name: field_training_entries; Type: TABLE; Schema: public; Owner: trainmind
--

CREATE TABLE public.field_training_entries (
    id text NOT NULL,
    "fieldTrainingSessionId" text NOT NULL,
    "athleteId" text NOT NULL,
    "totalActiveMs" integer DEFAULT 0 NOT NULL,
    laps jsonb DEFAULT '[]'::jsonb NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    status text DEFAULT 'PRESENT'::text NOT NULL,
    note text,
    rpe integer
);


ALTER TABLE public.field_training_entries OWNER TO trainmind;

--
-- Name: field_training_sessions; Type: TABLE; Schema: public; Owner: trainmind
--

CREATE TABLE public.field_training_sessions (
    id text NOT NULL,
    "calendarEventId" text,
    "teamId" text,
    "organizationId" text NOT NULL,
    status text DEFAULT 'IN_PROGRESS'::text NOT NULL,
    "startedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "completedAt" timestamp(3) without time zone,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "availableAthletes" integer,
    exercises jsonb DEFAULT '[]'::jsonb NOT NULL,
    guests jsonb DEFAULT '[]'::jsonb NOT NULL,
    "trainingSessionId" text,
    "durationMinutes" integer,
    "sessionRpe" integer
);


ALTER TABLE public.field_training_sessions OWNER TO trainmind;

--
-- Name: game_player_entries; Type: TABLE; Schema: public; Owner: trainmind
--

CREATE TABLE public.game_player_entries (
    id text NOT NULL,
    "gameSessionId" text NOT NULL,
    "athleteId" text NOT NULL,
    "totalPlayingMs" integer DEFAULT 0 NOT NULL,
    stints jsonb DEFAULT '[]'::jsonb NOT NULL,
    "onCourt" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    rpe integer,
    readiness integer,
    "readinessNote" text
);


ALTER TABLE public.game_player_entries OWNER TO trainmind;

--
-- Name: game_sessions; Type: TABLE; Schema: public; Owner: trainmind
--

CREATE TABLE public.game_sessions (
    id text NOT NULL,
    "calendarEventId" text NOT NULL,
    "teamId" text,
    "organizationId" text NOT NULL,
    status text DEFAULT 'IN_PROGRESS'::text NOT NULL,
    quarters integer DEFAULT 4 NOT NULL,
    "quarterDurationMs" integer DEFAULT 600000 NOT NULL,
    overtimes integer DEFAULT 0 NOT NULL,
    "currentQuarter" integer DEFAULT 1 NOT NULL,
    "startedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "completedAt" timestamp(3) without time zone,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "homeScore" integer,
    "awayScore" integer,
    competition text
);


ALTER TABLE public.game_sessions OWNER TO trainmind;

--
-- Name: injuries; Type: TABLE; Schema: public; Owner: trainmind
--

CREATE TABLE public.injuries (
    id text NOT NULL,
    "athleteId" text NOT NULL,
    type text NOT NULL,
    location text NOT NULL,
    severity integer NOT NULL,
    status public."InjuryStatus" DEFAULT 'ACTIVE'::public."InjuryStatus" NOT NULL,
    "dateOccurred" timestamp(3) without time zone NOT NULL,
    "dateResolved" timestamp(3) without time zone,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    onset text
);


ALTER TABLE public.injuries OWNER TO trainmind;

--
-- Name: mesocycles; Type: TABLE; Schema: public; Owner: trainmind
--

CREATE TABLE public.mesocycles (
    id text NOT NULL,
    "periodizationPlanId" text NOT NULL,
    "orderIndex" integer NOT NULL,
    name text NOT NULL,
    phase public."MesocyclePhase" NOT NULL,
    "durationWeeks" integer NOT NULL,
    "targetLoadPercent" double precision NOT NULL,
    "intensityDistribution" jsonb,
    notes text,
    color text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.mesocycles OWNER TO trainmind;

--
-- Name: metrics; Type: TABLE; Schema: public; Owner: trainmind
--

CREATE TABLE public.metrics (
    id text NOT NULL,
    "athleteId" text NOT NULL,
    date timestamp(3) without time zone NOT NULL,
    type text NOT NULL,
    value double precision NOT NULL,
    unit text NOT NULL,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.metrics OWNER TO trainmind;

--
-- Name: microcycles; Type: TABLE; Schema: public; Owner: trainmind
--

CREATE TABLE public.microcycles (
    id text NOT NULL,
    "mesocycleId" text NOT NULL,
    "weekNumber" integer NOT NULL,
    "loadPercent" double precision NOT NULL,
    intensity public."IntensityLevel" DEFAULT 'MODERATE'::public."IntensityLevel" NOT NULL,
    volume double precision,
    "sessionsCount" integer DEFAULT 5 NOT NULL,
    "focusAreas" text[],
    "isDeload" boolean DEFAULT false NOT NULL,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.microcycles OWNER TO trainmind;

--
-- Name: notifications; Type: TABLE; Schema: public; Owner: trainmind
--

CREATE TABLE public.notifications (
    id text NOT NULL,
    "userId" text NOT NULL,
    "alertRuleId" text,
    type text NOT NULL,
    severity text DEFAULT 'info'::text NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    data jsonb,
    "isRead" boolean DEFAULT false NOT NULL,
    "readAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.notifications OWNER TO trainmind;

--
-- Name: organizations; Type: TABLE; Schema: public; Owner: trainmind
--

CREATE TABLE public.organizations (
    id text NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    sport text DEFAULT 'basketball'::text NOT NULL,
    tier public."OrganizationTier" DEFAULT 'STARTER'::public."OrganizationTier" NOT NULL,
    "logoUrl" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "stripeCustomerId" text,
    "stripeSubscriptionId" text,
    "subscriptionEndsAt" timestamp(3) without time zone,
    "subscriptionStatus" text DEFAULT 'inactive'::text,
    "subscriptionTier" text DEFAULT 'starter'::text
);


ALTER TABLE public.organizations OWNER TO trainmind;

--
-- Name: periodization_plans; Type: TABLE; Schema: public; Owner: trainmind
--

CREATE TABLE public.periodization_plans (
    id text NOT NULL,
    name text NOT NULL,
    description text,
    type public."PeriodizationType" DEFAULT 'BLOCK'::public."PeriodizationType" NOT NULL,
    "startDate" timestamp(3) without time zone NOT NULL,
    "endDate" timestamp(3) without time zone NOT NULL,
    "totalWeeks" integer NOT NULL,
    "organizationId" text NOT NULL,
    "createdById" text NOT NULL,
    "isTemplate" boolean DEFAULT false NOT NULL,
    "templateCategory" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "teamId" text
);


ALTER TABLE public.periodization_plans OWNER TO trainmind;

--
-- Name: plan_adaptations; Type: TABLE; Schema: public; Owner: trainmind
--

CREATE TABLE public.plan_adaptations (
    id text NOT NULL,
    "trainingSessionId" text,
    "athleteId" text NOT NULL,
    "organizationId" text NOT NULL,
    "proposedById" text NOT NULL,
    status text DEFAULT 'PENDING'::text NOT NULL,
    reason text NOT NULL,
    "aiReasoning" text,
    metrics jsonb NOT NULL,
    "originalPlan" jsonb NOT NULL,
    "proposedPlan" jsonb NOT NULL,
    changes jsonb NOT NULL,
    "volumeDelta" double precision,
    "intensityDelta" double precision,
    "appliedAt" timestamp(3) without time zone,
    "reviewedAt" timestamp(3) without time zone,
    "reviewedById" text,
    "reviewNotes" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.plan_adaptations OWNER TO trainmind;

--
-- Name: report_schedule_runs; Type: TABLE; Schema: public; Owner: trainmind
--

CREATE TABLE public.report_schedule_runs (
    id text NOT NULL,
    "scheduleId" text NOT NULL,
    status public."ReportScheduleStatus" NOT NULL,
    "startedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "finishedAt" timestamp(3) without time zone,
    "durationMs" integer,
    "fileSizeBytes" integer,
    "errorMessage" text,
    "recipientsSent" integer DEFAULT 0 NOT NULL
);


ALTER TABLE public.report_schedule_runs OWNER TO trainmind;

--
-- Name: report_schedules; Type: TABLE; Schema: public; Owner: trainmind
--

CREATE TABLE public.report_schedules (
    id text NOT NULL,
    "organizationId" text NOT NULL,
    "createdById" text NOT NULL,
    name text NOT NULL,
    audience public."ReportAudience" NOT NULL,
    format public."ReportFormat" DEFAULT 'PDF'::public."ReportFormat" NOT NULL,
    "cronExpression" text NOT NULL,
    timezone text DEFAULT 'Europe/Rome'::text NOT NULL,
    "periodDays" integer DEFAULT 7 NOT NULL,
    recipients text[],
    "includeAISummary" boolean DEFAULT true NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "lastRunAt" timestamp(3) without time zone,
    "lastRunStatus" public."ReportScheduleStatus",
    "nextRunAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.report_schedules OWNER TO trainmind;

--
-- Name: reports; Type: TABLE; Schema: public; Owner: trainmind
--

CREATE TABLE public.reports (
    id text NOT NULL,
    "userId" text NOT NULL,
    title text NOT NULL,
    type text NOT NULL,
    content jsonb NOT NULL,
    filters jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.reports OWNER TO trainmind;

--
-- Name: rtp_phase_logs; Type: TABLE; Schema: public; Owner: trainmind
--

CREATE TABLE public.rtp_phase_logs (
    id text NOT NULL,
    "rtpProtocolId" text NOT NULL,
    "fromPhase" public."RTPPhase" NOT NULL,
    "toPhase" public."RTPPhase" NOT NULL,
    "changedById" text NOT NULL,
    reason text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.rtp_phase_logs OWNER TO trainmind;

--
-- Name: rtp_protocol_phases; Type: TABLE; Schema: public; Owner: trainmind
--

CREATE TABLE public.rtp_protocol_phases (
    id text NOT NULL,
    "rtpProtocolId" text NOT NULL,
    phase public."RTPPhase" NOT NULL,
    "order" integer NOT NULL,
    name text NOT NULL,
    goal text,
    "minDays" integer,
    "typicalDays" integer,
    "startedAt" timestamp(3) without time zone,
    "completedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.rtp_protocol_phases OWNER TO trainmind;

--
-- Name: rtp_protocols; Type: TABLE; Schema: public; Owner: trainmind
--

CREATE TABLE public.rtp_protocols (
    id text NOT NULL,
    "injuryId" text NOT NULL,
    "athleteId" text NOT NULL,
    "currentPhase" public."RTPPhase" DEFAULT 'PHASE_1'::public."RTPPhase" NOT NULL,
    "startDate" timestamp(3) without time zone NOT NULL,
    "targetDate" timestamp(3) without time zone,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "templateId" text,
    "templateName" text
);


ALTER TABLE public.rtp_protocols OWNER TO trainmind;

--
-- Name: rtp_template_criteria; Type: TABLE; Schema: public; Owner: trainmind
--

CREATE TABLE public.rtp_template_criteria (
    id text NOT NULL,
    "phaseId" text NOT NULL,
    "order" integer NOT NULL,
    description text NOT NULL,
    "testCode" text,
    comparator text,
    "targetValue" double precision,
    unit text,
    mandatory boolean DEFAULT true NOT NULL
);


ALTER TABLE public.rtp_template_criteria OWNER TO trainmind;

--
-- Name: rtp_template_phases; Type: TABLE; Schema: public; Owner: trainmind
--

CREATE TABLE public.rtp_template_phases (
    id text NOT NULL,
    "templateId" text NOT NULL,
    "order" integer NOT NULL,
    name text NOT NULL,
    goal text,
    "minDays" integer,
    "typicalDays" integer
);


ALTER TABLE public.rtp_template_phases OWNER TO trainmind;

--
-- Name: rtp_templates; Type: TABLE; Schema: public; Owner: trainmind
--

CREATE TABLE public.rtp_templates (
    id text NOT NULL,
    "organizationId" text,
    code text,
    name text NOT NULL,
    description text,
    "bodyZone" text,
    "bodyRegion" text,
    "injuryType" text,
    "severityMin" integer,
    "severityMax" integer,
    "isSystem" boolean DEFAULT false NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.rtp_templates OWNER TO trainmind;

--
-- Name: session_exercises; Type: TABLE; Schema: public; Owner: trainmind
--

CREATE TABLE public.session_exercises (
    id text NOT NULL,
    "trainingSessionId" text NOT NULL,
    "exerciseId" text NOT NULL,
    "orderIndex" integer NOT NULL,
    sets integer,
    reps text,
    weight double precision,
    duration integer,
    "restTime" integer,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.session_exercises OWNER TO trainmind;

--
-- Name: session_logs; Type: TABLE; Schema: public; Owner: trainmind
--

CREATE TABLE public.session_logs (
    id text NOT NULL,
    "trainingSessionId" text NOT NULL,
    "athleteId" text NOT NULL,
    "actualRpe" integer,
    "actualDuration" integer,
    "completedSets" jsonb,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "exerciseChecks" jsonb,
    "viewedAt" timestamp(3) without time zone
);


ALTER TABLE public.session_logs OWNER TO trainmind;

--
-- Name: simulations; Type: TABLE; Schema: public; Owner: trainmind
--

CREATE TABLE public.simulations (
    id text NOT NULL,
    "periodizationPlanId" text NOT NULL,
    name text NOT NULL,
    description text,
    parameters jsonb NOT NULL,
    results jsonb,
    "aiInsights" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.simulations OWNER TO trainmind;

--
-- Name: teams; Type: TABLE; Schema: public; Owner: trainmind
--

CREATE TABLE public.teams (
    id text NOT NULL,
    name text NOT NULL,
    description text,
    color text,
    "organizationId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "logoUrl" text
);


ALTER TABLE public.teams OWNER TO trainmind;

--
-- Name: training_plans; Type: TABLE; Schema: public; Owner: trainmind
--

CREATE TABLE public.training_plans (
    id text NOT NULL,
    name text NOT NULL,
    description text,
    "startDate" timestamp(3) without time zone NOT NULL,
    "endDate" timestamp(3) without time zone NOT NULL,
    "athleteId" text,
    "organizationId" text NOT NULL,
    "createdById" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "periodizationPlanId" text,
    "teamId" text,
    "trainingDays" integer[] NOT NULL,
    "aiGenerated" boolean DEFAULT false NOT NULL
);


ALTER TABLE public.training_plans OWNER TO trainmind;

--
-- Name: training_sessions; Type: TABLE; Schema: public; Owner: trainmind
--

CREATE TABLE public.training_sessions (
    id text NOT NULL,
    title text NOT NULL,
    date timestamp(3) without time zone,
    duration integer NOT NULL,
    status public."SessionStatus" DEFAULT 'PLANNED'::public."SessionStatus" NOT NULL,
    notes text,
    rpe integer,
    "weekId" text,
    "athleteId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "isTemplate" boolean DEFAULT false NOT NULL,
    "organizationId" text NOT NULL,
    "aiModified" boolean DEFAULT false NOT NULL,
    "detailedByAttendance" boolean DEFAULT false NOT NULL
);


ALTER TABLE public.training_sessions OWNER TO trainmind;

--
-- Name: users; Type: TABLE; Schema: public; Owner: trainmind
--

CREATE TABLE public.users (
    id text NOT NULL,
    email text NOT NULL,
    "passwordHash" text NOT NULL,
    "firstName" text NOT NULL,
    "lastName" text NOT NULL,
    role public."UserRole" DEFAULT 'TRAINER'::public."UserRole" NOT NULL,
    "avatarUrl" text,
    "isActive" boolean DEFAULT true NOT NULL,
    "organizationId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "refreshToken" text,
    "lastLoginAt" timestamp(3) without time zone,
    "consentAnalytics" boolean DEFAULT false,
    "consentMarketing" boolean DEFAULT false,
    "consentThirdParty" boolean DEFAULT false,
    "consentUpdatedAt" timestamp(3) without time zone,
    "athleteId" text,
    "pushSubscription" jsonb,
    "deletedAt" timestamp(3) without time zone,
    "resetTokenHash" text,
    "resetTokenExpiry" timestamp(3) without time zone,
    "passwordChangedAt" timestamp(3) without time zone,
    locale text
);


ALTER TABLE public.users OWNER TO trainmind;

--
-- Name: weeks; Type: TABLE; Schema: public; Owner: trainmind
--

CREATE TABLE public.weeks (
    id text NOT NULL,
    "weekNumber" integer NOT NULL,
    "trainingPlanId" text NOT NULL,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "microcycleId" text
);


ALTER TABLE public.weeks OWNER TO trainmind;

--
-- Name: wellness_logs; Type: TABLE; Schema: public; Owner: trainmind
--

CREATE TABLE public.wellness_logs (
    id text NOT NULL,
    "athleteId" text NOT NULL,
    date timestamp(3) without time zone NOT NULL,
    "sleepHours" double precision NOT NULL,
    "sleepQuality" integer NOT NULL,
    fatigue integer NOT NULL,
    soreness integer NOT NULL,
    stress integer NOT NULL,
    mood integer NOT NULL,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "mediaUrls" text[],
    "submittedBy" text
);


ALTER TABLE public.wellness_logs OWNER TO trainmind;

--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: trainmind
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
10a91874-29eb-4acb-a3ea-fa87f29c2d37	a95d99dcdfb3d3767088da878d3001746d6686fd20a4a4cbcc1d0c3fdce85680	2026-09-03 07:45:40.192462+00	20260804090000_add_user_locale	\N	\N	2026-09-03 07:45:40.169664+00	1
470b4ee6-232f-4254-accc-8521feec2947	2c778cec0c666ff327bb2fb7420454fff8035688ba3fe3ab6f4ed5b0c71becbf	2026-09-03 07:45:38.481862+00	20260410064431_add_alert_notification_models	\N	\N	2026-09-03 07:45:37.494447+00	1
ee49cfb4-4022-4338-ae0d-111f722c9152	b7bf61fda2895fcd4526f2a4e9c908aa3bc3952cd8a19dd57ade177f954746b8	2026-09-03 07:45:39.616689+00	20260510100000_add_exercise_is_default	\N	\N	2026-09-03 07:45:39.598451+00	1
f148e314-3502-4dbf-8733-452cf484ef4a	04f86bbdce0009969811a6b4ba6f629c7edb55539806195378caa31268b3aade	2026-09-03 07:45:38.573135+00	20260410123730_sprint_3_4_adaptations	\N	\N	2026-09-03 07:45:38.488371+00	1
c90ffbe0-0871-4cc9-a639-629bd264570c	c8273c9a4b2ea9f704fa87b8d53b6855681aac538cf29d5d9776d3d88572218a	2026-09-03 07:45:38.698175+00	20260411205041_sprint_4_2_report_schedules	\N	\N	2026-09-03 07:45:38.579426+00	1
4ef54066-2747-4f3f-b7a3-7f60558ddba4	9357bc39cd4da6d5bb01c532c22cf707f04e3af07121fbd9e30792cdfe53e6cd	2026-09-03 07:45:38.910113+00	20260416124634_sprint_4_3_periodization	\N	\N	2026-09-03 07:45:38.709834+00	1
abd1a04d-a9e0-417a-a90b-582f85d5e3c0	8b8370de0a375bb026cd489751c7aa1eb843670d14b7ed4e618f0edba57a2070	2026-09-03 07:45:39.787232+00	20260520095249_add_athlete_app	\N	\N	2026-09-03 07:45:39.622144+00	1
c7ab5a9c-e15c-49f7-a14f-695d29c1b542	41ed2aa476ed442daf2115429941e9c9cfb763851fb14b861ea6217f8a86fbfd	2026-09-03 07:45:39.014615+00	20260417083031_sprint_4_4_rtp_phase_logs	\N	\N	2026-09-03 07:45:38.917491+00	1
7c62b725-1bd4-4f82-a40e-408afb8e301a	8d6a88e53f410da42d4f7b988a10f2fd5f7559d86debee2e518f68337dd2b8a3	2026-09-03 07:45:39.061522+00	20260420070000_link_periodization_training	\N	\N	2026-09-03 07:45:39.020666+00	1
7562839f-f368-48d3-8f38-b9b89d7d004f	d4e20d06eaa2a2196279e525f3385b7ba5c89ca9cc0df2c0e420d2c67eeb0e3d	2026-09-03 07:45:40.526464+00	20260824140000_session_attendance	\N	\N	2026-09-03 07:45:40.492419+00	1
0af40c71-3a15-4216-8dd2-df0aa43992f3	b781f22dc986dd4c09dfe9d6f684b93a4ad42e293dd2f4985ceef33f504bb815	2026-09-03 07:45:39.09498+00	20260420070537_	\N	\N	2026-09-03 07:45:39.067524+00	1
327f9367-3996-4d4e-99c5-7f5b09f1c9e2	b75addcdc99b9db6c2ebb493250029197b3094272fe991e1d7c84881913abc9b	2026-09-03 07:45:39.811698+00	20260521082548_add_athlete_email	\N	\N	2026-09-03 07:45:39.791655+00	1
550d7184-79b6-45eb-a375-91079b2d8169	a098d72b384726393dd20b99c26290b0e6ea2b35dfbe127416240eaf31d357fb	2026-09-03 07:45:39.118041+00	20260421070000_add_team_to_athlete	\N	\N	2026-09-03 07:45:39.100809+00	1
e09cd630-3e14-4096-b1fc-01a452b7e90e	137dede834cd399fd3808e46eccd0372ed91eb0065994eeec1eee8c1919c3abb	2026-09-03 07:45:39.262793+00	20260421080000_add_teams	\N	\N	2026-09-03 07:45:39.124073+00	1
ce792771-ea3e-428f-9ae7-b6915a3947fb	89ce65b94bcfde3f956bfce63ffc69192a0898d01589a17196e171bfef2d5e1a	2026-09-03 07:45:40.243523+00	20260819100000_field_training_exercises	\N	\N	2026-09-03 07:45:40.19878+00	1
e31cd6f1-6418-47c7-a2d6-815335ebaf76	103ff8415cef34cb2b64979effac2b3bee8fce458de5260c5e94dabca1424a76	2026-09-03 07:45:39.29821+00	20260424100000_session_templates	\N	\N	2026-09-03 07:45:39.268788+00	1
54b01e6e-8ce2-4455-b5e4-2a4322dc7095	c12ccaacde02e0b2dc0c7b342d1d10b2c3c19fc6cfd4df5b43b80b80ddccf47a	2026-09-03 07:45:39.834427+00	20260527120000_rename_tier_starter_professional_ultra	\N	\N	2026-09-03 07:45:39.816177+00	1
167f968e-79b9-4ef8-bbe0-e3d082db38ee	ae5dced07725b2454ed5248d2315517e97bd4a390cf37bd9f54468c6765cc73d	2026-09-03 07:45:39.42979+00	20260428100000_field_training	\N	\N	2026-09-03 07:45:39.303629+00	1
bd67caa4-a1e0-45ed-ab1e-69e04a516ad5	aca0535db5319ed75432e2a3ec1e8927f72f546e9a5bf4d3ee5cb96386902781	2026-09-03 07:45:39.570359+00	20260428120000_game_tracking	\N	\N	2026-09-03 07:45:39.434654+00	1
37f8d300-2bda-42ac-8521-8f1820e52a9b	df73a42831f165505751822adacc0fd1d4aaf1bf6d1156f52ec54cce3ba692ce	2026-09-03 07:45:39.59288+00	20260430100000_add_ai_modified_to_session	\N	\N	2026-09-03 07:45:39.576674+00	1
a459f6cc-40b5-44af-bd1c-1d3b1dbae718	048235ae3d2877eda083336a6e68faa13095a9d23b3d7927170e6a3748b505a0	2026-09-03 07:45:39.907621+00	20260721120000_consent_record_audit_fields	\N	\N	2026-09-03 07:45:39.841363+00	1
7a3caca0-4f09-4938-abcc-13a339e52886	c3af7f6b8c99c7b0eee034a8fbcd6e98e43bb22c3eedf75346b286107810e333	2026-09-03 07:45:40.358558+00	20260824090000_injury_onset	\N	\N	2026-09-03 07:45:40.342407+00	1
5dc80b76-6b44-4920-ad8c-833653bc74b7	d45d8c422dde8a92079a0c971206f3ebd654eb5a2b0e7d8d7d9844bac6910d1b	2026-09-03 07:45:40.002951+00	20260722132554_	\N	\N	2026-09-03 07:45:39.913278+00	1
620d17b2-3d60-4c71-a855-6fe15b997583	a17fe87a60cd546a2a78da541e75767c1e1901007afdee8d56e8e064a11b8d70	2026-09-03 07:45:40.28048+00	20260820090000_field_training_roster	\N	\N	2026-09-03 07:45:40.249444+00	1
9b37ba73-93a3-4641-a6fb-3e3b660853ba	63496ae282c4e4050a0788510d11a8aaf37f1ac417996341e7bb960f43e15167	2026-09-03 07:45:40.040529+00	20260729100000_add_password_reset	\N	\N	2026-09-03 07:45:40.012952+00	1
29dc32af-662c-4546-847d-8269acad9d05	599990d90c85d7e3d7b45f21ddd4208cd821b78de4d76595859a2db44723dc41	2026-09-03 07:45:40.156041+00	20260804090000_add_ai_usage_log	\N	\N	2026-09-03 07:45:40.045089+00	1
7efd6080-636e-4176-807e-1c07e90b0393	f3386c39595ad6b79ada185b540fde6e965ba108ad39cf47b89a28e045384f32	2026-09-03 07:45:40.299537+00	20260823090000_calendar_event_types	\N	\N	2026-09-03 07:45:40.286934+00	1
bdf67f03-8c8a-485e-9e38-eea0921e769c	02d0833a9ff61310c4613c78e9158600fc7fcaba4d10c04fcbf8f6362675cdb9	2026-09-03 07:45:40.375476+00	20260824100000_injury_seed_types	\N	\N	2026-09-03 07:45:40.364422+00	1
50ec5d13-ecf9-44c2-a120-1f5a22550398	bf36f4ed354a242c052bc8e711b3fe2affe44b62edb112b104b073c76e810cbe	2026-09-03 07:45:40.317876+00	20260823120000_exercise_categories	\N	\N	2026-09-03 07:45:40.304239+00	1
ba152f84-dbf4-44f3-9ee3-46f78cb20d42	34b20ad30e6c1c22b8309e8754744170c9d8d3f03f35843b343c1b380c02da4e	2026-09-03 07:45:40.337079+00	20260823140000_metric_type_names	\N	\N	2026-09-03 07:45:40.325222+00	1
fe7e4cde-e250-40e7-9c94-bebe46f68cb6	0d29c5a8f37a614729309f5efa27baed7c862b5e2b9e9ce9a0fcfe5b4f4a386f	2026-09-03 07:45:40.609311+00	20260828120000_no_cascade_on_delete	\N	\N	2026-09-03 07:45:40.596463+00	1
01085120-ded8-4503-9d75-8b662622969f	a53853ba94c6cc4011d73be5b62d7b636fc8b1a549020596b902145b84cd3689	2026-09-03 07:45:40.487841+00	20260824120000_wellness_scale_flip	\N	\N	2026-09-03 07:45:40.380266+00	1
84374e90-57bb-463d-b505-a1b3a2eaedba	b091ed3c014f3349d6123523fe2922afa2c836b7ae8898cb5b9c55ca27d7286f	2026-09-03 07:45:40.590215+00	20260828090000_plan_training_days_ai_flag	\N	\N	2026-09-03 07:45:40.573786+00	1
60e96ce0-244c-4725-9366-530cff5f52ce	4a75617c1ecef4686f542619edc86d99cd3ff94149aa72ab6d678acc7446bd6c	2026-09-03 07:45:40.547952+00	20260826090000_team_logo	\N	\N	2026-09-03 07:45:40.53346+00	1
a0e8a0ed-73a9-4ef9-983a-db50858ef678	9c46fdbf88a03d79ce2847d8b59c4af3ffda1e848ba3ddb5a78271d5a2ece9eb	2026-09-03 07:45:40.568973+00	20260826100000_athlete_positions	\N	\N	2026-09-03 07:45:40.554032+00	1
ce85a2d3-6b39-429e-859d-78d311d5b2ce	e9e34aefdb8292a99103a76f0ad91072beb67e80b4ade0fc9e33b5b3125708b6	2026-09-03 07:45:40.631143+00	20260831090000_game_player_rpe	\N	\N	2026-09-03 07:45:40.614236+00	1
c82a2166-7a26-4c4b-b612-f673f29dce4c	6324a7b63dd080e2c4b1a5e2d7b5753f2699af3e050686d0e27e254776e87126	2026-09-03 07:45:40.748438+00	20260831100000_daily_report	\N	\N	2026-09-03 07:45:40.635992+00	1
ea3c0f1e-5167-42c2-9b01-4cf04cc227b7	6029a2f104c0671831d7014c964bffafca8c41b8d21406febbef79766fabe250	2026-09-03 07:45:40.770352+00	20260831140000_daily_report_clinical	\N	\N	2026-09-03 07:45:40.753713+00	1
425d319b-3d79-4cf2-bd96-7c860abbad42	3ad7c6bdd9e5597c3f4b2cebf26f37981ff0bd192edb8e44fec6e9ca4b76bfe4	2026-09-03 07:45:40.795303+00	20260901090000_calendar_match_details	\N	\N	2026-09-03 07:45:40.775273+00	1
48003a33-dc94-49ce-abe8-f48f7e3c8c9c	36be95ccc42a5ba848c22b5aef92192c92141a1feb53cded2587ede14f5a50d7	2026-09-03 07:45:40.826488+00	20260901120000_game_report	\N	\N	2026-09-03 07:45:40.800961+00	1
fa1e0912-69d5-4dcb-9a58-39a36ffffe5f	7ce6f5ea1f5d82bc65969e541c587d6fd8a31c8632ab0caa744d773201394590	2026-09-03 07:45:41.085072+00	20260901160000_rtp_templates	\N	\N	2026-09-03 07:45:40.841096+00	1
1267a897-a6ec-4c41-8786-78f5c1d05fe7	0a1f66e09da61f397c76791d11626407de755d27c8769dd20c9707102115acf5	2026-09-03 07:45:41.125728+00	20260902170000_calendar_event_organization	\N	\N	2026-09-03 07:45:41.091537+00	1
\.


--
-- Data for Name: ai_usage_logs; Type: TABLE DATA; Schema: public; Owner: trainmind
--

COPY public.ai_usage_logs (id, "organizationId", "userId", operation, endpoint, model, provider, "promptTokens", "completionTokens", "totalTokens", "costUsd", "creditsCharged", success, "errorCode", "durationMs", estimated, "createdAt") FROM stdin;
\.


--
-- Data for Name: alert_rules; Type: TABLE DATA; Schema: public; Owner: trainmind
--

COPY public.alert_rules (id, "organizationId", "userId", name, description, type, condition, severity, "isActive", "athleteId", "cooldownMinutes", "lastTriggeredAt", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: athlete_invites; Type: TABLE DATA; Schema: public; Owner: trainmind
--

COPY public.athlete_invites (id, "athleteId", email, token, status, "invitedById", "organizationId", "expiresAt", "acceptedAt", "createdAt") FROM stdin;
\.


--
-- Data for Name: athlete_teams; Type: TABLE DATA; Schema: public; Owner: trainmind
--

COPY public.athlete_teams (id, "athleteId", "teamId", "createdAt") FROM stdin;
\.


--
-- Data for Name: athletes; Type: TABLE DATA; Schema: public; Owner: trainmind
--

COPY public.athletes (id, "firstName", "lastName", "dateOfBirth", "position", "jerseyNumber", height, weight, "photoUrl", "isActive", "organizationId", "createdAt", "updatedAt", team, email) FROM stdin;
\.


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: trainmind
--

COPY public.audit_logs (id, "userId", "organizationId", action, "resourceType", "resourceId", method, path, "statusCode", "ipAddress", "userAgent", "createdAt") FROM stdin;
cmtl81txd000bsbmf6147wmi7	\N	cmtl81tm30001sbmfgj3ca26t	athlete.create	athlete	\N	POST	/api/v1/athletes	201	127.0.0.1	lightMyRequest	2026-09-03 07:46:49.921
cmtl81txw000fsbmfcsk2ztmf	\N	cmtl81tm30001sbmfgj3ca26t	wellness_log.create	wellness_log	\N	POST	/api/v1/wellness	201	127.0.0.1	lightMyRequest	2026-09-03 07:46:49.94
cmtl8aevx000bvm9afzgm7dop	\N	cmtl8aema0001vm9aq944m2dp	athlete.create	athlete	\N	POST	/api/v1/athletes	201	127.0.0.1	lightMyRequest	2026-09-03 07:53:30.334
cmtl8aewc000fvm9apsqyxm7z	\N	cmtl8aema0001vm9aq944m2dp	wellness_log.create	wellness_log	\N	POST	/api/v1/wellness	201	127.0.0.1	lightMyRequest	2026-09-03 07:53:30.349
\.


--
-- Data for Name: calendar_events; Type: TABLE DATA; Schema: public; Owner: trainmind
--

COPY public.calendar_events (id, title, description, "startTime", "endTime", "allDay", type, color, "userId", "athleteId", "sessionId", "createdAt", "updatedAt", "teamId", opponent, "isHome", venue, "organizationId") FROM stdin;
\.


--
-- Data for Name: chat_conversations; Type: TABLE DATA; Schema: public; Owner: trainmind
--

COPY public.chat_conversations (id, "userId", title, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: chat_messages; Type: TABLE DATA; Schema: public; Owner: trainmind
--

COPY public.chat_messages (id, "conversationId", role, content, sources, "createdAt") FROM stdin;
\.


--
-- Data for Name: clearance_criteria; Type: TABLE DATA; Schema: public; Owner: trainmind
--

COPY public.clearance_criteria (id, "rtpProtocolId", phase, description, "isMet", "metAt", "metById", notes, "createdAt", "updatedAt", "testCode", comparator, "targetValue", unit, "measuredValue", mandatory, "order") FROM stdin;
\.


--
-- Data for Name: consent_records; Type: TABLE DATA; Schema: public; Owner: trainmind
--

COPY public.consent_records (id, "userId", "docType", "docVersion", "acceptedAt", "ipAddress", "userAgent", language, metadata, "revokedAt", "revokeReason") FROM stdin;
\.


--
-- Data for Name: daily_report_entries; Type: TABLE DATA; Schema: public; Owner: trainmind
--

COPY public.daily_report_entries (id, "dailyReportId", "athleteId", date, status, note, "orderIndex", "createdAt", "updatedAt", "nextTraining", "injuryType", "bodyPart", side, "clinicalStatus", taping, treatment, "trainingType", forecast) FROM stdin;
\.


--
-- Data for Name: daily_reports; Type: TABLE DATA; Schema: public; Owner: trainmind
--

COPY public.daily_reports (id, "organizationId", "teamId", date, activities, "teamLines", "createdById", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: exercises; Type: TABLE DATA; Schema: public; Owner: trainmind
--

COPY public.exercises (id, name, category, description, "muscleGroups", equipment, "videoUrl", "organizationId", "createdAt", "updatedAt", "isDefault") FROM stdin;
\.


--
-- Data for Name: field_training_entries; Type: TABLE DATA; Schema: public; Owner: trainmind
--

COPY public.field_training_entries (id, "fieldTrainingSessionId", "athleteId", "totalActiveMs", laps, "createdAt", "updatedAt", status, note, rpe) FROM stdin;
\.


--
-- Data for Name: field_training_sessions; Type: TABLE DATA; Schema: public; Owner: trainmind
--

COPY public.field_training_sessions (id, "calendarEventId", "teamId", "organizationId", status, "startedAt", "completedAt", notes, "createdAt", "updatedAt", "availableAthletes", exercises, guests, "trainingSessionId", "durationMinutes", "sessionRpe") FROM stdin;
\.


--
-- Data for Name: game_player_entries; Type: TABLE DATA; Schema: public; Owner: trainmind
--

COPY public.game_player_entries (id, "gameSessionId", "athleteId", "totalPlayingMs", stints, "onCourt", "createdAt", "updatedAt", rpe, readiness, "readinessNote") FROM stdin;
\.


--
-- Data for Name: game_sessions; Type: TABLE DATA; Schema: public; Owner: trainmind
--

COPY public.game_sessions (id, "calendarEventId", "teamId", "organizationId", status, quarters, "quarterDurationMs", overtimes, "currentQuarter", "startedAt", "completedAt", notes, "createdAt", "updatedAt", "homeScore", "awayScore", competition) FROM stdin;
\.


--
-- Data for Name: injuries; Type: TABLE DATA; Schema: public; Owner: trainmind
--

COPY public.injuries (id, "athleteId", type, location, severity, status, "dateOccurred", "dateResolved", notes, "createdAt", "updatedAt", onset) FROM stdin;
\.


--
-- Data for Name: mesocycles; Type: TABLE DATA; Schema: public; Owner: trainmind
--

COPY public.mesocycles (id, "periodizationPlanId", "orderIndex", name, phase, "durationWeeks", "targetLoadPercent", "intensityDistribution", notes, color, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: metrics; Type: TABLE DATA; Schema: public; Owner: trainmind
--

COPY public.metrics (id, "athleteId", date, type, value, unit, notes, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: microcycles; Type: TABLE DATA; Schema: public; Owner: trainmind
--

COPY public.microcycles (id, "mesocycleId", "weekNumber", "loadPercent", intensity, volume, "sessionsCount", "focusAreas", "isDeload", notes, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: trainmind
--

COPY public.notifications (id, "userId", "alertRuleId", type, severity, title, message, data, "isRead", "readAt", "createdAt") FROM stdin;
\.


--
-- Data for Name: organizations; Type: TABLE DATA; Schema: public; Owner: trainmind
--

COPY public.organizations (id, name, slug, sport, tier, "logoUrl", "createdAt", "updatedAt", "stripeCustomerId", "stripeSubscriptionId", "subscriptionEndsAt", "subscriptionStatus", "subscriptionTier") FROM stdin;
\.


--
-- Data for Name: periodization_plans; Type: TABLE DATA; Schema: public; Owner: trainmind
--

COPY public.periodization_plans (id, name, description, type, "startDate", "endDate", "totalWeeks", "organizationId", "createdById", "isTemplate", "templateCategory", "createdAt", "updatedAt", "teamId") FROM stdin;
\.


--
-- Data for Name: plan_adaptations; Type: TABLE DATA; Schema: public; Owner: trainmind
--

COPY public.plan_adaptations (id, "trainingSessionId", "athleteId", "organizationId", "proposedById", status, reason, "aiReasoning", metrics, "originalPlan", "proposedPlan", changes, "volumeDelta", "intensityDelta", "appliedAt", "reviewedAt", "reviewedById", "reviewNotes", "createdAt") FROM stdin;
\.


--
-- Data for Name: report_schedule_runs; Type: TABLE DATA; Schema: public; Owner: trainmind
--

COPY public.report_schedule_runs (id, "scheduleId", status, "startedAt", "finishedAt", "durationMs", "fileSizeBytes", "errorMessage", "recipientsSent") FROM stdin;
\.


--
-- Data for Name: report_schedules; Type: TABLE DATA; Schema: public; Owner: trainmind
--

COPY public.report_schedules (id, "organizationId", "createdById", name, audience, format, "cronExpression", timezone, "periodDays", recipients, "includeAISummary", "isActive", "lastRunAt", "lastRunStatus", "nextRunAt", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: reports; Type: TABLE DATA; Schema: public; Owner: trainmind
--

COPY public.reports (id, "userId", title, type, content, filters, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: rtp_phase_logs; Type: TABLE DATA; Schema: public; Owner: trainmind
--

COPY public.rtp_phase_logs (id, "rtpProtocolId", "fromPhase", "toPhase", "changedById", reason, "createdAt") FROM stdin;
\.


--
-- Data for Name: rtp_protocol_phases; Type: TABLE DATA; Schema: public; Owner: trainmind
--

COPY public.rtp_protocol_phases (id, "rtpProtocolId", phase, "order", name, goal, "minDays", "typicalDays", "startedAt", "completedAt", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: rtp_protocols; Type: TABLE DATA; Schema: public; Owner: trainmind
--

COPY public.rtp_protocols (id, "injuryId", "athleteId", "currentPhase", "startDate", "targetDate", notes, "createdAt", "updatedAt", "templateId", "templateName") FROM stdin;
\.


--
-- Data for Name: rtp_template_criteria; Type: TABLE DATA; Schema: public; Owner: trainmind
--

COPY public.rtp_template_criteria (id, "phaseId", "order", description, "testCode", comparator, "targetValue", unit, mandatory) FROM stdin;
sys_knee_ligament_major_p1_c1	sys_knee_ligament_major_p1	1	Dolore a riposo entro 2/10	VAS a riposo	lte	2	/10	t
sys_knee_ligament_major_p1_c2	sys_knee_ligament_major_p1	2	Versamento assente o minimo (stroke test 0/1+)	\N	\N	\N	\N	t
sys_knee_ligament_major_p1_c3	sys_knee_ligament_major_p1	3	Estensione passiva completa, simmetrica al controlaterale	Deficit di estensione	lte	0	gradi	t
sys_knee_ligament_major_p1_c4	sys_knee_ligament_major_p1	4	Contrazione volontaria del quadricipite senza extension lag	\N	\N	\N	\N	t
sys_knee_ligament_major_p1_c5	sys_knee_ligament_major_p1	5	Cammino senza stampelle e senza zoppia	\N	\N	\N	\N	t
sys_knee_ligament_major_p2_c1	sys_knee_ligament_major_p2	1	Flessione attiva almeno 125 gradi	Flessione attiva	gte	125	gradi	t
sys_knee_ligament_major_p2_c2	sys_knee_ligament_major_p2	2	Nessun versamento nelle 24 h dopo la seduta di carico	\N	\N	\N	\N	t
sys_knee_ligament_major_p2_c3	sys_knee_ligament_major_p2	3	Forza isometrica del quadricipite almeno 70% del controlaterale	Quadricipite LSI	gte	70	%	t
sys_knee_ligament_major_p2_c4	sys_knee_ligament_major_p2	4	Salita e discesa delle scale senza dolore	\N	\N	\N	\N	t
sys_knee_ligament_major_p2_c5	sys_knee_ligament_major_p2	5	Bici ed ellittica 20 minuti senza sintomi	\N	\N	\N	\N	f
sys_knee_ligament_major_p3_c1	sys_knee_ligament_major_p3	1	Forza del quadricipite almeno 80% del controlaterale	Quadricipite LSI	gte	80	%	t
sys_knee_ligament_major_p3_c2	sys_knee_ligament_major_p3	2	Rapporto ischiocrurali/quadricipite almeno 0.55	H/Q ratio	gte	0.55	rapporto	t
sys_knee_ligament_major_p3_c3	sys_knee_ligament_major_p3	3	Corsa lineare 20 minuti senza dolore ne' versamento	\N	\N	\N	\N	t
sys_knee_ligament_major_p3_c4	sys_knee_ligament_major_p3	4	Single leg hop test almeno 80% del controlaterale	Single hop LSI	gte	80	%	t
sys_knee_ligament_major_p3_c5	sys_knee_ligament_major_p3	5	Y-Balance anteriore: differenza tra i due arti sotto i 4 cm	Y-Balance ANT	lte	4	cm	f
sys_knee_ligament_major_p4_c1	sys_knee_ligament_major_p4	1	Forza del quadricipite almeno 90% del controlaterale	Quadricipite LSI	gte	90	%	t
sys_knee_ligament_major_p4_c2	sys_knee_ligament_major_p4	2	Batteria hop test (singolo, triplo, crossover, 6 m a tempo) tutti almeno 90%	Hop battery LSI	gte	90	%	t
sys_knee_ligament_major_p4_c3	sys_knee_ligament_major_p4	3	Cambi di direzione e decelerazioni a intensita' progressiva senza dolore	\N	\N	\N	\N	t
sys_knee_ligament_major_p4_c4	sys_knee_ligament_major_p4	4	Drill di tiro, palleggio e scivolamenti difensivi completati al 100%	\N	\N	\N	\N	t
sys_knee_ligament_major_p4_c5	sys_knee_ligament_major_p4	5	Nessun versamento nelle 24 h successive alle sedute intense	\N	\N	\N	\N	t
sys_knee_ligament_major_p5_c1	sys_knee_ligament_major_p5	1	Almeno 4 allenamenti completi con contatto senza sintomi	Sedute complete	gte	4	sedute	t
sys_knee_ligament_major_p5_c2	sys_knee_ligament_major_p5	2	Forza del quadricipite almeno 95% del controlaterale	Quadricipite LSI	gte	95	%	t
sys_knee_ligament_major_p5_c3	sys_knee_ligament_major_p5	3	ACL-RSI almeno 65	ACL-RSI	gte	65	punti	t
sys_knee_ligament_major_p5_c4	sys_knee_ligament_major_p5	4	Carico settimanale (sRPE) allineato ai compagni di ruolo, ACWR fra 0.8 e 1.3	\N	\N	\N	\N	f
sys_knee_ligament_major_p6_c1	sys_knee_ligament_major_p6	1	Clearance medica firmata	\N	\N	\N	\N	t
sys_knee_ligament_major_p6_c2	sys_knee_ligament_major_p6	2	Nessun episodio di cedimento (giving way) negli ultimi 30 giorni	\N	\N	\N	\N	t
sys_knee_ligament_major_p6_c3	sys_knee_ligament_major_p6	3	ACL-RSI almeno 76	ACL-RSI	gte	76	punti	t
sys_knee_ligament_major_p6_c4	sys_knee_ligament_major_p6	4	Minutaggio progressivo concordato per le prime tre partite	\N	\N	\N	\N	f
sys_knee_ligament_minor_p1_c1	sys_knee_ligament_minor_p1	1	Dolore a riposo entro 2/10	VAS a riposo	lte	2	/10	t
sys_knee_ligament_minor_p1_c2	sys_knee_ligament_minor_p1	2	Versamento assente o minimo	\N	\N	\N	\N	t
sys_knee_ligament_minor_p1_c3	sys_knee_ligament_minor_p1	3	Carico completo senza zoppia	\N	\N	\N	\N	t
sys_knee_ligament_minor_p2_c1	sys_knee_ligament_minor_p2	1	ROM attivo completo e simmetrico	\N	\N	\N	\N	t
sys_knee_ligament_minor_p2_c2	sys_knee_ligament_minor_p2	2	Forza isometrica del quadricipite almeno 80% del controlaterale	Quadricipite LSI	gte	80	%	t
sys_knee_ligament_minor_p2_c3	sys_knee_ligament_minor_p2	3	Corsa lineare senza dolore	\N	\N	\N	\N	t
sys_knee_ligament_minor_p3_c1	sys_knee_ligament_minor_p3	1	Single leg hop test almeno 90%	Single hop LSI	gte	90	%	t
sys_knee_ligament_minor_p3_c2	sys_knee_ligament_minor_p3	2	Cambi di direzione a intensita' piena senza dolore	\N	\N	\N	\N	t
sys_knee_ligament_minor_p3_c3	sys_knee_ligament_minor_p3	3	Drill di tiro e difesa completati	\N	\N	\N	\N	t
sys_knee_ligament_minor_p4_c1	sys_knee_ligament_minor_p4	1	Due allenamenti completi con contatto senza sintomi	Sedute complete	gte	2	sedute	t
sys_knee_ligament_minor_p4_c2	sys_knee_ligament_minor_p4	2	Nessun gonfiore post-allenamento	\N	\N	\N	\N	t
sys_knee_ligament_minor_p4_c3	sys_knee_ligament_minor_p4	3	Clearance medica	\N	\N	\N	\N	t
sys_knee_tendon_p1_c1	sys_knee_tendon_p1	1	Dolore durante il single leg decline squat entro 3/10	Decline squat VAS	lte	3	/10	t
sys_knee_tendon_p1_c2	sys_knee_tendon_p1	2	Nessun peggioramento del dolore il mattino successivo	\N	\N	\N	\N	t
sys_knee_tendon_p1_c3	sys_knee_tendon_p1	3	Tolleranza a 5 isometrie da 45 secondi	Isometrie	gte	5	serie	t
sys_knee_tendon_p1_c4	sys_knee_tendon_p1	4	Salti e pliometria sospesi in questa fase	\N	\N	\N	\N	t
sys_knee_tendon_p2_c1	sys_knee_tendon_p2	1	Progressione di forza lenta e pesante tollerata (3 sedute a settimana)	Sedute forza	gte	3	sedute/sett	t
sys_knee_tendon_p2_c2	sys_knee_tendon_p2	2	Forza del quadricipite almeno 80% del controlaterale	Quadricipite LSI	gte	80	%	t
sys_knee_tendon_p2_c3	sys_knee_tendon_p2	3	VISA-P almeno 70	VISA-P	gte	70	punti	t
sys_knee_tendon_p2_c4	sys_knee_tendon_p2	4	Dolore durante l'esercizio stabilmente entro 3/10	VAS durante esercizio	lte	3	/10	t
sys_knee_tendon_p3_c1	sys_knee_tendon_p3	1	Salti bipodalici e monopodalici senza aumento del dolore	\N	\N	\N	\N	t
sys_knee_tendon_p3_c2	sys_knee_tendon_p3	2	Atterraggio controllato, senza valgo dinamico	\N	\N	\N	\N	t
sys_knee_tendon_p3_c3	sys_knee_tendon_p3	3	VISA-P almeno 80	VISA-P	gte	80	punti	t
sys_knee_tendon_p3_c4	sys_knee_tendon_p3	4	Countermovement jump almeno 90% del controlaterale	CMJ LSI	gte	90	%	f
sys_knee_tendon_p4_c1	sys_knee_tendon_p4	1	Allenamento di tiro e rimbalzo a volume pieno senza reazione	\N	\N	\N	\N	t
sys_knee_tendon_p4_c2	sys_knee_tendon_p4	2	Nessun peggioramento mattutino dopo le sedute con salti	\N	\N	\N	\N	t
sys_knee_tendon_p4_c3	sys_knee_tendon_p4	3	Forza del quadricipite almeno 90%	Quadricipite LSI	gte	90	%	t
sys_knee_tendon_p5_c1	sys_knee_tendon_p5	1	Due allenamenti completi con la squadra senza reazione	\N	\N	\N	\N	t
sys_knee_tendon_p5_c2	sys_knee_tendon_p5	2	VISA-P almeno 85	VISA-P	gte	85	punti	t
sys_knee_tendon_p5_c3	sys_knee_tendon_p5	3	Piano di gestione del carico concordato per le settimane successive	\N	\N	\N	\N	f
sys_knee_generic_p1_c1	sys_knee_generic_p1	1	Dolore a riposo entro 2/10	VAS a riposo	lte	2	/10	t
sys_knee_generic_p1_c2	sys_knee_generic_p1	2	Versamento assente o minimo	\N	\N	\N	\N	t
sys_knee_generic_p1_c3	sys_knee_generic_p1	3	Estensione completa	\N	\N	\N	\N	t
sys_knee_generic_p2_c1	sys_knee_generic_p2	1	Flessione attiva almeno 125 gradi	Flessione attiva	gte	125	gradi	t
sys_knee_generic_p2_c2	sys_knee_generic_p2	2	Forza del quadricipite almeno 75% del controlaterale	Quadricipite LSI	gte	75	%	t
sys_knee_generic_p2_c3	sys_knee_generic_p2	3	Nessun versamento dopo il carico	\N	\N	\N	\N	t
sys_knee_generic_p3_c1	sys_knee_generic_p3	1	Corsa lineare 20 minuti senza dolore	\N	\N	\N	\N	t
sys_knee_generic_p3_c2	sys_knee_generic_p3	2	Single leg hop test almeno 85%	Single hop LSI	gte	85	%	t
sys_knee_generic_p3_c3	sys_knee_generic_p3	3	Cambi di direzione progressivi senza dolore	\N	\N	\N	\N	t
sys_knee_generic_p4_c1	sys_knee_generic_p4	1	Forza del quadricipite almeno 90%	Quadricipite LSI	gte	90	%	t
sys_knee_generic_p4_c2	sys_knee_generic_p4	2	Drill tecnici completati al 100% di intensita'	\N	\N	\N	\N	t
sys_knee_generic_p4_c3	sys_knee_generic_p4	3	Nessun versamento nelle 24 h successive	\N	\N	\N	\N	t
sys_knee_generic_p5_c1	sys_knee_generic_p5	1	Due allenamenti completi con contatto senza sintomi	Sedute complete	gte	2	sedute	t
sys_knee_generic_p5_c2	sys_knee_generic_p5	2	Clearance medica	\N	\N	\N	\N	t
sys_ankle_ligament_major_p1_c1	sys_ankle_ligament_major_p1	1	Dolore a riposo entro 2/10	VAS a riposo	lte	2	/10	t
sys_ankle_ligament_major_p1_c2	sys_ankle_ligament_major_p1	2	Edema in riduzione, differenza di circonferenza sotto 1 cm	Differenza malleolare	lte	1	cm	t
sys_ankle_ligament_major_p1_c3	sys_ankle_ligament_major_p1	3	Carico completo senza stampelle e senza zoppia	\N	\N	\N	\N	t
sys_ankle_ligament_major_p2_c1	sys_ankle_ligament_major_p2	1	Weight bearing lunge test: differenza sotto 2 cm	WBLT differenza	lte	2	cm	t
sys_ankle_ligament_major_p2_c2	sys_ankle_ligament_major_p2	2	Forza degli eversori almeno 80% del controlaterale	Eversori LSI	gte	80	%	t
sys_ankle_ligament_major_p2_c3	sys_ankle_ligament_major_p2	3	Appoggio monopodalico a occhi chiusi 30 secondi	Equilibrio occhi chiusi	gte	30	secondi	t
sys_ankle_ligament_major_p2_c4	sys_ankle_ligament_major_p2	4	Salita sulle punte monopodalica: 20 ripetizioni	Heel raise	gte	20	ripetizioni	t
sys_ankle_ligament_major_p3_c1	sys_ankle_ligament_major_p3	1	Corsa lineare 20 minuti senza dolore	\N	\N	\N	\N	t
sys_ankle_ligament_major_p3_c2	sys_ankle_ligament_major_p3	2	Y-Balance arto inferiore: differenza sotto 4 cm	Y-Balance ANT	lte	4	cm	t
sys_ankle_ligament_major_p3_c3	sys_ankle_ligament_major_p3	3	Single leg hop test almeno 90%	Single hop LSI	gte	90	%	t
sys_ankle_ligament_major_p3_c4	sys_ankle_ligament_major_p3	4	Atterraggio monopodalico controllato	\N	\N	\N	\N	t
sys_ankle_ligament_major_p4_c1	sys_ankle_ligament_major_p4	1	Cambi di direzione, arresti e scivolamenti a intensita' piena	\N	\N	\N	\N	t
sys_ankle_ligament_major_p4_c2	sys_ankle_ligament_major_p4	2	CAIT almeno 24	CAIT	gte	24	punti	t
sys_ankle_ligament_major_p4_c3	sys_ankle_ligament_major_p4	3	Drill di rimbalzo e contrasto senza apprensione	\N	\N	\N	\N	t
sys_ankle_ligament_major_p4_c4	sys_ankle_ligament_major_p4	4	Taping o cavigliera concordati per il rientro	\N	\N	\N	\N	f
sys_ankle_ligament_major_p5_c1	sys_ankle_ligament_major_p5	1	Due allenamenti completi con contatto senza sintomi	Sedute complete	gte	2	sedute	t
sys_ankle_ligament_major_p5_c2	sys_ankle_ligament_major_p5	2	Nessun gonfiore serale dopo l'allenamento	\N	\N	\N	\N	t
sys_ankle_ligament_major_p5_c3	sys_ankle_ligament_major_p5	3	Clearance medica	\N	\N	\N	\N	t
sys_ankle_ligament_minor_p1_c1	sys_ankle_ligament_minor_p1	1	Dolore a riposo entro 2/10	VAS a riposo	lte	2	/10	t
sys_ankle_ligament_minor_p1_c2	sys_ankle_ligament_minor_p1	2	Carico completo senza zoppia	\N	\N	\N	\N	t
sys_ankle_ligament_minor_p2_c1	sys_ankle_ligament_minor_p2	1	Weight bearing lunge test: differenza sotto 2 cm	WBLT differenza	lte	2	cm	t
sys_ankle_ligament_minor_p2_c2	sys_ankle_ligament_minor_p2	2	Appoggio monopodalico a occhi chiusi 30 secondi	Equilibrio occhi chiusi	gte	30	secondi	t
sys_ankle_ligament_minor_p3_c1	sys_ankle_ligament_minor_p3	1	Single leg hop test almeno 90%	Single hop LSI	gte	90	%	t
sys_ankle_ligament_minor_p3_c2	sys_ankle_ligament_minor_p3	2	Cambi di direzione a intensita' piena senza dolore	\N	\N	\N	\N	t
sys_ankle_ligament_minor_p4_c1	sys_ankle_ligament_minor_p4	1	Un allenamento completo senza sintomi	\N	\N	\N	\N	t
sys_ankle_ligament_minor_p4_c2	sys_ankle_ligament_minor_p4	2	CAIT almeno 24	CAIT	gte	24	punti	f
sys_ankle_generic_p1_c1	sys_ankle_generic_p1	1	Dolore a riposo entro 2/10	VAS a riposo	lte	2	/10	t
sys_ankle_generic_p1_c2	sys_ankle_generic_p1	2	Carico completo senza zoppia	\N	\N	\N	\N	t
sys_ankle_generic_p2_c1	sys_ankle_generic_p2	1	Weight bearing lunge test: differenza sotto 2 cm	WBLT differenza	lte	2	cm	t
sys_ankle_generic_p2_c2	sys_ankle_generic_p2	2	Salita sulle punte monopodalica: 20 ripetizioni	Heel raise	gte	20	ripetizioni	t
sys_ankle_generic_p3_c1	sys_ankle_generic_p3	1	Corsa lineare 20 minuti senza dolore	\N	\N	\N	\N	t
sys_ankle_generic_p3_c2	sys_ankle_generic_p3	2	Single leg hop test almeno 90%	Single hop LSI	gte	90	%	t
sys_ankle_generic_p4_c1	sys_ankle_generic_p4	1	Cambi di direzione e arresti a intensita' piena	\N	\N	\N	\N	t
sys_ankle_generic_p4_c2	sys_ankle_generic_p4	2	Drill di squadra completati	\N	\N	\N	\N	t
sys_ankle_generic_p5_c1	sys_ankle_generic_p5	1	Due allenamenti completi senza sintomi	Sedute complete	gte	2	sedute	t
sys_ankle_generic_p5_c2	sys_ankle_generic_p5	2	Clearance medica	\N	\N	\N	\N	t
sys_hamstring_muscular_p1_c1	sys_hamstring_muscular_p1	1	Cammino senza zoppia	\N	\N	\N	\N	t
sys_hamstring_muscular_p1_c2	sys_hamstring_muscular_p1	2	Dolore alla palpazione in riduzione	\N	\N	\N	\N	t
sys_hamstring_muscular_p1_c3	sys_hamstring_muscular_p1	3	Contrazione isometrica submassimale indolore	\N	\N	\N	\N	t
sys_hamstring_muscular_p2_c1	sys_hamstring_muscular_p2	1	Isometrica a 90/90 senza dolore	\N	\N	\N	\N	t
sys_hamstring_muscular_p2_c2	sys_hamstring_muscular_p2	2	Forza isometrica almeno 80% del controlaterale	Isometrica LSI	gte	80	%	t
sys_hamstring_muscular_p2_c3	sys_hamstring_muscular_p2	3	Corsa a intensita' bassa senza dolore	\N	\N	\N	\N	t
sys_hamstring_muscular_p2_c4	sys_hamstring_muscular_p2	4	Nessun dolore alla palpazione a riposo	\N	\N	\N	\N	t
sys_hamstring_muscular_p3_c1	sys_hamstring_muscular_p3	1	Nordic hamstring exercise tollerato senza dolore	\N	\N	\N	\N	t
sys_hamstring_muscular_p3_c2	sys_hamstring_muscular_p3	2	Forza eccentrica almeno 90% del controlaterale	Eccentrica LSI	gte	90	%	t
sys_hamstring_muscular_p3_c3	sys_hamstring_muscular_p3	3	Corsa all'80% della velocita' massimale senza sintomi	Velocita' raggiunta	gte	80	%	t
sys_hamstring_muscular_p4_c1	sys_hamstring_muscular_p4	1	Askling H-test negativo (nessuna apprensione)	\N	\N	\N	\N	t
sys_hamstring_muscular_p4_c2	sys_hamstring_muscular_p4	2	Sprint alla velocita' massimale del pre-infortunio	Velocita' raggiunta	gte	95	%	t
sys_hamstring_muscular_p4_c3	sys_hamstring_muscular_p4	3	Forza isometrica a lunghezza estesa almeno 95%	Isometrica LSI	gte	95	%	t
sys_hamstring_muscular_p4_c4	sys_hamstring_muscular_p4	4	Contropiede, arresti e ripartenze a intensita' piena	\N	\N	\N	\N	t
sys_hamstring_muscular_p5_c1	sys_hamstring_muscular_p5	1	Due allenamenti completi senza sintomi	Sedute complete	gte	2	sedute	t
sys_hamstring_muscular_p5_c2	sys_hamstring_muscular_p5	2	Nessun dolore alla palpazione dopo l'allenamento	\N	\N	\N	\N	t
sys_hamstring_muscular_p5_c3	sys_hamstring_muscular_p5	3	Clearance medica	\N	\N	\N	\N	t
sys_calf_muscular_p1_c1	sys_calf_muscular_p1	1	Cammino senza zoppia	\N	\N	\N	\N	t
sys_calf_muscular_p1_c2	sys_calf_muscular_p1	2	Salita bipodalica sulle punte indolore	\N	\N	\N	\N	t
sys_calf_muscular_p2_c1	sys_calf_muscular_p2	1	Salita monopodalica sulle punte: almeno 15 ripetizioni	Heel raise	gte	15	ripetizioni	t
sys_calf_muscular_p2_c2	sys_calf_muscular_p2	2	Corsa a intensita' bassa senza dolore	\N	\N	\N	\N	t
sys_calf_muscular_p2_c3	sys_calf_muscular_p2	3	Nessun dolore alla palpazione a riposo	\N	\N	\N	\N	t
sys_calf_muscular_p3_c1	sys_calf_muscular_p3	1	Salita monopodalica sulle punte: almeno 25 ripetizioni	Heel raise	gte	25	ripetizioni	t
sys_calf_muscular_p3_c2	sys_calf_muscular_p3	2	Hop test monopodalico almeno 90%	Single hop LSI	gte	90	%	t
sys_calf_muscular_p3_c3	sys_calf_muscular_p3	3	Corsa all'85% della velocita' massimale senza sintomi	Velocita' raggiunta	gte	85	%	t
sys_calf_muscular_p4_c1	sys_calf_muscular_p4	1	Sprint, arresti e cambi di direzione a intensita' piena	\N	\N	\N	\N	t
sys_calf_muscular_p4_c2	sys_calf_muscular_p4	2	Volume di salti da allenamento tollerato	\N	\N	\N	\N	t
sys_calf_muscular_p5_c1	sys_calf_muscular_p5	1	Due allenamenti completi senza sintomi	Sedute complete	gte	2	sedute	t
sys_calf_muscular_p5_c2	sys_calf_muscular_p5	2	Clearance medica	\N	\N	\N	\N	t
sys_quadriceps_muscular_p1_c1	sys_quadriceps_muscular_p1	1	Cammino senza zoppia	\N	\N	\N	\N	t
sys_quadriceps_muscular_p1_c2	sys_quadriceps_muscular_p1	2	Contrazione isometrica submassimale indolore	\N	\N	\N	\N	t
sys_quadriceps_muscular_p1_c3	sys_quadriceps_muscular_p1	3	Flessione passiva del ginocchio in progressione	\N	\N	\N	\N	t
sys_quadriceps_muscular_p2_c1	sys_quadriceps_muscular_p2	1	Forza isometrica almeno 80% del controlaterale	Quadricipite LSI	gte	80	%	t
sys_quadriceps_muscular_p2_c2	sys_quadriceps_muscular_p2	2	Squat monopodalico controllato senza dolore	\N	\N	\N	\N	t
sys_quadriceps_muscular_p2_c3	sys_quadriceps_muscular_p2	3	Corsa a intensita' bassa senza dolore	\N	\N	\N	\N	t
sys_quadriceps_muscular_p3_c1	sys_quadriceps_muscular_p3	1	Forza almeno 90% del controlaterale	Quadricipite LSI	gte	90	%	t
sys_quadriceps_muscular_p3_c2	sys_quadriceps_muscular_p3	2	Test di allungamento (Ely) senza dolore	\N	\N	\N	\N	t
sys_quadriceps_muscular_p3_c3	sys_quadriceps_muscular_p3	3	Salti e atterraggi controllati senza sintomi	\N	\N	\N	\N	t
sys_quadriceps_muscular_p4_c1	sys_quadriceps_muscular_p4	1	Sprint a intensita' piena senza dolore	\N	\N	\N	\N	t
sys_quadriceps_muscular_p4_c2	sys_quadriceps_muscular_p4	2	Drill tecnici e difensivi completati	\N	\N	\N	\N	t
sys_quadriceps_muscular_p5_c1	sys_quadriceps_muscular_p5	1	Due allenamenti completi senza sintomi	Sedute complete	gte	2	sedute	t
sys_quadriceps_muscular_p5_c2	sys_quadriceps_muscular_p5	2	Clearance medica	\N	\N	\N	\N	t
sys_groin_any_p1_c1	sys_groin_any_p1	1	Cammino senza dolore	\N	\N	\N	\N	t
sys_groin_any_p1_c2	sys_groin_any_p1	2	Squeeze test submassimale tollerato	\N	\N	\N	\N	t
sys_groin_any_p2_c1	sys_groin_any_p2	1	Squeeze test a 45 gradi almeno 75% del valore atteso	Squeeze test	gte	75	%	t
sys_groin_any_p2_c2	sys_groin_any_p2	2	Corsa lineare senza dolore	\N	\N	\N	\N	t
sys_groin_any_p2_c3	sys_groin_any_p2	3	Nessun dolore inguinale al risveglio	\N	\N	\N	\N	t
sys_groin_any_p3_c1	sys_groin_any_p3	1	Copenhagen adduction tollerato per 3 serie	Copenhagen	gte	3	serie	t
sys_groin_any_p3_c2	sys_groin_any_p3	2	Squeeze test almeno 90%	Squeeze test	gte	90	%	t
sys_groin_any_p3_c3	sys_groin_any_p3	3	Cambi di direzione a intensita' progressiva senza dolore	\N	\N	\N	\N	t
sys_groin_any_p4_c1	sys_groin_any_p4	1	Scivolamenti difensivi e arresti a intensita' piena	\N	\N	\N	\N	t
sys_groin_any_p4_c2	sys_groin_any_p4	2	Nessun dolore nelle 24 h successive alle sedute intense	\N	\N	\N	\N	t
sys_groin_any_p4_c3	sys_groin_any_p4	3	HAGOS sport almeno 80	HAGOS sport	gte	80	punti	f
sys_groin_any_p5_c1	sys_groin_any_p5	1	Due allenamenti completi senza sintomi	Sedute complete	gte	2	sedute	t
sys_groin_any_p5_c2	sys_groin_any_p5	2	Clearance medica	\N	\N	\N	\N	t
sys_lower_limb_muscular_p1_c1	sys_lower_limb_muscular_p1	1	Cammino senza zoppia	\N	\N	\N	\N	t
sys_lower_limb_muscular_p1_c2	sys_lower_limb_muscular_p1	2	Contrazione isometrica submassimale indolore	\N	\N	\N	\N	t
sys_lower_limb_muscular_p2_c1	sys_lower_limb_muscular_p2	1	Forza isometrica almeno 80% del controlaterale	Forza LSI	gte	80	%	t
sys_lower_limb_muscular_p2_c2	sys_lower_limb_muscular_p2	2	Corsa a intensita' bassa senza dolore	\N	\N	\N	\N	t
sys_lower_limb_muscular_p3_c1	sys_lower_limb_muscular_p3	1	Forza almeno 90% del controlaterale	Forza LSI	gte	90	%	t
sys_lower_limb_muscular_p3_c2	sys_lower_limb_muscular_p3	2	Corsa all'85% della velocita' massimale senza sintomi	Velocita' raggiunta	gte	85	%	t
sys_lower_limb_muscular_p4_c1	sys_lower_limb_muscular_p4	1	Cambi di direzione, arresti e salti a intensita' piena	\N	\N	\N	\N	t
sys_lower_limb_muscular_p4_c2	sys_lower_limb_muscular_p4	2	Drill di squadra completati	\N	\N	\N	\N	t
sys_lower_limb_muscular_p5_c1	sys_lower_limb_muscular_p5	1	Due allenamenti completi senza sintomi	Sedute complete	gte	2	sedute	t
sys_lower_limb_muscular_p5_c2	sys_lower_limb_muscular_p5	2	Clearance medica	\N	\N	\N	\N	t
sys_shoulder_instability_p1_c1	sys_shoulder_instability_p1	1	Dolore a riposo entro 2/10	VAS a riposo	lte	2	/10	t
sys_shoulder_instability_p1_c2	sys_shoulder_instability_p1	2	ROM passivo entro i limiti indicati dal medico, senza apprensione	\N	\N	\N	\N	t
sys_shoulder_instability_p1_c3	sys_shoulder_instability_p1	3	Controllo scapolare in posizione neutra	\N	\N	\N	\N	t
sys_shoulder_instability_p1_c4	sys_shoulder_instability_p1	4	Nessun deficit neurologico all'arto	\N	\N	\N	\N	t
sys_shoulder_instability_p2_c1	sys_shoulder_instability_p2	1	ROM attivo completo e simmetrico al controlaterale	\N	\N	\N	\N	t
sys_shoulder_instability_p2_c2	sys_shoulder_instability_p2	2	Extrarotazione: forza almeno 70% del controlaterale	Extrarotatori LSI	gte	70	%	t
sys_shoulder_instability_p2_c3	sys_shoulder_instability_p2	3	Rapporto extrarotatori/intrarotatori almeno 0.65	ER/IR ratio	gte	0.65	rapporto	t
sys_shoulder_instability_p2_c4	sys_shoulder_instability_p2	4	Nessun dolore notturno	\N	\N	\N	\N	t
sys_shoulder_instability_p3_c1	sys_shoulder_instability_p3	1	Extrarotazione: forza almeno 85% del controlaterale	Extrarotatori LSI	gte	85	%	t
sys_shoulder_instability_p3_c2	sys_shoulder_instability_p3	2	CKCUEST almeno 21 tocchi	CKCUEST	gte	21	tocchi	t
sys_shoulder_instability_p3_c3	sys_shoulder_instability_p3	3	Y-Balance arto superiore: differenza sotto 4 cm	Y-Balance UQ	lte	4	cm	f
sys_shoulder_instability_p3_c4	sys_shoulder_instability_p3	4	Lavoro sopra la testa senza dolore	\N	\N	\N	\N	t
sys_shoulder_instability_p4_c1	sys_shoulder_instability_p4	1	Test di apprensione negativo	\N	\N	\N	\N	t
sys_shoulder_instability_p4_c2	sys_shoulder_instability_p4	2	Extrarotazione: forza almeno 90% del controlaterale	Extrarotatori LSI	gte	90	%	t
sys_shoulder_instability_p4_c3	sys_shoulder_instability_p4	3	Passaggi e tiri a distanza e intensita' di gara senza dolore	\N	\N	\N	\N	t
sys_shoulder_instability_p4_c4	sys_shoulder_instability_p4	4	Cadute e appoggi controllati sul tappetino	\N	\N	\N	\N	t
sys_shoulder_instability_p5_c1	sys_shoulder_instability_p5	1	Contrasti e lotta a rimbalzo senza apprensione	\N	\N	\N	\N	t
sys_shoulder_instability_p5_c2	sys_shoulder_instability_p5	2	Due allenamenti completi con contatto senza sintomi	Sedute complete	gte	2	sedute	t
sys_shoulder_instability_p5_c3	sys_shoulder_instability_p5	3	Clearance medica firmata	\N	\N	\N	\N	t
sys_shoulder_tendon_p1_c1	sys_shoulder_tendon_p1	1	Dolore notturno assente	\N	\N	\N	\N	t
sys_shoulder_tendon_p1_c2	sys_shoulder_tendon_p1	2	Dolore durante l'esercizio entro 3/10	VAS durante esercizio	lte	3	/10	t
sys_shoulder_tendon_p1_c3	sys_shoulder_tendon_p1	3	ROM attivo mantenuto, lavoro sopra la testa sospeso	\N	\N	\N	\N	t
sys_shoulder_tendon_p2_c1	sys_shoulder_tendon_p2	1	Isometrie di extrarotazione tollerate a carico progressivo	\N	\N	\N	\N	t
sys_shoulder_tendon_p2_c2	sys_shoulder_tendon_p2	2	Controllo scapolare corretto nei movimenti sopra la testa	\N	\N	\N	\N	t
sys_shoulder_tendon_p2_c3	sys_shoulder_tendon_p2	3	Extrarotazione: forza almeno 80% del controlaterale	Extrarotatori LSI	gte	80	%	t
sys_shoulder_tendon_p3_c1	sys_shoulder_tendon_p3	1	Extrarotazione: forza almeno 90% del controlaterale	Extrarotatori LSI	gte	90	%	t
sys_shoulder_tendon_p3_c2	sys_shoulder_tendon_p3	2	Rapporto extrarotatori/intrarotatori almeno 0.68	ER/IR ratio	gte	0.68	rapporto	t
sys_shoulder_tendon_p3_c3	sys_shoulder_tendon_p3	3	CKCUEST almeno 21 tocchi	CKCUEST	gte	21	tocchi	f
sys_shoulder_tendon_p4_c1	sys_shoulder_tendon_p4	1	Volume di tiro da allenamento senza reazione il giorno dopo	\N	\N	\N	\N	t
sys_shoulder_tendon_p4_c2	sys_shoulder_tendon_p4	2	Passaggi lunghi a intensita' piena senza dolore	\N	\N	\N	\N	t
sys_shoulder_tendon_p5_c1	sys_shoulder_tendon_p5	1	Due allenamenti completi senza sintomi	Sedute complete	gte	2	sedute	t
sys_shoulder_tendon_p5_c2	sys_shoulder_tendon_p5	2	Piano di gestione del volume di tiro concordato	\N	\N	\N	\N	f
sys_shoulder_generic_p1_c1	sys_shoulder_generic_p1	1	Guarigione o consolidazione documentata dal medico (se frattura o lesione strutturale)	\N	\N	\N	\N	t
sys_shoulder_generic_p1_c2	sys_shoulder_generic_p1	2	Dolore a riposo entro 2/10	VAS a riposo	lte	2	/10	t
sys_shoulder_generic_p1_c3	sys_shoulder_generic_p1	3	Nessun dolore notturno	\N	\N	\N	\N	t
sys_shoulder_generic_p2_c1	sys_shoulder_generic_p2	1	ROM attivo completo e simmetrico	\N	\N	\N	\N	t
sys_shoulder_generic_p2_c2	sys_shoulder_generic_p2	2	Extrarotazione: forza almeno 80% del controlaterale	Extrarotatori LSI	gte	80	%	t
sys_shoulder_generic_p2_c3	sys_shoulder_generic_p2	3	Controllo scapolare corretto	\N	\N	\N	\N	t
sys_shoulder_generic_p3_c1	sys_shoulder_generic_p3	1	Extrarotazione: forza almeno 90% del controlaterale	Extrarotatori LSI	gte	90	%	t
sys_shoulder_generic_p3_c2	sys_shoulder_generic_p3	2	CKCUEST almeno 21 tocchi	CKCUEST	gte	21	tocchi	t
sys_shoulder_generic_p4_c1	sys_shoulder_generic_p4	1	Tiri e passaggi a intensita' di gara senza dolore	\N	\N	\N	\N	t
sys_shoulder_generic_p4_c2	sys_shoulder_generic_p4	2	Contrasti e appoggi controllati	\N	\N	\N	\N	t
sys_shoulder_generic_p5_c1	sys_shoulder_generic_p5	1	Due allenamenti completi con contatto senza sintomi	Sedute complete	gte	2	sedute	t
sys_shoulder_generic_p5_c2	sys_shoulder_generic_p5	2	Clearance medica	\N	\N	\N	\N	t
sys_upper_limb_bone_p1_c1	sys_upper_limb_bone_p1	1	Consolidazione documentata dal controllo radiografico	\N	\N	\N	\N	t
sys_upper_limb_bone_p1_c2	sys_upper_limb_bone_p1	2	Immobilizzazione rispettata per il tempo indicato	\N	\N	\N	\N	t
sys_upper_limb_bone_p1_c3	sys_upper_limb_bone_p1	3	Nessun dolore alla palpazione della sede	\N	\N	\N	\N	t
sys_upper_limb_bone_p1_c4	sys_upper_limb_bone_p1	4	Lavoro cardiovascolare e di arto inferiore mantenuto in questa fase	\N	\N	\N	\N	f
sys_upper_limb_bone_p2_c1	sys_upper_limb_bone_p2	1	ROM attivo completo e simmetrico	\N	\N	\N	\N	t
sys_upper_limb_bone_p2_c2	sys_upper_limb_bone_p2	2	Forza di presa almeno 80% del controlaterale	Hand grip LSI	gte	80	%	t
sys_upper_limb_bone_p2_c3	sys_upper_limb_bone_p2	3	Nessun dolore nelle attivita' quotidiane	\N	\N	\N	\N	t
sys_upper_limb_bone_p3_c1	sys_upper_limb_bone_p3	1	Forza di presa almeno 90% del controlaterale	Hand grip LSI	gte	90	%	t
sys_upper_limb_bone_p3_c2	sys_upper_limb_bone_p3	2	Palleggio, presa e passaggio senza dolore	\N	\N	\N	\N	t
sys_upper_limb_bone_p3_c3	sys_upper_limb_bone_p3	3	Tiro a distanza di gara senza dolore	\N	\N	\N	\N	t
sys_upper_limb_bone_p3_c4	sys_upper_limb_bone_p3	4	Appoggio in carico sull'arto (push-up) tollerato	\N	\N	\N	\N	t
sys_upper_limb_bone_p4_c1	sys_upper_limb_bone_p4	1	Contrasti e lotta a rimbalzo senza dolore	\N	\N	\N	\N	t
sys_upper_limb_bone_p4_c2	sys_upper_limb_bone_p4	2	Due allenamenti completi con contatto senza sintomi	Sedute complete	gte	2	sedute	t
sys_upper_limb_bone_p4_c3	sys_upper_limb_bone_p4	3	Tutore o taping di protezione concordato per il rientro	\N	\N	\N	\N	f
sys_upper_limb_bone_p4_c4	sys_upper_limb_bone_p4	4	Clearance medica	\N	\N	\N	\N	t
sys_spine_generic_p1_c1	sys_spine_generic_p1	1	Nessun deficit neurologico (forza, sensibilita', riflessi)	\N	\N	\N	\N	t
sys_spine_generic_p1_c2	sys_spine_generic_p1	2	Guarigione o consolidazione documentata dal medico (se lesione ossea)	\N	\N	\N	\N	t
sys_spine_generic_p1_c3	sys_spine_generic_p1	3	Dolore a riposo entro 3/10	VAS a riposo	lte	3	/10	t
sys_spine_generic_p1_c4	sys_spine_generic_p1	4	Cammino e attivita' quotidiane senza dolore irradiato	\N	\N	\N	\N	t
sys_spine_generic_p2_c1	sys_spine_generic_p2	1	Plank frontale 60 secondi con tecnica corretta	Plank	gte	60	secondi	t
sys_spine_generic_p2_c2	sys_spine_generic_p2	2	Side plank 45 secondi per lato	Side plank	gte	45	secondi	t
sys_spine_generic_p2_c3	sys_spine_generic_p2	3	ROM lombare funzionale senza dolore	\N	\N	\N	\N	t
sys_spine_generic_p3_c1	sys_spine_generic_p3	1	Squat e stacco a carico progressivo con tecnica corretta	\N	\N	\N	\N	t
sys_spine_generic_p3_c2	sys_spine_generic_p3	2	Corsa 20 minuti senza dolore	\N	\N	\N	\N	t
sys_spine_generic_p3_c3	sys_spine_generic_p3	3	Biering-Sorensen almeno 90 secondi	Biering-Sorensen	gte	90	secondi	f
sys_spine_generic_p4_c1	sys_spine_generic_p4	1	Salti, atterraggi e rotazioni a intensita' piena senza dolore	\N	\N	\N	\N	t
sys_spine_generic_p4_c2	sys_spine_generic_p4	2	Drill difensivi e cambi di direzione completati	\N	\N	\N	\N	t
sys_spine_generic_p4_c3	sys_spine_generic_p4	3	Nessuna recrudescenza nelle 24 h successive	\N	\N	\N	\N	t
sys_spine_generic_p5_c1	sys_spine_generic_p5	1	Due allenamenti completi con contatto senza sintomi	Sedute complete	gte	2	sedute	t
sys_spine_generic_p5_c2	sys_spine_generic_p5	2	Clearance medica	\N	\N	\N	\N	t
sys_bone_generic_p1_c1	sys_bone_generic_p1	1	Consolidazione documentata dal controllo radiografico	\N	\N	\N	\N	t
sys_bone_generic_p1_c2	sys_bone_generic_p1	2	Nessun dolore alla palpazione della sede	\N	\N	\N	\N	t
sys_bone_generic_p1_c3	sys_bone_generic_p1	3	Carico progressivo autorizzato dal medico	\N	\N	\N	\N	t
sys_bone_generic_p2_c1	sys_bone_generic_p2	1	ROM attivo completo e simmetrico	\N	\N	\N	\N	t
sys_bone_generic_p2_c2	sys_bone_generic_p2	2	Forza almeno 80% del controlaterale	Forza LSI	gte	80	%	t
sys_bone_generic_p3_c1	sys_bone_generic_p3	1	Forza almeno 90% del controlaterale	Forza LSI	gte	90	%	t
sys_bone_generic_p3_c2	sys_bone_generic_p3	2	Corsa e salti senza dolore	\N	\N	\N	\N	t
sys_bone_generic_p3_c3	sys_bone_generic_p3	3	Drill tecnici completati al 100% di intensita'	\N	\N	\N	\N	t
sys_bone_generic_p4_c1	sys_bone_generic_p4	1	Due allenamenti completi con contatto senza sintomi	Sedute complete	gte	2	sedute	t
sys_bone_generic_p4_c2	sys_bone_generic_p4	2	Clearance medica firmata	\N	\N	\N	\N	t
sys_default_generic_p1_c1	sys_default_generic_p1	1	Dolore a riposo entro 2/10	VAS a riposo	lte	2	/10	t
sys_default_generic_p1_c2	sys_default_generic_p1	2	Nessun segno di infiammazione acuta	\N	\N	\N	\N	t
sys_default_generic_p1_c3	sys_default_generic_p1	3	ROM passivo recuperato oltre il 70%	ROM passivo	gte	70	%	t
sys_default_generic_p2_c1	sys_default_generic_p2	1	Dolore nelle attivita' quotidiane entro 2/10	VAS quotidiano	lte	2	/10	t
sys_default_generic_p2_c2	sys_default_generic_p2	2	ROM attivo completo e simmetrico	\N	\N	\N	\N	t
sys_default_generic_p2_c3	sys_default_generic_p2	3	Forza isometrica almeno 70% del controlaterale	Forza LSI	gte	70	%	t
sys_default_generic_p3_c1	sys_default_generic_p3	1	Forza almeno 80% del controlaterale	Forza LSI	gte	80	%	t
sys_default_generic_p3_c2	sys_default_generic_p3	2	Corsa con cambi di direzione senza dolore	\N	\N	\N	\N	t
sys_default_generic_p3_c3	sys_default_generic_p3	3	Drill di basket non-contatto completati	\N	\N	\N	\N	t
sys_default_generic_p4_c1	sys_default_generic_p4	1	Forza almeno 90% del controlaterale	Forza LSI	gte	90	%	t
sys_default_generic_p4_c2	sys_default_generic_p4	2	Allenamento con contatto limitato senza dolore	\N	\N	\N	\N	t
sys_default_generic_p4_c3	sys_default_generic_p4	3	Drill sport-specifici al 100% di intensita'	\N	\N	\N	\N	t
sys_default_generic_p5_c1	sys_default_generic_p5	1	Due allenamenti completi con la squadra senza sintomi	Sedute complete	gte	2	sedute	t
sys_default_generic_p5_c2	sys_default_generic_p5	2	Nessuna reazione nelle 24 h successive	\N	\N	\N	\N	t
sys_default_generic_p5_c3	sys_default_generic_p5	3	Clearance medica firmata	\N	\N	\N	\N	t
\.


--
-- Data for Name: rtp_template_phases; Type: TABLE DATA; Schema: public; Owner: trainmind
--

COPY public.rtp_template_phases (id, "templateId", "order", name, goal, "minDays", "typicalDays") FROM stdin;
sys_knee_ligament_major_p1	sys_knee_ligament_major	1	Protezione e controllo dell'effusione	Spegnere infiammazione e dolore, riprendere l'estensione completa	7	14
sys_knee_ligament_major_p2	sys_knee_ligament_major	2	Recupero del ROM e della forza di base	Flessione completa, quadricipite oltre il 70%, nessuna reazione al carico	30	42
sys_knee_ligament_major_p3	sys_knee_ligament_major	3	Forza e ritorno alla corsa	Corsa lineare tollerata, quadricipite oltre l'80%	45	60
sys_knee_ligament_major_p4	sys_knee_ligament_major	4	Sport-specifico senza contatto	Cambi di direzione e gesto tecnico completo, batteria hop oltre il 90%	45	60
sys_knee_ligament_major_p5	sys_knee_ligament_major	5	Allenamento completo con la squadra	Contatto, carico pieno e disponibilita' psicologica	30	45
sys_knee_ligament_major_p6	sys_knee_ligament_major	6	Ritorno alla partita	Rientro graduale in gara con minutaggio concordato	21	30
sys_knee_ligament_minor_p1	sys_knee_ligament_minor	1	Controllo del dolore	Carico completo senza zoppia	2	5
sys_knee_ligament_minor_p2	sys_knee_ligament_minor	2	ROM e forza	ROM completo, quadricipite oltre l'80%	5	10
sys_knee_ligament_minor_p3	sys_knee_ligament_minor	3	Sport-specifico	Cambi di direzione e salti senza sintomi	5	10
sys_knee_ligament_minor_p4	sys_knee_ligament_minor	4	Rientro	Allenamento completo e gara	3	7
sys_knee_tendon_p1	sys_knee_tendon	1	Isometrie e riduzione del carico irritativo	Abbassare il dolore senza fermare il tendine	7	14
sys_knee_tendon_p2	sys_knee_tendon	2	Forza lenta e pesante	Costruire capacita' di carico del tendine	21	28
sys_knee_tendon_p3	sys_knee_tendon	3	Energy storage: pliometria progressiva	Reintrodurre salto e atterraggio	14	21
sys_knee_tendon_p4	sys_knee_tendon	4	Sport-specifico	Volume di salti da allenamento	10	14
sys_knee_tendon_p5	sys_knee_tendon	5	Rientro e gestione del carico	Gara con monitoraggio del volume di salti	7	14
sys_knee_generic_p1	sys_knee_generic	1	Protezione	Dolore e versamento sotto controllo	5	10
sys_knee_generic_p2	sys_knee_generic	2	ROM e forza	Flessione completa e quadricipite oltre il 75%	14	21
sys_knee_generic_p3	sys_knee_generic	3	Corsa e agilita'	Corsa e cambi di direzione senza sintomi	14	21
sys_knee_generic_p4	sys_knee_generic	4	Sport-specifico	Drill di squadra senza contatto	10	14
sys_knee_generic_p5	sys_knee_generic	5	Rientro	Allenamento completo e gara	7	10
sys_ankle_ligament_major_p1	sys_ankle_ligament_major	1	Protezione e carico	Carico completo senza zoppia	3	7
sys_ankle_ligament_major_p2	sys_ankle_ligament_major	2	ROM, forza e propriocezione	Dorsiflessione simmetrica e appoggio monopodalico stabile	10	14
sys_ankle_ligament_major_p3	sys_ankle_ligament_major	3	Corsa e salti	Corsa, salto e atterraggio senza dolore	10	14
sys_ankle_ligament_major_p4	sys_ankle_ligament_major	4	Sport-specifico	Cambi di direzione e gesto tecnico completo	7	12
sys_ankle_ligament_major_p5	sys_ankle_ligament_major	5	Rientro	Allenamento completo e gara	5	10
sys_ankle_ligament_minor_p1	sys_ankle_ligament_minor	1	Controllo del dolore	Carico completo	1	3
sys_ankle_ligament_minor_p2	sys_ankle_ligament_minor	2	ROM e propriocezione	Dorsiflessione simmetrica, equilibrio recuperato	3	5
sys_ankle_ligament_minor_p3	sys_ankle_ligament_minor	3	Corsa e salti	Salto e cambio di direzione senza dolore	3	5
sys_ankle_ligament_minor_p4	sys_ankle_ligament_minor	4	Rientro	Allenamento completo e gara	2	4
sys_ankle_generic_p1	sys_ankle_generic	1	Protezione	Dolore e gonfiore sotto controllo	3	7
sys_ankle_generic_p2	sys_ankle_generic	2	ROM e forza	Dorsiflessione simmetrica e forza recuperata	7	12
sys_ankle_generic_p3	sys_ankle_generic	3	Corsa e salti	Corsa e pliometria senza sintomi	7	12
sys_ankle_generic_p4	sys_ankle_generic	4	Sport-specifico	Gesto tecnico completo	5	10
sys_ankle_generic_p5	sys_ankle_generic	5	Rientro	Allenamento completo e gara	5	7
sys_hamstring_muscular_p1	sys_hamstring_muscular	1	Protezione	Cammino normale, dolore sotto controllo	3	5
sys_hamstring_muscular_p2	sys_hamstring_muscular	2	Forza e allungamento controllato	Recuperare forza a lunghezza crescente	7	12
sys_hamstring_muscular_p3	sys_hamstring_muscular	3	Eccentrico e corsa veloce	Tolleranza eccentrica e progressione della velocita'	10	14
sys_hamstring_muscular_p4	sys_hamstring_muscular	4	Velocita' massimale e sport-specifico	Sprint pieno e gesto di gara	7	12
sys_hamstring_muscular_p5	sys_hamstring_muscular	5	Rientro	Allenamento completo e gara	5	7
sys_calf_muscular_p1	sys_calf_muscular	1	Protezione	Cammino normale	3	5
sys_calf_muscular_p2	sys_calf_muscular	2	Forza	Capacita' di lavoro monopodalica	7	12
sys_calf_muscular_p3	sys_calf_muscular	3	Pliometria e velocita'	Salto e corsa veloce	7	12
sys_calf_muscular_p4	sys_calf_muscular	4	Sport-specifico	Gesto di gara completo	5	8
sys_calf_muscular_p5	sys_calf_muscular	5	Rientro	Allenamento completo e gara	4	6
sys_quadriceps_muscular_p1	sys_quadriceps_muscular	1	Protezione	Cammino normale e contrazione indolore	3	5
sys_quadriceps_muscular_p2	sys_quadriceps_muscular	2	Forza	Forza concentrica recuperata	7	12
sys_quadriceps_muscular_p3	sys_quadriceps_muscular	3	Eccentrico e pliometria	Tolleranza al carico eccentrico e al salto	7	14
sys_quadriceps_muscular_p4	sys_quadriceps_muscular	4	Sport-specifico	Sprint e cambi di direzione a intensita' piena	5	10
sys_quadriceps_muscular_p5	sys_quadriceps_muscular	5	Rientro	Allenamento completo e gara	4	6
sys_groin_any_p1	sys_groin_any	1	Controllo del dolore	Cammino e vita quotidiana senza dolore	3	7
sys_groin_any_p2	sys_groin_any	2	Forza isometrica	Recuperare forza degli adduttori	10	14
sys_groin_any_p3	sys_groin_any	3	Forza eccentrica e cambi di direzione	Copenhagen tollerato, cambi di direzione progressivi	10	14
sys_groin_any_p4	sys_groin_any	4	Sport-specifico	Scivolamenti difensivi e gesto di gara	7	10
sys_groin_any_p5	sys_groin_any	5	Rientro	Allenamento completo e gara	5	7
sys_lower_limb_muscular_p1	sys_lower_limb_muscular	1	Protezione	Cammino normale	3	5
sys_lower_limb_muscular_p2	sys_lower_limb_muscular	2	Forza	Forza oltre l'80% del controlaterale	7	12
sys_lower_limb_muscular_p3	sys_lower_limb_muscular	3	Eccentrico e velocita'	Carico eccentrico e corsa veloce	7	12
sys_lower_limb_muscular_p4	sys_lower_limb_muscular	4	Sport-specifico	Gesto di gara completo	5	10
sys_lower_limb_muscular_p5	sys_lower_limb_muscular	5	Rientro	Allenamento completo e gara	4	7
sys_shoulder_instability_p1	sys_shoulder_instability	1	Protezione e ROM protetto	Dolore sotto controllo, ROM nei limiti concessi	10	21
sys_shoulder_instability_p2	sys_shoulder_instability	2	ROM completo e forza di base	ROM simmetrico e cuffia oltre il 70%	21	30
sys_shoulder_instability_p3	sys_shoulder_instability	3	Forza e controllo in catena chiusa	Tenuta sopra la testa e in appoggio	21	30
sys_shoulder_instability_p4	sys_shoulder_instability	4	Sport-specifico senza contatto	Passaggio, tiro e rimbalzo a intensita' piena	14	21
sys_shoulder_instability_p5	sys_shoulder_instability	5	Contatto e rientro	Contrasti, rimbalzi e gara	10	14
sys_shoulder_tendon_p1	sys_shoulder_tendon	1	Riduzione del carico irritativo	Abbassare il dolore, mantenere il movimento	7	14
sys_shoulder_tendon_p2	sys_shoulder_tendon	2	Forza isometrica e controllo scapolare	Costruire tolleranza al carico	14	21
sys_shoulder_tendon_p3	sys_shoulder_tendon	3	Forza dinamica e lavoro sopra la testa	Riprendere il gesto sopra la testa	14	21
sys_shoulder_tendon_p4	sys_shoulder_tendon	4	Sport-specifico	Volume di tiro da allenamento	10	14
sys_shoulder_tendon_p5	sys_shoulder_tendon	5	Rientro e gestione del carico	Gara con volume di tiro monitorato	7	10
sys_shoulder_generic_p1	sys_shoulder_generic	1	Protezione	Dolore sotto controllo, guarigione documentata se struttura lesa	7	14
sys_shoulder_generic_p2	sys_shoulder_generic	2	ROM e forza di base	ROM simmetrico e cuffia oltre l'80%	14	21
sys_shoulder_generic_p3	sys_shoulder_generic	3	Forza e lavoro sopra la testa	Tenuta in catena chiusa e sopra la testa	14	21
sys_shoulder_generic_p4	sys_shoulder_generic	4	Sport-specifico	Tiro, passaggio e rimbalzo	10	14
sys_shoulder_generic_p5	sys_shoulder_generic	5	Rientro	Allenamento completo e gara	7	10
sys_upper_limb_bone_p1	sys_upper_limb_bone	1	Immobilizzazione e consolidazione	Rispettare i tempi biologici	21	30
sys_upper_limb_bone_p2	sys_upper_limb_bone	2	ROM e forza di presa	Recuperare articolarita' e presa	14	21
sys_upper_limb_bone_p3	sys_upper_limb_bone	3	Ball handling e carico	Rimettere la palla in mano	10	14
sys_upper_limb_bone_p4	sys_upper_limb_bone	4	Contatto e rientro	Contrasti e gara, con protezione se indicata	7	10
sys_spine_generic_p1	sys_spine_generic	1	Controllo del dolore	Escludere bandiere rosse, riprendere il movimento	5	10
sys_spine_generic_p2	sys_spine_generic	2	Controllo motorio e resistenza del tronco	Costruire tenuta del core	14	21
sys_spine_generic_p3	sys_spine_generic	3	Carico progressivo	Reintrodurre carico assiale e corsa	14	21
sys_spine_generic_p4	sys_spine_generic	4	Sport-specifico	Salto, atterraggio, rotazioni e contatto leggero	10	14
sys_spine_generic_p5	sys_spine_generic	5	Rientro	Allenamento completo e gara	7	10
sys_bone_generic_p1	sys_bone_generic	1	Consolidazione	Rispettare i tempi biologici	21	35
sys_bone_generic_p2	sys_bone_generic	2	ROM e forza	Recuperare articolarita' e forza di base	14	21
sys_bone_generic_p3	sys_bone_generic	3	Carico sportivo	Corsa, salto e gesto tecnico	14	21
sys_bone_generic_p4	sys_bone_generic	4	Contatto e rientro	Contatto pieno e gara	10	14
sys_default_generic_p1	sys_default_generic	1	Protezione	Dolore e infiammazione sotto controllo	5	10
sys_default_generic_p2	sys_default_generic	2	ROM e forza di base	ROM completo e forza oltre il 70%	10	14
sys_default_generic_p3	sys_default_generic	3	Carico e agilita'	Corsa e cambi di direzione	14	21
sys_default_generic_p4	sys_default_generic	4	Sport-specifico	Contatto limitato e intensita' piena	10	14
sys_default_generic_p5	sys_default_generic	5	Rientro	Allenamento completo e gara	7	10
\.


--
-- Data for Name: rtp_templates; Type: TABLE DATA; Schema: public; Owner: trainmind
--

COPY public.rtp_templates (id, "organizationId", code, name, description, "bodyZone", "bodyRegion", "injuryType", "severityMin", "severityMax", "isSystem", "isActive", "createdAt", "updatedAt") FROM stdin;
sys_knee_ligament_major	\N	knee_ligament_major	Ginocchio — lesione legamentosa maggiore (LCA/LCM di grado elevato)	Sei fasi su circa otto mesi. La forza del quadricipite e la batteria di hop test sono i due cancelli che contano; l'ACL-RSI misura la disponibilita' psicologica, che e' un predittore di re-infortunio quanto la forza.	knee	\N	ligament	3	5	t	t	2026-09-03 07:45:40.847	2026-09-03 07:45:40.847
sys_knee_ligament_minor	\N	knee_ligament_minor	Ginocchio — distorsione legamentosa lieve	Quattro fasi su circa un mese: LCM di grado I-II e distorsioni senza instabilita'.	knee	\N	ligament	1	2	t	t	2026-09-03 07:45:40.847	2026-09-03 07:45:40.847
sys_knee_tendon	\N	knee_tendon	Ginocchio — tendinopatia rotulea	Il dolore non deve sparire prima di caricare: si progredisce mantenendo il dolore entro 3/10 durante l'esercizio e senza peggioramento il mattino dopo. Il VISA-P e' il punteggio di riferimento.	knee	\N	tendon	\N	\N	t	t	2026-09-03 07:45:40.847	2026-09-03 07:45:40.847
sys_knee_generic	\N	knee_generic	Ginocchio — protocollo generico	Fallback di zona: meniscopatie, contusioni articolari e quadri non coperti dai protocolli specifici.	knee	\N	\N	\N	\N	t	t	2026-09-03 07:45:40.847	2026-09-03 07:45:40.847
sys_ankle_ligament_major	\N	ankle_ligament_major	Caviglia — distorsione di grado elevato	La distorsione di caviglia e' l'infortunio piu' frequente e quello con la recidiva piu' alta, quasi sempre per un rientro deciso sul dolore invece che sul controllo. Equilibrio monopodalico e CAIT sono i criteri che discriminano davvero.	ankle	\N	ligament	3	5	t	t	2026-09-03 07:45:40.847	2026-09-03 07:45:40.847
sys_ankle_ligament_minor	\N	ankle_ligament_minor	Caviglia — distorsione lieve	Quattro fasi su circa due settimane. Il criterio da non saltare resta l'equilibrio monopodalico.	ankle	\N	ligament	1	2	t	t	2026-09-03 07:45:40.847	2026-09-03 07:45:40.847
sys_ankle_generic	\N	ankle_generic	Caviglia — protocollo generico	Fallback di zona per quadri non legamentosi: contusioni, sovraccarichi, quadri articolari.	ankle	\N	\N	\N	\N	t	t	2026-09-03 07:45:40.847	2026-09-03 07:45:40.847
sys_hamstring_muscular	\N	hamstring_muscular	Ischiocrurali — lesione muscolare	La recidiva si gioca sulla forza a lunghezza estesa e sulla velocita' massimale: rientrare senza aver sprintato a velocita' piena e' il modo classico per rifarsi male. L'H-test di Askling e' il criterio che intercetta l'apprensione residua.	hamstring	\N	muscular	\N	\N	t	t	2026-09-03 07:45:40.847	2026-09-03 07:45:40.847
sys_calf_muscular	\N	calf_muscular	Polpaccio — lesione muscolare	Il criterio guida e' la capacita' di lavoro del tricipite surale: le salite sulle punte monopodaliche.	calf	\N	muscular	\N	\N	t	t	2026-09-03 07:45:40.847	2026-09-03 07:45:40.847
sys_quadriceps_muscular	\N	quadriceps_muscular	Quadricipite — lesione muscolare	Attenzione al retto femorale: e' biarticolare e va testato anche in allungamento, con l'anca estesa.	quadriceps	\N	muscular	\N	\N	t	t	2026-09-03 07:45:40.847	2026-09-03 07:45:40.847
sys_groin_any	\N	groin_any	Adduttori e inguine	Il test di riferimento e' lo squeeze test degli adduttori a 45 gradi; il Copenhagen adduction e' insieme esercizio e criterio di tolleranza.	groin	\N	\N	\N	\N	t	t	2026-09-03 07:45:40.847	2026-09-03 07:45:40.847
sys_lower_limb_muscular	\N	lower_limb_muscular	Arto inferiore — lesione muscolare (generico)	Fallback di regione per i muscoli senza protocollo dedicato: anca, ileopsoas, piede.	\N	lower_limb	muscular	\N	\N	t	t	2026-09-03 07:45:40.847	2026-09-03 07:45:40.847
sys_shoulder_instability	\N	shoulder_instability	Spalla — instabilita' e lesione capsulo-legamentosa	Qui i criteri non hanno nulla a che vedere con quelli di un arto inferiore: contano il controllo scapolare, il rapporto fra extrarotatori e intrarotatori e la tenuta in catena chiusa (CKCUEST). Il test di apprensione negativo e' il cancello per il contatto.	shoulder	\N	ligament	\N	\N	t	t	2026-09-03 07:45:40.847	2026-09-03 07:45:40.847
sys_shoulder_tendon	\N	shoulder_tendon	Spalla — tendinopatia della cuffia	Progressione sul carico tollerato, con il dolore entro 3/10 durante l'esercizio e nessun peggioramento il giorno dopo.	shoulder	\N	tendon	\N	\N	t	t	2026-09-03 07:45:40.847	2026-09-03 07:45:40.847
sys_shoulder_generic	\N	shoulder_generic	Spalla — protocollo generico	Fallback di zona per quadri diversi da instabilita' e tendinopatia, comprese le lesioni ossee della cintura scapolare: in quel caso il primo criterio della fase 1 e' la guarigione documentata.	shoulder	\N	\N	\N	\N	t	t	2026-09-03 07:45:40.847	2026-09-03 07:45:40.847
sys_upper_limb_bone	\N	upper_limb_bone	Mano, polso e gomito — lesione ossea	Fratture di dita, scafoide, polso e gomito. Qui il primo cancello non e' un test di forza ma la consolidazione radiologica: prima di quella non si negozia nulla.	\N	upper_limb	bone	\N	\N	t	t	2026-09-03 07:45:40.847	2026-09-03 07:45:40.847
sys_spine_generic	\N	spine_generic	Rachide — lombalgia e quadri vertebrali	La resistenza dei muscoli del tronco conta piu' della forza massimale. Le bandiere rosse (deficit neurologico, dolore notturno non meccanico) fermano il protocollo e rimandano al medico.	\N	spine	\N	\N	\N	t	t	2026-09-03 07:45:40.847	2026-09-03 07:45:40.847
sys_bone_generic	\N	bone_generic	Lesione ossea — protocollo generico	Fallback per le fratture in sedi senza protocollo dedicato. Il primo criterio e' sempre la consolidazione.	\N	\N	bone	\N	\N	t	t	2026-09-03 07:45:40.847	2026-09-03 07:45:40.847
sys_default_generic	\N	default_generic	Protocollo generico	Ultimo fallback: si applica quando nessun altro protocollo combacia. E' il punto di partenza da duplicare e adattare quando serve un protocollo per una sede che la libreria non copre.	\N	\N	\N	\N	\N	t	t	2026-09-03 07:45:40.847	2026-09-03 07:45:40.847
\.


--
-- Data for Name: session_exercises; Type: TABLE DATA; Schema: public; Owner: trainmind
--

COPY public.session_exercises (id, "trainingSessionId", "exerciseId", "orderIndex", sets, reps, weight, duration, "restTime", notes, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: session_logs; Type: TABLE DATA; Schema: public; Owner: trainmind
--

COPY public.session_logs (id, "trainingSessionId", "athleteId", "actualRpe", "actualDuration", "completedSets", notes, "createdAt", "updatedAt", "exerciseChecks", "viewedAt") FROM stdin;
\.


--
-- Data for Name: simulations; Type: TABLE DATA; Schema: public; Owner: trainmind
--

COPY public.simulations (id, "periodizationPlanId", name, description, parameters, results, "aiInsights", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: teams; Type: TABLE DATA; Schema: public; Owner: trainmind
--

COPY public.teams (id, name, description, color, "organizationId", "createdAt", "updatedAt", "logoUrl") FROM stdin;
\.


--
-- Data for Name: training_plans; Type: TABLE DATA; Schema: public; Owner: trainmind
--

COPY public.training_plans (id, name, description, "startDate", "endDate", "athleteId", "organizationId", "createdById", "createdAt", "updatedAt", "periodizationPlanId", "teamId", "trainingDays", "aiGenerated") FROM stdin;
\.


--
-- Data for Name: training_sessions; Type: TABLE DATA; Schema: public; Owner: trainmind
--

COPY public.training_sessions (id, title, date, duration, status, notes, rpe, "weekId", "athleteId", "createdAt", "updatedAt", "isTemplate", "organizationId", "aiModified", "detailedByAttendance") FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: trainmind
--

COPY public.users (id, email, "passwordHash", "firstName", "lastName", role, "avatarUrl", "isActive", "organizationId", "createdAt", "updatedAt", "refreshToken", "lastLoginAt", "consentAnalytics", "consentMarketing", "consentThirdParty", "consentUpdatedAt", "athleteId", "pushSubscription", "deletedAt", "resetTokenHash", "resetTokenExpiry", "passwordChangedAt", locale) FROM stdin;
\.


--
-- Data for Name: weeks; Type: TABLE DATA; Schema: public; Owner: trainmind
--

COPY public.weeks (id, "weekNumber", "trainingPlanId", notes, "createdAt", "updatedAt", "microcycleId") FROM stdin;
\.


--
-- Data for Name: wellness_logs; Type: TABLE DATA; Schema: public; Owner: trainmind
--

COPY public.wellness_logs (id, "athleteId", date, "sleepHours", "sleepQuality", fatigue, soreness, stress, mood, notes, "createdAt", "updatedAt", "mediaUrls", "submittedBy") FROM stdin;
\.


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: ai_usage_logs ai_usage_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.ai_usage_logs
    ADD CONSTRAINT ai_usage_logs_pkey PRIMARY KEY (id);


--
-- Name: alert_rules alert_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.alert_rules
    ADD CONSTRAINT alert_rules_pkey PRIMARY KEY (id);


--
-- Name: athlete_invites athlete_invites_pkey; Type: CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.athlete_invites
    ADD CONSTRAINT athlete_invites_pkey PRIMARY KEY (id);


--
-- Name: athlete_teams athlete_teams_pkey; Type: CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.athlete_teams
    ADD CONSTRAINT athlete_teams_pkey PRIMARY KEY (id);


--
-- Name: athletes athletes_pkey; Type: CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.athletes
    ADD CONSTRAINT athletes_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: calendar_events calendar_events_pkey; Type: CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.calendar_events
    ADD CONSTRAINT calendar_events_pkey PRIMARY KEY (id);


--
-- Name: chat_conversations chat_conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.chat_conversations
    ADD CONSTRAINT chat_conversations_pkey PRIMARY KEY (id);


--
-- Name: chat_messages chat_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_pkey PRIMARY KEY (id);


--
-- Name: clearance_criteria clearance_criteria_pkey; Type: CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.clearance_criteria
    ADD CONSTRAINT clearance_criteria_pkey PRIMARY KEY (id);


--
-- Name: consent_records consent_records_pkey; Type: CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.consent_records
    ADD CONSTRAINT consent_records_pkey PRIMARY KEY (id);


--
-- Name: daily_report_entries daily_report_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.daily_report_entries
    ADD CONSTRAINT daily_report_entries_pkey PRIMARY KEY (id);


--
-- Name: daily_reports daily_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.daily_reports
    ADD CONSTRAINT daily_reports_pkey PRIMARY KEY (id);


--
-- Name: exercises exercises_pkey; Type: CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.exercises
    ADD CONSTRAINT exercises_pkey PRIMARY KEY (id);


--
-- Name: field_training_entries field_training_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.field_training_entries
    ADD CONSTRAINT field_training_entries_pkey PRIMARY KEY (id);


--
-- Name: field_training_sessions field_training_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.field_training_sessions
    ADD CONSTRAINT field_training_sessions_pkey PRIMARY KEY (id);


--
-- Name: game_player_entries game_player_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.game_player_entries
    ADD CONSTRAINT game_player_entries_pkey PRIMARY KEY (id);


--
-- Name: game_sessions game_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.game_sessions
    ADD CONSTRAINT game_sessions_pkey PRIMARY KEY (id);


--
-- Name: injuries injuries_pkey; Type: CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.injuries
    ADD CONSTRAINT injuries_pkey PRIMARY KEY (id);


--
-- Name: mesocycles mesocycles_pkey; Type: CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.mesocycles
    ADD CONSTRAINT mesocycles_pkey PRIMARY KEY (id);


--
-- Name: metrics metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.metrics
    ADD CONSTRAINT metrics_pkey PRIMARY KEY (id);


--
-- Name: microcycles microcycles_pkey; Type: CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.microcycles
    ADD CONSTRAINT microcycles_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- Name: periodization_plans periodization_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.periodization_plans
    ADD CONSTRAINT periodization_plans_pkey PRIMARY KEY (id);


--
-- Name: plan_adaptations plan_adaptations_pkey; Type: CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.plan_adaptations
    ADD CONSTRAINT plan_adaptations_pkey PRIMARY KEY (id);


--
-- Name: report_schedule_runs report_schedule_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.report_schedule_runs
    ADD CONSTRAINT report_schedule_runs_pkey PRIMARY KEY (id);


--
-- Name: report_schedules report_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.report_schedules
    ADD CONSTRAINT report_schedules_pkey PRIMARY KEY (id);


--
-- Name: reports reports_pkey; Type: CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_pkey PRIMARY KEY (id);


--
-- Name: rtp_phase_logs rtp_phase_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.rtp_phase_logs
    ADD CONSTRAINT rtp_phase_logs_pkey PRIMARY KEY (id);


--
-- Name: rtp_protocol_phases rtp_protocol_phases_pkey; Type: CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.rtp_protocol_phases
    ADD CONSTRAINT rtp_protocol_phases_pkey PRIMARY KEY (id);


--
-- Name: rtp_protocols rtp_protocols_pkey; Type: CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.rtp_protocols
    ADD CONSTRAINT rtp_protocols_pkey PRIMARY KEY (id);


--
-- Name: rtp_template_criteria rtp_template_criteria_pkey; Type: CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.rtp_template_criteria
    ADD CONSTRAINT rtp_template_criteria_pkey PRIMARY KEY (id);


--
-- Name: rtp_template_phases rtp_template_phases_pkey; Type: CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.rtp_template_phases
    ADD CONSTRAINT rtp_template_phases_pkey PRIMARY KEY (id);


--
-- Name: rtp_templates rtp_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.rtp_templates
    ADD CONSTRAINT rtp_templates_pkey PRIMARY KEY (id);


--
-- Name: session_exercises session_exercises_pkey; Type: CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.session_exercises
    ADD CONSTRAINT session_exercises_pkey PRIMARY KEY (id);


--
-- Name: session_logs session_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.session_logs
    ADD CONSTRAINT session_logs_pkey PRIMARY KEY (id);


--
-- Name: simulations simulations_pkey; Type: CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.simulations
    ADD CONSTRAINT simulations_pkey PRIMARY KEY (id);


--
-- Name: teams teams_pkey; Type: CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_pkey PRIMARY KEY (id);


--
-- Name: training_plans training_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.training_plans
    ADD CONSTRAINT training_plans_pkey PRIMARY KEY (id);


--
-- Name: training_sessions training_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.training_sessions
    ADD CONSTRAINT training_sessions_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: weeks weeks_pkey; Type: CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.weeks
    ADD CONSTRAINT weeks_pkey PRIMARY KEY (id);


--
-- Name: wellness_logs wellness_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.wellness_logs
    ADD CONSTRAINT wellness_logs_pkey PRIMARY KEY (id);


--
-- Name: ai_usage_logs_createdAt_idx; Type: INDEX; Schema: public; Owner: trainmind
--

CREATE INDEX "ai_usage_logs_createdAt_idx" ON public.ai_usage_logs USING btree ("createdAt");


--
-- Name: ai_usage_logs_organizationId_createdAt_idx; Type: INDEX; Schema: public; Owner: trainmind
--

CREATE INDEX "ai_usage_logs_organizationId_createdAt_idx" ON public.ai_usage_logs USING btree ("organizationId", "createdAt");


--
-- Name: ai_usage_logs_organizationId_operation_idx; Type: INDEX; Schema: public; Owner: trainmind
--

CREATE INDEX "ai_usage_logs_organizationId_operation_idx" ON public.ai_usage_logs USING btree ("organizationId", operation);


--
-- Name: alert_rules_isActive_idx; Type: INDEX; Schema: public; Owner: trainmind
--

CREATE INDEX "alert_rules_isActive_idx" ON public.alert_rules USING btree ("isActive");


--
-- Name: alert_rules_organizationId_idx; Type: INDEX; Schema: public; Owner: trainmind
--

CREATE INDEX "alert_rules_organizationId_idx" ON public.alert_rules USING btree ("organizationId");


--
-- Name: athlete_invites_email_idx; Type: INDEX; Schema: public; Owner: trainmind
--

CREATE INDEX athlete_invites_email_idx ON public.athlete_invites USING btree (email);


--
-- Name: athlete_invites_organizationId_status_idx; Type: INDEX; Schema: public; Owner: trainmind
--

CREATE INDEX "athlete_invites_organizationId_status_idx" ON public.athlete_invites USING btree ("organizationId", status);


--
-- Name: athlete_invites_token_idx; Type: INDEX; Schema: public; Owner: trainmind
--

CREATE INDEX athlete_invites_token_idx ON public.athlete_invites USING btree (token);


--
-- Name: athlete_invites_token_key; Type: INDEX; Schema: public; Owner: trainmind
--

CREATE UNIQUE INDEX athlete_invites_token_key ON public.athlete_invites USING btree (token);


--
-- Name: athlete_teams_athleteId_teamId_key; Type: INDEX; Schema: public; Owner: trainmind
--

CREATE UNIQUE INDEX "athlete_teams_athleteId_teamId_key" ON public.athlete_teams USING btree ("athleteId", "teamId");


--
-- Name: athlete_teams_teamId_idx; Type: INDEX; Schema: public; Owner: trainmind
--

CREATE INDEX "athlete_teams_teamId_idx" ON public.athlete_teams USING btree ("teamId");


--
-- Name: athletes_organizationId_idx; Type: INDEX; Schema: public; Owner: trainmind
--

CREATE INDEX "athletes_organizationId_idx" ON public.athletes USING btree ("organizationId");


--
-- Name: audit_logs_organizationId_createdAt_idx; Type: INDEX; Schema: public; Owner: trainmind
--

CREATE INDEX "audit_logs_organizationId_createdAt_idx" ON public.audit_logs USING btree ("organizationId", "createdAt");


--
-- Name: audit_logs_resourceType_resourceId_idx; Type: INDEX; Schema: public; Owner: trainmind
--

CREATE INDEX "audit_logs_resourceType_resourceId_idx" ON public.audit_logs USING btree ("resourceType", "resourceId");


--
-- Name: audit_logs_userId_createdAt_idx; Type: INDEX; Schema: public; Owner: trainmind
--

CREATE INDEX "audit_logs_userId_createdAt_idx" ON public.audit_logs USING btree ("userId", "createdAt");


--
-- Name: calendar_events_organizationId_idx; Type: INDEX; Schema: public; Owner: trainmind
--

CREATE INDEX "calendar_events_organizationId_idx" ON public.calendar_events USING btree ("organizationId");


--
-- Name: calendar_events_startTime_endTime_idx; Type: INDEX; Schema: public; Owner: trainmind
--

CREATE INDEX "calendar_events_startTime_endTime_idx" ON public.calendar_events USING btree ("startTime", "endTime");


--
-- Name: calendar_events_teamId_idx; Type: INDEX; Schema: public; Owner: trainmind
--

CREATE INDEX "calendar_events_teamId_idx" ON public.calendar_events USING btree ("teamId");


--
-- Name: calendar_events_userId_idx; Type: INDEX; Schema: public; Owner: trainmind
--

CREATE INDEX "calendar_events_userId_idx" ON public.calendar_events USING btree ("userId");


--
-- Name: chat_conversations_userId_idx; Type: INDEX; Schema: public; Owner: trainmind
--

CREATE INDEX "chat_conversations_userId_idx" ON public.chat_conversations USING btree ("userId");


--
-- Name: chat_messages_conversationId_idx; Type: INDEX; Schema: public; Owner: trainmind
--

CREATE INDEX "chat_messages_conversationId_idx" ON public.chat_messages USING btree ("conversationId");


--
-- Name: clearance_criteria_rtpProtocolId_phase_idx; Type: INDEX; Schema: public; Owner: trainmind
--

CREATE INDEX "clearance_criteria_rtpProtocolId_phase_idx" ON public.clearance_criteria USING btree ("rtpProtocolId", phase);


--
-- Name: consent_records_userId_docType_idx; Type: INDEX; Schema: public; Owner: trainmind
--

CREATE INDEX "consent_records_userId_docType_idx" ON public.consent_records USING btree ("userId", "docType");


--
-- Name: consent_records_userId_docType_revokedAt_idx; Type: INDEX; Schema: public; Owner: trainmind
--

CREATE INDEX "consent_records_userId_docType_revokedAt_idx" ON public.consent_records USING btree ("userId", "docType", "revokedAt");


--
-- Name: daily_report_entries_athleteId_date_idx; Type: INDEX; Schema: public; Owner: trainmind
--

CREATE INDEX "daily_report_entries_athleteId_date_idx" ON public.daily_report_entries USING btree ("athleteId", date);


--
-- Name: daily_report_entries_dailyReportId_athleteId_key; Type: INDEX; Schema: public; Owner: trainmind
--

CREATE UNIQUE INDEX "daily_report_entries_dailyReportId_athleteId_key" ON public.daily_report_entries USING btree ("dailyReportId", "athleteId");


--
-- Name: daily_reports_organizationId_date_idx; Type: INDEX; Schema: public; Owner: trainmind
--

CREATE INDEX "daily_reports_organizationId_date_idx" ON public.daily_reports USING btree ("organizationId", date);


--
-- Name: daily_reports_teamId_date_key; Type: INDEX; Schema: public; Owner: trainmind
--

CREATE UNIQUE INDEX "daily_reports_teamId_date_key" ON public.daily_reports USING btree ("teamId", date);


--
-- Name: exercises_category_idx; Type: INDEX; Schema: public; Owner: trainmind
--

CREATE INDEX exercises_category_idx ON public.exercises USING btree (category);


--
-- Name: exercises_organizationId_idx; Type: INDEX; Schema: public; Owner: trainmind
--

CREATE INDEX "exercises_organizationId_idx" ON public.exercises USING btree ("organizationId");


--
-- Name: field_training_entries_athleteId_idx; Type: INDEX; Schema: public; Owner: trainmind
--

CREATE INDEX "field_training_entries_athleteId_idx" ON public.field_training_entries USING btree ("athleteId");


--
-- Name: field_training_entries_fieldTrainingSessionId_athleteId_key; Type: INDEX; Schema: public; Owner: trainmind
--

CREATE UNIQUE INDEX "field_training_entries_fieldTrainingSessionId_athleteId_key" ON public.field_training_entries USING btree ("fieldTrainingSessionId", "athleteId");


--
-- Name: field_training_entries_status_idx; Type: INDEX; Schema: public; Owner: trainmind
--

CREATE INDEX field_training_entries_status_idx ON public.field_training_entries USING btree (status);


--
-- Name: field_training_sessions_calendarEventId_key; Type: INDEX; Schema: public; Owner: trainmind
--

CREATE UNIQUE INDEX "field_training_sessions_calendarEventId_key" ON public.field_training_sessions USING btree ("calendarEventId");


--
-- Name: field_training_sessions_organizationId_idx; Type: INDEX; Schema: public; Owner: trainmind
--

CREATE INDEX "field_training_sessions_organizationId_idx" ON public.field_training_sessions USING btree ("organizationId");


--
-- Name: field_training_sessions_teamId_idx; Type: INDEX; Schema: public; Owner: trainmind
--

CREATE INDEX "field_training_sessions_teamId_idx" ON public.field_training_sessions USING btree ("teamId");


--
-- Name: field_training_sessions_trainingSessionId_key; Type: INDEX; Schema: public; Owner: trainmind
--

CREATE UNIQUE INDEX "field_training_sessions_trainingSessionId_key" ON public.field_training_sessions USING btree ("trainingSessionId");


--
-- Name: game_player_entries_athleteId_idx; Type: INDEX; Schema: public; Owner: trainmind
--

CREATE INDEX "game_player_entries_athleteId_idx" ON public.game_player_entries USING btree ("athleteId");


--
-- Name: game_player_entries_gameSessionId_athleteId_key; Type: INDEX; Schema: public; Owner: trainmind
--

CREATE UNIQUE INDEX "game_player_entries_gameSessionId_athleteId_key" ON public.game_player_entries USING btree ("gameSessionId", "athleteId");


--
-- Name: game_sessions_calendarEventId_key; Type: INDEX; Schema: public; Owner: trainmind
--

CREATE UNIQUE INDEX "game_sessions_calendarEventId_key" ON public.game_sessions USING btree ("calendarEventId");


--
-- Name: game_sessions_organizationId_idx; Type: INDEX; Schema: public; Owner: trainmind
--

CREATE INDEX "game_sessions_organizationId_idx" ON public.game_sessions USING btree ("organizationId");


--
-- Name: game_sessions_teamId_idx; Type: INDEX; Schema: public; Owner: trainmind
--

CREATE INDEX "game_sessions_teamId_idx" ON public.game_sessions USING btree ("teamId");


--
-- Name: injuries_athleteId_idx; Type: INDEX; Schema: public; Owner: trainmind
--

CREATE INDEX "injuries_athleteId_idx" ON public.injuries USING btree ("athleteId");


--
-- Name: mesocycles_periodizationPlanId_orderIndex_key; Type: INDEX; Schema: public; Owner: trainmind
--

CREATE UNIQUE INDEX "mesocycles_periodizationPlanId_orderIndex_key" ON public.mesocycles USING btree ("periodizationPlanId", "orderIndex");


--
-- Name: metrics_athleteId_type_idx; Type: INDEX; Schema: public; Owner: trainmind
--

CREATE INDEX "metrics_athleteId_type_idx" ON public.metrics USING btree ("athleteId", type);


--
-- Name: metrics_date_idx; Type: INDEX; Schema: public; Owner: trainmind
--

CREATE INDEX metrics_date_idx ON public.metrics USING btree (date);


--
-- Name: microcycles_mesocycleId_weekNumber_key; Type: INDEX; Schema: public; Owner: trainmind
--

CREATE UNIQUE INDEX "microcycles_mesocycleId_weekNumber_key" ON public.microcycles USING btree ("mesocycleId", "weekNumber");


--
-- Name: notifications_createdAt_idx; Type: INDEX; Schema: public; Owner: trainmind
--

CREATE INDEX "notifications_createdAt_idx" ON public.notifications USING btree ("createdAt");


--
-- Name: notifications_userId_isRead_idx; Type: INDEX; Schema: public; Owner: trainmind
--

CREATE INDEX "notifications_userId_isRead_idx" ON public.notifications USING btree ("userId", "isRead");


--
-- Name: organizations_slug_key; Type: INDEX; Schema: public; Owner: trainmind
--

CREATE UNIQUE INDEX organizations_slug_key ON public.organizations USING btree (slug);


--
-- Name: organizations_stripeCustomerId_key; Type: INDEX; Schema: public; Owner: trainmind
--

CREATE UNIQUE INDEX "organizations_stripeCustomerId_key" ON public.organizations USING btree ("stripeCustomerId");


--
-- Name: periodization_plans_isTemplate_idx; Type: INDEX; Schema: public; Owner: trainmind
--

CREATE INDEX "periodization_plans_isTemplate_idx" ON public.periodization_plans USING btree ("isTemplate");


--
-- Name: periodization_plans_organizationId_idx; Type: INDEX; Schema: public; Owner: trainmind
--

CREATE INDEX "periodization_plans_organizationId_idx" ON public.periodization_plans USING btree ("organizationId");


--
-- Name: periodization_plans_teamId_idx; Type: INDEX; Schema: public; Owner: trainmind
--

CREATE INDEX "periodization_plans_teamId_idx" ON public.periodization_plans USING btree ("teamId");


--
-- Name: plan_adaptations_athleteId_status_idx; Type: INDEX; Schema: public; Owner: trainmind
--

CREATE INDEX "plan_adaptations_athleteId_status_idx" ON public.plan_adaptations USING btree ("athleteId", status);


--
-- Name: plan_adaptations_createdAt_idx; Type: INDEX; Schema: public; Owner: trainmind
--

CREATE INDEX "plan_adaptations_createdAt_idx" ON public.plan_adaptations USING btree ("createdAt");


--
-- Name: plan_adaptations_organizationId_status_idx; Type: INDEX; Schema: public; Owner: trainmind
--

CREATE INDEX "plan_adaptations_organizationId_status_idx" ON public.plan_adaptations USING btree ("organizationId", status);


--
-- Name: report_schedule_runs_scheduleId_startedAt_idx; Type: INDEX; Schema: public; Owner: trainmind
--

CREATE INDEX "report_schedule_runs_scheduleId_startedAt_idx" ON public.report_schedule_runs USING btree ("scheduleId", "startedAt");


--
-- Name: report_schedules_isActive_nextRunAt_idx; Type: INDEX; Schema: public; Owner: trainmind
--

CREATE INDEX "report_schedules_isActive_nextRunAt_idx" ON public.report_schedules USING btree ("isActive", "nextRunAt");


--
-- Name: report_schedules_organizationId_idx; Type: INDEX; Schema: public; Owner: trainmind
--

CREATE INDEX "report_schedules_organizationId_idx" ON public.report_schedules USING btree ("organizationId");


--
-- Name: reports_userId_idx; Type: INDEX; Schema: public; Owner: trainmind
--

CREATE INDEX "reports_userId_idx" ON public.reports USING btree ("userId");


--
-- Name: rtp_phase_logs_rtpProtocolId_idx; Type: INDEX; Schema: public; Owner: trainmind
--

CREATE INDEX "rtp_phase_logs_rtpProtocolId_idx" ON public.rtp_phase_logs USING btree ("rtpProtocolId");


--
-- Name: rtp_protocol_phases_rtpProtocolId_idx; Type: INDEX; Schema: public; Owner: trainmind
--

CREATE INDEX "rtp_protocol_phases_rtpProtocolId_idx" ON public.rtp_protocol_phases USING btree ("rtpProtocolId");


--
-- Name: rtp_protocol_phases_rtpProtocolId_phase_key; Type: INDEX; Schema: public; Owner: trainmind
--

CREATE UNIQUE INDEX "rtp_protocol_phases_rtpProtocolId_phase_key" ON public.rtp_protocol_phases USING btree ("rtpProtocolId", phase);


--
-- Name: rtp_protocols_athleteId_idx; Type: INDEX; Schema: public; Owner: trainmind
--

CREATE INDEX "rtp_protocols_athleteId_idx" ON public.rtp_protocols USING btree ("athleteId");


--
-- Name: rtp_template_criteria_phaseId_idx; Type: INDEX; Schema: public; Owner: trainmind
--

CREATE INDEX "rtp_template_criteria_phaseId_idx" ON public.rtp_template_criteria USING btree ("phaseId");


--
-- Name: rtp_template_phases_templateId_idx; Type: INDEX; Schema: public; Owner: trainmind
--

CREATE INDEX "rtp_template_phases_templateId_idx" ON public.rtp_template_phases USING btree ("templateId");


--
-- Name: rtp_template_phases_templateId_order_key; Type: INDEX; Schema: public; Owner: trainmind
--

CREATE UNIQUE INDEX "rtp_template_phases_templateId_order_key" ON public.rtp_template_phases USING btree ("templateId", "order");


--
-- Name: rtp_templates_bodyZone_injuryType_idx; Type: INDEX; Schema: public; Owner: trainmind
--

CREATE INDEX "rtp_templates_bodyZone_injuryType_idx" ON public.rtp_templates USING btree ("bodyZone", "injuryType");


--
-- Name: rtp_templates_code_key; Type: INDEX; Schema: public; Owner: trainmind
--

CREATE UNIQUE INDEX rtp_templates_code_key ON public.rtp_templates USING btree (code);


--
-- Name: rtp_templates_organizationId_idx; Type: INDEX; Schema: public; Owner: trainmind
--

CREATE INDEX "rtp_templates_organizationId_idx" ON public.rtp_templates USING btree ("organizationId");


--
-- Name: session_exercises_trainingSessionId_idx; Type: INDEX; Schema: public; Owner: trainmind
--

CREATE INDEX "session_exercises_trainingSessionId_idx" ON public.session_exercises USING btree ("trainingSessionId");


--
-- Name: session_logs_trainingSessionId_athleteId_key; Type: INDEX; Schema: public; Owner: trainmind
--

CREATE UNIQUE INDEX "session_logs_trainingSessionId_athleteId_key" ON public.session_logs USING btree ("trainingSessionId", "athleteId");


--
-- Name: simulations_periodizationPlanId_idx; Type: INDEX; Schema: public; Owner: trainmind
--

CREATE INDEX "simulations_periodizationPlanId_idx" ON public.simulations USING btree ("periodizationPlanId");


--
-- Name: teams_organizationId_idx; Type: INDEX; Schema: public; Owner: trainmind
--

CREATE INDEX "teams_organizationId_idx" ON public.teams USING btree ("organizationId");


--
-- Name: teams_organizationId_name_key; Type: INDEX; Schema: public; Owner: trainmind
--

CREATE UNIQUE INDEX "teams_organizationId_name_key" ON public.teams USING btree ("organizationId", name);


--
-- Name: training_plans_athleteId_idx; Type: INDEX; Schema: public; Owner: trainmind
--

CREATE INDEX "training_plans_athleteId_idx" ON public.training_plans USING btree ("athleteId");


--
-- Name: training_plans_organizationId_idx; Type: INDEX; Schema: public; Owner: trainmind
--

CREATE INDEX "training_plans_organizationId_idx" ON public.training_plans USING btree ("organizationId");


--
-- Name: training_plans_periodizationPlanId_idx; Type: INDEX; Schema: public; Owner: trainmind
--

CREATE INDEX "training_plans_periodizationPlanId_idx" ON public.training_plans USING btree ("periodizationPlanId");


--
-- Name: training_plans_teamId_idx; Type: INDEX; Schema: public; Owner: trainmind
--

CREATE INDEX "training_plans_teamId_idx" ON public.training_plans USING btree ("teamId");


--
-- Name: training_sessions_athleteId_idx; Type: INDEX; Schema: public; Owner: trainmind
--

CREATE INDEX "training_sessions_athleteId_idx" ON public.training_sessions USING btree ("athleteId");


--
-- Name: training_sessions_date_idx; Type: INDEX; Schema: public; Owner: trainmind
--

CREATE INDEX training_sessions_date_idx ON public.training_sessions USING btree (date);


--
-- Name: training_sessions_organizationId_isTemplate_idx; Type: INDEX; Schema: public; Owner: trainmind
--

CREATE INDEX "training_sessions_organizationId_isTemplate_idx" ON public.training_sessions USING btree ("organizationId", "isTemplate");


--
-- Name: training_sessions_weekId_idx; Type: INDEX; Schema: public; Owner: trainmind
--

CREATE INDEX "training_sessions_weekId_idx" ON public.training_sessions USING btree ("weekId");


--
-- Name: users_athleteId_key; Type: INDEX; Schema: public; Owner: trainmind
--

CREATE UNIQUE INDEX "users_athleteId_key" ON public.users USING btree ("athleteId");


--
-- Name: users_email_idx; Type: INDEX; Schema: public; Owner: trainmind
--

CREATE INDEX users_email_idx ON public.users USING btree (email);


--
-- Name: users_email_key; Type: INDEX; Schema: public; Owner: trainmind
--

CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);


--
-- Name: users_organizationId_idx; Type: INDEX; Schema: public; Owner: trainmind
--

CREATE INDEX "users_organizationId_idx" ON public.users USING btree ("organizationId");


--
-- Name: users_resetTokenHash_key; Type: INDEX; Schema: public; Owner: trainmind
--

CREATE UNIQUE INDEX "users_resetTokenHash_key" ON public.users USING btree ("resetTokenHash");


--
-- Name: weeks_microcycleId_idx; Type: INDEX; Schema: public; Owner: trainmind
--

CREATE INDEX "weeks_microcycleId_idx" ON public.weeks USING btree ("microcycleId");


--
-- Name: weeks_trainingPlanId_weekNumber_key; Type: INDEX; Schema: public; Owner: trainmind
--

CREATE UNIQUE INDEX "weeks_trainingPlanId_weekNumber_key" ON public.weeks USING btree ("trainingPlanId", "weekNumber");


--
-- Name: wellness_logs_athleteId_date_key; Type: INDEX; Schema: public; Owner: trainmind
--

CREATE UNIQUE INDEX "wellness_logs_athleteId_date_key" ON public.wellness_logs USING btree ("athleteId", date);


--
-- Name: wellness_logs_athleteId_idx; Type: INDEX; Schema: public; Owner: trainmind
--

CREATE INDEX "wellness_logs_athleteId_idx" ON public.wellness_logs USING btree ("athleteId");


--
-- Name: ai_usage_logs ai_usage_logs_organizationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.ai_usage_logs
    ADD CONSTRAINT "ai_usage_logs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES public.organizations(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: alert_rules alert_rules_athleteId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.alert_rules
    ADD CONSTRAINT "alert_rules_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES public.athletes(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: alert_rules alert_rules_organizationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.alert_rules
    ADD CONSTRAINT "alert_rules_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES public.organizations(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: alert_rules alert_rules_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.alert_rules
    ADD CONSTRAINT "alert_rules_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: athlete_invites athlete_invites_athleteId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.athlete_invites
    ADD CONSTRAINT "athlete_invites_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES public.athletes(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: athlete_invites athlete_invites_invitedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.athlete_invites
    ADD CONSTRAINT "athlete_invites_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: athlete_invites athlete_invites_organizationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.athlete_invites
    ADD CONSTRAINT "athlete_invites_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES public.organizations(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: athlete_teams athlete_teams_athleteId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.athlete_teams
    ADD CONSTRAINT "athlete_teams_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES public.athletes(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: athlete_teams athlete_teams_teamId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.athlete_teams
    ADD CONSTRAINT "athlete_teams_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES public.teams(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: athletes athletes_organizationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.athletes
    ADD CONSTRAINT "athletes_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES public.organizations(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: audit_logs audit_logs_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: calendar_events calendar_events_organizationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.calendar_events
    ADD CONSTRAINT "calendar_events_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES public.organizations(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: calendar_events calendar_events_teamId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.calendar_events
    ADD CONSTRAINT "calendar_events_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES public.teams(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: calendar_events calendar_events_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.calendar_events
    ADD CONSTRAINT "calendar_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: chat_conversations chat_conversations_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.chat_conversations
    ADD CONSTRAINT "chat_conversations_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: chat_messages chat_messages_conversationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT "chat_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES public.chat_conversations(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: clearance_criteria clearance_criteria_metById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.clearance_criteria
    ADD CONSTRAINT "clearance_criteria_metById_fkey" FOREIGN KEY ("metById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: clearance_criteria clearance_criteria_rtpProtocolId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.clearance_criteria
    ADD CONSTRAINT "clearance_criteria_rtpProtocolId_fkey" FOREIGN KEY ("rtpProtocolId") REFERENCES public.rtp_protocols(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: consent_records consent_records_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.consent_records
    ADD CONSTRAINT "consent_records_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: daily_report_entries daily_report_entries_athleteId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.daily_report_entries
    ADD CONSTRAINT "daily_report_entries_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES public.athletes(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: daily_report_entries daily_report_entries_dailyReportId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.daily_report_entries
    ADD CONSTRAINT "daily_report_entries_dailyReportId_fkey" FOREIGN KEY ("dailyReportId") REFERENCES public.daily_reports(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: daily_reports daily_reports_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.daily_reports
    ADD CONSTRAINT "daily_reports_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: daily_reports daily_reports_organizationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.daily_reports
    ADD CONSTRAINT "daily_reports_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES public.organizations(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: daily_reports daily_reports_teamId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.daily_reports
    ADD CONSTRAINT "daily_reports_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES public.teams(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: exercises exercises_organizationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.exercises
    ADD CONSTRAINT "exercises_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES public.organizations(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: field_training_entries field_training_entries_athleteId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.field_training_entries
    ADD CONSTRAINT "field_training_entries_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES public.athletes(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: field_training_entries field_training_entries_fieldTrainingSessionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.field_training_entries
    ADD CONSTRAINT "field_training_entries_fieldTrainingSessionId_fkey" FOREIGN KEY ("fieldTrainingSessionId") REFERENCES public.field_training_sessions(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: field_training_sessions field_training_sessions_calendarEventId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.field_training_sessions
    ADD CONSTRAINT "field_training_sessions_calendarEventId_fkey" FOREIGN KEY ("calendarEventId") REFERENCES public.calendar_events(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: field_training_sessions field_training_sessions_organizationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.field_training_sessions
    ADD CONSTRAINT "field_training_sessions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES public.organizations(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: field_training_sessions field_training_sessions_teamId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.field_training_sessions
    ADD CONSTRAINT "field_training_sessions_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES public.teams(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: field_training_sessions field_training_sessions_trainingSessionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.field_training_sessions
    ADD CONSTRAINT "field_training_sessions_trainingSessionId_fkey" FOREIGN KEY ("trainingSessionId") REFERENCES public.training_sessions(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: game_player_entries game_player_entries_athleteId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.game_player_entries
    ADD CONSTRAINT "game_player_entries_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES public.athletes(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: game_player_entries game_player_entries_gameSessionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.game_player_entries
    ADD CONSTRAINT "game_player_entries_gameSessionId_fkey" FOREIGN KEY ("gameSessionId") REFERENCES public.game_sessions(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: game_sessions game_sessions_calendarEventId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.game_sessions
    ADD CONSTRAINT "game_sessions_calendarEventId_fkey" FOREIGN KEY ("calendarEventId") REFERENCES public.calendar_events(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: game_sessions game_sessions_organizationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.game_sessions
    ADD CONSTRAINT "game_sessions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES public.organizations(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: game_sessions game_sessions_teamId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.game_sessions
    ADD CONSTRAINT "game_sessions_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES public.teams(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: injuries injuries_athleteId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.injuries
    ADD CONSTRAINT "injuries_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES public.athletes(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: mesocycles mesocycles_periodizationPlanId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.mesocycles
    ADD CONSTRAINT "mesocycles_periodizationPlanId_fkey" FOREIGN KEY ("periodizationPlanId") REFERENCES public.periodization_plans(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: metrics metrics_athleteId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.metrics
    ADD CONSTRAINT "metrics_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES public.athletes(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: microcycles microcycles_mesocycleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.microcycles
    ADD CONSTRAINT "microcycles_mesocycleId_fkey" FOREIGN KEY ("mesocycleId") REFERENCES public.mesocycles(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: notifications notifications_alertRuleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT "notifications_alertRuleId_fkey" FOREIGN KEY ("alertRuleId") REFERENCES public.alert_rules(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: notifications notifications_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: periodization_plans periodization_plans_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.periodization_plans
    ADD CONSTRAINT "periodization_plans_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: periodization_plans periodization_plans_organizationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.periodization_plans
    ADD CONSTRAINT "periodization_plans_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES public.organizations(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: periodization_plans periodization_plans_teamId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.periodization_plans
    ADD CONSTRAINT "periodization_plans_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES public.teams(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: plan_adaptations plan_adaptations_athleteId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.plan_adaptations
    ADD CONSTRAINT "plan_adaptations_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES public.athletes(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: plan_adaptations plan_adaptations_organizationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.plan_adaptations
    ADD CONSTRAINT "plan_adaptations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES public.organizations(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: plan_adaptations plan_adaptations_proposedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.plan_adaptations
    ADD CONSTRAINT "plan_adaptations_proposedById_fkey" FOREIGN KEY ("proposedById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: plan_adaptations plan_adaptations_reviewedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.plan_adaptations
    ADD CONSTRAINT "plan_adaptations_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: report_schedule_runs report_schedule_runs_scheduleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.report_schedule_runs
    ADD CONSTRAINT "report_schedule_runs_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES public.report_schedules(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: report_schedules report_schedules_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.report_schedules
    ADD CONSTRAINT "report_schedules_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: report_schedules report_schedules_organizationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.report_schedules
    ADD CONSTRAINT "report_schedules_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES public.organizations(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: reports reports_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT "reports_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: rtp_phase_logs rtp_phase_logs_changedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.rtp_phase_logs
    ADD CONSTRAINT "rtp_phase_logs_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: rtp_phase_logs rtp_phase_logs_rtpProtocolId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.rtp_phase_logs
    ADD CONSTRAINT "rtp_phase_logs_rtpProtocolId_fkey" FOREIGN KEY ("rtpProtocolId") REFERENCES public.rtp_protocols(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: rtp_protocol_phases rtp_protocol_phases_rtpProtocolId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.rtp_protocol_phases
    ADD CONSTRAINT "rtp_protocol_phases_rtpProtocolId_fkey" FOREIGN KEY ("rtpProtocolId") REFERENCES public.rtp_protocols(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: rtp_protocols rtp_protocols_athleteId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.rtp_protocols
    ADD CONSTRAINT "rtp_protocols_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES public.athletes(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: rtp_protocols rtp_protocols_injuryId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.rtp_protocols
    ADD CONSTRAINT "rtp_protocols_injuryId_fkey" FOREIGN KEY ("injuryId") REFERENCES public.injuries(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: rtp_protocols rtp_protocols_templateId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.rtp_protocols
    ADD CONSTRAINT "rtp_protocols_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES public.rtp_templates(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: rtp_template_criteria rtp_template_criteria_phaseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.rtp_template_criteria
    ADD CONSTRAINT "rtp_template_criteria_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES public.rtp_template_phases(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: rtp_template_phases rtp_template_phases_templateId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.rtp_template_phases
    ADD CONSTRAINT "rtp_template_phases_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES public.rtp_templates(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: rtp_templates rtp_templates_organizationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.rtp_templates
    ADD CONSTRAINT "rtp_templates_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES public.organizations(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: session_exercises session_exercises_exerciseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.session_exercises
    ADD CONSTRAINT "session_exercises_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES public.exercises(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: session_exercises session_exercises_trainingSessionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.session_exercises
    ADD CONSTRAINT "session_exercises_trainingSessionId_fkey" FOREIGN KEY ("trainingSessionId") REFERENCES public.training_sessions(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: session_logs session_logs_athleteId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.session_logs
    ADD CONSTRAINT "session_logs_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES public.athletes(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: session_logs session_logs_trainingSessionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.session_logs
    ADD CONSTRAINT "session_logs_trainingSessionId_fkey" FOREIGN KEY ("trainingSessionId") REFERENCES public.training_sessions(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: simulations simulations_periodizationPlanId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.simulations
    ADD CONSTRAINT "simulations_periodizationPlanId_fkey" FOREIGN KEY ("periodizationPlanId") REFERENCES public.periodization_plans(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: teams teams_organizationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT "teams_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES public.organizations(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: training_plans training_plans_athleteId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.training_plans
    ADD CONSTRAINT "training_plans_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES public.athletes(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: training_plans training_plans_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.training_plans
    ADD CONSTRAINT "training_plans_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: training_plans training_plans_organizationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.training_plans
    ADD CONSTRAINT "training_plans_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES public.organizations(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: training_plans training_plans_periodizationPlanId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.training_plans
    ADD CONSTRAINT "training_plans_periodizationPlanId_fkey" FOREIGN KEY ("periodizationPlanId") REFERENCES public.periodization_plans(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: training_plans training_plans_teamId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.training_plans
    ADD CONSTRAINT "training_plans_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES public.teams(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: training_sessions training_sessions_athleteId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.training_sessions
    ADD CONSTRAINT "training_sessions_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES public.athletes(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: training_sessions training_sessions_organizationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.training_sessions
    ADD CONSTRAINT "training_sessions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES public.organizations(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: training_sessions training_sessions_weekId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.training_sessions
    ADD CONSTRAINT "training_sessions_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES public.weeks(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: users users_athleteId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES public.athletes(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: users users_organizationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES public.organizations(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: weeks weeks_microcycleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.weeks
    ADD CONSTRAINT "weeks_microcycleId_fkey" FOREIGN KEY ("microcycleId") REFERENCES public.microcycles(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: weeks weeks_trainingPlanId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.weeks
    ADD CONSTRAINT "weeks_trainingPlanId_fkey" FOREIGN KEY ("trainingPlanId") REFERENCES public.training_plans(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: wellness_logs wellness_logs_athleteId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: trainmind
--

ALTER TABLE ONLY public.wellness_logs
    ADD CONSTRAINT "wellness_logs_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES public.athletes(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: trainmind
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;


--
-- PostgreSQL database dump complete
--

\unrestrict fZepCIXiLwgnPpo2tEgP7aSQWbE2cCzwmGf2oacE7aQmFUkEfMyctkYY4qlSnQm

