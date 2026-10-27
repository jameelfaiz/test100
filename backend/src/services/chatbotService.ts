// src/services/chatbotService.ts
import fs from "fs";
import path from "path";
import axios from "axios";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");
import mammoth from "mammoth";
import { HandbookClause, IHandbookClause } from "../models/HandbookClause";
import { Application } from "../models/Application";
import { Payment } from "../models/Payment";
import { ReleaseRequest } from "../models/ReleaseRequest";
import { Institution } from "../models/Institution";
import { Complaint } from "../models/Complaint";
import { DocumentVerification } from "../models/DocumentVerification";
import { User } from "../models/User";
import {
  getFdrMaturityAndRefundExplanation,
  getEodVsEoaExplanation,
  getLoaNextStepsExplanation,
  getPortalUploadInstructions,
} from "./portalKnowledge";

// ── 1. Lightweight User Intent Detection & Topic Restriction ────────────────
export type DetectedIntentType =
  | "GREETING"
  | "BASIC_CONVERSATION"
  | "UNRELATED"
  | "AICTE_QUERY";

export interface IntentDetectionResult {
  intent: DetectedIntentType;
  allowed: boolean;
  reply?: string;
  cleanedQuery?: string;
  isFollowUp?: boolean;
}

const GREETING_ONLY_REGEX =
  /^(hi+|hello+|hey+|hiya|howdy|namaste|namaskar|greetings|good\s*(morning|afternoon|evening|day))(\s+(there|assistant|bot|aicte|team|sir|madam|friend))?[\s!.,?]*$/i;

const GREETING_CASUAL_QUERY_REGEX =
  /^(hi+|hello+|hey+|good\s*(morning|afternoon|evening|day))[\s,!-]+(how\s*are\s*you|how\s*r\s*u|how\s*do\s*you\s*do|what\s*can\s*you\s*do|how\s*can\s*you\s*help(\s*me)?|who\s*are\s*you)[\s!.,?]*$/i;

const GRATITUDE_REGEX =
  /^(thank\s*you|thanks|thanks\s*(a\s*lot|so\s*much|very\s*much|ton)|many\s*thanks|thx)[\s!.,]*$/i;

const ACKNOWLEDGMENT_REGEX =
  /^(ok|okay|ok\s*got\s*it|got\s*it|understood|alright|all\s*right|noted|sure|fine|cool)[\s!.,]*$/i;

const CLOSING_REGEX =
  /^(bye|goodbye|see\s*you|see\s*ya|talk\s*to\s*you\s*later|have\s*a\s*nice\s*day|have\s*a\s*good\s*day|cya|take\s*care)[\s!.,]*$/i;

const CONVERSATIONAL_PROMPT_REGEX =
  /^(i\s*have\s*(one|a|\d+)?\s*(doubt|question|query|inquiry)|can\s*i\s*ask\s*(a|one)?\s*(question|doubt|query)|i\s*need\s*(some\s*)?help|can\s*you\s*help\s*me|quick\s*question|one\s*quick\s*doubt|one\s*question|one\s*doubt|could\s*you\s*clarify|clarification\s*needed|i\s*want\s*to\s*know\s*something)[\s!.,?]*$/i;

const FOLLOW_UP_REGEX =
  /^(what\s*(happens\s*)?next|what\s*should\s*i\s*do(\s*next)?|what\s*to\s*do(\s*next)?|what\s*documents\s*(are\s*)?(needed|required)|which\s*documents|where\s*(do\s*i|should\s*i|to)\s*upload(\s*them)?|where\s*to\s*upload|how\s*to\s*upload|how\s*much\s*(is\s*it|fee|fees|amount)|what\s*about\s*(it|them|this|the\s*fee)|why(\s*was\s*it\s*rejected)?|what\s*is\s*the\s*deadline|who\s*verifies\s*(this|it)|and\s*then)[\s!.,?]*$/i;

const STRICT_OFFTOPIC_REGEX =
  /^(what\s*is\s*the\s*weather|weather(\s*today|\s*forecast)?|tell\s*me\s*a\s*joke|joke|who\s*is\s*(the\s*)?(president|prime\s*minister|cm|chief\s*minister)|cricket\s*score|score\s*update|ipl|movie\s*recommendation|play\s*a\s*game|write\s*a\s*poem|write\s*code\s*(for)?|python\s*code|java\s*code|bubble\s*sort|stock\s*market|bitcoin|crypto|recipe\s*(for)?|how\s*to\s*(cook|bake)|who\s*won\s*the\s*match|capital\s*of|translate\s*to|song\s*lyrics|horoscope|sing\s*a\s*song)/i;

const AICTE_TOPIC_REGEX =
  /(aicte|handbook|aph|clause|regulation|norm|compliance|approval|loa|eoa|fdr|fixed deposit|security deposit|deposit|bank guarantee|lien|lod|eod|maturity|withhold|forfeit|back to the institution|back to institution|letter of deficiency|extension of deficiency|refund|grievance|pgrc|vigilance|complaint|institution|college|university|polytechnic|deemed|engineering|management|pharmacy|architecture|mba|mca|b\.?tech|m\.?tech|diploma|intake|course|curriculum|syllabus|faculty|cadre|principal|director|professor|teacher|tsr|ratio|student|admission|fee|seat|quota|land|building|carpet area|built-up|infrastructure|campus|hostel|library|computer|lab|affidavit|fire safety|structural stability|noc|scrutiny|evc|re-scrutiny|shc|sac|scc|deficiency|document|documents|annexure|appendix|ter charges|portal|submit|submission|release|status|workflow|step|what should i do|next step|what to do|proceed|action|where do i|how do i|guidance|apply|why was my|rejected|upload|closure|penalty|penal|fine|appeal|standing hearing|standing appellate|affiliat|\bdoc\b|\bdocs\b|\bclg\b|\buniv\b)/i;

export function detectUserIntent(
  userQuery: string,
  history?: Array<{ role: string; content: string }>
): IntentDetectionResult {
  const raw = (userQuery || "").trim();
  if (!raw) {
    return { intent: "UNRELATED", allowed: false, reply: "It is not under my coverage" };
  }

  // 1. Pure Greetings check (hi, hello, good morning, etc. with zero handbook retrieval)
  if (GREETING_ONLY_REGEX.test(raw) || GREETING_CASUAL_QUERY_REGEX.test(raw)) {
    const lower = raw.toLowerCase();
    let reply = "Hello! How can I help you with AICTE procedures or the portal today?";
    if (lower.includes("good morning")) {
      reply = "Good morning! How can I help you with AICTE procedures or the portal today?";
    } else if (lower.includes("good afternoon")) {
      reply = "Good afternoon! How can I help you with AICTE procedures or the portal today?";
    } else if (lower.includes("good evening")) {
      reply = "Good evening! How can I help you with AICTE procedures or the portal today?";
    }
    return {
      intent: "GREETING",
      allowed: true,
      reply,
    };
  }

  // 2. Pure Basic Conversation check (thank you, okay, bye, etc.)
  if (GRATITUDE_REGEX.test(raw)) {
    return {
      intent: "BASIC_CONVERSATION",
      allowed: true,
      reply: "You're welcome! Let me know if you need any assistance with AICTE procedures or the portal.",
    };
  }
  if (ACKNOWLEDGMENT_REGEX.test(raw)) {
    return {
      intent: "BASIC_CONVERSATION",
      allowed: true,
      reply: "Understood! Let me know if you have any questions regarding AICTE handbook regulations or portal workflows.",
    };
  }
  if (CLOSING_REGEX.test(raw)) {
    return {
      intent: "BASIC_CONVERSATION",
      allowed: true,
      reply: "Goodbye! Have a great day and feel free to return whenever you need help with AICTE.",
    };
  }

  // 2b. Conversational prompt / doubt opening (e.g. "I have one doubt", "can I ask a question") -> Zero retrieval, natural reply
  if (CONVERSATIONAL_PROMPT_REGEX.test(raw)) {
    return {
      intent: "BASIC_CONVERSATION",
      allowed: true,
      reply: "Sure! Please go ahead and share your doubt or question. I am here to assist you with AICTE regulations, portal navigation, applications, and procedures.",
    };
  }

  // Strip leading greeting if followed by actual substantive question (e.g. "Hi, what is LoA?")
  const stripped = raw.replace(/^(hi+|hello+|hey+|good\s*(morning|afternoon|evening|day))[\s,!-]+/i, "").trim();
  const queryToEvaluate = stripped.length > 0 ? stripped : raw;

  // 3. Strict Off-Topic Check -> Exactly "It is not under my coverage"
  if (STRICT_OFFTOPIC_REGEX.test(queryToEvaluate)) {
    return {
      intent: "UNRELATED",
      allowed: false,
      reply: "It is not under my coverage",
    };
  }

  // 4. Follow-up query check (contextual to previous messages)
  const isFollowUpPattern =
    FOLLOW_UP_REGEX.test(queryToEvaluate) ||
    /\b(it|them|this|that|these|those)\b/i.test(queryToEvaluate);

  if (isFollowUpPattern) {
    return {
      intent: "AICTE_QUERY",
      allowed: true,
      isFollowUp: true,
      cleanedQuery: queryToEvaluate,
    };
  }

  // 5. Positive AICTE / Portal / Handbook domain match
  if (AICTE_TOPIC_REGEX.test(queryToEvaluate)) {
    return {
      intent: "AICTE_QUERY",
      allowed: true,
      cleanedQuery: queryToEvaluate,
    };
  }

  // 6. If conversation history exists and discussed AICTE topics, allow short follow-ups
  if (history && history.length > 0) {
    const hasAicteHistory = history.some((h) => AICTE_TOPIC_REGEX.test(h.content));
    if (hasAicteHistory && queryToEvaluate.length < 80) {
      return {
        intent: "AICTE_QUERY",
        allowed: true,
        isFollowUp: true,
        cleanedQuery: queryToEvaluate,
      };
    }
  }

  // 7. Off-Topic Fallback -> Exactly "It is not under my coverage"
  return {
    intent: "UNRELATED",
    allowed: false,
    reply: "It is not under my coverage",
  };
}

