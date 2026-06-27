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
  {
    name: 'helloword',
    tagline: 'name is provisional',
    href: 'https://theelinumbriel.github.io/helloword/',
    external: true,
    rationale:
      "i take issue with a lot about our collective slide into vibecoding, but with midtown specifically, two things. one: i'm a big believer in the human in the loop of it all, so i like to actually read claude's markdown output, and vscode / windsurf are not a pleasant place to view or edit markdown. two: i want more formatting in markdown than they allow e.g. color, highlighting, etc. helloword fixes both: it's basically microsoft word for markdown. surprised it didn't already exist. now it does, yay!",
  },
  {
    name: 'vox',
    tagline: 'name is provisional and probably a copyright issue',
    href: 'https://theelinumbriel.github.io/vox-public/',
    external: true,
    rationale:
      'NO MORE BAD AI GENERATED TEXT. THIS IS GOOD AI GENERATED TEXT. you curate a corpus of text you like, this extracts geometric relationships between tokens in this corpus at the clause level, then for any plain text prompt (like you would with chatgpt, e.g. write me a one pager on XYZ), you get an actually good text output. this is byok for now! also please shoot me an email re how you feel about AI and text production broadly',
  },
  {
    name: 'inline',
    tagline: 'i hate vibe coded slop',
    href: 'https://github.com/theelinumbriel/inline',
    external: true,
    rationale:
      "in our (aforementioned) vibecode apocalypse, when you want to change a bit of text on your web app or whatever, you have to go edit the file yourself in vscode or prompt your llm to change it. obviously it'd be easier to just edit it inline so that's what this does. if you drop the one inline.js onto any page, add /edit to the url and click any text to edit it in place; hit save to write it straight back to the source file (via the tiny included server), or 'copy changes' to grab the edits as json!",
  },
  {
    name: 'oystr',
    prefix: '(the world is your) ',
    href: null,
    external: true,
    soon: true,
    plain: true, // no underline (renders as plain text, like &c)
    rationale:
      'developed a prototype in Xcode using the OpenAI API to generate virtual reality elements from natural language prompts, for applications in gaming. shoot me an email for a demo :)',
  },
  { name: 'work at the Learning Lab', href: '/portfolio/learning-lab' },
  { name: '&c', href: null, plain: true },
];
