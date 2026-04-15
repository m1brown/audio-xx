// Trace removed — results were: "evaluate my system" and
// "please evaluate my system" both classify as consultation_entry with
// subjectMatches=[]. This is relied on by the cold-path injection
// branch in app/page.tsx, which overrides intent to system_assessment
// when a saved system is injected.
export {};
