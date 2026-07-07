<script lang="ts">
  import { onMount } from 'svelte';
  import { clamp, ease, px } from '$lib/scene/math';
  import { getSceneAssetStyle } from '$lib/scene/scene-utils';
  import { loadGsapWithScrollTrigger } from '$lib/scene/gsap-loader';
  import { createViewportObserver } from '$lib/scene/viewport';
  import { triggerTapClickFeedback } from '$lib/scene/tap-click-feedback';
  import type { SceneChunk } from '$lib/scene/scene-asset.types';
  import SceneLoadingProgress from '$lib/scene/SceneLoadingProgress.svelte';
  import SceneProgressBar from '$lib/scene/SceneProgressBar.svelte';
  import type { ParallaxPhaserGameHandle } from '$lib/scene/phaser/ParallaxPhaserGame';
  import {
    resolvedServiceSceneConfig,
    serviceBackgroundChunks,
    serviceBackgroundOffsetY,
    serviceFloorAssets,
    serviceForegroundAssets,
    serviceMiddleAssets
  } from './service-scene.config';

  let { isAudioMuted = false, onSceneRevealedChange } = $props<{
    isAudioMuted?: boolean;
    onSceneRevealedChange?: (isRevealed: boolean) => void;
  }>();

  const { assetVersion, layerSpeed, sceneHeight, sceneWidth } = resolvedServiceSceneConfig;
  const serviceBackgroundViewportOffsetY = 1;
  const serviceMiddleViewportOffsetY = 8;

  let stageEl: HTMLElement;
  let viewportWidth = $state(0);
  let viewportHeight = $state(0);
  let cameraX = $state(0);
  let targetCameraX = 0;
  let isDragging = $state(false);
  let isSceneLoaded = $state(false);
  let isPhaserReady = $state(false);
  let isSceneRevealed = $state(false);
  let phaserLoadingProgress = $state(0);
  let prefersReducedMotion = $state(false);
  let hasPointerScenePosition = $state(false);
  let pointerSceneY = $state(0);
  let pointerSceneX = $state({
    background: 0,
    middle: 0,
    foreground: 0
  });
  let serviceAmbientAudioEl: HTMLAudioElement;
  let isAmbientAudioStarted = false;
  let serviceAmbientFadeFrame: number | undefined;
  let shouldResumeServiceAudioFromMutedPage = false;
  let nearestSceneAsset = $state<{ id: string; distance: number }>();
  let hoveredServiceAssetId = $state<string | undefined>();
  let carloServiceAudioEl: HTMLAudioElement;
  let isCarloServiceAudioActive = $state(false);
  let isCarloServiceAudioStarting = false;
  let hasPlayedCarloServiceAudio = false;
  let carloServiceRevealProgress = $state(0);
  let carloServiceMutedPageIndex = $state(0);
  let carloServiceFadeFrame: number | undefined;
  let elisabettaServiceAudioEl: HTMLAudioElement;
  let isElisabettaServiceAudioActive = $state(false);
  let isElisabettaServiceAudioStarting = false;
  let hasPlayedElisabettaServiceAudio = false;
  let elisabettaServiceRevealProgress = $state(0);
  let elisabettaServiceMutedPageIndex = $state(0);
  let elisabettaServiceFadeFrame: number | undefined;
  let marcoServiceAudioEl: HTMLAudioElement;
  let isMarcoServiceAudioActive = $state(false);
  let isMarcoServiceAudioStarting = false;
  let hasPlayedMarcoServiceAudio = false;
  let marcoServiceRevealProgress = $state(0);
  let marcoServiceMutedPageIndex = $state(0);
  let marcoServiceFadeFrame: number | undefined;
  let faustoServiceAudioEl: HTMLAudioElement;
  let isFaustoServiceAudioActive = $state(false);
  let isFaustoServiceAudioStarting = false;
  let hasPlayedFaustoServiceAudio = false;
  let faustoServiceRevealProgress = $state(0);
  let faustoServiceMutedPageIndex = $state(0);
  let faustoServiceFadeFrame: number | undefined;
  let niniServiceAudioEl: HTMLAudioElement;
  let isNiniServiceAudioActive = $state(false);
  let isNiniServiceAudioStarting = false;
  let hasPlayedNiniServiceAudio = false;
  let niniServiceRevealProgress = $state(0);
  let niniServiceMutedPageIndex = $state(0);
  let niniServiceFadeFrame: number | undefined;
  let servicePhaserContainerEl: HTMLElement;
  let servicePhaserGame: ParallaxPhaserGameHandle | undefined;
  let servicePhaserResizeTimer: number | undefined;
  let sceneRevealTimer: ReturnType<typeof setTimeout> | undefined;
  const sceneRevealDelayMs = 560;
  let dragStartX = 0;
  let dragScrollStart = 0;
  let scrollTrigger:
    | {
        end: number;
        kill: () => void;
        refresh: () => void;
        scroll: (value?: number) => number;
        start: number;
      }
    | undefined;

  const resolvedLayerSpeed = $derived({
    background: prefersReducedMotion ? 1 : layerSpeed.background,
    middle: prefersReducedMotion ? 1 : layerSpeed.middle,
    floor: prefersReducedMotion ? 1 : layerSpeed.floor,
    foreground: prefersReducedMotion ? 1 : layerSpeed.foreground,
    title: prefersReducedMotion ? 1 : layerSpeed.title
  });
  const sceneScale = $derived(viewportHeight ? viewportHeight / sceneHeight : 1);
  const worldWidth = $derived(Math.max(viewportWidth, sceneWidth * sceneScale));
  const maxScrollX = $derived(Math.max(0, worldWidth - viewportWidth));
  const progress = $derived(maxScrollX > 0 ? clamp(cameraX / maxScrollX, 0, 1) : 0);
  const isSceneInteractive = $derived(isSceneRevealed);
  const servicePhaserAssets = [...serviceFloorAssets, ...serviceMiddleAssets, ...serviceForegroundAssets];
  const serviceCoordinateAssets = [...serviceMiddleAssets, ...serviceForegroundAssets];
  const serviceProgressTicks = $derived(
    maxScrollX > 0
      ? [
          getElisabettaServiceStartCameraX() / maxScrollX,
          getMarcoServiceStartCameraX() / maxScrollX,
          getFaustoServiceStartCameraX() / maxScrollX,
          getNiniServiceStartCameraX() / maxScrollX
        ]
      : []
  );
  const scenePx = (value: number) => px(value, 2);
  const coord = (value: number) => Math.round(value).toString();
  const coordDecimal = (value: number) => value.toFixed(3);
  const scrollSpaceStyle = $derived(
    `width: ${scenePx(worldWidth)}; height: ${scenePx(viewportHeight)}`
  );
  const worldStyle = $derived(
    `width: ${scenePx(viewportWidth)}; height: ${scenePx(viewportHeight)}`
  );
  const serviceHandoffResistance = {
    maxFactor: 0.92,
    minFactor: 0.68,
    zoneBeforeDisappearPx: 350
  };
  const firstServiceDialogueStartCameraX = 600;
  const finalServiceDialogueEndOffsetPx = 600;
  const serviceMascotAsset = serviceMiddleAssets.find((asset) => asset.id === '2_mascotte');
  const serviceMascotHoverText =
    'Con gli atleti ci sono ogni 3 giorni degli appuntamenti mattutini alle 07:30';
  const servicePitcherAsset = serviceForegroundAssets.find((asset) => asset.id === '1_brocca');
  const servicePitcherHoverText = 'Gli atleti non possono far coda, non possono aspettare';
  const servicePitcherHitboxInsetFactor = 0.08;
  const serviceClocheAsset = serviceForegroundAssets.find((asset) => asset.id === '1_cloche');
  const serviceClocheHoverText =
    'Ogni giorno, tra Milano, Cortina e Predazzo, si servivano oltre 10.000 pasti.';
  const serviceClocheHitboxWidthFactor = 0.29;
  const serviceBottlesAsset = serviceForegroundAssets.find((asset) => asset.id === '1_BottiglieVaso');
  const serviceBottlesHoverText = 'C’era molta Italia, fatta con ricette italiane';
  const serviceCameraAsset = serviceForegroundAssets.find((asset) => asset.id === '1_camera');
  const serviceCameraHoverText =
    'Durante i media day, nelle dining entravano anche luci, support staff e squadre di comunicazione degli atleti';
  const serviceLunchboxAsset = serviceForegroundAssets.find((asset) => asset.id === '1_Lunchbox');
  const serviceLunchboxHoverText =
    'Per gestire allergie e intolleranze alimentari, il servizio prevede sempre alternative dedicate';
  const serviceAmbientVolume = 0.28;
  const serviceAmbientDuckedVolume = 0.1;
  const serviceAmbientFadeInDuration = 1.2;
  const serviceAmbientFadeOutDuration = 0.36;
  const carloServiceAudioVolume = 0.86;
  const serviceAudioFadeInDuration = 0.18;
  const serviceAudioHandoffFadeOutDuration = 0.16;
  const carloServiceAudioFadeOutDuration = 0.18;
  const carloServiceRevealDurationSeconds = 75.68;
  const carloServiceEndCameraX = 5000;
  const carloServiceSpeech =
    "I sette clienti quali sono? Primo, ovviamente gli atleti. Possono mangiare 24 ore al giorno. Poi il secondo gruppo sono i volontari: sono 18.000 persone; la maggior parte lavorano anche all'aperto, quindi devi dargli dei pasti molto caldi. Il terzo sono la workforce. Sono quelli, come lo ero io, che hanno dei ruoli di management, o anche semplicemente dei ruoli esecutivi. La famiglia olimpica sono presidenti dei Comitati Olimpici Nazionali, sono, in questo caso da noi, Mattarella, Meloni. Questi, devo dire molto onestamente, non sono pretenziosi. Questo gruppo dice \"No signori, non vogliamo mandare il messaggio che noi ci trattiamo bene\". Il quinto gruppo è formato dai media. Sono divisi in due gruppi: i giornalisti e le televisioni. All'interno delle televisioni ci sono anche i giornalisti, però ci sono quei poveri cameraman che anche loro, magari alle 7 del mattino, sono lì con le telecamere che nevica. Il sesto gruppo è il gruppo delle hospitality: questi sono i VIP, gli sponsor, che non hanno problemi di budget. E poi ci sono gli spettatori. A Milano son stati quasi un milione e mezzo. Quindi la mia programmazione generale per i 22 giorni di gara è stata sui 3 milioni circa di pasti.";
  const elisabettaServiceAudioVolume = 0.86;
  const elisabettaServiceAudioFadeOutDuration = 0.18;
  const elisabettaServiceRevealDurationSeconds = 27.14;
  const elisabettaServiceStartCameraX = 5200;
  const elisabettaServiceEndCameraX = 7200;
  const elisabettaServiceSpeech =
    "L'obiettivo principale del cibo nel villaggio noi lo chiamavamo “Food for Fuel”, cioè quello di dare agli atleti esattamente tutto quello di cui hanno bisogno per aiutarli nelle loro performance, quindi è chiaro che ci sono dei pilastri fondamentali: carboidrati, proteine sempre presenti in rotazione. E poi ovviamente l'atro aspetto fondamentale è quello della Food Safety.";
  const marcoServiceAudioVolume = 0.86;
  const marcoServiceAudioFadeOutDuration = 0.18;
  const marcoServiceRevealDurationSeconds = 23.17;
  const marcoServiceStartCameraX = 7400;
  const marcoServiceEndCameraX = 10400;
  const marcoServiceSpeech =
    "Noi facevamo un menù di 5 giorni che andava a ripetersi. Quello che chiedevano chiaramente era roba fresca, fatta bene, preparata al momento e la disponibilità di orari. Le colazioni partivano alle 5 del mattino. Poi c'erano due persone giù di cucina, più la sala, che allestivano il breakfast: cereali, frutta, verdura, anche la pasta di prima mattina, perché gli atleti comunque hanno bisogno di una dieta particolare.";
  const faustoServiceAudioVolume = 0.86;
  const faustoServiceAudioFadeOutDuration = 0.18;
  const faustoServiceRevealDurationSeconds = 39.94;
  const faustoServiceStartCameraX = 10600;
  const faustoServiceEndCameraX = 13600;
  const faustoServiceSpeech =
    "C'erano sul buffet di benvenuto con il calice piccoli assaggi. Poi l'ospite si spostava nella sala centrale dove c'erano vari buffet, tra cui uno di salumi e formaggi, ovviamente i formaggi locali: il taleggio, il puzzone di Moena... Poi c'erano due primi, sempre caldi, a disposizione dei nostri ospiti. Una polenta sempre fissa e tre dolci a rotazione. Non erano previsti superalcolici. Di alcolico avevamo lo sponsor della birra, e i vini, principalmente Prosecco e poi qualche vino della Valtellina, qualche vino del Veneto e così via.";
  const niniServiceAudioVolume = 0.86;
  const niniServiceAudioFadeOutDuration = 0.18;
  const niniServiceRevealDurationSeconds = 34;
  const niniServiceStartCameraX = 13800;
  const niniServiceEndCameraX = 16300;
  const niniServiceSpeech =
    "Purtroppo c'erano a volte molti sprechi. Tu prepari per 500, poi era il cliente che faceva lo spreco. Nel senso che, se tu metti la pizza e di fianco metti l'arrosto, secondo te cosa vince? Però l'arrosto doveva essere pronto per 500 come la pizza doveva essere pronta per 500. Fortunatamente sapevano equilibrare e quindi gli sprechi sono stati minimizzati. Lo smaltimento veniva fatto praticamente 2-3 volte al giorno perché i volumi erano tanti. Anche perché, per assurdo, quando fai mille persone, sono mille bottigliette d'acqua. Su quel lato lì, Livigno è stata tanta roba, uno perché erano organizzati, due perché c'era il servizio.";
  const carloServiceEnterDistance = $derived(Math.max(130, viewportWidth * 0.16));
  const carloServiceExitDistance = $derived(Math.max(170, viewportWidth * 0.2));
  const elisabettaServiceEnterDistance = $derived(Math.max(130, viewportWidth * 0.13));
  const elisabettaServiceExitDistance = $derived(Math.max(170, viewportWidth * 0.16));
  const marcoServiceEnterDistance = $derived(Math.max(130, viewportWidth * 0.13));
  const marcoServiceExitDistance = $derived(Math.max(170, viewportWidth * 0.16));
  const faustoServiceEnterDistance = $derived(Math.max(130, viewportWidth * 0.13));
  const faustoServiceExitDistance = $derived(Math.max(170, viewportWidth * 0.16));
  const niniServiceEnterDistance = $derived(Math.max(130, viewportWidth * 0.13));
  const niniServiceExitDistance = $derived(Math.max(170, viewportWidth * 0.16));
  const carloServiceSpeechPages = $derived(getCarloServiceSpeechPages());
  const carloServiceSpeechPageCount = $derived(carloServiceSpeechPages.length);
  const carloServiceVisiblePageIndex = $derived(getCarloServiceVisiblePageIndex());
  const carloServiceSpeechInfo = $derived(getCarloServiceCurrentSpeechPageInfo());
  const elisabettaServiceSpeechPages = $derived(getElisabettaServiceSpeechPages());
  const elisabettaServiceSpeechPageCount = $derived(elisabettaServiceSpeechPages.length);
  const elisabettaServiceVisiblePageIndex = $derived(getElisabettaServiceVisiblePageIndex());
  const elisabettaServiceSpeechInfo = $derived(getElisabettaServiceCurrentSpeechPageInfo());
  const marcoServiceSpeechPages = $derived(getMarcoServiceSpeechPages());
  const marcoServiceSpeechPageCount = $derived(marcoServiceSpeechPages.length);
  const marcoServiceVisiblePageIndex = $derived(getMarcoServiceVisiblePageIndex());
  const marcoServiceSpeechInfo = $derived(getMarcoServiceCurrentSpeechPageInfo());
  const faustoServiceSpeechPages = $derived(getFaustoServiceSpeechPages());
  const faustoServiceSpeechPageCount = $derived(faustoServiceSpeechPages.length);
  const faustoServiceVisiblePageIndex = $derived(getFaustoServiceVisiblePageIndex());
  const faustoServiceSpeechInfo = $derived(getFaustoServiceCurrentSpeechPageInfo());
  const niniServiceSpeechPages = $derived(getNiniServiceSpeechPages());
  const niniServiceSpeechPageCount = $derived(niniServiceSpeechPages.length);
  const niniServiceVisiblePageIndex = $derived(getNiniServiceVisiblePageIndex());
  const niniServiceSpeechInfo = $derived(getNiniServiceCurrentSpeechPageInfo());

  function serviceChunkPath(chunk: SceneChunk) {
    return `servizio-figma/sfondo/Slice ${chunk.frameIndex + 1}.png`;
  }

  function syncViewport() {
    if (!stageEl) return;
    viewportWidth = Math.max(1, stageEl.clientWidth);
    viewportHeight = Math.max(1, stageEl.clientHeight);
    targetCameraX = clamp(targetCameraX, 0, maxScrollX);
    cameraX = clamp(cameraX, 0, maxScrollX);
    servicePhaserGame?.setCameraX(cameraX);
    scheduleServicePhaserResize();
    scrollTrigger?.refresh();
  }

  function scheduleServicePhaserResize() {
    if (!servicePhaserGame || !viewportWidth || !viewportHeight) return;
    if (servicePhaserResizeTimer) window.clearTimeout(servicePhaserResizeTimer);

    servicePhaserResizeTimer = window.setTimeout(() => {
      servicePhaserResizeTimer = undefined;
      servicePhaserGame?.resize(viewportWidth, viewportHeight);
      servicePhaserGame?.setCameraX(cameraX);
    }, 0);
  }

  function setTargetCameraX(value: number) {
    targetCameraX = clamp(value, 0, maxScrollX);
  }

  function applyCarloServiceScrollResistance(nextValue: number, baseValue = targetCameraX) {
    const delta = nextValue - baseValue;
    const activeCarlo = isCarloServiceAudioUnfinished();
    const activeElisabetta = isElisabettaServiceAudioUnfinished();
    const activeMarco = isMarcoServiceAudioUnfinished();
    const activeFausto = isFaustoServiceAudioUnfinished();
    const activeNini = isNiniServiceAudioUnfinished();
    if (delta <= 0 || (!activeCarlo && !activeElisabetta && !activeMarco && !activeFausto && !activeNini)) {
      return nextValue;
    }

    const exitCameraX = activeNini
      ? getNiniServiceEndCameraX()
      : activeFausto
      ? getFaustoServiceEndCameraX()
      : activeMarco
      ? getMarcoServiceEndCameraX()
      : activeElisabetta
        ? getElisabettaServiceEndCameraX()
        : getCarloServiceExitCameraX();
    const enterCameraX = activeNini
      ? getNiniServiceStartCameraX()
      : activeFausto
      ? getFaustoServiceStartCameraX()
      : activeMarco
      ? getMarcoServiceStartCameraX()
      : activeElisabetta
        ? getElisabettaServiceStartCameraX()
        : getCarloServiceEnterCameraX();
    const stickyStart = Math.max(
      enterCameraX,
      exitCameraX - serviceHandoffResistance.zoneBeforeDisappearPx
    );
    const stickyEnd = exitCameraX;
    if (cameraX < stickyStart || cameraX > stickyEnd) return nextValue;

    const releaseProgress = clamp((cameraX - stickyStart) / Math.max(stickyEnd - stickyStart, 1), 0, 1);
    const factor =
      serviceHandoffResistance.maxFactor -
      ease(releaseProgress) *
        (serviceHandoffResistance.maxFactor - serviceHandoffResistance.minFactor);
    return baseValue + delta * factor;
  }

  function setTargetCameraXWithResistance(value: number) {
    targetCameraX = clamp(applyCarloServiceScrollResistance(value), 0, maxScrollX);
  }

  function scrollBy(delta: number) {
    if (!isSceneInteractive) return;
    setTargetCameraXWithResistance(targetCameraX + delta);
  }

  function evaluateScene(delta: number) {
    if (!isSceneInteractive) {
      targetCameraX = 0;
      cameraX = 0;
      servicePhaserGame?.setCameraX(0);
      return;
    }

    if (
      targetCameraX > cameraX &&
      (isCarloServiceAudioUnfinished() ||
        isElisabettaServiceAudioUnfinished() ||
        isMarcoServiceAudioUnfinished() ||
        isFaustoServiceAudioUnfinished() ||
        isNiniServiceAudioUnfinished())
    ) {
      targetCameraX = applyCarloServiceScrollResistance(targetCameraX, cameraX);
    }

    const distance = targetCameraX - cameraX;
    const frameScale = Math.min(delta / 16.667, 2.4);
    const amount = prefersReducedMotion ? 1 : isDragging ? 0.28 : 0.14;
    const stepAmount = 1 - Math.pow(1 - amount, frameScale);

    cameraX = Math.abs(distance) < 0.08 ? targetCameraX : cameraX + distance * stepAmount;
    cameraX = clamp(cameraX, 0, maxScrollX);
    targetCameraX = clamp(targetCameraX, 0, maxScrollX);
    servicePhaserGame?.setCameraX(cameraX);
  }

  function getCarloServiceEnterCameraX() {
    return clamp(firstServiceDialogueStartCameraX, 0, maxScrollX);
  }

  function getCarloServiceExitCameraX() {
    return clamp(carloServiceEndCameraX, 0, maxScrollX);
  }

  function getElisabettaServiceStartCameraX() {
    return clamp(elisabettaServiceStartCameraX, 0, maxScrollX);
  }

  function getElisabettaServiceEndCameraX() {
    return clamp(
      Math.max(elisabettaServiceEndCameraX, getElisabettaServiceStartCameraX() + viewportWidth * 0.32),
      getElisabettaServiceStartCameraX(),
      maxScrollX
    );
  }

  function getMarcoServiceStartCameraX() {
    return clamp(marcoServiceStartCameraX, 0, maxScrollX);
  }

  function getMarcoServiceEndCameraX() {
    return clamp(
      Math.max(marcoServiceEndCameraX, getMarcoServiceStartCameraX() + viewportWidth * 0.32),
      getMarcoServiceStartCameraX(),
      maxScrollX
    );
  }

  function getFaustoServiceStartCameraX() {
    return clamp(faustoServiceStartCameraX, 0, maxScrollX);
  }

  function getFaustoServiceEndCameraX() {
    return clamp(
      Math.max(faustoServiceEndCameraX, getFaustoServiceStartCameraX() + viewportWidth * 0.32),
      getFaustoServiceStartCameraX(),
      maxScrollX
    );
  }

  function getNiniServiceStartCameraX() {
    return clamp(niniServiceStartCameraX, 0, maxScrollX);
  }

  function getNiniServiceEndCameraX() {
    return clamp(
      maxScrollX - finalServiceDialogueEndOffsetPx,
      getNiniServiceStartCameraX() + viewportWidth * 0.32,
      maxScrollX
    );
  }

  function getCarloServicePresence() {
    const enter = clamp(
      (cameraX - getCarloServiceEnterCameraX()) / Math.max(carloServiceEnterDistance, 1),
      0,
      1
    );
    const exit = 1 - clamp(
      (cameraX - getCarloServiceExitCameraX()) / Math.max(carloServiceExitDistance, 1),
      0,
      1
    );

    return clamp(ease(enter) * ease(exit), 0, 1);
  }

  function isCarloServiceDialogueVisible() {
    return getCarloServicePresence() > 0.16;
  }

  function isCarloServiceAudioUnfinished() {
    if (isCarloServiceAudioStarting) return true;
    if (!isCarloServiceAudioActive || !carloServiceAudioEl || carloServiceAudioEl.paused || carloServiceAudioEl.ended) {
      return false;
    }

    const duration = Number.isFinite(carloServiceAudioEl.duration)
      ? carloServiceAudioEl.duration
      : carloServiceRevealDurationSeconds;

    return carloServiceAudioEl.currentTime < duration - 0.2;
  }

  function getElisabettaServicePresence() {
    const enter = clamp(
      (cameraX - getElisabettaServiceStartCameraX()) / Math.max(elisabettaServiceEnterDistance, 1),
      0,
      1
    );
    const exit = 1 - clamp(
      (cameraX - getElisabettaServiceEndCameraX()) / Math.max(elisabettaServiceExitDistance, 1),
      0,
      1
    );

    return clamp(ease(enter) * ease(exit), 0, 1);
  }

  function isElisabettaServiceDialogueVisible() {
    return getElisabettaServicePresence() > 0.16;
  }

  function isElisabettaServiceAudioUnfinished() {
    if (isElisabettaServiceAudioStarting) return true;
    if (
      !isElisabettaServiceAudioActive ||
      !elisabettaServiceAudioEl ||
      elisabettaServiceAudioEl.paused ||
      elisabettaServiceAudioEl.ended
    ) {
      return false;
    }

    const duration = Number.isFinite(elisabettaServiceAudioEl.duration)
      ? elisabettaServiceAudioEl.duration
      : elisabettaServiceRevealDurationSeconds;

    return elisabettaServiceAudioEl.currentTime < duration - 0.2;
  }

  function getMarcoServicePresence() {
    const enter = clamp(
      (cameraX - getMarcoServiceStartCameraX()) / Math.max(marcoServiceEnterDistance, 1),
      0,
      1
    );
    const exit = 1 - clamp(
      (cameraX - getMarcoServiceEndCameraX()) / Math.max(marcoServiceExitDistance, 1),
      0,
      1
    );

    return clamp(ease(enter) * ease(exit), 0, 1);
  }

  function isMarcoServiceDialogueVisible() {
    return getMarcoServicePresence() > 0.16;
  }

  function isMarcoServiceAudioUnfinished() {
    if (isMarcoServiceAudioStarting) return true;
    if (!isMarcoServiceAudioActive || !marcoServiceAudioEl || marcoServiceAudioEl.paused || marcoServiceAudioEl.ended) {
      return false;
    }

    const duration = Number.isFinite(marcoServiceAudioEl.duration)
      ? marcoServiceAudioEl.duration
      : marcoServiceRevealDurationSeconds;

    return marcoServiceAudioEl.currentTime < duration - 0.2;
  }

  function getFaustoServicePresence() {
    const enter = clamp(
      (cameraX - getFaustoServiceStartCameraX()) / Math.max(faustoServiceEnterDistance, 1),
      0,
      1
    );
    const exit = 1 - clamp(
      (cameraX - getFaustoServiceEndCameraX()) / Math.max(faustoServiceExitDistance, 1),
      0,
      1
    );

    return clamp(ease(enter) * ease(exit), 0, 1);
  }

  function isFaustoServiceDialogueVisible() {
    return getFaustoServicePresence() > 0.16;
  }

  function isFaustoServiceAudioUnfinished() {
    if (isFaustoServiceAudioStarting) return true;
    if (!isFaustoServiceAudioActive || !faustoServiceAudioEl || faustoServiceAudioEl.paused || faustoServiceAudioEl.ended) {
      return false;
    }

    const duration = Number.isFinite(faustoServiceAudioEl.duration)
      ? faustoServiceAudioEl.duration
      : faustoServiceRevealDurationSeconds;

    return faustoServiceAudioEl.currentTime < duration - 0.2;
  }

  function getNiniServicePresence() {
    const enter = clamp(
      (cameraX - getNiniServiceStartCameraX()) / Math.max(niniServiceEnterDistance, 1),
      0,
      1
    );
    const exit = 1 - clamp(
      (cameraX - getNiniServiceEndCameraX()) / Math.max(niniServiceExitDistance, 1),
      0,
      1
    );

    return clamp(ease(enter) * ease(exit), 0, 1);
  }

  function isNiniServiceDialogueVisible() {
    return getNiniServicePresence() > 0.16;
  }

  function isNiniServiceAudioUnfinished() {
    if (isNiniServiceAudioStarting) return true;
    if (!isNiniServiceAudioActive || !niniServiceAudioEl || niniServiceAudioEl.paused || niniServiceAudioEl.ended) {
      return false;
    }

    const duration = Number.isFinite(niniServiceAudioEl.duration)
      ? niniServiceAudioEl.duration
      : niniServiceRevealDurationSeconds;

    return niniServiceAudioEl.currentTime < duration - 0.2;
  }

  function getCarloServiceBubbleWidth() {
    if (viewportWidth <= 760) return Math.min(330, Math.max(260, viewportWidth - 96));
    return 350;
  }

  function getCarloServiceBubbleCopyHeight() {
    if (viewportWidth <= 760) return 142;
    return 172;
  }

  function getCarloServiceBubbleMetaHeight() {
    return viewportWidth <= 760 ? 41 : 34;
  }

  function getCarloServiceBubbleHeight() {
    return getCarloServiceBubbleCopyHeight() + getCarloServiceBubbleMetaHeight() - 2;
  }

  function getCarloServiceStyle() {
    const presence = getCarloServicePresence();
    const assetWidth = 1304;
    const assetHeight = 2960;
    const characterScale = viewportWidth <= 760 ? 1.1 : 1.16;
    const kitchenMatchingWidth = Math.max(315, Math.min(370, viewportWidth * 0.245));
    const kitchenMatchingHeight = kitchenMatchingWidth * (565 / 185) * characterScale;
    const width = kitchenMatchingHeight / (assetHeight / assetWidth);
    const characterHeight = width * (assetHeight / assetWidth);
    const bubbleHeight = getCarloServiceBubbleHeight();
    const gap = viewportWidth <= 760 ? 14 : 12;
    const characterLift = viewportWidth <= 760 ? 36 : 64;
    const topInset = (viewportWidth <= 760 ? 88 : 104) + 40;
    const characterTop = topInset + bubbleHeight + gap - characterLift;
    const bottomOffset = characterTop + characterHeight - viewportHeight;
    const entryY = (1 - presence) * Math.max(360, Math.min(520, viewportHeight * 0.54));
    const bubbleWidth = getCarloServiceBubbleWidth();
    const bubbleLeft = viewportWidth <= 760 ? 24 : 80;
    const characterLeft = bubbleLeft + bubbleWidth / 2 - width / 2;
    const bubbleOffsetX = 0;
    const arrowLeft = clamp(bubbleWidth / 2 - bubbleOffsetX, 18, bubbleWidth - 18);

    return [
      `left: ${scenePx(characterLeft)}`,
      `bottom: ${scenePx(-bottomOffset)}`,
      `width: ${scenePx(width)}`,
      `--chef-entry-y: ${scenePx(entryY)}`,
      `--chef-entry-opacity: ${presence.toFixed(3)}`,
      `--speech-bubble-width: ${scenePx(bubbleWidth)}`,
      `--speech-bubble-copy-height: ${scenePx(getCarloServiceBubbleCopyHeight())}`,
      `--speech-bubble-meta-height: ${scenePx(getCarloServiceBubbleMetaHeight())}`,
      `--speech-bubble-offset-x: ${scenePx(bubbleOffsetX)}`,
      `--speech-bubble-arrow-left: ${scenePx(arrowLeft)}`,
      `--speech-bubble-top: ${scenePx(topInset - characterTop)}`
    ].join(';');
  }

  function getElisabettaServiceStyle() {
    const presence = getElisabettaServicePresence();
    const assetWidth = 1276;
    const assetHeight = 2960;
    const characterScale = viewportWidth <= 760 ? 1.08 : 1.14;
    const kitchenMatchingWidth = Math.max(315, Math.min(370, viewportWidth * 0.245));
    const kitchenMatchingHeight = kitchenMatchingWidth * (565 / 185) * characterScale;
    const width = kitchenMatchingHeight / (assetHeight / assetWidth);
    const characterHeight = width * (assetHeight / assetWidth);
    const bubbleHeight = getCarloServiceBubbleHeight();
    const gap = viewportWidth <= 760 ? 14 : 12;
    const characterLift = viewportWidth <= 760 ? 36 : 64;
    const topInset = (viewportWidth <= 760 ? 88 : 104) + 40;
    const characterTop = topInset + bubbleHeight + gap - characterLift;
    const bottomOffset = characterTop + characterHeight - viewportHeight;
    const entryY = (1 - presence) * Math.max(360, Math.min(520, viewportHeight * 0.54));
    const bubbleWidth = getCarloServiceBubbleWidth();
    const bubbleLeft = viewportWidth <= 760 ? 24 : 80;
    const characterLeft = bubbleLeft + bubbleWidth / 2 - width / 2;
    const bubbleOffsetX = 0;
    const arrowLeft = clamp(bubbleWidth / 2 - bubbleOffsetX, 18, bubbleWidth - 18);

    return [
      `left: ${scenePx(characterLeft)}`,
      `bottom: ${scenePx(-bottomOffset)}`,
      `width: ${scenePx(width)}`,
      `--chef-entry-y: ${scenePx(entryY)}`,
      `--chef-entry-opacity: ${presence.toFixed(3)}`,
      `--speech-bubble-width: ${scenePx(bubbleWidth)}`,
      `--speech-bubble-copy-height: ${scenePx(getCarloServiceBubbleCopyHeight())}`,
      `--speech-bubble-meta-height: ${scenePx(getCarloServiceBubbleMetaHeight())}`,
      `--speech-bubble-offset-x: ${scenePx(bubbleOffsetX)}`,
      `--speech-bubble-arrow-left: ${scenePx(arrowLeft)}`,
      `--speech-bubble-top: ${scenePx(topInset - characterTop)}`
    ].join(';');
  }

  function getMarcoServiceStyle() {
    const presence = getMarcoServicePresence();
    const assetWidth = 1276;
    const assetHeight = 2960;
    const characterScale = viewportWidth <= 760 ? 1.08 : 1.14;
    const kitchenMatchingWidth = Math.max(315, Math.min(370, viewportWidth * 0.245));
    const kitchenMatchingHeight = kitchenMatchingWidth * (565 / 185) * characterScale;
    const width = kitchenMatchingHeight / (assetHeight / assetWidth);
    const characterHeight = width * (assetHeight / assetWidth);
    const bubbleHeight = getCarloServiceBubbleHeight();
    const gap = viewportWidth <= 760 ? 14 : 12;
    const characterLift = viewportWidth <= 760 ? 102 : 182;
    const topInset = (viewportWidth <= 760 ? 88 : 104) + 40;
    const characterTop = topInset + bubbleHeight + gap - characterLift;
    const bottomOffset = characterTop + characterHeight - viewportHeight;
    const entryY = (1 - presence) * Math.max(360, Math.min(520, viewportHeight * 0.54));
    const bubbleWidth = getCarloServiceBubbleWidth();
    const bubbleLeft = viewportWidth <= 760 ? 24 : 80;
    const characterLeft = bubbleLeft + bubbleWidth / 2 - width / 2;
    const bubbleOffsetX = 0;
    const arrowLeft = clamp(bubbleWidth / 2 - bubbleOffsetX, 18, bubbleWidth - 18);

    return [
      `left: ${scenePx(characterLeft)}`,
      `bottom: ${scenePx(-bottomOffset)}`,
      `width: ${scenePx(width)}`,
      `--chef-entry-y: ${scenePx(entryY)}`,
      `--chef-entry-opacity: ${presence.toFixed(3)}`,
      `--speech-bubble-width: ${scenePx(bubbleWidth)}`,
      `--speech-bubble-copy-height: ${scenePx(getCarloServiceBubbleCopyHeight())}`,
      `--speech-bubble-meta-height: ${scenePx(getCarloServiceBubbleMetaHeight())}`,
      `--speech-bubble-offset-x: ${scenePx(bubbleOffsetX)}`,
      `--speech-bubble-arrow-left: ${scenePx(arrowLeft)}`,
      `--speech-bubble-top: ${scenePx(topInset - characterTop)}`
    ].join(';');
  }

  function getFaustoServiceStyle() {
    const presence = getFaustoServicePresence();
    const assetWidth = 1276;
    const assetHeight = 2960;
    const characterScale = viewportWidth <= 760 ? 1.08 : 1.14;
    const kitchenMatchingWidth = Math.max(315, Math.min(370, viewportWidth * 0.245));
    const kitchenMatchingHeight = kitchenMatchingWidth * (565 / 185) * characterScale;
    const width = kitchenMatchingHeight / (assetHeight / assetWidth);
    const characterHeight = width * (assetHeight / assetWidth);
    const bubbleHeight = getCarloServiceBubbleHeight();
    const gap = viewportWidth <= 760 ? 14 : 12;
    const characterLift = viewportWidth <= 760 ? 36 : 64;
    const topInset = (viewportWidth <= 760 ? 88 : 104) + 40;
    const characterTop = topInset + bubbleHeight + gap - characterLift;
    const bottomOffset = characterTop + characterHeight - viewportHeight;
    const entryY = (1 - presence) * Math.max(360, Math.min(520, viewportHeight * 0.54));
    const bubbleWidth = getCarloServiceBubbleWidth();
    const bubbleLeft = viewportWidth <= 760 ? 24 : 80;
    const characterLeft = bubbleLeft + bubbleWidth / 2 - width / 2;
    const bubbleOffsetX = 0;
    const arrowLeft = clamp(bubbleWidth / 2 - bubbleOffsetX, 18, bubbleWidth - 18);

    return [
      `left: ${scenePx(characterLeft)}`,
      `bottom: ${scenePx(-bottomOffset)}`,
      `width: ${scenePx(width)}`,
      `--chef-entry-y: ${scenePx(entryY)}`,
      `--chef-entry-opacity: ${presence.toFixed(3)}`,
      `--speech-bubble-width: ${scenePx(bubbleWidth)}`,
      `--speech-bubble-copy-height: ${scenePx(getCarloServiceBubbleCopyHeight())}`,
      `--speech-bubble-meta-height: ${scenePx(getCarloServiceBubbleMetaHeight())}`,
      `--speech-bubble-offset-x: ${scenePx(bubbleOffsetX)}`,
      `--speech-bubble-arrow-left: ${scenePx(arrowLeft)}`,
      `--speech-bubble-top: ${scenePx(topInset - characterTop)}`
    ].join(';');
  }

  function getNiniServiceStyle() {
    const presence = getNiniServicePresence();
    const assetWidth = 1304;
    const assetHeight = 2960;
    const characterScale = viewportWidth <= 760 ? 1.1 : 1.16;
    const kitchenMatchingWidth = Math.max(315, Math.min(370, viewportWidth * 0.245));
    const kitchenMatchingHeight = kitchenMatchingWidth * (565 / 185) * characterScale;
    const width = kitchenMatchingHeight / (assetHeight / assetWidth);
    const characterHeight = width * (assetHeight / assetWidth);
    const bubbleHeight = getCarloServiceBubbleHeight();
    const gap = viewportWidth <= 760 ? 14 : 12;
    const characterLift = viewportWidth <= 760 ? 36 : 64;
    const topInset = (viewportWidth <= 760 ? 88 : 104) + 40;
    const characterTop = topInset + bubbleHeight + gap - characterLift;
    const bottomOffset = characterTop + characterHeight - viewportHeight;
    const entryY = (1 - presence) * Math.max(360, Math.min(520, viewportHeight * 0.54));
    const bubbleWidth = getCarloServiceBubbleWidth();
    const bubbleLeft = viewportWidth <= 760 ? 24 : 80;
    const characterLeft = bubbleLeft + bubbleWidth / 2 - width / 2;
    const bubbleOffsetX = 0;
    const arrowLeft = clamp(bubbleWidth / 2 - bubbleOffsetX, 18, bubbleWidth - 18);

    return [
      `left: ${scenePx(characterLeft)}`,
      `bottom: ${scenePx(-bottomOffset)}`,
      `width: ${scenePx(width)}`,
      `--chef-entry-y: ${scenePx(entryY)}`,
      `--chef-entry-opacity: ${presence.toFixed(3)}`,
      `--speech-bubble-width: ${scenePx(bubbleWidth)}`,
      `--speech-bubble-copy-height: ${scenePx(getCarloServiceBubbleCopyHeight())}`,
      `--speech-bubble-meta-height: ${scenePx(getCarloServiceBubbleMetaHeight())}`,
      `--speech-bubble-offset-x: ${scenePx(bubbleOffsetX)}`,
      `--speech-bubble-arrow-left: ${scenePx(arrowLeft)}`,
      `--speech-bubble-top: ${scenePx(topInset - characterTop)}`
    ].join(';');
  }

  function getCarloServiceSpeechPageCharacters() {
    const isMobile = viewportWidth <= 760;
    const bubbleWidth = getCarloServiceBubbleWidth();
    const fontSize = isMobile ? 13 : 15;
    const horizontalPadding = isMobile ? 36 : 40;
    const verticalPadding = isMobile ? 36 : 34;
    const pageControlsHeight = 34;
    const copyHeight = getCarloServiceBubbleCopyHeight();
    const lineHeight = fontSize * 1.34;
    const textHeight = copyHeight - verticalPadding - pageControlsHeight - 8;
    const lines = Math.max(3, Math.floor(textHeight / lineHeight));
    const charactersPerLine = Math.max(18, Math.floor((bubbleWidth - horizontalPadding) / (fontSize * 0.56)));

    return Math.max(88, Math.floor(charactersPerLine * lines * 0.82));
  }

  function getCarloServiceSpeechPages() {
    return getServiceSpeechPages(carloServiceSpeech);
  }

  function getElisabettaServiceSpeechPages() {
    return getServiceSpeechPages(elisabettaServiceSpeech);
  }

  function getMarcoServiceSpeechPages() {
    return getServiceSpeechPages(marcoServiceSpeech);
  }

  function getFaustoServiceSpeechPages() {
    return getServiceSpeechPages(faustoServiceSpeech);
  }

  function getNiniServiceSpeechPages() {
    return getServiceSpeechPages(niniServiceSpeech);
  }

  function getServiceSpeechPages(speech: string) {
    const pageCharacters = getCarloServiceSpeechPageCharacters();
    const words = speech.trim().split(/\s+/).filter(Boolean);
    const pages: string[] = [];
    let page = '';

    words.forEach((word) => {
      if (!page) {
        page = word;
        return;
      }

      const candidate = `${page} ${word}`;
      if (candidate.length <= pageCharacters) {
        page = candidate;
        return;
      }

      pages.push(page);
      page = word;
    });

    if (page) pages.push(page);
    return pages.length ? pages : [''];
  }

  function getPageStartCharacterIndex(pages: string[], pageIndex: number) {
    if (pageIndex <= 0) return 0;
    return pages.slice(0, pageIndex).join(' ').length + 1;
  }

  function getPageIndexForCharacterOffset(pages: string[], characterOffset: number) {
    let pageStart = 0;

    for (let index = 0; index < pages.length; index += 1) {
      const pageEnd = pageStart + pages[index].length;
      if (characterOffset <= pageEnd || index === pages.length - 1) return index;
      pageStart = pageEnd + 1;
    }

    return 0;
  }

  function getAudioDuration(audio: HTMLAudioElement | undefined, fallbackDuration: number) {
    return audio && Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : fallbackDuration;
  }

  function getPageStartProgress(pages: string[], pageIndex: number) {
    const normalizedSpeech = pages.join(' ');
    const pageStart = getPageStartCharacterIndex(pages, pageIndex);
    return clamp(pageStart / Math.max(normalizedSpeech.length, 1), 0, 0.98);
  }

  function getServiceResumeProgress(
    pages: string[],
    revealProgress: number,
    mutedPageIndex: number,
    forceMutedPage = false
  ) {
    if (!isAudioMuted && !forceMutedPage) return clamp(revealProgress, 0, 0.98);

    const visiblePageIndex = clamp(mutedPageIndex, 0, Math.max(pages.length - 1, 0));
    return getPageStartProgress(pages, visiblePageIndex);
  }

  function getCarloServiceVisiblePageIndex() {
    if (isAudioMuted) return clamp(carloServiceMutedPageIndex, 0, Math.max(getCarloServiceSpeechPages().length - 1, 0));

    const pages = getCarloServiceSpeechPages();
    const normalizedSpeech = pages.join(' ');
    return getPageIndexForCharacterOffset(pages, normalizedSpeech.length * carloServiceRevealProgress);
  }

  function getElisabettaServiceVisiblePageIndex() {
    if (isAudioMuted) {
      return clamp(elisabettaServiceMutedPageIndex, 0, Math.max(getElisabettaServiceSpeechPages().length - 1, 0));
    }

    const pages = getElisabettaServiceSpeechPages();
    const normalizedSpeech = pages.join(' ');
    return getPageIndexForCharacterOffset(pages, normalizedSpeech.length * elisabettaServiceRevealProgress);
  }

  function getMarcoServiceVisiblePageIndex() {
    if (isAudioMuted) return clamp(marcoServiceMutedPageIndex, 0, Math.max(getMarcoServiceSpeechPages().length - 1, 0));

    const pages = getMarcoServiceSpeechPages();
    const normalizedSpeech = pages.join(' ');
    return getPageIndexForCharacterOffset(pages, normalizedSpeech.length * marcoServiceRevealProgress);
  }

  function getFaustoServiceVisiblePageIndex() {
    if (isAudioMuted) return clamp(faustoServiceMutedPageIndex, 0, Math.max(getFaustoServiceSpeechPages().length - 1, 0));

    const pages = getFaustoServiceSpeechPages();
    const normalizedSpeech = pages.join(' ');
    return getPageIndexForCharacterOffset(pages, normalizedSpeech.length * faustoServiceRevealProgress);
  }

  function getNiniServiceVisiblePageIndex() {
    if (isAudioMuted) return clamp(niniServiceMutedPageIndex, 0, Math.max(getNiniServiceSpeechPages().length - 1, 0));

    const pages = getNiniServiceSpeechPages();
    const normalizedSpeech = pages.join(' ');
    return getPageIndexForCharacterOffset(pages, normalizedSpeech.length * niniServiceRevealProgress);
  }

  function setCarloServicePage(pageIndex: number) {
    const pages = getCarloServiceSpeechPages();
    const nextPageIndex = clamp(pageIndex, 0, Math.max(pages.length - 1, 0));

    if (isAudioMuted || !carloServiceAudioEl) {
      carloServiceMutedPageIndex = nextPageIndex;
      return;
    }

    const progress = getPageStartProgress(pages, nextPageIndex);
    carloServiceRevealProgress = progress;
    carloServiceAudioEl.currentTime = progress * getAudioDuration(carloServiceAudioEl, carloServiceRevealDurationSeconds);
  }

  function setElisabettaServicePage(pageIndex: number) {
    const pages = getElisabettaServiceSpeechPages();
    const nextPageIndex = clamp(pageIndex, 0, Math.max(pages.length - 1, 0));

    if (isAudioMuted || !elisabettaServiceAudioEl) {
      elisabettaServiceMutedPageIndex = nextPageIndex;
      return;
    }

    const progress = getPageStartProgress(pages, nextPageIndex);
    elisabettaServiceRevealProgress = progress;
    elisabettaServiceAudioEl.currentTime =
      progress * getAudioDuration(elisabettaServiceAudioEl, elisabettaServiceRevealDurationSeconds);
  }

  function setMarcoServicePage(pageIndex: number) {
    const pages = getMarcoServiceSpeechPages();
    const nextPageIndex = clamp(pageIndex, 0, Math.max(pages.length - 1, 0));

    if (isAudioMuted || !marcoServiceAudioEl) {
      marcoServiceMutedPageIndex = nextPageIndex;
      return;
    }

    const progress = getPageStartProgress(pages, nextPageIndex);
    marcoServiceRevealProgress = progress;
    marcoServiceAudioEl.currentTime = progress * getAudioDuration(marcoServiceAudioEl, marcoServiceRevealDurationSeconds);
  }

  function setFaustoServicePage(pageIndex: number) {
    const pages = getFaustoServiceSpeechPages();
    const nextPageIndex = clamp(pageIndex, 0, Math.max(pages.length - 1, 0));

    if (isAudioMuted || !faustoServiceAudioEl) {
      faustoServiceMutedPageIndex = nextPageIndex;
      return;
    }

    const progress = getPageStartProgress(pages, nextPageIndex);
    faustoServiceRevealProgress = progress;
    faustoServiceAudioEl.currentTime = progress * getAudioDuration(faustoServiceAudioEl, faustoServiceRevealDurationSeconds);
  }

  function setNiniServicePage(pageIndex: number) {
    const pages = getNiniServiceSpeechPages();
    const nextPageIndex = clamp(pageIndex, 0, Math.max(pages.length - 1, 0));

    if (isAudioMuted || !niniServiceAudioEl) {
      niniServiceMutedPageIndex = nextPageIndex;
      return;
    }

    const progress = getPageStartProgress(pages, nextPageIndex);
    niniServiceRevealProgress = progress;
    niniServiceAudioEl.currentTime = progress * getAudioDuration(niniServiceAudioEl, niniServiceRevealDurationSeconds);
  }

  function advanceCarloServicePage(event: Event) {
    event.stopPropagation();
    setCarloServicePage(getCarloServiceVisiblePageIndex() + 1);
  }

  function rewindCarloServicePage(event: Event) {
    event.stopPropagation();
    setCarloServicePage(getCarloServiceVisiblePageIndex() - 1);
  }

  function advanceElisabettaServicePage(event: Event) {
    event.stopPropagation();
    setElisabettaServicePage(getElisabettaServiceVisiblePageIndex() + 1);
  }

  function rewindElisabettaServicePage(event: Event) {
    event.stopPropagation();
    setElisabettaServicePage(getElisabettaServiceVisiblePageIndex() - 1);
  }

  function advanceMarcoServicePage(event: Event) {
    event.stopPropagation();
    setMarcoServicePage(getMarcoServiceVisiblePageIndex() + 1);
  }

  function rewindMarcoServicePage(event: Event) {
    event.stopPropagation();
    setMarcoServicePage(getMarcoServiceVisiblePageIndex() - 1);
  }

  function advanceFaustoServicePage(event: Event) {
    event.stopPropagation();
    setFaustoServicePage(getFaustoServiceVisiblePageIndex() + 1);
  }

  function rewindFaustoServicePage(event: Event) {
    event.stopPropagation();
    setFaustoServicePage(getFaustoServiceVisiblePageIndex() - 1);
  }

  function advanceNiniServicePage(event: Event) {
    event.stopPropagation();
    setNiniServicePage(getNiniServiceVisiblePageIndex() + 1);
  }

  function rewindNiniServicePage(event: Event) {
    event.stopPropagation();
    setNiniServicePage(getNiniServiceVisiblePageIndex() - 1);
  }

  function getCarloServiceCurrentSpeechPageInfo() {
    return getServiceCurrentSpeechPageInfo(
      getCarloServiceSpeechPages(),
      getCarloServiceVisiblePageIndex(),
      carloServiceRevealProgress
    );
  }

  function getElisabettaServiceCurrentSpeechPageInfo() {
    return getServiceCurrentSpeechPageInfo(
      getElisabettaServiceSpeechPages(),
      getElisabettaServiceVisiblePageIndex(),
      elisabettaServiceRevealProgress
    );
  }

  function getMarcoServiceCurrentSpeechPageInfo() {
    return getServiceCurrentSpeechPageInfo(
      getMarcoServiceSpeechPages(),
      getMarcoServiceVisiblePageIndex(),
      marcoServiceRevealProgress
    );
  }

  function getFaustoServiceCurrentSpeechPageInfo() {
    return getServiceCurrentSpeechPageInfo(
      getFaustoServiceSpeechPages(),
      getFaustoServiceVisiblePageIndex(),
      faustoServiceRevealProgress
    );
  }

  function getNiniServiceCurrentSpeechPageInfo() {
    return getServiceCurrentSpeechPageInfo(
      getNiniServiceSpeechPages(),
      getNiniServiceVisiblePageIndex(),
      niniServiceRevealProgress
    );
  }

  function getServiceCurrentSpeechPageInfo(
    pages: string[],
    visiblePageIndex: number,
    revealProgress: number
  ) {
    if (isAudioMuted) {
      const speech = pages[visiblePageIndex] ?? '';
      return { highlightedSpeech: speech, speech };
    }

    const normalizedSpeech = pages.join(' ');
    const spokenLength = Math.ceil(normalizedSpeech.length * revealProgress);
    let pageStart = 0;

    for (const page of pages) {
      const pageEnd = pageStart + page.length;
      if (spokenLength <= pageEnd || page === pages[pages.length - 1]) {
        return {
          highlightedSpeech: page.slice(0, clamp(spokenLength - pageStart, 0, page.length)),
          speech: page
        };
      }

      pageStart = pageEnd + 1;
    }

    return { highlightedSpeech: '', speech: pages[visiblePageIndex] ?? '' };
  }

  function getCarloServicePendingSpeech() {
    const { highlightedSpeech, speech } = getCarloServiceCurrentSpeechPageInfo();
    return speech.slice(highlightedSpeech.length);
  }

  function getElisabettaServicePendingSpeech() {
    const { highlightedSpeech, speech } = getElisabettaServiceCurrentSpeechPageInfo();
    return speech.slice(highlightedSpeech.length);
  }

  function getMarcoServicePendingSpeech() {
    const { highlightedSpeech, speech } = getMarcoServiceCurrentSpeechPageInfo();
    return speech.slice(highlightedSpeech.length);
  }

  function getFaustoServicePendingSpeech() {
    const { highlightedSpeech, speech } = getFaustoServiceCurrentSpeechPageInfo();
    return speech.slice(highlightedSpeech.length);
  }

  function getNiniServicePendingSpeech() {
    const { highlightedSpeech, speech } = getNiniServiceCurrentSpeechPageInfo();
    return speech.slice(highlightedSpeech.length);
  }

  function updatePointerScenePosition(event: PointerEvent) {
    if (!stageEl || !sceneScale) return;

    const rect = stageEl.getBoundingClientRect();
    const localX = clamp(event.clientX - rect.left, 0, rect.width);
    const localY = clamp(event.clientY - rect.top, 0, rect.height);

    hasPointerScenePosition = true;
    pointerSceneY = localY / sceneScale;
    pointerSceneX = {
      background: (localX + cameraX * resolvedLayerSpeed.background) / sceneScale,
      middle: (localX + cameraX * resolvedLayerSpeed.middle) / sceneScale,
      foreground: (localX + cameraX * resolvedLayerSpeed.foreground) / sceneScale
    };
    nearestSceneAsset = getNearestSceneAsset();
    hoveredServiceAssetId = getHoveredServiceAssetId();
    servicePhaserGame?.setHoveredAssetId(hoveredServiceAssetId);
  }

  function getNearestSceneAsset() {
    if (!hasPointerScenePosition) return undefined;

    let nearest: { id: string; distance: number } | undefined;

    for (const asset of serviceCoordinateAssets) {
      if (asset.layer !== 'background' && asset.layer !== 'middle' && asset.layer !== 'foreground') continue;
      const layerX = pointerSceneX[asset.layer];

      const x = asset.x + asset.width / 2;
      const y = asset.y + asset.height / 2;
      const distance = Math.hypot(layerX - x, pointerSceneY - y);

      if (!nearest || distance < nearest.distance) {
        nearest = { id: asset.id, distance };
      }
    }

    return nearest;
  }

  function getHoveredServiceAssetId() {
    if (!hasPointerScenePosition) return undefined;

    const hoverPadding = 18;
    const hoverAssets = serviceCoordinateAssets.filter(
      (asset) => Boolean(asset.hoverAnimation || asset.hoverSoundSrc)
    );

    for (const asset of hoverAssets.slice().reverse()) {
      if (asset.layer !== 'background' && asset.layer !== 'middle' && asset.layer !== 'foreground') continue;
      const layerX = pointerSceneX[asset.layer];
      if (layerX === undefined) continue;

      const hitboxX =
        asset.id === '1_brocca'
          ? asset.x + asset.width * servicePitcherHitboxInsetFactor
          : asset.x;
      const hitboxWidth =
        asset.id === '1_cloche'
          ? asset.width * serviceClocheHitboxWidthFactor
          : asset.id === '1_brocca'
            ? asset.width * (1 - servicePitcherHitboxInsetFactor * 2)
            : asset.width;
      const hitboxPadding = asset.id === '1_cloche' || asset.id === '1_brocca' ? 6 : hoverPadding;
      const withinX = layerX >= hitboxX - hitboxPadding && layerX <= hitboxX + hitboxWidth + hitboxPadding;
      const withinY =
        pointerSceneY >= asset.y - hitboxPadding && pointerSceneY <= asset.y + asset.height + hitboxPadding;

      if (withinX && withinY) return asset.id;
    }

    return undefined;
  }

  function onWheel(event: WheelEvent) {
    event.preventDefault();
    if (!isSceneInteractive) return;
    const axisDelta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    scrollBy(axisDelta * 1.08);
  }

  function onPointerDown(event: PointerEvent) {
    if (!isSceneInteractive) {
      event.preventDefault();
      return;
    }
    if (event.button !== 0) return;
    updatePointerScenePosition(event);
    isDragging = true;
    dragStartX = event.clientX;
    dragScrollStart = scrollTrigger?.scroll() ?? 0;
    stageEl.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: PointerEvent) {
    if (!isSceneInteractive) return;
    updatePointerScenePosition(event);
    if (!isDragging) return;
    scrollTrigger?.scroll(dragScrollStart + (dragStartX - event.clientX) * 1.54);
  }

  function onPointerLeave() {
    if (!isDragging) {
      hasPointerScenePosition = false;
      hoveredServiceAssetId = undefined;
      servicePhaserGame?.setHoveredAssetId(undefined);
    }
  }

  function endDrag(event?: PointerEvent) {
    if (!isDragging) return;
    isDragging = false;
    if (event && stageEl.hasPointerCapture(event.pointerId)) {
      stageEl.releasePointerCapture(event.pointerId);
    }
  }

  function onKeydown(event: KeyboardEvent) {
    const isSceneScrollKey =
      event.key === 'ArrowRight' || event.key === 'ArrowLeft' || event.key === 'Home' || event.key === 'End';
    if (!isSceneInteractive) {
      if (isSceneScrollKey) event.preventDefault();
      return;
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      scrollBy(viewportWidth * 0.33);
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      scrollBy(-viewportWidth * 0.33);
    }
    if (event.key === 'Home') {
      event.preventDefault();
      setTargetCameraX(0);
    }
    if (event.key === 'End') {
      event.preventDefault();
      setTargetCameraX(maxScrollX);
    }
  }

  function getTitleStyle() {
    const titleFontSize = Math.min(180 * sceneScale, Math.max(56, (viewportWidth - 48) / 3.9));
    const topbarGutter = viewportWidth <= 760 ? 24 : 80;
    const translateX = topbarGutter - cameraX * resolvedLayerSpeed.title;

    return [
      `left: ${scenePx(translateX)}`,
      `top: ${scenePx(viewportHeight / 2 - 132 * sceneScale)}`,
      `font-size: ${scenePx(titleFontSize)}`
    ].join(';');
  }

  function getServiceMascotHotspotStyle() {
    if (!serviceMascotAsset) return '';
    return getSceneAssetStyle(serviceMascotAsset, cameraX, sceneHeight, sceneScale, resolvedLayerSpeed);
  }

  function getServicePitcherHotspotStyle() {
    if (!servicePitcherAsset) return '';
    return getSceneAssetStyle(servicePitcherAsset, cameraX, sceneHeight, sceneScale, resolvedLayerSpeed);
  }

  function getServiceClocheHotspotStyle() {
    if (!serviceClocheAsset) return '';
    return getSceneAssetStyle(
      {
        ...serviceClocheAsset,
        width: serviceClocheAsset.width * serviceClocheHitboxWidthFactor
      },
      cameraX,
      sceneHeight,
      sceneScale,
      resolvedLayerSpeed
    );
  }

  function getServiceBottlesHotspotStyle() {
    if (!serviceBottlesAsset) return '';
    return getSceneAssetStyle(serviceBottlesAsset, cameraX, sceneHeight, sceneScale, resolvedLayerSpeed);
  }

  function getServiceCameraHotspotStyle() {
    if (!serviceCameraAsset) return '';
    return getSceneAssetStyle(serviceCameraAsset, cameraX, sceneHeight, sceneScale, resolvedLayerSpeed);
  }

  function getServiceLunchboxHotspotStyle() {
    if (!serviceLunchboxAsset) return '';
    return getSceneAssetStyle(serviceLunchboxAsset, cameraX, sceneHeight, sceneScale, resolvedLayerSpeed);
  }

  function syncCarloServiceSpeechReveal() {
    if (!carloServiceAudioEl) return;
    const duration = Number.isFinite(carloServiceAudioEl.duration)
      ? carloServiceAudioEl.duration
      : carloServiceRevealDurationSeconds;
    const revealDuration = Math.max(duration || carloServiceRevealDurationSeconds, 0.001);

    carloServiceRevealProgress = clamp(carloServiceAudioEl.currentTime / revealDuration, 0, 1);
    const pages = getCarloServiceSpeechPages();
    const normalizedSpeech = pages.join(' ');
    carloServiceMutedPageIndex = getPageIndexForCharacterOffset(
      pages,
      carloServiceRevealProgress * normalizedSpeech.length
    );
  }

  function syncElisabettaServiceSpeechReveal() {
    if (!elisabettaServiceAudioEl) return;
    const duration = Number.isFinite(elisabettaServiceAudioEl.duration)
      ? elisabettaServiceAudioEl.duration
      : elisabettaServiceRevealDurationSeconds;
    const revealDuration = Math.max(duration || elisabettaServiceRevealDurationSeconds, 0.001);

    elisabettaServiceRevealProgress = clamp(elisabettaServiceAudioEl.currentTime / revealDuration, 0, 1);
    const pages = getElisabettaServiceSpeechPages();
    const normalizedSpeech = pages.join(' ');
    elisabettaServiceMutedPageIndex = getPageIndexForCharacterOffset(
      pages,
      elisabettaServiceRevealProgress * normalizedSpeech.length
    );
  }

  function syncMarcoServiceSpeechReveal() {
    if (!marcoServiceAudioEl) return;
    const duration = Number.isFinite(marcoServiceAudioEl.duration)
      ? marcoServiceAudioEl.duration
      : marcoServiceRevealDurationSeconds;
    const revealDuration = Math.max(duration || marcoServiceRevealDurationSeconds, 0.001);

    marcoServiceRevealProgress = clamp(marcoServiceAudioEl.currentTime / revealDuration, 0, 1);
    const pages = getMarcoServiceSpeechPages();
    const normalizedSpeech = pages.join(' ');
    marcoServiceMutedPageIndex = getPageIndexForCharacterOffset(
      pages,
      marcoServiceRevealProgress * normalizedSpeech.length
    );
  }

  function syncFaustoServiceSpeechReveal() {
    if (!faustoServiceAudioEl) return;
    const duration = Number.isFinite(faustoServiceAudioEl.duration)
      ? faustoServiceAudioEl.duration
      : faustoServiceRevealDurationSeconds;
    const revealDuration = Math.max(duration || faustoServiceRevealDurationSeconds, 0.001);

    faustoServiceRevealProgress = clamp(faustoServiceAudioEl.currentTime / revealDuration, 0, 1);
    const pages = getFaustoServiceSpeechPages();
    const normalizedSpeech = pages.join(' ');
    faustoServiceMutedPageIndex = getPageIndexForCharacterOffset(
      pages,
      faustoServiceRevealProgress * normalizedSpeech.length
    );
  }

  function syncNiniServiceSpeechReveal() {
    if (!niniServiceAudioEl) return;
    const duration = Number.isFinite(niniServiceAudioEl.duration)
      ? niniServiceAudioEl.duration
      : niniServiceRevealDurationSeconds;
    const revealDuration = Math.max(duration || niniServiceRevealDurationSeconds, 0.001);

    niniServiceRevealProgress = clamp(niniServiceAudioEl.currentTime / revealDuration, 0, 1);
    const pages = getNiniServiceSpeechPages();
    const normalizedSpeech = pages.join(' ');
    niniServiceMutedPageIndex = getPageIndexForCharacterOffset(
      pages,
      niniServiceRevealProgress * normalizedSpeech.length
    );
  }

  function isAnyServiceDialogueAudioActive() {
    return (
      isCarloServiceAudioActive ||
      isElisabettaServiceAudioActive ||
      isMarcoServiceAudioActive ||
      isFaustoServiceAudioActive ||
      isNiniServiceAudioActive
    );
  }

  function getServiceAmbientTargetVolume() {
    if (isAudioMuted) return 0;
    return isAnyServiceDialogueAudioActive() ? serviceAmbientDuckedVolume : serviceAmbientVolume;
  }

  function fadeServiceAmbientVolume(targetVolume: number, duration: number, onComplete?: () => void) {
    if (!serviceAmbientAudioEl) return;
    targetVolume = clamp(targetVolume, 0, 1);
    if (serviceAmbientFadeFrame) cancelAnimationFrame(serviceAmbientFadeFrame);
    serviceAmbientFadeFrame = undefined;

    if (duration <= 0) {
      serviceAmbientAudioEl.volume = targetVolume;
      onComplete?.();
      return;
    }

    const initialVolume = clamp(serviceAmbientAudioEl.volume, 0, 1);
    const startedAt = performance.now();
    const durationMs = duration * 1000;

    const step = (now: number) => {
      if (!serviceAmbientAudioEl) return;
      const progress = Math.min((now - startedAt) / durationMs, 1);
      serviceAmbientAudioEl.volume = clamp(initialVolume + (targetVolume - initialVolume) * progress, 0, 1);

      if (progress < 1) {
        serviceAmbientFadeFrame = requestAnimationFrame(step);
        return;
      }

      serviceAmbientAudioEl.volume = targetVolume;
      serviceAmbientFadeFrame = undefined;
      onComplete?.();
    };

    serviceAmbientFadeFrame = requestAnimationFrame(step);
  }

  function setServiceAmbientVolume(duration = 0.48) {
    if (!serviceAmbientAudioEl || !isAmbientAudioStarted || isAudioMuted) return;
    fadeServiceAmbientVolume(getServiceAmbientTargetVolume(), duration);
  }

  async function startAmbientAudio() {
    if (!isSceneRevealed || isAudioMuted || isAmbientAudioStarted || !serviceAmbientAudioEl) return;

    serviceAmbientAudioEl.loop = true;
    serviceAmbientAudioEl.volume = 0;

    try {
      await serviceAmbientAudioEl.play();
      isAmbientAudioStarted = true;
      fadeServiceAmbientVolume(getServiceAmbientTargetVolume(), serviceAmbientFadeInDuration);
    } catch {
      isAmbientAudioStarted = false;
    }
  }

  function stopAmbientAudio(duration = serviceAmbientFadeOutDuration) {
    if (!serviceAmbientAudioEl) {
      isAmbientAudioStarted = false;
      return;
    }

    fadeServiceAmbientVolume(0, duration, () => {
      serviceAmbientAudioEl.pause();
      serviceAmbientAudioEl.currentTime = 0;
      isAmbientAudioStarted = false;
    });
  }

  function fadeCarloServiceAudioVolume(
    targetVolume: number,
    duration: number,
    onComplete?: () => void
  ) {
    if (!carloServiceAudioEl) return;
    targetVolume = clamp(targetVolume, 0, 1);
    if (carloServiceFadeFrame) cancelAnimationFrame(carloServiceFadeFrame);
    carloServiceFadeFrame = undefined;

    if (duration <= 0) {
      carloServiceAudioEl.volume = targetVolume;
      onComplete?.();
      return;
    }

    const initialVolume = clamp(carloServiceAudioEl.volume, 0, 1);
    const startedAt = performance.now();
    const durationMs = duration * 1000;

    const step = (now: number) => {
      if (!carloServiceAudioEl) return;
      const progress = Math.min((now - startedAt) / durationMs, 1);
      carloServiceAudioEl.volume = clamp(initialVolume + (targetVolume - initialVolume) * progress, 0, 1);

      if (progress < 1) {
        carloServiceFadeFrame = requestAnimationFrame(step);
        return;
      }

      carloServiceAudioEl.volume = targetVolume;
      carloServiceFadeFrame = undefined;
      onComplete?.();
    };

    carloServiceFadeFrame = requestAnimationFrame(step);
  }

  function fadeElisabettaServiceAudioVolume(
    targetVolume: number,
    duration: number,
    onComplete?: () => void
  ) {
    if (!elisabettaServiceAudioEl) return;
    targetVolume = clamp(targetVolume, 0, 1);
    if (elisabettaServiceFadeFrame) cancelAnimationFrame(elisabettaServiceFadeFrame);
    elisabettaServiceFadeFrame = undefined;

    if (duration <= 0) {
      elisabettaServiceAudioEl.volume = targetVolume;
      onComplete?.();
      return;
    }

    const initialVolume = clamp(elisabettaServiceAudioEl.volume, 0, 1);
    const startedAt = performance.now();
    const durationMs = duration * 1000;

    const step = (now: number) => {
      if (!elisabettaServiceAudioEl) return;
      const progress = Math.min((now - startedAt) / durationMs, 1);
      elisabettaServiceAudioEl.volume = clamp(initialVolume + (targetVolume - initialVolume) * progress, 0, 1);

      if (progress < 1) {
        elisabettaServiceFadeFrame = requestAnimationFrame(step);
        return;
      }

      elisabettaServiceAudioEl.volume = targetVolume;
      elisabettaServiceFadeFrame = undefined;
      onComplete?.();
    };

    elisabettaServiceFadeFrame = requestAnimationFrame(step);
  }

  function fadeMarcoServiceAudioVolume(
    targetVolume: number,
    duration: number,
    onComplete?: () => void
  ) {
    if (!marcoServiceAudioEl) return;
    targetVolume = clamp(targetVolume, 0, 1);
    if (marcoServiceFadeFrame) cancelAnimationFrame(marcoServiceFadeFrame);
    marcoServiceFadeFrame = undefined;

    if (duration <= 0) {
      marcoServiceAudioEl.volume = targetVolume;
      onComplete?.();
      return;
    }

    const initialVolume = clamp(marcoServiceAudioEl.volume, 0, 1);
    const startedAt = performance.now();
    const durationMs = duration * 1000;

    const step = (now: number) => {
      if (!marcoServiceAudioEl) return;
      const progress = Math.min((now - startedAt) / durationMs, 1);
      marcoServiceAudioEl.volume = clamp(initialVolume + (targetVolume - initialVolume) * progress, 0, 1);

      if (progress < 1) {
        marcoServiceFadeFrame = requestAnimationFrame(step);
        return;
      }

      marcoServiceAudioEl.volume = targetVolume;
      marcoServiceFadeFrame = undefined;
      onComplete?.();
    };

    marcoServiceFadeFrame = requestAnimationFrame(step);
  }

  function fadeFaustoServiceAudioVolume(
    targetVolume: number,
    duration: number,
    onComplete?: () => void
  ) {
    if (!faustoServiceAudioEl) return;
    targetVolume = clamp(targetVolume, 0, 1);
    if (faustoServiceFadeFrame) cancelAnimationFrame(faustoServiceFadeFrame);
    faustoServiceFadeFrame = undefined;

    if (duration <= 0) {
      faustoServiceAudioEl.volume = targetVolume;
      onComplete?.();
      return;
    }

    const initialVolume = clamp(faustoServiceAudioEl.volume, 0, 1);
    const startedAt = performance.now();
    const durationMs = duration * 1000;

    const step = (now: number) => {
      if (!faustoServiceAudioEl) return;
      const progress = Math.min((now - startedAt) / durationMs, 1);
      faustoServiceAudioEl.volume = clamp(initialVolume + (targetVolume - initialVolume) * progress, 0, 1);

      if (progress < 1) {
        faustoServiceFadeFrame = requestAnimationFrame(step);
        return;
      }

      faustoServiceAudioEl.volume = targetVolume;
      faustoServiceFadeFrame = undefined;
      onComplete?.();
    };

    faustoServiceFadeFrame = requestAnimationFrame(step);
  }

  function fadeNiniServiceAudioVolume(
    targetVolume: number,
    duration: number,
    onComplete?: () => void
  ) {
    if (!niniServiceAudioEl) return;
    targetVolume = clamp(targetVolume, 0, 1);
    if (niniServiceFadeFrame) cancelAnimationFrame(niniServiceFadeFrame);
    niniServiceFadeFrame = undefined;

    if (duration <= 0) {
      niniServiceAudioEl.volume = targetVolume;
      onComplete?.();
      return;
    }

    const initialVolume = clamp(niniServiceAudioEl.volume, 0, 1);
    const startedAt = performance.now();
    const durationMs = duration * 1000;

    const step = (now: number) => {
      if (!niniServiceAudioEl) return;
      const progress = Math.min((now - startedAt) / durationMs, 1);
      niniServiceAudioEl.volume = clamp(initialVolume + (targetVolume - initialVolume) * progress, 0, 1);

      if (progress < 1) {
        niniServiceFadeFrame = requestAnimationFrame(step);
        return;
      }

      niniServiceAudioEl.volume = targetVolume;
      niniServiceFadeFrame = undefined;
      onComplete?.();
    };

    niniServiceFadeFrame = requestAnimationFrame(step);
  }

  async function startCarloServiceAudio() {
    if (
      isAudioMuted ||
      isCarloServiceAudioActive ||
      (hasPlayedCarloServiceAudio && carloServiceRevealProgress >= 0.995) ||
      isCarloServiceAudioStarting ||
      !carloServiceAudioEl ||
      !isCarloServiceDialogueVisible()
    ) {
      return;
    }

    isCarloServiceAudioStarting = true;
    stopAllServiceAudio({ duration: serviceAudioHandoffFadeOutDuration, except: 'carlo', resetReplay: true });
    if (carloServiceFadeFrame) cancelAnimationFrame(carloServiceFadeFrame);
    carloServiceFadeFrame = undefined;
    carloServiceAudioEl.pause();
    carloServiceRevealProgress = getServiceResumeProgress(
      getCarloServiceSpeechPages(),
      carloServiceRevealProgress,
      carloServiceMutedPageIndex,
      shouldResumeServiceAudioFromMutedPage
    );
    carloServiceAudioEl.currentTime =
      carloServiceRevealProgress * getAudioDuration(carloServiceAudioEl, carloServiceRevealDurationSeconds);
    carloServiceAudioEl.volume = 0;
    shouldResumeServiceAudioFromMutedPage = false;

    try {
      await carloServiceAudioEl.play();
      if (!isCarloServiceAudioStarting || isAudioMuted || !isCarloServiceDialogueVisible()) {
        carloServiceAudioEl.pause();
        return;
      }
      isCarloServiceAudioActive = true;
      fadeCarloServiceAudioVolume(carloServiceAudioVolume, serviceAudioFadeInDuration);
      setServiceAmbientVolume();
    } catch {
      isCarloServiceAudioActive = false;
    } finally {
      isCarloServiceAudioStarting = false;
    }
  }

  async function startElisabettaServiceAudio() {
    if (
      isAudioMuted ||
      isElisabettaServiceAudioActive ||
      (hasPlayedElisabettaServiceAudio && elisabettaServiceRevealProgress >= 0.995) ||
      isElisabettaServiceAudioStarting ||
      !elisabettaServiceAudioEl ||
      !isElisabettaServiceDialogueVisible()
    ) {
      return;
    }

    isElisabettaServiceAudioStarting = true;
    stopAllServiceAudio({ duration: serviceAudioHandoffFadeOutDuration, except: 'elisabetta', resetReplay: true });
    if (elisabettaServiceFadeFrame) cancelAnimationFrame(elisabettaServiceFadeFrame);
    elisabettaServiceFadeFrame = undefined;
    elisabettaServiceAudioEl.pause();
    elisabettaServiceRevealProgress = getServiceResumeProgress(
      getElisabettaServiceSpeechPages(),
      elisabettaServiceRevealProgress,
      elisabettaServiceMutedPageIndex,
      shouldResumeServiceAudioFromMutedPage
    );
    elisabettaServiceAudioEl.currentTime =
      elisabettaServiceRevealProgress *
      getAudioDuration(elisabettaServiceAudioEl, elisabettaServiceRevealDurationSeconds);
    elisabettaServiceAudioEl.volume = 0;
    shouldResumeServiceAudioFromMutedPage = false;

    try {
      await elisabettaServiceAudioEl.play();
      if (!isElisabettaServiceAudioStarting || isAudioMuted || !isElisabettaServiceDialogueVisible()) {
        elisabettaServiceAudioEl.pause();
        return;
      }
      isElisabettaServiceAudioActive = true;
      fadeElisabettaServiceAudioVolume(elisabettaServiceAudioVolume, serviceAudioFadeInDuration);
      setServiceAmbientVolume();
    } catch {
      isElisabettaServiceAudioActive = false;
    } finally {
      isElisabettaServiceAudioStarting = false;
    }
  }

  async function startMarcoServiceAudio() {
    if (
      isAudioMuted ||
      isMarcoServiceAudioActive ||
      (hasPlayedMarcoServiceAudio && marcoServiceRevealProgress >= 0.995) ||
      isMarcoServiceAudioStarting ||
      !marcoServiceAudioEl ||
      !isMarcoServiceDialogueVisible()
    ) {
      return;
    }

    isMarcoServiceAudioStarting = true;
    stopAllServiceAudio({ duration: serviceAudioHandoffFadeOutDuration, except: 'marco', resetReplay: true });
    if (marcoServiceFadeFrame) cancelAnimationFrame(marcoServiceFadeFrame);
    marcoServiceFadeFrame = undefined;
    marcoServiceAudioEl.pause();
    marcoServiceRevealProgress = getServiceResumeProgress(
      getMarcoServiceSpeechPages(),
      marcoServiceRevealProgress,
      marcoServiceMutedPageIndex,
      shouldResumeServiceAudioFromMutedPage
    );
    marcoServiceAudioEl.currentTime =
      marcoServiceRevealProgress * getAudioDuration(marcoServiceAudioEl, marcoServiceRevealDurationSeconds);
    marcoServiceAudioEl.volume = 0;
    shouldResumeServiceAudioFromMutedPage = false;

    try {
      await marcoServiceAudioEl.play();
      if (!isMarcoServiceAudioStarting || isAudioMuted || !isMarcoServiceDialogueVisible()) {
        marcoServiceAudioEl.pause();
        return;
      }
      isMarcoServiceAudioActive = true;
      fadeMarcoServiceAudioVolume(marcoServiceAudioVolume, serviceAudioFadeInDuration);
      setServiceAmbientVolume();
    } catch {
      isMarcoServiceAudioActive = false;
    } finally {
      isMarcoServiceAudioStarting = false;
    }
  }

  async function startFaustoServiceAudio() {
    if (
      isAudioMuted ||
      isFaustoServiceAudioActive ||
      (hasPlayedFaustoServiceAudio && faustoServiceRevealProgress >= 0.995) ||
      isFaustoServiceAudioStarting ||
      !faustoServiceAudioEl ||
      !isFaustoServiceDialogueVisible()
    ) {
      return;
    }

    isFaustoServiceAudioStarting = true;
    stopAllServiceAudio({ duration: serviceAudioHandoffFadeOutDuration, except: 'fausto', resetReplay: true });
    if (faustoServiceFadeFrame) cancelAnimationFrame(faustoServiceFadeFrame);
    faustoServiceFadeFrame = undefined;
    faustoServiceAudioEl.pause();
    faustoServiceRevealProgress = getServiceResumeProgress(
      getFaustoServiceSpeechPages(),
      faustoServiceRevealProgress,
      faustoServiceMutedPageIndex,
      shouldResumeServiceAudioFromMutedPage
    );
    faustoServiceAudioEl.currentTime =
      faustoServiceRevealProgress * getAudioDuration(faustoServiceAudioEl, faustoServiceRevealDurationSeconds);
    faustoServiceAudioEl.volume = 0;
    shouldResumeServiceAudioFromMutedPage = false;

    try {
      await faustoServiceAudioEl.play();
      if (!isFaustoServiceAudioStarting || isAudioMuted || !isFaustoServiceDialogueVisible()) {
        faustoServiceAudioEl.pause();
        return;
      }
      isFaustoServiceAudioActive = true;
      fadeFaustoServiceAudioVolume(faustoServiceAudioVolume, serviceAudioFadeInDuration);
      setServiceAmbientVolume();
    } catch {
      isFaustoServiceAudioActive = false;
    } finally {
      isFaustoServiceAudioStarting = false;
    }
  }

  async function startNiniServiceAudio() {
    if (
      isAudioMuted ||
      isNiniServiceAudioActive ||
      (hasPlayedNiniServiceAudio && niniServiceRevealProgress >= 0.995) ||
      isNiniServiceAudioStarting ||
      !niniServiceAudioEl ||
      !isNiniServiceDialogueVisible()
    ) {
      return;
    }

    isNiniServiceAudioStarting = true;
    stopAllServiceAudio({ duration: serviceAudioHandoffFadeOutDuration, except: 'nini', resetReplay: true });
    if (niniServiceFadeFrame) cancelAnimationFrame(niniServiceFadeFrame);
    niniServiceFadeFrame = undefined;
    niniServiceAudioEl.pause();
    niniServiceRevealProgress = getServiceResumeProgress(
      getNiniServiceSpeechPages(),
      niniServiceRevealProgress,
      niniServiceMutedPageIndex,
      shouldResumeServiceAudioFromMutedPage
    );
    niniServiceAudioEl.currentTime =
      niniServiceRevealProgress * getAudioDuration(niniServiceAudioEl, niniServiceRevealDurationSeconds);
    niniServiceAudioEl.volume = 0;
    shouldResumeServiceAudioFromMutedPage = false;

    try {
      await niniServiceAudioEl.play();
      if (!isNiniServiceAudioStarting || isAudioMuted || !isNiniServiceDialogueVisible()) {
        niniServiceAudioEl.pause();
        return;
      }
      isNiniServiceAudioActive = true;
      fadeNiniServiceAudioVolume(niniServiceAudioVolume, serviceAudioFadeInDuration);
      setServiceAmbientVolume();
    } catch {
      isNiniServiceAudioActive = false;
    } finally {
      isNiniServiceAudioStarting = false;
    }
  }

  function stopCarloServiceAudio(duration = carloServiceAudioFadeOutDuration, resetReplay = false) {
    if (!carloServiceAudioEl) {
      isCarloServiceAudioActive = false;
      isCarloServiceAudioStarting = false;
      return;
    }

    isCarloServiceAudioStarting = false;
    syncCarloServiceSpeechReveal();
    if (resetReplay) hasPlayedCarloServiceAudio = false;
    if (carloServiceAudioEl.paused || duration <= 0) {
      carloServiceAudioEl.pause();
      isCarloServiceAudioActive = false;
      setServiceAmbientVolume();
      return;
    }

    fadeCarloServiceAudioVolume(0, duration, () => {
      carloServiceAudioEl.pause();
      carloServiceAudioEl.volume = carloServiceAudioVolume;
      isCarloServiceAudioActive = false;
      setServiceAmbientVolume();
    });
  }

  function stopElisabettaServiceAudio(duration = elisabettaServiceAudioFadeOutDuration, resetReplay = false) {
    if (!elisabettaServiceAudioEl) {
      isElisabettaServiceAudioActive = false;
      isElisabettaServiceAudioStarting = false;
      return;
    }

    isElisabettaServiceAudioStarting = false;
    syncElisabettaServiceSpeechReveal();
    if (resetReplay) hasPlayedElisabettaServiceAudio = false;
    if (elisabettaServiceAudioEl.paused || duration <= 0) {
      elisabettaServiceAudioEl.pause();
      isElisabettaServiceAudioActive = false;
      setServiceAmbientVolume();
      return;
    }

    fadeElisabettaServiceAudioVolume(0, duration, () => {
      elisabettaServiceAudioEl.pause();
      elisabettaServiceAudioEl.volume = elisabettaServiceAudioVolume;
      isElisabettaServiceAudioActive = false;
      setServiceAmbientVolume();
    });
  }

  function stopMarcoServiceAudio(duration = marcoServiceAudioFadeOutDuration, resetReplay = false) {
    if (!marcoServiceAudioEl) {
      isMarcoServiceAudioActive = false;
      isMarcoServiceAudioStarting = false;
      return;
    }

    isMarcoServiceAudioStarting = false;
    syncMarcoServiceSpeechReveal();
    if (resetReplay) hasPlayedMarcoServiceAudio = false;
    if (marcoServiceAudioEl.paused || duration <= 0) {
      marcoServiceAudioEl.pause();
      isMarcoServiceAudioActive = false;
      setServiceAmbientVolume();
      return;
    }

    fadeMarcoServiceAudioVolume(0, duration, () => {
      marcoServiceAudioEl.pause();
      marcoServiceAudioEl.volume = marcoServiceAudioVolume;
      isMarcoServiceAudioActive = false;
      setServiceAmbientVolume();
    });
  }

  function stopFaustoServiceAudio(duration = faustoServiceAudioFadeOutDuration, resetReplay = false) {
    if (!faustoServiceAudioEl) {
      isFaustoServiceAudioActive = false;
      isFaustoServiceAudioStarting = false;
      return;
    }

    isFaustoServiceAudioStarting = false;
    syncFaustoServiceSpeechReveal();
    if (resetReplay) hasPlayedFaustoServiceAudio = false;
    if (faustoServiceAudioEl.paused || duration <= 0) {
      faustoServiceAudioEl.pause();
      isFaustoServiceAudioActive = false;
      setServiceAmbientVolume();
      return;
    }

    fadeFaustoServiceAudioVolume(0, duration, () => {
      faustoServiceAudioEl.pause();
      faustoServiceAudioEl.volume = faustoServiceAudioVolume;
      isFaustoServiceAudioActive = false;
      setServiceAmbientVolume();
    });
  }

  function stopNiniServiceAudio(duration = niniServiceAudioFadeOutDuration, resetReplay = false) {
    if (!niniServiceAudioEl) {
      isNiniServiceAudioActive = false;
      isNiniServiceAudioStarting = false;
      return;
    }

    isNiniServiceAudioStarting = false;
    syncNiniServiceSpeechReveal();
    if (resetReplay) hasPlayedNiniServiceAudio = false;
    if (niniServiceAudioEl.paused || duration <= 0) {
      niniServiceAudioEl.pause();
      isNiniServiceAudioActive = false;
      setServiceAmbientVolume();
      return;
    }

    fadeNiniServiceAudioVolume(0, duration, () => {
      niniServiceAudioEl.pause();
      niniServiceAudioEl.volume = niniServiceAudioVolume;
      isNiniServiceAudioActive = false;
      setServiceAmbientVolume();
    });
  }

  function stopAllServiceAudio(
    options: {
      duration?: number;
      except?: 'carlo' | 'elisabetta' | 'marco' | 'fausto' | 'nini';
      resetReplay?: boolean;
    } = {}
  ) {
    const duration = options.duration ?? 0.18;
    const resetReplay = options.resetReplay ?? true;

    if (options.except !== 'carlo') stopCarloServiceAudio(duration, resetReplay);
    if (options.except !== 'elisabetta') stopElisabettaServiceAudio(duration, resetReplay);
    if (options.except !== 'marco') stopMarcoServiceAudio(duration, resetReplay);
    if (options.except !== 'fausto') stopFaustoServiceAudio(duration, resetReplay);
    if (options.except !== 'nini') stopNiniServiceAudio(duration, resetReplay);
  }

  $effect(() => {
    servicePhaserGame?.setAudioMuted(isAudioMuted);

    if (isAudioMuted) {
      shouldResumeServiceAudioFromMutedPage = true;
      stopAllServiceAudio({ duration: serviceAudioHandoffFadeOutDuration, resetReplay: true });
      stopAmbientAudio();
      return;
    }

    if (!isSceneRevealed) return;

    void startAmbientAudio();

    const hasVisibleDialogue =
      isCarloServiceDialogueVisible() ||
      isElisabettaServiceDialogueVisible() ||
      isMarcoServiceDialogueVisible() ||
      isFaustoServiceDialogueVisible() ||
      isNiniServiceDialogueVisible();
    if (!hasVisibleDialogue) shouldResumeServiceAudioFromMutedPage = false;

    if (isCarloServiceDialogueVisible()) void startCarloServiceAudio();
    if (isElisabettaServiceDialogueVisible()) void startElisabettaServiceAudio();
    if (isMarcoServiceDialogueVisible()) void startMarcoServiceAudio();
    if (isFaustoServiceDialogueVisible()) void startFaustoServiceAudio();
    if (isNiniServiceDialogueVisible()) void startNiniServiceAudio();
  });

  $effect(() => {
    const visible = isCarloServiceDialogueVisible();

    if (isAudioMuted) return;
    if (visible) {
      void startCarloServiceAudio();
      return;
    }

    if (!visible) {
      hasPlayedCarloServiceAudio = false;
    }

    if (!visible && (isCarloServiceAudioActive || isCarloServiceAudioStarting)) {
      stopCarloServiceAudio(carloServiceAudioFadeOutDuration, true);
    }

    if (cameraX < getCarloServiceEnterCameraX() - carloServiceEnterDistance) {
      hasPlayedCarloServiceAudio = false;
    }
  });

  $effect(() => {
    const visible = isElisabettaServiceDialogueVisible();

    if (isAudioMuted) return;
    if (visible) {
      void startElisabettaServiceAudio();
      return;
    }

    if (!visible) {
      hasPlayedElisabettaServiceAudio = false;
    }

    if (!visible && (isElisabettaServiceAudioActive || isElisabettaServiceAudioStarting)) {
      stopElisabettaServiceAudio(elisabettaServiceAudioFadeOutDuration, true);
    }

    if (cameraX < getElisabettaServiceStartCameraX() - elisabettaServiceEnterDistance) {
      hasPlayedElisabettaServiceAudio = false;
    }
  });

  $effect(() => {
    const visible = isMarcoServiceDialogueVisible();

    if (isAudioMuted) return;
    if (visible) {
      void startMarcoServiceAudio();
      return;
    }

    if (!visible) {
      hasPlayedMarcoServiceAudio = false;
    }

    if (!visible && (isMarcoServiceAudioActive || isMarcoServiceAudioStarting)) {
      stopMarcoServiceAudio(marcoServiceAudioFadeOutDuration, true);
    }

    if (cameraX < getMarcoServiceStartCameraX() - marcoServiceEnterDistance) {
      hasPlayedMarcoServiceAudio = false;
    }
  });

  $effect(() => {
    const visible = isFaustoServiceDialogueVisible();

    if (isAudioMuted) return;
    if (visible) {
      void startFaustoServiceAudio();
      return;
    }

    if (!visible) {
      hasPlayedFaustoServiceAudio = false;
    }

    if (!visible && (isFaustoServiceAudioActive || isFaustoServiceAudioStarting)) {
      stopFaustoServiceAudio(faustoServiceAudioFadeOutDuration, true);
    }

    if (cameraX < getFaustoServiceStartCameraX() - faustoServiceEnterDistance) {
      hasPlayedFaustoServiceAudio = false;
    }
  });

  $effect(() => {
    const visible = isNiniServiceDialogueVisible();

    if (isAudioMuted) return;
    if (visible) {
      void startNiniServiceAudio();
      return;
    }

    if (!visible) {
      hasPlayedNiniServiceAudio = false;
    }

    if (!visible && (isNiniServiceAudioActive || isNiniServiceAudioStarting)) {
      stopNiniServiceAudio(niniServiceAudioFadeOutDuration, true);
    }

    if (cameraX < getNiniServiceStartCameraX() - niniServiceEnterDistance) {
      hasPlayedNiniServiceAudio = false;
    }
  });

  onMount(() => {
    let destroyed = false;
    let removeTicker = () => {};
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const syncReducedMotion = () => {
      prefersReducedMotion = reducedMotionQuery.matches;
    };
    const stopResize = createViewportObserver(stageEl, syncViewport);

    syncReducedMotion();
    reducedMotionQuery.addEventListener('change', syncReducedMotion);
    window.addEventListener('keydown', onKeydown);
    stageEl.addEventListener('click', triggerTapClickFeedback, true);
    void import('$lib/scene/phaser/ParallaxPhaserGame').then(({ createParallaxPhaserGame }) => {
      if (destroyed || !servicePhaserContainerEl) return;

      createParallaxPhaserGame({
        assetVersion,
        assets: servicePhaserAssets,
        chunks: serviceBackgroundChunks,
        chunkOffsetY: serviceBackgroundOffsetY,
        chunkViewportOffsetY: serviceBackgroundViewportOffsetY,
        container: servicePhaserContainerEl,
        getChunkPath: serviceChunkPath,
        getViewport: () => ({
          width: Math.max(1, viewportWidth || stageEl?.clientWidth || 1),
          height: Math.max(1, viewportHeight || stageEl?.clientHeight || 1)
        }),
        isAudioMuted: () => isAudioMuted,
        layerSpeed,
        onLoadingProgress: (progress) => {
          phaserLoadingProgress = progress;
        },
        onReady: () => {
          phaserLoadingProgress = 1;
          isPhaserReady = true;
          servicePhaserGame?.setAudioMuted(isAudioMuted);
        },
        sceneHeight,
        sceneWidth,
        viewportOffsetYByLayer: {
          middle: serviceMiddleViewportOffsetY
        }
      }).then((game) => {
        if (destroyed) {
          game?.destroy();
          return;
        }

        servicePhaserGame = game;
        servicePhaserGame?.setCameraX(cameraX);
        scheduleServicePhaserResize();
      });
    });
    void loadGsapWithScrollTrigger().then(({ gsap, ScrollTrigger }) => {
      if (destroyed) return;

      scrollTrigger = ScrollTrigger.create({
        anticipatePin: 1,
        end: () => `+=${Math.max(maxScrollX, window.innerHeight * 0.85, 1)}`,
        id: 'service-horizontal-scroll',
        invalidateOnRefresh: true,
        onRefresh: (self) => {
          if (!isSceneInteractive) {
            targetCameraX = 0;
            cameraX = 0;
            servicePhaserGame?.setCameraX(0);
            if (self.scroll() !== self.start) self.scroll(self.start);
            return;
          }
          setTargetCameraX(self.progress * maxScrollX);
        },
        onUpdate: (self) => {
          if (!isSceneInteractive) {
            targetCameraX = 0;
            cameraX = 0;
            servicePhaserGame?.setCameraX(0);
            if (self.scroll() !== self.start) self.scroll(self.start);
            return;
          }
          setTargetCameraX(self.progress * maxScrollX);
        },
        pin: stageEl,
        scrub: true,
        start: 'top top',
        trigger: stageEl
      });

      const tick = (_time: number, delta: number) => {
        evaluateScene(delta);
      };

      gsap.ticker.add(tick);
      removeTicker = () => gsap.ticker.remove(tick);
      ScrollTrigger.refresh();
    });
    requestAnimationFrame(() => {
      isSceneLoaded = true;
    });

    return () => {
      destroyed = true;
      if (sceneRevealTimer) window.clearTimeout(sceneRevealTimer);
      reducedMotionQuery.removeEventListener('change', syncReducedMotion);
      window.removeEventListener('keydown', onKeydown);
      stageEl?.removeEventListener('click', triggerTapClickFeedback, true);
      stopResize();
      removeTicker();
      scrollTrigger?.kill();
      scrollTrigger = undefined;
      if (serviceAmbientFadeFrame) cancelAnimationFrame(serviceAmbientFadeFrame);
      if (carloServiceFadeFrame) cancelAnimationFrame(carloServiceFadeFrame);
      if (elisabettaServiceFadeFrame) cancelAnimationFrame(elisabettaServiceFadeFrame);
      if (marcoServiceFadeFrame) cancelAnimationFrame(marcoServiceFadeFrame);
      if (faustoServiceFadeFrame) cancelAnimationFrame(faustoServiceFadeFrame);
      if (niniServiceFadeFrame) cancelAnimationFrame(niniServiceFadeFrame);
      if (servicePhaserResizeTimer) window.clearTimeout(servicePhaserResizeTimer);
      servicePhaserGame?.destroy();
      servicePhaserGame = undefined;
      servicePhaserResizeTimer = undefined;
      serviceAmbientFadeFrame = undefined;
      carloServiceFadeFrame = undefined;
      elisabettaServiceFadeFrame = undefined;
      marcoServiceFadeFrame = undefined;
      faustoServiceFadeFrame = undefined;
      niniServiceFadeFrame = undefined;
      serviceAmbientAudioEl?.pause();
      carloServiceAudioEl?.pause();
      elisabettaServiceAudioEl?.pause();
      marcoServiceAudioEl?.pause();
      faustoServiceAudioEl?.pause();
      niniServiceAudioEl?.pause();
      isAmbientAudioStarted = false;
      isCarloServiceAudioActive = false;
      isElisabettaServiceAudioActive = false;
      isMarcoServiceAudioActive = false;
      isFaustoServiceAudioActive = false;
      isNiniServiceAudioActive = false;
    };
  });

  $effect(() => {
    if (isSceneLoaded && isPhaserReady) {
      if (!isSceneRevealed && !sceneRevealTimer) {
        sceneRevealTimer = window.setTimeout(() => {
          isSceneRevealed = true;
          sceneRevealTimer = undefined;
        }, sceneRevealDelayMs);
      }
      return;
    }

    if (sceneRevealTimer) {
      window.clearTimeout(sceneRevealTimer);
      sceneRevealTimer = undefined;
    }
    isSceneRevealed = false;
  });

  $effect(() => {
    onSceneRevealedChange?.(isSceneRevealed);
  });
