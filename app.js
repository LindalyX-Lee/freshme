const DAY_MS = 24 * 60 * 60 * 1000;
const MAIN_MIN_SECONDS = 50 * 60;
const MAIN_MAX_SECONDS = 90 * 60;
const HISTORY_DAYS = 7;
const OPENING_REPEAT_COUNT = 5;
const EARLY_PAUSE_RESUME_WINDOW_MS = 30 * 1000;
const MAX_AUTO_RESUME_ATTEMPTS = 2;
const DAILY_MANTRAS = [
  "清晨先省心，身心自有新生。",
  "虚其心，实其腹，今日从一息开始。",
  "不急不争，先把自己放回身体里。",
  "一念清明，万事从容。",
  "守静笃，复归于朴。",
  "晨光入眼，气息归根。",
  "先正其身，再行其事。",
  "少一点用力，多一点觉知。",
  "今日不求满，只求真。",
  "把心收回来，路自然展开。",
  "三省吾身，一省即新。",
  "神清则气定，气定则身安。",
  "以柔胜躁，以静养明。",
  "晨起一念新，旧我少一分。",
  "不向外追，先向内明。"
];

const tracks = window.FRESHME_TRACKS;
const covers = window.FRESHME_COVERS || [];
const state = {
  playlist: [],
  player: null,
  activeIndex: 0,
  ready: false,
  nativeQueue: false,
  startedAt: 0,
  autoResumeAttempts: 0
};

const els = {
  cover: document.querySelector("#daily-cover"),
  today: document.querySelector("#today-label"),
  totalTime: document.querySelector("#total-time"),
  trackCount: document.querySelector("#track-count"),
  start: document.querySelector("#start-button"),
  status: document.querySelector("#flow-status"),
  list: document.querySelector("#playlist-list")
};

function trackTheme(track) {
  const text = `${track?.title || ""} ${track?.note || ""}`.toLowerCase();
  if (text.includes("普庵") || text.includes("咒") || text.includes("mantra")) return "sound";
  if (text.includes("heart sutra") || text.includes("心经") || text.includes("金刚经") || text.includes("清静经") || text.includes("清靜經") || text.includes("sutra")) return "sutra";
  if (text.includes("道") || text.includes("清淨") || text.includes("tranquility")) return "dao";
  if (text.includes("guqin") || text.includes("古琴") || text.includes("琴")) return "guqin";
  if (text.includes("喜洋洋") || text.includes("喜气") || text.includes("喜氣")) return "joy";
  return "tea";
}

function repeatCountFor(track) {
  return Math.max(1, Number(track.repeatCount || 1));
}

function trackDuration(track) {
  return track.playableSeconds * repeatCountFor(track);
}

function dateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dayNumber(key) {
  const [year, month, day] = key.split("-").map(Number);
  return Math.floor(new Date(year, month - 1, day).getTime() / DAY_MS);
}

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(input) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function shuffled(items, random) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function getHistory() {
  try {
    return JSON.parse(localStorage.getItem("freshme-history") || "{}");
  } catch {
    return {};
  }
}

function saveHistory(key, signature) {
  const history = getHistory();
  history[key] = signature;
  const keepAfter = dayNumber(key) - HISTORY_DAYS;
  for (const oldKey of Object.keys(history)) {
    if (dayNumber(oldKey) < keepAfter) delete history[oldKey];
  }
  localStorage.setItem("freshme-history", JSON.stringify(history));
}

function getCoverHistory() {
  try {
    return JSON.parse(localStorage.getItem("freshme-cover-history") || "{}");
  } catch {
    return {};
  }
}

function saveCoverHistory(key, coverId) {
  const history = getCoverHistory();
  history[key] = coverId;
  const keepAfter = dayNumber(key) - HISTORY_DAYS;
  for (const oldKey of Object.keys(history)) {
    if (dayNumber(oldKey) < keepAfter) delete history[oldKey];
  }
  localStorage.setItem("freshme-cover-history", JSON.stringify(history));
}

function signatureFor(list) {
  return list.map((track) => `${track.videoId}:${track.startAtSeconds || 0}:${repeatCountFor(track)}`).join("|");
}

