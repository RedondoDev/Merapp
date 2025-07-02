console.log("Merapp is running!");

function preloadBackgroundImages() {
  const backgroundImages = [
    'assets/background/dandelion.png',
    'assets/background/water.png', 
    'assets/background/sakura.png'
  ];
  
  backgroundImages.forEach(imagePath => {
    const img = new Image();
    img.src = imagePath;
  });
}

preloadBackgroundImages();

const RateLimiter = {
  limits: new Map(),

  canMakeRequest(key, maxRequests = 5, windowMs = 10000) {
    const now = Date.now();
    const windowStart = now - windowMs;

    if (!this.limits.has(key)) {
      this.limits.set(key, []);
    }

    const requests = this.limits.get(key);

    while (requests.length > 0 && requests[0] < windowStart) {
      requests.shift();
    }

    if (requests.length >= maxRequests) {
      return false;
    }

    requests.push(now);
    return true;
  },
};

const CacheManager = {
  maxPokemonCache: 1,

  cleanOldCache() {
    try {
      const today = new Date().toISOString().slice(0, 10);

      const dailyCacheKeys = [
        "dailyQuote",
        "moonPhase",
        "weather",
        "randomPokemon",
      ];
      dailyCacheKeys.forEach((key) => {
        const cached = localStorage.getItem(key);
        if (cached) {
          try {
            const data = JSON.parse(cached);
            const cacheDate = data.date || data.hour?.slice(0, 10);
            if (cacheDate && cacheDate !== today) {
              localStorage.removeItem(key);
              console.log(`Removed old cache: ${key}`);
            }
          } catch (e) {
            localStorage.removeItem(key);
          }
        }
      });

      const randomPokemon = localStorage.getItem("randomPokemon");
      let currentPokemonId = null;

      if (randomPokemon) {
        try {
          const { id, date } = JSON.parse(randomPokemon);
          if (date === today) {
            currentPokemonId = id;
          }
        } catch (e) {}
      }

      const pokemonKeys = Object.keys(localStorage).filter((key) =>
        key.startsWith("pokemon_")
      );
      pokemonKeys.forEach((key) => {
        const pokemonId = key.replace("pokemon_", "");
        if (pokemonId != currentPokemonId) {
          localStorage.removeItem(key);
        }
      });

      const remainingPokemon = Object.keys(localStorage).filter((key) =>
        key.startsWith("pokemon_")
      ).length;
      if (remainingPokemon > 1) {
        console.log(
          `Cleaned old Pokemon images, keeping only current day Pokemon`
        );
      }
    } catch (e) {
      console.warn("Cache cleanup error:", e);
    }
  },
};

function fetchDailyQuote() {
  const cached = localStorage.getItem("dailyQuote");
  const today = new Date().toISOString().slice(0, 10);

  if (cached) {
    try {
      const { content, author, date } = JSON.parse(cached);
      if (date === today) {
        document.getElementById("quote-text").textContent = content;
        document.getElementById("quote-author").textContent = author;
        return;
      }
    } catch (e) {
      localStorage.removeItem("dailyQuote");
    }
  }

  if (window.fetchingQuote) return;
  window.fetchingQuote = true;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  fetch(
    "https://api.quotable.io/random?tags=inspirational&minLength=100&maxLength=130",
    {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
    }
  )
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then((data) => {
      document.getElementById("quote-text").textContent = data.content;
      document.getElementById("quote-author").textContent = data.author;
      localStorage.setItem(
        "dailyQuote",
        JSON.stringify({
          content: data.content,
          author: data.author,
          date: today,
        })
      );
    })
    .catch((err) => {
      console.error("Quote fetch error:", err);
      document.getElementById("quote-text").textContent =
        "Success is not final, failure is not fatal: it is the courage to continue that counts.";
      document.getElementById("quote-author").textContent = "Winston Churchill";
    })
    .finally(() => {
      clearTimeout(timeoutId);
      window.fetchingQuote = false;
    });
}

fetchDailyQuote();

function fetchWeather() {
  const cached = localStorage.getItem("weather");
  const now = new Date();
  const hourKey = now.toISOString().slice(0, 13);

  if (cached) {
    try {
      const { data, hour } = JSON.parse(cached);
      if (hour === hourKey) {
        updateWeatherUI(data);
        return;
      }
    } catch (e) {
      localStorage.removeItem("weather");
    }
  }

  if (window.fetchingWeather) return;
  window.fetchingWeather = true;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  fetch(
    "https://www.el-tiempo.net/api/json/v2/provincias/40/municipios/40194",
    {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
    }
  )
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then((data) => {
      updateWeatherUI(data);
      localStorage.setItem("weather", JSON.stringify({ data, hour: hourKey }));
    })
    .catch((err) => {
      console.error("Weather fetch error:", err);
      const fallbackData = {
        temperatura_actual: "N/A",
        stateSky: { description: "desconocido" },
      };
      updateWeatherUI(fallbackData);
    })
    .finally(() => {
      clearTimeout(timeoutId);
      window.fetchingWeather = false;
    });
}