</script>

<section
  bind:this={stageEl}
  class="service-stage"
  class:is-dragging={isDragging}
  class:is-loaded={isSceneRevealed}
  data-progress={progress.toFixed(3)}
  aria-label="Scena parallasse della sala"
  onwheel={onWheel}
  onpointerdown={onPointerDown}
  onpointermove={onPointerMove}
  onpointerleave={onPointerLeave}
  onpointerup={endDrag}
  onpointercancel={endDrag}
>
  <SceneProgressBar {progress} isVisible={isSceneRevealed} ticks={serviceProgressTicks} />

  <div bind:this={servicePhaserContainerEl} class="service-phaser-layer" aria-hidden="true"></div>
  {#if !isSceneRevealed}
    <SceneLoadingProgress progress={phaserLoadingProgress} />
  {/if}

  <aside class="scene-coordinate-indicator" aria-label="Coordinate scena per posizionamento asset">
    <div class="coordinate-indicator-title">coordinate scena</div>
    <dl>
      <div>
        <dt>y</dt>
        <dd>{hasPointerScenePosition ? coord(pointerSceneY) : '...'}</dd>
      </div>
      <div>
        <dt>x bg</dt>
        <dd>{hasPointerScenePosition ? coord(pointerSceneX.background) : '...'}</dd>
      </div>
      <div>
        <dt>x mid</dt>
        <dd>{hasPointerScenePosition ? coord(pointerSceneX.middle) : '...'}</dd>
      </div>
      <div>
        <dt>x fg</dt>
        <dd>{hasPointerScenePosition ? coord(pointerSceneX.foreground) : '...'}</dd>
      </div>
      <div>
        <dt>camera</dt>
        <dd>{coord(cameraX)}</dd>
      </div>
      <div>
        <dt>scale</dt>
        <dd>{coordDecimal(sceneScale)}</dd>
      </div>
      <div>
        <dt>near</dt>
        <dd>{nearestSceneAsset ? nearestSceneAsset.id : '...'}</dd>
      </div>
      <div>
        <dt>dist</dt>
        <dd>{nearestSceneAsset ? coord(nearestSceneAsset.distance) : '...'}</dd>
      </div>
    </dl>
  </aside>

  <div class="service-scroll-space" style={scrollSpaceStyle}>
    <div class="service-world" style={worldStyle}>
      {#if serviceMascotAsset}
        <button
          class="service-mascot-hotspot"
          class:is-tooltip-visible={hoveredServiceAssetId === '2_mascotte'}
          type="button"
          aria-label="Dettaglio mascotte sala"
          style={getServiceMascotHotspotStyle()}
          onpointerdown={(event) => event.stopPropagation()}
          onclick={(event) => event.stopPropagation()}
        >
          <span class="service-mascot-tooltip">
            {serviceMascotHoverText}
          </span>
        </button>
      {/if}
      {#if servicePitcherAsset}
        <button
          class="service-mascot-hotspot service-pitcher-hotspot"
          class:is-tooltip-visible={hoveredServiceAssetId === '1_brocca'}
          type="button"
          aria-label="Dettaglio brocca sala"
          style={getServicePitcherHotspotStyle()}
          onpointerdown={(event) => event.stopPropagation()}
          onclick={(event) => event.stopPropagation()}
        >
          <span class="service-mascot-tooltip service-pitcher-tooltip">
            {servicePitcherHoverText}
          </span>
        </button>
      {/if}
      {#if serviceClocheAsset}
        <button
          class="service-mascot-hotspot service-cloche-hotspot"
          class:is-tooltip-visible={hoveredServiceAssetId === '1_cloche'}
          type="button"
          aria-label="Dettaglio cloche sala"
          style={getServiceClocheHotspotStyle()}
          onpointerdown={(event) => event.stopPropagation()}
          onclick={(event) => event.stopPropagation()}
        >
          <span class="service-mascot-tooltip service-cloche-tooltip">
            {serviceClocheHoverText}
          </span>
        </button>
      {/if}
      {#if serviceBottlesAsset}
        <button
          class="service-mascot-hotspot service-bottles-hotspot"
          class:is-tooltip-visible={hoveredServiceAssetId === '1_BottiglieVaso'}
          type="button"
          aria-label="Dettaglio bottiglie sala"
          style={getServiceBottlesHotspotStyle()}
          onpointerdown={(event) => event.stopPropagation()}
          onclick={(event) => event.stopPropagation()}
        >
          <span class="service-mascot-tooltip service-bottles-tooltip">
            {serviceBottlesHoverText}
          </span>
        </button>
      {/if}
      {#if serviceCameraAsset}
        <button
          class="service-mascot-hotspot service-camera-hotspot"
          class:is-tooltip-visible={hoveredServiceAssetId === '1_camera'}
          type="button"
          aria-label="Dettaglio camera sala"
          style={getServiceCameraHotspotStyle()}
          onpointerdown={(event) => event.stopPropagation()}
          onclick={(event) => event.stopPropagation()}
        >
          <span class="service-mascot-tooltip service-camera-tooltip">
            {serviceCameraHoverText}
          </span>
        </button>
      {/if}
      {#if serviceLunchboxAsset}
        <button
          class="service-mascot-hotspot service-lunchbox-hotspot"
          class:is-tooltip-visible={hoveredServiceAssetId === '1_Lunchbox'}
          type="button"
          aria-label="Dettaglio lunchbox sala"
          style={getServiceLunchboxHotspotStyle()}
          onpointerdown={(event) => event.stopPropagation()}
          onclick={(event) => event.stopPropagation()}
        >
          <span class="service-mascot-tooltip service-lunchbox-tooltip">
            {serviceLunchboxHoverText}
          </span>
        </button>
      {/if}
      {#if isSceneRevealed}
        <h1 class="service-title" style={getTitleStyle()} aria-label="Sala">Sala</h1>
      {/if}
      <div
        class="service-chef-button"
        class:is-dialogue-visible={isCarloServiceDialogueVisible()}
        data-testimonial="carlo-service"
        style={`${getCarloServiceStyle()}; --reveal-delay: 390ms;`}
        role="button"
        tabindex="0"
        aria-label="Testimonianza Carlo Zarri servizio"
        onpointerdown={(event) => {
          event.stopPropagation();
          hasPlayedCarloServiceAudio = false;
          void startCarloServiceAudio();
        }}
        onkeydown={(event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          hasPlayedCarloServiceAudio = false;
          void startCarloServiceAudio();
        }}
      >
        <span class="speech-bubble" aria-hidden={!isCarloServiceDialogueVisible()}>
          <span class="speech-bubble-copy has-page-controls" aria-label={carloServiceSpeechInfo.speech}>
            {#if !isAudioMuted}
              <span class="speech-bubble-text speech-bubble-text-audio" aria-hidden="true">
                <span class="speech-bubble-text-line">
                  <span class="speech-bubble-text-progress">{carloServiceSpeechInfo.highlightedSpeech}</span><span
                    class="speech-bubble-text-pending">{getCarloServicePendingSpeech()}</span
                  >
                </span>
              </span>
            {:else}
              <span class="speech-bubble-text">{carloServiceSpeechInfo.speech}</span>
            {/if}
            {#if carloServiceSpeechPageCount > 1}
              <span
                class="speech-bubble-page-controls"
                aria-label={`Dialogo ${carloServiceVisiblePageIndex + 1} di ${carloServiceSpeechPageCount} per Carlo Zarri`}
              >
                <button
                  class="speech-bubble-page-button speech-bubble-page-button-prev"
                  type="button"
                  aria-label="Dialogo precedente di Carlo Zarri"
                  disabled={carloServiceVisiblePageIndex <= 0}
                  onpointerdown={(event) => event.stopPropagation()}
                  onclick={rewindCarloServicePage}
                >
                  <svg class="speech-bubble-page-icon" viewBox="0 0 52 52" aria-hidden="true" focusable="false">
                    <path
                      class="speech-bubble-page-icon-depth"
                      d="M14.1 22.5 Q8 26 14.1 29.5 L34.9 41.5 Q41 45 41 38 L41 14 Q41 7 34.9 10.5 Z"
                    />
                    <path
                      class="speech-bubble-page-icon-face"
                      d="M14.1 22.5 Q8 26 14.1 29.5 L34.9 41.5 Q41 45 41 38 L41 14 Q41 7 34.9 10.5 Z"
                    />
                  </svg>
                </button>
                <span class="speech-bubble-page-counter" aria-hidden="true">
                  {carloServiceVisiblePageIndex + 1}/{carloServiceSpeechPageCount}
                </span>
                <button
                  class="speech-bubble-page-button speech-bubble-page-button-next"
                  type="button"
                  aria-label="Dialogo successivo di Carlo Zarri"
                  disabled={carloServiceVisiblePageIndex >= carloServiceSpeechPageCount - 1}
                  onpointerdown={(event) => event.stopPropagation()}
                  onclick={advanceCarloServicePage}
                >
                  <svg class="speech-bubble-page-icon" viewBox="0 0 52 52" aria-hidden="true" focusable="false">
                    <path
                      class="speech-bubble-page-icon-depth"
                      d="M37.9 22.5 Q44 26 37.9 29.5 L17.1 41.5 Q11 45 11 38 L11 14 Q11 7 17.1 10.5 Z"
                    />
                    <path
                      class="speech-bubble-page-icon-face"
                      d="M37.9 22.5 Q44 26 37.9 29.5 L17.1 41.5 Q11 45 11 38 L11 14 Q11 7 17.1 10.5 Z"
                    />
                  </svg>
                </button>
              </span>
            {/if}
          </span>
          <span class="speech-bubble-meta" aria-label="Chief Executive Chef - Carlo Zarri">
            <span class="speech-bubble-meta-label">
              <span>Chief Executive Chef - </span>
              <strong>Carlo Zarri</strong>
            </span>
          </span>
        </span>
        <img src="/assets/interviews-hover/zarri.png" alt="Carlo Zarri" draggable="false" />
      </div>
      <div
        class="service-chef-button"
        class:is-dialogue-visible={isElisabettaServiceDialogueVisible()}
        data-testimonial="elisabetta-service"
        style={`${getElisabettaServiceStyle()}; --reveal-delay: 410ms;`}
        role="button"
        tabindex="0"
        aria-label="Testimonianza Elisabetta Salvadori servizio"
        onpointerdown={(event) => {
          event.stopPropagation();
          hasPlayedElisabettaServiceAudio = false;
          void startElisabettaServiceAudio();
        }}
        onkeydown={(event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          hasPlayedElisabettaServiceAudio = false;
          void startElisabettaServiceAudio();
        }}
      >
        <span class="speech-bubble" aria-hidden={!isElisabettaServiceDialogueVisible()}>
          <span class="speech-bubble-copy has-page-controls" aria-label={elisabettaServiceSpeechInfo.speech}>
            {#if !isAudioMuted}
              <span class="speech-bubble-text speech-bubble-text-audio" aria-hidden="true">
                <span class="speech-bubble-text-line">
                  <span class="speech-bubble-text-progress">{elisabettaServiceSpeechInfo.highlightedSpeech}</span><span
                    class="speech-bubble-text-pending">{getElisabettaServicePendingSpeech()}</span
                  >
                </span>
              </span>
            {:else}
              <span class="speech-bubble-text">{elisabettaServiceSpeechInfo.speech}</span>
            {/if}
            {#if elisabettaServiceSpeechPageCount > 1}
              <span
                class="speech-bubble-page-controls"
                aria-label={`Dialogo ${elisabettaServiceVisiblePageIndex + 1} di ${elisabettaServiceSpeechPageCount} per Elisabetta Salvadori`}
              >
                <button
                  class="speech-bubble-page-button speech-bubble-page-button-prev"
                  type="button"
                  aria-label="Dialogo precedente di Elisabetta Salvadori"
                  disabled={elisabettaServiceVisiblePageIndex <= 0}
                  onpointerdown={(event) => event.stopPropagation()}
                  onclick={rewindElisabettaServicePage}
                >
                  <svg class="speech-bubble-page-icon" viewBox="0 0 52 52" aria-hidden="true" focusable="false">
                    <path
                      class="speech-bubble-page-icon-depth"
                      d="M14.1 22.5 Q8 26 14.1 29.5 L34.9 41.5 Q41 45 41 38 L41 14 Q41 7 34.9 10.5 Z"
                    />
                    <path
                      class="speech-bubble-page-icon-face"
                      d="M14.1 22.5 Q8 26 14.1 29.5 L34.9 41.5 Q41 45 41 38 L41 14 Q41 7 34.9 10.5 Z"
                    />
                  </svg>
                </button>
                <span class="speech-bubble-page-counter" aria-hidden="true">
                  {elisabettaServiceVisiblePageIndex + 1}/{elisabettaServiceSpeechPageCount}
                </span>
                <button
                  class="speech-bubble-page-button speech-bubble-page-button-next"
                  type="button"
                  aria-label="Dialogo successivo di Elisabetta Salvadori"
                  disabled={elisabettaServiceVisiblePageIndex >= elisabettaServiceSpeechPageCount - 1}
                  onpointerdown={(event) => event.stopPropagation()}
                  onclick={advanceElisabettaServicePage}
                >
                  <svg class="speech-bubble-page-icon" viewBox="0 0 52 52" aria-hidden="true" focusable="false">
                    <path
                      class="speech-bubble-page-icon-depth"
                      d="M37.9 22.5 Q44 26 37.9 29.5 L17.1 41.5 Q11 45 11 38 L11 14 Q11 7 17.1 10.5 Z"
                    />
                    <path
                      class="speech-bubble-page-icon-face"
                      d="M37.9 22.5 Q44 26 37.9 29.5 L17.1 41.5 Q11 45 11 38 L11 14 Q11 7 17.1 10.5 Z"
                    />
                  </svg>
                </button>
              </span>
            {/if}
          </span>
          <span class="speech-bubble-meta" aria-label="Head Food and Beverage - Elisabetta Salvadori">
            <span class="speech-bubble-meta-label">
              <span>Head Food and Beverage - </span>
              <strong>Elisabetta Salvadori</strong>
            </span>
          </span>
        </span>
        <img src="/assets/interviews-hover/eli.png" alt="Elisabetta Salvadori" draggable="false" />
      </div>
      <div
        class="service-chef-button"
        class:is-dialogue-visible={isMarcoServiceDialogueVisible()}
        data-testimonial="marco-service"
        style={`${getMarcoServiceStyle()}; --reveal-delay: 420ms;`}
        role="button"
        tabindex="0"
        aria-label="Testimonianza Marco Frassante servizio"
        onpointerdown={(event) => {
          event.stopPropagation();
          hasPlayedMarcoServiceAudio = false;
          void startMarcoServiceAudio();
        }}
        onkeydown={(event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          hasPlayedMarcoServiceAudio = false;
          void startMarcoServiceAudio();
        }}
      >
        <span class="speech-bubble" aria-hidden={!isMarcoServiceDialogueVisible()}>
          <span class="speech-bubble-copy has-page-controls" aria-label={marcoServiceSpeechInfo.speech}>
            {#if !isAudioMuted}
              <span class="speech-bubble-text speech-bubble-text-audio" aria-hidden="true">
                <span class="speech-bubble-text-line">
                  <span class="speech-bubble-text-progress">{marcoServiceSpeechInfo.highlightedSpeech}</span><span
                    class="speech-bubble-text-pending">{getMarcoServicePendingSpeech()}</span
                  >
                </span>
              </span>
            {:else}
              <span class="speech-bubble-text">{marcoServiceSpeechInfo.speech}</span>
            {/if}
            {#if marcoServiceSpeechPageCount > 1}
              <span
                class="speech-bubble-page-controls"
                aria-label={`Dialogo ${marcoServiceVisiblePageIndex + 1} di ${marcoServiceSpeechPageCount} per Marco Frassante`}
              >
                <button
                  class="speech-bubble-page-button speech-bubble-page-button-prev"
                  type="button"
                  aria-label="Dialogo precedente di Marco Frassante"
                  disabled={marcoServiceVisiblePageIndex <= 0}
                  onpointerdown={(event) => event.stopPropagation()}
                  onclick={rewindMarcoServicePage}
                >
                  <svg class="speech-bubble-page-icon" viewBox="0 0 52 52" aria-hidden="true" focusable="false">
                    <path
                      class="speech-bubble-page-icon-depth"
                      d="M14.1 22.5 Q8 26 14.1 29.5 L34.9 41.5 Q41 45 41 38 L41 14 Q41 7 34.9 10.5 Z"
                    />
                    <path
                      class="speech-bubble-page-icon-face"
                      d="M14.1 22.5 Q8 26 14.1 29.5 L34.9 41.5 Q41 45 41 38 L41 14 Q41 7 34.9 10.5 Z"
                    />
                  </svg>
                </button>
                <span class="speech-bubble-page-counter" aria-hidden="true">
                  {marcoServiceVisiblePageIndex + 1}/{marcoServiceSpeechPageCount}
                </span>
                <button
                  class="speech-bubble-page-button speech-bubble-page-button-next"
                  type="button"
                  aria-label="Dialogo successivo di Marco Frassante"
                  disabled={marcoServiceVisiblePageIndex >= marcoServiceSpeechPageCount - 1}
                  onpointerdown={(event) => event.stopPropagation()}
                  onclick={advanceMarcoServicePage}
                >
                  <svg class="speech-bubble-page-icon" viewBox="0 0 52 52" aria-hidden="true" focusable="false">
                    <path
                      class="speech-bubble-page-icon-depth"
                      d="M37.9 22.5 Q44 26 37.9 29.5 L17.1 41.5 Q11 45 11 38 L11 14 Q11 7 17.1 10.5 Z"
                    />
                    <path
                      class="speech-bubble-page-icon-face"
                      d="M37.9 22.5 Q44 26 37.9 29.5 L17.1 41.5 Q11 45 11 38 L11 14 Q11 7 17.1 10.5 Z"
                    />
                  </svg>
                </button>
              </span>
            {/if}
          </span>
          <span class="speech-bubble-meta" aria-label="Executive Chef - Marco Frassante">
            <span class="speech-bubble-meta-label">
              <span>Executive Chef - </span>
              <strong>Marco Frassante</strong>
            </span>
          </span>
        </span>
        <img src="/assets/interviews-hover/marco.png" alt="Marco Frassante" draggable="false" />
      </div>
      <div
        class="service-chef-button"
        class:is-dialogue-visible={isFaustoServiceDialogueVisible()}
        data-testimonial="fausto-service"
        style={`${getFaustoServiceStyle()}; --reveal-delay: 420ms;`}
        role="button"
        tabindex="0"
        aria-label="Testimonianza Fausto Meli servizio"
        onpointerdown={(event) => {
          event.stopPropagation();
          hasPlayedFaustoServiceAudio = false;
          void startFaustoServiceAudio();
        }}
        onkeydown={(event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          hasPlayedFaustoServiceAudio = false;
          void startFaustoServiceAudio();
        }}
      >
        <span class="speech-bubble" aria-hidden={!isFaustoServiceDialogueVisible()}>
          <span class="speech-bubble-copy has-page-controls" aria-label={faustoServiceSpeechInfo.speech}>
            {#if !isAudioMuted}
              <span class="speech-bubble-text speech-bubble-text-audio" aria-hidden="true">
                <span class="speech-bubble-text-line">
                  <span class="speech-bubble-text-progress">{faustoServiceSpeechInfo.highlightedSpeech}</span><span
                    class="speech-bubble-text-pending">{getFaustoServicePendingSpeech()}</span
                  >
                </span>
              </span>
            {:else}
              <span class="speech-bubble-text">{faustoServiceSpeechInfo.speech}</span>
            {/if}
            {#if faustoServiceSpeechPageCount > 1}
              <span
                class="speech-bubble-page-controls"
                aria-label={`Dialogo ${faustoServiceVisiblePageIndex + 1} di ${faustoServiceSpeechPageCount} per Fausto Meli`}
              >
                <button
                  class="speech-bubble-page-button speech-bubble-page-button-prev"
                  type="button"
                  aria-label="Dialogo precedente di Fausto Meli"
                  disabled={faustoServiceVisiblePageIndex <= 0}
                  onpointerdown={(event) => event.stopPropagation()}
                  onclick={rewindFaustoServicePage}
                >
                  <svg class="speech-bubble-page-icon" viewBox="0 0 52 52" aria-hidden="true" focusable="false">
                    <path
                      class="speech-bubble-page-icon-depth"
                      d="M14.1 22.5 Q8 26 14.1 29.5 L34.9 41.5 Q41 45 41 38 L41 14 Q41 7 34.9 10.5 Z"
                    />
                    <path
                      class="speech-bubble-page-icon-face"
                      d="M14.1 22.5 Q8 26 14.1 29.5 L34.9 41.5 Q41 45 41 38 L41 14 Q41 7 34.9 10.5 Z"
                    />
                  </svg>
                </button>
                <span class="speech-bubble-page-counter" aria-hidden="true">
                  {faustoServiceVisiblePageIndex + 1}/{faustoServiceSpeechPageCount}
                </span>
                <button
                  class="speech-bubble-page-button speech-bubble-page-button-next"
                  type="button"
                  aria-label="Dialogo successivo di Fausto Meli"
                  disabled={faustoServiceVisiblePageIndex >= faustoServiceSpeechPageCount - 1}
                  onpointerdown={(event) => event.stopPropagation()}
                  onclick={advanceFaustoServicePage}
                >
                  <svg class="speech-bubble-page-icon" viewBox="0 0 52 52" aria-hidden="true" focusable="false">
                    <path
                      class="speech-bubble-page-icon-depth"
                      d="M37.9 22.5 Q44 26 37.9 29.5 L17.1 41.5 Q11 45 11 38 L11 14 Q11 7 17.1 10.5 Z"
                    />
                    <path
                      class="speech-bubble-page-icon-face"
                      d="M37.9 22.5 Q44 26 37.9 29.5 L17.1 41.5 Q11 45 11 38 L11 14 Q11 7 17.1 10.5 Z"
                    />
                  </svg>
                </button>
              </span>
            {/if}
          </span>
          <span class="speech-bubble-meta" aria-label="Executive Chef - Fausto Meli">
            <span class="speech-bubble-meta-label">
              <span>Executive Chef - </span>
              <strong>Fausto Meli</strong>
            </span>
          </span>
        </span>
        <img src="/assets/interviews-hover/fausto.png" alt="Fausto Meli" draggable="false" />
      </div>
      <div
        class="service-chef-button"
        class:is-dialogue-visible={isNiniServiceDialogueVisible()}
        data-testimonial="nini-service"
        style={`${getNiniServiceStyle()}; --reveal-delay: 420ms;`}
        role="button"
        tabindex="0"
        aria-label="Testimonianza Nini servizio"
        onpointerdown={(event) => {
          event.stopPropagation();
          hasPlayedNiniServiceAudio = false;
          void startNiniServiceAudio();
        }}
        onkeydown={(event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          hasPlayedNiniServiceAudio = false;
          void startNiniServiceAudio();
        }}
      >
        <span class="speech-bubble" aria-hidden={!isNiniServiceDialogueVisible()}>
          <span class="speech-bubble-copy has-page-controls" aria-label={niniServiceSpeechInfo.speech}>
            {#if !isAudioMuted}
              <span class="speech-bubble-text speech-bubble-text-audio" aria-hidden="true">
                <span class="speech-bubble-text-line">
                  <span class="speech-bubble-text-progress">{niniServiceSpeechInfo.highlightedSpeech}</span><span
                    class="speech-bubble-text-pending">{getNiniServicePendingSpeech()}</span
                  >
                </span>
              </span>
            {:else}
              <span class="speech-bubble-text">{niniServiceSpeechInfo.speech}</span>
            {/if}
            {#if niniServiceSpeechPageCount > 1}
              <span
                class="speech-bubble-page-controls"
                aria-label={`Dialogo ${niniServiceVisiblePageIndex + 1} di ${niniServiceSpeechPageCount} per Nini`}
              >
                <button
                  class="speech-bubble-page-button speech-bubble-page-button-prev"
                  type="button"
                  aria-label="Dialogo precedente di Nini"
                  disabled={niniServiceVisiblePageIndex <= 0}
                  onpointerdown={(event) => event.stopPropagation()}
                  onclick={rewindNiniServicePage}
                >
                  <svg class="speech-bubble-page-icon" viewBox="0 0 52 52" aria-hidden="true" focusable="false">
                    <path
                      class="speech-bubble-page-icon-depth"
                      d="M14.1 22.5 Q8 26 14.1 29.5 L34.9 41.5 Q41 45 41 38 L41 14 Q41 7 34.9 10.5 Z"
                    />
                    <path
                      class="speech-bubble-page-icon-face"
                      d="M14.1 22.5 Q8 26 14.1 29.5 L34.9 41.5 Q41 45 41 38 L41 14 Q41 7 34.9 10.5 Z"
                    />
                  </svg>
                </button>
                <span class="speech-bubble-page-counter" aria-hidden="true">
                  {niniServiceVisiblePageIndex + 1}/{niniServiceSpeechPageCount}
                </span>
                <button
                  class="speech-bubble-page-button speech-bubble-page-button-next"
                  type="button"
                  aria-label="Dialogo successivo di Nini"
                  disabled={niniServiceVisiblePageIndex >= niniServiceSpeechPageCount - 1}
                  onpointerdown={(event) => event.stopPropagation()}
                  onclick={advanceNiniServicePage}
                >
                  <svg class="speech-bubble-page-icon" viewBox="0 0 52 52" aria-hidden="true" focusable="false">
                    <path
                      class="speech-bubble-page-icon-depth"
                      d="M37.9 22.5 Q44 26 37.9 29.5 L17.1 41.5 Q11 45 11 38 L11 14 Q11 7 17.1 10.5 Z"
                    />
                    <path
                      class="speech-bubble-page-icon-face"
                      d="M37.9 22.5 Q44 26 37.9 29.5 L17.1 41.5 Q11 45 11 38 L11 14 Q11 7 17.1 10.5 Z"
                    />
                  </svg>
                </button>
              </span>
            {/if}
          </span>
          <span class="speech-bubble-meta" aria-label="Executive Chef - Nini">
            <span class="speech-bubble-meta-label">
              <span>Executive Chef - </span>
              <strong>Nini</strong>
            </span>
          </span>
        </span>
        <img src="/assets/interviews-hover/nini.png" alt="Nini" draggable="false" />
      </div>
    </div>
  </div>
</section>

<audio
  bind:this={serviceAmbientAudioEl}
  src="/sound/serviziobackground.mp3"
  preload="auto"
></audio>
<audio
  bind:this={carloServiceAudioEl}
  src="/sound/carlozarriservizio.mp3"
  preload="auto"
  onplay={() => {
    isCarloServiceAudioActive = true;
  }}
  ontimeupdate={syncCarloServiceSpeechReveal}
  onended={() => {
    carloServiceRevealProgress = 1;
    hasPlayedCarloServiceAudio = true;
    isCarloServiceAudioActive = false;
    setServiceAmbientVolume();
  }}
></audio>
<audio
  bind:this={elisabettaServiceAudioEl}
  src="/sound/elisabettaservizio.mp3"
  preload="auto"
  onplay={() => {
    isElisabettaServiceAudioActive = true;
  }}
  ontimeupdate={syncElisabettaServiceSpeechReveal}
  onended={() => {
    elisabettaServiceRevealProgress = 1;
    hasPlayedElisabettaServiceAudio = true;
    isElisabettaServiceAudioActive = false;
    setServiceAmbientVolume();
  }}
></audio>
<audio
  bind:this={marcoServiceAudioEl}
  src="/sound/marcoservizio.wav"
  preload="auto"
  onplay={() => {
    isMarcoServiceAudioActive = true;
  }}
  ontimeupdate={syncMarcoServiceSpeechReveal}
  onended={() => {
    marcoServiceRevealProgress = 1;
    hasPlayedMarcoServiceAudio = true;
    isMarcoServiceAudioActive = false;
    setServiceAmbientVolume();
  }}
></audio>
<audio
  bind:this={faustoServiceAudioEl}
  src="/sound/faustomeliservizio.mp3"
  preload="auto"
  onplay={() => {
    isFaustoServiceAudioActive = true;
  }}
  ontimeupdate={syncFaustoServiceSpeechReveal}
  onended={() => {
    faustoServiceRevealProgress = 1;
    hasPlayedFaustoServiceAudio = true;
    isFaustoServiceAudioActive = false;
    setServiceAmbientVolume();
  }}
></audio>
<audio
  bind:this={niniServiceAudioEl}
  src="/sound/niniservizio.mp3"
  preload="auto"
  onplay={() => {
    isNiniServiceAudioActive = true;
  }}
  ontimeupdate={syncNiniServiceSpeechReveal}
  onended={() => {
    niniServiceRevealProgress = 1;
    hasPlayedNiniServiceAudio = true;
    isNiniServiceAudioActive = false;
    setServiceAmbientVolume();
  }}
></audio>

<style>
  .service-stage {
    position: relative;
    width: 100%;
    height: var(--app-viewport-height);
    min-height: var(--app-viewport-height);
    overflow: hidden;
    background: var(--color-surface-page);
    cursor: url('/cursors/retrogusto-cursor.svg') 5 5, auto;
    scrollbar-width: none;
    user-select: none;
    overscroll-behavior: contain;
    touch-action: none;
  }

  .service-stage::-webkit-scrollbar {
    display: none;
  }

  .service-phaser-layer {
    position: absolute;
    z-index: 0;
    inset: 0;
    overflow: hidden;
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
    transition: opacity 260ms ease;
  }

  .service-stage.is-loaded .service-phaser-layer {
    opacity: 1;
    visibility: visible;
    pointer-events: auto;
  }

  .service-phaser-layer :global(canvas) {
    position: absolute;
    top: 0;
    left: 0;
    display: block;
    width: 100%;
    height: 100%;
    pointer-events: auto;
  }

  .scene-coordinate-indicator {
    position: fixed;
    z-index: 130;
    top: calc(var(--layout-page-gutter) + 82px);
    right: var(--layout-page-gutter);
    min-width: 154px;
    padding: 10px 12px 11px;
    border: 2px solid var(--color-border-primary);
    border-radius: var(--radius-s);
    background: rgb(248 243 233 / 0.9);
    color: var(--color-text-primary);
    box-shadow: 0 8px 18px rgb(var(--shadow-brand-rgb) / 0.12);
    font-family: var(--font-text);
    pointer-events: none;
    user-select: none;
  }

  .coordinate-indicator-title {
    margin-bottom: 6px;
    font-size: 10px;
    font-weight: 700;
    line-height: 1;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .scene-coordinate-indicator dl {
    display: grid;
    gap: 4px;
    margin: 0;
  }

  .scene-coordinate-indicator div {
    display: grid;
    grid-template-columns: 54px 1fr;
    align-items: baseline;
    gap: 8px;
  }

  .scene-coordinate-indicator dt,
  .scene-coordinate-indicator dd {
    margin: 0;
    font-size: 12px;
    line-height: 1.1;
  }

  .scene-coordinate-indicator dt {
    font-weight: 600;
    opacity: 0.68;
  }

  .scene-coordinate-indicator dd {
    overflow: hidden;
    font-variant-numeric: tabular-nums;
    font-weight: 800;
    text-align: right;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .service-scroll-space {
    position: relative;
    min-width: 100%;
    min-height: var(--app-viewport-height);
  }

  .service-world {
    position: sticky;
    left: 0;
    top: 0;
    min-width: 100%;
    min-height: var(--app-viewport-height);
    overflow: hidden;
  }

  .service-chef-button {
    position: absolute;
    z-index: 8;
    display: block;
    padding: 0;
    border: 0;
    background: transparent;
    color: inherit;
    cursor: url('/cursors/retrogusto-pointer-on-cream.svg?v=3') 4 3, pointer;
    opacity: var(--chef-entry-opacity, 0);
    pointer-events: auto;
    transform: translate3d(0, var(--chef-entry-y, 420px), 0);
    transform-origin: 50% 100%;
    transition:
      opacity 240ms ease,
      transform 460ms cubic-bezier(0.16, 1, 0.3, 1);
    user-select: none;
  }

  .service-mascot-hotspot {
    position: absolute;
    z-index: 7;
    display: block;
    padding: 0;
    border: 0;
    background: transparent;
    color: inherit;
    cursor: url('/cursors/retrogusto-pointer-on-cream.svg?v=3') 4 3, pointer;
  }

  .service-mascot-hotspot:focus-visible {
    outline: none;
  }

  .service-mascot-tooltip {
    position: absolute;
    z-index: 4;
    left: 50%;
    bottom: calc(100% + 18px);
    display: block;
    box-sizing: border-box;
    width: min(430px, calc(100vw - 48px));
    padding: 14px 18px;
    border: 2px solid #AA5DDE;
    border-radius: var(--radius-s);
    background: var(--color-surface-page);
    color: var(--brand-500);
    font-family: "JetBrains Mono", var(--font-text);
    font-size: 16px;
    font-style: italic;
    font-weight: 400;
    line-height: 1.35;
    text-align: left;
    opacity: 0;
    visibility: hidden;
    transform: translate3d(-50%, 8px, 0);
    transition:
      opacity 150ms ease,
      transform 180ms cubic-bezier(0.16, 1, 0.3, 1),
      visibility 0s linear 150ms;
    pointer-events: none;
  }

  .service-mascot-tooltip::before,
  .service-mascot-tooltip::after {
    position: absolute;
    left: 50%;
    width: 0;
    height: 0;
    content: '';
    transform: translateX(-50%);
  }

  .service-mascot-tooltip::before {
    top: 100%;
    border-top: 14px solid #AA5DDE;
    border-right: 12px solid transparent;
    border-left: 12px solid transparent;
  }

  .service-mascot-tooltip::after {
    top: calc(100% - 1px);
    border-top: 12px solid var(--color-surface-page);
    border-right: 11px solid transparent;
    border-left: 11px solid transparent;
  }

  .service-pitcher-tooltip {
    bottom: calc(100% + 34px);
    width: min(360px, calc(100vw - 48px));
  }

  .service-cloche-tooltip {
    width: min(430px, calc(100vw - 48px));
  }

  .service-bottles-tooltip {
    width: min(360px, calc(100vw - 48px));
  }

  .service-camera-tooltip {
    width: min(500px, calc(100vw - 48px));
  }

  .service-lunchbox-tooltip {
    bottom: calc(100% + 34px);
    width: min(460px, calc(100vw - 48px));
  }

  .service-mascot-hotspot:hover .service-mascot-tooltip,
  .service-mascot-hotspot:focus-visible .service-mascot-tooltip,
  .service-mascot-hotspot.is-tooltip-visible .service-mascot-tooltip {
    opacity: 1;
    visibility: visible;
    transform: translate3d(-50%, 0, 0);
    transition-delay: 0s;
  }

  .service-chef-button:focus-visible {
    outline: none;
  }

  .service-chef-button img {
    position: relative;
    z-index: 0;
    display: block;
    width: 100%;
    height: auto;
    pointer-events: none;
    user-select: none;
  }

  .speech-bubble {
    position: absolute;
    z-index: 7;
    left: 50%;
    top: var(--speech-bubble-top, calc(var(--layout-topbar-height) + 40px));
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    width: var(--speech-bubble-width, 350px);
    height: calc(var(--speech-bubble-copy-height, 132px) + var(--speech-bubble-meta-height, 34px) - 2px);
    color: var(--color-text-primary);
    font-family: var(--font-text);
    text-align: left;
    opacity: 0;
    transform: translate3d(calc(-50% + var(--speech-bubble-offset-x, 0px)), 18px, 0);
    transition:
      opacity 120ms ease,
      transform 280ms cubic-bezier(0.16, 1, 0.3, 1);
    pointer-events: none;
  }

  .speech-bubble::before {
    position: absolute;
    z-index: 0;
    left: var(--speech-bubble-arrow-left, 50%);
    bottom: -9px;
    width: 18px;
    height: 18px;
    background: var(--color-border-primary);
    clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%);
    content: '';
    opacity: 0;
    scale: 0.72;
    transform: translateX(-50%);
    transform-origin: 50% 50%;
    transition:
      opacity 1ms linear 260ms,
      scale 240ms cubic-bezier(0.16, 1, 0.3, 1) 260ms;
  }

  .speech-bubble-copy {
    position: relative;
    z-index: 1;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    flex: 0 0 var(--speech-bubble-copy-height, 132px);
    height: var(--speech-bubble-copy-height, 132px);
    padding: 34px 20px;
    border: 2px solid var(--color-border-primary);
    border-radius: 10px 10px 0 0;
    background: var(--color-surface-page);
    font-size: 15px;
    font-weight: 400;
    line-height: 1.34;
    overflow: hidden;
    white-space: pre-line;
    word-break: break-word;
    -webkit-clip-path: inset(100% 0 0 0);
    clip-path: inset(100% 0 0 0);
    will-change: clip-path;
  }

  .speech-bubble-copy.has-page-controls {
    flex-direction: column;
    align-items: stretch;
    justify-content: flex-start;
    gap: 8px;
    padding: 14px 20px 18px;
  }

  .speech-bubble-text {
    position: relative;
    display: block;
    width: 100%;
  }

  .speech-bubble-copy.has-page-controls .speech-bubble-text {
    flex: 1;
    display: grid;
    align-items: center;
    min-height: 0;
  }

  .speech-bubble-text-audio {
    color: color-mix(in srgb, var(--color-text-primary) 38%, var(--color-surface-page));
  }

  .speech-bubble-text-line {
    display: block;
  }

  .speech-bubble-text-progress {
    color: var(--color-text-primary);
    white-space: inherit;
  }

  .speech-bubble-text-pending {
    color: color-mix(in srgb, var(--color-text-primary) 38%, var(--color-surface-page));
    white-space: inherit;
  }

  .speech-bubble-meta {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 0 0 var(--speech-bubble-meta-height, 34px);
    height: var(--speech-bubble-meta-height, 34px);
    margin-top: -2px;
    padding: 0 clamp(13px, 1.2vw, 16px);
    border-radius: 0 0 var(--radius-s) var(--radius-s);
    background: var(--color-border-primary);
    color: var(--color-surface-page);
    font-family: var(--font-text);
    font-size: clamp(10px, 0.8vw, 12px);
    font-weight: 700;
    line-height: 1.5;
    overflow: hidden;
    white-space: nowrap;
    -webkit-clip-path: inset(100% 0 0 0);
    clip-path: inset(100% 0 0 0);
    will-change: clip-path;
  }

  .speech-bubble-meta-label {
    display: flex;
    align-items: center;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .speech-bubble-meta strong {
    margin-left: 4px;
    font-family: "Fasthand", cursive;
    font-size: clamp(15px, 1.25vw, 19px);
    font-weight: 400;
    line-height: 1.5;
  }

  .speech-bubble-page-controls {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    min-height: 24px;
    color: var(--color-text-primary);
    line-height: 1;
    pointer-events: auto;
  }

  .speech-bubble-page-button {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
    color: currentColor;
    cursor: url('/cursors/retrogusto-pointer-on-cream.svg?v=3') 4 3, pointer;
    transition:
      opacity 140ms ease,
      transform 120ms ease;
  }

  .speech-bubble-page-icon {
    display: block;
    width: 24px;
    height: 24px;
    overflow: visible;
  }

  .speech-bubble-page-icon-depth,
  .speech-bubble-page-icon-face {
    stroke: currentColor;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-width: 2.6;
  }

  .speech-bubble-page-icon-depth {
    display: none;
  }

  .speech-bubble-page-icon-face {
    fill: var(--color-surface-page);
  }

  .speech-bubble-page-counter {
    min-width: 34px;
    color: currentColor;
    font-family: var(--font-text);
    font-size: 16px;
    font-weight: 400;
    line-height: 1;
    text-align: center;
    white-space: nowrap;
  }

  .speech-bubble-page-button:hover,
  .speech-bubble-page-button:focus-visible {
    outline: none;
  }

  .speech-bubble-page-button:active:not(:disabled),
  :global(.speech-bubble-page-button.is-tap-click-feedback) {
    transform: scale(0.88);
  }

  .speech-bubble-page-button:focus-visible {
    outline: 2px solid currentColor;
    outline-offset: 2px;
  }

  .speech-bubble-page-button:disabled {
    cursor: default;
    opacity: 0.28;
  }

  .speech-bubble-page-button:disabled:hover,
  .speech-bubble-page-button:disabled:focus-visible {
    transform: none;
  }

  .service-chef-button.is-dialogue-visible .speech-bubble {
    opacity: 1;
    transform: translate3d(calc(-50% + var(--speech-bubble-offset-x, 0px)), 0, 0);
    transition-delay: 0ms;
  }

  .service-chef-button.is-dialogue-visible .speech-bubble::before {
    opacity: 1;
    scale: 1;
  }

  .service-chef-button.is-dialogue-visible .speech-bubble-copy {
    animation: dialogueRevealY 320ms cubic-bezier(0.16, 1, 0.3, 1) 20ms both;
  }

  .service-chef-button.is-dialogue-visible .speech-bubble-meta {
    animation: dialogueRevealY 240ms cubic-bezier(0.16, 1, 0.3, 1) 260ms both;
  }

  .service-title {
    position: absolute;
    left: 0;
    top: 0;
    z-index: 6;
    margin: 0;
    color: var(--color-text-primary);
    font-family: var(--font-display);
    font-weight: 700;
    line-height: 1.2;
    pointer-events: none;
    transform: translateY(-50%);
    transform-origin: center center;
    white-space: nowrap;
    will-change: transform;
  }

  .service-title {
    opacity: 0;
  }

  .service-stage.is-loaded .service-title {
    animation: serviceTitleIn 420ms cubic-bezier(0.22, 1, 0.36, 1) 220ms forwards;
  }

  @keyframes serviceTitleIn {
    from {
      opacity: 0;
      transform: translate3d(0, -50%, 0) scale(0.9);
    }
    to {
      opacity: 1;
      transform: translate3d(0, -50%, 0) scale(1);
    }
  }

  @keyframes dialogueRevealY {
    from {
      -webkit-clip-path: inset(100% 0 0 0);
      clip-path: inset(100% 0 0 0);
    }

    to {
      -webkit-clip-path: inset(0 0 0 0);
      clip-path: inset(0 0 0 0);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .service-stage.is-loaded .service-title {
      animation-duration: 1ms;
    }

    .service-chef-button,
    .service-chef-button.is-dialogue-visible .speech-bubble-copy,
    .service-chef-button.is-dialogue-visible .speech-bubble-meta,
    .service-chef-button .speech-bubble,
    .service-chef-button .speech-bubble::before {
      animation-duration: 1ms;
      transition-duration: 1ms;
    }
  }

  @media (max-width: 760px) {
    .scene-coordinate-indicator {
      top: calc(var(--layout-page-gutter-mobile) + 74px);
      right: var(--layout-page-gutter-mobile);
      min-width: 132px;
      padding: 8px 9px;
    }

    .coordinate-indicator-title {
      font-size: 9px;
    }

    .scene-coordinate-indicator div {
      grid-template-columns: 48px 1fr;
      gap: 6px;
    }

    .scene-coordinate-indicator dt,
    .scene-coordinate-indicator dd {
      font-size: 11px;
    }
  }
</style>