function buildMain(date = dateKey()) {
  const history = getHistory();
  const recentSignatures = new Set(
    Object.entries(history)
      .filter(([key]) => key !== date)
      .map(([, signature]) => signature)
  );
  const usable = tracks.main.filter((track) => track.fetchStatus === "ok" && track.playableSeconds > 0 && !track.startAtSeconds);

  for (let attempt = 0; attempt < 32; attempt += 1) {
    const random = seededRandom(hashString(`${date}:${attempt}:freshme`));
    const ordered = shuffled(usable, random);
    const selected = [];
    let seconds = 0;

    for (const track of ordered) {
      if (seconds >= MAIN_MIN_SECONDS) break;
      const duration = trackDuration(track);
      if (selected.length > 0 && seconds + duration > MAIN_MAX_SECONDS) continue;
      selected.push(track);
      seconds += duration;
    }

    if (seconds >= MAIN_MIN_SECONDS && seconds <= MAIN_MAX_SECONDS) {
      const signature = signatureFor(selected);
      if (!recentSignatures.has(signature) || attempt === 31) return selected;
    }
  }

  return usable.slice(0, 1);
}

function expandRepeatedTracks(list) {
  return list.flatMap((track) => {
    const repeatTotal = repeatCountFor(track);
    return Array.from({ length: repeatTotal }, (_, index) => ({
      ...track,
      repeatLabel: index + 1,
      repeatTotal
    }));
  });
}

function buildPlaylist(date = dateKey()) {
  const opening = tracks.opening.find((track) => track.fetchStatus === "ok");
  const openingTracks = opening
    ? Array.from({ length: OPENING_REPEAT_COUNT }, (_, index) => ({ ...opening, repeatLabel: index + 1 }))
    : [];
  const main = buildMain(date);
  saveHistory(date, signatureFor(main));
  return [...openingTracks, ...expandRepeatedTracks(main)];
}

function selectCover(date, playlist) {
  const mainTheme = trackTheme(playlist.find((track, index) => index >= OPENING_REPEAT_COUNT) || playlist[0]);
  const history = getCoverHistory();
  const recentIds = new Set(
    Object.entries(history)
      .filter(([key]) => key !== date)
      .map(([, coverId]) => coverId)
  );
  const themed = covers.filter((cover) => cover.theme === mainTheme);
  const pool = themed.length ? themed : covers;
  const themedAvailable = themed.filter((cover) => !recentIds.has(cover.id));
  const allAvailable = covers.filter((cover) => !recentIds.has(cover.id));
  const candidates = themedAvailable.length ? themedAvailable : (allAvailable.length ? allAvailable : pool);
  if (!candidates.length) return null;
  const random = seededRandom(hashString(`${date}:${mainTheme}:cover`));
  const cover = candidates[Math.floor(random() * candidates.length)];
  saveCoverHistory(date, cover.id);
  return cover;
}

