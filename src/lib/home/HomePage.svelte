<script lang="ts">
  import { goto } from '$app/navigation';
  import VolumeMaxIcon from '$lib/VolumeMaxIcon.svelte';
  import VolumeOffIcon from '$lib/VolumeOffIcon.svelte';
  import {
    createAboutProjectPhaserGame,
    getAboutProjectProjectedRect,
    type AboutProjectPhaserAsset,
    type AboutProjectPhaserGameHandle
  } from '$lib/home/about-project-phaser';
  import { createAnimationCueManager } from '$lib/scene/animation-cues';
  import { readAudioMutedPreference, writeAudioMutedPreference } from '$lib/scene/audio-preference';
  import { createAudioCueManager, type AudioCueConfig } from '$lib/scene/audio-cues';
  import { loadGsap, type Gsap } from '$lib/scene/gsap-loader';
  import { clamp, deg, ease, fixed, px, type CssVars, vh, vw } from '$lib/scene/math';
  import { createSceneResourceScope } from '$lib/scene/resources';
  import { onMount, tick } from 'svelte';

  let reelProgress = 0;
  let reelTravelDirection = 1;
  let pageProgress = 0;
  let brandProgress = 0;
  let homeScreen: HTMLElement;
  let nextScreen: HTMLElement;
  let brandScreen: HTMLElement;
  let brandSubtitleEl: HTMLElement;
  let brandScrollCueEl: HTMLElement;
  let rolesTopBar: HTMLElement;
  let rolesScreen: HTMLElement;
  let reelCards: HTMLElement[] = [];
  let roleCards: HTMLElement[] = [];
  let introLetters: HTMLElement[] = [];
  let nextLetters: HTMLElement[] = [];
  let audioGateCopyLetters: HTMLElement[] = [];
  let introEl: HTMLElement;
  let introScrollCueEl: HTMLElement;
  let audioGateButtonEl = $state<HTMLElement>();
  let isAudioGateVisible = $state(true);
  let isAudioGateOpening = $state(false);
  let isAudioMuted = $state(true);
  let audioLabel = $derived(isAudioMuted ? 'Audio disattivato' : 'Audio attivo');
  let isBrandWordSharp = $state(false);
  let isAboutOpen = $state(false);
  let isAboutClosing = $state(false);
  let aboutView = $state<'gate' | 'project' | 'interviews' | 'interview'>('gate');
  let activeInterviewName = $state<string>();
  let aboutScreenEl = $state<HTMLElement>();
  let aboutProjectEl = $state<HTMLElement>();
  let aboutProjectPhaserEl = $state<HTMLElement>();
  let fullInterviewScrollEl = $state<HTMLElement>();
  let fullInterviewScrollbarThumbStyle = $state('height: 100%; transform: translate3d(0, 0, 0);');
  let aboutProjectTeamLabelStyle = $state('');
  let isAboutProjectTeamVisible = $state(false);
  let aboutTransitionId = 0;
  let aboutProjectPhaserHandle: AboutProjectPhaserGameHandle | undefined;
  let aboutProjectResizeObserver: ResizeObserver | undefined;
  let aboutProjectPhaserRequestId = 0;
  let copiedAboutProjectEmail = $state('');
  let aboutProjectEmailCopyNonce = $state(0);
  let aboutProjectEmailCopyTimeout: ReturnType<typeof window.setTimeout> | undefined;
  let gsap: Gsap;
  let flowTween: ReturnType<Gsap['to']> | undefined;
  let cardEnterTween: ReturnType<Gsap['timeline']> | undefined;
  let roleHoverResizeObserver: ResizeObserver | undefined;
  let roleHoverFitFrame = 0;
  let fullInterviewScrollbarFrame = 0;
  const animations = createAnimationCueManager();
  const sceneResources = createSceneResourceScope();

  const audioRoles = ['ufficio', 'cucina', 'servizio'] as const;
  const homeAudioIds = ['background', ...audioRoles] as const;
  type AudioRole = (typeof audioRoles)[number];
  type HomeAudioId = (typeof homeAudioIds)[number];
  type RoleItem = {
    title: AudioRole;
    displayTitle?: string;
    description: string;
    speaker: string;
    dialogue: string;
    hoverIntro: string;
    hoverName: string;
    hoverAction: string;
    hoverClosing: string;
    backgroundSrc?: string;
    personSrc: string;
    personNodeId?: string;
    personFillSrc?: string;
    personFillNodeId?: string;
    href?: string;
  };
  type InterviewFacePiece = {
    src: string;
    x: number;
    y: number;
    width: number;
    height: number;
    maskSrc?: string;
    maskX?: number;
    maskY?: number;
    maskSize?: number;
  };
  type InterviewChef = {
    number: string;
    name: string;
    nameHeight: number;
    faceWidth: number;
    faceHeight: number;
    portraitSrc: string;
    portraitScale?: number;
    portraitY?: number;
    pieces: InterviewFacePiece[];
    featuredHover?: {
      role: string;
      description: string;
      bodySrc: string;
    };
  };
  type InterviewDetail = {
    name: string;
    firstName: string;
    lastName: string;
    role: string;
    description: string;
    portraitSrc: string;
    portraitX?: number;
    portraitY?: number;
    portraitHeight?: number;
    firstNameX?: number;
    lastNameX?: number;
  };
  type InterviewTranscriptSection = {
    question: string;
    answer: string;
  };
  type FullInterviewContent = {
    quote: string;
    transcript: InterviewTranscriptSection[];
  };
  type AboutProjectTeamContact = {
    firstName: string;
    lastName: string;
    email: string;
    instagramUrl: string;
  };

  const roleAudio: Record<AudioRole, AudioCueConfig> = {
    ufficio: {
      src: '/sound/office.mp3',
      startTime: 0.5,
      maxTime: 0,
      targetVolume: 0.62,
      fadeInDuration: 0.05
    },
    cucina: {
      src: '/sound/kitchen.mp3',
      startTime: 0,
      maxTime: 0,
      targetVolume: 0.42,
      fadeInDuration: 0.12
    },
    servizio: {
      src: '/sound/restaurant.mp3',
      startTime: 0,
      maxTime: 0,
      targetVolume: 1,
      outputGain: 0.92,
      fadeInDuration: 0.12
    }
  };
  const backgroundAudio: AudioCueConfig = {
    src: '/sound/home_backgroundok.mp3',
    startTime: 0,
    targetVolume: 1,
    fadeInDuration: 1.2,
    loop: true
  };
  const roleAudioEntries = audioRoles.map((role) => ({ role, config: roleAudio[role] }));
  const interviewAssetBase = '/assets/interviews/';
  const aboutProjectAssets: AboutProjectPhaserAsset[] = ([
    { name: 'mobile2', alt: '', x: 4294, y: 1643, width: 1647, height: 1021, isBackdrop: true },
    { name: 'mobile1', alt: '', x: 5919, y: 1692, width: 1797, height: 972, isBackdrop: true },
    { name: 'gerri', alt: 'Ritratto team Gerri', x: 4487, y: 1277, width: 482, height: 640 },
    { name: 'luke', alt: 'Ritratto team Luke', x: 4926, y: 1263, width: 521, height: 655 },
    { name: 'nicol', alt: 'Ritratto team Nicol', x: 5389, y: 1288, width: 475, height: 632 },
    { name: 'alep', alt: 'Ritratto team Alep', x: 6044, y: 1273, width: 471, height: 649 },
    { name: 'tama', alt: 'Ritratto team Tama', x: 6522, y: 1263, width: 513, height: 655 },
    { name: 'vigex', alt: 'Ritratto team Vigex', x: 7051, y: 1299, width: 458, height: 620 }
  ] satisfies Array<Omit<AboutProjectPhaserAsset, 'src'>>).map((asset) => ({
    ...asset,
    src: `/assets/about/${asset.name}.png`
  }));
  const aboutProjectTeamContacts: AboutProjectTeamContact[] = [
    {
      firstName: 'Chiara',
      lastName: 'Geronimi',
      email: 'chiara.geronimi@mail.polimi.it',
      instagramUrl: 'https://www.instagram.com/chiarageronimii/'
    },
    {
      firstName: 'Luca',
      lastName: 'Verde',
      email: 'lucaaverde@icloud.com',
      instagramUrl: 'https://www.instagram.com/lucaaverde_/'
    },
    {
      firstName: 'Nicole',
      lastName: 'Mordocco',
      email: 'mordocconicole@gmail.com',
      instagramUrl: 'https://www.instagram.com/nicolemordocco/'
    },
    {
      firstName: 'Alessandro',
      lastName: 'Porri',
      email: 'alessandro.porri.05@gmail.com',
      instagramUrl: 'https://www.instagram.com/aleporri_/'
    },
    {
      firstName: 'Filippo',
      lastName: 'Tamagnini',
      email: 'filippo.tamagnini@mail.polimi.it',
      instagramUrl: 'https://www.instagram.com/filippotamagnini/'
    },
    {
      firstName: 'Francesca',
      lastName: 'Vigevani',
      email: 'vigevanifrancesca@gmail.com',
      instagramUrl: 'https://www.instagram.com/fraavigevani/'
    }
  ];
  const interviewChefs: InterviewChef[] = [
    {
      number: '01',
      name: 'Stefano Paganini',
      nameHeight: 231,
      faceWidth: 85,
      faceHeight: 85,
      portraitSrc: '/assets/interviews/nini.png',
      featuredHover: {
        role: 'Executive Chef',
        description:
          'Lo chef piemontese ha fatto parte del team incaricato della ristorazione olimpica internazionale a Livigno.',
        bodySrc: '/assets/interviews-hover/stefano-paganini-figma.svg'
      },
      pieces: [
        { src: 'stefano-ring.svg', x: -1.31, y: -1.31, width: 87.62, height: 87.62 },
        { src: 'stefano-layer-1.svg', x: -16.75, y: 6.44, width: 104.62, height: 341.98, maskSrc: 'stefano-mask.svg', maskX: 18.67, maskY: -4.51, maskSize: 83.07 },
        { src: 'stefano-layer-2.svg', x: -16.75, y: 23.42, width: 105.35, height: 325.36, maskSrc: 'stefano-mask.svg', maskX: 18.67, maskY: -21.48, maskSize: 83.07 }
      ]
    },
    {
      number: '02',
      name: 'Carlo Zarri',
      nameHeight: 231,
      faceWidth: 86,
      faceHeight: 87,
      portraitSrc: '/assets/interviews/zarri.png',
      portraitY: 8,
      portraitScale: 1.15,
      pieces: [
        { src: 'zarri-ring.svg', x: -0.31, y: 0.69, width: 87.62, height: 87.62 },
        { src: 'zarri-layer-1.svg', x: -3.0, y: 9.0, width: 113.98, height: 341.71, maskSrc: 'zarri-mask.svg', maskX: 1.69, maskY: -10.31, maskSize: 87.62 },
        { src: 'zarri-layer-2.svg', x: -3.0, y: 9.02, width: 114.72, height: 342.37, maskSrc: 'zarri-mask.svg', maskX: 1.69, maskY: -10.33, maskSize: 87.62 }
      ]
    },
    {
      number: '03',
      name: 'Elisabetta Salvadori',
      nameHeight: 288,
      faceWidth: 85,
      faceHeight: 86,
      portraitY: 14,
      portraitScale: 1.14,
      portraitSrc: '/assets/interviews/eli.png',
      pieces: [
        { src: 'salvadori-ring.svg', x: -1.31, y: -0.31, width: 87.62, height: 87.62 },
        { src: 'salvadori-layer-1.svg', x: -5.0, y: 7.0, width: 100.93, height: 389.82, maskSrc: 'salvadori-mask.svg', maskX: 3.69, maskY: -8.31, maskSize: 87.62 },
        { src: 'salvadori-layer-2.svg', x: -5.0, y: 7.04, width: 101.83, height: 390.59, maskSrc: 'salvadori-mask.svg', maskX: 3.69, maskY: -8.35, maskSize: 87.62 },
        { src: 'salvadori-eye-1.svg', x: 37.53, y: 29.66, width: 10.17, height: 3.64, maskSrc: 'salvadori-mask.svg', maskX: -38.83, maskY: -30.97, maskSize: 87.62 },
        { src: 'salvadori-eye-2.svg', x: 55.56, y: 28.57, width: 9.53, height: 2.62, maskSrc: 'salvadori-mask.svg', maskX: -56.86, maskY: -29.88, maskSize: 87.62 }
      ]
    },
    {
      number: '04',
      name: 'Fausto Meli',
      nameHeight: 288,
      faceWidth: 85,
      faceHeight: 87,
      portraitY: 6,
      portraitSrc: '/assets/interviews/fausto.png',
      pieces: [
        { src: 'meli-ring.svg', x: -1.31, y: 0.69, width: 87.62, height: 87.62 },
        { src: 'meli-layer-1.svg', x: -14.0, y: 6.0, width: 113.98, height: 365.62, maskSrc: 'meli-mask.svg', maskX: 12.69, maskY: -7.31, maskSize: 87.62 },
        { src: 'meli-layer-2.svg', x: -13.97, y: 6.0, width: 114.73, height: 366.36, maskSrc: 'meli-mask.svg', maskX: 12.66, maskY: -7.31, maskSize: 87.62 }
      ]
    },
    {
      number: '05',
      name: 'Marco Frassante',
      nameHeight: 288,
      faceWidth: 85,
      faceHeight: 85,
      portraitSrc: '/assets/interviews/marco.png',
      portraitScale: 1.38,
      portraitY: 0,
      pieces: [{ src: 'frassante-face.svg', x: -1.31, y: -1.41, width: 87.62, height: 87.62 }]
    },
    {
      number: '06',
      name: 'Carlo Cracco',
      nameHeight: 288,
      faceWidth: 85,
      faceHeight: 87,
      portraitSrc: '/assets/interviews/cracco.png',
      portraitY: 14,
      portraitScale: 1.28,
      pieces: [{ src: 'cracco-face.svg', x: -1.31, y: 0, width: 87.62, height: 88.31 }]
    },
    {
      number: '07',
      name: 'Ken Frank',
      nameHeight: 288,
      faceWidth: 85,
      faceHeight: 85,
      portraitSrc: '/assets/interviews/ken.png',
      portraitY: 22,
      portraitScale: 1.2,
      pieces: [
        { src: 'frank-ring.svg', x: -1.31, y: 0.69, width: 87.62, height: 87.62 },
        { src: 'frank-layer-1.svg', x: 1.41, y: 32.87, width: 59.45, height: 86.09, maskSrc: 'frank-mask.svg', maskX: -2.72, maskY: -34.18, maskSize: 87.62 },
        { src: 'frank-layer-2.svg', x: -10.0, y: 5.47, width: 100.99, height: 329.54, maskSrc: 'frank-mask.svg', maskX: 8.69, maskY: -6.78, maskSize: 87.62 },
        { src: 'frank-layer-3.svg', x: -9.98, y: 5.47, width: 100.98, height: 329.55, maskSrc: 'frank-mask.svg', maskX: 8.68, maskY: -6.78, maskSize: 87.62 }
      ]
    }
  ];
  const interviewDetails: Record<string, InterviewDetail> = {
    'Stefano Paganini': {
      name: 'Stefano Paganini',
      firstName: 'Stefano',
      lastName: 'Paganini',
      role: 'Executive Chef',
      description:
        'Lo chef piemontese ha fatto parte del team incaricato della ristorazione olimpica internazionale a Livigno.',
      portraitSrc: '/assets/interviews-hover/nini.png'
    },
    'Carlo Zarri': {
      name: 'Carlo Zarri',
      firstName: 'Carlo',
      lastName: 'Zarri',
      role: 'Chief Executive Chef',
      description:
        "Architetto iniziale del progetto gastronomico di Milano-Cortina 2026 ha gestito la ristorazione all'Arena di Santa Giulia.",
      portraitSrc: '/assets/interviews-hover/zarri.png',
      portraitX: 0,
      portraitY: 0,
      portraitHeight: 614
    },
    'Elisabetta Salvadori': {
      name: 'Elisabetta Salvadori',
      firstName: 'Elisabetta',
      lastName: 'Salvadori',
      role: 'Head Food and Beverage',
      description:
        "coordinatrice generale di tutta la strategia di ristorazione dell'evento, dalle Olimpiadi alle Paralimpiadi.",
      portraitSrc: '/assets/interviews-hover/eli.png',
      portraitX: 0,
      portraitY: 0,
      portraitHeight: 614,
      firstNameX: -7,
      lastNameX: 3
    },
    'Fausto Meli': {
      name: 'Fausto Meli',
      firstName: 'Fausto',
      lastName: 'Meli',
      role: 'Executive Chef',
      description:
        'Chef di grande esperienza ha fatto da ponte tra il mondo della scuola e la grande macchina olimpica.',
      portraitSrc: '/assets/interviews-hover/fausto.png',
      portraitX: 0,
      portraitY: 0,
      portraitHeight: 614,
      firstNameX: 63,
      lastNameX: 0
    },
    'Marco Frassante': {
      name: 'Marco Frassante',
      firstName: 'Marco',
      lastName: 'Frassante',
      role: 'Executive Chef',
      description:
        "ha ricoperto un ruolo di coordinamento e leadership all'interno del Villaggio Olimpico di Livigno.",
      portraitSrc: '/assets/interviews-hover/marco.png',
      portraitX: 0,
      portraitY: 0,
      portraitHeight: 614,
      firstNameX: 74,
      lastNameX: 5
    },
    'Carlo Cracco': {
      name: 'Carlo Cracco',
      firstName: 'Carlo',
      lastName: 'Cracco',
      role: 'Chef Ambassador',
      description:
        "Ambasciatore dell'eccellenza italiana, firmando un piatto iconico che è diventato uno dei simboli virali di questa edizione dei Giochi.",
      portraitSrc: '/assets/interviews-hover/cracco.png',
      portraitX: 0,
      portraitY: 0,
      portraitHeight: 614,
      firstNameX: 92,
      lastNameX: 5
    },
    'Ken Frank': {
      name: 'Ken Frank',
      firstName: 'Ken',
      lastName: 'Frank',
      role: 'Guest Chef International',
      description:
        'chef americano, ha avuto un ruolo speciale come chef internazionale nelle cucine di Milano-Cortina 2026',
      portraitSrc: '/assets/interviews-hover/ken.png',
      portraitX: 0,
      portraitY: 0,
      portraitHeight: 614,
      firstNameX: 78,
      lastNameX: 5
    }
  };
  const carloZarriInterviewQuote = 'Ho sempre scommesso su me stesso, senza badare al guadagno iniziale.';
  const carloZarriInterviewTranscript: InterviewTranscriptSection[] = [
    {
      question: "Quali sono state le tappe fondamentali che l'hanno portata a lavorare alle Olimpiadi di Cortina 2026?",
      answer: `Allora questa è stata la mia sesta Olimpiade. Ho incominciato con Salt Lake City nel 2002, poi nel 2004, 2006, ecc. Ero direttore Food and Beverage. Sono partito come direttore Food and Beverage per Torino 2006. Mi hanno mandato a Salt Lake City, che erano le Olimpiadi invernali precedenti, per fare esperienza e portare la mia esperienza poi su Torino e che è stata molto, molto utile. Poi ho fatto Atene perché era nel mezzo, poi ho fatto Vancouver. Poi ho fatto Parigi due anni fa e nel 2018 Milano fa la candidatura (siccome bisogna fare un dossier di candidatura) chiede a me se posso farlo, vista l'esperienza passata sul Food and Beverage. nel 2021 entro in MICO (che sta per Milano Cortina 2026) col ruolo di Head of Food and Beverage. Poi le cose un po' si evolvono, nel 2024, a luglio divento direttore per le Hospitality e poi arriva il periodo olimpico. C'erano un po' di difficoltà su Santa Giulia, che era il sito dove si facevano le gare più importanti di hockey, e quindi io poi sono stato sempre lì. Per dirvi, il 30 di gennaio era ancora un cantiere, quindi si entrava con l'elmetto, col giubbotto catarifrangente e le scarpe antinfortunistiche; la situazione era veramente drammatica. Da dicembre 2025 abbiamo cambiato completamente la strategia per quel sito, perché si sapeva che avrebbe avuto delle grosse difficoltà. A volte si arrivava fino a 11.000 spettatori per tre gare al giorno. Al primo di febbraio smontiamo i cassoni dove ci sono le cucine e incominciamo a montarle: capite che per fare fino a 30.000 pasti al giorno non puoi partire due giorni prima. Oltretutto devi avere il permesso dell'ASL, che in effetti ci ha dato subito. Alla fine abbiamo completato due cucine su quattro, perché due non siamo riusciti a finirle. Oltre a questo non vi so dire niente di come è andata, perché dall'11 gennaio fino alla fine dei giochi, dalle 8:00 del mattino a mezzanotte ero a Santa Giulia.`
    },
    {
      question: 'Ci può raccontare la sua evoluzione professionale?',
      answer: `Quando mi sono diplomato io c'erano i sessantesimi. Eravamo tre maschi e 25 femmine e loro erano tutte brave, la maggior parte è uscita con 60/60. Noi tre maschi siamo usciti uno con 37, uno con 38, io con 39. Quindi non è che se uno esce con 60/60 è bravissimo e sa già cosa farà nella vita. Io sono sempre partito con molta umiltà, volendo imparare e cercando di fare esperienza. Per mia fortuna mi sono sempre applicato molto su tutte le cose che facevo; se le cose mi piacciono mi applico, non guardo quante ore ci devo dedicare. E questa è anche una fortuna, perché se riesci a lavorare anche 12 o 14 ore al giorno vuol dire che non è un lavoro, ma è un qualcosa che ti piace fare. Nel 1997 ci sono i mondiali di sci a Sestriere. Io a quei tempi ero Presidente del consorzio turistico Langhe Monferrato Roero. Vado in Regione Piemonte e propongo: "Visto che state spendendo tanti soldi per far arrivare i mondiali a Sestriere, non possiamo spendere 1000 lire in più e fare un ricevimento per i giornalisti come si deve, per far vedere la cucina piemontese?". Porto su 7-8 colleghi, facciamo questo ricevimento che va alla grande. Tutti parlano dei mondiali di sci, ma dedicano attenzione anche alla cucina italiana e piemontese. Nel 2001 Torino riceve l'incarico di organizzare le Olimpiadi. Alzo la cornetta, chiamo il Comitato organizzatore e mi offro: "Se avete piacere di fare qualche cosa all'interno delle Olimpiadi per fare bella figura con la cucina, noi ci siamo". Mi affidano un paio di incarichi che faccio gratis. Facendo così sei anche più forte: se fai vedere quello che sai fare, partono da un'altra base. Il primo evento era completamente gratis; nel secondo evento, con 110 rappresentanti del CIO di tutto il mondo, gli organizzatori decidono di pagare le materie prime, 15 euro a persona. Va molto bene. Il direttore due giorni dopo mi chiama a Torino per una collaborazione seria e mi affida l'organizzazione di Casa Italia alle Olimpiadi di Salt Lake City 2002. Mi affida anche l'incarico di Observer, per andare in giro per i siti a vedere cosa succede dietro le quinte. A Salt Lake City abbiamo fatto una grandissima figura: l'associazione dei giornalisti internazionali ci ha dato il premio per la miglior Hospitality House di sempre. Ho portato 40 persone tra pasticceri, sommelier e cuochi, facendo tutta cucina dal vivo. Una decina di televisioni sono venute a farci visita, tra cui la NBC americana, che, finite le Olimpiadi, mi ha invitato a New York per fare dei servizi sulla cucina italiana. Qualche anno dopo mi danno il ruolo di direttore Food and Beverage per le Olimpiadi di Torino 2006, poi vado a Vancouver, e nel 2015 all'Expo a Milano per organizzare il padiglione americano. Quando Milano si candida per ospitare le Olimpiadi, salta fuori il mio nome proprio per l'esperienza accumulata. Voglio dirvi che ho sempre scommesso su me stesso, senza badare al guadagno iniziale.`
    },
    {
      question: "Una domanda sempre relativa a questa questione: quanto tempo prima dell'inizio effettivo delle gare parte la macchina organizzativa in cucina? Quanto prima vengono contattati coloro che si occupano dell'organizzazione?",
      answer: `È una bella storia anche questa. Dopo varie esperienze in giro per il mondo, l'8 dicembre 2018 ero in vacanza a Orlando. Mi chiama il responsabile della redazione del dossier per la candidatura e mi chiede se mi interessava preparare la parte sul Food and Beverage, con il problema che andava presentato l'11 dicembre. Quindi gli ultimi due giorni di vacanza me li sono passati a lavorare sui dati che mi hanno mandato: quanti atleti, siti di gara, giornalisti. Questo nel 2018 per il dossier di candidatura. Nel 2019 Milano Cortina vince, e nel 2021 io entro nello staff come direttore Food and Beverage.`
    },
    {
      question: 'Ci puoi spiegare meglio come funziona questo dossier di candidatura?',
      answer: `Ci sono 110-120 delegati delle federazioni internazionali, i Presidenti dei vari Comitati Olimpici nel mondo, che valutano il dossier che hai presentato e decidono chi vince; quindi devi essere molto esaustivo e attraente.`
    },
    {
      question: "Infatti un'altra domanda che ti volevamo fare era: quali differenze sostanziali hai riscontrato in questa edizione rispetto alle precedenti esperienze olimpiche?",
      answer: `La complessità di questa Olimpiade era la logistica. Mentre a Torino riguardava una provincia a un'ora e mezza di distanza, qui avevi quattro regioni e 9 province. Per spiegarlo agli americani facevo questo esempio: è come avere le Olimpiadi a Washington, la gara di slalom a New York, il bob a Philadelphia e il fondo a Charleston. L'impatto logistico ed economico è molto diverso. Avevamo 7 villaggi olimpici sparsi (Predazzo, Livigno, Cortina e i cluster a Bormio); per visitarli tutti ho impiegato quattro giorni.`
    },
    {
      question: "Volevamo farle anche una domanda in merito al menu olimpico: come nasce e con che criteri si struttura? Chi se ne occupa? Abbiamo sentito da una sua intervista passata che raccontava come ci sia stato il bisogno di mantenere vive le tradizioni locali e allo stesso tempo rappresentare la cucina italiana per garantire un'esperienza quanto più completa possibile agli ospiti internazionali. Come si è arrivati a trovare un equilibrio tra questi aspetti all'interno del menù?",
      answer: `Innanzitutto ci sono 7 famiglie di clienti diverse, con 7 esigenze, spazi e orari diversi: Gli atleti: possono mangiare 24 ore al giorno. Per loro non c'è budget e non si può speculare. I volontari (circa 18.000): devi trattarli bene con pasti caldi e bevande, specialmente chi sta al freddo. La Workforce (chi ha ruoli di management o esecutivi, ma non volontari): si applica la logica dei volontari per dare supporto sulle piste. La Famiglia Olimpica (Presidenti, Ministri): non sono pretenziosi, e non si vuole mandare il messaggio che si "trattino bene" eccessivamente. I media: divisi tra giornalisti e televisioni, inclusi i cameraman che lavorano al freddo. L'Hospitality: i VIP e gli sponsor che non hanno problemi di budget. Gli spettatori: a Milano sono stati quasi un milione e mezzo. La mia programmazione generale per i giorni di gara è stata sui 3 milioni circa di pasti da fare in tre settimane. Per i menù, mi sono seduto con i responsabili delle varie federazioni, scendendo a compromessi sulle loro esigenze e richieste (ad esempio, chi vuole 5 pizze e chi 5 paste). Poi c'è il confronto con la logistica e le finanze: se devi tagliare i costi del 30% o se gli ingegneri riducono gli spazi delle cucine, devi ritrattare le offerte. Questi sono i motivi per cui ci vogliono 5 o 6 anni di organizzazione.`
    },
    {
      question: "Ha anche accennato al fatto che la cucina deve essere sostanzialmente aperta 24 ore su 24, comunque per molto tempo. Com'è che ci si organizza all'interno? Immagino ci siano dei turni, come funziona?",
      answer: `Sì, assolutamente, devi fare i turni di servizio. Dalle 07:00 c'è la colazione con 30-35 scelte, che poi si riducono. Dalle 12:00 c'è il pranzo con 70-80 scelte di cibo, poi snack nel pomeriggio, e dalle 18:00 alle 22:00 c'è di nuovo il menu intero. In base agli orari delle gare (ad esempio se l'hockey finisce tardi) devi adattare il servizio e far trovare qualcosa di pronto anche all'una di notte. Poi capita l'imprevisto: se nevica e si annulla una gara, la cucina preparata per 100 persone si ritrova a doverne sfamare 500. Non si può essere fiscali, si deve sempre essere pronti.`
    },
    {
      question: "Invece appunto, dato che la cucina è come ha detto lei aperta 24 ore su 24, le brigate come vengono composte? Chi sceglie con chi lavorare, come funziona l'organizzazione interna?",
      answer: `Io sono molto paladino della cucina italiana. Sono sempre partito dall'idea di esaltare le nostre peculiarità, rispettando ovviamente i territori (Lombardia, Veneto, Trentino), ma introducendo anche il pesce del Sud, la cucina ligure, piemontese ed emiliana. Per avere una semplificazione sui siti, devi organizzarti: fai preparare 10.000 teglie di lasagne un mese prima e le congeli, così le devi solo infornare, oppure fai arrivare le patate già pelate. Bisogna tenere in considerazione le esigenze degli atleti: porzioni piccole (come il pollo ai ferri, così decidono quanti pezzi mangiare), diete religiose (kosher, halal) e richieste particolari. Per le brigate, devi sapere quanti pasti servire. Il numero dello staff va tarato in base alle esigenze di servizio per essere veloci ed evitare code agli atleti. Devi tenere un 20% di staff di scorta per gli imprevisti (chi si ammala, chi non si presenta). L'organizzazione include anche la gestione per evitare sprechi: se avanza del pesto, il giorno dopo lo dai ai volontari. Riguardo l'assunzione del personale, si è provato a fare delle gare d'appalto, ma sono andate deserte perché nessuno vuole prendersi il rischio sulle fluttuazioni dei numeri tre anni prima. Ho suggerito invece consultazioni di mercato basate sui costi orari (ad esempio, pagare a tariffa oraria cuochi e lavapiatti), che è il metodo più sicuro e flessibile.`
    },
    {
      question: "Abbiamo visto anche che all'interno delle brigate sono stati chiamati anche degli chef professionisti, per esempio abbiamo visto Stefano Paganini con la sua brigata e quella dello chef Ken Frank. In base a cosa sono stati scelti? E in base a cosa una brigata è composta da chef professionisti o comunque di alta cucina rispetto a magari dei volontari, come dicevamo prima, e poi anche qual è il vantaggio o la difficoltà che si può creare ad avere una brigata internazionale come appunto quella di chef Paganini che aveva all'interno sia chef italiani che americani?",
      answer: `Gli americani li ho portati io, sono tutti chef che hanno proprietà di ristoranti in America dove io vado a fare i miei eventi. Mi chiedevano tutti di venire a dare una mano, e quando ho proposto di pagarli hanno detto che i soldi erano l'ultimo problema. Ho coinvolto tanti chef, come Paganini, proponendo un'esperienza unica in alternativa alle ferie nei periodi di bassa stagione, invitandoli a portare la loro brigata. Il professionista deve venire per passione e flessibilità: deve essere contento di servire 200 persone anziché le 100 previste, allo stesso prezzo, senza fare calcoli sindacali sugli orari, perché alle Olimpiadi non funziona così. Questi professionisti li ho posizionati soprattutto dove c'era bisogno di far bella figura, come nell'Hospitality e davanti alle televisioni internazionali, a cui interessava molto far vedere gli chef al lavoro.`
    },
    {
      question: "E invece, come funziona ad esempio con i fornitori, dato che appunto lei ha detto che non si può fare ovviamente lì per lì e si deve preparare molto prima il cibo, come ci si organizza su quel lato?",
      answer: `Devi trovare il compromesso tra il fornitore che ti garantisce la miglior qualità al giusto prezzo e la necessaria flessibilità. Le Olimpiadi hanno bisogno di flessibilità da parte di tutti. Posso concordare un prezzo per un chilo di lasagne, ma quando capita l'inconveniente e me ne servono due, bisogna che il fornitore sia disposto ad assecondarmi senza raddoppiare i prezzi per l'emergenza. Tutte le parti interessate devono avere l'interesse, la convenienza e la voglia di lavorare in un progetto del genere. Devi trovare il fornitore che ti garantisce non un chilo, ma 10.000 teglie di lasagne.`
    }
  ];
  const faustoMeliInterviewQuote = "220.000 ospiti da servire in venti giorni: la vera sfida era prevedere l'imprevisto.";
  const faustoMeliInterviewTranscript: InterviewTranscriptSection[] = [
    {
      question:
        'Potrebbe presentarsi e descriverci la sua esperienza alle Olimpiadi invernali di Milano Cortina 2026? Qual era il suo ruolo specifico e di quali mansioni si occupava quotidianamente?',
      answer: `Io sono Fausto Meli, sono un docente di cucina e tecniche della ristorazione all'Istituto alberghiero di Chivasso. Sono arrivato alle Olimpiadi di Milano Cortina 26 perché ho già collaborato con Carlo Zarri nelle Olimpiadi di Torino, poi insieme abbiamo fatto anche l'Expo di Milano. Il mio ruolo era quello di Executive Chef per quanto riguarda la lounge hospitality su otto siti, tra cui i tre di Milano e i cinque in montagna. La grande difficoltà non è stata tanto il menù, perché i menù non erano particolarmente difficili o complicati da produrre. Il problema più grande era il numero: noi abbiamo avuto su tutti i siti circa 220.000 ospiti da servire in venti giorni di attività sportiva. Abbiamo cominciato circa un anno e mezzo prima per capire quale tipologia di piatti poteva essere più indicata, quale tipologia di fornitori e quale tipologia di servizio sarebbe stata quella più idonea. Tenete conto che abbiamo anche portato a bordo circa sei istituti alberghieri che ci hanno aiutato, tra cui l'Istituto di Busto Arsizio, l'Istituto Lagrange di Milano, l'Istituto di Bormio, l'Istituto di Cortina e l'Istituto di Brunico, per effettuare tutte le tipologie di servizi. Noi per comodità abbiamo escluso i secondi e ci siamo tolti il problema della carne di suino per eventuali ospiti musulmani. Ci siamo dati da fare più che altro sugli impegni del made in Italy, quindi sui primi piatti, antipasti e dolci. La più grande difficoltà era quella di prevedere gli imprevisti: in montagna, soprattutto nel caso di una nevicata particolarmente abbondante, non si poteva intervenire con i rifornimenti, quindi abbiamo previsto che in ogni sede ci siano stati almeno tre giorni di indipendenza, nel caso il camion potesse avere un incidente, ci fosse una nevicata o un malessere del personale. Il lavoro è stato fatto soprattutto su quello.`
    },
    {
      question:
        'Come ha vissuto queste Olimpiadi? Abbiamo visto che ha lavorato anche per le Olimpiadi di Torino 2006, ha notato delle differenze?',
      answer: `La grande differenza fra Torino e Milano è che a Torino avevamo tutti i siti concentrati nel giro di 100-120 km. Tutte le specialità olimpiche sono state fatte nella provincia di Torino; non avevamo nulla fuori. La grande difficoltà su Milano Cortina era proprio la distanza tra i vari siti gara. Tieni conto che da Milano per arrivare a Cortina ci metti 5 ore di macchina, quindi anche per tutti i carichi e rifornimenti. La maggior parte delle aziende coinvolte erano degli sponsor, quindi abbiamo dovuto adeguare anche il menu e le bevande. Ogni volta che cambiava uno sponsor o lo sponsor diventava main sponsor, c'era da cambiare parte del menu. È ovvio che se Grana Padano ha fatto da sponsor la parola "Parmigiano" è scomparsa del tutto in quei 20 giorni. In ogni caso, se la bevanda principale è Coca Cola, non si poteva neanche parlare di bevande di altre marche. Quindi è un incastro di situazioni molto particolari. Il menù l'abbiamo cambiato o rivisto almeno una dozzina di volte, proprio perché c'era uno sponsor che usciva e uno sponsor che entrava. Su Milano Cortina la più grossa difficoltà sono state queste 5 ore di macchina che uno doveva farsi per riuscire ad arrivare ai vari siti.`
    },
    {
      question: "Come è nata l'occasione di lavorare all'interno di un contesto così prestigioso?",
      answer: `Mi sono trovato con l'invito di Carlo Zarri, che era il Food and Beverage Manager. Lo conoscevo già e la grande difficoltà che ho trovato io personalmente è che, lavorando per un'azienda americana, loro hanno uno stile completamente diverso rispetto alle nostre tipologie di lavoro, quindi mi sono dovuto adeguare, anche semplicemente con un linguaggio diverso. Potete immaginare che in una cucina molte volte il linguaggio non sia molto amichevole, anche tra colleghi. Loro su queste cose sono molto più suscettibili, quindi molte volte ho dovuto prendere del tempo prima di rispondere in maniera più adeguata possibile. Lo stile di lavoro comunque è diverso. Non posso dire che loro siano più bravi, non lo dirò mai. Posso dire che loro sono più pignoli? Sì, però tieni conto che per i primi 3-4 mesi entrare nella loro fase di lavoro non è stato semplice. Detto tra di noi: il v********o per noi non è proprio una cosa grave. Soprattutto in un ambiente di cucina dove lavori a stretto contatto per tante ore, gomito a gomito, può anche scappare. Su questo loro invece sono molto più attenti.`
    },
    {
      question: "Com'era composto il suo team di lavoro? Come si è interfacciato a livello umano con colleghi e collaboratori?",
      answer: `Io avevo 8 chef, uno per ogni sito, con cui avevo più contatti diretti. Ovviamente non potevo essere in otto siti contemporaneamente. Ogni chef aveva la sua brigata in base alla grandezza del luogo dove operava. Tieni conto che Brunico aveva uno chef, due sous-chef e 15 ragazzi. A Santa Giulia (Milano) c'è stata un po' più di difficoltà rispetto agli altri villaggi, infatti metà Olimpiadi io le ho passate lì. È stato un impianto consegnato 5 giorni prima e quindi abbiamo dovuto correre, confrontandoci in 5 giorni più volte con chi doveva poi operare. Il lato umano viene fuori prima delle Olimpiadi e viene fuori dopo le Olimpiadi. Il durante, purtroppo, quando hai gli occhi addosso di mezzo mondo diventa molto più difficile, però chi lavora in questo campo sa benissimo che durante il servizio tutto può capitare, poi tutto si deve dimenticare.`
    },
    {
      question: "Com'erano strutturati i ritmi e gli orari di lavoro?",
      answer: `Gli operatori normali lavoravano 8 ore, 40 ore settimanali, tutto abbastanza concentrato. I ragazzi in stage delle scuole invece lavoravano meno, solo nelle ore di servizio, le ore di punta. Per quanto riguarda gli chef e me, la sveglia era alle 06:30 e si andava a dormire intorno all'1:00. Perché poi capitava di spostarsi: sei a Santa Giulia, ma visto che sei a Milano fai un salto a Rho, hai ancora mezz'oretta di tempo e vai ad Assago perché comunque il controllo deve essere fatto. Poi io mi sono allontanato 5 giorni e ho fatto tutta la parte di montagna. Diciamo che gli orari di lavoro per chi fa il cuoco o il cameriere potrebbero essere più normali; per chi ha una responsabilità diversa, l'orologio è la prima cosa che guardi al mattino ed è l'ultima cosa che guardi quando vai a dormire. Non ho mai lavorato 8 ore durante le Olimpiadi. Bisogna essere molto flessibili, molto attenti. Tieni conto che io avevo 8 chef per ogni sito che sentivo almeno 3-4 volte al giorno. Quindi oltre al lavoro fisico c'era anche quello più pesante, che è quello mentale. Quando vuoi andare a dormire vuoi essere tranquillo, cosa che non è successa sempre.`
    },
    {
      question: "Ci potrebbe parlare più nello specifico di quali piatti venivano proposti agli ospiti all'interno del menù?",
      answer: `Noi abbiamo fatto questo tipo di scelta: un menù di rotazioni di tre giorni. Finito il giorno tre si riprendeva dal giorno uno. Questo ci ha comportato di sintetizzare e non avere un elenco di ingredienti enorme, oltre che averci permesso di non buttare via degli alimenti. C'era un buffet di benvenuto con il calice, che comunque doveva essere prosecco perché è sponsor, e piccoli assaggi, tra cui Grana Padano. Poi l'ospite si spostava nella sala centrale dove c'erano vari buffet, tra cui uno di salumi e formaggi. Ovviamente i formaggi locali: oltre al Grana che era sempre presente, il taleggio, il puzzone di Moena e poi i salumi. Sul prosciutto non avevamo uno sponsor vero e proprio, però l'azienda Beretta ha messo a disposizione parecchi prodotti, quindi sempre presente il prosciutto crudo e il prosciutto cotto, purtroppo. Dico purtroppo perché a me non piace, per me il prosciutto cotto è un salume immangiabile, ma questa è una cosa personale. Poi c'erano due primi, sempre caldi, a disposizione dei nostri ospiti. Una polenta sempre fissa con tre salse diverse, una diversa per giorno, e tre dolci a rotazione, più il cannoncino alla crema che era più morbido come servizio, perché noi mettevamo sempre un ragazzo che faceva show cooking. Non erano previsti superalcolici. Di alcolico avevamo ovviamente lo sponsor della birra, che era Ceres, e i vini, principalmente Prosecco e poi qualche vino della Valtellina o del Veneto. I nostri ospiti erano vari: da qualche principe o regnante, a qualche nostro ministro, a persone particolarmente facoltose, perché i prezzi che applicavamo non erano semplici. Tenete conto che in lounge hospitality della finale di hockey, che era quella un po' più seguita da parte di americani e canadesi, costava qualche migliaio di euro.`
    },
    {
      question:
        "Immaginiamo che lavorare per clienti di questo tipo possa essere un'esperienza particolare. Le è capitato di ricevere richieste particolari da parte di alcuni commensali? Ha qualche aneddoto da raccontare?",
      answer: `non farò il nome per correttezza: noi avevamo preparato tutti questi menù profondamente italiani, ma un principe ci ha chiesto la pizza. E noi siamo dovuti andare a comprargli la pizza. Abbiamo mandato un ragazzo con la macchina di corsa a comprarla. Quindi può capitare di tutto. Può capitare anche che persone importanti spendano migliaia di euro e non mangino nulla. Poi ho preso qualche pacca sulle spalle anch'io, per fortuna in maniera simpatica, da personaggi importanti. Ve lo do come consiglio generale: differenziate le persone importanti dalle persone famose. Sono due cose completamente diverse. Cercate sempre di trattare tutti allo stesso modo. E poi: se vi capita di parlare con un calciatore, non parlate mai di calcio. Gli fate un favore.`
    },
    {
      question: "Come ultima domanda, un po' più personale, vorremmo chiederle che cosa si porta dietro da questa esperienza? Cosa le è rimasto impresso?",
      answer: `A differenza delle altre, qui mi porto come bella esperienza il fatto di aver superato questo evento bene, malgrado l'età. Ho portato a casa una Milano che non conoscevo perché l'ho sempre vista, da torinese, un po' bruttina. E invece durante il periodo olimpico l'ho vista diversa, l'ho vista più attiva, l'ho vista più giovane, l'ho vista più solare. Probabilmente è quello ciò che non avevo mai visto prima. E poi porto comunque centinaia di contatti e spero anche centinaia di amici, che è la cosa più importante.`
    }
  ];
  const stefanoPaganiniInterviewQuote = 'Il confronto è crescita.';
  const stefanoPaganiniInterviewTranscript: InterviewTranscriptSection[] = [
    {
      question: "Qual è stato il processo che l'ha portato alle Olimpiadi, come è riuscito ad arrivare ad un traguardo del genere?",
      answer: `Come vi ho detto prima per me erano 20 anni dalla prima Olimpiade avevo voglia di rifarle, viverle in maniera diversa. Lo dico in maniera molto schietta, ho i ragazzi da mantenere, gennaio, febbraio, marzo in questa zona qua si lavora poco. quindi nel momento che volevo tenere i miei ragazzi ho dovuto trovare un modo per riuscire a farli lavorare garantendogli uno stipendio e allora ho fatto come dicevo la faccia di tola ho chiamato Carlo Zarri e gli ho detto senti se hai bisogno sai che puoi contare su di me inizialmente lui mi contatta poi per andare a Milano e quando mi contatta per andare a Milano aveva preso solo me La cosa non mi sembrava giusta nei confronti dei miei ragazzi, no? Perché poi, sai, quando i gatti non ci sono i topi ballano, è un'esperienza che volevo fare insieme a loro per creare poi il gruppo. quindi la mia scelta poi è stata di rinunciare a Milano chiedendo a Carlo Zarri se aveva altre possibilità o altre cose da farmi fare Fortunatamente è uscita fuori Livigno dove ci hanno preso tutti, quindi hanno preso tutti e siamo andati a affiancare uno staff americano.`
    },
    {
      question:
        'Ci ha detto di aver fatto un passo indietro come figura professionale per portare con lei il suo staff di base. Quante persone lavorano con lei e quali erano le mansioni di queste persone alle Olimpiadi?',
      answer: `Io ero un po' il cuoco, quindi affiancavo lo chef americano. I miei ragazzi sono stati divisi: due in zona lavaggio e pulizia della cucina e due alla sala, fondamentalmente allo sporzionamento del servizio. Poi cercavo di farli ruotare, ma lavoravamo tutti sotto un altro capo, quindi le mansioni erano quelle. Sono sincero, l'ho fatto più che altro per far vivere loro un'esperienza olimpica e portarli tutti con me per fare gruppo. Quando ho deciso di andare ho fatto una riunione e ho detto: "Ragazzi, vi va di venire alle Olimpiadi? Sappiate che queste sono le vostre mansioni, vi va bene?". Nel momento in cui dici sì, hai accettato. È anche vero che loro hanno potuto viverla, perché avevamo tutti i benefit, a parte l'essere stipendiati. Avevamo i pass per le gare olimpiche come quelli dei cameraman. Devo essere sincero, la gara la vedevi a bordo pista. Io me la sono vissuta bene, loro un po' meno per il semplice motivo che alla sera, avendo vent'anni, facevano i bagordi. Al mattino arrivavano stanchi e di gare ne hanno viste poche, perché dovevano recuperare il sonno. Comunque poi lavori, non è uno scherzo; è un lavoro meno impegnativo del ristorante perché devi stare meno concentrato, c'è meno pressione ed è più facile, ma loro l'hanno presa forse un po' troppo come vacanza. Io l'ho fatto per creare il gruppo e per far vivere un'esperienza, ma loro purtroppo facevano i paragoni con lo staff americano. Non puoi fare un paragone con uno stato che non è il tuo, quando le regole del lavoro sono completamente diverse. Innanzitutto, lo staff americano prendeva il doppio rispetto a noi, però l'assicurazione sanitaria se la pagano: cambia il concetto. Pensavo che a ventiquattro o venticinque anni i ragionamenti venissero attuati in autonomia, invece mi sono sbagliato, ma fa parte del gioco e delle sfide. In realtà la convivenza ventiquattro ore su ventiquattro non ha funzionato come speravo, perché dormivano sotto di me e alla sera dovevo chiamare: "Andate a dormire che sono le 5 del mattino e domani scendo alle 8". Non ha funzionato quel tipo di convivenza, ma se non provi non sai; sono dell'idea che bisogna provare tutto, fare le proprie scelte e ogni sbaglio diventa una correzione. Negli anni ho modificato le mie idee, mi sono adattato al paese in cui sono. Per Magliano faccio qualunque cosa: la mensa per i bambini, il gelato per la casa di riposo, le feste della Pro Loco; non mi sono mai tirato indietro.`
    },
    {
      question:
        "Per quanto riguarda il menù, quando è arrivato le hanno già sottoposto un menù pronto? Quali erano i piatti che preparavate? Sappiamo che c'era una rotazione dei piatti; non so se ogni sito aveva un'organizzazione diversa, se vuole spiegarci quello.",
      answer: `Quando siamo arrivati là praticamente era già tutto predisposto, perché il catering che seguiva le Olimpiadi era molto organizzato. Il menù era già esposto su un muro per tutti i giorni e cambiava tra pranzo e cena. Magari c'erano le stesse materie prime, tipo oggi il petto di pollo e tra due giorni di nuovo il pollo, ma cambiavano le ricette: oggi scaloppine al pomodoro, domani rollè di pollo. Era tutto schematizzato in maniera perfetta e per me è stato abbastanza facile perché ogni piatto aveva la sua ricetta, bastava fare le preparazioni. Sapevi che l'indomani c'erano la pasta al pomodoro, l'arrosto, gli gnocchi, il petto di pollo, la torta, il salad bar e due panini. La gestione era che oggi lavoravamo sul menù di domani: il mattino dopo due si staccavano per fare il servizio, mentre gli altri continuavano a produrre per la sera o per il giorno successivo, in maniera da essere sempre avvantaggiati di un giorno. C'era una buonissima organizzazione dietro.`
    },
    {
      question: 'Nella cucina dove ha lavorato lei, per quali figure lavoravate?',
      answer: `Noi lavoravamo fondamentalmente per i cameraman, gli addetti ai lavori dell'NBC. A questi si aggiungeva tutto il retrobottega delle riprese, come elettricisti e macchinisti; dietro a un cronista c'era un mondo. Lavoravamo per quel mondo invisibile, e senza quegli addetti ai lavori, quello che avete visto in televisione non si sarebbe potuto vedere.`
    },
    {
      question: 'Avete potuto vedere qualche reazione, qualche feedback a caldo delle persone che assaggiavano i vostri piatti?',
      answer: `Io in sala non c'ero, c'era mia moglie. Lì c'era gente da tutto il mondo: l'americano, l'italiano, lo spagnolo. Naturalmente ogni gusto cambia a seconda della provenienza, ma il 90% ha gradito perché era un menù pensato da americani in stile italiano. Molti piatti italiani venivano proposti in versione americana, nel senso che le porzioni erano belle massicce, però lo standard qualitativo era molto alto perché erano tutti prodotti freschi, non c'era niente di surgelato. Quando c'erano i cavoletti di Bruxelles come contorno ho pulito un bancale intero di cavoletti. Mi sono stupito che fosse tutto fresco e di prima qualità; non c'era il fondo di magazzino, anzi, si mangiava bene. Il pesce era fresco, e controllavano che tutte le insalate e verdure fossero freschissime.`
    },
    {
      question: 'Come funzionava questo rapporto con i fornitori? Arrivavano ogni giorno le materie prime?',
      answer: `Quando fai un appalto grosso, ti siedi a un tavolo per gli acquisti aziendali in modo da programmare la fornitura e far sì che non manchi nulla. Da noi arrivavano due o tre bancali di roba fresca ogni tre giorni, perché dovevi rigenerare le scorte. C'era sempre la paura che nevicasse, quindi dovevamo avere della merce in più per non rimanere fermi se avessero bloccato le consegne. Le celle erano sempre stracolme, non ti mancava mai nulla. Chi ha fatto gli ordini lo ha fatto ponderando bene le scelte; lo stesso catering seguiva Livigno, Bormio e Milano per l'NBC, quindi le consegne alimentari erano divise su più location e i volumi erano importanti.`
    },
    {
      question:
        "Siccome le porzioni dovevano essere adattate a un pubblico americano, a livello di proposta del menù secondo lei quanto c'è dell'Italia in quel menù e quanto è stato adeguato a un pubblico più internazionale?",
      answer: `C'era molta Italia, perché il 99,9% dei prodotti era italiano. Tanti piatti erano italiani fatti con ricette italiane, in particolare la pasta, dall'amatriciana al pesto. Erano adattati più che altro nelle porzioni, perché essendo tra virgolette una mensa, c'era chi mangiava un solo piatto per fare il pasto, e chi prendeva un cucchiaio di tutto. L'americano si mangia il petto di pollo, ma lo vuole intero; l'italiano vuole la bistecchina, un po' di pasta e un po' di insalata. Devi dare a tutti la possibilità di gestirsi ed essere sazi. Purtroppo a volte c'erano molti sprechi a livello gestionale. Cucinavamo per 500 persone a pranzo e a cena, quindi tutti i piatti venivano preparati per 500, ma non tutti mangiavano ogni cosa. Se metti la pizza e di fianco l'arrosto, secondo te cosa vince? Non l'arrosto, mi sa! Però devi essere pronto in tutti e due i casi e avere l'arrosto per 500 persone, così come la pizza. Fortunatamente sapevano equilibrare e gli sprechi sono stati minimizzati. Mi hanno lasciato anche fare: se avanzava il petto di pollo, mi inventavo l'insalata di pollo o il panino per noi dello staff, che eravamo in 20. C'erano tantissime zucchine in cella; per non sprecarle ho fatto le zucchine in carpione per il salad bar, così le ho utilizzate, ho allungato la loro conservazione e ho insegnato a un americano a fare il carpione. Abbiamo cucinato per mille persone con 12 forni, due friggitrici e una piastra. L'attrezzatura era quella, quindi la gestione dei tempi di preparazione e di servizio è stata fondamentale per non accavallare le cose. Loro erano abituati e sapevano benissimo rispettare queste tempistiche.`
    },
    {
      question: "C'è qualcos'altro che si porta a casa da questo scambio con uno staff americano, con un'altra cultura?",
      answer: `Lavorare in cucina è una situazione uguale in tutto il mondo, perché cucini per le persone. Noi italiani siamo un po' più precisi a livello di ordine, di pulizia, e più attenti alle dinamiche HACCP, alla ricettazione e alle temperature. L'americano dà alcune cose un po' più per scontate, del tipo "va bene così". A livello di cucina ognuno ha le proprie idee, ma il lavoro ha come fine le mani che creano: le mie mani sono uguali a quelle americane, cinesi o giapponesi. Se non fossimo stati precisi come lo sarei stato io, rischiavamo di far star male mille persone.`
    },
    {
      question: 'A proposito di questi aneddoti, ha qualche ricordo particolare? Qualche richiesta difficoltosa?',
      answer: `Con mille persone le allergie e le intolleranze alimentari sono all'ordine del giorno. Avevamo sempre le alternative predisposte per il celiaco, per il vegano e per il vegetariano.`
    },
    {
      question: 'Le richieste e necessità le sapevate prima o durante?',
      answer: `A volte durante, perché magari gli staff cambiavano: un giorno avevi il cameraman che mangiava tutto, e l'indomani quello celiaco. Avevamo una parte dedicata ai prodotti per celiaci, vegani e vegetariani inglobata nel menù. A differenza di noi italiani, che abbiamo gli allergeni scritti sotto ogni piatto, vivendo sotto lo staff americano gli allergeni sul menù non c'erano. L'italiano veniva a chiederli, all'americano non importava nulla degli allergeni. Questo ha destabilizzato la parte di italiani nel gruppo, che si aspettava gli allergeni elencati. Su queste cose siamo più avanti; a livello sanitario ho sempre pensato che l'Unione Europea dovrebbe avere regole uguali per tutti gli stati, e le nostre regole dovrebbero essere lo standard. A volte vedi lattine col sugo lasciate aperte o cose non coperte in cella, buttate in frigo così; io passavo dietro e mettevo la pellicola su tutto. Nonostante cucinassimo sotto un capannone dove il riscaldamento a volte saltava con meno venti gradi all'esterno, i controlli sanitari ci sono stati, gli stessi che ho al ristorante.`
    },
    {
      question: "Per quanto riguarda lo smaltimento, c'era qualche piano attuato?",
      answer: `Sì, Livigno era molto ben organizzata. Lo smaltimento era fatto dal comune. Con gli americani c'è stata un po' di lotta per fargli capire la divisione tra carta, plastica e organico. Per noi è abitudine, per uno che arriva da fuori è semplicemente immondizia. Abbiamo tribolato la prima settimana, poi abbiamo fatto dei cartelloni da mettere sopra i bidoni. Lo smaltimento veniva effettuato anche tre volte al giorno perché i volumi erano tanti; per mille persone producevamo mille bottigliette d'acqua al giorno e innumerevoli cartoni vuoti. A Livigno siamo stati organizzati perfino con i bidoni per l'olio esausto, come in Italia.`
    },
    {
      question: "Come ha vissuto questa esperienza e la considera utile per la sua figura e per il suo ristorante? C'è un tornaconto?",
      answer: `Ho scelto di fare le Olimpiadi per due ragioni: la prima era che a gennaio, febbraio e marzo non avrei avuto lavoro sufficiente da garantire al mio staff, e da responsabile aziendale l'ho fatto per tutelarli. La seconda era che ricorrevano vent'anni dalla prima Olimpiade, due le ho fatte in Italia e volevo esserci; è stata una ciliegina sulla torta, una questione di orgoglio personale. Sul curriculum aiuta, ma non ci ho marciato troppo sopra: ho detto alla clientela che chiudevo per andare a Livigno a fare le Olimpiadi e che ci saremmo visti al ritorno. Il mio lavoro è cucinare e far stare bene la gente. Mi è servito per confrontarmi con un contesto diverso, perché il confronto è crescita. Ti porti a casa dettagli organizzativi utili, per esempio sull'abbigliamento in cucina, che ti aiutano a perfezionare i dettagli a casa tua. Non sono uno da televisione o da social, anche se so che oggi tutto passa da lì. Il mio approccio ideale è che il cliente viene, diventiamo amici, e viene per il piacere di farlo. La mia parola è nel piatto: comunico me stesso nel silenzio di un piatto. Non voglio fare i fuochi d'artificio, voglio cucinare bene e poche cose fatte bene.`
    },
    {
      question:
        "Si dice spesso che la cucina sia una forma d'arte. Lei questa cosa la vive solo nel suo ristorante o anche in un piatto cucinato alle Olimpiadi, con menù già fissati?",
      answer: `Alle Olimpiadi non puoi fare nulla del genere; si tratta di tecnica e organizzazione a causa dei grandi numeri e dei tempi strettissimi. Nel mio ristorante invece, anche se non considero il mio lavoro artistico ma artigiano, l'arte ha un ruolo importante. I quadri in sala cambiano ogni sei mesi perché ho bisogno di stimoli nuovi, e spesso i piatti nascono proprio da un'idea o da una lettura. Quando uno si affida a te, devi lasciargli qualcosa di unico che lo faccia ritornare. Ad esempio, tutti conoscono la pasta al ragù. Riflettendo sulla nostra carne cruda piemontese, ho creato lo spaghetto freddo al ragù, reinventando il piatto. È un lavoro artistico prendere un'idea e portarla in un'altra dimensione. Oggi in cucina non si inventa quasi più nulla, stiamo solo riscrivendo cose nate millenni fa. Il mondo ha sempre guardato l'Italia per la gastronomia, ma a noi manca un po' di coraggio e cazzimma per battere i pugni sul tavolo. Io ho aperto a trent'anni in un paesino quando tutti dicevano che i trentenni erano bamboccioni. Il problema è che la generazione precedente (pensate a Gualtiero Marchesi e ai suoi "figli" come Cracco e Crippa) è stata talmente importante che diventa difficile sorpassarli, e a noi non è stato dato lo spazio per riscrivere la cucina. A quarantacinque anni non mi sento né arrivato né felice, perché so di poter dare ancora molto. Non vorrei essere ricordato solo per un piatto, che segue le mode, ma per il mio lato umano. Vorrei essere ricordato per il mio pensiero: tu cliente vieni da me, ti fidi, e il mio compito da professionista è farti stare bene, cucinando le cose giuste per te.`
    }
  ];
  const elisabettaSalvadoriInterviewQuote = 'Gli atleti sono diventati influencer e critici di cibo.';
  const elisabettaSalvadoriInterviewTranscript: InterviewTranscriptSection[] = [
    {
      question: "Puoi presentarti e descrivere l'esperienza in generale delle Olimpiadi di Milano prima del 2026?",
      answer: `Il mio nome è Elisabetta Salvadori. Come sono arrivata alle Olimpiadi? Avevo questo sogno delle Olimpiadi dal lontano 2006. Nelle Olimpiadi di Torino del 2006, io lavoravo in un'azienda, Autogrill, che ha fatto un pezzo delle Olimpiadi. Solitamente le Olimpiadi sono divise tra più fornitori, perché sono un lavoro enorme. Dar da mangiare alle Olimpiadi è uno degli sforzi di Food and Beverage più grandi al mondo dopo la guerra e mi è sempre rimasto impresso; ero la project manager per Autogrill per le Olimpiadi. Poi sono andata in maternità e non ho fatto l'operatività vera e propria. Avevo questo tarlo. Generalmente chi fa un'Olimpiade ne rifà un'altra, perché è un'esperienza molto intensa. Nel 2024 un mio amico mi ha detto che si era aperta la posizione di Head of Food and Beverage alle Olimpiadi. Ho fatto un paio di colloqui e a settembre del 2024 sono entrata in Fondazione.`
    },
    {
      question: 'Di cosa ti sei occupata? quali erano le mansioni quotidiane e di cosa ti occupavi giornalmente?',
      answer: `Il lavoro solitamente io lo vedrei in tre fasi: c'è la fase di strategia in cui si capisce cosa si vuole fare e come si vuole fare, c'è il momento di planning e organizzazione in cui si cercano i fornitori, e poi c'è la fase di Game Time dove invece fai solo operations. La nostra strategia è stata molto condizionata dal fatto che fossero le prime Olimpiadi del mondo così sparse sul territorio e questo ci ha fatto capire quasi subito che non potevamo avere un singolo fornitore, ma ne dovevamo avere di più. Intorno a maggio 2025 abbiamo chiuso il quadro dei fornitori. Poi è iniziata la fase di planning giorno per giorno e poi siamo arrivati all'operations. Nel Game Time cambia drasticamente ed è la parte più bella: arriva l'adrenalina positiva. Io non ero operativa al 100%, ma più che altro coordinavo, risolvevo problemi e andavo in giro per i siti a controllare. Grossissima attenzione viene dedicata al villaggio degli atleti. Con gli atleti ci sono ogni tre giorni degli appuntamenti mattutini alle 07:30. In questi appuntamenti con le delegazioni ci si confronta sugli eventuali problemi; in realtà ci siamo resi conto che erano problemi di bassa intensità e che tutti erano molto contenti. In parallelo sono nate tutte le review e le attenzioni sui social. È nato in maniera spontanea; non mi aspettavo che gli atleti fossero così influencer. Da influencer erano diventati critici di cibo, cosa che rifletteva però la loro felicità. Ci sono stati dei giorni, i media day, in cui i media potevano entrare all'interno della dining degli atleti e sono entrate le squadre di supporto degli atleti; lì ho capito veramente che esisteva un mondo che non avevo idea che esistesse.`
    },
    {
      question: 'In quale struttura hai operato principalmente, e qual era il pubblico principale con cui ti sei interfacciata?',
      answer: `La struttura all'interno della quale ho operato è estremamente complessa; nelle Olimpiadi è come un domino, ogni funzione è strettamente connessa all'altra. Nel nostro caso, ad esempio, qualsiasi decisione che noi prendiamo deve essere considerata insieme al cleaning and waste. I contatti con le altre funzioni erano frequentissimi e il Food and Beverage ha moltissimi stakeholder interni ed esterni: lo sport, chi rappresenta gli spettatori, i dignitari della famiglia olimpica. È un continuo cercare di capire i bisogni e poi pianificare. La Food and Beverage è all'interno di una divisione che si chiama Game Services (servizi legati ai giochi). Oltre agli atleti, le persone con cui mi sono interfacciata di più sono state i colleghi dello sport, le delegazioni, l'Olympic Family e tutta la parte del Comitato Olimpico. La mia struttura era composta da me, una ragazza che si occupava principalmente dei contratti e dei service level, la quale aveva sotto tre persone: una per i numeri, un'altra per i sistemi di voucher digitali e una per Health and Safety. Poi c'era un project manager. Avevo anche due operations manager: uno che si occupava delle venue competitive e una ragazza che si occupava dei villaggi. Sotto c'erano i vari responsabili dei villaggi o i responsabili di cluster, come la Valtellina, Livigno, Cortina, e a loro volta i responsabili per ogni venue. In più c'era una persona che si occupava del main media center qua a Milano.`
    },
    {
      question: "Com'era il rapporto con i vari referenti internazionali?",
      answer: `Ci sono incontri preliminari in cui si inizia a spiegare quale sarà il disegno e si scende nei dettagli. Oltre agli chef de mission (i capi delegazione), ci si confronta per esempio sul menù e sugli orari di apertura, in relazione al Competition Schedule. Quando si arriva al Game Time, lo chef de mission diventa una costante per sollevare problemi e trovare soluzioni. Anzi, a un certo punto hanno iniziato a cancellarli perché non c'erano problemi, e lì abbiamo capito che le cose stavano andando bene.`
    },
    {
      question:
        'Essendo che ci sono molte persone che lavorano dietro i giochi, come erano strutturati i turni di lavoro? E quali sono state le sfide principali nel gestire il coordinamento di una cucina di queste dimensioni?',
      answer: `C'erano due tipologie di turni. Sul field c'era sempre almeno una persona di turno che controllava il nostro fornitore. L'orario di inizio dipende dal calendario delle gare. Ovviamente si cercava di non fare più di 9-10 ore e c'era sempre un cambio. In sede c'era la sala operativa dove scorrono tutte le issue che si stanno verificando e ogni funzione ha una postazione sempre presidiata con dei turni. Al Game Time si iniziava verso le 6 o le 7 e si finiva anche a mezzanotte, turnando su tre o quattro persone. Io stavo o nella main operation room oppure in giro a risolvere gli eventuali problemi. È stato molto intenso, ma molto bello.`
    },
    {
      question: "Ci puoi dire come era strutturato il menù, quali piatti venivano proposti agli ospiti e quali sono i passaggi dall'ideazione del piatto alla preparazione?",
      answer: `L'obiettivo principale del cibo nel villaggio è il Food for Fuel, cioè dare agli atleti esattamente tutto quello di cui hanno bisogno per aiutarli nelle loro performance (carboidrati, proteine). L'altro aspetto fondamentale è la Food Safety. Il CIO fornisce delle linee guida. Abbiamo ricevuto le prime proposte di menù dalle aziende, le abbiamo riviste con la nostra nutrizionista, poi è arrivata la benedizione dal CIO e sono iniziati gli assaggi. Il menù degli atleti ruotava ogni 5-7 giorni. C'era una base che rimaneva 24 ore su 24 e sulla base di questo cibo freddo si apprestavano le stazioni per colazione, pranzo e cena. Sostanzialmente erano sempre presenti carboidrati (riso, pasta, pizza, focaccia), proteine grigliate (petto di pollo, pesce) e ricette più elaborate, verdure, dolci. Abbiamo scelto aziende della ristorazione collettiva che avessero già dei grossi centri di cottura in modo che le cose potessero arrivare pre-pronte o quasi pronte, perché questo aiuta nei momenti di rush; se hai 800 persone insieme che vogliono mangiare, con delle scorte sei in grado di ripristinare il servizio in pochissimo tempo.`
    },
    {
      question: 'Quante fasi susseguono per arrivare al risultato finale, al piatto servito?',
      answer: `In termini di tempo, la preparazione del menù ha implicato almeno 6 mesi. Le fasi erano sostanzialmente: definizione della ricetta, momento di assaggio, chiusura finale, preparazione (che poteva essere remota oppure in cucina) e servizio.`
    },
    {
      question: 'Abbiamo visto che ci sono dei piatti tipici delle varie località in cui si trovavano i villaggi olimpici, come funzionava?',
      answer: `C'erano i grandi classici (pasta, pizza, focaccia, le lasagne, il tiramisù, la torta della nonna) e la scelta è sempre stata quella di avere piatti tipici e/o locali, come i pizzoccheri in Valtellina o piatti della Val di Fiemme, sempre inerenti al contesto.`
    },
    {
      question: 'E invece, per quanto riguarda la sostenibilità e i rifiuti?',
      answer: `La nostra funzione di sostenibilità si è messa in contatto con enti come il Banco Alimentare. Si è creato questo processo per cui tutto quello che restava in cucina prossimo alla scadenza o cotto ma non servito veniva donato per essere ridistribuito. Un grande esempio era il pane, sovrastimato i primi giorni, che è stato donato in grande quantità. Anche i prodotti alimentari portati dagli atleti stranieri e non consumati li abbiamo donati.`
    },
    {
      question: "Vuole raccontarci qualcos'altro che ritiene particolarmente fondamentale o interessante?",
      answer: `È stato molto piacevole il riconoscimento del fatto che le cose sono andate bene, ma anche il fatto che abbiamo dimostrato una grande capacità e volontà di problem solving. Siamo stati molto flessibili per cercare di risolvere i problemi subito e questo fa anche un po' parte della nostra italianità: magari all'inizio siamo un po' meno strutturati, ma quando ci sono i problemi poi ci mettiamo in gioco per risolvere in maniera veloce. Partecipare alle Olimpiadi è un'esperienza meravigliosa e talmente intensa che si creano legami molto forti, condividendo così tante ore e focalizzati per lo stesso obiettivo.`
    }
  ];
  const marcoFrassanteInterviewQuote = 'Era come vivere in un film.';
  const marcoFrassanteInterviewTranscript: InterviewTranscriptSection[] = [
    {
      question:
        'Ci potrebbe raccontare in generale la sua esperienza in queste Olimpiadi, qual era il suo ruolo specifico e le sue mansioni?',
      answer:
        'Io sono stato ingaggiato come responsabile del villaggio olimpico, quindi come chef del villaggio olimpico. La mole di lavoro si parlava di 700 pasti al giorno da preparare con una disponibilità oraria che andava dalle 5 del mattino a 00:00.'
    },
    {
      question: 'Quali sono state le sfide principali nel coordinare una cucina con tante persone di questa grandezza?',
      answer: `Inizialmente è stato quello proprio di trovare l'armonia nel fondere le due realtà, quindi una brigata già esistente con un'altra brigata che andava ad affiancarsi. Noi facevamo un menù di 5 giorni che andava a ripetersi. Quello che chiedevano chiaramente era roba fresca, fatta bene, preparata al momento. Le colazioni partivano alle 5 del mattino, poi subentrava il turno della cucina dalle 8 per garantire un servizio che si svolgeva in tre turni sul pranzo. Una cucina, uno staff lavorava per l'altro e viceversa a rotazione, così io lasciavo pronto il lavoro per quelli della sera, quelli della sera lasciavano pronte le basi per quelle della mattina e viceversa.`
    },
    {
      question: 'Cosa veniva proposto effettivamente agli atleti per conciliare le esigenze nutritive?',
      answer:
        'Il menù è stato fatto seguendo comunque un criterio abbastanza internazionale. Gli atleti hanno avuto il loro menù che riguardava molta frutta, verdura, cereali, riso, quinoa, couscous, pasta, prevalentemente con un regime dietetico. Proteine avevano sempre due carni e un pesce ogni giorno. Hanno amato tantissimo la pizza, la gradivano sempre. Era uno dei piatti che andava di più in due tipologie, una farcita e una più neutrale, tipo focaccia.'
    },
    {
      question: "Sull'identità italiana abbiamo visto che i pizzoccheri hanno avuto uno dei successi maggiori, questa cosa è stata percepita anche nella realtà?",
      answer:
        "I pizzoccheri sono un piatto iconico della cucina locale. Però posso dire che a livello degli atleti questo non l'abbiamo riscontrato, o perlomeno noi, nel villaggio olimpico non erano nel menu i pizzoccheri. Quello che ci han chiesto, invece, sono stati gli spaghetti alle vongole, ci hanno chiesto la pasta all'arrabbiata, ci hanno chiesto la carbonara, abbiamo fatto la piadina romagnola."
    },
    {
      question: 'Come dolce virale è andato il tiramisù, è stato inserito nel menu?',
      answer:
        "Nel nostro menù c'era il tiramisù, sì, c'era comunque la torta caprese, c'era il semifreddo, c'era il gelato anche fatto in casa, il gelato artigianale."
    },
    {
      question:
        "Come avveniva l'organizzazione a livello di fornitura dei prodotti, quanti prodotti erano freschi o stati già preparati in precedenza?",
      answer:
        "C'erano dei controlli rigidissimi sulla sicurezza e lo stesso sui fornitori. I volumi erano molto grandi, la spesa arrivava tre volte a settimana. Si parla di quintali di prodotti alimentari freschi, surgelati, verdura e secco. Ogni collo veniva prima controllato, scannerizzato e approvato dal CIO. Una volta che la roba entrava dentro la cucina, c'erano gli spazi dedicati e i fattorini dedicati a mettere a posto la spesa. Grazie alle tecnologie moderne, c'è stata la possibilità anche di fare una cella di produzione in cui sono stati prodotti degli alimenti e conservati con una durata lunga di vita, in quanto il sottovuoto e l'abbattitore permettono di allungare la vita dei prodotti. Un prodotto che è stato trattato in questo modo in 15 minuti è già pronto, perché non si fa altro che aprire la busta da sottovuoto e rigenerarlo in un forno. Questo per quello che è fattibile sul fresco, ma sul super fresco che poteva essere il pesce, quelli erano prodotti che andavano lavorati super freschi."
    },
    {
      question: 'Se dovesse elencare le figure che stanno dietro la preparazione di un piatto?',
      answer:
        'Il menù in questo caso andava strutturato ad hoc. Il Comitato olimpico ha già di suo delle regole e delle linee guida su quelli che sono i criteri di una dieta bilanciata. Il Food and Beverage dell\'organizzazione si interfaccia con il Food and Beverage dell\'Hotel. Dopo questo passaggio si passa allo chef, che si occupa della gestione della spesa e del coordinare la squadra. Individua i suoi capi partita: c\'è chi è addetto alle verdure, c\'è chi si occupa di fare le salse, c\'è chi si occupa della carne, c\'è chi si occupa del pesce. La figura dello chef è quella di controllare che tutto vada come deve andare e soprattutto di avere anche la capacità di risolvere dei problemi.'
    },
    {
      question: "C'è un episodio in particolare che le è rimasto in mente di questa esperienza a Milano Cortina?",
      answer:
        "Da quando siamo arrivati a Livigno fino all'ultimo giorno, era come vivere in un film, era vivere proprio in un'atmosfera surreale, in una favola. Anzi no, una cosa c'è stata: quando abbiamo fatto la piadina lo staff del posto sembrava che non avesse mai visto quel prodotto."
    }
  ];
  const kenFrankInterviewQuote = 'The most popular dishes were pasta, pasta and pasta. Hundreds and hundreds of portions a day.';
  const kenFrankInterviewTranscript: InterviewTranscriptSection[] = [
    {
      question:
        'Could you describe your experience at the Milano Cortina 2026 Winter Olympics? What was your specific role, and what was your daily routine like?',
      answer:
        'I was recruited by Chef Carlo Zarri about 18 months prior to the event, to be part of an international team he was assembling to cook for VIP’s at the games. For a number of reasons, by the time the games started our role was changed. We cooked for a wide range events, at multiple venues, from the opening ceremonies, to feeding volunteer staff and athletes.'
    },
    {
      question: 'How did the opportunity to work within such a prestigious setting come about?',
      answer:
        'My decades long friendship and collaborations with Chef Carlo Zarri and the Ordine dei Cavaliere del Tartufo e dei Vini di Alba. I am an Honorary Knight and was for many years the Master of one of their foreign delegations in the San Francisco Bay Area.'
    },
    {
      question: 'Where did you operate, and what type of audience did you cook for (athletes, technical staff, delegations...)?',
      answer:
        'We were at San Siro for the Opening Ceremony and then spent most of the next two weeks cooking for athletes and Olympic staff out at Rho Fiera. We finished up the games catering for the IOC VIPs at Santa Giulia during the hockey finals. Our final job was in the NHL Green Room for the American Hockey team victory party!'
    },
    {
      question:
        'How was your work team composed? Did you find yourself collaborating with colleagues you already knew, or were you part of an international team?',
      answer:
        'We were cooking with a mostly Italian crew, though they came from all over Italy for a few weeks just to cater at the Olympics.'
    },
    {
      question:
        'How were the work rhythms and schedules structured? What were the main challenges in managing the coordination of a kitchen of such proportions?',
      answer:
        'The kitchen schedules were determined by the daily competition schedules. The temporary kitchen at Rho was very well designed and fully equipped with everything you would find in a permanent hotel kitchen. Most importantly, it was designed to handle the scale of the large crowd we were cooking for. Some days we served nearly 2,000 meals.'
    },
    {
      question: 'How was the menu structured? Which dishes were offered to the guests?',
      answer:
        'We prepared a wide variety of Italian specialties for the opening ceremony and also at the end at Santa Giulia. At Rho, we used a five day menu rotation anchored by lots of fresh vegetables and pasta. The food for the athletes was very specific and very bland. They view food as fuel so they were looking for certain weights of protein and carbohydrates. That food was totally boring.'
    },
    {
      question: 'How did you approach the experience of working in a place with a culinary culture different from your own?',
      answer:
        'Culinary culture is actually very universal. While we were surprised to see different “food safety” priorities than the ones we focus on in the US, the work culture was just what you find in kitchens everywhere. I have been cooking for 50 years and have cooked all over the world as well as hosted many European chefs at my restaurant in California. We all fit together very easily. We made a number of new friends!'
    },
    {
      question:
        'What dishes were prepared most frequently in your kitchens? Was there one in particular that was an unexpected success or especially appreciated by the guests?',
      answer: 'The most popular dishes were pasta, pasta and pasta. Hundreds and hundreds of portions a day.'
    },
    {
      question:
        'How was its preparation handled, what were the main steps, the relationships with suppliers, and the logistics within the kitchens?',
      answer:
        'The logistics were very well organized. The catering company, AFM, we were working with has a lot of experience with large scale events. All of the food prep was started at their facility and bought to the stadium early each morning. It was then transferred to refrigerated containers and bought into the kitchen as it was needed. It was not perfect, but came close most days. Overall a very impressive feat of organization.'
    }
  ];
  const carloCraccoInterviewQuote = 'La cucina non è più solo gesto creativo, è gestione di complessità.';
  const carloCraccoInterviewTranscript: InterviewTranscriptSection[] = [
    {
      question:
        "Partendo dal tema “Le Olimpiadi degli invisibili” in relazione alle Olimpiadi Milano Cortina 2026, l'obiettivo è condurre una ricerca sui retroscena dei Giochi, focalizzandosi su tutto ciò che rende possibile l'evento ma rimane fuori dai riflettori: persone, ruoli, progetti, processi, coordinamento, responsabilità quotidiane. Un punto di vista interno e spesso ignorato di quell'esperienza olimpica. Chi rende possibili le Olimpiadi senza essere protagonista dell'evento? Un evento di questa portata si prepara con anni di anticipo. Dal punto di vista puramente organizzativo, come ha approcciato la sfida di Milano Cortina? Come ha riorganizzato la struttura di Cracco in Galleria e della sua brigata per trasformarlo in un luogo in grado di ospitare l'Omega House conciliando grandi flussi di persone e qualità del cibo senza perdere l'identità del fine dining?",
      answer:
        "Le Olimpiadi degli invisibili? Sono la realtà, non il tema. La cucina è sempre stata così. Tu vedi il piatto, ma dietro ci sono turni infiniti, gerarchie, logistica, errori corretti al volo. A Milano Cortina ho lavorato esattamente su questo: rendere invisibile la complessità. Ho riorganizzato Cracco in Galleria pensando a chi non si vede chi prepara, chi coordina, chi pulisce, chi controlla le forniture. Se la macchina funziona, è perché queste persone non sbagliano mai. E non possono permetterselo. Il brand Omega ha fatto un takeover totale del Ristorante e della Sala Mengoni, adibita agli eventi. Hanno modificato tutto l'arredamento, costruito pareti e creato ambienti nuovi… uno shock all'inizio, ma il risultato è stato magnifico: un'integrazione perfetta fra la nostra realtà e Omega, un'autentica casa Olimpiadi."
    },
    {
      question:
        'Come nasce la collaborazione con i Giochi Olimpici e qual è stato il processo creativo che ha portato alla creazione della pasta Cinque Cerchi? Quali sono state le sfide principali in questo percorso (idee scartate, problemi logistici ecc.)?',
      answer:
        'La collaborazione con le Olimpiadi ha senso solo se capisci che non sei il protagonista. Il protagonista è il sistema. La pasta Cinque Cerchi è nata così: non come esercizio creativo, ma come risposta a un contesto complesso. Doveva essere replicabile, stabile, comprensibile da chiunque la cucinasse, anche sotto pressione. Le idee scartate? Tutte quelle che funzionavano solo sulla carta. In cucina olimpica, se non regge la scala, non c’è partita.'
    },
    {
      question:
        'Quali sono stati i passaggi (ingredienti, conservazione, preparazione...)? Quante prove sono state necessarie con i pastifici partner per ottenere un prodotto che fosse in grado di mantenere la cottura e la forma?',
      answer:
        "Dietro un formato di pasta ci sono persone che nessuno racconta: tecnologie alimentari, operatori di linea, controlli qualità. Abbiamo lavorato su ingredienti, essiccazione, tempi di cottura, pensando a chi avrebbe dovuto gestirli in condizioni non ideali. Le prove non si contano, perché ogni errore diventava un dato. Non cercavamo la perfezione teorica, ma l'affidabilità reale."
    },
    {
      question: "Quali sono state le persone che l'hanno affiancata in questo progetto e come hanno contribuito?",
      answer:
        "Il progetto è stato costruito da una rete. La brigata, certo, ma anche fornitori, logistica, chi si occupa di stoccaggio, chi gestisce gli ordini, chi lava le stoviglie. Le Olimpiadi degli invisibili sono loro. In cucina c'è una regola semplice: più una persona è invisibile, più è indispensabile. Se manca, te ne accorgi subito."
    },
    {
      question: 'Ha scelto la Crudaiola come ricetta firma. In un contesto internazionale, come mai questa scelta?',
      answer:
        "La Crudaiola è una scelta quasi politica. In mezzo a un sistema complesso, scegli un piatto che si basa su equilibrio e materia prima. Ma anche lì: dietro la semplicità ci sono filiere, selezione, trasporto, conservazione. Invisibili. In un contesto internazionale, raccontare l'Italia significa anche questo: far capire che la semplicità è il risultato di un lavoro enorme che non si vede."
    },
    {
      question:
        "Durante i Giochi, il suo ristorante è stato crocevia di delegazioni e campioni. C'è stata una richiesta gastronomica particolare o insolita da parte di qualche atleta o personalità internazionale che l'ha colpita o messa alla prova?",
      answer:
        "Le richieste degli atleti sono solo la punta dell'iceberg. Dietro c'è chi traduce esigenze nutrizionali in operatività concreta: dietisti, responsabili di produzione, capi partita. A volte ti chiedono cose molto specifiche, ma la vera sfida è adattare il sistema senza romperlo. Non è il piatto speciale che ti mette alla prova, è la continuità del servizio. Molti atleti poi sono venuti da noi anche a godersi un momento di relax, una pausa in lounge o un pranzo al nostro ristorante, quindi qualche strappo alla regola e alla dieta l'hanno fatto con piacere!"
    },
    {
      question:
        "Le Olimpiadi lasciano infrastrutture alle città; cosa lasciano invece alla cucina di Carlo Cracco? C'è un'intuizione organizzativa o un nuovo metodo di lavoro nato durante le Olimpiadi che pensa di implementare nella quotidianità?",
      answer:
        'Cosa resta? Una consapevolezza più dura: la cucina non è più solo gesto creativo, è gestione di complessità. Porto a casa un metodo che valorizza di più queste figure invisibili. Più struttura, più responsabilità distribuita, meno improvvisazione. Se le Olimpiadi ti insegnano qualcosa, è che il successo non è mai di chi si vede, ma di chi regge tutto senza farsi notare.'
    }
  ];
  const fullInterviewContent: Record<string, FullInterviewContent> = {
    'Stefano Paganini': {
      quote: stefanoPaganiniInterviewQuote,
      transcript: stefanoPaganiniInterviewTranscript
    },
    'Elisabetta Salvadori': {
      quote: elisabettaSalvadoriInterviewQuote,
      transcript: elisabettaSalvadoriInterviewTranscript
    },
    'Marco Frassante': {
      quote: marcoFrassanteInterviewQuote,
      transcript: marcoFrassanteInterviewTranscript
    },
    'Ken Frank': {
      quote: kenFrankInterviewQuote,
      transcript: kenFrankInterviewTranscript
    },
    'Carlo Cracco': {
      quote: carloCraccoInterviewQuote,
      transcript: carloCraccoInterviewTranscript
    },
    'Carlo Zarri': {
      quote: carloZarriInterviewQuote,
      transcript: carloZarriInterviewTranscript
    },
    'Fausto Meli': {
      quote: faustoMeliInterviewQuote,
      transcript: faustoMeliInterviewTranscript
    }
  };
  let activeInterviewDetail = $derived(activeInterviewName ? interviewDetails[activeInterviewName] : undefined);
  let activeFullInterviewContent = $derived(activeInterviewName ? fullInterviewContent[activeInterviewName] : undefined);
  type LetterStyleOptions = { start: number; end: number; windowSize: number; invert: boolean; dy: number };

  function setCssVars(el: HTMLElement | undefined, vars: CssVars) {
    if (el) gsap.set(el, vars);
  }

  function setLayerState(el: HTMLElement | undefined, opacity: number, isInteractive: boolean) {
    if (!el) return;
    gsap.set(el, { opacity: fixed(opacity) });
    el.style.pointerEvents = isInteractive ? 'auto' : 'none';
  }

  function getPointerOffset(e: PointerEvent, el: HTMLElement) {
    const rect = el.getBoundingClientRect();
    return {
      nx: (e.clientX - rect.left) / rect.width - 0.5,
      ny: (e.clientY - rect.top) / rect.height - 0.5
    };
  }

  function parseMessage(msg: string, accentWord: string) {
    const start = accentWord ? msg.indexOf(accentWord) : -1;
    const end   = start >= 0 ? start + accentWord.length : -1;
    return msg.split('').map((letter, i) => ({
      index:    i,
      letter,
      isSpace:  letter === ' ',
      isAccent: start >= 0 && i >= start && i < end
    }));
  }

  function interviewAsset(src: string) {
    return `${interviewAssetBase}${src}`;
  }

  function facePieceStyle(piece: InterviewFacePiece) {
    const mask = piece.maskSrc
      ? `-webkit-mask-image:url('${interviewAsset(piece.maskSrc)}');mask-image:url('${interviewAsset(piece.maskSrc)}');-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-size:${piece.maskSize}px ${piece.maskSize}px;mask-size:${piece.maskSize}px ${piece.maskSize}px;-webkit-mask-position:${piece.maskX}px ${piece.maskY}px;mask-position:${piece.maskX}px ${piece.maskY}px;`
      : '';
    return `left:${piece.x}px;top:${piece.y}px;width:${piece.width}px;height:${piece.height}px;${mask}`;
  }

  function groupWords(characters: ReturnType<typeof parseMessage>) {
    const groups: Array<
      | { type: 'space'; index: number }
      | { type: 'word'; index: number; characters: typeof characters }
    > = [];

    let word: typeof characters = [];
    characters.forEach((character) => {
      if (character.isSpace) {
        if (word.length) {
          groups.push({ type: 'word', index: word[0].index, characters: word });
          word = [];
        }
        groups.push({ type: 'space', index: character.index });
      } else {
        word.push(character);
      }
    });

    if (word.length) groups.push({ type: 'word', index: word[0].index, characters: word });
    return groups;
  }

  const introMessage    = 'Tutti abbiamo visto i video virali sulla cucina delle olimpiadi...';
  const nextMessage     = 'Incontra le persone che hanno reso tutto questo possibile.';
  const audioGateMessage = "Si consiglia l’uso dell’audio per\u00a0una\u00a0migliore esperienza";
  const brandWord       = 'FuoriMenù';
  const brandSubtitle   = 'Dentro le cucine di Milano Cortina 2026';
  const introCharacters = parseMessage(introMessage, 'cucina');
  const nextCharacters  = parseMessage(nextMessage,  'persone');
  const audioGateCharacters = parseMessage(audioGateMessage, '');
  const introWords      = groupWords(introCharacters);
  const nextWords       = groupWords(nextCharacters);
  const audioGateWords  = groupWords(audioGateCharacters);
  const audioGateOrbitDotCount = 64;
  const audioGateOrbitRadius = 49;
  const audioGateCopyRevealDuration = 0.48;
  const audioGateCopyRevealStagger = 0.018;
  const audioGateCopyRevealTotal =
    audioGateCopyRevealDuration + Math.max(audioGateCharacters.length - 1, 0) * audioGateCopyRevealStagger;
  const audioGateDotRevealDuration = 0.32;
  const audioGateDotRevealStagger =
    (audioGateCopyRevealTotal - audioGateDotRevealDuration) / Math.max(audioGateOrbitDotCount - 1, 1);
  const audioGateUtensilRiseDuration = 0.98;
  const audioGateUtensilShakeDuration = 0.62;
  const audioGateUtensilRiseDelay = Math.max(0, audioGateCopyRevealTotal - audioGateUtensilRiseDuration);
  const audioGateUtensilShakeDelay = audioGateCopyRevealTotal;
  const audioGateUtensilIdleDelay = audioGateUtensilShakeDelay + audioGateUtensilShakeDuration;

  function getOrbitPoint(angle: number) {
    const radians = ((angle - 90) * Math.PI) / 180;
    return {
      x: 50 + audioGateOrbitRadius * Math.cos(radians),
      y: 50 + audioGateOrbitRadius * Math.sin(radians)
    };
  }

  const audioGateOrbitDots = Array.from({ length: audioGateOrbitDotCount }, (_, index) => ({
    index,
    point: getOrbitPoint((360 / audioGateOrbitDotCount) * index),
    delayMs: Math.max(0, audioGateDotRevealStagger * index * 1000)
  }));

  const brandLetters = brandWord.split('').map((letter, i) => ({ letter, i }));
  const brandLetterIndexes = brandLetters.map((_, i) => i);
  let brandArrivalRank: number[] = new Array(brandLetters.length).fill(0);
  let brandBurstRank: number[] = new Array(brandLetters.length).fill(0);
  let brandBurstMotion = brandLetters.map(() => ({ x: 0, y: 0, rotate: 0 }));
  let brandLetterEls: HTMLElement[] = [];
  let floatingEls: HTMLElement[] = [];
  const rolesRevealStart = 2.24;
  const rolesRevealDuration = 0.34;
  const roleCardStagger = 0.055;
  const roleCardRevealDuration = 0.2;
  const brandScrollMax = rolesRevealStart + rolesRevealDuration;
  const flowTotalMax = 2 + brandScrollMax;
  const copyScrollStart = 1;
  const copyScrollEnd = 2;
  const brandCopyScrollEnd = 3.18;
  const rolesScrollVisible = 2 + brandScrollMax;
  const introLetterOut: LetterStyleOptions = { start: 0.2, end: 0.5, windowSize: 0.08, invert: true, dy: 12 };
  const nextLetterIn: LetterStyleOptions = { start: 0.45, end: 0.92, windowSize: 0.07, invert: false, dy: 12 };
  const aboutClosedVars = { clipPath: 'inset(0 0 0 100%)', xPercent: 6 };
  const aboutOpenVars = { clipPath: 'inset(0 0 0 0%)', xPercent: 0 };
  const aboutMotion = {
    openDuration: 0.52,
    closeDuration: 0.42,
    openEase: 'power3.out',
    closeEase: 'power3.in'
  };
  const audioFadeMotion = { duration: 0.52, ease: 'power2.inOut' };
  const sectionAudioFadeOutDuration = 0.46;
  const audioCues = createAudioCueManager<HomeAudioId>({ fade: audioFadeMotion });
  audioCues.registerAudioCue('background', backgroundAudio);
  audioRoles.forEach((role) => {
    audioCues.registerAudioCue(role, roleAudio[role]);
  });
  const mountFadeMotion = { delay: 0.4, duration: 2, ease: 'power2.out' };
  const flowMotion = {
    duration: 0.82,
    reelDuration: 0.34,
    ease: 'power3.out',
    autoStepDuration: 1.72,
    autoEase: 'power2.out',
    reverseAutoEase: 'power2.out',
    maxWheelStep: 0.066,
    reverseMaxWheelStep: 0.084,
    maxTargetLead: 0.25,
    reverseMaxTargetLead: 0.34,
    reelScrollSlowdown: 2.1,
    reelMaxTargetLead: 0.88
  };
  const keyFlowSteps: Record<string, number> = {
    ArrowDown: 0.1,
    PageDown: 0.1,
    ' ': 0.1,
    ArrowUp: -0.1,
    PageUp: -0.1
  };
  const roleCardResetVars: CssVars = {
    '--role-bg-x': '0px',
    '--role-bg-y': '0px',
    '--role-copy-x': '0px',
    '--role-copy-y': '0px',
    '--role-dialogue-x': '0px',
    '--role-dialogue-y': '0px',
    '--role-person-x': '0px',
    '--role-person-y': '0px'
  };
  const brandLetterMotion = {
    arrivalSpread: 0.36,
    arrivalDuration: 0.68,
    arrivalDepth: 420,
    introScale: 1.9,
    opacityDelay: 0.42,
    opacityRamp: 0.3,
    burstStart: 1.74,
    burstDuration: 0.84,
    burstSpread: 0.42,
    burstStaggerDuration: 0.38,
    burstScale: 1.35
  };
  const reelMotion = {
    stagger: 0.085,
    startOffset: 0,
    duration: 0.35,
    zStart: -980,
    zRange: 1850,
    scaleStart: 0.28,
    scaleRange: 4.2,
    scaleInDuration: 0.18,
    opacityOutStart: 0.76,
    opacityOutDuration: 0.24,
    rotateStartRatio: 0.35,
    rotateEndRatio: 0.65,
    spreadRadius: 1.4,
    dragTiltX: 11,
    dragTiltY: 13,
    dragZLift: 90,
    dragScale: 0.04,
    mediaParallaxX: 10,
    mediaParallaxY: 7,
    layerParallaxX: 30,
    layerParallaxY: 18,
    layerSpeed: 0,
    layerZ: 240,
    layerScale: 0.075,
    slowIntroEnd: 0.22,
    slowIntroDistance: 0.24,
    slowIntroPower: 1.08,
    viewSlowEnd: 0.84,
    viewSlowDistance: 0.54,
    fastExitPower: 5.2,
    exitSpeedStart: 0.9,
    exitCompletion: 0.72,
    exitPushX: 90,
    exitPushY: 110,
    maxSpreadX: 78,
    maxSpreadY: 60,
    exitMaxSpreadX: 154,
    exitMaxSpreadY: 160,
    autoExitFlowStart: 0.88,
    autoReturnFlowTarget: 0.82,
    autoSettleDuration: 0.36,
    shadowX: 18,
    shadowY: 10
  };
  const floatingMotion = {
    maxDelta: 0.032,
    minPad: 16,
    padRatio: 0.035,
    hoverInDuration: 0.2,
    hoverOutDuration: 0.28,
    hoverStepMultiplier: 4,
    hoverSpeedBoost: 0.75,
    hoverSpinBoost: 0.7,
    tiltDamping: 0.88,
    driftYRatio: 0.82,
    driftRotateRatio: 0.7,
    driftRotateAmount: 5,
    pointerTilt: 22,
    pointerTiltLimit: 14,
    hoverZ: 28,
    hoverScale: 0.035,
    shadowAlpha: 0.28
  };
  const roleParallaxMotion = {
    bgX: -18,
    bgY: -12,
    copyX: 7,
    copyY: 4,
    dialogueX: 2,
    dialogueY: 1.5,
    personX: 12,
    personY: 7
  };
  const floatingExitMotion = {
    start: 1.42,
    duration: 1.16,
    fadeStart: 0.76,
    fadeDuration: 0.34,
    scaleLoss: 0.08,
    pointerCutoff: 0.82
  };
  const brandSubtitleMotion = {
    inStart: 0.7,
    inDuration: 0.22,
    outStart: 2.04,
    outDuration: 0.18,
    enterY: 14,
    exitY: -16
  };

  const roleItems: RoleItem[] = [
    {
      title: 'ufficio',
      description: 'Coordinamento e amministrazione',
      speaker: 'Carlo Zarri',
      dialogue: "il mio ruolo ... seguimi nell'ufficio per saperne di più",
      hoverIntro: 'Sono',
      hoverName: 'Carlo Zarri',
      hoverAction: 'seguimi nell’ufficio',
      hoverClosing: 'ed esplora l’ambiente',
      backgroundSrc: '/assets/cardsbackground/sfondoufficio.png',
      personSrc: '/assets/interviews-hover/zarri.png',
      href: '/ufficio'
    },
    {
      title: 'cucina',
      description: 'Preparazione dei pasti',
      speaker: 'Stefano Paganini',
      dialogue: 'il mio ruolo ... seguimi nella cucina per saperne di più',
      hoverIntro: 'Sono',
      hoverName: 'Stefano Paganini',
      hoverAction: 'seguimi in cucina',
      hoverClosing: 'ed esplora l’ambiente',
      backgroundSrc: '/assets/cardsbackground/sfondocucina.png',
      personSrc: '/images/stefano-paganini-figma.svg',
      href: '/phaser'
    },
    {
      title: 'servizio',
      displayTitle: 'sala',
      description: 'Distribuzione e assistenza',
      speaker: 'Fausto Meli',
      dialogue: 'il mio ruolo ... seguimi nella mensa per saperne di più',
      hoverIntro: 'Sono',
      hoverName: 'Fausto Meli',
      hoverAction: 'seguimi in sala',
      hoverClosing: 'ed esplora l’ambiente',
      backgroundSrc: '/assets/cardsbackground/sfondoservizio.png',
      personSrc: '/assets/interviews-hover/fausto.png',
      href: '/servizio'
    }
  ];

  type FloatingMotion = {
    x: number;
    y: number;
    vx: number;
    vy: number;
    tiltX: number;
    tiltY: number;
    spinAngle: number;
    hover: boolean;
    hoverProgress: number;
  };

  const floatingAssets: Array<{
    src: string;
    label: string;
    className: string;
    nodeId: string;
    exitX: number;
    exitY: number;
    wobble: { x: number; y: number; speed: number; phase: number };
    spin: { speed: number; phase: number };
    motion: FloatingMotion;
  }> = [
    {
      src: '/images/raviolo.svg',
      label: 'Raviolo',
      className: 'floating-raviolo',
      nodeId: '266:413',
      exitX: -7,
      exitY: -112,
      wobble: { x: 8, y: 5, speed: 1.1, phase: 0.2 },
      spin: { speed: 18, phase: -8 },
      motion: { x: 84, y: 96, vx: 92, vy: 74, tiltX: 0, tiltY: 0, spinAngle: 0, hover: false, hoverProgress: 0 }
    },
    {
      src: '/images/pizza.svg',
      label: 'Pizza',
      className: 'floating-pizza',
      nodeId: '2567:2664',
      exitX: 7,
      exitY: -112,
      wobble: { x: 5, y: 7, speed: 0.92, phase: 1.8 },
      spin: { speed: -14, phase: 12 },
      motion: { x: 220, y: 280, vx: -82, vy: 96, tiltX: 0, tiltY: 0, spinAngle: 0, hover: false, hoverProgress: 0 }
    },
    {
      src: '/images/fusillo.svg',
      label: 'Fusillo',
      className: 'floating-fusillo',
      nodeId: '266:420',
      exitX: -3,
      exitY: -126,
      wobble: { x: 12, y: 10, speed: 1.37, phase: 4.4 },
      spin: { speed: 22, phase: 4 },
      motion: { x: 520, y: 132, vx: -63, vy: 117, tiltX: 0, tiltY: 0, spinAngle: 0, hover: false, hoverProgress: 0 }
    }
  ];

  type ReelItem = {
    src: string;
    bg: string;
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
    rotate: number;
    layer: -1 | 0 | 1;
    opacityOutStart?: number;
    opacityOutDuration?: number;
  };

  const reels: ReelItem[] = [
    { src: '/videos/tiramisu.mp4', bg: 'var(--reel-placeholder-neutral)', fromX: -8,  fromY:  4, toX: -34, toY: -18, rotate: -8,  layer:  0 },
    { src: '/videos/1.mp4',        bg: 'var(--color-text-primary)',        fromX:  7,  fromY: -3, toX:  30, toY:  16, rotate:  7,  layer:  1 },
    { src: '/videos/2.mp4',        bg: 'var(--reel-placeholder-gold)',     fromX: -4,  fromY: -8, toX: -18, toY:  28, rotate: 10,  layer:  0 },
    { src: '/videos/3.mp4',        bg: 'var(--color-surface-dark)',        fromX: 13,  fromY:  8, toX:  36, toY: -24, rotate: -11, layer:  1, opacityOutStart: 0.58, opacityOutDuration: 0.16 },
    { src: '/videos/4.mp4',        bg: 'var(--reel-placeholder-lavender)', fromX: -10, fromY: -2, toX: -40, toY:   6, rotate: -5,  layer: -1 },
    { src: '/videos/5.mp4',        bg: 'var(--reel-placeholder-neutral)',  fromX:  5,  fromY:  6, toX:  24, toY: -30, rotate:  9,  layer:  0 },
    { src: '/videos/6.mp4',        bg: 'var(--reel-placeholder-gold)',     fromX: -12, fromY:  7, toX: -28, toY:  18, rotate: -12, layer: -1 },
    { src: '/videos/7.mp4',        bg: 'var(--color-text-primary)',        fromX: 10,  fromY: -7, toX:  38, toY:   2, rotate:  5,  layer:  1 },
    { src: '/videos/8.mp4',        bg: 'var(--color-surface-dark)',        fromX: -6,  fromY: -5, toX: -36, toY: -28, rotate:  8,  layer:  0 },
    { src: '/videos/9.mp4',        bg: 'var(--reel-placeholder-lavender)', fromX: 12,  fromY:  3, toX:  42, toY:  24, rotate: -9,  layer:  1 },
    { src: '/videos/10.mp4',       bg: 'var(--reel-placeholder-neutral)',  fromX: -3,  fromY:  9, toX: -16, toY:  34, rotate:  6,  layer: -1 },
    { src: '/videos/11.mp4',       bg: 'var(--color-text-primary)',        fromX:  3,  fromY: -9, toX:  16, toY: -34, rotate: -7,  layer:  0 },
    { src: '/videos/12.mp4',       bg: 'var(--reel-placeholder-gold)',     fromX: -14, fromY:  1, toX: -44, toY:  -4, rotate: 11,  layer: -1 },
    { src: '/videos/13.mp4',       bg: 'var(--color-surface-dark)',        fromX: 14,  fromY: -1, toX:  44, toY:   8, rotate: -10, layer:  1 },
    { src: '/videos/14.mp4',       bg: 'var(--reel-placeholder-lavender)', fromX: -7,  fromY: -10, toX: -22, toY: -36, rotate: -6,  layer:  0 }
  ];

  function shuffleIndexes(indexes: number[]) {
    const shuffled = [...indexes];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  function rankOrder(order: number[]) {
    const ranks = new Array(order.length).fill(0);
    order.forEach((letterIndex, rank) => { ranks[letterIndex] = rank; });
    return ranks;
  }

  function randomizeBrandLetters() {
    brandArrivalRank = rankOrder(shuffleIndexes(brandLetterIndexes));
    brandBurstRank = rankOrder(shuffleIndexes(brandLetterIndexes));
    brandBurstMotion = brandLetters.map(() => ({
      x: (Math.random() - 0.5) * 36,
      y: -22 - Math.random() * 28,
      rotate: (Math.random() - 0.5) * 34
    }));
  }

  function applyLetterStyles(
    letters: HTMLElement[],
    progress: number,
    opts: LetterStyleOptions
  ) {
    const { start, end, windowSize, invert, dy } = opts;
    const stagger = (end - start) / Math.max(letters.length - 1, 1);
    letters.forEach((el, i) => {
      if (!el) return;
      const local   = clamp((progress - start - i * stagger) / windowSize);
      const e       = ease(local);
      const opacity = invert ? 1 - e : e;
      const ty      = invert ? e * -dy : (1 - e) * dy;
      setCssVars(el, {
        '--letter-opacity': fixed(opacity),
        '--letter-y': px(ty)
      });
    });
  }

  function applyBrandLetters() {
    if (isBrandWordSharp) isBrandWordSharp = false;

    const n = brandLetterEls.length;
    brandLetterEls.forEach((el, i) => {
      if (!el) return;
      const rank    = brandArrivalRank[i];
      const stagger = brandLetterMotion.arrivalSpread / Math.max(n - 1, 1);
      const local   = clamp((brandProgress - rank * stagger) / brandLetterMotion.arrivalDuration);
      const e       = ease(local);
      const burstRank = brandBurstRank[i];
      const burstStagger = brandLetterMotion.burstSpread / Math.max(n - 1, 1);
      const burstProgress = clamp((brandProgress - brandLetterMotion.burstStart) / brandLetterMotion.burstDuration);
      const burstLocal = clamp((burstProgress - burstRank * burstStagger) / brandLetterMotion.burstStaggerDuration);
      const burst = ease(burstLocal);
      const burstMotion = brandBurstMotion[i];
      const opacityIn = clamp((local - brandLetterMotion.opacityDelay) / brandLetterMotion.opacityRamp);
      setCssVars(el, {
        '--bl-z': px((1 - e) * brandLetterMotion.arrivalDepth),
        '--bl-scale': fixed(1 + (1 - e) * brandLetterMotion.introScale + burst * brandLetterMotion.burstScale),
        '--bl-opacity': fixed(opacityIn * (1 - burst)),
        '--bl-x': px(burstMotion.x * burst),
        '--bl-y': px(burstMotion.y * burst),
        '--bl-rotate': deg(burstMotion.rotate * burst, 1)
      });
    });
  }

  function getReelPresentation(index: number) {
    const reel  = reels[index];
    const availableStaggerWindow = Math.max(0, 1 - reelMotion.startOffset - reelMotion.duration);
    const reelStagger = Math.min(reelMotion.stagger, availableStaggerWindow / Math.max(reels.length - 1, 1));
    const local = clamp((reelProgress - index * reelStagger - reelMotion.startOffset) / reelMotion.duration);
    const layer = reel.layer;
    const introEnd = reelMotion.slowIntroEnd;
    const viewEnd = reelMotion.viewSlowEnd;
    const travel = local < introEnd
      ? reelMotion.slowIntroDistance * Math.pow(local / introEnd, reelMotion.slowIntroPower)
      : local < viewEnd
        ? reelMotion.slowIntroDistance + (reelMotion.viewSlowDistance - reelMotion.slowIntroDistance) * ease((local - introEnd) / (viewEnd - introEnd))
        : reelMotion.viewSlowDistance + (1 - reelMotion.viewSlowDistance) * (1 - Math.pow(1 - ((local - viewEnd) / (1 - viewEnd)), reelMotion.fastExitPower));
    const entryScale = ease(clamp(local / reelMotion.scaleInDuration));
    const opacityIn = ease(clamp(local / Math.max(reelMotion.scaleInDuration * 0.64, 0.001)));
    const opacityOutStart = reel.opacityOutStart ?? reelMotion.opacityOutStart;
    const opacityOutDuration = reel.opacityOutDuration ?? reelMotion.opacityOutDuration;
    const opacityOut = 1 - ease(clamp((local - opacityOutStart) / Math.max(opacityOutDuration, 0.001)));
    const visibility = opacityIn * opacityOut;
    const pathX = reel.toX - reel.fromX;
    const pathY = reel.toY - reel.fromY;
    const pathLength = Math.hypot(pathX, pathY) || 1;
    const pathDirectionX = pathX / pathLength;
    const pathDirectionY = pathY / pathLength;
    const dragDirectionX = pathDirectionX * reelTravelDirection;
    const dragDirectionY = pathDirectionY * reelTravelDirection;
    const drag = Math.sin(local * Math.PI) * entryScale;
    const layerTravel = (travel - 0.5) * layer;
    const baseX = reel.fromX + (reel.toX - reel.fromX) * travel;
    const baseY = reel.fromY + (reel.toY - reel.fromY) * travel;
    const exitPhase = clamp((local - reelMotion.exitSpeedStart) / (1 - reelMotion.exitSpeedStart));
    const exitBoost = ease(clamp(exitPhase / reelMotion.exitCompletion));
    const x = baseX * reelMotion.spreadRadius
      + pathDirectionX * reelMotion.layerParallaxX * layerTravel
      + pathDirectionX * reelMotion.exitPushX * exitBoost;
    const y = baseY * reelMotion.spreadRadius
      + pathDirectionY * reelMotion.layerParallaxY * layerTravel
      + pathDirectionY * reelMotion.exitPushY * exitBoost;
    const maxX = reelMotion.maxSpreadX + (reelMotion.exitMaxSpreadX - reelMotion.maxSpreadX) * exitBoost;
    const maxY = reelMotion.maxSpreadY + (reelMotion.exitMaxSpreadY - reelMotion.maxSpreadY) * exitBoost;
    return {
      z:       reelMotion.zStart + travel * reelMotion.zRange + layer * reelMotion.layerZ + drag * reelMotion.dragZLift,
      scale:   (reelMotion.scaleStart + travel * reelMotion.scaleRange + layer * reelMotion.layerScale + drag * reelMotion.dragScale) * entryScale,
      opacity: visibility,
      x:       clamp(x, -maxX, maxX),
      y:       clamp(y, -maxY, maxY),
      rotate:  reel.rotate * (reelMotion.rotateStartRatio + travel * reelMotion.rotateEndRatio),
      tiltX:   -dragDirectionY * reelMotion.dragTiltX * drag,
      tiltY:   dragDirectionX * reelMotion.dragTiltY * drag,
      mediaX:  -dragDirectionX * reelMotion.mediaParallaxX * drag,
      mediaY:  -dragDirectionY * reelMotion.mediaParallaxY * drag,
      shadowX: dragDirectionX * reelMotion.shadowX * drag,
      shadowY: 36 + Math.abs(dragDirectionY) * reelMotion.shadowY * drag
    };
  }

  function applyReelStyles() {
    reelCards.forEach((card, i) => {
      if (!card) return;
      const { z, scale, opacity, x, y, rotate, tiltX, tiltY, mediaX, mediaY, shadowX, shadowY } = getReelPresentation(i);
      setCssVars(card, {
        '--x': vw(x),
        '--y': vh(y, 2),
        '--z': px(z),
        '--scale': fixed(scale),
        '--rotate': deg(rotate),
        '--opacity': fixed(opacity),
        '--reel-tilt-x': deg(tiltX),
        '--reel-tilt-y': deg(tiltY),
        '--reel-media-x': px(mediaX),
        '--reel-media-y': px(mediaY),
        '--reel-shadow-x': px(shadowX),
        '--reel-shadow-y': px(shadowY)
      });
    });
  }

  function moveFloatingAssets(time: number, deltaTime: number) {
    if (!brandScreen) return;

    const dt = Math.min(deltaTime / 1000, floatingMotion.maxDelta);

    const bounds = brandScreen.getBoundingClientRect();
    const pad    = Math.max(floatingMotion.minPad, Math.min(bounds.width, bounds.height) * floatingMotion.padRatio);

    floatingAssets.forEach((asset, index) => {
      const el = floatingEls[index];
      if (!el) return;

      const motion = asset.motion;
      const width  = el.offsetWidth;
      const height = el.offsetHeight;
      const maxX   = Math.max(pad, bounds.width - width - pad);
      const maxY   = Math.max(pad, bounds.height - height - pad);
      const wobble = asset.wobble;
      const spin = asset.spin;
      const driftTime = time * wobble.speed + wobble.phase;
      const hoverTarget = motion.hover ? 1 : 0;
      const hoverStep = dt / (motion.hover ? floatingMotion.hoverInDuration : floatingMotion.hoverOutDuration);
      motion.hoverProgress = clamp(
        motion.hoverProgress + (hoverTarget - motion.hoverProgress) * hoverStep * floatingMotion.hoverStepMultiplier
      );
      const hoverEase = ease(motion.hoverProgress);
      const hoverBoost = 1 + hoverEase * floatingMotion.hoverSpeedBoost;

      motion.x += motion.vx * dt * hoverBoost;
      motion.y += motion.vy * dt * hoverBoost;
      motion.spinAngle = (motion.spinAngle + spin.speed * dt * (1 + hoverEase * floatingMotion.hoverSpinBoost)) % 360;

      if (motion.x <= pad || motion.x >= maxX) {
        motion.x  = clamp(motion.x, pad, maxX);
        motion.vx = -motion.vx;
      }

      if (motion.y <= pad || motion.y >= maxY) {
        motion.y  = clamp(motion.y, pad, maxY);
        motion.vy = -motion.vy;
      }

      if (!motion.hover) {
        motion.tiltX *= floatingMotion.tiltDamping;
        motion.tiltY *= floatingMotion.tiltDamping;
      }

      setCssVars(el, {
        '--float-x': px(motion.x + Math.sin(driftTime) * wobble.x),
        '--float-y': px(motion.y + Math.cos(driftTime * floatingMotion.driftYRatio) * wobble.y),
        '--float-tilt-x': deg(motion.tiltX),
        '--float-tilt-y': deg(motion.tiltY),
        '--float-rotate': deg(spin.phase + motion.spinAngle + Math.sin(driftTime * floatingMotion.driftRotateRatio) * floatingMotion.driftRotateAmount),
        '--float-hover-z': px(hoverEase * floatingMotion.hoverZ),
        '--float-hover-scale': fixed(1 + hoverEase * floatingMotion.hoverScale),
        '--float-shadow-alpha': fixed(hoverEase * floatingMotion.shadowAlpha)
      });
    });
  }

  function tiltFloatingAsset(e: PointerEvent, index: number) {
    const el = floatingEls[index];
    if (!el) return;
    const { nx, ny } = getPointerOffset(e, el);
    floatingAssets[index].motion.tiltX = clamp(
      -ny * floatingMotion.pointerTilt,
      -floatingMotion.pointerTiltLimit,
      floatingMotion.pointerTiltLimit
    );
    floatingAssets[index].motion.tiltY = clamp(
      nx * floatingMotion.pointerTilt,
      -floatingMotion.pointerTiltLimit,
      floatingMotion.pointerTiltLimit
    );
  }

  function tiltRoleCard(e: PointerEvent, index: number) {
    const card = roleCards[index];
    if (!card) return;

    const { nx, ny } = getPointerOffset(e, card);
    setCssVars(card, {
      '--role-bg-x': px(nx * roleParallaxMotion.bgX),
      '--role-bg-y': px(ny * roleParallaxMotion.bgY),
      '--role-copy-x': px(nx * roleParallaxMotion.copyX),
      '--role-copy-y': px(ny * roleParallaxMotion.copyY),
      '--role-dialogue-x': px(nx * roleParallaxMotion.dialogueX),
      '--role-dialogue-y': px(ny * roleParallaxMotion.dialogueY),
      '--role-person-x': px(nx * roleParallaxMotion.personX),
      '--role-person-y': px(ny * roleParallaxMotion.personY)
    });
  }

  function resetRoleCard(index: number) {
    const card = roleCards[index];
    if (!card) return;
    setCssVars(card, roleCardResetVars);
  }

  function enterRoleCard(event: MouseEvent, item: RoleItem, index: number) {
    if (!item.href || cardEnterTween) return;
    event.preventDefault();
    fadeOutHomeAudioForSectionTransition();

    const card = roleCards[index];
    if (!card) {
      window.setTimeout(() => window.location.assign(item.href!), sectionAudioFadeOutDuration * 1000);
      return;
    }

    resetRoleCard(index);

    const rect = card.getBoundingClientRect();
    const roleCardTop = card.querySelector<HTMLElement>('.role-card-top');
    const roleCardRadius = roleCardTop
      ? getComputedStyle(roleCardTop).borderTopLeftRadius
      : getComputedStyle(card).borderTopLeftRadius;
    const viewportOverscan = 80;
    const horizontalTop = rect.top - 4;
    const horizontalHeight = rect.height + 8;
    const verticalStartTime = 0.68;
    const verticalDuration = 0.58;
    const bottomLineFadeLead = 0.28;
    const topExitProgress = clamp(horizontalTop / Math.max(horizontalTop + viewportOverscan, 1));
    const bottomLineFadeStart = Math.max(
      verticalStartTime,
      verticalStartTime + verticalDuration * topExitProgress - bottomLineFadeLead
    );
    const clone = card.cloneNode(true) as HTMLElement;
    clone.removeAttribute('href');
    clone.setAttribute('aria-hidden', 'true');
    clone.classList.add('is-entering');
    const bottomLine = document.createElement('span');
    bottomLine.className = 'role-card-enter-bottom-line';
    bottomLine.setAttribute('aria-hidden', 'true');
    Object.assign(clone.style, {
      position: 'fixed',
      left: px(rect.left),
      top: px(rect.top),
      width: px(rect.width),
      height: px(rect.height),
      margin: '0',
      zIndex: '120',
      pointerEvents: 'none',
      background: 'transparent',
      transform: 'none',
      opacity: '1'
    });

    const bg = clone.querySelector<HTMLElement>('.role-card-bg');
    const cloneRoleCardTop = clone.querySelector<HTMLElement>('.role-card-top');
    const copy = clone.querySelector<HTMLElement>('.role-card-copy');
    const hoverPanel = clone.querySelector<HTMLElement>('.role-hover-panel');
    const person = clone.querySelector<HTMLElement>('.role-person');
    const pageFade = document.createElement('div');
    pageFade.className = 'card-enter-fade';
    Object.assign(pageFade.style, {
      position: 'fixed',
      zIndex: '119',
      inset: '0',
      background: 'var(--color-surface-page)',
      pointerEvents: 'none',
      opacity: '0'
    });
    clone.append(bottomLine);
    document.body.append(pageFade, clone);
    card.style.visibility = 'hidden';

    gsap.set(pageFade, { opacity: 0 });
    gsap.set(clone, {
      '--role-bg-x': '0px',
      '--role-bg-y': '0px',
      '--role-copy-x': '0px',
      '--role-copy-y': '0px',
      '--role-dialogue-x': '0px',
      '--role-dialogue-y': '0px',
      '--role-person-x': '0px',
      '--role-person-y': '0px',
      '--role-card-radius': roleCardRadius
    });
    gsap.set(bg, { opacity: 1, filter: 'grayscale(1) opacity(0.42)', scale: 1.04 });
    gsap.set(cloneRoleCardTop, { borderBottomColor: 'transparent' });
    gsap.set(bottomLine, { opacity: 1 });
    gsap.set([copy, hoverPanel, person], { opacity: 0 });

    cardEnterTween = animations.registerAnimationCue(
      'cardEnter',
      gsap.timeline({
        defaults: { ease: 'power3.inOut' },
        onComplete: () => {
          sessionStorage.setItem('role-card-transition', '1');
          if (item.title === 'cucina') {
            sessionStorage.setItem('kitchen-card-transition', '1');
          }
          void goto(item.href as string);
        }
      })
    );

    cardEnterTween
      .to(pageFade, { opacity: 1, duration: 0.18, ease: 'power2.out' }, 0)
      .set([bg, copy, hoverPanel, person], { opacity: 0 }, 0.02)
      .to(
        clone,
        {
          y: -12,
          scale: 1.012,
          duration: 0.18,
          ease: 'back.out(1.25)'
        },
        0
      )
      .to(clone, { y: 0, scale: 1, duration: 0.16, ease: 'power2.out' }, 0.16)
      .to(
        clone,
        {
          left: -viewportOverscan,
          top: horizontalTop,
          width: window.innerWidth + viewportOverscan * 2,
          height: horizontalHeight,
          duration: 0.56,
          ease: 'power4.inOut'
        },
        0.18
      )
      .to(bottomLine, { opacity: 0, duration: 0.32, ease: 'power2.out' }, bottomLineFadeStart)
      .to(
        clone,
        {
          top: -viewportOverscan,
          height: window.innerHeight + viewportOverscan * 2,
          duration: verticalDuration,
          ease: 'power4.inOut'
        },
        verticalStartTime
      )
      .to(clone, { boxShadow: '0 0 0 rgb(42 68 132 / 0)', duration: 0.34 }, 0);
  }

  function revealIntroLetters() {
    animations.kill('introReveal');
    gsap.set(introLetters, {
      '--intro-letter-reveal': 0,
      '--intro-reveal-y': '12px'
    });
    animations.registerAnimationCue(
      'introReveal',
      gsap.to(introLetters, {
        '--intro-letter-reveal': 1,
        '--intro-reveal-y': '0px',
        duration: 0.64,
        ease: 'power3.out',
        stagger: 0.028
      })
    );
  }

  function revealAudioGateCopyLetters() {
    const letters = audioGateCopyLetters.filter((el): el is HTMLElement => Boolean(el));
    if (!letters.length) return;
    animations.kill('audioGateCopyReveal');
    gsap.set(letters, {
      '--gate-copy-letter-reveal': 0,
      '--gate-copy-reveal-y': '12px'
    });
    animations.registerAnimationCue(
      'audioGateCopyReveal',
      gsap.to(letters, {
        '--gate-copy-letter-reveal': 1,
        '--gate-copy-reveal-y': '0px',
        duration: audioGateCopyRevealDuration,
        ease: 'power3.out',
        stagger: audioGateCopyRevealStagger
      })
    );
  }

  function reloadHome(event: MouseEvent) {
    event.preventDefault();
    const brandUrl = '/?view=brand';
    if (window.location.pathname === '/' && window.location.search === '?view=brand') {
      window.location.reload();
    } else {
      window.location.assign(brandUrl);
    }
  }

  function consumeRequestedViewParam(requestedView: string | null) {
    if (requestedView !== 'brand' && requestedView !== 'cards') return;
    window.history.replaceState(window.history.state, document.title, '/');
  }

  async function openAbout() {
    const transitionId = ++aboutTransitionId;
    void startBackgroundAudio();
    animations.kill('about');
    destroyAboutProjectPhaser();
    isAboutClosing = false;
    aboutView = 'gate';
    activeInterviewName = undefined;
    isAboutOpen = true;
    await tick();
    if (transitionId !== aboutTransitionId) return;
    if (!aboutScreenEl) {
      isAboutOpen = false;
      return;
    }
    animations.registerAnimationCue(
      'about',
      gsap.fromTo(aboutScreenEl, aboutClosedVars, {
        ...aboutOpenVars,
        duration: aboutMotion.openDuration,
        ease: aboutMotion.openEase,
        clearProps: 'transform'
      })
    );
  }

  function closeAbout() {
    if (isAboutClosing) return;
    const transitionId = ++aboutTransitionId;
    isAboutClosing = true;
    destroyAboutProjectPhaser();
    if (!aboutScreenEl) {
      isAboutOpen = false;
      isAboutClosing = false;
      aboutView = 'gate';
      activeInterviewName = undefined;
      return;
    }
    animations.kill('about');
    animations.registerAnimationCue(
      'about',
      gsap.to(aboutScreenEl, {
        ...aboutClosedVars,
        duration: aboutMotion.closeDuration,
        ease: aboutMotion.closeEase,
        onComplete: () => {
          if (transitionId !== aboutTransitionId) return;
          isAboutOpen = false;
          isAboutClosing = false;
          aboutView = 'gate';
          activeInterviewName = undefined;
        }
      })
    );
  }

  function handleAboutCloseClick() {
    if (aboutView !== 'gate') {
      if (aboutView === 'project') destroyAboutProjectPhaser();
      aboutView = 'gate';
      activeInterviewName = undefined;
      return;
    }

    closeAbout();
  }

  function openAboutInterviews() {
    void startBackgroundAudio();
    destroyAboutProjectPhaser();
    aboutView = 'interviews';
    activeInterviewName = undefined;
  }

  function destroyAboutProjectPhaser() {
    aboutProjectPhaserRequestId += 1;
    aboutProjectResizeObserver?.disconnect();
    aboutProjectResizeObserver = undefined;
    aboutProjectPhaserHandle?.destroy();
    aboutProjectPhaserHandle = undefined;
    aboutProjectTeamLabelStyle = '';
  }

  function updateAboutProjectTeamLabel(container = aboutProjectPhaserEl) {
    if (!container) {
      aboutProjectTeamLabelStyle = '';
      return;
    }

    const { width, height } = container.getBoundingClientRect();
    const projectedGerri = getAboutProjectProjectedRect(aboutProjectAssets, 'gerri', {
      width: Math.max(1, width),
      height: Math.max(1, height)
    });

    if (!projectedGerri) {
      aboutProjectTeamLabelStyle = '';
      return;
    }

    const labelGap = clamp(height * 0.028, 14, 26);
    const labelX = projectedGerri.left + projectedGerri.width * 0.5;
    const labelY = projectedGerri.top - labelGap;
    aboutProjectTeamLabelStyle = `--team-label-x:${fixed(labelX, 2)}px;--team-label-y:${fixed(labelY, 2)}px;`;
  }

  async function writeTextToClipboard(text: string) {
    if (navigator.clipboard?.writeText && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.setAttribute('readonly', '');
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    textArea.style.top = '0';
    document.body.appendChild(textArea);
    textArea.select();

    try {
      document.execCommand('copy');
    } finally {
      textArea.remove();
    }
  }

  async function copyAboutProjectEmail(contact: AboutProjectTeamContact) {
    try {
      await writeTextToClipboard(contact.email);
    } catch (error) {
      console.warn('Unable to copy team email to clipboard', error);
      return;
    }

    copiedAboutProjectEmail = contact.email;
    aboutProjectEmailCopyNonce += 1;

    if (aboutProjectEmailCopyTimeout) window.clearTimeout(aboutProjectEmailCopyTimeout);
    aboutProjectEmailCopyTimeout = window.setTimeout(() => {
      if (copiedAboutProjectEmail === contact.email) copiedAboutProjectEmail = '';
      aboutProjectEmailCopyTimeout = undefined;
    }, 1600);
  }

  async function ensureAboutProjectPhaser() {
    const requestId = ++aboutProjectPhaserRequestId;
    await tick();
    const container = aboutProjectPhaserEl;
    if (!container || aboutProjectPhaserHandle) return;

    const handle = await createAboutProjectPhaserGame({
      assets: aboutProjectAssets,
      container
    });
    if (requestId !== aboutProjectPhaserRequestId || aboutView !== 'project' || !handle) {
      handle?.destroy();
      return;
    }

    aboutProjectPhaserHandle = handle;
    updateAboutProjectTeamLabel(container);
    aboutProjectResizeObserver = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      aboutProjectPhaserHandle?.resize(Math.max(1, width), Math.max(1, height));
      updateAboutProjectTeamLabel(container);
    });
    aboutProjectResizeObserver.observe(container);
  }

  async function openAboutProject() {
    void startBackgroundAudio();
    aboutView = 'project';
    activeInterviewName = undefined;
    isAboutProjectTeamVisible = false;
    await tick();
    aboutProjectEl?.scrollTo({ left: 0, behavior: 'auto' });
    void ensureAboutProjectPhaser();
  }

  function openInterviewDetail(chef: InterviewChef) {
    if (!interviewDetails[chef.name]) return;
    activeInterviewName = chef.name;
  }

  function closeInterviewDetail() {
    activeInterviewName = undefined;
  }

  async function openFullInterview() {
    if (!activeInterviewDetail || !activeFullInterviewContent) return;
    aboutView = 'interview';
    await tick();
    fullInterviewScrollEl?.scrollTo({ top: 0, behavior: 'auto' });
    queueFullInterviewScrollbarUpdate();
    window.setTimeout(queueFullInterviewScrollbarUpdate, 80);
  }

  function returnToInterviewDetail() {
    aboutView = 'interviews';
  }

  function handleFullInterviewTranscriptWheel(event: WheelEvent) {
    const scroller = event.currentTarget as HTMLElement;
    if (!scroller) return;

    const maxScrollTop = scroller.scrollHeight - scroller.clientHeight;
    if (maxScrollTop <= 0) return;

    const delta = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
    const nextScrollTop = clamp(scroller.scrollTop + delta, 0, maxScrollTop);

    event.preventDefault();
    event.stopPropagation();
    scroller.scrollTop = nextScrollTop;
    updateFullInterviewScrollbar();
  }

  function updateFullInterviewScrollbar() {
    const scroller = fullInterviewScrollEl;
    if (!scroller) return;

    const viewportHeight = scroller.clientHeight;
    const scrollHeight = scroller.scrollHeight;
    const maxScrollTop = scrollHeight - viewportHeight;
    const scrollbarInset = 4;
    const scrollbarTravelHeight = Math.max(1, viewportHeight - scrollbarInset * 2);
    const thumbHeight = maxScrollTop > 0
      ? clamp((viewportHeight / scrollHeight) * scrollbarTravelHeight, 42, scrollbarTravelHeight)
      : scrollbarTravelHeight;
    const currentScrollTop = clamp(scroller.scrollTop, 0, Math.max(0, maxScrollTop));
    const thumbY = maxScrollTop > 0
      ? scrollbarInset + ((scrollbarTravelHeight - thumbHeight) * currentScrollTop) / maxScrollTop
      : scrollbarInset;

    fullInterviewScrollbarThumbStyle = `height: ${fixed(thumbHeight)}px; transform: translate3d(0, ${fixed(thumbY)}px, 0);`;
  }

  function queueFullInterviewScrollbarUpdate() {
    if (fullInterviewScrollbarFrame) window.cancelAnimationFrame(fullInterviewScrollbarFrame);
    fullInterviewScrollbarFrame = window.requestAnimationFrame(() => {
      fullInterviewScrollbarFrame = 0;
      updateFullInterviewScrollbar();
    });
  }

  function handleInterviewsWheel(event: WheelEvent) {
    if (activeInterviewName) return;
    const scroller = event.currentTarget as HTMLElement;
    if (!scroller || scroller.scrollWidth <= scroller.clientWidth) return;
    if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
    event.preventDefault();
    scroller.scrollLeft += event.deltaY;
  }

  function handleProjectScroll(event: Event) {
    const scroller = event.currentTarget as HTMLElement;
    if (!scroller) return;
    isAboutProjectTeamVisible = scroller.scrollLeft >= scroller.clientWidth * 0.42;
    if (isAboutProjectTeamVisible) void ensureAboutProjectPhaser();
  }

  function handleProjectWheel(event: WheelEvent) {
    const scroller = event.currentTarget as HTMLElement;
    if (!scroller || scroller.scrollWidth <= scroller.clientWidth) return;
    if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
      event.stopPropagation();
      return;
    }
    event.preventDefault();
    event.stopPropagation();

    const targetLeft = event.deltaY > 0 ? scroller.clientWidth : 0;
    scroller.scrollTo({ left: targetLeft, behavior: 'smooth' });
  }

  async function startRoleAudio(role: AudioRole) {
    if (isAudioMuted) return;
    await unlockAmbientAudio();
    await audioCues.play(role);
  }

  function stopRoleAudio(role: AudioRole) {
    audioCues.stop(role);
  }

  function setAudioMuted(nextMuted: boolean) {
    writeAudioMutedPreference(nextMuted);
    if (isAudioMuted === nextMuted) return;
    isAudioMuted = nextMuted;
    if (isAudioMuted) {
      stopAllHomeAudio();
    } else {
      void startBackgroundAudio();
      void unlockAmbientAudio();
    }
  }

  function toggleAudioMuted() {
    setAudioMuted(!isAudioMuted);
  }

  function toggleAudioGateMuted() {
    if (isAudioGateOpening) return;
    setAudioMuted(!isAudioMuted);
  }

  function setAudioGateButtonTransitionVars() {
    if (!audioGateButtonEl) return;
    const rect = audioGateButtonEl.getBoundingClientRect();
    const horizontalReach = Math.max(rect.left + rect.width / 2, window.innerWidth - rect.left - rect.width / 2);
    const verticalReach = Math.max(rect.top + rect.height / 2, window.innerHeight - rect.top - rect.height / 2);
    const scale = Math.max((horizontalReach * 2) / rect.width, (verticalReach * 2) / rect.height) * 1.18;

    setCssVars(audioGateButtonEl, {
      '--gate-button-screen-scale': fixed(scale)
    });
  }

  async function openAudioGate(nextMuted = isAudioMuted) {
    if (isAudioGateOpening) return;
    setAudioGateButtonTransitionVars();
    isAudioMuted = nextMuted;
    writeAudioMutedPreference(nextMuted);
    isAudioGateOpening = true;
    if (!nextMuted) {
      await startBackgroundAudio();
      void unlockAmbientAudio();
    }
    sceneResources.addTimeout(revealIntroLetters, 1700);
    sceneResources.addTimeout(() => {
      isAudioGateVisible = false;
    }, 2050);
  }

  async function unlockAmbientAudio() {
    await audioCues.unlock(audioRoles);
  }

  async function startBackgroundAudio() {
    if (isAudioMuted) return;
    await audioCues.play('background');
  }

  function stopAllHomeAudio(options: { duration?: number } = {}) {
    audioCues.stopAll(homeAudioIds, options);
  }

  function stopAllRoleAudio(options: { duration?: number } = {}) {
    audioCues.stopAll(audioRoles, options);
  }

  function fadeOutHomeAudioForSectionTransition() {
    audioCues.stopAll(homeAudioIds, { duration: sectionAudioFadeOutDuration });
  }

  // ── Unica funzione che gestisce tutto — nessun conflitto ──
  function applyAllStyles() {
    // 1. Home scorre via
    const epPage        = ease(pageProgress);
    const brandReveal   = clamp(brandProgress);
    const epBrand       = ease(brandReveal);
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
    setCssVars(homeScreen, { '--page-y': px(-viewportHeight * epPage) });
    setCssVars(introScrollCueEl, {
      '--intro-scroll-cue-opacity': fixed(1 - epPage),
      '--intro-scroll-cue-y': px(epPage * 10)
    });

    // 2. next-screen: appare con pageProgress, sparisce con brandProgress
    //    opacity finale = pageProgress-driven * (1 - brandProgress-driven)
    if (nextScreen) {
      const showNext = epPage;                      // 0→1 mentre scrolla verso next
      const hideNext = epBrand;                     // 0→1 mentre scrolla verso brand
      setLayerState(nextScreen, showNext * (1 - hideNext), showNext > 0.05 && hideNext < 0.95);
    }

    // 3. brand-screen: appare con brandProgress
    if (brandScreen) {
      setLayerState(brandScreen, epBrand, epBrand > 0.05);
    }
    setLayerState(rolesTopBar, epBrand, epBrand > 0.05 && !isAboutOpen);

    const floatingExit = ease(clamp((brandProgress - floatingExitMotion.start) / floatingExitMotion.duration));
    floatingEls.forEach((el, index) => {
      if (!el) return;
      const asset = floatingAssets[index];
      const fadeOut = ease(clamp((floatingExit - floatingExitMotion.fadeStart) / floatingExitMotion.fadeDuration));
      const scrollX = asset.exitX * floatingExit;
      const scrollY = asset.exitY * floatingExit;
      setCssVars(el, {
        '--float-scroll-x': vw(scrollX),
        '--float-scroll-y': vh(scrollY, 2),
        '--float-scale': fixed(1 - floatingExit * floatingExitMotion.scaleLoss),
        '--float-opacity': fixed(1 - fadeOut)
      });
      el.style.pointerEvents = fadeOut > floatingExitMotion.pointerCutoff ? 'none' : 'auto';
    });

    const rolesProgress = clamp((brandProgress - rolesRevealStart) / rolesRevealDuration);
    const rolesEase = ease(rolesProgress);
    if (rolesScreen) {
      setLayerState(rolesScreen, rolesEase, rolesProgress > 0.08);
    }
    roleCards.forEach((card, index) => {
      if (!card) return;
      const cardStart = index * roleCardStagger;
      const cardProgress = clamp((rolesProgress - cardStart) / Math.max(1 - cardStart, roleCardRevealDuration));
      const cardEase = ease(cardProgress);
      setCssVars(card, {
        '--role-card-y': vh((1 - cardEase) * 38),
        '--role-card-opacity': fixed(cardEase)
      });
    });

    // 4. Lettere intro: dissolvono con pageProgress
    applyLetterStyles(introLetters, pageProgress, introLetterOut);

    // 5. Lettere next: si rivelano con pageProgress
    applyLetterStyles(nextLetters, pageProgress, nextLetterIn);

    // 6. Lettere brand
    applyBrandLetters();

    const subtitleIn = ease(clamp((brandProgress - brandSubtitleMotion.inStart) / brandSubtitleMotion.inDuration));
    const subtitleOut = ease(clamp((brandProgress - brandSubtitleMotion.outStart) / brandSubtitleMotion.outDuration));
    const subtitleOpacity = subtitleIn * (1 - subtitleOut);
    const subtitleY = (1 - subtitleIn) * brandSubtitleMotion.enterY + subtitleOut * brandSubtitleMotion.exitY;
    setCssVars(brandSubtitleEl, {
      '--brand-subtitle-opacity': fixed(subtitleOpacity),
      '--brand-subtitle-y': px(subtitleY)
    });
    setCssVars(brandScrollCueEl, {
      '--brand-subtitle-opacity': fixed(subtitleOpacity),
      '--brand-subtitle-y': px(subtitleY)
    });
  }

  function fitRoleHoverText(text: HTMLElement) {
    const panel = text.closest<HTMLElement>('.role-hover-panel');
    if (!panel) return;

    const panelRect = panel.getBoundingClientRect();
    if (panelRect.width <= 0 || panelRect.height <= 0) return;

    const isMobile = window.matchMedia('(max-width: 760px)').matches;
    const minSize = isMobile ? 8.5 : 9.5;
    const maxSize = Math.max(
      minSize,
      Math.min(isMobile ? 14 : 16, panelRect.width * (isMobile ? 0.038 : 0.043), panelRect.height * 0.17)
    );
    const maxContentHeight = panelRect.height * 0.74;
    let low = minSize;
    let high = maxSize;

    for (let step = 0; step < 9; step += 1) {
      const size = (low + high) / 2;
      text.style.setProperty('--role-hover-font-size', `${size}px`);
      const fitsWidth = text.scrollWidth <= text.clientWidth + 1;
      const fitsHeight = text.scrollHeight <= maxContentHeight + 1;
      if (fitsWidth && fitsHeight) {
        low = size;
      } else {
        high = size;
      }
    }

    text.style.setProperty('--role-hover-font-size', `${fixed(low, 1)}px`);
  }

  function fitRoleHoverTexts() {
    roleCards.forEach((card) => {
      const text = card?.querySelector<HTMLElement>('.role-hover-panel p');
      if (text) fitRoleHoverText(text);
    });
  }

  function queueRoleHoverTextFit() {
    if (roleHoverFitFrame) return;
    roleHoverFitFrame = window.requestAnimationFrame(() => {
      roleHoverFitFrame = 0;
      fitRoleHoverTexts();
    });
  }

  onMount(() => {
    let isDestroyed = false;
    isAudioMuted = readAudioMutedPreference(isAudioMuted);

    void loadGsap().then((loadedGsap) => {
      if (isDestroyed) return;

      gsap = loadedGsap;
      animations.setGsap(gsap);
      audioCues.setGsap(gsap);

    const searchParams = new URLSearchParams(window.location.search);
    const requestedView = searchParams.get('view');
    const requestedAbout = searchParams.get('about');
    const shouldOpenCards = requestedView === 'cards';
    const shouldOpenBrand = requestedView === 'brand';
    const shouldOpenAboutGate = requestedAbout === 'gate';
    const shouldSkipIntro = shouldOpenCards || shouldOpenBrand || shouldOpenAboutGate;
    const initialFlowValue = shouldOpenCards ? rolesScrollVisible : shouldOpenBrand ? brandCopyScrollEnd : 0;
    const flowState = { value: 0 };
    let targetFlowValue = initialFlowValue;
    let isAutoScrolling = false;
    consumeRequestedViewParam(requestedView);
    if (shouldOpenAboutGate) {
      window.history.replaceState(window.history.state, document.title, '/');
    }
    randomizeBrandLetters();
    if (shouldSkipIntro) {
      isAudioGateVisible = false;
      flowState.value = initialFlowValue;
    }

    if (!shouldSkipIntro) {
      animations.registerAnimationCue(
        'mountFadeDelay',
        gsap.delayedCall(mountFadeMotion.delay, () => {
          if (!introEl) return;
          animations.registerAnimationCue(
            'mountFade',
            gsap.to(introEl, {
              '--mount-opacity': 1,
              duration: mountFadeMotion.duration,
              ease: mountFadeMotion.ease
            })
          );
        })
      );
    }

    const applyFlowTotal = (value: number) => {
      const flowValue = clamp(value, 0, flowTotalMax);
      const nextReelProgress = clamp(flowValue);
      const reelDelta = nextReelProgress - reelProgress;
      if (Math.abs(reelDelta) > 0.0005) reelTravelDirection = reelDelta > 0 ? 1 : -1;
      reelProgress = nextReelProgress;
      pageProgress = clamp(flowValue - 1);
      brandProgress = clamp(flowValue - 2, 0, brandScrollMax);
      applyReelStyles();
      applyAllStyles();
    };

    const tweenFlowTo = (value: number, duration = flowMotion.duration, onComplete?: () => void) => {
      targetFlowValue = clamp(value, 0, flowTotalMax);
      isAutoScrolling = false;
      flowTween = animations.registerAnimationCue(
        'flow',
        gsap.to(flowState, {
          value: targetFlowValue,
          duration,
          ease: flowMotion.ease,
          overwrite: true,
          onUpdate: () => applyFlowTotal(flowState.value),
          onComplete
        })
      );
    };

    const autoFlowTo = (value: number, duration: number, ease = flowMotion.autoEase) => {
      targetFlowValue = clamp(value, 0, flowTotalMax);
      isAutoScrolling = true;
      flowTween = animations.registerAnimationCue(
        'flow',
        gsap.to(flowState, {
          value: targetFlowValue,
          duration,
          ease,
          overwrite: true,
          onUpdate: () => applyFlowTotal(flowState.value),
          onComplete: () => {
            isAutoScrolling = false;
          },
          onInterrupt: () => {
            isAutoScrolling = false;
          }
        })
      );
    };
    const queueFlow = (delta: number) => {
      if (isAutoScrolling) {
        const autoDirection = Math.sign(targetFlowValue - flowState.value);
        const inputDirection = Math.sign(delta);
        if (inputDirection === 0 || autoDirection === 0 || inputDirection === autoDirection) return;
        flowTween?.kill();
        isAutoScrolling = false;
        targetFlowValue = flowState.value;
      }

      const isCopyForwardStep = delta > 0 && flowState.value >= copyScrollStart && flowState.value < copyScrollEnd;
      const isCopyBackStep = delta < 0 && flowState.value > copyScrollStart && flowState.value <= copyScrollEnd;
      if (isCopyForwardStep || isCopyBackStep) {
        const target = isCopyForwardStep ? copyScrollEnd : copyScrollStart;
        autoFlowTo(
          target,
          flowMotion.autoStepDuration,
          isCopyForwardStep ? flowMotion.autoEase : flowMotion.reverseAutoEase
        );
        return;
      }

      const isBrandForwardStep = delta > 0 && flowState.value >= copyScrollEnd && flowState.value < brandCopyScrollEnd;
      const isBrandBackStep = delta < 0 && flowState.value > copyScrollEnd && flowState.value <= brandCopyScrollEnd;
      if (isBrandForwardStep || isBrandBackStep) {
        const target = isBrandForwardStep ? brandCopyScrollEnd : copyScrollEnd;
        autoFlowTo(
          target,
          flowMotion.autoStepDuration,
          isBrandForwardStep ? flowMotion.autoEase : flowMotion.reverseAutoEase
        );
        return;
      }

      const isBrandExitForwardStep = delta > 0 && flowState.value >= brandCopyScrollEnd && flowState.value < rolesScrollVisible;
      const isBrandExitBackStep = delta < 0 && flowState.value > brandCopyScrollEnd && flowState.value <= flowTotalMax;
      if (isBrandExitForwardStep) {
        autoFlowTo(
          rolesScrollVisible,
          flowMotion.autoStepDuration
        );
        return;
      }

      if (isBrandExitBackStep) {
        autoFlowTo(
          brandCopyScrollEnd,
          flowMotion.autoStepDuration,
          flowMotion.reverseAutoEase
        );
        return;
      }

      const isMovingThroughReels = flowState.value < 1 || (delta < 0 && flowState.value <= copyScrollStart);
      const effectiveDelta = isMovingThroughReels ? delta * flowMotion.reelScrollSlowdown : delta;
      const targetLead = isMovingThroughReels
        ? flowMotion.reelMaxTargetLead
        : delta < 0
          ? flowMotion.reverseMaxTargetLead
          : flowMotion.maxTargetLead;
      targetFlowValue = flowState.value;
      const unclampedTarget = targetFlowValue + effectiveDelta;
      const minTarget = flowState.value - targetLead;
      const maxTarget = flowState.value + targetLead;
      const nextTarget = clamp(unclampedTarget, minTarget, maxTarget);
      const settleReelExit = () => {
        if (!isMovingThroughReels || nextTarget >= 1 || nextTarget <= reelMotion.autoReturnFlowTarget) return;
        if (delta > 0 && nextTarget >= reelMotion.autoExitFlowStart) {
          autoFlowTo(copyScrollEnd, flowMotion.autoStepDuration);
        } else if (delta < 0 && nextTarget >= reelMotion.autoExitFlowStart) {
          autoFlowTo(reelMotion.autoReturnFlowTarget, reelMotion.autoSettleDuration);
        }
      };
      tweenFlowTo(
        nextTarget,
        isMovingThroughReels ? flowMotion.reelDuration : flowMotion.duration,
        settleReelExit
      );
    };

    const normalizeWheelDelta = (e: WheelEvent) => {
      const unit = e.deltaMode === WheelEvent.DOM_DELTA_LINE
        ? 16
        : e.deltaMode === WheelEvent.DOM_DELTA_PAGE
          ? window.innerHeight
          : 1;
      const rawStep = (e.deltaY * unit) / 2400;
      return clamp(rawStep, -flowMotion.reverseMaxWheelStep, flowMotion.maxWheelStep);
    };

    const onWheel   = (e: WheelEvent)    => {
      e.preventDefault();
      if (isAudioGateVisible) return;
      queueFlow(normalizeWheelDelta(e));
    };
    const onPointerDownAudioUnlock = () => {
      if (isAudioGateVisible || isAudioMuted) return;
      void unlockAmbientAudio();
    };
    const onKeydown = (e: KeyboardEvent) => {
      if (isAudioGateVisible) {
        const activeEl = document.activeElement;
        if ((e.key === ' ' || e.key === 'Enter') && activeEl?.classList.contains('audio-gate-button')) return;
        e.preventDefault();
        return;
      }
      if (!isAudioMuted) void unlockAmbientAudio();
      const step = keyFlowSteps[e.key];
      if (step !== undefined) { e.preventDefault(); queueFlow(step); }
    };

    applyFlowTotal(flowState.value);
    if (shouldSkipIntro) {
      gsap.set(introEl, { '--mount-opacity': 1 });
      gsap.set(introLetters, {
        '--intro-letter-reveal': 1,
        '--intro-reveal-y': '0px'
      });
    } else {
      gsap.set(introLetters, {
        '--intro-letter-reveal': 0,
        '--intro-reveal-y': '12px'
      });
    }
    revealAudioGateCopyLetters();
    if (shouldSkipIntro && !isAudioMuted) {
      void startBackgroundAudio();
      void unlockAmbientAudio();
    }
    void tick().then(() => {
      if (isDestroyed) return;
      fitRoleHoverTexts();
      roleHoverResizeObserver?.disconnect();
      roleHoverResizeObserver = new ResizeObserver(queueRoleHoverTextFit);
      roleCards.forEach((card) => {
        const panel = card?.querySelector<HTMLElement>('.role-hover-panel');
        if (panel) roleHoverResizeObserver?.observe(panel);
      });
    });
    animations.addTicker(moveFloatingAssets);
    sceneResources.addEventListener(window, 'wheel', onWheel as EventListener, { passive: false });
    sceneResources.addEventListener(window, 'keydown', onKeydown as EventListener);
    sceneResources.addEventListener(window, 'pointerdown', onPointerDownAudioUnlock, { passive: true });
    sceneResources.addEventListener(window, 'resize', queueRoleHoverTextFit, { passive: true });
    sceneResources.addEventListener(window, 'resize', queueFullInterviewScrollbarUpdate, { passive: true });
    if (shouldOpenAboutGate) {
      void openAbout();
    }
    });

    return () => {
      isDestroyed = true;
      if (roleHoverFitFrame) window.cancelAnimationFrame(roleHoverFitFrame);
      roleHoverFitFrame = 0;
      if (fullInterviewScrollbarFrame) window.cancelAnimationFrame(fullInterviewScrollbarFrame);
      fullInterviewScrollbarFrame = 0;
      if (aboutProjectEmailCopyTimeout) window.clearTimeout(aboutProjectEmailCopyTimeout);
      aboutProjectEmailCopyTimeout = undefined;
      roleHoverResizeObserver?.disconnect();
      roleHoverResizeObserver = undefined;
      flowTween?.kill();
      destroyAboutProjectPhaser();
      animations.destroy();
      audioCues.destroy();
      sceneResources.destroy();
    };
  });
