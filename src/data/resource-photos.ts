/**
 * Real photographs of the two campuses, from Wikimedia Commons, resized into
 * public/resources/. Every one is under a Creative Commons licence that allows
 * reuse WITH credit, so the credit list below is rendered at the foot of the
 * Resources page and must stay there. They are cropped and tinted on screen.
 */
export interface Photo {
  src: string
  /** What is in the picture, for screen readers and the credit line. */
  alt: string
  by: string
  licence: string
  page: string
}

const c = (file: string) => `https://commons.wikimedia.org/wiki/File:${file}`

export const PHOTOS = {
  plaza: {
    src: '/resources/hall-plaza.webp',
    alt: 'Students crossing the plaza in front of the Hall Building',
    by: 'Jeangagnon',
    licence: 'CC BY-SA 3.0',
    page: c('Henry_F._Hall_Building_04.JPG'),
  },
  hall: {
    src: '/resources/hall.webp',
    alt: 'The Henry F. Hall Building',
    by: 'Jeangagnon',
    licence: 'CC BY-SA 3.0',
    page: c('Henry_F._Hall_Building_-_Concordia_University.JPG'),
  },
  loyola: {
    src: '/resources/loyola.webp',
    alt: 'The Loyola campus in autumn',
    by: 'Adqproductions',
    licence: 'CC BY-SA 3.0',
    page: c('Loyola_concordia.jpg'),
  },
  quad: {
    src: '/resources/loyola-quad.webp',
    alt: 'The Loyola quadrangle',
    by: 'Thomas1313',
    licence: 'CC BY-SA 3.0',
    page: c('Loyola_College_Building_9.JPG'),
  },
  tower: {
    src: '/resources/loyola-tower.webp',
    alt: 'The Administration Building tower at Loyola',
    by: 'IronChris',
    licence: 'Public domain',
    page: c('Loyola_campus_AD_building.jpg'),
  },
  study: {
    src: '/resources/library-study.webp',
    alt: 'A study area in the Webster Library',
    by: 'Marie D Martel',
    licence: 'CC BY-SA 4.0',
    page: c('Biblioth%C3%A8que_Webster_Library_05.jpg'),
  },
  stacks: {
    src: '/resources/library-stacks.webp',
    alt: 'The course reserves room in the Webster Library',
    by: 'Librarianpam',
    licence: 'CC BY-SA 4.0',
    page: c('Webster_Library%27s_Course_Reserves_Room,_Concordia_University.jpg'),
  },
  molson: {
    src: '/resources/molson-night.webp',
    alt: 'The John Molson Building at night',
    by: 'Rodolphe Breard',
    licence: 'CC BY-SA 2.0',
    page: c('MB_Building_2012.jpg'),
  },
  ev: {
    src: '/resources/ev.webp',
    alt: 'The EV Building on Sainte-Catherine Street',
    by: 'Jeangagnon',
    licence: 'CC BY-SA 3.0',
    page: c('Engineering,_Computer_Science_and_Visual_Arts_Integrated_Complex_11.JPG'),
  },
  sky: {
    src: '/resources/ev-sky.webp',
    alt: 'The EV Building from below',
    by: 'JasonParis',
    licence: 'CC BY 2.0',
    page: c('EV_Building_2009_01,_QC.jpg'),
  },
} satisfies Record<string, Photo>

export type PhotoKey = keyof typeof PHOTOS
