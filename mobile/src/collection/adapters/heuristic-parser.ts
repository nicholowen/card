import { socialFieldKey, type OnDeviceParser, type ParsedFields, type RecognisedLine, type RecognisedText } from "../ports";

// The fallback on-device Parse (ADR 0004) for devices without an on-device
// model: contact details by pattern, then name, job title and company from
// what's left, using layout (text size and position) and the email address.

const EMAIL = /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}/i;
const WEBSITE = /\b(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}(?:\/[^\s]*)?/i;
/** A run of digits with the separators phone numbers are printed with, at least 7 digits long. */
const PHONE = /(?:\+\d{1,3}[\s.-]?)?(?:\(\d{1,4}\)[\s.-]?)?\d[\d\s.-]{5,}\d/;

/** A line being parsed, and whether a field has already claimed it. */
interface Line extends RecognisedLine {
  claimed: boolean;
}

export const heuristicParser: OnDeviceParser = {
  async parse(recognised: RecognisedText): Promise<ParsedFields> {
    const lines: Line[] = recognised.lines
      .map((line) => ({ ...line, text: line.text.trim(), claimed: false }))
      .filter((line) => line.text !== "")
      .sort(readingOrder);
    const fields: ParsedFields = {};

    const phones: Array<{ number: string; mobile: boolean }> = [];

    for (const line of lines) {
      if (line.claimed) continue; // Already part of an address.
      const email = line.text.match(EMAIL)?.[0];
      if (email) {
        line.claimed = true;
        fields.email ??= { value: email.toLowerCase(), confidence: 0.95 };
        // Some cards print the phone number on the same line, after a separator.
        const rest = line.text.replace(email, " ");
        const phone = isPhoneLine(rest) ? rest.match(PHONE)?.[0] : undefined;
        if (phone) phones.push({ number: phone.trim(), mobile: MOBILE_LABEL.test(rest.slice(0, rest.indexOf(phone))) });
        continue;
      }
      const social = matchSocial(line.text);
      if (social) {
        line.claimed = true;
        fields[socialFieldKey(social.network)] ??= { value: social.handle, confidence: 0.9 };
        continue;
      }
      if (STREET.test(line.text)) {
        // A card has one address field; a second address (often a postal one) is left out.
        const address = claimAddress(lines, line);
        fields.address ??= { value: address, confidence: 0.7 };
        continue;
      }
      const phone = line.text.match(PHONE)?.[0];
      if (phone && isPhoneLine(line.text)) {
        line.claimed = true;
        const label = line.text.slice(0, line.text.indexOf(phone));
        if (FAX_LABEL.test(label)) continue;
        phones.push({ number: phone.trim(), mobile: MOBILE_LABEL.test(label) });
        continue;
      }
      const website = line.text.match(WEBSITE)?.[0];
      if (website) {
        line.claimed = true;
        fields.website ??= { value: website.replace(/[.,;]+$/, ""), confidence: 0.85 };
      }
    }

    // A card has one phone field: the mobile when it's labelled, else the first number.
    const phone = phones.find((candidate) => candidate.mobile) ?? phones[0];
    if (phone) fields.phone = { value: phone.number, confidence: 0.9 };

    findIdentity(lines, fields);
    return fields;
  },
};

/** Social networks whose profile links are printed on cards, by the pattern of their links. */
const SOCIAL_LINKS: Array<{ network: string; link: RegExp }> = [
  { network: "LinkedIn", link: /linkedin\.com\/(?:in|company)\/([\w.-]+)/i },
  { network: "Instagram", link: /instagram\.com\/([\w.]+)/i },
  { network: "X", link: /(?:twitter|x)\.com\/(\w+)/i },
  { network: "Facebook", link: /facebook\.com\/([\w.]+)/i },
  { network: "GitHub", link: /github\.com\/([\w-]+)/i },
];

function matchSocial(text: string): { network: string; handle: string } | undefined {
  for (const { network, link } of SOCIAL_LINKS) {
    const handle = text.match(link)?.[1];
    if (handle) return { network, handle };
  }
  return undefined;
}