</script>


<svelte:head>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
  <link
    href="https://fonts.googleapis.com/css2?family=DynaPuff:wght@400..700&family=Fasthand&family=JetBrains+Mono:ital,wght@0,400;0,800;1,700;1,800&family=Roboto:wght@400;500&display=swap"
    rel="stylesheet"
  />
</svelte:head>

<svg class="svg-filter-defs" width="0" height="0" aria-hidden="true" focusable="false">
  <defs>
    <filter
      id="interview-selected-chef-outline"
      x="-18%"
      y="-18%"
      width="136%"
      height="136%"
      color-interpolation-filters="sRGB"
    >
      <feMorphology in="SourceAlpha" operator="dilate" radius="1.8" result="dilated" />
      <feComposite in="dilated" in2="SourceAlpha" operator="out" result="outline" />
      <feFlood flood-color="#f8f3e9" result="outline-color" />
      <feComposite in="outline-color" in2="outline" operator="in" result="colored-outline" />
      <feMerge>
        <feMergeNode in="colored-outline" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
</svg>

{#if isAudioGateVisible}
  <section
    class:is-opening={isAudioGateOpening}
    class="audio-gate"
    aria-labelledby="audio-gate-copy"
    data-node-id="3266:3591"
  >
    <div
      class="audio-gate-utensils"
      aria-hidden="true"
      style={`--utensil-rise-delay: ${Math.round(audioGateUtensilRiseDelay * 1000)}ms; --utensil-shake-delay: ${Math.round(audioGateUtensilShakeDelay * 1000)}ms; --utensil-idle-delay: ${Math.round(audioGateUtensilIdleDelay * 1000)}ms`}
    >
      <div class="audio-gate-utensil audio-gate-fork" data-node-id="4197:2170">
        <img src="/assets/audio-gate-fork.svg" alt="" draggable="false" data-node-id="4197:2168" />
      </div>
      <div class="audio-gate-utensil audio-gate-knife" data-node-id="4197:2173">
        <img src="/assets/audio-gate-knife.svg" alt="" draggable="false" data-node-id="4197:2169" />
      </div>
    </div>

    <div class="audio-gate-content">
      <div class="audio-gate-orbit" aria-hidden="true" data-node-id="4109:3541">
        <svg class="audio-gate-orbit-line" viewBox="0 0 100 100" focusable="false">
          {#each audioGateOrbitDots as dot (dot.index)}
            <circle
              class="audio-gate-orbit-dot"
              cx={fixed(dot.point.x, 3)}
              cy={fixed(dot.point.y, 3)}
              r="0.4"
              style={`--orbit-dot-index: ${dot.index}; --orbit-dot-delay: ${dot.delayMs}ms`}
            />
          {/each}
        </svg>
      </div>
      <div class="audio-gate-stack">
        <div class="audio-gate-audio-button-frame" data-node-id="4195:10927">
          <button
            class="icon-button audio-gate-audio-button audio-gate-press-control"
            type="button"
            aria-label={audioLabel}
            aria-pressed={isAudioMuted}
            data-node-id="4109:3605"
            onclick={toggleAudioGateMuted}
          >
            {#if isAudioMuted}
              <VolumeOffIcon class="volume-icon" />
            {:else}
              <VolumeMaxIcon class="volume-icon volume-max-icon" />
            {/if}
          </button>
        </div>
        <p id="audio-gate-copy" aria-label={audioGateMessage} data-node-id="4109:3572">
          {#each audioGateWords as group (group.index)}
            {#if group.type === 'space'}
              <span class="audio-gate-copy-space" aria-hidden="true">&nbsp;</span>
            {:else}
              <span class="audio-gate-copy-word" aria-hidden="true">
                {#each group.characters as { letter, index } (index)}
                  <span bind:this={audioGateCopyLetters[index]} class="audio-gate-copy-letter">
                    {letter}
                  </span>
                {/each}
              </span>
            {/if}
          {/each}
        </p>
        <div class="audio-gate-button-frame" data-node-id="4109:3579">
          <button
            bind:this={audioGateButtonEl}
            class="audio-gate-button audio-gate-press-control"
            type="button"
            aria-label="Inizia"
            data-node-id="4109:3575"
            onclick={() => openAudioGate(isAudioMuted)}
          >
            <span class="audio-gate-button-label" data-node-id="4109:3578">
              <span data-node-id="4109:3576">Inizia</span>
            </span>
          </button>
        </div>
      </div>
    </div>
  </section>
{/if}

{#if !isAudioGateVisible && !isAboutOpen}
  <button
    class="icon-button persistent-top-audio press-ring-control"
    type="button"
    aria-label={audioLabel}
    aria-pressed={isAudioMuted}
    onclick={toggleAudioMuted}
  >
    <span class="topbar-control-content" aria-hidden="true">
      {#if isAudioMuted}
        <VolumeOffIcon class="volume-icon" />
      {:else}
        <VolumeMaxIcon class="volume-icon volume-max-icon" />
      {/if}
    </span>
  </button>
{/if}

<main bind:this={homeScreen} class="home">
  <section class="intro" aria-labelledby="intro-title" bind:this={introEl}>
    <div class="intro-copy">
      <h1 id="intro-title" aria-label={introMessage}>
        {#each introWords as group (group.index)}
          {#if group.type === 'space'}
            <span class="space" aria-hidden="true">&nbsp;</span>
          {:else}
            {#if group.index === 14 || group.index === 35}
              <br aria-hidden="true" />
            {/if}
            <span class="word" aria-hidden="true">
              {#each group.characters as { letter, isAccent, index } (index)}
                <span bind:this={introLetters[index]} class:accent-letter={isAccent}
                  >{letter}</span>
              {/each}
            </span>
          {/if}
        {/each}
      </h1>
    </div>
    <div bind:this={introScrollCueEl} class="intro-scroll-cue" aria-label="Scorri">
      <span>Scorri</span>
      <svg class="brand-scroll-arrow" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 5v12M7 12l5 5 5-5" />
      </svg>
    </div>
  </section>

  <section class="reel-layer" aria-label="Mockup reels in profondità">
    {#each reels as reel, index}
      <article bind:this={reelCards[index]} class="reel-card" aria-label={`Reel ${index + 1}`}>
        <div class="reel-frame">
          {#if reel.src}
            <video class="reel-video" src={reel.src} autoplay muted playsinline loop preload="metadata"></video>
          {:else}
            <div class="reel-placeholder" style="background:{reel.bg}"></div>
          {/if}
        </div>
      </article>
    {/each}
  </section>
</main>


<section bind:this={nextScreen} class="next-screen" aria-labelledby="next-message">
  <p id="next-message" class="next-message" aria-label={nextMessage}>
    {#each nextWords as group (group.index)}
      {#if group.type === 'space'}
        <span class="space" aria-hidden="true">&nbsp;</span>
      {:else}
        {#if group.index === 20 || group.index === 41}
          <br class="next-message-desktop-break" aria-hidden="true" />
        {/if}
        <span class="next-message-word" aria-hidden="true">
          {#each group.characters as { letter, index, isAccent } (index)}
            <span
              bind:this={nextLetters[index]}
              class="next-message-letter"
              class:accent-letter={isAccent}
            >
              {letter}
            </span>
          {/each}
        </span>
      {/if}
    {/each}
  </p>
  <div class="next-scroll-cue" aria-label="Scorri">
    <span>Scorri</span>
    <svg class="brand-scroll-arrow" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5v12M7 12l5 5 5-5" />
    </svg>
  </div>
</section>


<section bind:this={brandScreen} class="brand-screen" aria-label="FuoriMenù">
  {#each floatingAssets as asset, index}
    <div
      bind:this={floatingEls[index]}
      class={`floating-vector ${asset.className}`}
      data-node-id={asset.nodeId}
      role="img"
      aria-label={asset.label}
      onpointerenter={() => { asset.motion.hover = true; }}
      onpointermove={(event) => tiltFloatingAsset(event, index)}
      onpointerleave={() => { asset.motion.hover = false; }}
    >
      <img src={asset.src} alt="" draggable="false" />
    </div>
  {/each}

  <div class="brand-lockup">
    <p class="brand-word" class:is-sharp={isBrandWordSharp} aria-label={brandWord}>
      {#each brandLetters as { letter }, index}
        <span bind:this={brandLetterEls[index]} class="brand-letter" aria-hidden="true"
          >{letter}</span>
      {/each}
    </p>
    <p bind:this={brandSubtitleEl} class="brand-subtitle" aria-label={brandSubtitle}>
      <span class="brand-subtitle-jetbrains" aria-hidden="true">Dentro le </span>
      <span class="brand-subtitle-jetbrains" aria-hidden="true">cucine di Milano Cortina 2026</span>
    </p>
  </div>
  <div bind:this={brandScrollCueEl} class="brand-scroll-cue" data-node-id="3448:2821" aria-label="Scorri">
    <span data-node-id="3448:2822">Scorri</span>
    <svg class="brand-scroll-arrow" viewBox="0 0 24 24" aria-hidden="true" data-node-id="3448:1201">
      <path d="M12 5v12M7 12l5 5 5-5" />
    </svg>
  </div>
</section>

<header bind:this={rolesTopBar} class="roles-top-bar" class:is-hidden={isAboutOpen} aria-label="Navigazione principale">
  <a class="logo press-ring-control" href="/?view=brand" aria-label="Vai al brand screen Fuorimenù" onclick={reloadHome}>
    <span class="topbar-control-content">FM</span>
  </a>
  <span class="top-bar-audio top-bar-audio-slot" aria-hidden="true"></span>
  <button
    class="icon-button top-bar-menu press-ring-control"
    type="button"
    aria-label="Apri sezione about"
    aria-expanded={isAboutOpen}
    onclick={openAbout}
  >
    <span class="topbar-control-content" aria-hidden="true">
      <span class="menu-icon"></span>
    </span>
  </button>
</header>

<section bind:this={rolesScreen} class="roles-screen" aria-label="Aree Fuorimenù">
  <div class="role-grid">
    {#snippet roleCardBody(item: RoleItem)}
      <div class="role-card-top">
        <img
          class="role-card-bg"
          src={item.backgroundSrc ?? '/images/figma-kitchen-scene.png'}
          alt=""
          draggable="false"
        />
        <span class="role-card-bg-overlay" aria-hidden="true"></span>
        <div class="role-hover-panel">
          <svg
            class="role-hover-panel-shape"
            viewBox="0 0 373 149"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path
              d="M1 122.5V41C1 18.9 18.9 1 41 1H332C354.1 1 372 18.9 372 41V122.5H215.5L186.5 147.5L157.5 122.5H1Z"
            />
          </svg>
          <p>
            <span class="role-hover-line">{item.hoverIntro} <strong>{item.hoverName}</strong>,</span>
            <span class="role-hover-line">{item.hoverAction}</span>
            <span class="role-hover-line">{item.hoverClosing}</span>
          </p>
        </div>
        <div class="role-card-copy">
          <h2>{item.displayTitle ?? item.title}</h2>
          <p>{item.description}</p>
        </div>
        {#if item.personSrc}
          <img
            class="role-person"
            class:role-person-outline={Boolean(item.personFillSrc)}
            src={item.personSrc}
            alt={item.speaker}
            data-node-id={item.personNodeId}
            draggable="false"
          />
          {#if item.personFillSrc}
            <img
              class="role-person role-person-fill"
              src={item.personFillSrc}
              alt=""
              data-node-id={item.personFillNodeId}
              draggable="false"
            />
          {/if}
        {/if}
      </div>
    {/snippet}

    {#each roleItems as item, index}
      {#if item.href}
        <a
          bind:this={roleCards[index]}
          class="role-card is-linked"
          class:is-ufficio={item.title === 'ufficio'}
          class:is-cucina={item.title === 'cucina'}
          class:is-servizio={item.title === 'servizio'}
          class:has-dialogue={Boolean(item.dialogue)}
          class:has-person-fill={Boolean(item.personFillSrc)}
          href={item.href}
          onclick={(event) => enterRoleCard(event, item, index)}
          onpointerenter={() => startRoleAudio(item.title)}
          onpointermove={(event) => tiltRoleCard(event, index)}
          onpointerleave={() => {
            stopRoleAudio(item.title);
            resetRoleCard(index);
          }}
        >
          {@render roleCardBody(item)}
        </a>
      {:else}
        <article
          bind:this={roleCards[index]}
          class="role-card"
          class:is-ufficio={item.title === 'ufficio'}
          class:is-cucina={item.title === 'cucina'}
          class:is-servizio={item.title === 'servizio'}
          class:has-dialogue={Boolean(item.dialogue)}
          class:has-person-fill={Boolean(item.personFillSrc)}
          onpointerenter={() => startRoleAudio(item.title)}
          onpointermove={(event) => tiltRoleCard(event, index)}
          onpointerleave={() => {
            stopRoleAudio(item.title);
            resetRoleCard(index);
          }}
        >
          {@render roleCardBody(item)}
        </article>
      {/if}
    {/each}
  </div>
</section>

<audio
  bind:this={backgroundAudio.el}
  src={backgroundAudio.src}
  preload="auto"
  aria-hidden="true"
></audio>

{#each roleAudioEntries as { role, config } (role)}
  <audio
    bind:this={config.el}
    src={config.src}
    preload="auto"
    aria-hidden="true"
  ></audio>
{/each}

{#if isAboutOpen}
  <section
    bind:this={aboutScreenEl}
    class="about-screen"
    class:is-project={aboutView === 'project'}
    class:is-interviews={aboutView === 'interviews'}
    class:is-full-interview={aboutView === 'interview'}
    aria-labelledby="about-title"
    data-node-id="256:1827"
  >
    <header class="about-top-bar" aria-label="Navigazione about">
      <a class="logo about-logo press-ring-control" href="/?view=brand" aria-label="Vai al brand screen Fuorimenù" onclick={reloadHome}>
        <span class="topbar-control-content">FM</span>
      </a>
      <button
        class="icon-button top-bar-audio about-audio press-ring-control"
        type="button"
        aria-label={audioLabel}
        aria-pressed={isAudioMuted}
        onclick={toggleAudioMuted}
      >
        <span class="topbar-control-content" aria-hidden="true">
          {#if isAudioMuted}
            <VolumeOffIcon class="volume-icon" />
          {:else}
            <VolumeMaxIcon class="volume-icon volume-max-icon" />
          {/if}
        </span>
      </button>
      <button
        class="icon-button top-bar-menu about-close press-ring-control"
        type="button"
        aria-label={aboutView === 'gate' ? 'Chiudi sezione about' : 'Torna agli argomenti about'}
        onclick={handleAboutCloseClick}
      >
        <span class="topbar-control-content" aria-hidden="true">
          <span
            class:menu-icon={aboutView === 'gate' || aboutView === 'interview'}
            class:close-icon={aboutView !== 'gate' && aboutView !== 'interview'}
          ></span>
        </span>
      </button>
    </header>

    <h2 id="about-title" class="visually-hidden">About Fuorimenù</h2>
    {#if aboutView === 'gate'}
      <div class="about-gate-grid" aria-label="Argomenti about" data-node-id="381:155">
        <button class="about-gate-section" type="button" data-node-id="381:277" onclick={openAboutProject}>
          <span class="about-gate-utensil about-gate-fork" aria-hidden="true">
            <img src="/assets/about-gate-fork.svg" alt="" draggable="false" />
          </span>
          <span class="about-gate-title">Progetto</span>
          <span class="about-gate-subtitle">Concept e team</span>
          <span class="about-gate-utensil about-gate-knife" aria-hidden="true">
            <img src="/assets/about-gate-knife.svg" alt="" draggable="false" />
          </span>
        </button>
        <a class="about-gate-section" href="/interviste" data-node-id="381:308">
          <span class="about-gate-utensil about-gate-fork" aria-hidden="true">
            <img src="/assets/about-gate-fork.svg" alt="" draggable="false" />
          </span>
          <span class="about-gate-title">Interviste</span>
          <span class="about-gate-subtitle">Archivio dei contenuti</span>
          <span class="about-gate-utensil about-gate-knife" aria-hidden="true">
            <img src="/assets/about-gate-knife.svg" alt="" draggable="false" />
          </span>
        </a>
      </div>
    {:else if aboutView === 'project'}
      <section
        bind:this={aboutProjectEl}
        class="about-project"
        class:is-team-visible={isAboutProjectTeamVisible}
        aria-labelledby="about-project-title"
        onscroll={handleProjectScroll}
        onwheel={handleProjectWheel}
      >
        <h3 id="about-project-title" class="visually-hidden">Progetto Fuorimenù</h3>
        <div class="about-project-track">
          <section class="about-project-slide about-project-copy-slide" aria-label="Introduzione al progetto">
            <div class="about-project-intro" data-node-id="541:1585">
              <div class="about-project-intro-copy">
                <h3>Progetto</h3>
                <p>
                  Questo progetto digitale, nato al Politecnico di Milano, raccoglie le testimonianze di chef
                  e addetti alla ristorazione che hanno lavorato dietro le quinte di Milano Cortina 2026.
                  L'obiettivo è mostrare, attraverso un'esperienza immersiva, come la tradizione culinaria
                  italiana abbia supportato le performance degli atleti durante i Giochi Olimpici.
                </p>
              </div>
              <img
                class="about-project-politecnico"
                src="/assets/about/politecnico-project.png"
                alt="Politecnico Milano 1863"
                draggable="false"
              />
            </div>
            <div class="about-project-scroll-cue" data-node-id="541:1675">
              <span>Scorri per vedere il team</span>
              <svg class="brand-scroll-arrow about-project-scroll-arrow" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 5v12M7 12l5 5 5-5" />
              </svg>
            </div>
          </section>
          <section class="about-project-slide about-project-team-slide" aria-label="Team Fuorimenù">
            <div bind:this={aboutProjectPhaserEl} class="about-project-phaser" aria-hidden="true"></div>
            <div class="about-project-team-grid" aria-label="Contatti team Fuorimenù">
              {#each aboutProjectTeamContacts as contact}
                <div class="about-project-team-slot">
                  <span class="about-project-team-name" data-node-id="495:3056">
                    <span>{contact.firstName}</span>
                    <span>{contact.lastName}</span>
                  </span>
                  <span class="about-project-team-links" data-node-id="495:3612">
                    <a
                      class="about-project-team-link about-project-team-link-instagram"
                      href={contact.instagramUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Instagram di ${contact.firstName} ${contact.lastName}`}
                      data-node-id="495:3087"
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <rect x="5" y="5" width="14" height="14" rx="3.4" />
                        <circle cx="12" cy="12" r="3.1" />
                        <circle class="about-project-team-icon-dot" cx="16.1" cy="7.9" r="0.8" />
                      </svg>
                    </a>
                    <button
                      class="about-project-team-link about-project-team-link-email"
                      type="button"
                      aria-label={copiedAboutProjectEmail === contact.email
                        ? `Email di ${contact.firstName} ${contact.lastName} copiata`
                        : `Copia email di ${contact.firstName} ${contact.lastName}`}
                      title={contact.email}
                      data-node-id="495:3133"
                      onclick={() => void copyAboutProjectEmail(contact)}
                    >
                      <svg viewBox="0 0 34 24" aria-hidden="true">
                        <rect x="2.2" y="3.4" width="29.6" height="17.2" rx="0.6" />
                        <path d="M3.4 4.4L17 14.2L30.6 4.4" />
                        <path d="M3.5 19.6L13.2 11.5" />
                        <path d="M30.5 19.6L20.8 11.5" />
                      </svg>
                      {#if copiedAboutProjectEmail === contact.email}
                        {#key aboutProjectEmailCopyNonce}
                          <span class="about-project-email-copy-popover" aria-hidden="true">Copiato!</span>
                        {/key}
                      {/if}
                    </button>
                  </span>
                </div>
              {/each}
            </div>
            <span class="visually-hidden" aria-live="polite">
              {#if copiedAboutProjectEmail}
                Email copiata negli appunti
              {/if}
            </span>
          </section>
        </div>
      </section>
    {:else if aboutView === 'interview'}
      {#if activeInterviewDetail && activeFullInterviewContent}
        <section class="about-full-interview" aria-labelledby="about-full-interview-title" data-node-id="495:1374">
          <button
            class="about-full-interview-back"
            type="button"
            aria-label={`Torna al dettaglio intervista di ${activeInterviewDetail.name}`}
            onclick={returnToInterviewDetail}
          >
            <span class="about-full-interview-back-icon" aria-hidden="true">
              <svg class="figma-arrow-icon" viewBox="0 0 24 24" data-node-id="1:1353">
                <path d="M19 12H5M11 6L5 12L11 18" />
              </svg>
            </span>
          </button>
          <div class="about-full-interview-portrait" aria-hidden="true">
            <img src={activeInterviewDetail.portraitSrc} alt="" draggable="false" />
          </div>
          <article class="about-full-interview-copy">
            <div class="about-full-interview-scroll-frame">
              <div
                bind:this={fullInterviewScrollEl}
                class="about-full-interview-scroll"
                onscroll={updateFullInterviewScrollbar}
                onwheel={handleFullInterviewTranscriptWheel}
              >
                <header
                  class="about-full-interview-header"
                  class:is-stefano={activeInterviewDetail.name === 'Stefano Paganini'}
                >
                  <h3 id="about-full-interview-title" data-node-id="495:1427">{activeInterviewDetail.name}</h3>
                  <p data-node-id="495:1428">{activeInterviewDetail.role}</p>
                </header>
                <p class="about-full-interview-quote" data-node-id="495:1430">
                  {activeFullInterviewContent.quote}
                </p>
                <div class="about-full-interview-transcript" data-node-id="495:1432">
                  {#each activeFullInterviewContent.transcript as section}
                    <section class="about-full-interview-transcript-section">
                      <p class="about-full-interview-question"><strong><em>{section.question}</em></strong></p>
                      <p>{section.answer}</p>
                    </section>
                  {/each}
                </div>
              </div>
              <div class="about-full-interview-scrollbar" aria-hidden="true">
                <span style={fullInterviewScrollbarThumbStyle}></span>
              </div>
            </div>
          </article>
          {#if activeInterviewDetail.name === 'Stefano Paganini'}
            <button
              class="paganini-video-button"
              type="button"
              aria-label="Guarda l’intervista di Stefano Paganini"
              data-node-id="5355:17123"
            >
              <span class="paganini-video-button-label">Video</span>
              <span class="paganini-video-button-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" focusable="false">
                  <path d="M9 6.8L17 12L9 17.2V6.8Z" />
                </svg>
              </span>
            </button>
          {/if}
        </section>
      {/if}
    {:else}
      <section
        class="about-interviews"
        aria-labelledby={activeInterviewDetail ? 'about-interview-detail-title' : 'about-interviews-title'}
        data-node-id="381:464"
        onwheel={handleInterviewsWheel}
      >
        <div class="about-interviews-rail" aria-label="Interviste agli chef">
          <div class="about-interviews-list">
            {#each interviewChefs as chef (chef.name)}
              <button
                class="interview-mini-card"
                type="button"
                aria-label={`Apri intervista ${chef.number}: ${chef.name}`}
                aria-current={activeInterviewName === chef.name ? 'true' : undefined}
                style={`--interview-name-width:${chef.nameHeight}px;--interview-face-width:${chef.faceWidth}px;--interview-face-height:${chef.faceHeight}px;--interview-portrait-src:url("${chef.portraitSrc}");--interview-portrait-scale:${chef.portraitScale ?? 1};--interview-portrait-y:${chef.portraitY ?? 0}px;`}
                onclick={() => openInterviewDetail(chef)}
              >
                <span class="interview-face" aria-hidden="true">
                  <img src={chef.portraitSrc} alt="" draggable="false" />
                </span>
                <span class="interview-mini-name">{chef.name}</span>
                <span class="interview-mini-number">{chef.number}</span>
              </button>
            {/each}
          </div>
          {#if activeInterviewDetail}
            {#key activeInterviewDetail.name}
              <section
                class="about-interview-detail"
                aria-labelledby="about-interview-detail-title"
                data-node-id="428:16941"
              >
                <div class="about-interview-detail-portrait" aria-hidden="true" data-node-id="428:16953">
                  <img
                    src={activeInterviewDetail.portraitSrc}
                    alt=""
                    draggable="false"
                    style={`--detail-portrait-x:${activeInterviewDetail.portraitX ?? 0}px;--detail-portrait-y:${activeInterviewDetail.portraitY ?? 0}px;--detail-portrait-height:${activeInterviewDetail.portraitHeight ?? 614}px;`}
                  />
                </div>
                <div class="about-interview-detail-content" data-node-id="428:17268">
                  <h3
                    id="about-interview-detail-title"
                    class="about-interview-detail-name"
                    data-node-id="428:16942"
                    style={`--detail-first-name-x:${activeInterviewDetail.firstNameX ?? 71}px;--detail-last-name-x:${activeInterviewDetail.lastNameX ?? 0}px;`}
                  >
                    <span class="about-interview-detail-first" data-node-id="428:16943">{activeInterviewDetail.firstName}</span>
                    <span class="about-interview-detail-last" data-node-id="428:16944">{activeInterviewDetail.lastName}</span>
                  </h3>
                  <div class="about-interview-detail-card-text" data-node-id="428:16945">
                    <p class="about-interview-detail-role" data-node-id="428:16947">
                      {activeInterviewDetail.role}
                    </p>
                    <div class="about-interview-detail-info-and-button" data-node-id="428:16948">
                      <p class="about-interview-detail-description" data-node-id="428:16951">
                        {activeInterviewDetail.description}
                      </p>
                      <button
                        class="about-interview-detail-cta"
                        type="button"
                        aria-label={`Vai all’intervista di ${activeInterviewDetail.name}`}
                        onclick={openFullInterview}
                      >
                        <span class="about-interview-detail-cta-content">
                          <span>Vai all’intervista</span>
                          <span class="about-interview-detail-cta-icon" aria-hidden="true">
                            <svg class="figma-arrow-icon figma-arrow-icon-forward" viewBox="0 0 24 24" data-node-id="1:1353">
                              <path d="M19 12H5M11 6L5 12L11 18" />
                            </svg>
                          </span>
                        </span>
                      </button>
                </div>
              </div>
            </div>
              </section>
            {/key}
          {:else}
            <div class="about-interviews-copy" data-node-id="381:2073">
              <div class="about-interviews-copy-inner">
                <h3 id="about-interviews-title">INTERVISTE</h3>
                <p>
                  Qui troverai le 7 interviste complete:<br />
                  le 5 con audio presenti nelle altre<br />
                  pagine, più altre 2 testimonianze<br />
                  aggiuntive esclusivamente scritte.
                </p>
              </div>
            </div>
          {/if}
        </div>
      </section>
    {/if}
  </section>
{/if}


<style>
  :global(:root) {
    --home-scroll-cue-bottom: clamp(40px, 10svh, 96px);
  }

  .svg-filter-defs {
    position: absolute;
    width: 0;
    height: 0;
    overflow: hidden;
    pointer-events: none;
  }

  :global(html), :global(body) {
    width: 100%; height: 100%;
    margin: 0; overflow: hidden;
    background: var(--color-surface-page);
    cursor: url('/cursors/retrogusto-cursor.svg') 5 5, auto;
    overscroll-behavior: none;
  }
  :global(button), :global(a) {
    font: inherit;
    cursor: url('/cursors/retrogusto-pointer-on-cream.svg?v=3') 4 3, pointer;
  }

  .audio-gate {
    --audio-gate-orbit-size: min(calc(100vw - 48px), calc(var(--app-viewport-height) - 48px), 634px);

    position: fixed;
    z-index: 100;
    inset: 0;
    overflow: hidden;
    background: var(--color-text-primary);
    color: var(--color-text-inverse);
    cursor: url('/cursors/retrogusto-cursor-light.svg') 5 5, auto;
    opacity: 1;
  }

  .audio-gate.is-opening {
    pointer-events: none;
  }

  .audio-gate-content {
    position: absolute;
    z-index: 2;
    top: 50%;
    left: 50%;
    width: var(--audio-gate-orbit-size);
    aspect-ratio: 1;
    transform: translate(-50%, -50%);
  }

  .audio-gate-utensils {
    position: absolute;
    z-index: 1;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
  }

  .audio-gate-utensil {
    --tool-angle: 0deg;
    --tool-start-angle: 0deg;
    --tool-shake-angle-a: 2.8deg;
    --tool-shake-angle-b: -2deg;
    --tool-idle-angle: 0.9deg;

    position: absolute;
    top: 18.8svh;
    left: calc((100vw - var(--audio-gate-orbit-size)) / 4);
    width: clamp(86px, 12vw, 174px);
    height: min(149svh, 890px);
    transform: translate3d(-50%, 118svh, 0) rotate(var(--tool-start-angle));
    transform-origin: 50% 90%;
    will-change: transform, opacity;
    animation: audioGateUtensilRise 980ms cubic-bezier(0.16, 1, 0.3, 1) var(--utensil-rise-delay, 0ms) both;
  }

  .audio-gate-utensil img {
    display: block;
    width: 100%;
    height: 100%;
    user-select: none;
    transform-origin: 50% 90%;
    will-change: transform;
    animation:
      audioGateUtensilShake 620ms cubic-bezier(0.34, 1.56, 0.64, 1) var(--utensil-shake-delay, 760ms) both,
      audioGateUtensilIdle 3.2s ease-in-out var(--utensil-idle-delay, 1.22s) infinite;
  }

  .audio-gate-fork {
    --tool-angle: -0.8deg;
    --tool-start-angle: -4deg;
    --tool-shake-angle-a: -3deg;
    --tool-shake-angle-b: 2deg;
  }

  .audio-gate-knife {
    --tool-angle: 0.7deg;
    --tool-start-angle: 4deg;
    --tool-shake-angle-a: 2.5deg;
    --tool-shake-angle-b: -1.8deg;
    --tool-idle-angle: -1.3deg;

    top: 15.9svh;
    left: calc(100vw - ((100vw - var(--audio-gate-orbit-size)) / 4));
    width: clamp(68px, 9.4vw, 134px);
    height: min(178svh, 1068px);
    animation-delay: calc(var(--utensil-rise-delay, 0ms) + 80ms);
  }

  @keyframes audioGateUtensilRise {
    0% {
      transform: translate3d(-50%, 118svh, 0) rotate(var(--tool-start-angle));
    }

    76% {
      transform: translate3d(-50%, -10px, 0) rotate(calc(var(--tool-angle) - 1.2deg));
    }

    100% {
      transform: translate3d(-50%, 0, 0) rotate(var(--tool-angle));
    }
  }

  @keyframes audioGateUtensilShake {
    0%,
    100% {
      transform: translate3d(0, 0, 0) rotate(0deg);
    }

    22% {
      transform: translate3d(-4px, 1px, 0) rotate(var(--tool-shake-angle-a));
    }

    48% {
      transform: translate3d(3px, -1px, 0) rotate(var(--tool-shake-angle-b));
    }

    72% {
      transform: translate3d(-2px, 0, 0) rotate(calc(var(--tool-shake-angle-a) * 0.44));
    }
  }

  @keyframes audioGateUtensilIdle {
    0%,
    100% {
      transform: translate3d(0, 0, 0) rotate(0deg);
    }

    48% {
      transform: translate3d(0, -8px, 0) rotate(calc(var(--tool-idle-angle) * 1.35));
    }
  }

  .audio-gate-orbit {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    left: 0;
    border-radius: 50%;
    background: var(--color-text-primary);
    opacity: 1;
    transition: opacity 240ms ease, transform 760ms cubic-bezier(0.84, 0, 0.16, 1);
    will-change: transform, opacity;
  }

  .audio-gate-orbit-line {
    position: absolute;
    inset: 0;
    display: block;
    width: 100%;
    height: 100%;
    overflow: visible;
    transform: rotate(0deg);
    transform-origin: center;
    animation: audioGateOrbitSpin 56s linear 1.15s infinite;
  }

  .audio-gate-orbit-dot {
    fill: var(--color-text-inverse);
    opacity: 0;
    animation: audioGateDotIn 420ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
    animation-delay: var(--orbit-dot-delay, 0ms);
  }

  @keyframes audioGateDotIn {
    to {
      opacity: 1;
    }
  }

  @keyframes audioGateOrbitSpin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .audio-gate-orbit-line {
      animation: none;
    }

    .audio-gate-orbit-dot {
      animation: none;
      opacity: 1;
    }

    .audio-gate-copy-letter {
      opacity: 1;
      transform: none;
    }

    .audio-gate-utensil {
      animation: none;
      transform: translateX(-50%) rotate(var(--tool-angle));
    }

    .audio-gate-utensil img {
      animation: none;
      transform: rotate(0deg);
    }
  }

  .audio-gate-stack {
    position: absolute;
    inset: 0;
    z-index: 3;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: clamp(var(--spacing-7), 5.8vw, var(--spacing-10));
    padding: 12%;
    transition: opacity 180ms ease, transform 180ms ease;
  }

  .audio-gate-audio-button-frame,
  .audio-gate-button-frame {
    --button-depth-x: 0px;
    --button-depth-y: 8px;
    --audio-gate-button-depth-bg: var(--color-surface-page);
    --audio-gate-button-depth-border: var(--color-surface-page);

    position: relative;
    perspective: 900px;
    perspective-origin: 50% 50%;
  }

  .audio-gate-audio-button-frame {
    width: 56px;
    height: 56px;
  }

  .audio-gate-audio-button-frame::before {
    position: absolute;
    inset: 0;
    border: 2px solid var(--audio-gate-button-depth-border);
    border-radius: var(--radius-full);
    background: var(--audio-gate-button-depth-bg);
    content: '';
    opacity: 0;
    transition: opacity 90ms ease;
  }

  .audio-gate .audio-gate-audio-button {
    --button-hover-scale: 1;
    --button-lift-x: 0px;
    --button-lift-y: 0px;

    position: relative;
    width: 100%;
    height: 100%;
    border: 2px solid var(--audio-gate-button-depth-border);
    border-radius: var(--radius-full);
    color: var(--color-text-inverse);
    background: var(--color-text-primary);
    cursor: url('/cursors/retrogusto-pointer-on-dark.svg?v=3') 4 3, pointer;
    transform:
      translate(var(--button-lift-x), var(--button-lift-y))
      scale(var(--button-hover-scale));
    transition:
      background-color 160ms ease,
      border-color 160ms ease,
      color 160ms ease,
      transform 180ms cubic-bezier(0.22, 1, 0.36, 1);
    will-change: transform;
  }

  .audio-gate .audio-gate-audio-button:hover,
  .audio-gate .audio-gate-audio-button:focus-visible {
    --button-lift-x: 0px;
    --button-lift-y: calc(var(--button-depth-y) * -1);
    --button-hover-scale: 1;

    color: var(--color-text-primary);
    border-color: var(--color-text-primary);
    background: var(--color-text-inverse);
    opacity: 1;
  }

  .audio-gate-audio-button-frame:hover::before,
  .audio-gate-audio-button-frame:has(.audio-gate-audio-button:focus-visible)::before {
    opacity: 1;
  }

  .audio-gate .audio-gate-audio-button:active {
    --button-lift-x: 0px;
    --button-lift-y: 0px;
    --button-hover-scale: 1;
  }

  .audio-gate .audio-gate-audio-button:focus-visible {
    outline: 2px solid var(--color-text-inverse);
    outline-offset: var(--unit-4);
  }

  .audio-gate-content p {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    row-gap: 0;
    width: max-content;
    max-width: min(calc(100vw - 64px), 570px);
    margin: 0;
    color: var(--color-text-inverse);
    font-family: var(--font-text);
    font-size: 16px;
    font-weight: 400;
    line-height: 1.4;
    text-align: center;
    white-space: normal;
    overflow-wrap: anywhere;
  }

  .audio-gate-copy-word {
    display: inline-flex;
    white-space: nowrap;
  }

  .audio-gate-copy-space {
    display: inline-block;
    width: 0.58em;
  }

  .audio-gate-copy-letter {
    display: inline-block;
    opacity: var(--gate-copy-letter-reveal, 0);
    transform: translateY(var(--gate-copy-reveal-y, 12px));
    will-change: opacity, transform;
  }

  .audio-gate-button-frame {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    width: clamp(144px, 17vw, 173px);
    aspect-ratio: 173 / 68;
  }

  .audio-gate-button-frame::before {
    position: absolute;
    inset: 0;
    border: 2px solid var(--color-text-inverse);
    border-radius: var(--radius-full);
    background: var(--audio-gate-button-depth-bg);
    content: '';
    opacity: 0;
    transition: opacity 90ms ease;
  }

  .audio-gate-button {
    --gate-button-screen-scale: 18;

    position: relative;
    overflow: hidden;
    display: grid;
    width: 100%;
    height: 100%;
    place-items: center;
    padding: 0;
    border: 2px solid var(--color-text-inverse);
    border-radius: var(--radius-full);
    color: var(--color-text-inverse);
    background: var(--color-text-primary);
    box-shadow: none;
    cursor: url('/cursors/retrogusto-pointer-on-dark.svg?v=3') 4 3, pointer;
    transform:
      translate(var(--button-lift-x, 0px), var(--button-lift-y, 0px))
      scale(var(--button-hover-scale, 1));
    transition:
      background-color 160ms ease,
      border-color 160ms ease,
      color 160ms ease,
      transform 180ms cubic-bezier(0.22, 1, 0.36, 1);
    will-change: transform;
  }

  .audio-gate-button-label {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-text-inverse);
    font-family: var(--font-text);
    font-size: 16px;
    font-weight: 800;
    line-height: normal;
    white-space: nowrap;
  }

  .audio-gate-button:hover,
  .audio-gate-button:focus-visible {
    --button-lift-x: 0px;
    --button-lift-y: calc(var(--button-depth-y) * -1);
    --button-hover-scale: 1;
    border-color: var(--color-text-primary);
    background: var(--color-text-inverse);
    color: var(--color-text-primary);
    box-shadow: none;
  }

  .audio-gate-button-frame:hover::before,
  .audio-gate-button-frame:has(.audio-gate-button:focus-visible)::before {
    opacity: 1;
  }

  .audio-gate-button:active {
    --button-lift-x: 0px;
    --button-lift-y: 0px;
    --button-hover-scale: 1;
  }

  .audio-gate-button:hover .audio-gate-button-label,
  .audio-gate-button:focus-visible .audio-gate-button-label {
    color: currentColor;
  }

  .audio-gate-button:focus-visible {
    outline: 2px solid var(--color-text-inverse);
    outline-offset: var(--unit-4);
  }

  .audio-gate-audio-button-frame:has(.audio-gate-press-control)::before,
  .audio-gate-button-frame:has(.audio-gate-press-control)::before {
    display: none;
  }

  .audio-gate-press-control {
    --press-ring-opacity: 0;
    --press-ring-inner-size: 0px;
    --press-content-scale: 1;
    --button-lift-x: 0px;
    --button-lift-y: 0px;

    isolation: isolate;
  }

  .audio-gate .audio-gate-audio-button.audio-gate-press-control,
  .audio-gate-button.audio-gate-press-control {
    box-sizing: border-box;
    border-color: transparent;
    background: transparent;
    color: var(--color-text-inverse);
    transform: none;
  }

  .audio-gate .audio-gate-audio-button.audio-gate-press-control {
    width: 56px;
    height: 56px;
  }

  .audio-gate-press-control::after {
    position: absolute;
    z-index: 1;
    inset: 0;
    border: 2px solid currentColor;
    border-radius: var(--radius-full);
    background: transparent;
    box-shadow: inset 0 0 0 var(--press-ring-inner-size) currentColor;
    content: '';
    opacity: var(--press-ring-opacity);
    pointer-events: none;
    transition:
      border-color 160ms ease,
      box-shadow 170ms cubic-bezier(0.22, 1, 0.36, 1),
      opacity 120ms ease;
  }

  .audio-gate-audio-button.audio-gate-press-control :global(.volume-icon),
  .audio-gate-button.audio-gate-press-control .audio-gate-button-label {
    position: relative;
    z-index: 2;
    transform: scale(var(--press-content-scale));
    transition:
      color 160ms ease,
      transform 170ms cubic-bezier(0.22, 1, 0.36, 1);
  }

  .audio-gate .audio-gate-audio-button.audio-gate-press-control:hover,
  .audio-gate .audio-gate-audio-button.audio-gate-press-control:focus-visible,
  .audio-gate-button.audio-gate-press-control:hover,
  .audio-gate-button.audio-gate-press-control:focus-visible {
    --button-lift-x: 0px;
    --button-lift-y: 0px;
    --press-ring-opacity: 1;

    border-color: transparent;
    background: transparent;
    color: var(--color-text-inverse);
  }

  .audio-gate-press-control:active {
    --button-lift-x: 0px;
    --button-lift-y: 0px;
    --press-ring-opacity: 1;
    --press-ring-inner-size: 5px;
    --press-content-scale: 0.83;
  }

  .audio-gate.is-opening .audio-gate-orbit {
    transform: scale(1.02);
  }

  .audio-gate.is-opening .audio-gate-utensil {
    opacity: 0;
    animation: none;
    transform: translate3d(-50%, 26px, 0) rotate(var(--tool-angle));
    transition:
      opacity 220ms ease,
      transform 280ms ease;
  }

  .audio-gate.is-opening .audio-gate-utensil img {
    animation: none;
  }

  .audio-gate.is-opening .audio-gate-orbit-line {
    animation-play-state: paused;
  }

  .audio-gate.is-opening .audio-gate-orbit-dot {
    opacity: 1;
    animation: audioGateDotOut 220ms cubic-bezier(0.65, 0, 0.35, 1) forwards;
    animation-delay: calc(var(--orbit-dot-index, 0) * 8ms);
  }

  @keyframes audioGateDotOut {
    to {
      opacity: 0;
    }
  }

  .audio-gate.is-opening .audio-gate-audio-button-frame,
  .audio-gate.is-opening .audio-gate-content p {
    opacity: 0;
    transform: translateY(-6px);
    transition:
      opacity 180ms ease,
      transform 180ms ease;
  }

  .audio-gate.is-opening .audio-gate-button-frame::before {
    opacity: 0;
  }

  .audio-gate.is-opening .audio-gate-button-frame {
    z-index: 5;
  }

  .audio-gate.is-opening .audio-gate-button {
    border-color: var(--color-surface-page);
    border-radius: var(--radius-full);
    background: var(--color-surface-page);
    color: transparent;
    transform: scale(1);
    animation: audioGateButtonExpand 860ms cubic-bezier(0.84, 0, 0.16, 1) 760ms forwards;
  }

  .audio-gate.is-opening .audio-gate-button-label {
    opacity: 0;
  }

  .audio-gate.is-opening .audio-gate-press-control::after {
    opacity: 0;
  }

  @keyframes audioGateButtonExpand {
    to {
      border-radius: 0;
      transform: scale(var(--gate-button-screen-scale));
    }
  }

  .home {
    position: fixed; inset: 0;
    width: 100%; height: var(--app-viewport-height); overflow: hidden;
    background: var(--color-surface-page); color: var(--color-text-primary);
    transform: translateY(var(--page-y, 0));
    transition: transform 160ms ease-out;
    will-change: transform;
  }

  .logo {
    color: var(--color-content-primary);
    font-family: var(--font-display);
    font-size: 24px;
    font-weight: 700;
    line-height: 1;
    text-decoration: none;
    transition: color 160ms ease;
  }

  .top-bar-audio { justify-self: center; }
  .top-bar-menu { justify-self: end; }

  .top-bar-audio-slot {
    display: block;
    width: var(--button-icon-size);
    height: var(--button-icon-size);
  }

  .persistent-top-audio {
    position: fixed;
    z-index: 60;
    top: var(--spacing-7);
    left: 50%;
    transform: translateX(-50%) translate(var(--button-lift-x, 0px), var(--button-lift-y, 0px));
  }

  .roles-top-bar a {
    color: var(--color-interactive-primary);
    font-family: var(--font-display);
    font-weight: 400; text-decoration: none;
  }

  .icon-button {
    display: grid; width: var(--button-icon-size); height: var(--button-icon-size); place-items: center;
    padding: 0; color: var(--color-interactive-primary);
    background: transparent; border: 0; cursor: url('/cursors/retrogusto-pointer-on-cream.svg?v=3') 4 3, pointer;
    transition: color 160ms ease, opacity 0.2s ease;
  }

  .roles-top-bar .logo,
  .roles-top-bar .icon-button,
  .about-top-bar .logo,
  .about-top-bar .icon-button,
  .persistent-top-audio {
    --button-depth-x: 0px;
    --button-depth-y: 6px;
    --button-lift-x: 0px;
    --button-lift-y: 0px;
    --button-hover-scale: 1;
    --topbar-lift-ease: cubic-bezier(0.18, 1.35, 0.28, 1);
    --topbar-control-bg: var(--color-surface-page);
    --topbar-control-fg: var(--color-text-primary);
    --topbar-control-hover-bg: var(--color-surface-page);
    --topbar-control-hover-fg: var(--color-text-primary);
    --topbar-control-depth: var(--color-text-primary);

    position: relative;
    display: grid;
    width: 56px;
    height: 56px;
    place-items: center;
    box-sizing: border-box;
    border: 0;
    border-radius: var(--radius-full);
    color: var(--topbar-control-fg);
    background: transparent;
    isolation: isolate;
    transform: scale(var(--button-hover-scale));
    transition:
      color 160ms ease,
      transform 210ms var(--topbar-lift-ease),
      opacity 0.2s ease;
    will-change: transform;
  }

  .persistent-top-audio {
    transform:
      translateX(-50%)
      scale(var(--button-hover-scale));
  }

  .roles-top-bar .logo,
  .about-top-bar .logo {
    font-size: 24px;
    font-weight: 700;
  }

  .roles-top-bar .logo::before,
  .roles-top-bar .icon-button::before,
  .about-top-bar .logo::before,
  .about-top-bar .icon-button::before,
  .persistent-top-audio::before {
    position: absolute;
    z-index: 0;
    inset: 0;
    border: 2px solid var(--topbar-control-fg);
    border-radius: var(--radius-full);
    background: var(--topbar-control-depth);
    content: '';
    opacity: 0;
    transition: opacity 90ms ease;
  }

  .roles-top-bar .logo::after,
  .roles-top-bar .icon-button::after,
  .about-top-bar .logo::after,
  .about-top-bar .icon-button::after,
  .persistent-top-audio::after {
    position: absolute;
    z-index: 1;
    inset: 0;
    border: 2px solid var(--topbar-control-fg);
    border-radius: var(--radius-full);
    background: var(--topbar-control-bg);
    content: '';
    transform:
      translate(var(--button-lift-x), var(--button-lift-y));
    transition:
      background-color 160ms ease,
      border-color 160ms ease,
      transform 210ms var(--topbar-lift-ease);
  }

  .topbar-control-content {
    position: relative;
    z-index: 2;
    display: grid;
    place-items: center;
    color: currentColor;
    transform:
      translate(var(--button-lift-x), var(--button-lift-y));
    transition:
      color 160ms ease,
      transform 210ms var(--topbar-lift-ease);
    will-change: transform;
  }

  .roles-top-bar .logo:hover,
  .roles-top-bar .logo:focus-visible,
  .roles-top-bar .icon-button:hover,
  .roles-top-bar .icon-button:focus-visible,
  .about-top-bar .logo:hover,
  .about-top-bar .logo:focus-visible,
  .about-top-bar .icon-button:hover,
  .about-top-bar .icon-button:focus-visible,
  .persistent-top-audio:hover,
  .persistent-top-audio:focus-visible {
    --button-lift-x: 0px;
    --button-lift-y: calc(var(--button-depth-y) * -1);
    --button-hover-scale: 1;

    color: var(--topbar-control-hover-fg);
  }

  .roles-top-bar .logo:hover::after,
  .roles-top-bar .logo:focus-visible::after,
  .roles-top-bar .icon-button:hover::after,
  .roles-top-bar .icon-button:focus-visible::after,
  .about-top-bar .logo:hover::after,
  .about-top-bar .logo:focus-visible::after,
  .about-top-bar .icon-button:hover::after,
  .about-top-bar .icon-button:focus-visible::after,
  .persistent-top-audio:hover::after,
  .persistent-top-audio:focus-visible::after {
    border-color: var(--topbar-control-fg);
    background: var(--topbar-control-hover-bg);
  }

  .roles-top-bar .logo:hover::before,
  .roles-top-bar .logo:focus-visible::before,
  .roles-top-bar .icon-button:hover::before,
  .roles-top-bar .icon-button:focus-visible::before,
  .about-top-bar .logo:hover::before,
  .about-top-bar .logo:focus-visible::before,
  .about-top-bar .icon-button:hover::before,
  .about-top-bar .icon-button:focus-visible::before,
  .persistent-top-audio:hover::before,
  .persistent-top-audio:focus-visible::before {
    opacity: 1;
  }

  .roles-top-bar .logo:active,
  .roles-top-bar .icon-button:active,
  .about-top-bar .logo:active,
  .about-top-bar .icon-button:active,
  .persistent-top-audio:active {
    --button-lift-x: 0px;
    --button-lift-y: -1px;
    --button-hover-scale: 1;
  }

  .roles-top-bar .logo:active::before,
  .roles-top-bar .icon-button:active::before,
  .about-top-bar .logo:active::before,
  .about-top-bar .icon-button:active::before,
  .persistent-top-audio:active::before {
    opacity: 1;
  }

  .press-ring-control {
    --press-ring-opacity: 0;
    --press-ring-inner-size: 0px;
    --press-ring-y: 0px;
    --press-content-scale: 1;
    --button-lift-x: 0px;
    --button-lift-y: 0px;
  }

  .roles-top-bar .press-ring-control::before,
  .about-top-bar .press-ring-control::before,
  .persistent-top-audio.press-ring-control::before,
  .press-ring-control::before {
    display: none;
  }

  .roles-top-bar .press-ring-control::after,
  .about-top-bar .press-ring-control::after,
  .persistent-top-audio.press-ring-control::after,
  .press-ring-control::after {
    border-color: currentColor;
    background: transparent;
    box-shadow: inset 0 0 0 var(--press-ring-inner-size) currentColor;
    opacity: var(--press-ring-opacity);
    transform: translateY(var(--press-ring-y));
    transition:
      border-color 160ms ease,
      box-shadow 170ms cubic-bezier(0.22, 1, 0.36, 1),
      opacity 120ms ease;
  }

  .roles-top-bar .press-ring-control .topbar-control-content,
  .about-top-bar .press-ring-control .topbar-control-content,
  .persistent-top-audio.press-ring-control .topbar-control-content,
  .press-ring-control .topbar-control-content {
    transform: scale(var(--press-content-scale));
    transition:
      color 160ms ease,
      transform 170ms cubic-bezier(0.22, 1, 0.36, 1);
  }

  .roles-top-bar .press-ring-control:hover,
  .roles-top-bar .press-ring-control:focus-visible,
  .about-top-bar .press-ring-control:hover,
  .about-top-bar .press-ring-control:focus-visible,
  .persistent-top-audio.press-ring-control:hover,
  .persistent-top-audio.press-ring-control:focus-visible,
  .press-ring-control:hover,
  .press-ring-control:focus-visible {
    --button-lift-x: 0px;
    --button-lift-y: 0px;
    --press-ring-opacity: 1;
  }

  .roles-top-bar .press-ring-control:hover::after,
  .roles-top-bar .press-ring-control:focus-visible::after,
  .about-top-bar .press-ring-control:hover::after,
  .about-top-bar .press-ring-control:focus-visible::after,
  .persistent-top-audio.press-ring-control:hover::after,
  .persistent-top-audio.press-ring-control:focus-visible::after,
  .press-ring-control:hover::after,
  .press-ring-control:focus-visible::after {
    border-color: currentColor;
    background: transparent;
  }

  .roles-top-bar .press-ring-control:active,
  .about-top-bar .press-ring-control:active,
  .persistent-top-audio.press-ring-control:active,
  .press-ring-control:active {
    --button-lift-x: 0px;
    --button-lift-y: 0px;
    --press-ring-opacity: 1;
    --press-ring-inner-size: 5px;
    --press-content-scale: 0.83;
  }

  .press-ring-control:focus-visible {
    outline: 2px solid var(--color-focus-ring);
    outline-offset: 6px;
  }

  .logo:hover,
  .logo:focus-visible,
  .icon-button:hover,
  .icon-button:focus-visible { color: var(--color-interactive-hover); }

  .roles-top-bar .logo:hover,
  .roles-top-bar .logo:focus-visible,
  .roles-top-bar .icon-button:hover,
  .roles-top-bar .icon-button:focus-visible,
  .about-top-bar .logo:hover,
  .about-top-bar .logo:focus-visible,
  .about-top-bar .icon-button:hover,
  .about-top-bar .icon-button:focus-visible,
  .persistent-top-audio:hover,
  .persistent-top-audio:focus-visible {
    color: var(--topbar-control-fg);
  }
  .icon-button:hover         { opacity: 1; }
  .icon-button:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: var(--unit-4); }

  :global(.volume-icon) {
    width: 28px; height: 28px; fill: none; stroke: currentColor;
    stroke-linecap: round; stroke-linejoin: round; stroke-width: 2.2;
  }

  :global(.volume-max-icon) {
    stroke-width: 2.33333;
  }

  :global(.volume-slash) {
    stroke-width: 2.8;
  }

  .menu-icon, .menu-icon::before, .menu-icon::after {
    display: block; width: 18px; height: 2px;
    background: currentColor; border-radius: var(--radius-full);
  }
  .menu-icon          { position: relative; }
  .menu-icon::before,
  .menu-icon::after   { position: absolute; left: 0; content: ''; }
  .menu-icon::before  { top: -6px; }
  .menu-icon::after   { top:  6px; }

  .close-icon,
  .close-icon::before {
    display: block;
    width: 24px;
    height: 2.4px;
    background: currentColor;
    border-radius: var(--radius-full);
  }

  .close-icon {
    position: relative;
    transform: rotate(45deg);
  }

  .close-icon::before {
    position: absolute;
    left: 0;
    content: '';
    transform: rotate(90deg);
  }

  .top-bar-menu.press-ring-control .topbar-control-content {
    width: 24px;
    height: 24px;
  }

  .top-bar-menu.press-ring-control .menu-icon {
    width: 18px;
    height: 14px;
    background: linear-gradient(currentColor, currentColor) center / 18px 2px no-repeat;
  }

  .top-bar-menu.press-ring-control .menu-icon::before,
  .top-bar-menu.press-ring-control .menu-icon::after {
    width: 18px;
    height: 2px;
  }

  .top-bar-menu.press-ring-control .menu-icon::before {
    top: 0;
  }

  .top-bar-menu.press-ring-control .menu-icon::after {
    top: auto;
    bottom: 0;
  }

  .top-bar-menu.press-ring-control .close-icon {
    width: 24px;
    height: 24px;
    background: linear-gradient(currentColor, currentColor) center / 24px 2.4px no-repeat;
    transform: rotate(45deg);
  }

  .top-bar-menu.press-ring-control .close-icon::before {
    top: 50%;
    width: 24px;
    height: 2.4px;
    transform: translateY(-50%) rotate(90deg);
  }

  .about-screen {
    position: fixed;
    z-index: 80;
    inset: 0;
    overflow: hidden;
    background: var(--color-text-primary);
    color: var(--color-surface-page);
    transform-origin: right center;
    will-change: clip-path, transform;
  }

  .about-screen.is-project,
  .about-screen.is-interviews,
  .about-screen.is-full-interview {
    background: var(--color-surface-page);
    color: var(--color-text-primary);
  }

  .about-top-bar {
    position: absolute;
    z-index: 3;
    top: 0;
    left: 0;
    box-sizing: border-box;
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    width: 100%;
    height: 136px;
    padding: 0 var(--layout-page-gutter);
  }

  .about-top-bar .logo,
  .about-top-bar .icon-button {
    --topbar-control-bg: var(--color-text-primary);
    --topbar-control-fg: var(--color-surface-page);
    --topbar-control-hover-bg: var(--color-text-primary);
    --topbar-control-hover-fg: var(--color-surface-page);
    --topbar-control-depth: var(--color-surface-page);
  }

  .about-screen.is-project .about-top-bar .logo,
  .about-screen.is-project .about-top-bar .icon-button,
  .about-screen.is-interviews .about-top-bar .logo,
  .about-screen.is-interviews .about-top-bar .icon-button,
  .about-screen.is-full-interview .about-top-bar .logo,
  .about-screen.is-full-interview .about-top-bar .icon-button {
    --topbar-control-bg: var(--color-surface-page);
    --topbar-control-fg: var(--color-text-primary);
    --topbar-control-hover-bg: var(--color-surface-page);
    --topbar-control-hover-fg: var(--color-text-primary);
    --topbar-control-depth: var(--color-text-primary);
  }

  .about-logo {
    font-weight: 700;
  }

  .about-logo:hover,
  .about-logo:focus-visible,
  .about-audio:hover,
  .about-audio:focus-visible,
  .about-close:hover,
  .about-close:focus-visible {
    color: var(--color-surface-page);
  }

  .about-screen.is-project .about-logo:hover,
  .about-screen.is-project .about-logo:focus-visible,
  .about-screen.is-project .about-audio:hover,
  .about-screen.is-project .about-audio:focus-visible,
  .about-screen.is-project .about-close:hover,
  .about-screen.is-project .about-close:focus-visible,
  .about-screen.is-interviews .about-logo:hover,
  .about-screen.is-interviews .about-logo:focus-visible,
  .about-screen.is-interviews .about-audio:hover,
  .about-screen.is-interviews .about-audio:focus-visible,
  .about-screen.is-interviews .about-close:hover,
  .about-screen.is-interviews .about-close:focus-visible,
  .about-screen.is-full-interview .about-logo:hover,
  .about-screen.is-full-interview .about-logo:focus-visible,
  .about-screen.is-full-interview .about-audio:hover,
  .about-screen.is-full-interview .about-audio:focus-visible,
  .about-screen.is-full-interview .about-close:hover,
  .about-screen.is-full-interview .about-close:focus-visible {
    color: var(--color-text-primary);
  }

  .about-audio {
    justify-self: center;
  }

  .about-close {
    justify-self: end;
  }

  .about-gate-grid {
    position: absolute;
    inset: 136px 0 0;
    box-sizing: border-box;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    min-height: 0;
  }

  .about-gate-grid::after {
    position: absolute;
    z-index: 4;
    top: 0;
    bottom: 0;
    left: 50%;
    width: 2px;
    background: var(--color-surface-page);
    content: '';
    pointer-events: none;
    transform: translateX(-1px);
  }

  .about-gate-section {
    --about-word-width: clamp(330px, 66%, 500px);
    --about-section-stroke-top: 2px;
    --about-section-stroke-right: 0px;
    --about-section-stroke-bottom: 0px;
    --about-section-stroke-left: 0px;

    position: relative;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    min-width: 0;
    min-height: 0;
    padding: clamp(64px, 9vw, 128px) 28px;
    border: 0;
    background: transparent;
    color: var(--color-surface-page);
    text-align: center;
    text-decoration: none;
    cursor: url('/cursors/retrogusto-pointer-on-dark.svg?v=3') 4 3, pointer;
    isolation: isolate;
    overflow: hidden;
  }

  .about-gate-section[data-node-id='381:308'] {
    --about-word-width: clamp(372px, 74%, 558px);
    --about-section-stroke-right: 0px;
    --about-section-stroke-left: 0px;
  }

  .about-gate-section::before {
    position: absolute;
    inset: 0;
    z-index: -1;
    background: var(--brand-700);
    content: '';
    opacity: 0;
    transition:
      opacity 180ms ease,
      transform 260ms cubic-bezier(0.22, 1, 0.36, 1);
  }

  .about-gate-section::after {
    position: absolute;
    z-index: 3;
    inset: 0;
    border-color: var(--color-surface-page);
    border-style: solid;
    border-width:
      var(--about-section-stroke-top)
      var(--about-section-stroke-right)
      var(--about-section-stroke-bottom)
      var(--about-section-stroke-left);
    content: '';
    pointer-events: none;
  }

  .about-gate-section:hover::before,
  .about-gate-section:focus-visible::before {
    opacity: 1;
  }

  .about-gate-section:focus-visible {
    outline: 2px solid var(--color-surface-page);
    outline-offset: -10px;
  }

  .about-gate-title {
    position: relative;
    z-index: 2;
    display: block;
    max-width: 100%;
    color: currentColor;
    font-family: var(--font-display);
    font-size: clamp(52px, 6.35vw, 96px);
    font-weight: 700;
    line-height: 1.08;
    text-transform: lowercase;
    overflow-wrap: anywhere;
  }

  .about-gate-title::first-letter {
    text-transform: uppercase;
  }

  .about-gate-subtitle {
    position: relative;
    z-index: 2;
    display: block;
    color: currentColor;
    font-family: var(--font-text);
    font-size: clamp(16px, 1.58vw, 24px);
    font-weight: 400;
    line-height: 1.34;
  }

  .about-gate-utensil {
    position: absolute;
    z-index: 1;
    display: block;
    opacity: 0;
    user-select: none;
    pointer-events: none;
    transition:
      opacity 220ms ease,
      transform 560ms cubic-bezier(0.16, 1, 0.3, 1);
    will-change: opacity, transform;
  }

  .about-gate-utensil img {
    position: absolute;
    left: 50%;
    top: 50%;
    display: block;
    object-fit: contain;
    user-select: none;
    pointer-events: none;
  }

  .about-gate-fork {
    --about-utensil-length: clamp(470px, 52.5vw, 760px);

    top: clamp(50px, 8vh, 86px);
    left: calc(50% + var(--about-word-width) / 2);
    width: var(--about-utensil-length);
    height: calc(var(--about-utensil-length) * 150.086 / 844.959);
    transform: translate3d(-200%, 0, 0) scaleX(0.96);
    transform-origin: 100% 50%;
  }

  .about-gate-fork img {
    width: calc(var(--about-utensil-length) * 150.086 / 844.959);
    height: var(--about-utensil-length);
    transform:
      translate3d(-50%, -50%, 0)
      rotate(90deg);
  }

  .about-gate-knife {
    --about-utensil-length: clamp(532px, 57vw, 855px);

    left: calc(50% - var(--about-word-width) / 2);
    bottom: clamp(52px, 8vh, 88px);
    width: var(--about-utensil-length);
    height: calc(var(--about-utensil-length) * 134.155 / 1130.78);
    transform: translate3d(100%, 0, 0) scaleX(0.96);
    transform-origin: 0 50%;
  }

  .about-gate-knife img {
    width: calc(var(--about-utensil-length) * 134.155 / 1130.78);
    height: var(--about-utensil-length);
    transform:
      translate3d(-50%, -50%, 0)
      rotate(-90deg);
  }

  .about-gate-section:hover .about-gate-fork,
  .about-gate-section:focus-visible .about-gate-fork {
    opacity: 1;
    transform: translate3d(-100%, 0, 0) scaleX(0.96);
  }

  .about-gate-section:hover .about-gate-knife,
  .about-gate-section:focus-visible .about-gate-knife {
    opacity: 1;
    transform: translate3d(0, 0, 0) scaleX(0.96);
  }

  .about-project {
    position: absolute;
    inset: 136px 0 0;
    box-sizing: border-box;
    overflow-x: auto;
    overflow-y: hidden;
    background: var(--color-surface-page);
    color: var(--color-text-primary);
    scrollbar-width: none;
    scroll-snap-type: x mandatory;
    overscroll-behavior-x: contain;
  }

  .about-project::-webkit-scrollbar {
    display: none;
  }

  .about-project-track {
    position: relative;
    display: flex;
    width: 200%;
    min-width: 200%;
    height: 100%;
  }

  .about-project-slide {
    position: relative;
    box-sizing: border-box;
    display: flex;
    flex: 0 0 50%;
    width: 50%;
    height: 100%;
    padding: clamp(34px, 5svh, 62px) var(--layout-page-gutter);
    overflow: hidden;
    scroll-snap-align: start;
    scroll-snap-stop: always;
  }

  .about-project-copy-slide {
    --about-project-slide-padding-y: clamp(34px, 5svh, 62px);
    --about-project-title-size: clamp(68px, 8.2vw, 124px);
    --about-project-copy-gap: clamp(40px, 6svh, 102px);

    align-items: stretch;
    justify-content: flex-start;
  }

  .about-project-team-slide {
    align-items: center;
    justify-content: center;
    padding: 0;
    background: var(--color-surface-page);
    color: var(--color-text-primary);
  }

  .about-project-intro {
    position: relative;
    z-index: 2;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    height: 100%;
    width: clamp(340px, 47vw, 760px);
    color: var(--brand-500);
    pointer-events: none;
  }

  .about-project-intro-copy {
    display: flex;
    flex-direction: column;
    gap: var(--about-project-copy-gap);
    align-items: flex-start;
  }

  .about-project-intro h3 {
    margin: 0;
    color: var(--brand-500);
    font-family: var(--font-display);
    font-size: var(--about-project-title-size);
    font-weight: 700;
    line-height: 0.96;
    letter-spacing: 0;
  }

  .about-project-intro p {
    width: min(690px, 100%);
    margin: 0;
    color: var(--brand-500);
    font-family: var(--font-text);
    font-size: clamp(14px, 1.28vw, 19px);
    font-weight: 400;
    line-height: 1.34;
  }

  .about-project-politecnico {
    display: block;
    width: clamp(158px, 15.2vw, 230px);
    height: auto;
    user-select: none;
    pointer-events: none;
  }

  .about-project-scroll-cue {
    position: absolute;
    z-index: 4;
    top: calc(var(--about-project-slide-padding-y) + var(--about-project-title-size) * 0.96 + var(--about-project-copy-gap));
    right: var(--layout-page-gutter);
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 18px;
    max-width: min(360px, calc(50vw - var(--layout-page-gutter)));
    color: var(--brand-500);
    font-family: var(--font-text);
    font-size: clamp(15px, 1.32vw, 20px);
    font-weight: 400;
    line-height: 1.2;
    text-align: right;
    transform: translateY(-50%);
    transition:
      opacity 220ms ease,
      transform 220ms ease;
    pointer-events: none;
  }

  .about-project-scroll-arrow {
    flex: 0 0 auto;
    transform: rotate(-90deg);
  }

  .about-project.is-team-visible .about-project-scroll-cue {
    opacity: 0;
    transform: translate3d(0, -34%, 0);
  }

  .about-project-phaser {
    position: relative;
    width: 100%;
    height: 100%;
    opacity: 1;
  }

  :global(.about-project-phaser canvas) {
    position: absolute;
    inset: 0;
  }

  .about-project-team-grid {
    position: absolute;
    z-index: 6;
    left: max(var(--layout-page-gutter), 10vw);
    right: max(var(--layout-page-gutter), 10vw);
    top: clamp(28px, 5svh, 62px);
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: clamp(6px, 1.6vw, 28px);
    color: var(--brand-500);
  }

  .about-project-team-slot {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    gap: clamp(8px, 1.2vw, 16px);
    min-width: 0;
    color: var(--brand-500);
  }

  .about-project-team-label {
    position: absolute;
    z-index: 5;
    left: var(--team-label-x, 50%);
    top: var(--team-label-y, 24%);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    width: max-content;
    min-width: 112px;
    color: var(--brand-500);
    opacity: 0;
    visibility: hidden;
    transform: translate3d(-50%, -100%, 0);
    transition:
      opacity 180ms ease,
      visibility 180ms ease;
    pointer-events: none;
  }

  .about-project-team-label.is-visible {
    opacity: 1;
    visibility: visible;
    pointer-events: auto;
  }

  .about-project-team-name {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: var(--brand-500);
    font-family: var(--font-text);
    font-size: clamp(11px, 1.36vw, 19.55px);
    font-weight: 800;
    line-height: 1;
    letter-spacing: 0;
    text-align: center;
    word-break: break-word;
  }

  @media (max-width: 1180px) {
    .about-project-team-grid {
      left: max(var(--layout-page-gutter), 10vw);
      right: max(var(--layout-page-gutter), 10vw);
      top: 50%;
      transform: translateY(calc(-50% - 150px));
      gap: clamp(8px, 1.4vw, 18px);
    }

    .about-project-team-name {
      font-size: clamp(12px, 1.65vw, 18px);
    }
  }

  .about-project-team-links {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: clamp(7px, 1.3vw, 19px);
    color: var(--brand-500);
  }

  .about-project-team-link {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    text-decoration: none;
    cursor: url('/cursors/retrogusto-pointer-on-cream.svg?v=3') 4 3, pointer;
    transform: translateZ(0);
    transition: transform 130ms ease;
  }

  .about-project-team-link:hover,
  .about-project-team-link:focus-visible {
    transform: scale(1.08);
  }

  .about-project-team-link:active {
    transform: scale(0.94);
  }

  .about-project-team-link:focus-visible {
    outline: 2px solid currentColor;
    outline-offset: 4px;
  }

  .about-project-team-link-instagram {
    width: 22px;
    height: 22px;
  }

  .about-project-team-link-email {
    width: 26px;
    height: 19px;
  }

  .about-project-email-copy-popover {
    position: absolute;
    left: 50%;
    bottom: calc(100% + 9px);
    z-index: 8;
    padding: 5px 9px 6px;
    border-radius: 4px;
    background: var(--brand-500);
    color: var(--background-50);
    font-family: var(--font-text);
    font-size: clamp(10px, 0.85vw, 13px);
    font-style: italic;
    font-weight: 300;
    line-height: 1;
    letter-spacing: 0;
    white-space: nowrap;
    pointer-events: none;
    transform: translate3d(-50%, 4px, 0);
    opacity: 0;
    animation: aboutProjectEmailCopiedIn 1600ms ease both;
  }

  .about-project-email-copy-popover::after {
    content: '';
    position: absolute;
    left: 50%;
    top: 100%;
    width: 8px;
    height: 8px;
    background: inherit;
    transform: translate3d(-50%, -5px, 0) rotate(45deg);
  }

  .about-project-team-link svg {
    display: block;
    width: 100%;
    height: 100%;
    overflow: visible;
  }

  .about-project-team-link rect,
  .about-project-team-link path,
  .about-project-team-link circle {
    fill: none;
    stroke: currentColor;
    stroke-width: 1.85;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .about-project-team-link .about-project-team-icon-dot {
    fill: currentColor;
    stroke: none;
  }

  .about-screen.is-full-interview .about-top-bar {
    top: 0;
  }

  .about-full-interview {
    --about-full-text-left: clamp(420px, 39.68vw, 600px);
    --about-full-portrait-width: 271px;

    position: absolute;
    inset: 136px 0 0;
    box-sizing: border-box;
    overflow: hidden;
    border-top: 2px solid var(--color-text-primary);
    background: var(--color-surface-page);
    color: var(--color-text-primary);
    scrollbar-width: none;
  }

  .about-full-interview::-webkit-scrollbar {
    display: none;
  }

  .about-full-interview-back {
    position: absolute;
    top: 37px;
    left: 88px;
    z-index: 2;
    display: grid;
    width: 44px;
    height: 44px;
    place-items: center;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--color-text-primary);
    appearance: none;
  }

  .figma-arrow-icon {
    display: block;
    width: 24px;
    height: 24px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .figma-arrow-icon-forward {
    transform: rotate(180deg);
  }

  .about-full-interview-back-icon {
    display: grid;
    width: 24px;
    height: 24px;
    place-items: center;
  }

  .about-full-interview-back:hover,
  .about-full-interview-back:focus-visible {
    color: var(--color-text-primary);
  }

  .about-full-interview-back:focus-visible {
    outline: 2px solid var(--color-focus-ring);
    outline-offset: 6px;
  }

  .about-full-interview-portrait {
    position: absolute;
    top: 1px;
    left: max(24px, calc((var(--about-full-text-left) - var(--about-full-portrait-width)) / 2));
    width: var(--about-full-portrait-width);
    height: 737px;
    overflow: hidden;
    pointer-events: none;
    animation: fullInterviewChefIn 680ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  .about-full-interview-portrait img {
    position: absolute;
    top: 0;
    left: 0;
    display: block;
    width: auto;
    height: 614px;
    user-select: none;
  }

  .about-full-interview-copy {
    position: relative;
    box-sizing: border-box;
    width: min(682px, calc(100vw - var(--about-full-text-left) - 24px));
    min-height: 740px;
    margin-left: var(--about-full-text-left);
    padding: 37px 0 56px;
    animation: fullInterviewTextIn 620ms ease 180ms both;
  }

  .about-full-interview-header {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
  }

  .about-full-interview-header h3 {
    margin: 0;
    color: var(--color-text-primary);
    font-family: "Fasthand", cursive;
    font-size: 64px;
    font-weight: 400;
    line-height: 1.08;
  }

  .about-full-interview-header p {
    margin: -2px 0 0;
    color: var(--color-text-primary);
    font-family: var(--font-text);
    font-size: 20px;
    font-weight: 800;
    line-height: normal;
  }

  .about-full-interview-header.is-stefano p {
    margin-top: 8px;
  }

  .about-full-interview-scroll-frame {
    position: relative;
    width: min(630px, 100%);
    max-height: min(650px, calc(var(--app-viewport-height) - 214px));
    margin-top: 0;
  }

  .about-full-interview-scroll {
    box-sizing: border-box;
    width: 100%;
    max-height: inherit;
    padding: 0 34px 92px 0;
    overflow-x: hidden;
    overflow-y: scroll;
    overscroll-behavior: contain;
    scrollbar-width: none;
  }

  .about-full-interview-scroll::-webkit-scrollbar {
    display: none;
  }

  .about-full-interview-scrollbar {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    z-index: 2;
    width: 8px;
    box-sizing: border-box;
    overflow: hidden;
    border: 1px solid var(--color-text-primary);
    background: var(--color-surface-page);
    pointer-events: none;
  }

  .about-full-interview-scrollbar span {
    position: absolute;
    top: 0;
    left: 1px;
    width: 4px;
    min-height: 42px;
    box-sizing: border-box;
    background: var(--color-text-primary);
    will-change: transform, height;
  }

  .about-full-interview-quote {
    position: relative;
    width: min(641px, 100%);
    margin: 44px 0 0;
    padding: 0;
    color: #294485;
    font-family: var(--font-text);
    font-size: 24px;
    font-weight: 800;
    line-height: 1.6;
  }

  .about-full-interview-transcript {
    width: min(545px, 100%);
    margin-top: 26px;
    color: #294485;
    font-family: var(--font-text);
    font-size: 16px;
    font-weight: 400;
    line-height: normal;
  }

  .about-full-interview-transcript-section {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin: 0 0 16px;
  }

  .about-full-interview-transcript-section:last-child {
    margin-bottom: 0;
    padding-bottom: 16px;
  }

  .about-full-interview-transcript p {
    margin: 0;
  }

  .about-full-interview-question {
    padding-top: 1px;
  }

  .about-full-interview-transcript strong {
    font-weight: 800;
  }

  .about-full-interview-transcript em {
    font-style: italic;
  }

  .paganini-video-button {
    --paganini-video-front-y: 0px;
    --paganini-video-depth-y: 3px;
    --paganini-video-press-scale: 1;

    position: absolute;
    right: 80px;
    bottom: 46px;
    z-index: 4;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
    width: 142px;
    height: 58px;
    padding: 0 9px 0 19px;
    border: 0;
    border-radius: 47px;
    background: transparent;
    color: var(--color-surface-page);
    font-family: var(--font-text);
    font-size: 16px;
    font-weight: 800;
    line-height: normal;
    appearance: none;
    isolation: isolate;
    overflow: visible;
  }

  .paganini-video-button::before,
  .paganini-video-button::after {
    position: absolute;
    right: 0;
    left: 0;
    height: 58px;
    border-radius: 47px;
    content: '';
  }

  .paganini-video-button::before {
    display: none;
  }

  .paganini-video-button::after {
    z-index: 1;
    top: 0;
    background: #2a4385;
    transform:
      translateY(var(--paganini-video-front-y))
      scale(var(--paganini-video-press-scale));
    transition:
      background-color 160ms ease,
      transform 210ms cubic-bezier(0.18, 1.35, 0.28, 1);
    transform-origin: 50% 50%;
  }

  .paganini-video-button-label,
  .paganini-video-button-icon {
    position: relative;
    z-index: 2;
    transform:
      translateY(var(--paganini-video-front-y))
      scale(var(--paganini-video-press-scale));
    transition: transform 210ms cubic-bezier(0.18, 1.35, 0.28, 1);
  }

  .paganini-video-button-label {
    font-weight: 800;
    white-space: nowrap;
  }

  .paganini-video-button-icon {
    display: grid;
    flex: 0 0 auto;
    width: 38px;
    height: 38px;
    place-items: center;
    border-radius: var(--radius-full);
    background: var(--color-surface-page);
    color: var(--color-text-primary);
  }

  .paganini-video-button-icon svg {
    display: block;
    width: 24px;
    height: 24px;
    fill: currentColor;
  }

  @keyframes aboutProjectEmailCopiedIn {
    0% {
      opacity: 0;
      transform: translate3d(-50%, 6px, 0) scale(0.96);
    }
    12%,
    78% {
      opacity: 1;
      transform: translate3d(-50%, 0, 0) scale(1);
    }
    100% {
      opacity: 0;
      transform: translate3d(-50%, -4px, 0) scale(0.98);
    }
  }

  .paganini-video-button:hover,
  .paganini-video-button:focus-visible {
    --paganini-video-front-y: 0px;
  }

  .paganini-video-button:hover::before,
  .paganini-video-button:focus-visible::before,
  .paganini-video-button:active::before {
    opacity: 0;
  }

  .paganini-video-button:active {
    --paganini-video-front-y: 0px;
    --paganini-video-press-scale: 0.94;
  }

  .paganini-video-button:focus-visible {
    outline: 2px solid var(--color-focus-ring);
    outline-offset: 9px;
  }

  @keyframes fullInterviewChefIn {
    from {
      opacity: 0;
      transform: translate3d(-100vw, 0, 0);
    }
    to {
      opacity: 1;
      transform: translate3d(0, 0, 0);
    }
  }

  @keyframes fullInterviewTextIn {
    from {
      opacity: 0;
      transform: translate3d(0, 10px, 0);
    }
    to {
      opacity: 1;
      transform: translate3d(0, 0, 0);
    }
  }

  .about-interviews {
    position: absolute;
    inset: 136px 0 0;
    box-sizing: border-box;
    overflow-x: auto;
    overflow-y: hidden;
    color: var(--color-text-primary);
    scrollbar-width: none;
    overscroll-behavior-x: contain;
  }

  .about-interviews::-webkit-scrollbar {
    display: none;
  }

  .about-interviews-rail {
    position: relative;
    display: flex;
    align-items: stretch;
    width: 1512px;
    min-width: 1512px;
    height: 100%;
    min-height: 0;
  }

  .about-interviews-list,
  .about-interviews-copy {
    box-sizing: border-box;
    flex: 0 0 50%;
    width: 756px;
    min-width: 0;
    height: 100%;
    background: var(--color-surface-page);
  }

  .about-interviews-list {
    position: relative;
    display: grid;
    grid-template-rows: repeat(7, minmax(0, 1fr));
    border-right: 2px solid var(--color-text-primary);
  }

  .about-interviews-copy {
    display: flex;
    align-items: flex-start;
    padding: 0 80px;
    border-top: 2px solid var(--color-text-primary);
  }

  .about-interviews-copy-inner {
    display: flex;
    flex: 0 0 auto;
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
    width: 548px;
    height: fit-content;
    padding: 40px 0;
  }

  .about-interviews-copy h3 {
    width: 548px;
    margin: 0;
    color: var(--color-text-primary);
    font-family: var(--font-display);
    font-size: 96px;
    font-weight: 700;
    line-height: normal;
    text-align: left;
    overflow-wrap: anywhere;
  }

  .about-interviews-copy p {
    width: 509px;
    margin: 0;
    color: var(--color-text-primary);
    font-family: var(--font-text);
    font-size: 20px;
    font-weight: 400;
    line-height: normal;
  }

  .about-interview-detail {
    position: relative;
    box-sizing: border-box;
    flex: 0 0 756px;
    width: 756px;
    min-width: 0;
    height: 100%;
    overflow: hidden;
    border-top: 2px solid var(--color-text-primary);
    background: var(--color-surface-page);
    color: var(--color-text-primary);
  }

  .about-interview-detail-portrait {
    position: absolute;
    top: 1px;
    left: 0;
    width: 271px;
    height: 737px;
    overflow: hidden;
    pointer-events: none;
    animation: interviewChefIn 560ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  .about-interview-detail-portrait img {
    position: absolute;
    top: var(--detail-portrait-y, 0px);
    left: var(--detail-portrait-x, 0px);
    display: block;
    width: auto;
    height: var(--detail-portrait-height, 614px);
    user-select: none;
  }

  .about-interview-detail-content {
    position: absolute;
    top: 0;
    left: 272px;
    width: 484px;
    height: 738px;
  }

  .about-interview-detail-name {
    position: absolute;
    top: 0;
    left: 0;
    width: 484px;
    height: 277px;
    margin: 0;
    color: var(--color-text-primary);
    font-family: "Fasthand", cursive;
    font-size: 120px;
    font-weight: 400;
    line-height: normal;
    animation: interviewCopyIn 520ms cubic-bezier(0.16, 1, 0.3, 1) 80ms both;
  }

  .about-interview-detail-name span {
    position: absolute;
    display: block;
    margin: 0;
    white-space: nowrap;
  }

  .about-interview-detail-first {
    top: 0;
    left: var(--detail-first-name-x, 71px);
    width: 413px;
  }

  .about-interview-detail-last {
    top: 100px;
    left: var(--detail-last-name-x, 0px);
    width: 484px;
  }

  .about-interview-detail-card-text {
    position: absolute;
    top: 277px;
    left: 0;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
    width: 484px;
    height: 344px;
    padding: 56px 0;
    animation: interviewCopyIn 540ms cubic-bezier(0.16, 1, 0.3, 1) 160ms both;
  }

  @keyframes interviewChefIn {
    from {
      opacity: 0;
      transform: translate3d(-88px, 0, 0);
    }
    to {
      opacity: 1;
      transform: translate3d(0, 0, 0);
    }
  }

  @keyframes interviewCopyIn {
    from {
      opacity: 0;
      transform: translate3d(92px, 0, 0);
    }
    to {
      opacity: 1;
      transform: translate3d(0, 0, 0);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .about-full-interview-portrait,
    .about-full-interview-copy,
    .about-interview-detail-portrait,
    .about-interview-detail-name,
    .about-interview-detail-card-text {
      animation: none;
    }
  }

  .about-interview-detail-role {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    width: fit-content;
    height: 32px;
    margin: 0;
    color: var(--color-text-primary);
    font-family: var(--font-text);
    font-size: 24px;
    font-weight: 800;
    line-height: normal;
    white-space: nowrap;
  }

  .about-interview-detail-info-and-button {
    display: flex;
    flex: 0 0 auto;
    flex-direction: column;
    align-items: flex-start;
    gap: 24px;
    width: 383px;
    height: fit-content;
  }

  .about-interview-detail-description {
    display: block;
    flex: 0 0 auto;
    width: 372px;
    height: fit-content;
    margin: 0;
    color: var(--color-text-primary);
    font-family: var(--font-text);
    font-size: 16px;
    font-weight: 400;
    line-height: normal;
  }

  .about-interview-detail-cta {
    --interview-cta-front-y: 0px;
    --interview-cta-depth-y: 4px;
    --interview-cta-press-scale: 1;

    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    width: 244px;
    height: 40px;
    padding: 0 16px;
    border: 0;
    border-radius: var(--radius-full);
    background: transparent;
    color: var(--color-surface-page);
    font-family: var(--font-text);
    font-size: 16px;
    font-weight: 400;
    line-height: normal;
    appearance: none;
    isolation: isolate;
    overflow: visible;
    transition:
      color 160ms ease;
  }

  .about-interview-detail-cta::before {
    display: none;
  }

  .about-interview-detail-cta::after {
    position: absolute;
    z-index: 1;
    top: 0;
    right: 0;
    left: 0;
    height: 100%;
    border: 2px solid var(--color-text-primary);
    border-radius: var(--radius-full);
    background: var(--color-text-primary);
    content: '';
    transform: translateY(var(--interview-cta-front-y));
    transition:
      background-color 160ms ease,
      transform 210ms cubic-bezier(0.18, 1.35, 0.28, 1);
    transform-origin: 50% 50%;
  }

  .about-interview-detail-cta span {
    position: relative;
    z-index: 2;
  }

  .about-interview-detail-cta-content {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    line-height: 1;
    transform:
      translateY(var(--interview-cta-front-y))
      scale(var(--interview-cta-press-scale));
    transform-origin: 50% 50%;
    transition: transform 210ms cubic-bezier(0.18, 1.35, 0.28, 1);
  }

  .about-interview-detail-cta:hover,
  .about-interview-detail-cta:focus-visible {
    --interview-cta-front-y: 0px;
  }

  .about-interview-detail-cta:hover::before,
  .about-interview-detail-cta:focus-visible::before {
    opacity: 0;
  }

  .about-interview-detail-cta:active {
    --interview-cta-front-y: 0px;
    --interview-cta-press-scale: 0.94;
  }

  .about-interview-detail-cta:active::before {
    opacity: 0;
  }

  .about-interview-detail-cta:focus-visible {
    outline: 2px solid var(--color-focus-ring);
    outline-offset: 9px;
  }

  .about-interview-detail-cta-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    margin-left: 10px;
    line-height: 0;
  }

  .about-interview-detail-cta-icon .figma-arrow-icon-forward {
    stroke-width: 1.45;
    transform: rotate(180deg);
    transition: transform 210ms cubic-bezier(0.18, 1.35, 0.28, 1);
    transform-origin: 50% 50%;
  }

  .interview-mini-card {
    box-sizing: border-box;
    position: relative;
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    gap: 17px;
    width: 100%;
    height: 100%;
    min-height: 0;
    padding: 0 80px;
    border: 0;
    border-top: 2px solid var(--color-text-primary);
    border-radius: 0;
    background: var(--color-surface-page);
    color: var(--color-text-primary);
    appearance: none;
    cursor: url('/cursors/retrogusto-pointer-on-cream.svg?v=3') 4 3, pointer;
    overflow: hidden;
    text-align: center;
  }

  .interview-mini-card::after {
    position: absolute;
    z-index: 3;
    inset: 0;
    box-shadow: inset 0 0 0 0 currentColor;
    content: '';
    pointer-events: none;
    transition: box-shadow 180ms cubic-bezier(0.22, 1, 0.36, 1);
  }

  .interview-mini-card:hover::after,
  .interview-mini-card:focus-visible::after {
    box-shadow: inset 0 0 0 8px currentColor;
  }

  .interview-mini-card:last-child {
    border-bottom: 2px solid var(--color-text-primary);
  }

  .interview-mini-card[aria-current='true'] {
    background: var(--color-text-primary);
    color: var(--color-surface-page);
  }

  .interview-mini-number,
  .interview-mini-name {
    color: currentColor;
    font-family: var(--font-text);
    font-size: var(--unit-24);
    font-weight: 400;
    line-height: normal;
  }

  .interview-mini-number {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 115px;
    width: 115px;
    height: 100%;
    text-align: center;
  }

  .interview-mini-name {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 var(--interview-name-width);
    width: var(--interview-name-width);
    height: 115px;
    white-space: nowrap;
  }

  .interview-face {
    position: relative;
    display: block;
    align-self: flex-end;
    flex: 0 0 auto;
    width: 80px;
    height: 80px;
  }

  .interview-face img {
    position: relative;
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
    object-position: center bottom;
    transform: translateY(var(--interview-portrait-y, 0px)) scale(var(--interview-portrait-scale, 1));
    transform-origin: center bottom;
    user-select: none;
    pointer-events: none;
  }

  .interview-mini-card[aria-current='true'] .interview-face img {
    filter: url('#interview-selected-chef-outline');
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
    border: 0;
  }

  .intro {
    position: absolute; z-index: 5; inset: 0;
    display: grid; place-items: center;
    box-sizing: border-box;
    padding: var(--spacing-7);
    pointer-events: none;
    opacity: var(--mount-opacity, 0);
    transition: opacity 80ms linear;
    will-change: opacity;
  }

  .intro-copy {
    display: grid;
    justify-items: center;
    gap: 22px;
  }

  .intro-scroll-cue {
    position: absolute;
    bottom: var(--home-scroll-cue-bottom);
    left: 50%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: var(--color-text-primary);
    font-family: var(--font-text);
    font-size: 16px;
    font-weight: 400;
    line-height: normal;
    text-align: center;
    white-space: nowrap;
    opacity: var(--intro-scroll-cue-opacity, 1);
    transform: translate(-50%, var(--intro-scroll-cue-y, 0px));
    transition: opacity 120ms linear, transform 140ms ease-out;
    will-change: opacity, transform;
  }/*a*/

  .intro-scroll-cue span {
    word-break: break-word;
  }

  h1, .next-message {
    width: min(434px, 100%); margin: 0; color: var(--color-text-primary);
    font-family: var(--font-text);
    font-size: 32px; font-weight: 400; line-height: 1.5; text-align: center;
  }

  h1 {
    width: min(520px, 100%);
  }

  h1 span {
    display: inline-block;
    opacity: var(--letter-opacity, 1);
    transform: translateY(var(--letter-y, 0px));
    transition: opacity 140ms linear, transform 140ms ease-out;
    will-change: opacity, transform;
  }
  .intro h1 .word > span {
    opacity: calc(var(--letter-opacity, 1) * var(--intro-letter-reveal, 0));
    transform: translateY(calc(var(--letter-y, 0px) + var(--intro-reveal-y, 12px)));
  }
  h1 .word { white-space: nowrap; }
  h1 .space { opacity: 1; transform: none; transition: none; width: 0.28em; }

  .accent-letter { color: var(--color-text-primary); font-style: italic; font-weight: 800; }

  .reel-layer {
    position: absolute; z-index: 15; inset: 0;
    overflow: hidden; perspective: 900px; perspective-origin: 50% 50%;
    pointer-events: none; transform-style: preserve-3d;
  }

  .reel-card {
    position: absolute; top: 50%; left: 50%;
    width: clamp(132px, 15vw, 196px); aspect-ratio: 9 / 16;
    opacity: var(--opacity);
    transform:
      translate(-50%, -50%)
      translate3d(var(--x), var(--y), var(--z))
      rotateX(var(--reel-tilt-x, 0deg))
      rotateY(var(--reel-tilt-y, 0deg))
      rotate(var(--rotate))
      scale(var(--scale));
    transform-style: preserve-3d;
    transform-origin: 50% 52%;
    transition: opacity 120ms linear, transform 120ms linear;
    will-change: transform, opacity;
    backface-visibility: hidden;
  }

  .reel-frame {
    position: relative; width: 100%; height: 100%;
    overflow: hidden; border: var(--card-border-width) solid var(--color-border-primary); border-radius: var(--radius-m);
    box-shadow:
      var(--reel-shadow-x, 0px) var(--reel-shadow-y, 36px) 80px rgb(var(--shadow-brand-rgb) / .22),
      0 10px 26px rgb(var(--shadow-dark-rgb) / .28);
    box-sizing: border-box; background: var(--color-surface-dark);
    transform: translateZ(18px);
    transform-style: preserve-3d;
  }

  .reel-video, .reel-placeholder {
    display: block; width: 100%; height: 100%; object-fit: cover;
    transform: translate3d(var(--reel-media-x, 0px), var(--reel-media-y, 0px), 0) scale(1.08);
    transition: transform 120ms linear;
    will-change: transform;
  }

  /* Parte invisibile, nessun transform — solo opacity gestita da JS */
  .next-screen {
    position: fixed; z-index: 20; inset: 0;
    display: grid; place-items: center; box-sizing: border-box;
    padding: var(--spacing-7);
    background: var(--color-surface-page);
    opacity: 0; pointer-events: none;
    will-change: opacity;
  }

  .next-message-word {
    display: inline-block;
    white-space: nowrap;
  }

  .next-message-letter {
    display: inline-block;
    font-size: 32px;
    opacity: var(--letter-opacity, 0);
    transform: translateY(var(--letter-y, 12px));
    transition: opacity 140ms linear, transform 140ms ease-out;
    will-change: opacity, transform;
  }
  .next-message { font-size: 0; }
  .next-message .accent-letter { color: var(--color-text-primary); font-style: italic; font-weight: 800; }
  .next-message .space {
    display: inline-block;
    width: 0.28em;
    font-size: 32px;
    opacity: 1;
    transform: none;
    transition: none;
  }

  .next-message-desktop-break {
    display: block;
  }

  .next-scroll-cue {
    position: absolute;
    left: 50%;
    bottom: var(--home-scroll-cue-bottom);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0;
    color: var(--color-text-primary);
    font-family: var(--font-text);
    font-size: 16px;
    font-weight: 400;
    line-height: normal;
    text-align: center;
    white-space: nowrap;
    transform: translateX(-50%);
    pointer-events: none;
  }

  .next-scroll-cue span {
    word-break: break-word;
  }

  /* Parte invisibile, sopra next-screen, solo opacity gestita da JS */
  .brand-screen {
    position: fixed; z-index: 25; inset: 0;
    display: grid; place-items: center;
    overflow: hidden;
    background: var(--color-surface-page);
    perspective: 900px; perspective-origin: 50% 50%;
    opacity: 0; pointer-events: none;
    will-change: opacity;
  }

  .floating-vector {
    position: absolute; z-index: 2; top: 0; left: 0;
    cursor: url('/cursors/retrogusto-cursor.svg') 5 5, grab;
    opacity: var(--float-opacity, 1);
    transform:
      translate3d(var(--float-x, 84px), var(--float-y, 96px), var(--float-hover-z, 0px))
      translate3d(var(--float-scroll-x, 0vw), var(--float-scroll-y, 0vh), 0)
      rotateZ(var(--float-rotate, 0deg))
      rotateX(var(--float-tilt-x, 0deg))
      rotateY(var(--float-tilt-y, 0deg))
      scale(calc(var(--float-scale, 1) * var(--float-hover-scale, 1)));
    transform-style: preserve-3d;
    transform-origin: 50% 50%;
    filter: drop-shadow(0 18px 22px rgb(var(--shadow-brand-rgb) / var(--float-shadow-alpha, 0)));
    transition: filter 160ms ease, opacity 100ms linear;
    will-change: transform, opacity;
  }

  .floating-vector:hover {
    cursor: url('/cursors/retrogusto-cursor.svg') 5 5, grabbing;
  }

  .floating-vector img {
    display: block; width: 100%; height: 100%;
    pointer-events: none;
    user-select: none;
  }

  .floating-raviolo {
    width: clamp(96px, 15vw, 166px);
    aspect-ratio: 233.427 / 232.847;
  }

  .floating-pizza {
    width: clamp(104px, 16vw, 178px);
    aspect-ratio: 302.008 / 313.605;
  }

  .floating-fusillo {
    width: clamp(92px, 14vw, 158px);
    aspect-ratio: 205.888 / 235.624;
  }

  .brand-lockup {
    position: relative;
    z-index: 3;
    display: grid;
    justify-items: center;
    align-items: center;
    gap: 0;
    width: min(1240px, calc(100vw - 24px));
    padding-block: clamp(18px, 4vh, 64px);
    overflow: visible;
    transform-style: preserve-3d;
  }

  .brand-word {
    margin: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    max-width: 100%;
    overflow: visible;
    padding: 0.12em 0.1em 0.04em;
    font-family: var(--font-display);
    font-size: clamp(72px, 12vw, 160px);
    font-weight: 700;
    font-variation-settings: "wdth" 100;
    line-height: 1.18;
    color: var(--color-text-primary);
    transform-style: preserve-3d;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-rendering: geometricPrecision;
  }

  .brand-letter {
    display: inline-block;
    overflow: visible;
    padding: 0.08em 0.04em 0.12em;
    margin: -0.08em -0.018em -0.12em;
    line-height: 1.16;
    opacity: var(--bl-opacity, 0);
    transform:
      translate3d(var(--bl-x, 0px), var(--bl-y, 0px), var(--bl-z, 420px))
      rotate(var(--bl-rotate, 0deg))
      scale(var(--bl-scale, 2.9));
    transform-origin: 50% 54%;
    transition: none;
    will-change: opacity, transform;
    backface-visibility: hidden;
  }

  .brand-word.is-sharp {
    transform-style: flat;
  }

  .brand-word.is-sharp .brand-letter {
    opacity: 1;
    transform: none;
    transition: none;
    will-change: auto;
  }

  .brand-subtitle {
    max-width: calc(100vw - 48px);
    margin: 0;
    color: var(--color-text-primary);
    font-family: var(--font-display);
    font-size: 32px;
    font-weight: 600;
    line-height: 1.2;
    text-align: center;
    opacity: var(--brand-subtitle-opacity, 0);
    transform: translateY(var(--brand-subtitle-y, 14px));
    transition: opacity 120ms linear, transform 140ms ease-out;
    will-change: opacity, transform;
  }

  .brand-subtitle-jetbrains {
    font-family: "JetBrains Mono", var(--font-text);
    font-weight: 700;
  }

  .brand-scroll-cue {
    position: absolute;
    z-index: 4;
    left: 50%;
    bottom: clamp(72px, 10svh, 80px);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0;
    margin: 0;
    color: var(--color-text-primary);
    font-family: var(--font-text);
    font-size: 16px;
    font-weight: 400;
    line-height: normal;
    text-align: center;
    white-space: nowrap;
    opacity: var(--brand-subtitle-opacity, 0);
    transform: translateX(-50%);
    transition: opacity 120ms linear, transform 140ms ease-out;
    will-change: opacity, transform;
  }

  .brand-scroll-cue span {
    word-break: break-word;
  }

  .brand-scroll-arrow {
    display: block;
    width: 40px;
    height: 40px;
    padding: 6px 7px;
    box-sizing: border-box;
    overflow: visible;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.5;
    stroke-linecap: round;
    stroke-linejoin: round;
    will-change: transform;
  }

  .brand-scroll-arrow:not(.about-project-scroll-arrow) {
    animation: scrollArrowFloat 1.45s ease-in-out infinite;
  }

  @keyframes scrollArrowFloat {
    0%,
    100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(5px);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .brand-scroll-arrow:not(.about-project-scroll-arrow) {
      animation: none;
      transform: none;
    }
  }

  .roles-screen {
    position: fixed; z-index: 35; inset: 0;
    overflow: hidden;
    background: var(--color-surface-page);
    opacity: 0; pointer-events: none;
    will-change: opacity;
  }

  .roles-top-bar {
    position: fixed; z-index: 55; top: 0; left: 0;
    box-sizing: border-box;
    display: grid; grid-template-columns: 1fr auto 1fr; align-items: center;
    width: 100%; height: var(--layout-topbar-height);
    padding: var(--layout-topbar-padding);
    color: var(--color-text-primary);
    opacity: 0;
    pointer-events: none;
    transition: opacity 120ms linear;
  }

  .roles-top-bar.is-hidden {
    opacity: 0 !important;
    pointer-events: none !important;
  }

  .role-grid {
    --role-card-aspect: 373.448 / 524;
    --role-grid-height: min(620px, calc(var(--app-viewport-height) - var(--layout-topbar-height) - 86px));
    --role-card-max-width: min(386px, calc(var(--role-grid-height) * 0.7127), calc((100vw - var(--layout-page-gutter) * 2 - var(--spacing-5) * 2) / 3));

    position: absolute; z-index: 2;
    top: calc(var(--layout-topbar-height) + 26px); left: var(--layout-page-gutter); right: var(--layout-page-gutter);
    height: var(--role-grid-height);
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    justify-content: stretch;
    align-items: center;
    column-gap: var(--spacing-5);
    transform-style: flat;
  }

  .role-card {
    --role-card-radius: clamp(42px, 4.55vw, 65px);
    --role-card-depth-y: 12px;
    --role-card-lift-y: 0px;
    --role-reveal-duration: 270ms;
    --role-reveal-ease: cubic-bezier(0.22, 1, 0.36, 1);
    --role-dialogue-delay: 14ms;
    --role-dialogue-opacity-gap: 100ms;

    position: relative;
    width: min(100%, var(--role-card-max-width));
    aspect-ratio: var(--role-card-aspect);
    max-height: 100%;
    justify-self: center;
    align-self: center;
    overflow: visible;
    isolation: isolate;
    min-height: 0;
    border: 0;
    border-radius: var(--role-card-radius);
    background: transparent;
    cursor: url('/cursors/retrogusto-pointer-on-cream.svg?v=3') 4 3, pointer;
    opacity: var(--role-card-opacity, 0);
    transform: translateY(var(--role-card-y, 38vh));
    transform-style: flat;
    transform-origin: 50% 50%;
    -webkit-transform: translateY(var(--role-card-y, 38vh)) translateZ(0);
    box-shadow: 0 20px 46px rgb(var(--shadow-brand-rgb) / var(--role-shadow-alpha, 0));
    transition:
      opacity 120ms linear,
      transform 180ms ease-out,
      box-shadow 180ms ease;
    will-change: opacity, transform;
    -webkit-backface-visibility: hidden;
    backface-visibility: hidden;
  }

  .role-card:nth-child(1) {
    justify-self: start;
  }

  .role-card:nth-child(2) {
    justify-self: center;
  }

  .role-card:nth-child(3) {
    justify-self: end;
  }

  .role-card::before {
    position: absolute;
    z-index: 0;
    inset: 0;
    border: 2px solid var(--color-border-primary);
    border-radius: var(--role-card-radius);
    background: var(--color-text-primary);
    content: '';
    opacity: 0;
    pointer-events: none;
    transition: opacity 90ms ease;
  }

  .role-card::after {
    display: none;
  }

  .role-card:hover,
  .role-card:focus-visible {
    --role-card-lift-y: calc(var(--role-card-depth-y) * -1);
  }

  .role-card:hover::before,
  .role-card:focus-visible::before {
    opacity: 1;
  }

  .role-card.is-linked {
    cursor: url('/cursors/retrogusto-pointer-on-cream.svg?v=3') 4 3, pointer;
  }

  .role-card.is-servizio {
    --role-card-fill: #aa5dde;
    --servizio-bg-y: 60px;
  }

  .role-card.is-servizio .role-card-bg {
    box-sizing: border-box;
    padding: clamp(10px, 3.5%, 18px);
    object-fit: contain;
    transform:
      translateX(var(--role-bg-x, 0px))
      translateY(calc(var(--servizio-bg-y) + var(--role-bg-y, 0px)))
      scale(1);
  }

  .role-card.is-cucina {
    --role-card-fill: var(--color-interactive-hover);
    --cucina-bg-y: 34px;
  }

  .role-card.is-cucina .role-card-bg {
    transform:
      translateX(var(--role-bg-x, 0px))
      translateY(calc(var(--cucina-bg-y) + var(--role-bg-y, 0px)))
      scale(1);
  }

  .role-card.is-ufficio {
    --role-card-fill: #199444;
    --ufficio-bg-x: 4px;
    --ufficio-bg-y: 64px;
  }

  .role-card.is-ufficio .role-card-bg {
    box-sizing: border-box;
    padding: clamp(2px, 1%, 6px);
    object-fit: contain;
    transform:
      translateX(calc(var(--ufficio-bg-x) + var(--role-bg-x, 0px)))
      translateY(calc(var(--ufficio-bg-y) + var(--role-bg-y, 0px)))
      scale(1);
  }

  :global(.card-enter-fade) {
    position: fixed;
    z-index: 119;
    inset: 0;
    background: var(--color-surface-page);
    pointer-events: none;
  }

  :global(.role-card.is-entering) {
    overflow: visible;
    cursor: url('/cursors/retrogusto-cursor.svg') 5 5, auto;
    will-change: left, top, width, height, border-radius, box-shadow;
  }

  :global(.role-card.is-entering::after) {
    opacity: 0;
  }

  :global(.role-card.is-entering .role-card-bg) {
    z-index: 1;
  }

  :global(.role-card.is-entering::before) {
    opacity: 0;
  }

  :global(.role-card-enter-bottom-line) {
    position: absolute;
    z-index: 5;
    inset: 0;
    box-sizing: border-box;
    border: 2px solid transparent;
    border-bottom-color: var(--color-border-primary);
    border-radius: var(--role-card-radius);
    pointer-events: none;
    will-change: opacity;
  }

  .role-card-top {
    position: absolute;
    z-index: 1;
    inset: 0;
    overflow: hidden;
    border: 2px solid var(--color-border-primary);
    border-radius: var(--role-card-radius);
    background: var(--color-surface-page);
    transform: translateY(var(--role-card-lift-y, 0px));
    -webkit-transform: translateY(var(--role-card-lift-y, 0px)) translateZ(0);
    transition: transform 210ms cubic-bezier(0.18, 1.35, 0.28, 1);
    will-change: transform;
    -webkit-backface-visibility: hidden;
    backface-visibility: hidden;
  }

  .role-card-top::before {
    position: absolute;
    z-index: 3;
    inset: 0;
    background: var(--role-card-fill, transparent);
    content: '';
    mix-blend-mode: multiply;
    opacity: 0;
    pointer-events: none;
    transition: opacity 180ms ease;
  }

  .role-card-bg {
    position: absolute;
    z-index: 1;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center center;
    opacity: 0;
    filter: grayscale(1) sepia(0.16) opacity(0.72);
    transform:
      translateX(var(--role-bg-x, 0px))
      translateY(var(--role-bg-y, 0px))
      scale(1);
    transition: opacity 220ms ease, filter 260ms ease, transform 90ms linear;
    user-select: none;
    pointer-events: none;
  }

  .role-card-bg-overlay {
    position: absolute;
    z-index: 2;
    inset: 0;
    background: var(--role-card-fill, transparent);
    opacity: 0;
    mix-blend-mode: multiply;
    transition: opacity 180ms ease;
    pointer-events: none;
  }

  .role-card:hover .role-card-bg-overlay,
  .role-card:focus-visible .role-card-bg-overlay {
    opacity: 0.30;
  }

  .role-hover-panel {
    position: absolute; z-index: 8;
    top: -2px;
    left: -3px;
    right: -3px;
    width: auto;
    height: calc(28.45% + 4px);
    min-height: 0;
    padding: 7.2% 13.5% 6.8%;
    color: var(--color-text-primary);
    opacity: 0;
    visibility: hidden;
    transform:
      translateX(var(--role-dialogue-x, 0px))
      translateY(calc(-100% - 8px + var(--role-dialogue-y, 0px)));
    transition:
      opacity 90ms linear,
      visibility 0s linear 190ms,
      transform var(--role-reveal-duration) var(--role-reveal-ease);
    pointer-events: none;
  }

  .role-hover-panel-shape {
    position: absolute;
    z-index: 0;
    inset: 0;
    display: block;
    width: 100%;
    height: 100%;
    overflow: visible;
  }

  .role-hover-panel-shape path {
    fill: var(--color-border-primary);
    stroke: var(--color-border-primary);
    stroke-width: 2;
    vector-effect: non-scaling-stroke;
  }

  .role-hover-panel p {
    position: absolute;
    z-index: 1;
    top: 41%;
    right: 13.5%;
    left: 13.5%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.18em;
    width: auto;
    margin: 0;
    font-family: var(--font-text);
    font-size: var(--role-hover-font-size, clamp(11px, 1vw, 15px));
    font-weight: 400;
    line-height: 1.5;
    letter-spacing: 0;
    text-align: center;
    color: #f7f3ea;
    transform: translateY(-50%);
  }

  .role-hover-panel strong {
    font-weight: 700;
  }

  .role-hover-line {
    display: block;
    white-space: nowrap;
  }

  .role-card-copy {
    position: absolute;
    z-index: 7;
    top: 50%;
    left: var(--spacing-5);
    right: var(--spacing-5);
    display: grid;
    justify-items: center;
    color: var(--color-text-primary);
    text-align: center;
    opacity: 1;
    transform:
      translateX(var(--role-copy-x, 0px))
      translateY(calc(-50% + var(--role-copy-y, 0px)));
    transition: opacity 160ms ease, transform 180ms ease;
    pointer-events: none;
  }

  .role-card-copy h2 {
    margin: 0;
    font-family: var(--font-display);
    font-size: clamp(42px, 4.1vw, 60px);
    font-weight: 700;
    line-height: 1.5;
    letter-spacing: 0;
    text-transform: lowercase;
    font-variation-settings: "wdth" 100;
  }

  .role-card-copy h2::first-letter {
    text-transform: uppercase;
  }

  .role-card-copy p {
    margin: -6px 0 0;
    font-family: var(--font-text);
    font-size: clamp(13px, 1.1vw, 16px);
    font-weight: 400;
    line-height: 1.5;
    letter-spacing: 0;
    transition: opacity 180ms ease;
  }

  .role-person {
    position: absolute; z-index: 6;
    left: 50%; bottom: -20px;
    width: auto;
    height: min(92%, 720px);
    opacity: 0;
    transform:
      translateX(calc(-50% + var(--role-person-base-x, 0px) + var(--role-person-x, 0px)))
      translateY(calc(72px + var(--role-person-base-y, 0px) + var(--role-person-y, 0px)));
    transition:
      opacity var(--role-reveal-duration) var(--role-reveal-ease),
      transform var(--role-reveal-duration) var(--role-reveal-ease);
    user-select: none;
    pointer-events: none;
    will-change: transform, opacity;
  }

  .role-person-outline,
  .role-person-fill {
    height: var(--cucina-person-height, var(--role-person-height));
  }

  .role-card.has-person-fill .role-person-outline {
    z-index: 5;
    opacity: 0;
    transform:
      translateX(calc(-50% + var(--role-person-base-x, 0px) + var(--role-person-x, 0px)))
      translateY(calc(var(--role-person-base-y, 0px) + var(--role-person-y, 0px)));
  }

  .role-person-fill {
    z-index: 4;
    opacity: 0;
  }

  .role-card.is-servizio {
    --role-person-base-x: 0px;
    --role-person-base-y: 320px;
    --role-person-height: min(142%, 1360px);
  }

  .role-card.is-servizio .role-person {
    bottom: -72px;
  }

  .role-card.is-cucina {
    --role-person-base-x: 0px;
    --role-person-base-y: 28px;
    --role-person-height: min(66%, 720px);
  }

  .role-card.is-ufficio {
    --role-person-base-x: 0px;
    --role-person-base-y: 240px;
    --role-person-height: min(124%, 1120px);
  }

  .role-card.is-ufficio .role-person {
    bottom: -56px;
  }

  .role-card.is-servizio .role-person {
    height: var(--servizio-person-height, var(--role-person-height));
  }

  .role-card.is-cucina .role-person {
    height: var(--cucina-person-height, var(--role-person-height));
  }

  .role-card.is-ufficio .role-person {
    height: var(--ufficio-person-height, var(--role-person-height));
  }

  .role-card.has-dialogue:hover .role-card-bg,
  .role-card.has-dialogue:focus-visible .role-card-bg {
    opacity: 0.52;
    filter: grayscale(1) sepia(0.16) opacity(0.74);
    transform:
      translateX(var(--role-bg-x, 0px))
      translateY(var(--role-bg-y, 0px))
      scale(1);
  }

  .role-card.is-ufficio.has-dialogue:hover .role-card-bg,
  .role-card.is-ufficio.has-dialogue:focus-visible .role-card-bg {
    transform:
      translateX(calc(var(--ufficio-bg-x) + var(--role-bg-x, 0px)))
      translateY(calc(var(--ufficio-bg-y) + var(--role-bg-y, 0px)))
      scale(1);
  }

  .role-card.is-servizio.has-dialogue:hover .role-card-bg,
  .role-card.is-servizio.has-dialogue:focus-visible .role-card-bg {
    transform:
      translateX(var(--role-bg-x, 0px))
      translateY(calc(var(--servizio-bg-y) + var(--role-bg-y, 0px)))
      scale(1);
  }

  .role-card.is-cucina.has-dialogue:hover .role-card-bg,
  .role-card.is-cucina.has-dialogue:focus-visible .role-card-bg {
    transform:
      translateX(var(--role-bg-x, 0px))
      translateY(calc(var(--cucina-bg-y) + var(--role-bg-y, 0px)))
      scale(1);
  }

  .role-card.has-dialogue:hover .role-card-top::before,
  .role-card.has-dialogue:focus-visible .role-card-top::before {
    opacity: 0.50;
  }

  .role-card.has-dialogue:hover .role-card-copy,
  .role-card.has-dialogue:focus-visible .role-card-copy {
    opacity: 0;
    transform:
      translateX(var(--role-copy-x, 0px))
      translateY(calc(-50% - 12px + var(--role-copy-y, 0px)));
  }

  .role-card.has-dialogue:hover .role-hover-panel,
  .role-card.has-dialogue:focus-visible .role-hover-panel {
    opacity: 1;
    visibility: visible;
    transition:
      opacity 80ms linear,
      visibility 0s linear,
      transform var(--role-reveal-duration) var(--role-reveal-ease);
    transform:
      translateX(var(--role-dialogue-x, 0px))
      translateY(var(--role-dialogue-y, 0px));
  }

  .role-card.has-dialogue:hover .role-person,
  .role-card.has-dialogue:focus-visible .role-person {
    opacity: 1;
    transform:
      translateX(calc(-50% + var(--role-person-base-x, 0px) + var(--role-person-x, 0px)))
      translateY(calc(var(--role-person-base-y, 0px) + var(--role-person-y, 0px)));
  }

  .role-card.has-person-fill:hover .role-person-outline,
  .role-card.has-person-fill:focus-visible .role-person-outline {
    opacity: 1;
  }

  .role-card.has-person-fill:hover .role-person-fill,
  .role-card.has-person-fill:focus-visible .role-person-fill {
    opacity: 1;
  }

  @supports (mix-blend-mode: plus-darker) {
    .role-card-top::before,
    .role-card-bg-overlay {
      mix-blend-mode: plus-darker;
    }
  }

  @media (min-width: 701px) and (max-width: 1180px) {
    .role-grid {
      --role-grid-height: min(590px, calc(var(--app-viewport-height) - var(--layout-topbar-height) - 72px));
      --role-card-gap: clamp(10px, 1.6vw, 18px);
      --role-card-max-width: min(368px, calc(var(--role-grid-height) * 0.7127), calc((100vw - var(--layout-page-gutter) * 2 - var(--role-card-gap) * 2) / 3));

      top: calc(var(--layout-topbar-height) + 22px);
      column-gap: var(--role-card-gap);
    }

    .role-card {
      --role-card-radius: clamp(34px, 5.5vw, 54px);
    }

    .role-card-copy {
      left: var(--spacing-4);
      right: var(--spacing-4);
    }

    .role-card-copy h2 {
      font-size: clamp(34px, 5.2vw, 52px);
      line-height: 1.24;
    }

    .role-card-copy p {
      margin-top: -2px;
      font-size: clamp(11px, 1.55vw, 14px);
      line-height: 1.35;
    }

    .role-hover-panel p {
      font-size: var(--role-hover-font-size, clamp(9.5px, 1.45vw, 13px));
      line-height: 1.42;
    }
  }

  @media (max-width: 700px) {
    :global(:root) {
      --home-scroll-cue-bottom: clamp(24px, 6vh, 48px);
    }

    .audio-gate-content {
      width: calc(100vw - var(--spacing-8));
    }
    .audio-gate-utensil {
      top: 21svh;
      width: clamp(58px, 18vw, 76px);
      height: 84svh;
      opacity: 0.82;
    }
    .audio-gate-knife {
      top: 17svh;
      width: clamp(48px, 15vw, 64px);
      height: 101svh;
    }
    .audio-gate-content p {
      max-width: 250px;
      font-size: 16px;
    }
    .audio-gate-button-frame {
      min-width: 132px;
    }
    .about-top-bar {
      height: var(--layout-topbar-height-mobile);
      padding: var(--layout-topbar-padding-mobile);
    }
    .about-top-bar .logo {
      font-size: 24px;
    }
    .logo         { font-size: 34px; }
    .close-icon,
    .close-icon::before { width: 22px; }
    .about-gate-grid {
      inset: var(--layout-topbar-height-mobile) 0 0;
      grid-template-columns: 1fr;
      grid-template-rows: repeat(2, minmax(0, 1fr));
    }
    .about-gate-grid::after {
      display: none;
    }
    .about-gate-section {
      --about-word-width: clamp(258px, 74vw, 338px);
      --about-section-stroke-right: 2px;

      gap: 8px;
      padding: 32px var(--layout-page-gutter-mobile);
    }
    .about-gate-section[data-node-id='381:308'] {
      --about-word-width: clamp(286px, 80vw, 364px);
      --about-section-stroke-right: 0px;
      --about-section-stroke-left: 2px;
    }
    .about-gate-title {
      font-size: clamp(42px, 14vw, 58px);
    }
    .about-gate-subtitle {
      font-size: 15px;
    }
    .about-gate-fork {
      --about-utensil-length: clamp(288px, 82vw, 470px);
      top: clamp(20px, 4.5vh, 38px);
    }
    .about-gate-knife {
      --about-utensil-length: clamp(322px, 91vw, 532px);
      bottom: clamp(18px, 4.5vh, 38px);
    }
    .about-interviews {
      inset: var(--layout-topbar-height-mobile) 0 0;
    }
    .about-screen.is-full-interview .about-top-bar {
      top: 0;
    }
    .about-full-interview {
      inset: var(--layout-topbar-height-mobile) 0 0;
      padding: 0;
    }
    .about-full-interview-back {
      top: 20px;
      left: var(--layout-page-gutter-mobile);
      width: 40px;
      height: 40px;
      font-size: 30px;
    }
    .about-full-interview-portrait {
      position: relative;
      top: auto;
      left: auto;
      width: 100%;
      height: 250px;
      margin-top: 24px;
    }
    .about-full-interview-portrait img {
      top: 0;
      left: 50%;
      height: 320px;
      transform: translateX(-50%);
    }
    .about-full-interview-copy {
      width: 100%;
      min-height: auto;
      margin-left: 0;
      padding: 20px var(--layout-page-gutter-mobile) 48px;
    }
    .about-full-interview-header h3 {
      font-size: clamp(48px, 15vw, 64px);
    }
    .about-full-interview-header p {
      font-size: 14px;
    }
    .about-full-interview-scroll-frame {
      width: 100%;
      max-height: 48svh;
      margin-top: 0;
    }
    .about-full-interview-scroll {
      padding: 0 14px 84px 0;
    }
    .about-full-interview-quote {
      margin-top: 34px;
      font-size: clamp(18px, 5.4vw, 24px);
    }
    .about-full-interview-transcript {
      width: 100%;
      margin-top: 34px;
      font-size: 13px;
      line-height: 1.28;
    }
    .paganini-video-button {
      right: var(--layout-page-gutter-mobile);
      top: 20px;
      width: 132px;
      height: 54px;
      gap: 14px;
      padding: 0 8px 0 16px;
    }
    .paganini-video-button::before,
    .paganini-video-button::after {
      height: 54px;
    }
    .paganini-video-button-icon {
      width: 36px;
      height: 36px;
    }
    .about-project {
      inset: var(--layout-topbar-height-mobile) 0 0;
    }
    .about-project-slide {
      padding: 28px var(--layout-page-gutter-mobile);
    }
    .about-project-copy-slide {
      --about-project-slide-padding-y: 28px;
      --about-project-title-size: clamp(44px, 13vw, 62px);
      --about-project-copy-gap: 30px;
    }
    .about-project-team-slide {
      padding: 0;
    }
    .about-project-team-grid {
      left: max(var(--layout-page-gutter-mobile), 6vw);
      right: max(var(--layout-page-gutter-mobile), 6vw);
      top: 50%;
      transform: translateY(calc(-50% - 150px));
      gap: clamp(4px, 1.5vw, 10px);
    }
    .about-project-team-name {
      font-size: clamp(10px, 2.3vw, 13px);
    }
    .about-project-intro {
      height: 100%;
      width: min(336px, calc(100vw - var(--spacing-8)));
    }
    .about-project-intro-copy {
      gap: var(--about-project-copy-gap);
    }
    .about-project-intro h3 {
      font-size: var(--about-project-title-size);
    }
    .about-project-intro p {
      width: min(310px, 100%);
      font-size: 13px;
      line-height: 1.22;
    }
    .about-project-politecnico {
      width: clamp(128px, 34vw, 160px);
    }
    .about-project-scroll-cue {
      right: var(--layout-page-gutter-mobile);
      gap: 10px;
      max-width: 172px;
      font-size: 12px;
    }
    .intro        { padding: var(--layout-page-gutter-mobile); }
    .persistent-top-audio { top: calc(var(--unit-24) + var(--unit-4)); }
    h1, .next-message { font-size: 24px; }
    .next-message-letter,
    .next-message .space {
      font-size: 24px;
    }
    .next-message-desktop-break {
      display: none;
    }
    .reel-card    { width: min(38vw, 148px); }
    .next-screen  { padding: var(--layout-page-gutter-mobile); }
    .brand-word   { font-size: clamp(40px, 10.5vw, 76px); }
    .brand-lockup { gap: 0; }
    .brand-subtitle { font-size: 24px; }
    .brand-scroll-cue { bottom: clamp(0px, 0.5svh, 6px); }
    .floating-raviolo { width: clamp(86px, 28vw, 124px); }
    .floating-pizza { width: clamp(92px, 30vw, 132px); }
    .floating-fusillo { width: clamp(82px, 26vw, 118px); }
    .roles-top-bar { height: var(--layout-topbar-height-mobile); padding: var(--layout-topbar-padding-mobile); }
    .role-grid {
      --role-grid-height: calc(var(--app-viewport-height) - var(--layout-topbar-height-mobile) - 16px);
      --role-card-gap: clamp(6px, 1vh, 8px);
      --role-card-mobile-row-height: calc((var(--role-grid-height) - var(--role-card-gap) * 2) / 3);
      --role-card-max-width: min(calc(100vw - var(--spacing-5)), calc(var(--role-card-mobile-row-height) * 0.7127));

      top: calc(var(--layout-topbar-height-mobile) + 8px);
      left: 50%;
      right: auto;
      box-sizing: border-box;
      width: calc(100vw - var(--spacing-5));
      height: var(--role-grid-height);
      grid-template-columns: var(--role-card-max-width);
      grid-template-rows: repeat(3, minmax(0, var(--role-card-mobile-row-height)));
      gap: var(--role-card-gap);
      justify-content: center;
      align-content: center;
      align-items: center;
      transform: translateX(-50%);
    }
    .role-card {
      --role-card-radius: clamp(34px, 12vw, 54px);

      min-height: 0;
      width: var(--role-card-max-width);
      max-height: var(--role-card-mobile-row-height);
      aspect-ratio: var(--role-card-aspect);
      border-radius: var(--role-card-radius);
      justify-self: center;
    }
    .role-card-copy { left: var(--spacing-4); right: var(--spacing-4); }
    .role-card-copy h2 { font-size: clamp(28px, 10vw, 44px); line-height: 1.08; }
    .role-card-copy p { margin-top: 2px; font-size: 11px; line-height: 1.25; }
    .role-card-bg {
      inset: 0;
      width: 100%;
      height: 100%;
      object-position: center center;
    }
    .role-card.is-ufficio .role-card-bg {
      padding: clamp(0px, 0.75%, 5px);
    }
    .role-card.is-servizio .role-card-bg {
      padding: clamp(8px, 3%, 16px);
    }
    .role-hover-panel {
      top: -2px;
      left: -3px;
      right: -3px;
      width: auto;
      height: calc(28.45% + 4px);
      min-height: 0;
      padding: 5.2% var(--spacing-4) 4.8%;
    }
    .role-hover-panel p {
      left: var(--spacing-4);
      right: var(--spacing-4);
      font-size: var(--role-hover-font-size, clamp(10px, 3vw, 14px));
      line-height: 1.5;
    }
    .role-person {
      height: min(98%, 400px);
      bottom: -158px;
    }
    .role-card.is-servizio .role-person,
    .role-card.is-cucina .role-person,
    .role-card.is-ufficio .role-person {
      height: var(--role-person-mobile-height, min(98%, 400px));
    }
    .role-card.is-ufficio {
      --role-person-base-y: 78px;
      --role-person-mobile-height: min(126%, 500px);
    }
    .role-card.is-ufficio .role-person {
      bottom: -126px;
    }
    .role-card.is-servizio {
      --role-person-base-y: 116px;
      --role-person-mobile-height: min(138%, 560px);
    }
    .role-card.is-servizio .role-person {
      bottom: -134px;
    }
  }
</style>