export function checkTopicAllowed(
  userQuery: string,
  history?: Array<{ role: string; content: string }>
): {
  allowed: boolean;
  refusalMessage?: string;
  intent?: DetectedIntentType;
} {
  const result = detectUserIntent(userQuery, history);
  if (!result.allowed || result.intent === "UNRELATED") {
    return {
      allowed: false,
      refusalMessage: "It is not under my coverage",
      intent: "UNRELATED",
    };
  }
  return {
    allowed: true,
    intent: result.intent,
  };
}

// ── 2. Conversation Context & Follow-Up Resolution ──────────────────────────
export function resolveContextualQuery(
  userQuery: string,
  history: Array<{ role: string; content: string }>
): { resolvedQuery: string; detectedTopic?: string } {
  const trimmed = userQuery.trim().toLowerCase();
  const isFollowUp =
    /\b(it|them|this|these|that|those|same|its|their|there)\b/i.test(trimmed) ||
    /^(what documents are needed|what documents are required|what documents for it|which documents|where should i upload|where do i upload|where to upload|how much is it|what next|what happens next|what should i do next|what to do next|why was it rejected|why\??)/i.test(
      trimmed
    );

  if (!isFollowUp || !history || history.length === 0) {
    return { resolvedQuery: userQuery };
  }

  let resolvedTopic: string | undefined = undefined;

  // 1. First scan user messages from newest to oldest (user queries are definitive topic anchors)
  const userMessages = history.filter((m) => m.role === "user");
  for (let i = userMessages.length - 1; i >= 0; i--) {
    const text = userMessages[i].content.toLowerCase();
    if (text.includes("eod") || text.includes("lod") || text.includes("extension of deficiency") || text.includes("letter of deficiency")) {
      resolvedTopic = "EoD Deficiency Notice vs EoA Approval";
      break;
    }
    if (text.includes("fdr") || text.includes("fixed deposit") || text.includes("security deposit") || text.includes("maturity fund") || text.includes("maturity")) {
      resolvedTopic = "FDR Security Deposit Maturity & Release";
      break;
    }
    if (text.includes("loa") || text.includes("letter of approval") || text.includes("new technical institution") || text.includes("new institution")) {
      resolvedTopic = "LoA Application (New Technical Institution)";
      break;
    }
    if (text.includes("eoa") || text.includes("extension of approval")) {
      resolvedTopic = "EoA Application (Extension of Approval)";
      break;
    }
    if (text.includes("release") || text.includes("refund")) {
      resolvedTopic = "Security Deposit Release Application";
      break;
    }
    if (text.includes("rejected") || text.includes("deficiency") || text.includes("scrutiny")) {
      resolvedTopic = "Rejected Document Verification";
      break;
    }
  }

  // 2. If not found in user messages, scan all history
  if (!resolvedTopic) {
    for (let i = history.length - 1; i >= 0; i--) {
      const text = history[i].content.toLowerCase();
      if (text.includes("eod") || text.includes("lod") || text.includes("extension of deficiency") || text.includes("letter of deficiency")) {
        resolvedTopic = "EoD Deficiency Notice vs EoA Approval";
        break;
      }
      if (text.includes("fdr") || text.includes("fixed deposit") || text.includes("security deposit") || text.includes("maturity fund") || text.includes("maturity")) {
        resolvedTopic = "FDR Security Deposit Maturity & Release";
        break;
      }
      if (text.includes("loa") || text.includes("letter of approval") || text.includes("new technical institution") || text.includes("new institution")) {
        resolvedTopic = "LoA Application (New Technical Institution)";
        break;
      }
      if (text.includes("eoa") || text.includes("extension of approval")) {
        resolvedTopic = "EoA Application (Extension of Approval)";
        break;
      }
      if (text.includes("release") || text.includes("refund")) {
        resolvedTopic = "Security Deposit Release Application";
        break;
      }
      if (text.includes("rejected") || text.includes("deficiency") || text.includes("scrutiny")) {
        resolvedTopic = "Rejected Document Verification";
        break;
      }
    }
  }

  if (resolvedTopic) {
    const augmented = `${userQuery} (in context of ${resolvedTopic})`;
    return { resolvedQuery: augmented, detectedTopic: resolvedTopic };
  }

  return { resolvedQuery: userQuery };
}

