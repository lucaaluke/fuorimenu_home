<script lang="ts">
  import VolumeMaxIcon from '$lib/VolumeMaxIcon.svelte';
  import VolumeOffIcon from '$lib/VolumeOffIcon.svelte';
  import { readAudioMutedPreference, writeAudioMutedPreference } from '$lib/scene/audio-preference';
  import { clamp } from '$lib/scene/math';
  import { onMount } from 'svelte';

  type Props = {
    onFullInterviewChange?: (isFullInterview: boolean) => void;
    standalone?: boolean;
    standaloneTopOffset?: string;
  };

  let { onFullInterviewChange, standalone = false, standaloneTopOffset = 'var(--interviste-navbar-height)' }: Props = $props();
  let activeInterviewName = $state<string>();
  let isFullInterview = $state(false);
  let isAudioMuted = $state(true);
  let fullPortraitScale = $state(1);
  let miniPortraitImages: HTMLImageElement[] = [];
  const audioLabel = $derived(isAudioMuted ? 'Audio disattivato' : 'Audio attivo');

  type MiniPortraitBounds = {
    left: number;
    top: number;
    width: number;
    height: number;
    naturalWidth: number;
    naturalHeight: number;
  };

  const miniPortraitBounds = new WeakMap<HTMLImageElement, MiniPortraitBounds>();

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

  const interviewChefs: InterviewChef[] = [
    {
      number: '01',
      name: 'Stefano Paganini',
      nameHeight: 231,
      faceWidth: 85,
      faceHeight: 85,
      portraitSrc: '/assets/interviews/portraits/nini.png',
      featuredHover: {
        role: 'Executive Chef',
        description:
          'Lo chef piemontese ha fatto parte del team incaricato della ristorazione olimpica internazionale a Livigno.',
        bodySrc: '/assets/interviews/hover/stefano-paganini-figma.svg'
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
      portraitSrc: '/assets/interviews/portraits/zarri.png',
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
      portraitSrc: '/assets/interviews/portraits/eli.png',
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
      portraitSrc: '/assets/interviews/portraits/fausto.png',
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
      portraitSrc: '/assets/interviews/portraits/marco.png',
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
      portraitSrc: '/assets/interviews/portraits/cracco.png',
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
      portraitSrc: '/assets/interviews/portraits/ken.png',
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
      portraitSrc: '/assets/interviews/hover/nini.png'
    },
    'Carlo Zarri': {
      name: 'Carlo Zarri',
      firstName: 'Carlo',
      lastName: 'Zarri',
      role: 'Chief Executive Chef',
      description:
        "Architetto iniziale del progetto gastronomico di Milano-Cortina 2026 ha gestito la ristorazione all'Arena di Santa Giulia.",
      portraitSrc: '/assets/interviews/hover/zarri.png',
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
      portraitSrc: '/assets/interviews/hover/eli.png',
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
      portraitSrc: '/assets/interviews/hover/hover%20giusti/meli.png',
      portraitX: 0,
      portraitY: 51,
      portraitHeight: 511,
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
      portraitSrc: '/assets/interviews/hover/hover%20giusti/marco.png',
      portraitX: 0,
      portraitY: 51,
      portraitHeight: 511,
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
      portraitSrc: '/assets/interviews/hover/hover%20giusti/cracco.png',
      portraitX: 0,
      portraitY: 51,
      portraitHeight: 511,
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
      portraitSrc: '/assets/interviews/hover/hover%20giusti/ken.png',
      portraitX: 0,
      portraitY: 51,
      portraitHeight: 511,
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
        "Chi rende possibili le Olimpiadi senza essere protagonista dell’evento? Un evento di questa portata si prepara con anni di anticipo. Dal punto di vista puramente organizzativo, come ha approcciato la sfida di Milano Cortina? Come ha riorganizzato la struttura di 'Cracco in Galleria' e della sua brigata per trasformarlo in un luogo in grado di ospitare l'Omega House conciliando grandi flussi di persone e qualità del cibo senza perdere l'identità del fine dining?",
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

  function openInterviewDetail(chef: InterviewChef) {
    if (!interviewDetails[chef.name]) return;
    activeInterviewName = chef.name;
  }

  function openFullInterview() {
    if (!activeInterviewDetail || !activeFullInterviewContent) return;
    isFullInterview = true;
    onFullInterviewChange?.(true);
  }

  function returnToInterviewDetail() {
    isFullInterview = false;
    onFullInterviewChange?.(false);
  }

  function openPaganiniWrittenInterviewFromUrl() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('chef') !== 'paganini' || params.get('view') !== 'full') return;

    activeInterviewName = 'Stefano Paganini';
    isFullInterview = true;
    onFullInterviewChange?.(true);
  }

  function handleFullInterviewTranscriptWheel(event: WheelEvent) {
    const scroller = event.currentTarget as HTMLElement;
    if (!scroller) return;

    event.preventDefault();
    event.stopPropagation();

    const maxScrollTop = scroller.scrollHeight - scroller.clientHeight;
    if (maxScrollTop <= 0) return;

    const delta = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
    const nextScrollTop = clamp(scroller.scrollTop + delta, 0, maxScrollTop);

    scroller.scrollTop = nextScrollTop;
  }

  function handleInterviewsWheel(event: WheelEvent) {
    if (activeInterviewName) return;
    const scroller = event.currentTarget as HTMLElement;
    if (!scroller || scroller.scrollWidth <= scroller.clientWidth) return;
    if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
    event.preventDefault();
    scroller.scrollLeft += event.deltaY;
  }

  function getMiniPortraitBounds(image: HTMLImageElement): MiniPortraitBounds | undefined {
    if (miniPortraitBounds.has(image)) return miniPortraitBounds.get(image);
    if (!image.naturalWidth || !image.naturalHeight) return undefined;

    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;

    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return undefined;

    context.drawImage(image, 0, 0);

    try {
      const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
      let minX = canvas.width;
      let minY = canvas.height;
      let maxX = -1;
      let maxY = -1;

      for (let y = 0; y < canvas.height; y += 1) {
        for (let x = 0; x < canvas.width; x += 1) {
          const alpha = data[(y * canvas.width + x) * 4 + 3];
          if (alpha <= 8) continue;

          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }

      if (maxX < minX || maxY < minY) return undefined;

      const bounds = {
        left: minX,
        top: minY,
        width: maxX - minX + 1,
        height: maxY - minY + 1,
        naturalWidth: canvas.width,
        naturalHeight: canvas.height
      };
      miniPortraitBounds.set(image, bounds);
      return bounds;
    } catch {
      return undefined;
    }
  }

  function fitMiniPortrait(image: HTMLImageElement) {
    const frame = image.parentElement;
    const bounds = getMiniPortraitBounds(image);
    if (!frame || !bounds) return;

    const { width: frameWidth, height: frameHeight } = frame.getBoundingClientRect();
    if (!frameWidth || !frameHeight) return;

    const topPadding = 0;
    const availableHeight = Math.max(1, frameHeight - topPadding);
    const scale = availableHeight / bounds.height;
    const visibleWidth = bounds.width * scale;
    const targetFrameWidth = visibleWidth * 1.22;
    frame.style.setProperty('--mini-portrait-fit-width', `${visibleWidth}px`);
    frame.style.setProperty('--mini-portrait-wide-width', `${targetFrameWidth}px`);

    const fittedFrameWidth = frame.getBoundingClientRect().width || frameWidth;
    const x = (fittedFrameWidth - visibleWidth) / 2 - bounds.left * scale;
    const y = topPadding - bounds.top * scale;

    frame.style.setProperty('--mini-portrait-render-width', `${bounds.naturalWidth * scale}px`);
    frame.style.setProperty('--mini-portrait-render-height', `${bounds.naturalHeight * scale}px`);
    frame.style.setProperty('--mini-portrait-x', `${x}px`);
    frame.style.setProperty('--mini-portrait-y', `${y}px`);
    image.style.width = '';
    image.style.height = '';
    image.style.transform = '';
  }

  function fitAllMiniPortraits() {
    miniPortraitImages.forEach((image) => {
      if (image?.complete) fitMiniPortrait(image);
    });
  }

  function fitMiniPortraitAt(index: number) {
    const image = miniPortraitImages[index];
    if (image) fitMiniPortrait(image);
  }

  function syncFullPortraitScale() {
    fullPortraitScale = clamp(1 + ((window.innerWidth - 1512) / 688) * 0.24, 1, 1.24);
  }

  function handleViewportResize() {
    fitAllMiniPortraits();
    syncFullPortraitScale();
  }

  function reloadHome(event: MouseEvent) {
    event.preventDefault();
    window.location.assign('/?view=brand');
  }

  function toggleAudioMuted() {
    isAudioMuted = !isAudioMuted;
    writeAudioMutedPreference(isAudioMuted);
  }

  onMount(() => {
    openPaganiniWrittenInterviewFromUrl();
    isAudioMuted = readAudioMutedPreference(isAudioMuted);
    fitAllMiniPortraits();
    syncFullPortraitScale();
    window.addEventListener('resize', handleViewportResize);

    return () => {
      window.removeEventListener('resize', handleViewportResize);
    };
  });
</script>

{#snippet intervisteContent()}
{#if isFullInterview}
{#if activeInterviewDetail && activeFullInterviewContent}
  <section
    class="about-full-interview"
    class:is-standalone={standalone}
    style={`--interviste-top-offset:${standaloneTopOffset};--about-full-portrait-scale:${fullPortraitScale};`}
    aria-labelledby="about-full-interview-title"
    data-node-id="495:1374"
  >
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
      <img
        src={activeInterviewDetail.portraitSrc}
        alt=""
        draggable="false"
        style={`--full-portrait-x:${activeInterviewDetail.portraitX ?? 0}px;--full-portrait-y:${activeInterviewDetail.portraitY ?? 0}px;--full-portrait-height:${activeInterviewDetail.portraitHeight ?? 614}px;`}
      />
    </div>
    <article class="about-full-interview-copy">
      <header
        class="about-full-interview-header"
        class:is-stefano={activeInterviewDetail.name === 'Stefano Paganini'}
      >
        <h3 id="about-full-interview-title" data-node-id="495:1427">{activeInterviewDetail.name}</h3>
        <p data-node-id="495:1428">{activeInterviewDetail.role}</p>
      </header>
      <div
        class="about-full-interview-scroll"
        onwheel={handleFullInterviewTranscriptWheel}
      >
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
    </article>
    {#if activeInterviewDetail.name === 'Stefano Paganini'}
      <a
        class="paganini-video-button"
        href="/interviste/video-paganini"
        aria-label="Guarda l’intervista di Stefano Paganini"
        data-node-id="5355:17123"
      >
        <span class="paganini-video-button-label">Video</span>
        <span class="paganini-video-button-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false">
            <path d="M9 6.8L17 12L9 17.2V6.8Z" />
          </svg>
        </span>
      </a>
    {/if}
  </section>
{/if}

{:else}
<section
  class="about-interviews"
  class:is-standalone={standalone}
  style={`--interviste-top-offset:${standaloneTopOffset};`}
  aria-labelledby={activeInterviewDetail ? 'about-interview-detail-title' : 'about-interviews-title'}
  data-node-id="381:464"
  onwheel={handleInterviewsWheel}
>
  <div class="about-interviews-rail" aria-label="Interviste agli chef">
    <div class="about-interviews-list">
      {#each interviewChefs as chef, index (chef.name)}
        <button
          class="interview-mini-card"
          type="button"
          aria-label={`Apri intervista ${chef.number}: ${chef.name}`}
          aria-current={activeInterviewName === chef.name ? 'true' : undefined}
          style={`--interview-name-width:${chef.nameHeight}px;--interview-face-width:${chef.faceWidth}px;--interview-face-height:${chef.faceHeight}px;--interview-portrait-src:url("${chef.portraitSrc}");`}
          onclick={() => openInterviewDetail(chef)}
        >
          <span class="interview-face" aria-hidden="true">
            <img class="interview-face-stroke stroke-n" src={chef.portraitSrc} alt="" draggable="false" />
            <img class="interview-face-stroke stroke-e" src={chef.portraitSrc} alt="" draggable="false" />
            <img class="interview-face-stroke stroke-s" src={chef.portraitSrc} alt="" draggable="false" />
            <img class="interview-face-stroke stroke-w" src={chef.portraitSrc} alt="" draggable="false" />
            <img class="interview-face-stroke stroke-ne" src={chef.portraitSrc} alt="" draggable="false" />
            <img class="interview-face-stroke stroke-se" src={chef.portraitSrc} alt="" draggable="false" />
            <img class="interview-face-stroke stroke-sw" src={chef.portraitSrc} alt="" draggable="false" />
            <img class="interview-face-stroke stroke-nw" src={chef.portraitSrc} alt="" draggable="false" />
            <img
              class="interview-face-image"
              bind:this={miniPortraitImages[index]}
              src={chef.portraitSrc}
              alt=""
              draggable="false"
              onload={() => fitMiniPortraitAt(index)}
            />
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
              style={`--detail-portrait-x:${activeInterviewDetail.portraitX ?? 0}px;--detail-portrait-y:${activeInterviewDetail.portraitY ?? 0}px;--detail-portrait-height:${activeInterviewDetail.portraitHeight ?? 614}px;--detail-portrait-scale:${fullPortraitScale};`}
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
{/snippet}

{#if standalone}
  <main class="interviste-page" aria-label="Interviste Fuorimenù">
    <header class="interviste-top-bar" aria-label="Navigazione principale">
      <a class="logo press-ring-control" href="/?view=brand" aria-label="Vai al brand screen Fuorimenù" onclick={reloadHome}>
        <span class="topbar-control-content">FM</span>
      </a>
      <button
        class="icon-button top-bar-audio press-ring-control"
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
      <a
        class="icon-button top-bar-menu press-ring-control"
        href="/?about=gate"
        aria-label="Torna al menu about Fuorimenù"
      >
        <span class="topbar-control-content" aria-hidden="true">
          <span class="close-icon"></span>
        </span>
      </a>
    </header>

    {@render intervisteContent()}
  </main>
{:else}
  {@render intervisteContent()}
{/if}

<style>
.interviste-page {
  --interviste-navbar-height: 136px;
  --interviste-navbar-padding-x: var(--layout-page-gutter);
  --button-depth-x: 0px;
  --button-depth-y: 6px;
  --press-ring-opacity: 0;
  --press-ring-inner-size: 0px;
  --press-ring-y: 0px;
  --press-content-scale: 1;
  --topbar-control-bg: var(--color-surface-page);
  --topbar-control-fg: var(--color-text-primary);
  --topbar-control-hover-bg: var(--color-surface-page);
  --topbar-control-hover-fg: var(--color-text-primary);
  --topbar-control-depth: var(--color-text-primary);
  --button-hover-scale: 1;
  --button-lift-x: 0px;
  --button-lift-y: 0px;
  --topbar-lift-ease: cubic-bezier(0.18, 1.35, 0.28, 1);

  position: fixed;
  inset: 0;
  width: 100%;
  height: 100svh;
  min-height: 100vh;
  overflow: hidden;
  background: var(--color-surface-page);
  color: var(--color-text-primary);
}

.interviste-top-bar {
  position: fixed;
  z-index: 20;
  top: 0;
  left: 0;
  box-sizing: border-box;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  width: 100%;
  height: var(--interviste-navbar-height);
  padding: 0 var(--interviste-navbar-padding-x);
  pointer-events: none;
}

.logo,
.icon-button {
  pointer-events: auto;
}

.logo {
  color: var(--color-text-primary);
  font-family: var(--font-display);
  font-size: 24px;
  font-weight: 700;
  line-height: 1;
  text-decoration: none;
}

.top-bar-audio {
  justify-self: center;
}

.top-bar-menu {
  justify-self: end;
}

.icon-button {
  display: grid;
  width: var(--button-icon-size);
  height: var(--button-icon-size);
  place-items: center;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--color-text-primary);
  cursor: url('/assets/ui/cursors/retrogusto-pointer-on-cream.svg?v=3') 4 3, pointer;
  appearance: none;
}

.logo,
.icon-button {
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

.logo::before,
.icon-button::before,
.logo::after,
.icon-button::after {
  position: absolute;
  inset: 0;
  border: 2px solid var(--topbar-control-fg);
  border-radius: var(--radius-full);
  content: '';
  pointer-events: none;
}

.logo::before,
.icon-button::before {
  display: none;
}

.logo::after,
.icon-button::after {
  z-index: 1;
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

.topbar-control-content {
  position: relative;
  z-index: 2;
  display: grid;
  place-items: center;
  transform: scale(var(--press-content-scale));
  transition:
    color 160ms ease,
    transform 170ms cubic-bezier(0.22, 1, 0.36, 1);
}

.logo:hover,
.logo:focus-visible,
.icon-button:hover,
.icon-button:focus-visible {
  --button-lift-x: 0px;
  --button-lift-y: 0px;
  --button-hover-scale: 1;
  --press-ring-opacity: 1;
  color: var(--topbar-control-hover-fg);
}

.logo:hover::after,
.logo:focus-visible::after,
.icon-button:hover::after,
.icon-button:focus-visible::after {
  border-color: currentColor;
  background: transparent;
}

.logo:active,
.icon-button:active {
  --button-lift-x: 0px;
  --button-lift-y: 0px;
  --button-hover-scale: 1;
  --press-ring-opacity: 1;
  --press-ring-inner-size: 5px;
  --press-content-scale: 0.83;
}

.logo:focus-visible,
.icon-button:focus-visible {
  outline: 2px solid var(--color-focus-ring);
  outline-offset: var(--unit-4);
}

:global(.volume-icon) {
  width: 28px;
  height: 28px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2.2;
}

:global(.volume-max-icon) {
  stroke-width: 2.33333;
}

:global(.volume-slash) {
  stroke-width: 2.8;
}

.top-bar-menu .topbar-control-content {
  width: 24px;
  height: 24px;
}

.close-icon,
.close-icon::before {
  display: block;
  width: 24px;
  height: 2px;
  border-radius: var(--radius-full);
  background: currentColor;
}

.close-icon {
  position: relative;
  transform: rotate(45deg);
}

.close-icon::before {
  position: absolute;
  left: 0;
  top: 0;
  content: '';
  transform: rotate(90deg);
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

.about-full-interview.is-standalone,
.about-interviews.is-standalone {
  inset: var(--interviste-top-offset, 0px) 0 0;
}

.about-full-interview.is-standalone {
  height: calc(var(--app-viewport-height) - var(--interviste-top-offset, 0px));
  overflow-x: hidden;
  overflow-y: hidden;
  overscroll-behavior: contain;
}

@media (min-width: 1061px) {
  .about-full-interview.is-standalone {
    --about-full-text-left: clamp(420px, 39.68vw, 720px);

    display: block;
    padding: clamp(22px, 3.4vh, 37px) 0 clamp(24px, 4vh, 56px);
  }

  .about-full-interview.is-standalone .about-full-interview-portrait {
    position: absolute;
    top: 0;
    left: 0;
    width: var(--about-full-text-left);
    height: 100%;
    overflow: visible;
  }

  .about-full-interview.is-standalone .about-full-interview-portrait img {
    top: 50%;
    left: calc(50% + var(--full-portrait-x, 0px));
    max-width: none;
    height: var(--full-portrait-height, 614px);
    transform: translate(-50%, -50%) scale(var(--about-full-portrait-scale));
    transform-origin: center center;
    object-fit: contain;
  }

  .about-full-interview.is-standalone .about-full-interview-copy {
    display: flex;
    flex-direction: column;
    width: min(641px, calc(100vw - var(--about-full-text-left) - clamp(40px, 5vw, 80px)));
    min-width: 0;
    height: 100%;
    min-height: 0;
    margin-left: var(--about-full-text-left);
    padding: 0;
  }

  .about-full-interview.is-standalone .about-full-interview-scroll {
    flex: 1 1 auto;
    min-height: 0;
    max-height: none;
  }
}

@media (max-width: 1060px) {
  .about-full-interview.is-standalone {
    display: flex;
    flex-direction: column;
    padding: clamp(18px, 3svh, 28px) clamp(24px, 5vw, 56px) clamp(20px, 3svh, 36px);
  }

  .about-full-interview.is-standalone .about-full-interview-portrait {
    position: relative;
    top: auto;
    left: auto;
    flex: 0 0 clamp(150px, 28svh, 240px);
    width: 100%;
    height: auto;
    margin-top: 0;
  }

  .about-full-interview.is-standalone .about-full-interview-portrait img {
    top: 0;
    left: 50%;
    height: 100%;
    max-width: 100%;
    transform: translateX(-50%);
    object-fit: contain;
  }

  .about-full-interview.is-standalone .about-full-interview-copy {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    width: min(720px, 100%);
    min-height: 0;
    margin: 0 auto;
    padding: 0;
  }

  .about-full-interview.is-standalone .about-full-interview-header h3 {
    font-size: clamp(48px, 7.2vw, 64px);
  }

  .about-full-interview.is-standalone .about-full-interview-scroll {
    flex: 1 1 auto;
    width: 100%;
    min-height: 0;
    max-height: none;
  }
}

@media (min-width: 701px) and (max-width: 1060px) {
  .about-full-interview.is-standalone {
    padding-left: clamp(148px, 17vw, 196px);
  }
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
  width: min(641px, calc(100vw - var(--about-full-text-left) - 40px));
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

.about-full-interview-scroll {
  box-sizing: border-box;
  width: min(589px, 100%);
  max-height: min(520px, calc(var(--app-viewport-height) - 342px));
  margin-top: 44px;
  padding: 22px 22px clamp(42px, 7vh, 68px) 0;
  overflow-x: hidden;
  overflow-y: scroll;
  -webkit-overflow-scrolling: touch;
  touch-action: pan-y;
  overscroll-behavior: contain;
  scrollbar-color: var(--color-text-primary) var(--color-surface-page);
  scrollbar-width: thin;
}

.about-full-interview-scroll::-webkit-scrollbar {
  width: 8px;
}

.about-full-interview-scroll::-webkit-scrollbar-track {
  border: 1px solid var(--color-text-primary);
  background: var(--color-surface-page);
}

.about-full-interview-scroll::-webkit-scrollbar-thumb {
  border: 1px solid var(--color-surface-page);
  background: var(--color-text-primary);
}

.about-full-interview-quote {
  position: relative;
  width: min(641px, 100%);
  margin: 0;
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
  top: 37px;
  right: var(--layout-page-gutter);
  bottom: auto;
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
  text-decoration: none;
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
  -webkit-overflow-scrolling: touch;
  touch-action: pan-x;
  color: var(--color-text-primary);
  scrollbar-width: none;
  overscroll-behavior-x: contain;
}

.about-interviews.is-standalone {
  height: auto;
  overflow-x: hidden;
  overflow-y: hidden;
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

.about-interviews.is-standalone .about-interviews-rail {
  width: 100%;
  min-width: 0;
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

.about-interviews.is-standalone .about-interviews-list,
.about-interviews.is-standalone .about-interviews-copy {
  flex-basis: 50%;
  width: 50%;
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

.about-interviews.is-standalone .about-interviews-copy {
  min-width: 0;
  justify-content: flex-end;
  padding: 0 var(--interviste-navbar-padding-x) 0 clamp(28px, 5.3vw, 80px);
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

.about-interviews.is-standalone .about-interviews-copy-inner {
  width: min(548px, 100%);
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

.about-interviews.is-standalone .about-interviews-copy h3 {
  width: 100%;
  font-size: clamp(54px, 6.4vw, 96px);
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

.about-interviews.is-standalone .about-interviews-copy p {
  width: min(509px, 100%);
  font-size: clamp(16px, 1.45vw, 20px);
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

.about-interviews.is-standalone .about-interview-detail {
  flex: 1 1 50%;
  width: 50%;
  min-width: 0;
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
  transform-origin: top center;
  user-select: none;
}

.about-interview-detail-content {
  position: absolute;
  top: 0;
  left: 272px;
  width: 484px;
  height: 738px;
}

.about-interviews.is-standalone .about-interview-detail-content {
  right: 0;
  width: auto;
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

.about-interviews.is-standalone .about-interview-detail-name {
  width: 100%;
  font-size: clamp(72px, 7.9vw, 120px);
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

.about-interviews.is-standalone .about-interview-detail-card-text {
  width: min(484px, calc(100% - 32px));
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

.about-interviews.is-standalone .about-interview-detail-info-and-button {
  width: min(383px, 100%);
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

.about-interviews.is-standalone .about-interview-detail-description {
  width: 100%;
}

@media (min-width: 701px) {
  .about-interviews.is-standalone .about-interview-detail {
    display: grid;
    grid-template-columns: minmax(120px, clamp(148px, 19vw, 271px)) minmax(0, 1fr);
    column-gap: clamp(18px, 2.6vw, 40px);
    align-items: stretch;
    padding-right: var(--interviste-navbar-padding-x);
  }

  .about-interviews.is-standalone .about-interview-detail-portrait {
    position: relative;
    top: auto;
    left: auto;
    width: 100%;
    height: 100%;
    min-height: 0;
    overflow: visible;
  }

  .about-interviews.is-standalone .about-interview-detail-portrait img {
    top: var(--detail-portrait-y, 0px);
    left: calc(50% + var(--detail-portrait-x, 0px));
    max-width: 100%;
    height: min(var(--detail-portrait-height, 614px), calc(100% - 24px));
    transform: translateX(-50%) scale(var(--detail-portrait-scale, 1));
    object-fit: contain;
  }

  .about-interviews.is-standalone .about-interview-detail-content {
    position: relative;
    top: auto;
    right: auto;
    left: auto;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    width: 100%;
    min-width: 0;
    height: 100%;
    padding-top: clamp(44px, 5.2vh, 56px);
  }

  .about-interviews.is-standalone .about-interview-detail-name {
    position: relative;
    top: auto;
    left: auto;
    display: flex;
    flex: 0 0 auto;
    flex-direction: column;
    justify-content: flex-end;
    width: 100%;
    height: auto;
    min-height: clamp(150px, 22vh, 238px);
    font-size: clamp(54px, 6.6vw, 112px);
    line-height: 0.9;
  }

  .about-interviews.is-standalone .about-interview-detail-name span {
    position: relative;
    top: auto;
    left: auto;
    width: 100%;
    max-width: 100%;
    overflow-wrap: anywhere;
    white-space: normal;
  }

  .about-interviews.is-standalone .about-interview-detail-first {
    margin-left: clamp(0px, 2.2vw, var(--detail-first-name-x, 71px));
  }

  .about-interviews.is-standalone .about-interview-detail-last {
    margin-left: clamp(0px, 0.8vw, var(--detail-last-name-x, 0px));
  }

  .about-interviews.is-standalone .about-interview-detail-card-text {
    position: relative;
    top: auto;
    left: auto;
    width: min(484px, 100%);
    height: auto;
    padding: clamp(18px, 3.6vh, 42px) 0 0;
  }

  .about-interviews.is-standalone .about-interview-detail-role {
    width: min(100%, max-content);
    height: auto;
    font-size: clamp(18px, 1.8vw, 24px);
    white-space: normal;
  }

  .about-interviews.is-standalone .about-interview-detail-info-and-button {
    width: min(383px, 100%);
  }
}

@media (min-width: 701px) and (max-width: 1060px) {
  .about-interviews.is-standalone .about-interview-detail {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto minmax(0, 1fr);
    row-gap: clamp(16px, 2.6vh, 28px);
    padding: clamp(18px, 2.8vw, 32px) var(--interviste-navbar-padding-x) 0 clamp(24px, 4vw, 44px);
  }

  .about-interviews.is-standalone .about-interview-detail-content {
    grid-row: 1;
    height: auto;
    padding-top: 0;
  }

  .about-interviews.is-standalone .about-interview-detail-name {
    min-height: auto;
    font-size: clamp(50px, 8.8vw, 92px);
  }

  .about-interviews.is-standalone .about-interview-detail-card-text {
    padding-top: clamp(14px, 2.4vh, 24px);
  }

  .about-interviews.is-standalone .about-interview-detail-portrait {
    grid-row: 2;
    align-self: end;
    height: 100%;
    min-height: 0;
  }

  .about-interviews.is-standalone .about-interview-detail-portrait img {
    top: auto;
    bottom: 0;
    height: min(var(--detail-portrait-height, 614px), 100%);
    transform: translateX(-50%);
  }
}

@media (min-width: 1061px) {
  .about-interviews.is-standalone .about-interview-detail-content {
    justify-content: center;
    padding-top: 0;
  }
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
  height: 47px;
  padding: 0 16px 7px;
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
  height: 40px;
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
}

.about-interview-detail-cta-icon .figma-arrow-icon-forward {
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
  justify-content: flex-start;
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
  cursor: url('/assets/ui/cursors/retrogusto-pointer-on-cream.svg?v=3') 4 3, pointer;
  overflow: hidden;
  text-align: center;
}

.about-interviews.is-standalone .interview-mini-card {
  gap: clamp(10px, 1.2vw, 17px);
  padding: 0 clamp(24px, 5.3vw, 80px);
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
  margin-left: auto;
  text-align: center;
}

.about-interviews.is-standalone .interview-mini-number {
  flex-basis: clamp(54px, 7.6vw, 115px);
  width: clamp(54px, 7.6vw, 115px);
  font-size: clamp(15px, 1.45vw, 22px);
}

.interview-mini-name {
  position: absolute;
  z-index: 2;
  top: 50%;
  left: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  width: auto;
  max-width: calc(100% - 280px);
  min-width: 0;
  height: auto;
  overflow: hidden;
  text-overflow: ellipsis;
  transform: translate(-50%, -50%);
  white-space: nowrap;
  pointer-events: none;
}

.about-interviews.is-standalone .interview-mini-name {
  max-width: min(var(--interview-name-width), calc(100% - clamp(160px, 27vw, 300px)));
  font-size: clamp(15px, 1.45vw, 22px);
}

.interview-face {
  position: relative;
  display: block;
  align-self: stretch;
  flex: 0 1 var(--mini-portrait-wide-width, 104px);
  width: var(--mini-portrait-wide-width, 104px);
  max-width: min(var(--mini-portrait-wide-width, 104px), 36vw);
  height: 100%;
  min-height: 0;
  overflow: visible;
  isolation: isolate;
}

.about-interviews.is-standalone .interview-face {
  flex-basis: var(--mini-portrait-wide-width, clamp(72px, 9vw, 112px));
  width: var(--mini-portrait-wide-width, clamp(72px, 9vw, 112px));
  max-width: min(var(--mini-portrait-wide-width, 112px), 30vw);
  height: 100%;
}

.interview-face-image,
.interview-face-stroke {
  position: absolute;
  top: 0;
  left: 0;
  display: block;
  width: var(--mini-portrait-render-width, auto);
  height: var(--mini-portrait-render-height, auto);
  max-width: none;
  max-height: none;
  transform-origin: 0 0;
  transform:
    translate3d(
      calc(var(--mini-portrait-x, 0px) + var(--stroke-x, 0px)),
      calc(var(--mini-portrait-y, 0px) + var(--stroke-y, 0px)),
      0
    );
  user-select: none;
  pointer-events: none;
  will-change: transform;
}

.interview-face-image {
  z-index: 2;
}

.interview-face-stroke {
  z-index: 1;
  opacity: 0;
  filter: brightness(0) saturate(100%) invert(96%) sepia(12%) saturate(443%) hue-rotate(324deg) brightness(102%) contrast(95%);
}

.interview-mini-card[aria-current='true'] {
  z-index: 4;
}

.interview-mini-card[aria-current='true'] .interview-face-stroke {
  opacity: 1;
}

.interview-face-stroke.stroke-n { --stroke-y: -4px; }
.interview-face-stroke.stroke-e { --stroke-x: 4px; }
.interview-face-stroke.stroke-s { --stroke-y: 4px; }
.interview-face-stroke.stroke-w { --stroke-x: -4px; }
.interview-face-stroke.stroke-ne { --stroke-x: 3px; --stroke-y: -3px; }
.interview-face-stroke.stroke-se { --stroke-x: 3px; --stroke-y: 3px; }
.interview-face-stroke.stroke-sw { --stroke-x: -3px; --stroke-y: 3px; }
.interview-face-stroke.stroke-nw { --stroke-x: -3px; --stroke-y: -3px; }

@media (max-height: 760px) and (min-width: 701px) {
  .about-interviews.is-standalone .interview-face {
    flex-basis: min(var(--mini-portrait-fit-width, 80px), 100%);
    width: min(var(--mini-portrait-fit-width, 80px), 100%);
    max-width: min(var(--mini-portrait-fit-width, 80px), 11vh);
  }
}

@media (max-width: 1060px) {
  .about-interviews.is-standalone .interview-face {
    flex-basis: 0;
    width: 0;
    max-width: 0;
    opacity: 0;
  }
}

  @media (max-width: 700px) {
  .interviste-page {
    --interviste-navbar-height: var(--layout-topbar-height-mobile);
    --interviste-navbar-padding-x: var(--layout-page-gutter-mobile);
  }

  .interviste-top-bar {
    padding: var(--layout-topbar-padding-mobile);
  }

  .logo,
  .icon-button {
    width: var(--button-icon-size);
    height: var(--button-icon-size);
  }

  .logo {
    font-size: 34px;
  }

  .about-interviews {
    inset: var(--layout-topbar-height-mobile) 0 0;
  }
  .about-interviews.is-standalone,
  .about-full-interview.is-standalone {
    inset: var(--interviste-top-offset, 0px) 0 0;
  }
  .about-interviews.is-standalone {
    overflow-x: hidden;
    overflow-y: auto;
  }
  .about-interviews.is-standalone .about-interviews-rail {
    flex-direction: column;
    width: 100%;
    min-height: 100%;
    height: auto;
  }
  .about-interviews.is-standalone .about-interviews-list,
  .about-interviews.is-standalone .about-interviews-copy,
  .about-interviews.is-standalone .about-interview-detail {
    flex: 0 0 auto;
    width: 100%;
  }
  .about-interviews.is-standalone .about-interviews-list {
    height: min(100%, 560px);
    min-height: 0;
    border-right: 0;
  }
  .about-interviews.is-standalone .interview-mini-card {
    min-height: 60px;
    padding: 0 var(--layout-page-gutter-mobile);
  }
  .about-interviews.is-standalone .interview-mini-name {
    max-width: calc(100% - 112px);
    height: auto;
    font-size: clamp(14px, 4.3vw, 18px);
  }
  .about-interviews.is-standalone .interview-mini-number {
    flex: 0 0 44px;
    width: 44px;
    font-size: clamp(14px, 4vw, 17px);
  }
  .about-interviews.is-standalone .interview-face {
    flex-basis: var(--mini-portrait-wide-width, clamp(56px, 18vw, 76px));
    width: var(--mini-portrait-wide-width, clamp(56px, 18vw, 76px));
    max-width: min(var(--mini-portrait-wide-width, 76px), 28vw);
    height: 100%;
  }
  .about-interviews.is-standalone .about-interviews-copy {
    min-height: 38svh;
    padding: 24px var(--layout-page-gutter-mobile) 42px;
    border-top: 2px solid var(--color-text-primary);
  }
  .about-interviews.is-standalone .about-interviews-copy-inner {
    width: 100%;
    padding: 0;
  }
  .about-interviews.is-standalone .about-interviews-copy h3 {
    font-size: clamp(44px, 15vw, 64px);
  }
  .about-interviews.is-standalone .about-interviews-copy p {
    font-size: 14px;
    line-height: 1.25;
  }
  .about-interviews.is-standalone .about-interview-detail {
    min-height: 520px;
    overflow: visible;
    border-top: 2px solid var(--color-text-primary);
  }
  .about-interviews.is-standalone .about-interview-detail-portrait {
    width: clamp(118px, 35vw, 180px);
    height: 100%;
  }
  .about-interviews.is-standalone .about-interview-detail-portrait img {
    height: clamp(330px, 86vw, 520px);
  }
  .about-interviews.is-standalone .about-interview-detail-content {
    left: clamp(128px, 38vw, 196px);
    right: var(--layout-page-gutter-mobile);
    width: auto;
    height: auto;
  }
  .about-interviews.is-standalone .about-interview-detail-name {
    width: 100%;
    height: clamp(156px, 45vw, 220px);
    font-size: clamp(52px, 16vw, 84px);
  }
  .about-interviews.is-standalone .about-interview-detail-first {
    left: clamp(-6px, 2vw, 28px);
  }
  .about-interviews.is-standalone .about-interview-detail-last {
    top: clamp(54px, 15vw, 84px);
    left: clamp(-8px, 1vw, 12px);
  }
  .about-interviews.is-standalone .about-interview-detail-card-text {
    top: clamp(168px, 48vw, 230px);
    width: 100%;
    height: auto;
    padding: 24px 0 40px;
  }
  .about-interviews.is-standalone .about-interview-detail-role {
    height: auto;
    font-size: clamp(16px, 4.2vw, 21px);
    white-space: normal;
  }
  .about-interviews.is-standalone .about-interview-detail-info-and-button {
    width: 100%;
    gap: 18px;
  }
  .about-interviews.is-standalone .about-interview-detail-description {
    font-size: 14px;
    line-height: 1.25;
  }
  .about-interviews.is-standalone .about-interview-detail-cta {
    width: min(224px, 100%);
  }
  .about-full-interview {
    inset: var(--layout-topbar-height-mobile) 0 0;
    padding: 0;
  }
  .about-full-interview.is-standalone {
    display: flex;
    flex-direction: column;
    height: calc(var(--app-viewport-height) - var(--interviste-top-offset, 0px));
    overflow: hidden;
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
    flex: 0 0 clamp(156px, 30svh, 238px);
    width: 100%;
    height: auto;
    margin-top: 8px;
  }
  .about-full-interview-portrait img {
    top: 0;
    left: 50%;
    height: 100%;
    max-width: 100%;
    object-fit: contain;
    transform: translateX(-50%);
  }
  .about-full-interview-copy {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    width: 100%;
    min-height: 0;
    margin-left: 0;
    overflow: hidden;
    padding: 12px var(--layout-page-gutter-mobile) 24px;
  }
  .about-full-interview-header h3 {
    font-size: clamp(48px, 15vw, 64px);
  }
  .about-full-interview-header p {
    font-size: 14px;
  }
  .about-full-interview-scroll {
    flex: 1 1 auto;
    width: 100%;
    min-height: 0;
    max-height: none;
    margin-top: 18px;
    padding: 18px 14px clamp(36px, 8vh, 58px) 0;
  }
  .about-full-interview-quote {
    font-size: clamp(18px, 5.4vw, 24px);
    line-height: 1.34;
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

  }
</style>
