const paths: Record<string,string> = {
 home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/>',
 leaf: '<path d="M20 3c-8-1-16 3-16 9a7 7 0 0 0 7 7c6 0 10-8 9-16Z"/><path d="M4 21 15 10M8 17v-5m0 5h5"/>',
 wood: '<path d="m5 15 9-10 6 6-10 9Z"/><ellipse cx="7.5" cy="17.5" rx="4" ry="3.5" transform="rotate(45 7.5 17.5)"/><path d="m11 9 5 5m-1-9 3-2 4 5-2 3M6 17l2 2"/>',
 scrap: '<path d="m12 3 9 5v9l-9 5-9-5V8Z"/><path d="m3 8 9 5 9-5m-9 5v9M8 5l9 5"/>',
 food: '<path d="M7 7c-4 0-5 4-3 9s5 7 8 4c3 3 6 1 8-4s1-9-3-9c-2 0-3 1-5 1S9 7 7 7Z"/><path d="M12 8V4m0 1c0-3 3-3 5-3 0 3-2 4-5 3"/>',
 water: '<path d="M12 2S5 10 5 15a7 7 0 0 0 14 0c0-5-7-13-7-13Z"/><path d="M8 15a4 4 0 0 0 4 4"/>',
 seeds: '<path d="M12 22V10M12 15C5 15 3 11 3 7c7 0 9 4 9 8Zm0-5c0-6 3-8 9-8 0 6-3 8-9 8Z"/>',
 hunt: '<path d="M4 20 20 4M4 4c10 0 16 6 16 16L4 4Zm16 0v6m0-6h-6M4 16v4h4"/>',
 hammer: '<path d="m5 3 6 1 5 5-4 4-5-5-3 1-2-2Zm7 9 9 9m-2-13 3 3-3 3-3-3"/>',
 bag: '<rect x="5" y="7" width="14" height="15" rx="4"/><path d="M8 7V5a4 4 0 0 1 8 0v2M5 13h14M9 16h6"/>',
 map: '<path d="m2 6 7-3 6 3 7-3v16l-7 3-6-3-7 3ZM9 3v16m6-13v16"/>',
 flag: '<path d="M5 22V3m0 1c4-5 9 5 15 0v10c-6 5-11-5-15 0"/>',
 settings: '<path d="m10 2 4 0 1 3 3 1 3-1 2 4-2 2v3l2 2-2 4-3-1-3 1-1 3h-4l-1-3-3-1-3 1-2-4 2-2v-3L1 9l2-4 3 1 3-1Z"/><circle cx="12" cy="12" r="3"/>',
 sun: '<circle cx="12" cy="12" r="4"/><path d="M12 1v2m0 18v2M1 12h2m18 0h2M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2"/>',
 moon: '<path d="M20 14A9 9 0 0 1 10 3a9 9 0 1 0 10 11Z"/>',
 heart: '<path d="M20 4c-3-2-6-1-8 2C10 3 7 2 4 4-1 8 4 14 12 21 20 14 25 8 20 4Z"/>',
 bolt: '<path d="m14 2-11 12h8l-1 8L21 9h-8Z"/>',
 paw: '<ellipse cx="6" cy="7" rx="2" ry="3" transform="rotate(-20 6 7)"/><ellipse cx="18" cy="7" rx="2" ry="3" transform="rotate(20 18 7)"/><ellipse cx="11" cy="4" rx="2" ry="3"/><path d="M12 10c-3 0-3 3-6 5-3 3 0 7 3 5 2-1 4-1 6 0 3 2 6-2 3-5-3-2-3-5-6-5Z"/>',
 arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
 chevron: '<path d="m9 5 7 7-7 7"/>',
 close: '<path d="m6 6 12 12M6 18 18 6"/>',
 check: '<path d="m5 12 4 4L20 5"/>',
 plus: '<path d="M12 5v14M5 12h14"/>',
 truck: '<path d="M2 6h12v12H2Zm12 5h5l3 4v3h-8"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="19" r="2"/><path d="M18 11v4h4"/>',
 pin: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
 clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
 play: '<path d="m8 4 12 8-12 8Z"/>',
 pause: '<path d="M8 5v14M16 5v14"/>',
 volume: '<path d="M11 3 5 8H1v8h4l6 5Zm5 4a7 7 0 0 1 0 10m3-13a11 11 0 0 1 0 16"/>',
 mute: '<path d="M11 3 5 8H1v8h4l6 5Zm5 6 6 6m0-6-6 6"/>',
 bed: '<path d="M3 5v16m18-10v10M3 17h18M3 9h15a3 3 0 0 1 3 3v5M6 9v5h15"/>',
 download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
 sparkle: '<path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z"/>',
 book: '<path d="M12 5c-3-3-7-3-10-2v16c4-1 7-1 10 2 3-3 6-3 10-2V3c-3-1-7-1-10 2Zm0 0v16"/>',
 refresh: '<path d="M20 8a9 9 0 1 0 1 7M20 2v6h-6"/>',
 shield: '<path d="m12 2 9 4v7c0 5-9 9-9 9s-9-4-9-9V6Z"/><path d="m8 12 3 3 5-6"/>',
 expand: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
};
export function icon(name:string, cls=''):string { return `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]??paths.sparkle}</svg>`; }
export function portrait(gender: 'male' | 'female', cls = ''): string {
  const female = gender === 'female';
  const id = `hero-${gender}-${Math.random().toString(36).slice(2, 9)}`;
  const hair = female ? '#774736' : '#2e4663', hairLight = female ? '#bd7a51' : '#7796b3';
  const coat = female ? '#448b82' : '#536d9e', coatLight = female ? '#96cbb0' : '#a0bad7';
  const eyes = [39, 63].map((x, i) => `<g transform="translate(${x} ${47 + i})"><path d="M-7-5Q0-10 7-4L7 4Q1 9-6 5Z" fill="#fffbee" stroke="#765a58" stroke-width=".8"/><ellipse cy="1" rx="5.3" ry="7" fill="url(#${id}-iris)"/><ellipse cy="0" rx="2.4" ry="5" fill="#30364c"/><ellipse cx="-2" cy="-3" rx="2.5" ry="2.6" fill="#fffdf1"/><circle cx="2.4" cy="3.7" r="1.4" fill="#fff7d7"/><path d="M-8-4Q0-11 7-4M-7-5l-3-3" fill="none" stroke="#343848" stroke-width="2.1" stroke-linecap="round"/></g>`).join('');
  return `<svg class="portrait ${cls}" viewBox="0 0 100 100" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="${id}-bg" x2=".7" y2="1"><stop stop-color="${female ? '#f4e4bd' : '#dae9df'}"/><stop offset="1" stop-color="${female ? '#e3b898' : '#9fc5c6'}"/></linearGradient>
    <linearGradient id="${id}-hair" x2=".7" y2="1"><stop stop-color="${hairLight}"/><stop offset="1" stop-color="${hair}"/></linearGradient>
    <linearGradient id="${id}-skin" x2=".3" y2="1"><stop stop-color="#fff0d4"/><stop offset="1" stop-color="#f4c4a8"/></linearGradient>
    <linearGradient id="${id}-coat" x2=".7" y2="1"><stop stop-color="${coatLight}"/><stop offset="1" stop-color="${coat}"/></linearGradient>
    <linearGradient id="${id}-iris" x2="0" y2="1"><stop stop-color="${female ? '#7d5338' : '#244e75'}"/><stop offset="1" stop-color="${female ? '#e9b866' : '#79d3d3'}"/></linearGradient>
    <radialGradient id="${id}-blush"><stop stop-color="#e48b83" stop-opacity=".7"/><stop offset="1" stop-color="#e48b83" stop-opacity="0"/></radialGradient>
    <clipPath id="${id}-clip"><circle cx="50" cy="50" r="49"/></clipPath>
  </defs>
  <g clip-path="url(#${id}-clip)" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="50" cy="50" r="49" fill="url(#${id}-bg)"/>
    <circle cx="78" cy="17" r="16" fill="#fff5d9" opacity=".38"/><path d="m13 42 2-5 2 5 5 2-5 2-2 5-2-5-5-2Z" fill="#fff7db" opacity=".85"/><circle cx="85" cy="69" r="3" fill="#fff7db" opacity=".7"/>
    ${female ? `<path d="M25 29Q11 48 20 78L14 88 28 85Q28 94 40 87L73 88Q89 74 78 35Z" fill="url(#${id}-hair)" stroke="${hair}" stroke-width="1.6"/><g fill="#a46b47" stroke="#744735" stroke-width="1.2"><ellipse cx="24" cy="60" rx="7" ry="8"/><ellipse cx="23" cy="69" rx="6.5" ry="7"/><ellipse cx="24" cy="78" rx="5.5" ry="6"/></g><path d="M19 80 12 87 21 89 25 85 31 90 34 83 27 81Z" fill="#ffc36b" stroke="#9c7250" stroke-width="1"/>` : ''}
    <path d="M14 108Q13 78 37 76L66 76Q87 81 89 108Z" fill="url(#${id}-coat)" stroke="#42566a" stroke-width="1.6"/>
    <path d="M40 76H62L65 104H35Z" fill="#f9edd1"/><path d="m35 78 9 1 1 11-6 5 4 12H22l2-21Zm31 0-8 3-2 10 6 5-2 11h23l-7-21Z" fill="${coat}" stroke="#446178" stroke-width="1"/>
    <path d="m29 80 38 30" stroke="#70584b" stroke-width="7"/><path d="m29 80 38 30" stroke="#c19864" stroke-width="3.5"/>
    <path d="M39 66h23v14Q49 90 38 78Z" fill="#efbd9e" stroke="#ac7c68" stroke-width="1"/>
    <path d="M25 44Q17 13 43 7L39 4Q54 3 60 9L67 5 71 13 82 17 78 27Q85 37 77 58L65 70 30 62Z" fill="url(#${id}-hair)" stroke="${hair}" stroke-width="1.5"/>
    <ellipse cx="25" cy="50" rx="5" ry="8" fill="#edb99f" stroke="#9d7063" stroke-width="1"/><ellipse cx="77" cy="50" rx="4.5" ry="7" fill="#edb99f" stroke="#9d7063" stroke-width="1"/>
    <path d="M25 34Q34 20 52 21Q76 24 77 43L75 58Q68 75 52 77Q34 76 27 60Z" fill="url(#${id}-skin)" stroke="#a77a68" stroke-width="1.1"/>
    <ellipse cx="31" cy="59" rx="9" ry="5.8" fill="url(#${id}-blush)"/><ellipse cx="72" cy="59" rx="8" ry="5.5" fill="url(#${id}-blush)"/>
    <path d="M32 37q6-3 13-1M57 37q7-2 12 2" fill="none" stroke="${hair}" stroke-width="1.5"/>
    ${eyes}
    <path d="m53 57 2 2-3 1" fill="none" stroke="#d29a85" stroke-width="1"/>
    <path d="M46 65q7 5 14-1" fill="none" stroke="#ac6a67" stroke-width="1.7"/><path d="M49 70h6" stroke="#ffe1c7" stroke-width="1.5"/>
    ${female ? `<path d="M23 48Q17 32 27 18Q43 0 65 13Q83 22 79 47L71 42 65 29Q59 42 50 43L52 29Q45 42 37 45L39 29Q33 38 27 42L28 53 23 55Z" fill="url(#${id}-hair)" stroke="${hair}" stroke-width="1.5"/><path d="M28 28Q36 15 48 14M55 15q10 1 16 12" fill="none" stroke="#e1a679" stroke-width="3"/><path d="m34 30 7-8m17 2-3 10" stroke="#d99866" stroke-width="1.7"/><path d="m22 32-10-7 2 13 9 1 3 9 7-9-5-7Z" fill="#84c4a8" stroke="#527b6d" stroke-width="1.2"/><circle cx="23" cy="36" r="3.3" fill="#f6d286" stroke="#a18155" stroke-width="1"/><path d="m69 29 7 2m-7 1 7 2" stroke="#f9d899" stroke-width="2"/>` : `<path d="M23 49 20 33 24 23 20 21 36 14 34 9 48 13 57 7 65 14 78 11 76 22 84 24 78 34 79 44 69 46 63 31 56 43 53 29 40 43 40 28 30 43 28 54Z" fill="url(#${id}-hair)" stroke="${hair}" stroke-width="1.5"/><path d="m30 24 12-6m7 0 7 2m6 0 9-2" fill="none" stroke="#b3c9d6" stroke-width="2.8"/><path d="m29 32 8-4m11 2 5-7m13 5 6-1" stroke="#86a9c2" stroke-width="1.7"/><path d="m25 39 3 10 4-1-3-10Z" fill="#c5c6a0" stroke="#677e8c" stroke-width="1"/>`}
    <path d="M35 76Q50 85 65 76L68 83Q52 96 33 84Z" fill="${female ? '#ffc476' : '#87d8c2'}" stroke="${female ? '#b98553' : '#529b91'}" stroke-width="1.2"/><path d="M39 82q12 7 23-1" fill="none" stroke="${female ? '#e5a059' : '#5cb9a8'}" stroke-width="1.7"/><path d="m56 84 8-2 9 13-7 9-7-8Z" fill="${female ? '#efaa61' : '#67bdae'}" stroke="${female ? '#b98553' : '#529b91'}" stroke-width="1"/><circle cx="68" cy="91" r="2.7" fill="#ffdf97" stroke="#8b8065" stroke-width="1"/>
    <path d="M23 98h11m38 1h7" stroke="${coatLight}" stroke-width="1.5"/>
  </g></svg>`;
}