function updateWeatherUI(data) {
  document.getElementById(
    "degrees"
  ).textContent = `${data.temperatura_actual}°C`;
  let stateSky = data.stateSky.description.toLowerCase();
  switch (true) {
    case stateSky.includes("des"):
      document.getElementById("weather-icon").className = "wi wi-day-sunny";
      break;
    case stateSky.includes("nub"):
      document.getElementById("weather-icon").className = "wi wi-cloudy";
      break;
    case stateSky.includes("lluv"):
      document.getElementById("weather-icon").className = "wi wi-rain";
      break;
    case stateSky.includes("torm"):
      document.getElementById("weather-icon").className = "wi wi-storm-showers";
      break;
    case stateSky.includes("niebla"):
      document.getElementById("weather-icon").className = "wi wi-fog";
      break;
    case stateSky.includes("nieve"):
      document.getElementById("weather-icon").className = "wi wi-snow";
      break;
    default:
      document.getElementById("weather-icon").className = "wi wi-na";
      break;
  }
}

fetchWeather();

function fetchMoonPhase() {
  const cached = localStorage.getItem("moonPhase");
  const today = new Date().toISOString().slice(0, 10);

  if (cached) {
    try {
      const { phase, date } = JSON.parse(cached);
      if (date === today) {
        document.getElementById("moon-status").textContent = phase;
        setMoonIcon(phase);
        return;
      }
    } catch (e) {
      localStorage.removeItem("moonPhase");
    }
  }

  if (window.fetchingMoonPhase) return;
  window.fetchingMoonPhase = true;

  const timestamp = Math.floor(Date.now() / 1000);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  fetch(`https://api.farmsense.net/v1/moonphases/?d=${timestamp}`, {
    signal: controller.signal,
    headers: {
      Accept: "application/json",
    },
  })
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then((data) => {
      const phase = data[0].Phase.toLowerCase();
      document.getElementById("moon-status").textContent = phase;
      setMoonIcon(phase);
      localStorage.setItem("moonPhase", JSON.stringify({ phase, date: today }));
    })
    .catch((err) => {
      console.error("Moon phase fetch error:", err);
      document.getElementById("moon-status").textContent = "unknown";
      document.getElementById("moon-icon").className = "wi wi-moon-new";
    })
    .finally(() => {
      clearTimeout(timeoutId);
      window.fetchingMoonPhase = false;
    });
}

function setMoonIcon(phase) {
  if (phase.includes("new")) {
    document.getElementById("moon-icon").className = "wi wi-moon-new";
  } else if (phase.includes("waxing") || phase.includes("first")) {
    document.getElementById("moon-icon").className =
      "wi wi-moon-alt-first-quarter";
  } else if (phase.includes("full")) {
    document.getElementById("moon-icon").className = "wi wi-moon-full";
  } else if (phase.includes("waning") || phase.includes("third")) {
    document.getElementById("moon-icon").className =
      "wi wi-moon-alt-third-quarter";
  }
}

fetchMoonPhase();

function fetchRandomPokemon() {
  const cached = localStorage.getItem("randomPokemon");
  const today = new Date().toISOString().slice(0, 10);

  if (cached) {
    const { id, date } = JSON.parse(cached);
    if (date === today) {
      currentRandomId = id;
      setPokemonImage(id);
      return;
    }
  }

  currentRandomId = Math.floor(Math.random() * 898) + 1;
  setPokemonImage(currentRandomId);
  localStorage.setItem(
    "randomPokemon",
    JSON.stringify({ id: currentRandomId, date: today })
  );
}

