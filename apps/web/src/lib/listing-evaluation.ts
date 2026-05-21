/**
 * Listing evaluation — MVP "Evaluate a used listing from an uploaded image".
 *
 * Builds the system + multimodal user message for a vision-capable LLM
 * (OpenAI GPT-4o family). The model is asked to produce a fixed 7-section
 * response analyzing a used-gear listing image. The structure here is
 * intentionally narrow — the prompt enumerates exactly the sections and
 * cautious phrasing the LLM must use, so the API surface is deterministic
 * from the client's point of view (it gets one `content: string` back).
 *
 * Safety boundaries baked into the prompt (NOT a soft preference):
 *   • Reason only from visible listing information — no outside lookup.
 *   • Do not verify authenticity or seller trustworthiness.
 *   • Do not claim definitive market value.
 *   • Never say "buy now".
 *   • Always hedge with "appears to be", "based on the visible listing", etc.
 *
 * The renderer in page.tsx surfaces the result as an assistant 'note'
 * message — the structured headings are preserved as plain text so the
 * unified message renderer doesn't need a new card kind for the MVP.
 */

export interface ListingEvalRequest {
  /** Base64 data URLs of the listing photo(s). 1–3 images, ≤ 4 MB each. */
  images: string[];
  /** Optional free-text the user typed alongside the upload. */
  userText?: string;
  /**
   * Optional snapshot of the user's saved/active system. When present,
   * the "Fit with your system" section reasons against it; when absent,
   * the model gives a generic read and invites the user to share a system.
   */
  savedSystem?: { components: string[]; character?: string };
  /** Optional listener-preference summary string. */
  listenerPreferences?: string;
}

export interface ListingEvalSection {
  heading: string;
  content: string;
}

type ChatTextPart = { type: 'text'; text: string };
type ChatImagePart = { type: 'image_url'; image_url: { url: string } };
export type ChatUserContentPart = ChatTextPart | ChatImagePart;

export interface BuiltListingEvalPrompt {
  systemPrompt: string;
  userContent: ChatUserContentPart[];
}

const SECTION_TEMPLATE = `Produce exactly the following seven sections, in this order. Format requirements (these are part of the output contract, not a suggestion):

- Each section MUST be introduced by a level-2 Markdown heading on its own line, in the form "## 1. Listing read", "## 2. Translation", and so on through "## 7. Bottom-line recommendation".
- There MUST be one blank line between each section, and a blank line between the heading and the body of that section.
- Inside a section, use Markdown bullets ("- " at the start of the line) when the section calls for a list. Use short paragraphs otherwise.
- Do not wrap the entire response in a code fence. Do not add any extra preamble, summary, or sign-off before section 1 or after section 7.

The seven sections:

## 1. Listing read

Extract only what is visibly stated in the listing image(s): brand, model, asking price and currency, condition wording, seller location if visible, and any accessories or boxes shown or mentioned. Use a Markdown bullet list. If a field is not visible, write "not visible" — do not guess.

## 2. Translation

If the listing text is not in English, give a concise English summary of what the listing says. If the listing is already in English, write "Listing is in English — no translation needed."

## 3. Likely gear identified

For each item you believe you can identify from the photos and text, give a bullet with: best guess of brand + model, and a confidence tag of high / medium / low. Note any visual cues you used (badging, chassis shape, knob layout). If you cannot identify an item, say so plainly.

## 4. Fit with your system

Reason about how this piece would interact with the listener's existing system if one was provided. If no system context was provided, give a short generic read of who this gear tends to suit, and invite the user to share their system for a more specific assessment. Stay in character terms (warm/bright, smooth/detailed, etc.) — do not promise outcomes.

## 5. Risks / missing information

List the practical risks and unknowns a used buyer should flag, as Markdown bullets. Cover where relevant: voltage / region compatibility, service history, tube or capacitor age, visible damage or wear, missing accessories, shipping fragility, return policy. Cautious bullets only.

## 6. Questions to ask the seller

3–5 short, practical Markdown-bullet questions the buyer should send the seller before committing. Phrase them as the buyer would ask.

## 7. Bottom-line recommendation

Start this section with one of these exact labels, bolded, on its own line:
- **Worth exploring**
- **Ask questions first**
- **Likely not a fit**
- **Hard to judge from this listing**

Then follow on the next line with one or two sentences of reasoning. Never say "buy now". Never promise the listing is authentic, fairly priced, or in good condition.`;

const SAFETY_BOUNDARIES = `Hard safety boundaries — these are not preferences, they are requirements:
- Reason only from the visible listing information and any system context the user shared. Do not invoke outside knowledge of current market prices, seller reputation, or stock.
- Do not verify authenticity. Do not vouch for the seller's trustworthiness.
- Do not claim a definitive market value. If you mention price context, mark it as approximate and based only on the listing itself.
- Never say "buy now", "you should buy", "great deal", or any equivalent directive purchase language.
- Use cautious language throughout: "appears to be", "based on the visible listing", "ask for more information", "it looks like". Avoid certainty about anything that requires inspection in person.
- If an image is unclear or ambiguous, say so and lower your confidence — do not fill gaps with assumption.`;

const ROLE_FRAMING = `You are Audio XX acting as a careful private advisor evaluating a used audio listing on the user's behalf. You are not a recommendation engine and you are not a marketplace. You are a second pair of eyes on a listing the user is considering. Your job is to read what the listing actually shows, flag what it does not show, and help the user decide whether it is worth pursuing further.`;

export function buildListingEvalPrompt(
  req: ListingEvalRequest,
): BuiltListingEvalPrompt {
  const systemPrompt = [
    ROLE_FRAMING,
    '',
    SAFETY_BOUNDARIES,
    '',
    SECTION_TEMPLATE,
  ].join('\n');

  const userParts: ChatUserContentPart[] = [];

  const contextLines: string[] = [];
  if (req.userText && req.userText.trim().length > 0) {
    contextLines.push(`User note: ${req.userText.trim()}`);
  }
  if (req.savedSystem && req.savedSystem.components.length > 0) {
    contextLines.push(
      `User's saved system: ${req.savedSystem.components.join(', ')}`,
    );
    if (req.savedSystem.character && req.savedSystem.character.trim()) {
      contextLines.push(
        `System character notes: ${req.savedSystem.character.trim()}`,
      );
    }
  } else {
    contextLines.push(
      'No saved system was shared. Give a generic fit read and invite the user to share their system for a more specific assessment.',
    );
  }
  if (req.listenerPreferences && req.listenerPreferences.trim()) {
    contextLines.push(
      `Listener preferences: ${req.listenerPreferences.trim()}`,
    );
  }

  contextLines.push(
    '',
    'Now evaluate the attached listing image(s) using the seven-section structure exactly as specified.',
  );

  userParts.push({ type: 'text', text: contextLines.join('\n') });

  for (const url of req.images) {
    userParts.push({ type: 'image_url', image_url: { url } });
  }

  return { systemPrompt, userContent: userParts };
}
