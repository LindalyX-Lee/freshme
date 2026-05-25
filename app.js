const DAY_MS = 24 * 60 * 60 * 1000;
const MAIN_MIN_SECONDS = 50 * 60;
const MAIN_MAX_SECONDS = 90 * 60;
const HISTORY_DAYS = 7;
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
const state = {
  playlist: [],
  player: null,
  activeIndex: 0,
  ready: false
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

function signatureFor(list) {
  return list.map((track) => `${track.videoId}:${track.startAtSeconds || 0}`).join("|");
}

function buildMain(date = dateKey()) {
  const history = getHistory();
  const recentSignatures = new Set(
    Object.entries(history)
      .filter(([key]) => key !== date)
      .map(([, signature]) => signature)
  );
  const usable = tracks.main.filter((track) => track.fetchStatus === "ok" && track.playableSeconds > 0);

  for (let attempt = 0; attempt < 32; attempt += 1) {
    const random = seededRandom(hashString(`${date}:${attempt}:freshme`));
    const ordered = shuffled(usable, random);
    const selected = [];
    let seconds = 0;

    for (const track of ordered) {
      if (seconds >= MAIN_MIN_SECONDS) break;
      if (selected.length > 0 && seconds + track.playableSeconds > MAIN_MAX_SECONDS) continue;
      selected.push(track);
      seconds += track.playableSeconds;
    }

    if (seconds >= MAIN_MIN_SECONDS && seconds <= MAIN_MAX_SECONDS) {
      const signature = signatureFor(selected);
      if (!recentSignatures.has(signature) || attempt === 31) return selected;
    }
  }

  return usable.slice(0, 1);
}

function buildPlaylist(date = dateKey()) {
  const opening = tracks.opening.find((track) => track.fetchStatus === "ok");
  const openingRepeat = opening ? { ...opening, repeatLabel: "repeat" } : null;
  const main = buildMain(date);
  const playlist = [opening, openingRepeat, ...main].filter(Boolean);
  saveHistory(date, signatureFor(main));
  return playlist;
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
  els.cover.src = `./assets/cover-${dateKey()}.png`;
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
        <p class="track-note">${index < 2 ? `Part 1 · 喜洋洋 ${index + 1}/2` : "Part 2 · Main practice"}</p>
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

function setActive(index) {
  state.activeIndex = index;
  document.querySelectorAll(".track").forEach((item) => {
    item.classList.toggle("active", Number(item.dataset.index) === index);
  });
}

function playTrack(index) {
  const track = state.playlist[index];
  if (!track || !state.player) return;
  setActive(index);
  els.status.textContent = `Playing ${index + 1}/${state.playlist.length}`;
  state.player.loadVideoById({
    videoId: track.videoId,
    startSeconds: track.startAtSeconds || 0
  });
}

window.onYouTubeIframeAPIReady = () => {
  state.player = new YT.Player("player", {
    width: "100%",
    height: "100%",
    playerVars: {
      autoplay: 0,
      controls: 1,
      playsinline: 1,
      rel: 0,
      modestbranding: 1
    },
    events: {
      onReady: () => {
        state.ready = true;
        els.start.disabled = false;
        els.status.textContent = "Ready";
      },
      onStateChange: (event) => {
        if (event.data === YT.PlayerState.ENDED) {
          const next = state.activeIndex + 1;
          if (next < state.playlist.length) {
            playTrack(next);
          } else {
            els.status.textContent = "Complete";
            setActive(-1);
          }
        }
      }
    }
  });
};

els.start.addEventListener("click", () => {
  if (!state.ready) {
    els.status.textContent = "Loading YouTube...";
    return;
  }
  playTrack(0);
});

state.playlist = buildPlaylist();
renderPlaylist();
els.start.disabled = true;