function setPokemonImage(id) {
  const cachedImage = localStorage.getItem(`pokemon_${id}`);
  if (cachedImage) {
    let img = document.getElementById("pokemon-image");
    if (!img) {
      img = document.createElement("img");
      img.id = "pokemon-image";
      img.alt = "pokemon image";
      document.querySelector(".poke-container").prepend(img);
    }
    img.src = cachedImage;
    return;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  fetch(
    `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`,
    { signal: controller.signal }
  )
    .then((res) => {
      if (res.ok) {
        return res.blob();
      } else {
        throw new Error("Pokemon not found");
      }
    })
    .then((blob) => {
      let img = document.getElementById("pokemon-image");
      if (!img) {
        img = document.createElement("img");
        img.id = "pokemon-image";
        img.alt = "pokemon image";
        document.querySelector(".poke-container").prepend(img);
      }
      const imageUrl = URL.createObjectURL(blob);
      img.src = imageUrl;

      const reader = new FileReader();
      reader.onload = () => {
        localStorage.setItem(`pokemon_${id}`, reader.result);
      };
      reader.readAsDataURL(blob);
    })
    .catch((err) => {
      console.error("Pokemon image fetch error:", err);
      let img = document.getElementById("pokemon-image");
      if (img) img.src = "assets/test-pokemon.png";
    })
    .finally(() => {
      clearTimeout(timeoutId);
    });
}

fetchRandomPokemon();

async function getPokemonIdByName(name) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(
      `https://pokeapi.co/api/v2/pokemon/${name.toLowerCase()}`,
      {
        signal: controller.signal,
        headers: {
          Accept: "application/json",
        },
      }
    );

    clearTimeout(timeoutId);

    if (!res.ok) return null;
    const data = await res.json();
    return data.id;
  } catch (err) {
    console.error("Pokemon search error:", err);
    return null;
  }
}

async function searchPokemon() {
  const input = document.getElementById("pokemonSearch");
  const border = document.querySelector(".poke-div");
  const image = document.getElementById("pokemon-image");
  let pokemonWritten = input.value.trim().toLowerCase();
  border.style.borderColor = "";

  if (!pokemonWritten) {
    border.style.borderColor = "red";
    return;
  }

  if (!RateLimiter.canMakeRequest("pokemon-search", 5, 10000)) {
    console.warn("Rate limit exceeded for Pokemon search - wait 10 seconds");
    border.style.borderColor = "orange";
    return;
  }

  const id = await getPokemonIdByName(pokemonWritten);
  if (id === null) {
    border.style.borderColor = "red";
    return;
  }
  if (id === currentRandomId) {
    border.style.borderColor = "green";
    image.style.filter = "brightness(1)";
  } else {
    border.style.borderColor = "red";
  }
}

window.changeTheme = function (buttonNumber) {
  switch (buttonNumber) {
    case 1:
      console.log("Dandelion theme selected");
      document.body.style.backgroundImage =
        "url('assets/background/dandelion.png')";
      document.querySelector(".crystal").style.backgroundColor = "#8FEF3C10";
      changeAnimeImage("assets/violet-evergarden.png");
      changeTransparentDivsColor(
        "#FFF6E524",
        "blur(7px)",
        "2px solid #FFFFFF27"
      );
      changeThemesButtonsStyle(buttonNumber);
      break;
    case 2:
      console.log("Water theme selected");
      document.body.style.backgroundImage =
        "url('assets/background/water.png')";
      document.querySelector(".crystal").style.backgroundColor = "#2FC5D515";
      changeAnimeImage("assets/love-water.png");
      changeTransparentDivsColor(
        "#E6F8FF24",
        "blur(7px)",
        "2px solid #FFFFFF27"
      );
      changeThemesButtonsStyle(buttonNumber);
      break;
    case 3:
      console.log("Sakura theme selected");
      document.body.style.backgroundImage =
        "url('assets/background/sakura.png')";
      document.querySelector(".crystal").style.backgroundColor = "#FFBCD730";
      changeAnimeImage("assets/your-name.png");
      changeTransparentDivsColor(
        "#FFFFFF24",
        "blur(10px)",
        "2px solid #FFFFFF53"
      );
      changeThemesButtonsStyle(buttonNumber);
      document.querySelectorAll(".transparent-div").forEach((el) => {
        el.style.backgroundColor = "#F7CBD650";
      });
      break;
  }
};

function changeAnimeImage(newSrc) {
  const img = document.querySelector(".anime-image");
  img.style.opacity = 0;
  setTimeout(() => {
    img.src = newSrc;
    img.style.opacity = 1;
  }, 300);
}

function changeTransparentDivsColor(color, filter, border) {
  const elements = document.querySelectorAll(".transparent-div");
  elements.forEach((el) => {
    el.style.backgroundColor = color;
    el.style.backdropFilter = filter;
    el.style.border = border;
  });
}

