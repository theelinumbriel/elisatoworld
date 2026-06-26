// single source of truth for the portfolio grid.
// `href` null + `soon:true`  -> renders as an underlined word, no link (matches deck)
// `href` set                 -> renders as a real link (internal or external)
// `prefix`                   -> roman text before the linked word, e.g. "(the world is your) "
// `tagline`                  -> roman parenthetical after the name
// `plain:true`               -> not underlined at all (e.g. "&c")

export interface Project {
  name: string;
  prefix?: string;
  tagline?: string;
  href?: string | null;
  external?: boolean;
  soon?: boolean;
  plain?: boolean;
  /** optional "why this exists" note, revealed on click */
  rationale?: string;
}

export const projects: Project[] = [
  { name: 'maxims', tagline: 'pinterest for words', href: null, external: true, soon: true },
  {
    name: 'helloword',
    tagline: 'name is provisional',
    href: 'https://theelinumbriel.github.io/helloword/',
    external: true,
    rationale:
      "i take issue with a lot about the collective slide into vibecoding — but with markdown specifically, two things. one: i believe in keeping a human in the loop, so i like to actually read claude's markdown output, and vscode / windsurf are not a pleasant place to view or edit markdown. two: i want more formatting in markdown than they allow — colour, highlighting, and the like. helloword fixes both: it's basically microsoft word for markdown. surprised it didn't already exist. now it does — yay.",
  },
  {
    name: 'vox',
    tagline: 'name is provisional and probably a copyright issue',
    href: null,
    external: true,
    soon: true,
  },
  { name: 'etch', tagline: 'the etch in sketch', href: null, external: true, soon: true },
  {
    name: 'inline',
    tagline: 'i hate vibe coded slop',
    href: 'https://github.com/theelinumbriel/inline',
    external: true,
    rationale:
      "in our vibecode apocalypse, when you want to change a bit of text on your web app or whatever, you have to go edit the file yourself in vscode or prompt your llm to change it. obviously it'd be easier to just edit it inline — so that's what this does. drop the one inline.js onto any page, add ?edit to the url (or press ⌘/ctrl+shift+e), and click any text to edit it in place; hit save to write it straight back to the source file (via the tiny included server), or 'copy changes' to grab the edits as json. (this very site runs it — add ?edit to any page.)",
  },
  { name: 'oystr', prefix: '(the world is your) ', href: null, external: true, soon: true },
  { name: 'work at the Learning Lab', href: '/portfolio/learning-lab' },
  { name: '&c', href: null, plain: true },
];