function formatDuration(seconds) {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

function renderPlaylist() {
  const total = state.playlist.reduce((sum, track) => sum + track.playableSeconds, 0);
  els.today.textContent = new Intl.DateTimeFormat("zh-CN", {
    weekday: "long",
    month: "long",
    day: "numeric"
  }).format(new Date());
  document.querySelector("#daily-mantra").textContent = DAILY_MANTRAS[dayNumber(dateKey()) % DAILY_MANTRAS.length];
  els.totalTime.textContent = formatDuration(total);
  els.trackCount.textContent = String(state.playlist.length);
  const cover = selectCover(dateKey(), state.playlist);
  els.cover.src = cover?.src || "./assets/cover-default.png";
  els.cover.alt = cover ? `FreshMe 今日封面：${cover.title}` : "FreshMe 今日封面";
  els.cover.onerror = () => {
    if (!els.cover.dataset.fallback) {
      els.cover.dataset.fallback = "true";
      els.cover.src = "./assets/cover-default.png";
      return;
    }
    els.cover.style.display = "none";
  };

  els.list.innerHTML = "";
  state.playlist.forEach((track, index) => {
    const item = document.createElement("li");
    item.className = "track";
    item.dataset.index = String(index);
    item.innerHTML = `
      <div class="track-index">${String(index + 1).padStart(2, "0")}</div>
      <div>
        <p class="track-title">${track.title}</p>
        <p class="track-note">${trackFlowNote(track, index)}</p>
      </div>
      <div class="track-time">${formatDuration(track.playableSeconds)}</div>
    `;
    item.addEventListener("click", () => {
      if (!state.ready) {
        els.status.textContent = "Loading YouTube...";
        return;
      }
      playTrack(index);
    });
    els.list.appendChild(item);
  });
}

function trackFlowNote(track, index) {
  if (index < OPENING_REPEAT_COUNT) return `Part 1 · 喜洋洋 ${index + 1}/${OPENING_REPEAT_COUNT}`;
  if (track.repeatTotal > 1) return `Part 2 · ${track.shortTitle || "Main practice"} ${track.repeatLabel}/${track.repeatTotal}`;
  return "Part 2 · Main practice";
}

function setActive(index) {
  state.activeIndex = index;
  document.querySelectorAll(".track").forEach((item) => {
    item.classList.toggle("active", Number(item.dataset.index) === index);
  });
}

function canUseNativeQueue() {
  return state.playlist.every((track, index) => index === 0 || !track.startAtSeconds);
}

function queueVideoIds() {
  return state.playlist.map((track) => track.videoId);
}

function markPlaybackStarted() {
  state.startedAt = Date.now();
  state.autoResumeAttempts = 0;
}

function enableIframeAutoplay() {
  const iframe = state.player?.getIframe?.();
  if (!iframe) return;
  iframe.setAttribute("allow", "autoplay; encrypted-media; fullscreen; picture-in-picture");
}

function playTrack(index) {
  const track = state.playlist[index];
  if (!track || !state.player) return;
  markPlaybackStarted();
  setActive(index);
  els.status.textContent = `Playing ${index + 1}/${state.playlist.length}`;
  if (state.nativeQueue) {
    state.player.playVideoAt(index);
    return;
  }
  state.player.loadVideoById({
    videoId: track.videoId,
    startSeconds: track.startAtSeconds || 0
  });
}

function startFlow() {
  if (!state.player || !state.playlist.length) return;
  state.nativeQueue = canUseNativeQueue();
  markPlaybackStarted();
  setActive(0);
  els.status.textContent = `Playing 1/${state.playlist.length}`;

  if (state.nativeQueue) {
    state.player.loadPlaylist({
      list: queueVideoIds(),
      listType: "playlist",
      index: 0,
      startSeconds: state.playlist[0].startAtSeconds || 0
    });
    return;
  }

  playTrack(0);
}

function maybeResumeEarlyPause() {
  if (!state.startedAt || state.autoResumeAttempts >= MAX_AUTO_RESUME_ATTEMPTS) return;
  if (Date.now() - state.startedAt > EARLY_PAUSE_RESUME_WINDOW_MS) return;
  state.autoResumeAttempts += 1;
  els.status.textContent = "Resuming...";
  window.setTimeout(() => {
    if (state.player?.getPlayerState?.() === YT.PlayerState.PAUSED) {
      state.player.playVideo();
    }
  }, 250);
}

function syncNativeQueueIndex() {
  if (!state.nativeQueue) return;
  const index = state.player?.getPlaylistIndex?.();
  if (!Number.isInteger(index) || index < 0 || index >= state.playlist.length) return;
  setActive(index);
  els.status.textContent = `Playing ${index + 1}/${state.playlist.length}`;
}

function handlePlaybackEnded() {
  if (state.nativeQueue) {
    if (state.activeIndex >= state.playlist.length - 1) {
      els.status.textContent = "Complete";
      setActive(-1);
    }
    return;
  }

  const next = state.activeIndex + 1;
  if (next < state.playlist.length) {
    playTrack(next);
  } else {
    els.status.textContent = "Complete";
    setActive(-1);
  }
}

function handleAutoplayBlocked() {
  els.status.textContent = "Tap YouTube play once";
}

window.onYouTubeIframeAPIReady = () => {
  const origin = window.location.origin.startsWith("http") ? window.location.origin : undefined;
  state.player = new YT.Player("player", {
    width: "100%",
    height: "100%",
    playerVars: {
      autoplay: 0,
      controls: 1,
      playsinline: 1,
      rel: 0,
      modestbranding: 1,
      ...(origin ? { origin } : {})
    },
    events: {
      onReady: () => {
        state.ready = true;
        enableIframeAutoplay();
        els.start.disabled = false;
        els.status.textContent = "Ready";
      },
      onStateChange: (event) => {
        if (event.data === YT.PlayerState.PLAYING) syncNativeQueueIndex();
        if (event.data === YT.PlayerState.PAUSED) maybeResumeEarlyPause();
        if (event.data === YT.PlayerState.ENDED) {
          handlePlaybackEnded();
        }
      },
      onAutoplayBlocked: handleAutoplayBlocked
    }
  });
};

els.start.addEventListener("click", () => {
  if (!state.ready) {
    els.status.textContent = "Loading YouTube...";
    return;
  }
  startFlow();
});

state.playlist = buildPlaylist();
renderPlaylist();
els.start.disabled = true;
