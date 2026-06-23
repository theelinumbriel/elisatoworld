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
}

export const projects: Project[] = [
  { name: 'maxims', tagline: 'pinterest for words', href: null, external: true, soon: true },
  { name: 'helloword', tagline: 'name is provisional', href: null, external: true, soon: true },
  {
    name: 'vox',
    tagline: 'name is provisional and probably a copyright issue',
    href: null,
    external: true,
    soon: true,
  },
  { name: 'etch', tagline: 'the etch in sketch', href: null, external: true, soon: true },
  { name: 'inline', tagline: 'i hate vibe coded slop', href: null, external: true, soon: true },
  { name: 'oystr', prefix: '(the world is your) ', href: null, external: true, soon: true },
  { name: 'work at the Learning Lab', href: '/portfolio/learning-lab' },
  { name: '&c', href: null, plain: true },
];