// ── 3. Intelligent Handbook Clause Retrieval (RAG) ──────────────────────────
export async function retrieveRelevantClauses(
  query: string,
  limit: number = 4
): Promise<IHandbookClause[]> {
  const clauses: IHandbookClause[] = [];
  const lowerQuery = query.toLowerCase();

  const stopWords = new Set([
    "what", "which", "how", "does", "the", "with", "this", "that", "from",
    "when", "where", "should", "could", "would", "hi", "hello", "hey",
    "please", "help", "about", "can", "you", "tell", "me", "are", "and",
    "for", "under", "get", "will", "give", "much", "many", "back", "into"
  ]);

  // 1. Direct clause/annexure/affidavit/format/certificate/table/chapter extraction
  const refMatch = query.match(
    /\b(clause|annexure|affidavit|format|certificate|table|chapter|rule|definition)\s*([0-9a-z.\-]+|\b[ivxlcdm]+\b)/i
  );
  if (refMatch) {
    const prefixType = refMatch[1].trim().toLowerCase();
    const rawNum = refMatch[2].trim();
    const escapedNum = rawNum.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    let refPattern: RegExp;
    if (prefixType === "affidavit") {
      refPattern = new RegExp(`Affidavit\\s*[-]?\\s*${escapedNum}\\b`, "i");
    } else if (prefixType === "annexure") {
      refPattern = new RegExp(`Annexure\\s*[-]?\\s*${escapedNum}\\b`, "i");
    } else if (prefixType === "format") {
      refPattern = new RegExp(`Format\\s*[-]?\\s*${escapedNum}\\b`, "i");
    } else if (prefixType === "certificate") {
      refPattern = new RegExp(`Certificate\\s*[-]?\\s*${escapedNum}\\b`, "i");
    } else if (prefixType === "table") {
      refPattern = new RegExp(`Table\\s*${escapedNum}\\b`, "i");
    } else if (prefixType === "chapter") {
      refPattern = new RegExp(`Chapter\\s*[-]?\\s*${escapedNum}\\b`, "i");
    } else {
      refPattern = new RegExp(`Clause\\s*${escapedNum}\\b`, "i");
    }

    let searchCondition: any;
    if (prefixType === "annexure") {
      searchCondition = {
        $or: [
          { clauseNumber: new RegExp(`Annexure\\s*[-]?\\s*${escapedNum}\\b`, "i") },
          { tableOrAnnexureRef: new RegExp(`Annexure\\s*[-]?\\s*${escapedNum}\\b`, "i") },
          { chapter: new RegExp(`Annexure\\s*[-]?\\s*${escapedNum}\\b`, "i") },
        ],
      };
    } else if (prefixType === "affidavit") {
      searchCondition = {
        $or: [
          { clauseNumber: new RegExp(`Affidavit\\s*[-]?\\s*${escapedNum}\\b`, "i") },
          { tableOrAnnexureRef: new RegExp(`Affidavit\\s*[-]?\\s*${escapedNum}\\b`, "i") },
          { chapter: new RegExp(`Affidavit\\s*[-]?\\s*${escapedNum}\\b`, "i") },
        ],
      };
    } else if (prefixType === "format" || prefixType === "certificate") {
      searchCondition = {
        $or: [
          { clauseNumber: new RegExp(`${prefixType}\\s*[-]?\\s*${escapedNum}\\b`, "i") },
          { tableOrAnnexureRef: new RegExp(`${prefixType}\\s*[-]?\\s*${escapedNum}\\b`, "i") },
        ],
      };
    } else if (prefixType === "table") {
      searchCondition = {
        $or: [
          { clauseNumber: new RegExp(`Table\\s*${escapedNum}\\b`, "i") },
          { tableOrAnnexureRef: new RegExp(`Table\\s*${escapedNum}\\b`, "i") },
        ],
      };
    } else if (prefixType === "chapter") {
      searchCondition = {
        chapter: new RegExp(`Chapter\\s*[-]?\\s*${escapedNum}\\b`, "i"),
      };
    } else {
      searchCondition = {
        $or: [
          { clauseNumber: new RegExp(`Clause\\s*${escapedNum}\\b`, "i") },
          { clauseNumber: new RegExp(`^${escapedNum}\\b`, "i") },
        ],
      };
    }

    const directResults = await HandbookClause.find(searchCondition).limit(3);

    for (const r of directResults) {
      if (!clauses.some((c) => c._id.toString() === r._id.toString())) {
        clauses.push(r);
      }
    }

    // If a specific clause number was explicitly requested (e.g. Clause 99.4) and does not exist in APH,
    // do not perform loose full-text fallback to attach arbitrary irrelevant clauses
    if (clauses.length === 0 && /\b(clause|annexure|table|appendix|format|affidavit)\s*[0-9]+/i.test(query)) {
      return [];
    }
  }

  // 2. Acronym & Domain-Specific Targeting
  const targetClauseNumbers: string[] = [];

  if (
    lowerQuery.includes("fdr") ||
    lowerQuery.includes("fixed deposit") ||
    lowerQuery.includes("security deposit") ||
    lowerQuery.includes("maturity fund") ||
    lowerQuery.includes("maturity") ||
    lowerQuery.includes("back to the institution") ||
    lowerQuery.includes("fund returned")
  ) {
    if (
      lowerQuery.includes("release") ||
      lowerQuery.includes("mature") ||
      lowerQuery.includes("10 year") ||
      lowerQuery.includes("back") ||
      lowerQuery.includes("not back") ||
      lowerQuery.includes("withhold") ||
      lowerQuery.includes("forfeit")
    ) {
      targetClauseNumbers.push("Clause 1.12", "Table 1.4", "Clause 4.10", "Affidavit-6", "Clause 7.3");
    } else if (lowerQuery.includes("penalty") || lowerQuery.includes("encash")) {
      targetClauseNumbers.push("Clause 7.3", "Clause 7.4", "Clause 1.12");
    } else {
      targetClauseNumbers.push("Clause 1.12", "Table 1.4", "Appendix 10", "Clause 7.3");
    }
  }

  if (
    lowerQuery.includes("loa") ||
    lowerQuery.includes("letter of approval") ||
    lowerQuery.includes("new institution") ||
    lowerQuery.includes("new technical institution") ||
    lowerQuery.includes("establish")
  ) {
    if (
      lowerQuery.includes("document") ||
      lowerQuery.includes("checklist") ||
      lowerQuery.includes("needed") ||
      lowerQuery.includes("required") ||
      lowerQuery.includes("upload")
    ) {
      targetClauseNumbers.push("Clause 6.1", "Annexure-1", "Appendix 11", "Affidavit 1", "Clause 1.4.6");
    } else if (
      lowerQuery.includes("after") ||
      lowerQuery.includes("receiving") ||
      lowerQuery.includes("received") ||
      lowerQuery.includes("next step") ||
      lowerQuery.includes("what should i do after")
    ) {
      targetClauseNumbers.push("Clause 1.14", "Clause 1.6", "Clause 1.12", "Clause 2.1", "Clause 1.10");
    } else {
      targetClauseNumbers.push("Clause 1.1", "Clause 1.8", "Clause 1.12", "Clause 1.14", "Clause 1.10", "Annexure-1");
    }
  }

  if (
    lowerQuery.includes("eod") ||
    lowerQuery.includes("lod") ||
    lowerQuery.includes("extension of deficiency") ||
    lowerQuery.includes("letter of deficiency") ||
    lowerQuery.includes("eoa") ||
    lowerQuery.includes("extension of approval") ||
    lowerQuery.includes("intake")
  ) {
    if (lowerQuery.includes("eod") || lowerQuery.includes("lod") || lowerQuery.includes("deficiency")) {
      targetClauseNumbers.push("Clause 2.1", "Clause 1.8", "Clause 1.10", "Clause 1.11", "Annexure-2");
    } else {
      targetClauseNumbers.push("Clause 2.1", "Clause 2.6", "Table 2.1", "Annexure-2");
    }
  }

  if (lowerQuery.includes("reject") || lowerQuery.includes("deficiency") || lowerQuery.includes("scrutiny")) {
    targetClauseNumbers.push("Clause 1.8", "Clause 1.10", "Clause 1.6", "Annexure-1");
  }

  if (lowerQuery.includes("refund") || lowerQuery.includes("fee refund") || lowerQuery.includes("original certificate")) {
    targetClauseNumbers.push("Clause 6.45");
  }

  if (lowerQuery.includes("complaint") || lowerQuery.includes("grievance") || lowerQuery.includes("pgrc")) {
    targetClauseNumbers.push("Clause 7.10", "Clause 6.50", "Clause 6.46");
  }

  if (lowerQuery.includes("land") || lowerQuery.includes("acre") || lowerQuery.includes("built-up") || lowerQuery.includes("carpet area")) {
    targetClauseNumbers.push("Annexure-3", "Clause 1.5", "Clause 6.17");
  }

  if (lowerQuery.includes("faculty") || lowerQuery.includes("ratio") || lowerQuery.includes("cadre") || lowerQuery.includes("tsr") || lowerQuery.includes("teacher") || lowerQuery.includes("principal")) {
    targetClauseNumbers.push("Annexure-5", "Clause 1.6", "Clause 6.14", "Clause 6.15");
  }

  if (lowerQuery.includes("library") || lowerQuery.includes("computer") || lowerQuery.includes("laboratory") || lowerQuery.includes("internet")) {
    targetClauseNumbers.push("Annexure-4", "Clause 6.19");
  }

  if (lowerQuery.includes("twinning") || lowerQuery.includes("collaboration") || lowerQuery.includes("foreign")) {
    targetClauseNumbers.push("Clause 3.1", "Clause 3.2", "Affidavit-11");
  }

  if (lowerQuery.includes("university") || lowerQuery.includes("universities") || lowerQuery.includes("deemed")) {
    targetClauseNumbers.push("Clause 4.1", "Clause 4.2", "Affidavit-5");
  }

  if (lowerQuery.includes("odl") || lowerQuery.includes("distance") || lowerQuery.includes("online learning")) {
    targetClauseNumbers.push("Clause 5.1", "Clause 5.2", "Affidavit-13");
  }

  if (lowerQuery.includes("closure") || lowerQuery.includes("closing")) {
    targetClauseNumbers.push("Clause 2.21", "Affidavit-4");
  }

  if (lowerQuery.includes("penal") || lowerQuery.includes("penalty") || lowerQuery.includes("violation")) {
    targetClauseNumbers.push("Clause 7.1", "Clause 7.3", "Clause 7.4");
  }

  if (lowerQuery.includes("mandatory document") || lowerQuery.includes("what documents") || lowerQuery.includes("document checklist")) {
    targetClauseNumbers.push("Annexure-1", "Annexure-2", "Clause 6.1");
  }

  if (targetClauseNumbers.length > 0) {
    const clauseRegexes = targetClauseNumbers.map(
      (t) => new RegExp(`^${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i")
    );
    const targetedClauses = await HandbookClause.find({
      $or: [
        { clauseNumber: { $in: targetClauseNumbers } },
        { clauseNumber: { $in: clauseRegexes } },
        { tableOrAnnexureRef: { $in: targetClauseNumbers } },
        { chapter: { $in: targetClauseNumbers } },
        { chapter: { $in: clauseRegexes } },
      ],
    });
    for (const tc of targetedClauses) {
      if (!clauses.some((c) => c._id.toString() === tc._id.toString())) {
        clauses.push(tc);
      }
    }
  }

  // 3. Full-text search using text index
  if (clauses.length < limit) {
    try {
      const textResults = await HandbookClause.find(
        { $text: { $search: query } },
        { score: { $meta: "textScore" } }
      )
        .sort({ score: { $meta: "textScore" } })
        .limit(limit);

      for (const r of textResults) {
        if (!clauses.some((c) => c._id.toString() === r._id.toString())) {
          clauses.push(r);
        }
      }
    } catch (err) {
      // ignore
    }
  }

  // 4. Keyword search with word boundaries (avoid substring mis-matches)
  if (clauses.length < limit) {
    const words = query
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 3 && !stopWords.has(w));

    if (words.length > 0) {
      const regexConditions = words.map((w) => {
        const escaped = w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        return { title: new RegExp(`\\b${escaped}\\b`, "i") };
      });

      const regexMatches = await HandbookClause.find({
        $or: [
          { keywords: { $in: words } },
          ...regexConditions,
        ],
      }).limit(limit - clauses.length);

      for (const r of regexMatches) {
        if (!clauses.some((c) => c._id.toString() === r._id.toString())) {
          clauses.push(r);
        }
      }
    }
  }

  // 5. Verify that returned clauses have actual substantive term overlap with user query
  const queryCoreWords = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 4 && !stopWords.has(w));

  if (queryCoreWords.length > 0 && clauses.length > 0) {
    const verifiedClauses = clauses.filter((c) => {
      const text = `${c.clauseNumber} ${c.title} ${c.content || ""} ${c.summary || ""}`.toLowerCase();
      return queryCoreWords.some((w) => text.includes(w));
    });
    return verifiedClauses.slice(0, limit);
  }

  return clauses.slice(0, limit);
}

// ── 4. Authenticated Portal Context Resolution ──────────────────────────────
export async function resolveUserPortalContext(session: any, clientContext: any) {
  const role = session?.role || "UNKNOWN";
  const userId = session?.userId;
  const context: Record<string, any> = {
    role,
    portal: clientContext?.portal || (role === "INSTITUTION" ? "Institution Portal" : `${role} Portal`),
    currentRoute: clientContext?.route || "/",
    workflowStage: "Dashboard",
  };

  if (!userId) return context;

  try {
    if (role === "INSTITUTION") {
      let collegeId = session?.collegeId;
      let institutionId = session?.institutionId;

      // First resolve User document to extract collegeId or institutionId
      try {
        const user = await User.findOne({
          $or: [
            { userId },
            ...(session?.userObjectId ? [{ _id: session.userObjectId }] : []),
            ...(userId && /^[0-9a-fA-F]{24}$/.test(userId) ? [{ _id: userId }] : []),
          ],
        });
        if (user) {
          if ((user as any).collegeId) collegeId = (user as any).collegeId;
          if ((user as any).institutionId) institutionId = (user as any).institutionId;
        }
      } catch (err) {
        console.error("Error finding user in resolveUserPortalContext:", err);
      }

      // Find Institution by collegeId, userId, or institutionId
      const instQueries: any[] = [{ userId }];
      if (collegeId) instQueries.push({ collegeId });
      if (userId) instQueries.push({ collegeId: userId });
      if (institutionId && /^[0-9a-fA-F]{24}$/.test(institutionId)) instQueries.push({ _id: institutionId });
      if (session?.userObjectId) instQueries.push({ linkedUser: session.userObjectId });

      const institution = await Institution.findOne({ $or: instQueries });
      const targetCollegeId = institution?.collegeId || collegeId || userId;

      if (institution || targetCollegeId) {
        if (institution) {
          context.institutionName = institution.name;
          context.collegeId = institution.collegeId;
          context.institutionType = institution.institutionType;
          context.registrationStatus = institution.registrationStatus;
        } else {
          context.collegeId = targetCollegeId;
        }

        // Fetch genuine latest application using targetCollegeId or institutionId
        const appQueries: any[] = [{ collegeId: targetCollegeId }];
        if (institution?._id) appQueries.push({ institutionId: institution._id });
        const application = await Application.findOne({ $or: appQueries }).sort({
          createdAt: -1,
        });

        if (application) {
          context.applicationId = application._id.toString();
          context.applicationNumber = application.applicationId;
          context.applicationType = application.applicationType || application.type || "LoA";
          context.applicationStatus = application.status;
          context.workflowStage = application.status;

          // Fetch genuine document verification records for this institution/application
          const verifQueries: any[] = [];
          if (application._id) verifQueries.push({ applicationId: application._id });
          if (targetCollegeId) verifQueries.push({ collegeId: targetCollegeId });
          if (application.applicationId) verifQueries.push({ applicationRef: application.applicationId });

          const verifications = verifQueries.length > 0
            ? await DocumentVerification.find({ $or: verifQueries })
            : [];

          const totalDocs = verifications.length;
          const verifiedDocs = verifications.filter((d) => d.status === "VERIFIED");
          const rejectedDocs = verifications.filter(
            (d) => d.status === "NOT_VERIFIED" || (d.status !== "VERIFIED" && d.remarks)
          );

          // Deficiency remarks array
          const deficiencies: Array<{ name: string; remarks: string }> = [];

          if (application.deficiencyRemarks && Array.isArray(application.deficiencyRemarks)) {
            for (const rem of application.deficiencyRemarks) {
              if (rem.remarks) {
                deficiencies.push({
                  name: rem.docName || rem.docId || "Uploaded Document",
                  remarks: rem.remarks,
                });
              }
            }
          }

          for (const rej of rejectedDocs) {
            if (rej.remarks && !deficiencies.some((d) => d.name === rej.documentName)) {
              deficiencies.push({
                name: rej.documentName || "Document",
                remarks: rej.remarks,
              });
            }
          }

          context.documentStats = {
            total: totalDocs || 12,
            verified: verifiedDocs.length,
            rejected: rejectedDocs.length || deficiencies.length,
            pending: Math.max(0, (totalDocs || 12) - verifiedDocs.length - (rejectedDocs.length || deficiencies.length)),
          };
          context.deficiencies = deficiencies;
        }

        // Fetch Payment / FDR status using targetCollegeId
        const payment = await Payment.findOne({
          $or: [{ collegeId: targetCollegeId }, ...(institution?._id ? [{ institutionId: institution._id }] : [])],
        }).sort({ createdAt: -1 });
        if (payment) {
          context.fdrStatus = payment.status;
          context.fdrAmount = payment.amount;
          context.fdrNumber = payment.referenceNumber;
          context.fdrBank = payment.bankName;
          context.fdrMaturityDate = payment.maturityDate;
        }

        // Fetch Release Request using targetCollegeId
        const release = await ReleaseRequest.findOne({
          $or: [{ collegeId: targetCollegeId }, ...(institution?._id ? [{ institutionId: institution._id }] : [])],
        }).sort({ createdAt: -1 });
        if (release) {
          context.releaseStatus = release.status;
          context.releaseRequestId = release.releaseRequestId;
        }
      }
    } else if (role === "AICTE_FD_EMPLOYEE") {
      const pendingApps = await Application.countDocuments({ status: { $in: ["SUBMITTED", "UNDER_REVIEW"] } });
      const pendingFdr = await Payment.countDocuments({ status: { $in: ["SUBMITTED", "PENDING_VERIFICATION"] } });
      const pendingRelease = await ReleaseRequest.countDocuments({ status: { $in: ["SUBMITTED", "UNDER_REVIEW", "Pending"] } });
      context.fdPendingTasks = {
        applications: pendingApps,
        fdrVerifications: pendingFdr,
        releaseRequests: pendingRelease,
      };
      context.workflowStage = "Document Verification & Financial Review";
    } else if (role === "PGRC_EMPLOYEE") {
      const pendingPgrc = await Complaint.countDocuments({ portalType: "pgrc", status: { $ne: "RESOLVED" } });
      context.pgrcPendingComplaints = pendingPgrc;
      context.workflowStage = "Public Grievance Investigation";
    } else if (role === "VIGILANCE_EMPLOYEE") {
      const pendingVig = await Complaint.countDocuments({ portalType: "vigilance", status: { $ne: "RESOLVED" } });
      context.vigilancePendingCases = pendingVig;
      context.workflowStage = "Vigilance Case Assessment";
    }
  } catch (err) {
    console.error("Error resolving portal context:", err);
  }

  return context;
}

// ── 5. Document Attachment Analysis ─────────────────────────────────────────
export async function extractAndAnalyzeAttachment(
  filePath: string,
  originalName: string,
  _mimeType: string
): Promise<{ extractedSnippet: string; findings: string[] }> {
  let extractedText = "";
  const findings: string[] = [];
  const ext = path.extname(originalName).toLowerCase();

  try {
    if (ext === ".txt") {
      extractedText = fs.readFileSync(filePath, "utf-8");
    } else if (ext === ".pdf") {
      const dataBuffer = fs.readFileSync(filePath);
      try {
        if (typeof pdfParse === "function") {
          const pdfData = await (pdfParse as any)(dataBuffer);
          extractedText = pdfData.text || "";
        } else if (pdfParse?.PDFParse) {
          const parser = new pdfParse.PDFParse({ data: dataBuffer });
          await parser.load();
          const parsed = await parser.getText();
          extractedText = typeof parsed === "string" ? parsed : parsed?.text || "";
        }
      } catch (pdfErr) {
        const rawString = dataBuffer.toString("utf-8");
        const cleanMatches = rawString.match(/[\x20-\x7E\t\r\n]{4,}/g);
        extractedText = cleanMatches ? cleanMatches.join(" ") : `[PDF document: ${originalName}]`;
      }
    } else if (ext === ".docx") {
      const docxResult = await mammoth.extractRawText({ path: filePath });
      extractedText = docxResult.value || "";
    } else if ([".png", ".jpg", ".jpeg"].includes(ext)) {
      extractedText = `[Scanned Graphic / Image Document: ${originalName}]`;
      findings.push(
        "Image document uploaded. Ensure the scan is clear, with municipal or notary stamps visibly legible for official FD verification."
      );
    }
  } catch (err) {
    console.error("Document text extraction error:", err);
    extractedText = `[Unable to extract text from ${originalName}]`;
  }

  const cleanText = extractedText.replace(/\s+/g, " ").trim();
  const lower = cleanText.toLowerCase();

  if (lower.includes("fdr") || lower.includes("fixed deposit") || lower.includes("security deposit")) {
    if (lower.includes("regional officer") && lower.includes("aicte")) {
      findings.push("Joint Name: AICTE Regional Officer endorsement detected.");
    } else {
      findings.push("Deficiency Alert: Clause 1.12 requires FDR in the Joint Name with Regional Officer, AICTE.");
    }

    if (lower.includes("10 year") || lower.includes("ten year") || lower.includes("maturity")) {
      findings.push("Tenure Compliance: 10-year lock-in period mentioned.");
    } else {
      findings.push("Mandatory Notice: Ensure FDR maturity duration complies with Appendix 10 (10-year term).");
    }

    if (lower.includes("lien") || lower.includes("non-encashment")) {
      findings.push("Statutory Lien: Bank non-encashment / lien condition confirmed.");
    }
  }

  if (lower.includes("affidavit")) {
    if (lower.includes("stamp") || lower.includes("notary") || lower.includes("sworn")) {
      findings.push("Format: Notary / stamp paper sworn declaration language identified.");
    }
    if (lower.includes("affidavit 6")) {
      findings.push("Specific Reference: Affidavit 6 format for Release of Security Deposit identified.");
    }
  }

  if (findings.length === 0 && cleanText.length > 50) {
    findings.push("Document text extracted successfully. Ready for comparison against handbook requirements.");
  }

  return {
    extractedSnippet: cleanText.slice(0, 1500),
    findings,
  };
}

// ── 6. Dynamic Question-Specific Response Generator ─────────────────────────
export function synthesizeQuestionAnswer({
  userQuery,
  resolvedQuery,
  portalContext,
  clauses,
  attachmentData,
  history,
}: {
  userQuery: string;
  resolvedQuery: string;
  portalContext: any;
  clauses: IHandbookClause[];
  attachmentData?: { filename: string; snippet: string; findings: string[] };
  history?: Array<{ role: string; content: string }>;
}): string {
  const q = resolvedQuery.toLowerCase();
  const primaryClause = clauses[0];

  // ── A. Definition / Meaning of FDR ────────────────────────────────────────
  if (
    q.includes("what is fdr") ||
    q.includes("explain fdr") ||
    q.includes("meaning of fdr") ||
    (q.includes("fdr") && (q.includes("what is") || q.includes("tell me about")))
  ) {
    return (
      `**Fixed Deposit Receipt (FDR)** in AICTE regulatory terms refers to the mandatory **Security Deposit** created in a Scheduled Commercial Bank by an institution seeking approval.\n\n` +
      `### Key Regulatory Requirements under the AICTE Approval Process Handbook:\n` +
      `1. **Joint Account Mandate (Clause 1.12):** The FDR must be established jointly in the name of the President/Chairman/Secretary of the Applicant Trust/Society/Company and the **Regional Officer, AICTE**.\n` +
      `2. **Mandatory 10-Year Lock-in (Appendix 10):** The security deposit must be created for a fixed term of strictly **10 years**.\n` +
      `3. **Statutory Lien & Non-Encashment:** The FDR remains pledged under Council lien and cannot be encashed, hypothecated, or used for loans without written authorization from the AICTE Approval Bureau.\n` +
      `4. **Prescribed Amounts (Appendix 10):** ₹35 Lakhs for Undergraduate Engineering Degree institutions; ₹15 Lakhs for Diploma/Management/MCA programs.\n` +
      `5. **Severe Penalty for Unauthorized Encashment (Clause 7.7):** Premature encashment results in immediate 50% intake reduction, placing the institution under 'No Admission' category, and legal action.`
    );
  }

  // ── A1. FDR Maturity & Refund / Withholding (Verified 5-Tier Rule) ────────
  if (
    (q.includes("maturity") && (q.includes("fund") || q.includes("deposit") || q.includes("not back") || q.includes("back") || q.includes("return") || q.includes("withhold") || q.includes("forfeit") || q.includes("release"))) ||
    (q.includes("when") && q.includes("maturity") && q.includes("institution")) ||
    (q.includes("security deposit") && (q.includes("not back") || q.includes("not returned") || q.includes("withheld") || q.includes("forfeited")))
  ) {
    return getFdrMaturityAndRefundExplanation(portalContext).explanation;
  }

  // ── A2. EoD vs EoA Distinction & Rectification Procedure ───────────────────
  if (
    q.includes("eod") ||
    (q.includes("deficiency") && q.includes("eoa")) ||
    q.includes("extension of deficiency") ||
    q.includes("letter of deficiency")
  ) {
    const isAction = q.includes("suppose") || q.includes("what to do") || q.includes("what should i do") || q.includes("next step");
    return getEodVsEoaExplanation(isAction).explanation;
  }

  // ── A3. Why is my FDR Release Blocked? ──────────────────────────────────────
  if (
    (q.includes("why") && (q.includes("fdr release") || q.includes("release blocked") || q.includes("deposit blocked") || q.includes("fdr blocked"))) ||
    (q.includes("release") && q.includes("blocked"))
  ) {
    if (portalContext.role === "INSTITUTION") {
      let resp = `According to your authenticated records in the AICTE Portal:\n\n`;
      if (portalContext.releaseRequestId) {
        resp += `- **Release Request ID:** \`${portalContext.releaseRequestId}\`\n`;
        resp += `- **Release Status:** **${portalContext.releaseStatus || "Pending Verification"}**\n\n`;
      }
      resp +=
        `### Applicable Clearance & Document Verification Requirements:\n` +
        `Under AICTE Finance Division (FD) release verification procedures, deposit release requires affirmative compliance across 3 criteria:\n\n` +
        `1. **All 4 Mandatory Documents Verified:** Extension of Approval (EoA), Joint Undertaking (Affidavit 6), Release Approval Letter, and FDR Receipt Copy. If any file is pending review or deficient, release is held under **DOCUMENT_DEFICIENCY**.\n` +
        `2. **PGRC Clearance:** If any student/faculty grievance is currently active or unresolved, status is set to **MATURITY DATE EXTENDED**. Any **PROVEN** complaint sets clearance to **REJECTED**, blocking release.\n` +
        `3. **Vigilance Clearance:** If any vigilance inquiry is underway, status is set to **MATURITY DATE EXTENDED**. Any **PROVEN** investigation sets clearance to **REJECTED**, blocking release.\n\n` +
        `### Where to View & Next Steps:\n` +
        `- Navigate to **Receive → Deposit Details** (\`/institution/receive/deposit\`) to review your live clearance snapshot.\n` +
        `- If documents were deficient, re-upload them via **Submit → Release Application** (\`/institution/submit/release\`).\n` +
        `- If blocked by a pending grievance or vigilance inquiry, resolve the outstanding complaint with the respective cell to obtain clearance.`;
      return resp;
    }
  }

  // ── B. Portal Submission Steps for Approval Application ───────────────────
  if (
    q.includes("how do i submit") ||
    q.includes("how to submit") ||
    q.includes("submit my approval") ||
    q.includes("submit approval application") ||
    (q.includes("approval application") && q.includes("how"))
  ) {
    return (
      `To submit your approval application in the **AICTE Institution Portal**, follow these official steps:\n\n` +
      `### Step-by-Step Approval Application Workflow:\n` +
      `1. **Access the Module:** In the sidebar menu, click **Submit → Approval Seeking** (\`/institution/submit/approval\`).\n` +
      `2. **Choose Application Type:** Select either **Letter of Approval (LoA)** for a new technical institution or **Extension of Approval (EoA)** for existing approved institutions.\n` +
      `3. **Review Mandatory Documents (Appendix 11 & Clause 6.1):** The portal displays all **12 statutory document categories** (e.g. Registered Land Documents, Approved Building Plan, Fire Safety NOC, Structural Stability, Prescribed E-Affidavit, Trust Registration).\n` +
      `4. **Upload Verification Files:** Upload clean PDF files for every mandatory slot. Ensure each certificate contains the official seal, competent authority signature, and date.\n` +
      `5. **Submit to Scrutiny:** Once all 12 document slots show uploaded files (progress indicates *12 / 12 Uploaded*), click **Submit Application**.\n` +
      `6. **Scrutiny Committee Review (Clause 1.6):** Your submission is forwarded to the AICTE Finance & Document (FD) employee verification queue for Scrutiny and verification.`
    );
  }

  // ── C. Document Rejection and Deficiency Inquiry ───────────────────────────
  if (
    q.includes("rejected") ||
    q.includes("why was my document") ||
    q.includes("deficiency remarks") ||
    q.includes("document rejection") ||
    q.includes("remarks on my document")
  ) {
    if (portalContext.role === "INSTITUTION") {
      const deficiencies = portalContext.deficiencies || [];
      if (deficiencies.length > 0) {
        let resp = `According to your authenticated application record (**${portalContext.applicationNumber || "Active Application"}**), the following document deficiencies were marked by the AICTE FD verification officer under **Clause 1.6**:\n\n`;
        deficiencies.forEach((d: any, idx: number) => {
          resp += `**${idx + 1}. ${d.name}**\n- **FD Officer Remark / Reason:** *"${d.remarks}"*\n\n`;
        });
        resp +=
          `### How to Correct Deficiencies:\n` +
          `1. Prepare the rectified, authentic replacement PDF addressing the specific remark above.\n` +
          `2. Go to **Receive → Complaint Outcome Letters** (\`/institution/receive/complaint-letters\`) to review full verification history and remarks.\n` +
          `3. Navigate to **Submit → Approval Seeking** (\`/institution/submit/approval\`) to re-upload the corrected document for Re-Scrutiny.`;
        return resp;
      }

      if (portalContext.documentStats?.verified > 0 && portalContext.documentStats?.rejected === 0) {
        return (
          `Good news! None of your uploaded documents are currently marked as rejected.\n\n` +
          `- **Application Reference:** ${portalContext.applicationNumber || "Active"}\n` +
          `- **Document Verification Progress:** ${portalContext.documentStats.verified} of ${portalContext.documentStats.total} documents have been officially **Verified** by the FD team.\n` +
          `- **Application Status:** **${portalContext.applicationStatus || "In Progress"}**.\n\n` +
          `You can view verified details on the dashboard or under **Receive → LoA / EoA** once processing is complete.`
        );
      }

      return (
        `No document rejections are currently recorded for your institution. If you have not submitted your application yet, upload all 12 mandatory documents under **Submit → Approval Seeking** (\`/institution/submit/approval\`) to proceed to Scrutiny.`
      );
    }
  }

  // ── D. Post-FDR Submission Next Steps ──────────────────────────────────────
  if (
    q.includes("after submitting my fdr") ||
    q.includes("submitted fdr") ||
    q.includes("after fdr submission") ||
    q.includes("what next after fdr") ||
    (q.includes("fdr") && q.includes("what should i do after"))
  ) {
    let fdrDetail = "";
    if (portalContext.fdrNumber) {
      fdrDetail = ` (FDR Ref: **${portalContext.fdrNumber}**, Amount: **₹${portalContext.fdrAmount?.toLocaleString() || "N/A"}**, Status: **${portalContext.fdrStatus}**)`;
    }

    return (
      `Here is what happens and what you should do after submitting your FDR${fdrDetail}:\n\n` +
      `### 1. Finance Division (FD) Verification (Clause 1.12):\n` +
      `Your submitted FDR receipt is reviewed by an authorized AICTE FD Employee who verifies:\n` +
      `- That the FDR is drawn in the joint name of the Trust/Society and the **Regional Officer, AICTE**.\n` +
      `- That the amount strictly complies with **Appendix 10** for your program category.\n` +
      `- That the maturity duration is set for a minimum of **10 years** with a statutory bank lien endorsement.\n\n` +
      `### 2. Issuance of Approval Letter (LoA / EoA) (Clause 1.14):\n` +
      `Once the FD Employee verifies the FDR instrument, the Approval Bureau generates and dispatches the official **Letter of Approval (LoA)** or **Extension of Approval (EoA)**.\n\n` +
      `### 3. What You Should Do in the Portal:\n` +
      `- Monitor your deposit verification status under **Receive → Deposit Details** (\`/institution/receive/deposit\`).\n` +
      `- When issued, download your official approval letter under **Receive → LoA / EoA** (\`/institution/receive/loa-eoa\`).`
    );
  }

  // ── E. Security Deposit Release Procedures (Clause 6.46) ───────────────────
  if (
    q.includes("release") &&
    (q.includes("fdr") || q.includes("security deposit") || q.includes("deposit") || q.includes("refund"))
  ) {
    return (
      `Release of Security Deposit / Joint FDR is governed strictly by **Clause 6.46** of the AICTE Approval Process Handbook:\n\n` +
      `### Mandatory Eligibility & Requirements:\n` +
      `1. **10-Year Maturity:** The deposit is eligible for release only after completion of the 10-year lock-in period (or upon Council-authorized institutional closure).\n` +
      `2. **Mandatory Documents (Clause 6.46(a)):** Formal request letter, original discharged FDR copy, notarized **Affidavit 6** (declaring zero student fee dues and cleared faculty salaries), and the latest EoA copy.\n` +
      `3. **Inter-Departmental Clearances (Clause 6.46(b)):** Affirmative clearance is mandatory from:\n` +
      `   - **Public Grievance Redressal Cell (PGRC):** Confirming no pending fee refund or certificate retention complaints (Clause 6.45).\n` +
      `   - **Vigilance Cell:** Confirming no ongoing embezzlement or fraud inquiries (Clause 6.46(e)).\n` +
      `4. **Council Authorization (Clause 6.46(c)):** The Approval Bureau issues a formal **Letter of Discharge (LoD)** / NOC to the issuing bank authorizing lien release.\n\n` +
      `**Portal Action:** Submit your request under **Submit → Release Application** (\`/institution/submit/release\`).`
    );
  }

  // ── F. Follow-Up Questions (Context-Resolved) ──────────────────────────────
  if (
    q.includes("what documents are required for it") ||
    q.includes("what documents for it") ||
    q.includes("required documents")
  ) {
    if (q.includes("fdr") || q.includes("deposit")) {
      return (
        `For submitting your **Joint Fixed Deposit Receipt (FDR)** under **Clause 1.12** and **Appendix 10**, the required documents are:\n\n` +
        `1. Scanned copy of the original Fixed Deposit Receipt issued by a Scheduled Commercial Bank.\n` +
        `2. Bank Letter certifying the FDR is in the joint names of the Society/Trust and the **Regional Officer, AICTE**.\n` +
        `3. Statutory Bank Lien confirmation stating the deposit cannot be encashed without prior Council approval.\n` +
        `4. Declaration undertaking on institution letterhead.\n\n` +
        `**Where to upload:** Navigate to **Submit → Payment / FDR Submission** (\`/institution/submit/payment\`).`
      );
    }
    if (q.includes("release")) {
      return (
        `For requesting **FDR Release** under **Clause 6.46(a)**, you must submit:\n\n` +
        `1. Formal application request signed by the authorized signatory of the Trust/Society.\n` +
        `2. Discharged FDR certificate copy from the issuing bank.\n` +
        `3. Sworn **Affidavit 6** on ₹100/- non-judicial stamp paper certifying no student dues and cleared staff salaries.\n` +
        `4. Initial Letter of Approval (LoA) and latest Extension of Approval (EoA).\n` +
        `5. Canceled cheque and bank account details for RTGS transfer.\n\n` +
        `**Where to upload:** Navigate to **Submit → Release Application** (\`/institution/submit/release\`).`
      );
    }
  }

  if (
    q.includes("where should i upload") ||
    q.includes("where do i upload") ||
    q.includes("where to upload")
  ) {
    if (q.includes("fdr") || q.includes("deposit")) {
      return (
        `You should upload your FDR details in the **Institution Portal** at:\n\n` +
        `👉 **Submit → Payment / FDR Submission** (\`/institution/submit/payment\`)\n\n` +
        `Enter the FDR Reference Number, Amount, Bank Name, Maturity Date, and upload the scanned receipt PDF.`
      );
    }
    if (q.includes("release")) {
      return (
        `You should submit your FDR release documents at:\n\n` +
        `👉 **Submit → Release Application** (\`/institution/submit/release\`)\n\n` +
        `Upload Affidavit 6, FDR receipt copy, and clearance request declarations.`
      );
    }
    return (
      `For initial approval documents (Land, Building Plan, Fire NOC, etc.), upload them under:\n\n` +
      `👉 **Submit → Approval Seeking** (\`/institution/submit/approval\`).`
    );
  }

  // ── G. Workflow Next Steps Based on Real Application Stage ─────────────────
  if (
    q.includes("what should i do next") ||
    q.includes("what to do next") ||
    q.includes("my next step") ||
    q.includes("next step")
  ) {
    if (portalContext.role === "INSTITUTION") {
      if (portalContext.applicationStatus === "APPROVED") {
        return (
          `Your approval application (**${portalContext.applicationNumber || "Active"}**) is **APPROVED**!\n\n` +
          `### Recommended Next Steps:\n` +
          `1. **Download Official Letters:** Go to **Receive → LoA / EoA** (\`/institution/receive/loa-eoa\`) to download your official Letter of Approval or Extension of Approval.\n` +
          `2. **Check Security Deposit:** If Joint FDR was submitted, monitor maturity and lien details under **Receive → Deposit Details** (\`/institution/receive/deposit\`).\n` +
          `3. **State Affiliation:** Submit the AICTE LoA/EoA to your designated State Board or Affiliating University for student admissions.`
        );
      }
      if (portalContext.applicationStatus === "SUBMITTED" || portalContext.applicationStatus === "UNDER_REVIEW") {
        return (
          `Your application (**${portalContext.applicationNumber || "Active"}**) is currently **Submitted** and under Scrutiny.\n\n` +
          `### Current Status & Next Steps:\n` +
          `1. **Document Verification (Clause 1.6):** The AICTE FD team is currently examining your uploaded documents.\n` +
          `2. **Deficiency Tracking:** Check **Receive → Complaint Outcome Letters** (\`/institution/receive/complaint-letters\`) to see any remarks from the verification officers.\n` +
          `3. **FDR Preparation:** Prepare your Joint Fixed Deposit Receipt in accordance with **Clause 1.12** and **Appendix 10** so you can submit it immediately upon recommendation.`
        );
      }
      return (
        `### Current Status & Next Steps:\n` +
        `1. Navigate to **Submit → Approval Seeking** (\`/institution/submit/approval\`).\n` +
        `2. Ensure all 12 mandatory document categories are uploaded.\n` +
        `3. Submit the application to initiate the official Scrutiny Committee review.`
      );
    }

    if (portalContext.role === "AICTE_FD_EMPLOYEE") {
      return (
        `As an authenticated **FD Employee**, your recommended next actions are:\n\n` +
        `1. Review pending applications in the **Approval Seeking Applications** queue.\n` +
        `2. Verify uploaded PDFs against **Appendix 11** standards, marking them as *Verified* or *Rejected with deficiency remarks*.\n` +
        `3. Inspect submitted Joint FDR instruments under **FDR Verification** in accordance with **Clause 1.12** and **Appendix 10**.\n` +
        `4. Process Release Applications under **Clause 6.46** after confirming PGRC and Vigilance clearances.`
      );
    }

    if (portalContext.role === "PGRC_EMPLOYEE") {
      return (
        `As an authenticated **PGRC Employee**, your next workflow tasks include:\n\n` +
        `1. Review incoming grievance complaints against technical institutions under **Clause 7.10**.\n` +
        `2. Verify whether student fee refund complaints satisfy **Clause 6.45** requirements.\n` +
        `3. Conduct hearings through the Standing Complaint Committee (SCC).\n` +
        `4. Issue clearance feedback for institutions applying for FDR release under **Clause 6.46(b)**.`
      );
    }

    if (portalContext.role === "VIGILANCE_EMPLOYEE") {
      return (
        `As an authenticated **Vigilance Employee**, your current workflow actions include:\n\n` +
        `1. Review vigilance cases under **Clause 7.10** and **Clause 7.1**.\n` +
        `2. Enforce security deposit freezing under **Clause 6.46(e)** where fraud or fund diversion inquiries are pending.\n` +
        `3. Provide clearance certification for valid Release Applications.`
      );
    }
  }

  // ── LoA Process (Chapter 1) ───────────────────────────────────────────────
  if (
    (q.includes("loa") && (q.includes("process") || q.includes("procedure") || q.includes("how to get") || q.includes("steps") || q.includes("apply"))) ||
    q.includes("what is the aicte loa process") ||
    q.includes("letter of approval process")
  ) {
    return (
      `The **Letter of Approval (LoA)** process for establishing a New Technical Institution under **Chapter 1** of the AICTE Approval Process Handbook (2024–2027) follows these mandatory procedural steps:\n\n` +
      `### Step-by-Step AICTE LoA Process:\n` +
      `1. **Online Portal Application & TER Charges (Clause 1.3 & 1.4.2):** Promoters (registered Trust/Society/Section 8 Company under Clause 1.3.4) submit the online application via the AICTE Web Portal along with prescribed Technical Education Regulatory (TER) charges.\n` +
      `2. **Uploading Mandatory Statutory Documents (Clause 1.4.6, Clause 6.1 & Annexure-1):** Upload all 12 statutory document categories under Appendix 11, including registered land deed (Annexure-3), approved building plan, structural stability certificate, fire safety NOC, and sworn Affidavit 1.\n` +
      `3. **Scrutiny Committee Evaluation (Clause 1.8):** Applications are examined by the Scrutiny Committee for document validity. If deficiencies are found, the applicant is invited to present rectification before the Re-Scrutiny Committee.\n` +
      `4. **Expert Visit Committee (EVC) Inspection (Clause 1.9):** Physical or virtual verification of campus infrastructure, barrier-free access (Annexure-3), instructional facilities, and initial faculty selection (Clause 1.6 & Annexure-5).\n` +
      `5. **Appellate Remedies (Clause 1.11):** Deficiencies raised can be represented before the Standing Hearing Committee (SHC) or Standing Appellate Committee (SAC).\n` +
      `6. **Joint Security Deposit Creation (Clause 1.12 & Appendix 10):** Upon recommendation by the Executive Committee, the applicant must establish a 10-year Joint Fixed Deposit Receipt (FDR) in joint name with the **Regional Officer, AICTE** (e.g. ₹35 Lakhs for Technical Degree).\n` +
      `7. **Issuance of Letter of Approval (LoA) (Clause 1.10 & Clause 1.14):** AICTE issues the official Letter of Approval, valid for 3 academic years for obtaining university affiliation and student intake.`
    );
  }

  // ── Post-LoA Next Steps ───────────────────────────────────────────────────
  if (
    q.includes("after receiving loa") ||
    q.includes("after loa") ||
    (q.includes("loa") && (q.includes("what should i do after") || q.includes("what to do after") || q.includes("next step") || q.includes("after receiving")))
  ) {
    return (
      `After receiving the official **Letter of Approval (LoA)** from AICTE under **Clause 1.14**, the institution must complete the following practical and regulatory next steps before admitting students:\n\n` +
      `### Practical Next Steps Supported by the AICTE Handbook:\n` +
      `1. **Obtain University Affiliation / State Board Approval (Clause 1.14 & Clause 1.10):** Submit the AICTE LoA to your designated Affiliating University or State Board of Technical Education to secure formal academic affiliation. Institutions cannot admit students without university affiliation.\n` +
      `2. **Participate in State Centralized Admission (Clause 1.7):** Coordinate with the State Admission Authority / Centralized Counseling body to admit students strictly within approved intake and reservation guidelines.\n` +
      `3. **Complete Faculty & Principal Recruitment (Clause 1.6 & Annexure-5):** Ensure the Principal/Director and teaching faculty are recruited as per AICTE Cadre Ratio and qualifications before starting academic classes.\n` +
      `4. **Maintain 10-Year Joint FDR Under Lien (Clause 1.12 & Clause 7.7):** The Security Deposit created with the Regional Officer, AICTE must remain untouched for the mandatory 10-year period. Unauthorized premature encashment incurs immediate penal reduction of intake under Clause 7.7.\n` +
      `5. **Annual Extension of Approval (EoA) (Clause 2.1):** For subsequent academic sessions, apply for annual Extension of Approval through the AICTE Portal under Chapter 2.`
    );
  }

  // ── LoA Documents Checklist (Context-Aware) ───────────────────────────────
  if (
    (q.includes("document") || q.includes("checklist")) &&
    (q.includes("loa") || q.includes("new institution") || q.includes("new technical") || q.includes("what documents are needed"))
  ) {
    return (
      `For a **New Technical Institution / LoA Application** under **Clause 6.1, Annexure-1, and Appendix 11**, the mandatory documents required are:\n\n` +
      `### Mandatory Document Checklist for LoA:\n` +
      `1. **Land Ownership & Title Documents (Clause 1.5 & Annexure-3):** Registered sale deed, gift deed, or government lease (min. 30 years) and Land Use Certificate from competent revenue authority.\n` +
      `2. **Approved Building Plan & Master Plan (Annexure-3):** Approved by the competent municipal/town planning authority showing instructional, administrative, and amenities carpet areas.\n` +
      `3. **Structural Stability Certificate:** Issued by a registered structural engineer or government body certifying safety.\n` +
      `4. **Fire Safety Certificate / NOC:** Issued by the Competent Fire Service Authority of the State.\n` +
      `5. **Sworn Affidavit 1 (Affidavit 1):** Sworn before a First Class Judicial Magistrate or Public Notary on stamp paper affirming disclosure authenticity (Clause 1.4.4).\n` +
      `6. **Promoter Registration:** Registration certificate, Memorandum of Association (MoA), and Bye-laws of the Trust/Society/Section 8 Company (Clause 1.3.4).\n` +
      `7. **Barrier-Free Environment Certificate:** Confirmation of disabled-friendly ramps, lifts, and toilets (Annexure-3).\n` +
      `8. **Sanction Letters for Utilities:** Potable water testing report and commercial electric power sanction letter.\n` +
      `9. **Proof of Bank Funds / FDR (Clause 1.5.3, Clause 1.12 & Appendix 10):** Bank certificate of funds and Joint FDR with Regional Officer, AICTE.\n\n` +
      `**Where to upload:** Navigate to **Submit → Approval Seeking** (\`/institution/submit/approval\`) in the Institution Portal.`
    );
  }

  // ── H. Fallback to Grounded Clause Explanation ─────────────────────────────
  if (primaryClause) {
    let out =
      `According to the **${primaryClause.version || "AICTE Approval Process Handbook (2024–2027)"}**, here are the regulations regarding your inquiry:\n\n` +
      `### **${primaryClause.clauseNumber}: ${primaryClause.title}**\n` +
      `- **Chapter:** ${primaryClause.chapter}\n` +
      `- **Requirement Type:** **${primaryClause.requirementType}**\n` +
      `- **Page Reference:** Page ${primaryClause.pageNumber || "N/A"}\n\n` +
      `${primaryClause.content}\n\n` +
      `### Plain English Summary:\n${primaryClause.summary}\n`;

    if (primaryClause.exceptions) {
      out += `\n> **Regulatory Exception:** ${primaryClause.exceptions}\n`;
    }

    if (clauses.length > 1) {
      out += `\n### Related AICTE Handbook Provisions:\n`;
      clauses.slice(1, 3).forEach((c) => {
        out += `- **${c.clauseNumber} (${c.title})**: ${c.summary} *(Page ${c.pageNumber}, ${c.year})*\n`;
      });
    }

    return out;
  }

  return (
    `The available AICTE handbook evidence is insufficient to answer this inquiry. The official AICTE Approval Process Handbook (2024–2027) does not contain provisions or regulations regarding this topic.`
  );
}

// ── 7. Main Chatbot Response Engine ─────────────────────────────────────────
export async function generateChatbotResponse({
  userQuery,
  portalContext,
  clauses,
  attachmentData,
  history,
}: {
  userQuery: string;
  portalContext: any;
  clauses: IHandbookClause[];
  attachmentData?: { filename: string; snippet: string; findings: string[] };
  history?: Array<{ role: string; content: string }>;
}): Promise<{
  content: string;
  citations: any[];
  isRefusal: boolean;
  modelConfigured: boolean;
}> {
  // 1. Lightweight Intent & Topic Check
  const intentResult = detectUserIntent(userQuery, history);
  if (intentResult.intent === "GREETING") {
    return {
      content: intentResult.reply || "Hello! How can I help you with AICTE procedures or the portal today?",
      citations: [],
      isRefusal: false,
      modelConfigured: true,
    };
  }
  if (intentResult.intent === "BASIC_CONVERSATION") {
    return {
      content: intentResult.reply || "You're welcome! Let me know if you need any assistance with AICTE procedures or the portal.",
      citations: [],
      isRefusal: false,
      modelConfigured: true,
    };
  }
  if (intentResult.intent === "UNRELATED" || !intentResult.allowed) {
    return {
      content: "It is not under my coverage",
      citations: [],
      isRefusal: true,
      modelConfigured: true,
    };
  }

  // 2. Format citations from retrieved clauses
  const citations = clauses.map((c) => ({
    clauseNumber: c.clauseNumber,
    chapter: c.chapter,
    year: c.year,
    pageNumber: c.pageNumber,
    pdfPageNumber: c.pdfPageNumber,
    title: c.title,
    excerpt: c.summary,
    requirementType: c.requirementType,
  }));

  const apiKey =
    process.env.AI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.OPENAI_API_KEY;

  // Resolve contextual follow-up references using history
  const { resolvedQuery, detectedTopic } = resolveContextualQuery(userQuery, history || []);

  // 3. If Real AI Model credentials are configured, invoke LLM API
  if (apiKey) {
    try {
      const historyContext = (history || [])
        .slice(-4)
        .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
        .join("\n\n");

      const promptContext = `
You are the official AICTE AI Assistant integrated into the AICTE Unified Portal.
Your task is to answer user queries accurately and specifically using verified regulations from the official AICTE Approval Process Handbook (APH 2024–2027) and current portal workflow context.

AUTHENTICATED USER CONTEXT:
- Role: ${portalContext.role}
- Portal: ${portalContext.portal}
- Current Route: ${portalContext.currentRoute}
- Current Workflow Stage: ${portalContext.workflowStage || "N/A"}
${portalContext.institutionName ? `- Institution: ${portalContext.institutionName} (${portalContext.collegeId})` : ""}
${portalContext.applicationNumber ? `- Application Ref: ${portalContext.applicationNumber} (${portalContext.applicationType || "LoA/EoA"}) - Status: ${portalContext.applicationStatus}` : ""}
${portalContext.documentStats ? `- Document Progress: ${portalContext.documentStats.verified}/${portalContext.documentStats.total} Verified, ${portalContext.documentStats.rejected} Rejected` : ""}
${
  portalContext.deficiencies && portalContext.deficiencies.length > 0
    ? `- Document Deficiencies Marked by FD: ${portalContext.deficiencies.map((d: any) => `${d.name} ("${d.remarks}")`).join("; ")}`
    : ""
}
${portalContext.fdrNumber ? `- Submitted FDR: ${portalContext.fdrNumber} (Status: ${portalContext.fdrStatus}, Amount: ₹${portalContext.fdrAmount})` : ""}

AUTHENTICATED PORTAL NAVIGATION PATHWAYS:
- Initial Approval Seeking & 12 Mandatory Documents: Submit → Approval Seeking (/institution/submit/approval)
- Joint Fixed Deposit Receipt (FDR) Submission: Submit → Payment / FDR Submission (/institution/submit/payment)
- Security Deposit / FDR Release Application: Submit → Release Application (/institution/submit/release)
- Review Deficiencies & Verification Remarks: Receive → Complaint Outcome Letters (/institution/receive/complaint-letters)
- Download Official Approval Letters: Receive → LoA / EoA (/institution/receive/loa-eoa)
- View Deficiency Notices (LoD / EoD): Receive → LoD / EoD (/institution/receive/lod-eod)
- View Joint Deposit & Maturity Details: Receive → Deposit Details (/institution/receive/deposit)

VERIFIED DOMAIN & POLICY RULES:
- FDR Security Deposit Maturity vs. Return: Reaching the 8 or 10-year maturity date alone does NOT automatically return funds. The institution must submit a Release Request (/institution/submit/release) with Affidavit 6, EoA, and bank documents. All 4 mandatory documents must be verified by FD. PGRC and Vigilance clearances must be APPROVED independently. If an investigation is ongoing in either department, status is MATURITY DATE EXTENDED (release is blocked/held). If a complaint/investigation is PROVEN, status is REJECTED (release is blocked). A portal release rejection blocks the current request; statutory forfeiture of deposit requires formal action by the AICTE Executive Committee / Council under Clause 4.10 Note iii and Chapter VII norms.
- EoD vs. EoA: EoA (Extension of Approval) is the annual approval granted under Chapter II (Clause 2.1) to conduct approved courses. EoD (Extension of Deficiency) or LoD (Letter of Deficiency) is issued under Receive → LoD / EoD (/institution/receive/lod-eod) when deficiencies were identified during Scrutiny or compliance is overdue; approval is withheld. The institution must review the specific deficiencies in /institution/receive/lod-eod, rectify them, and re-upload corrected documents via Submit → Approval Seeking (/institution/submit/approval) before cutoff.

RECENT CONVERSATION HISTORY:
${historyContext || "None"}

VERIFIED RETRIEVED HANDBOOK CLAUSES:
${
  clauses.length > 0
    ? clauses
        .map(
          (c) =>
            `• [${c.clauseNumber}] "${c.title}" (${c.year}, ${c.chapter}, Page: ${c.pageNumber}${c.pdfPageNumber ? `, PDF Page: ${c.pdfPageNumber}` : ""}):
  Type: ${c.requirementType}
  Rule: ${c.content}
  Summary: ${c.summary}
  Exceptions: ${c.exceptions || "None"}`
        )
        .join("\n\n")
    : "No specific handbook clauses directly match this query."
}

${
  attachmentData
    ? `USER ATTACHED DOCUMENT ANALYSIS:
- Filename: ${attachmentData.filename}
- Findings: ${attachmentData.findings.join("; ")}
- Extracted Snippet: "${attachmentData.snippet.slice(0, 500)}..."`
    : ""
}

USER QUESTION: "${userQuery}"
${detectedTopic ? `(Resolved follow-up context: ${detectedTopic})` : ""}

CRITICAL GROUNDING RULES:
1. Answer ONLY what the retrieved handbook evidence, authenticated portal context, or portal navigation pathways directly support.
2. For questions asking where or how to upload documents or FDR, guide the user with the exact portal navigation route (e.g. /institution/submit/payment for FDR, or /institution/submit/approval for approval documents).
3. For procedure questions, explain practical next steps first, followed by supporting citations.
4. For portal status inquiries, rely strictly on the authenticated user context above.
5. NEVER invent or fabricate clauses, page numbers, regulations, amounts, deadlines, or interpretations.
6. CITE ONLY clauses that are actually present in the VERIFIED RETRIEVED HANDBOOK CLAUSES list above. Include Clause number, handbook edition/year, and page reference where available.
7. If a regulatory clause question cannot be answered from the retrieved handbook clauses and is not a portal navigation question, state: "The available handbook evidence is insufficient to answer this query."
8. If the user question is unrelated to AICTE, AICTE procedures, or the portal, output EXACTLY this one line and nothing else:
It is not under my coverage
`;

      if (process.env.GEMINI_API_KEY || apiKey.startsWith("AIza")) {
        const geminiModel = process.env.AI_MODEL || "gemini-3.8-flash";
        const geminiRes = await axios.post(
          `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`,
          {
            contents: [{ parts: [{ text: promptContext }] }],
          },
          { timeout: 15000 }
        );

        const aiText = geminiRes.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (aiText) {
          const trimmedAi = aiText.trim();
          if (
            trimmedAi === "It is not under my coverage" ||
            trimmedAi.toLowerCase().includes("not under my coverage")
          ) {
            return {
              content: "It is not under my coverage",
              citations: [],
              isRefusal: true,
              modelConfigured: true,
            };
          }

          const isInsufficient = trimmedAi.toLowerCase().includes("insufficient");
          const lowerQ = userQuery.toLowerCase();
          const isDomainSpecialQuery =
            (lowerQ.includes("where") && (lowerQ.includes("upload") || lowerQ.includes("submit"))) ||
            lowerQ.includes("eod") ||
            (lowerQ.includes("maturity") && (lowerQ.includes("fund") || lowerQ.includes("back") || lowerQ.includes("not back") || lowerQ.includes("return"))) ||
            lowerQ.includes("release blocked");

          if (isInsufficient && isDomainSpecialQuery) {
            const dynamicAnswer = synthesizeQuestionAnswer({
              userQuery,
              resolvedQuery,
              portalContext,
              clauses,
              attachmentData,
              history,
            });
            return {
              content: dynamicAnswer,
              citations: dynamicAnswer.toLowerCase().includes("insufficient") ? [] : citations,
              isRefusal: false,
              modelConfigured: true,
            };
          }

          return {
            content: trimmedAi,
            citations: isInsufficient ? [] : citations,
            isRefusal: false,
            modelConfigured: true,
          };
        }
      } else if (process.env.OPENAI_API_KEY || apiKey.startsWith("sk-")) {
        const openAiRes = await axios.post(
          "https://api.openai.com/v1/chat/completions",
          {
            model: process.env.AI_MODEL || "gpt-4o-mini",
            messages: [{ role: "user", content: promptContext }],
            temperature: 0.2,
          },
          {
            headers: { Authorization: `Bearer ${apiKey}` },
            timeout: 15000,
          }
        );

        const aiText = openAiRes.data?.choices?.[0]?.message?.content;
        if (aiText) {
          const trimmedAi = aiText.trim();
          if (
            trimmedAi === "It is not under my coverage" ||
            trimmedAi.toLowerCase().includes("not under my coverage")
          ) {
            return {
              content: "It is not under my coverage",
              citations: [],
              isRefusal: true,
              modelConfigured: true,
            };
          }

          const isInsufficient = trimmedAi.toLowerCase().includes("insufficient");
          const lowerQ = userQuery.toLowerCase();
          if (isInsufficient && (lowerQ.includes("where") && (lowerQ.includes("upload") || lowerQ.includes("submit")))) {
            const dynamicAnswer = synthesizeQuestionAnswer({
              userQuery,
              resolvedQuery,
              portalContext,
              clauses,
              attachmentData,
              history,
            });
            return {
              content: dynamicAnswer,
              citations: [],
              isRefusal: false,
              modelConfigured: true,
            };
          }

          return {
            content: trimmedAi,
            citations: isInsufficient ? [] : citations,
            isRefusal: false,
            modelConfigured: true,
          };
        }
      }
    } catch (llmErr: any) {
      console.error("AI Model API call failed, falling back to dynamic query engine:", llmErr.message || llmErr);
    }
  }

  // 4. Dynamic question-specific synthesis when AI credentials are not configured or API call timed out
  const dynamicAnswer = synthesizeQuestionAnswer({
    userQuery,
    resolvedQuery,
    portalContext,
    clauses,
    attachmentData,
    history,
  });

  const isInsufficient = dynamicAnswer.toLowerCase().includes("insufficient");

  return {
    content: dynamicAnswer,
    citations: isInsufficient ? [] : citations,
    isRefusal: false,
    modelConfigured: Boolean(apiKey),
  };
}