/** A street line ("12 Cuba Street") or the start of one ("Level 3", "PO Box 123"). */
const STREET =
  /(?:\b\d+[a-z]?\s+(?:[\p{L}'-]+\s+)+(?:st|street|rd|road|ave|avenue|dr|drive|lane|ln|pl|place|tce|terrace|quay|way|blvd|boulevard|cres|crescent|hwy|highway|parade|square|sq)\b|\b(?:level|suite|unit|floor|po box|p\.o\. box|private bag)\s+\d)/iu;

/** A line that continues an address: it has a postcode or names a country. */
const ADDRESS_CONTINUES = /\b\d{4,5}\b|\b(?:new zealand|nz|australia|aus|usa|united states|united kingdom|uk)\b/i;

/** Claims an address's first line and the lines that continue it, and joins them. */
function claimAddress(lines: Line[], first: Line): string {
  const parts = [first];
  const continues = (line: Line | undefined): line is Line =>
    !!line && ADDRESS_CONTINUES.test(line.text) && !EMAIL.test(line.text) && !isPhoneLine(line.text);
  for (let next = lines[lines.indexOf(first) + 1]; continues(next); ) {
    parts.push(next);
    next = lines[lines.indexOf(next) + 1];
  }
  for (const part of parts) part.claimed = true;
  return parts.map((part) => part.text.replace(/,\s*$/, "")).join(", ");
}

/**
 * Top to bottom, then left to right for lines side by side. OCR doesn't
 * promise any order, and the layout rules (an address's next line, the job
 * title under the name) depend on it.
 */
function readingOrder(a: RecognisedLine, b: RecognisedLine): number {
  const middle = (line: RecognisedLine) => line.box.y + line.box.height / 2;
  const sameRow = Math.abs(middle(a) - middle(b)) < Math.min(a.box.height, b.box.height) / 2;
  return sameRow ? a.box.x - b.box.x : a.box.y - b.box.y;
}

const FAX_LABEL = /\bf(?:ax)?\b/i;
const MOBILE_LABEL = /\b(?:m|mob|mobile|cell)\b/i;

/**
 * Name, job title and company from the lines no contact detail claimed. Wording
 * decides first (a title like "Director", a suffix like "Ltd"), then the email
 * address, then layout: the name is usually the largest person-shaped line.
 */
function findIdentity(lines: Line[], fields: ParsedFields): void {
  const unclaimed = () => lines.filter((line) => !line.claimed);
  const claim = (line: Line, key: string, confidence: number) => {
    line.claimed = true;
    fields[key] = { value: line.text, confidence };
  };

  const title = unclaimed().find((line) => TITLE_WORDS.test(line.text));
  if (title) claim(title, "jobTitle", 0.8);

  const company = unclaimed().find((line) => COMPANY_SUFFIX.test(line.text));
  if (company) claim(company, "company", 0.85);

  const local = emailLocalPart(fields.email?.value);
  const people = unclaimed().filter((line) => isPersonShaped(line.text));
  const agreed = local ? people.find((line) => nameMatchesEmail(line.text, local)) : undefined;
  const name = agreed ?? largest(people);
  if (name) claim(name, "name", agreed ? 0.9 : 0.7);

  if (!fields.company) {
    const domain = companyDomain(fields.email?.value);
    const fromDomain = domain ? unclaimed().find((line) => squash(line.text).includes(domain)) : undefined;
    // Without the domain to go on, the largest line left is often the company's logo text.
    const guess = fromDomain ?? largest(unclaimed());
    if (guess) claim(guess, "company", fromDomain ? 0.8 : 0.4);
  }

  if (!fields.jobTitle && name) {
    // A job title is usually printed just under the name.
    const below = lines[lines.indexOf(name) + 1];
    if (below && !below.claimed) claim(below, "jobTitle", 0.4);
  }
}

/** Words that mark a line as a job title. */
const TITLE_WORDS =
  /\b(?:ceo|cto|cfo|coo|cio|cmo|vp|chief|director|manager|head|lead|founder|co-founder|owner|partner|principal|president|engineer|developer|designer|architect|consultant|advis[eo]r|analyst|specialist|officer|executive|coordinator|associate|accountant|lawyer|solicitor|barrister|agent|representative|recruiter|producer|editor|photographer|scientist|researcher|nurse|doctor|teacher|lecturer|professor)\b/i;

/** Words that end, or mark, a company name. */
const COMPANY_SUFFIX =
  /\b(?:ltd|limited|inc|llc|llp|pty|plc|gmbh|corp|corporation|company|co\.|group|holdings|labs|studios?|solutions|consulting|consultants|partners|technologies|systems|agency|bank|trust|foundation)\b/i;

/** Two to four capitalised words with no digits, as a person's name is printed. */
function isPersonShaped(text: string): boolean {
  const words = text.split(/\s+/);
  return words.length >= 2 && words.length <= 4 && words.every((word) => /^\p{Lu}[\p{L}'’.-]*$/u.test(word));
}

/** Email inboxes shared by many people, which say nothing about a name (see Generic Identifier). */
const ROLE_INBOXES = new Set(["info", "hello", "hi", "sales", "admin", "contact", "enquiries", "office", "support", "team", "mail", "reception", "accounts"]);

/** Email providers anyone can sign up to, whose domain says nothing about a company. */
const FREE_MAIL = new Set(["gmail", "googlemail", "outlook", "hotmail", "live", "yahoo", "icloud", "me", "xtra", "protonmail", "proton", "aol"]);

function emailLocalPart(email: string | undefined): string | undefined {
  const local = email?.split("@")[0];
  return local && !ROLE_INBOXES.has(local) ? local : undefined;
}

/** The part of an email's domain that names the company, unless it's a free email provider. */
function companyDomain(email: string | undefined): string | undefined {
  const label = email?.split("@")[1]?.split(".")[0];
  return label && !FREE_MAIL.has(label) ? squash(label) : undefined;
}

/** True when a word of the name (three letters or more) is in the email's local part. */
function nameMatchesEmail(name: string, local: string): boolean {
  const squashedLocal = squash(local);
  return name
    .split(/\s+/)
    .map(squash)
    .some((word) => word.length >= 3 && squashedLocal.includes(word));
}

/** Lowercase letters and digits only, with accents removed, for loose comparison ("KŌWHAI Labs" → "kowhailabs"). */
function squash(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** The line with the tallest text; the topmost one when they're the same size. */
function largest(lines: Line[]): Line | undefined {
  return lines.reduce<Line | undefined>(
    (best, line) => (!best || line.box.height > best.box.height ? line : best),
    undefined,
  );
}

/** True when the line holds a phone number: a phone-shaped run of at least seven digits. */
function isPhoneLine(text: string): boolean {
  const phone = text.match(PHONE)?.[0];
  return !!phone && phone.replace(/\D/g, "").length >= 7;
}