function changeThemesButtonsStyle(buttonNumber) {
  switch (buttonNumber) {
    case 1:
      document.querySelector(".theme-dandelion").style.width = "50px";
      document.querySelector(".theme-dandelion").style.height = "45px";
      document.querySelector(".theme-water").style.width = "55px";
      document.querySelector(".theme-water").style.height = "50px";
      document.querySelector(".theme-sakura").style.width = "55px";
      document.querySelector(".theme-sakura").style.height = "50px";
      document.getElementById("dandelion-icon").style.filter = "blur(0)";
      document.getElementById("water-icon").style.filter = "blur(2px)";
      document.getElementById("sakura-icon").style.filter = "blur(2px)";
      break;
    case 2:
      document.querySelector(".theme-dandelion").style.width = "55px";
      document.querySelector(".theme-dandelion").style.height = "50px";
      document.querySelector(".theme-water").style.width = "50px";
      document.querySelector(".theme-water").style.height = "45px";
      document.querySelector(".theme-sakura").style.width = "55px";
      document.querySelector(".theme-sakura").style.height = "50px";
      document.getElementById("dandelion-icon").style.filter = "blur(2px)";
      document.getElementById("water-icon").style.filter = "blur(0)";
      document.getElementById("sakura-icon").style.filter = "blur(2px)";
      break;
    case 3:
      document.querySelector(".theme-dandelion").style.width = "55px";
      document.querySelector(".theme-dandelion").style.height = "50px";
      document.querySelector(".theme-water").style.width = "55px";
      document.querySelector(".theme-water").style.height = "50px";
      document.querySelector(".theme-sakura").style.width = "50px";
      document.querySelector(".theme-sakura").style.height = "45px";
      document.getElementById("dandelion-icon").style.filter = "blur(2px)";
      document.getElementById("water-icon").style.filter = "blur(2px)";
      document.getElementById("sakura-icon").style.filter = "blur(0)";
      break;
  }
}

let timer = 50 * 60;
let timerInterval;
let isRunning = false;
const beep = new Audio("assets/beep.mp3");

function startPauseTimer() {
  console.log("Starting/Pausing timer");
  const timerDisplay = document.getElementById("timer-display");
  const startPauseImg = document.getElementById("start-pause-button");
  const pomodoroStatus = document.getElementById("pomodoro-status");

  if (!isRunning) {
    isRunning = true;
    startPauseImg.src = "assets/pause.svg";
    pomodoroStatus.textContent = "Study time";

    timerInterval = setInterval(() => {
      if (timer > 0) {
        timer--;
        const minutes = Math.floor(timer / 60);
        const seconds = timer % 60;
        timerDisplay.textContent = `${minutes}:${
          seconds < 10 ? "0" : ""
        }${seconds}`;
      } else {
        clearInterval(timerInterval);
        isRunning = false;
        startPauseImg.src = "assets/start.svg";
        pomodoroStatus.textContent = "Rest time";
        timer = 50 * 60;
        timerDisplay.textContent = "50:00";
      }
      if (timer === 5) {
        beep.play();
      }
    }, 1000);
  } else {
    clearInterval(timerInterval);
    isRunning = false;
    startPauseImg.src = "assets/start.svg";
    pomodoroStatus.textContent = "Paused";
  }
}

const lofi = new Audio("assets/lofi.mp3");

const volumeSlider = document.getElementById("volume-slider");
if (volumeSlider) {
  volumeSlider.addEventListener("input", function (e) {
    lofi.volume = e.currentTarget.value / 100;
  });
}

function toggleLofi() {
  const lofiButton = document.getElementById("mute-button");
  if (lofi.paused) {
    lofi.play();
    document.querySelector(".mute-icon").src = "assets/unmute.svg";
  } else {
    lofi.pause();
    document.querySelector(".mute-icon").src = "assets/mute.svg";
  }
}

function msUntilMidnight() {
  const now = new Date();
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  return next - now;
}

setTimeout(() => {
  CacheManager.cleanOldCache();

  fetchDailyQuote();
  fetchRandomPokemon();
  fetchMoonPhase();

  setInterval(() => {
    CacheManager.cleanOldCache();
    fetchDailyQuote();
    fetchRandomPokemon();
    fetchMoonPhase();
  }, 24 * 60 * 60 * 1000);
}, msUntilMidnight());

function msUntilNextHour() {
  const now = new Date();
  return (
    (60 - now.getMinutes()) * 60 * 1000 -
    now.getSeconds() * 1000 -
    now.getMilliseconds()
  );
}

setTimeout(() => {
  fetchWeather();
  setInterval(fetchWeather, 60 * 60 * 1000);
}, msUntilNextHour());

CacheManager.cleanOldCache();
